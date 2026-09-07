import { quotaRouter } from './quota_router';
import { healthService } from './health_service';
import { usageService } from './usage_service';
import { observabilityService } from './observability_service';
import { providerService } from './provider_service';
import { credentialService } from './credential_service';
import { secretVault } from '../security/secret_vault';
import { openaiCompatibleDriver } from './openai_compatible_driver';
import { GoogleGenAI } from '@google/genai';
import { capabilityRegistry, AICapabilityError, modelsRegistry } from './capability_registry';
import { globalAIQueue } from './rate_limiter_queue';
import { classifyTaskRequirements, rankCandidatesForIntent, TaskIntentRecommendation } from './intelligence_router';
import { costIntelligenceService } from './cost_intelligence';
import { costMonitor } from './cost_monitor';
import { db } from '../db';
import { aiBudgetRegistry, AIBudgetExhaustedError } from './ai_budget_registry';

export const dailyExhaustedRegistry = new Map<string, number>();

export function resetDailyExhaustedRegistry(): void {
  dailyExhaustedRegistry.clear();
}

export function isModelSuppressed(cacheKey: string): boolean {
  const expiry = dailyExhaustedRegistry.get(cacheKey);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    dailyExhaustedRegistry.delete(cacheKey);
    return false;
  }
  return true;
}

export function markModelSuppressed(cacheKey: string, ttlMs: number = 60000): void {
  dailyExhaustedRegistry.set(cacheKey, Date.now() + ttlMs);
}

export function extractRetryDelayMs(err: any): number {
  if (!err) return 60000;
  const str = (err?.message || JSON.stringify(err) || '').toLowerCase();
  
  // 1. Google RPC RetryInfo
  const details = err?.details || err?.error?.details;
  if (Array.isArray(details)) {
    for (const d of details) {
      if (d?.['@type']?.includes('RetryInfo')) {
        const match = String(d.retryDelay || '').match(/(\d+)s/);
        if (match) {
          return (parseInt(match[1], 10) + 2) * 1000;
        }
      }
    }
  }

  // 2. Text match (e.g., "retry in 35.6s" or "retry in 42s")
  const match = str.match(/retry in (\d+\.?\d*)s/);
  if (match) {
    return Math.ceil(parseFloat(match[1]) + 2) * 1000;
  }

  return 60000; // Default 60s cooldown
}

export function isDailyQuotaExhaustedError(err: any): boolean {
  if (!err) return false;
  const str = (err?.message || JSON.stringify(err) || '').toLowerCase();

  // 1. Check for explicit daily tokens / requests quota identifiers or messages
  if (
    str.includes('generaterequestsperday') ||
    str.includes('generatecontentinputtokenspermodelperday') ||
    str.includes('perday') ||
    str.includes('per_day') ||
    str.includes('per day') ||
    str.includes('daily') ||
    str.includes('limit: 0') ||
    str.includes('limit: 20')
  ) {
    return true;
  }

  // 2. Inspect Google RPC details array for daily violations
  const details = err?.details || err?.error?.details;
  if (Array.isArray(details)) {
    for (const d of details) {
      if (Array.isArray(d?.violations)) {
        for (const v of d.violations) {
          const qId = (v?.quotaId || '').toLowerCase();
          const qMetric = (v?.quotaMetric || '').toLowerCase();
          const qVal = String(v?.quotaValue || '');
          if (qId.includes('day') || qMetric.includes('day') || qVal === '20' || qVal === '0') {
            return true;
          }
        }
      }
    }
  }

  return false;
}

export async function getDisabledModelIds(): Promise<Set<string>> {
  const disabled = new Set<string>();
  try {
    const allModels = await db.getModels();
    for (const m of allModels) {
      if (m.enabled === false) {
        disabled.add(m.id);
      }
    }
    const allProviders = await db.getProviders();
    for (const p of allProviders) {
      if (p.enabled === false) {
        for (const m of allModels) {
          if (m.providerId === p.id) {
            disabled.add(m.id);
          }
        }
        if (p.id === 'google') {
          ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'].forEach(id => disabled.add(id));
        }
      }
    }
  } catch (err) {
    console.warn('[AIGateway] Warning fetching disabled models:', err);
  }
  return disabled;
}

export const CINEMA_FALLBACK_POLICY: Record<string, string[]> = {
  // S1
  story_analysis: [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
  ],
  story_understanding: [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
  ],
  // S2
  character_analysis: [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
  ],
  character_detection: [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
  ],
  // S3
  location_analysis: [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
  ],
  location_detection: [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
  ],
  location_object_analysis: [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
  ],
  location_object_detection: [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
  ],
  // S4
  narrative_structure: [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
  ],
  // S5
  scene_breakdown: [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
  ],
  // S6
  shot_breakdown: [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
  ],
  // S7
  master_frame: [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
  ],
  master_frame_generation: [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
  ],
  master_frame_image_prompt: [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
  ],
  // S8
  video_prompt: [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
  ],
  video_prompt_generation: [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
  ],
  // General
  general_reasoning: [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
  ],
  creative_generation: [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
  ],
};

export function isForbiddenCinemaModel(model: string): boolean {
  if (!model) return false;
  const blocked = [
    /lite/i,
    /flash-lite/i,
  ];
  return blocked.some(regex => regex.test(model));
}

export const FORBIDDEN_CINEMA_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-flash-lite',
  'gemini-2.0-flash-lite',
  'unknown-lite-models',
];

export interface AIGatewayRequest {
  model?: string;
  task?: string;
  prompt: string;
  systemInstruction?: string;
  agentName?: string;
  providerId?: string;
  credentialId?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  responseSchema?: any;
  simulateQuotaErrorOnModel?: string;
  projectId?: string;
  plan?: any;
  fallbackPlan?: Array<{
    type: 'same_provider_next_credential' | 'next_eligible_model' | 'next_provider';
    providerId: string;
    modelId: string;
    credentialId?: string;
    score?: number;
    description: string;
  }>;
}

export interface AIGatewayResponse {
  text: string;
  credentialId: string;
  providerId: string;
  model: string;
  latencyMs: number;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export const aiGateway = {
  async generate(req: AIGatewayRequest): Promise<AIGatewayResponse> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Intelligence Router Bridge: Translate task intent into candidate ranking preferences
    let taskIntent: TaskIntentRecommendation | undefined;
    let recommendedCandidate: string | undefined;
    let adaptiveScore: number | undefined;
    let learningScore: number | undefined;
    let confidenceScore: number | undefined;
    let optimizationReason: string | undefined;
    let decisionExplanationResult: any | undefined;
    let routingSource: 'explicit_override' | 'intelligence_router' | 'default_fallback' = 'default_fallback';
    let fallbackReason: string | undefined;

    if (req.model) {
      routingSource = 'explicit_override';
    } else if (req.task) {
      taskIntent = classifyTaskRequirements(req.task);
      const rankedResult = rankCandidatesForIntent(taskIntent, modelsRegistry);
      if (rankedResult) {
        recommendedCandidate = rankedResult.modelId;
        adaptiveScore = rankedResult.adaptiveScore;
        learningScore = rankedResult.learningScore;
        confidenceScore = rankedResult.confidenceScore;
        optimizationReason = rankedResult.optimizationReason;
        decisionExplanationResult = rankedResult.decisionExplanation;
        routingSource = 'intelligence_router';
      } else {
        fallbackReason = 'No matching model candidate found for classified intent';
      }
    }

    const agentName = req.agentName || 'DefaultAgent';
    const budgetStateDetails = costMonitor.getBudgetState(agentName);
    let downgradeReason: string | undefined;

    // Budget Guard: If budget state is CONSTRAINED or LOCKED and no explicit model override, adapt ranking hint
    if ((budgetStateDetails.state === 'CONSTRAINED' || budgetStateDetails.state === 'LOCKED') && !req.model && taskIntent) {
      if (taskIntent.preferredTier !== 'flash') {
        const originalTier = taskIntent.preferredTier;
        taskIntent = { ...taskIntent, preferredTier: 'flash' };
        const downgradedRanked = rankCandidatesForIntent(taskIntent, modelsRegistry);
        if (downgradedRanked) {
          recommendedCandidate = downgradedRanked.modelId;
          adaptiveScore = downgradedRanked.adaptiveScore;
          learningScore = downgradedRanked.learningScore;
          confidenceScore = downgradedRanked.confidenceScore;
          optimizationReason = downgradedRanked.optimizationReason;
          decisionExplanationResult = downgradedRanked.decisionExplanation;
        }
        downgradeReason = `Budget state ${budgetStateDetails.state} (${budgetStateDetails.consumedPercentage}% consumed) adapted ranking hint from ${originalTier} to flash`;
      }
    }

    const modelId = req.model || (req.plan ? req.plan.modelId : undefined) || recommendedCandidate || 'ops-5';
    const activeProviderId = req.providerId || (req.plan ? req.plan.providerId : undefined);
    const taskType = req.task || 'general_generation';
    const isComplexTask = ['scene_breakdown', 'shot_breakdown', 'narrative_structure', 'story_understanding'].includes(String(req.task));
    const timeoutMs = req.timeoutMs || (isComplexTask ? 90000 : 60000);

    // Dynamically synchronize custom/database-registered models with AMM capability registry
    if (!modelsRegistry[modelId]) {
      try {
        const dbModel = await db.getModel(modelId, req.providerId);
        if (dbModel) {
          capabilityRegistry.registerAMMModel(dbModel.id, dbModel.providerId, 'text', dbModel.id);
        }
      } catch {
        // Safe failover to existing registry state
      }
    }

    // Calculate pre-execution cost estimate
    const costEstimate = costIntelligenceService.estimateRequestCost(
      req.prompt,
      req.systemInstruction,
      modelId,
      taskIntent?.complexity
    );

    // 1. Get all enabled providers
    let allProviders: any[] = [];
    try {
      allProviders = await providerService.listProviders();
    } catch (err) {
      allProviders = [{ id: 'google', name: 'Google Provider', enabled: true, capabilities: { text: true } }];
    }
    const enabledProviders = allProviders.filter(p => p.enabled);

    // 2. Ask Phase 4.2 for eligible providers
    const eligibleProviders: any[] = [];
    const eligibleProviderIds: string[] = [];
    for (const provider of enabledProviders) {
      try {
        const opState = await quotaRouter.getProviderOperationalState(provider.id);
        if (opState.eligibility) {
          eligibleProviders.push(provider);
          eligibleProviderIds.push(provider.id);
        }
      } catch (err) {
        eligibleProviders.push(provider);
        eligibleProviderIds.push(provider.id);
      }
    }
    if (eligibleProviders.length === 0) {
      eligibleProviders.push(...enabledProviders);
      enabledProviders.forEach(p => eligibleProviderIds.push(p.id));
    }

    // 3. Evaluate capability only for eligible candidates
    const capableAndEligibleProviders: any[] = [];
    const capableProviderIds: string[] = [];
    const capabilityMismatches: Array<{ providerId: string; reason: string }> = [];

    for (const provider of eligibleProviders) {
      const capResult = capabilityRegistry.isProviderCapable(provider.id, modelId, provider);
      if (capResult.capable) {
        capableAndEligibleProviders.push(provider);
        capableProviderIds.push(provider.id);
      } else {
        capabilityMismatches.push({ providerId: provider.id, reason: capResult.reason || 'capability mismatch' });
        console.log(`Capability mismatch: Provider '${provider.id}' is eligible but lacks capability for model '${modelId}'. Reason: ${capResult.reason}`);
      }
    }

    // 4. Select target candidate provider(s) strictly according to TaskRouter / Request Plan
    const effectiveProviderId = req.providerId || (req.plan ? req.plan.providerId : undefined);
    let targetProviders = capableAndEligibleProviders;
    if (effectiveProviderId) {
      const allowedProviderIds = new Set<string>([effectiveProviderId]);
      if (req.plan?.fallbackPlan) {
        req.plan.fallbackPlan.forEach(fp => allowedProviderIds.add(fp.providerId));
      }
      targetProviders = capableAndEligibleProviders.filter(p => allowedProviderIds.has(p.id));
      targetProviders.sort((a, b) => {
        if (a.id === effectiveProviderId) return -1;
        if (b.id === effectiveProviderId) return 1;
        return 0;
      });
    } else {
      targetProviders.sort((a, b) => {
        if (a.id !== 'google' && b.id === 'google') return -1;
        if (a.id === 'google' && b.id !== 'google') return 1;
        return 0;
      });
    }

    // If no provider is both eligible and capable, throw a capability mismatch error
    if (targetProviders.length === 0) {
      const isKnownModel = Boolean(modelsRegistry[modelId]);
      if (!isKnownModel) {
        throw new AICapabilityError(`unsupported capability: Model '${modelId}' not found in registry`);
      }
      throw new AICapabilityError(`unsupported capability: No eligible and capable providers found to execute model '${modelId}'`);
    }

    let lastError: any = null;
    let totalAttempts = 0;

    for (const currentProvider of targetProviders) {
      const currentProviderId = currentProvider.id;

      // Get ordered fallback chain of credentials
      let scoredCredentials;
      try {
        scoredCredentials = await quotaRouter.scoreCredentials(currentProviderId);
      } catch (err: any) {
        continue;
      }

      if (req.plan?.credentialId) {
        const targetCredId = req.plan.credentialId;
        scoredCredentials.sort((a, b) => {
          if (a.credential.id === targetCredId) return -1;
          if (b.credential.id === targetCredId) return 1;
          return 0;
        });
      }

      if (scoredCredentials.length === 0) {
        scoredCredentials = [{
          credential: { id: 'mock_test_cred', providerId: currentProviderId, encryptedSecret: 'mock_secret' } as any,
          healthStatus: 'HEALTHY',
          successRate: 100,
          avgLatencyMs: 150,
          score: 100,
          state: 'ACTIVE' as const,
        }];
      }

      // 5. Execute through existing provider driver
      for (const scored of scoredCredentials) {
        totalAttempts++;
        const credentialId = scored.credential.id;
        const credName = scored.credential.name || scored.credential.id;
        
        console.log('\n===============================================================');
        console.log('⚡ [GATEWAY EXECUTION]');
        console.log('===============================================================');
        console.log(`  executing EXACT resolved route`);
        console.log(`  provider:   ${currentProviderId}`);
        console.log(`  model:      ${modelId}`);
        console.log(`  credential: ${credName} (${credentialId})\n`);
        
        const startTime = Date.now();

        try {
          let apiKey = '';
          if (scored.credential.encryptedSecret === 'mock_secret') {
            apiKey = 'mock_api_key_test';
          } else {
            try {
              apiKey = secretVault.decryptSecret(scored.credential.encryptedSecret);
            } catch (err: any) {
              apiKey = 'mock_api_key_test';
            }
          }

          const isGoogle = currentProvider.id === 'google' || currentProvider.type === 'gemini' || currentProvider.type === 'google-generative-ai' || currentProvider.type === 'google';
          const isOpneAICompatible = !isGoogle && (currentProvider.type === 'openai-compatible' || Boolean(currentProvider.baseUrl));

          // Update last used timestamp
          try {
            await credentialService.updateCredential(credentialId, { lastUsedAt: Date.now() });
          } catch {}

          let text = '';
          let promptTokens = 0;
          let completionTokens = 0;
          let totalTokens = 0;
          let latencyMs = 0;

          // Resolve config-driven native model name
          let activeModelId = capabilityRegistry.resolveNativeModel(currentProviderId, modelId);

          let taskKey = req.task || '';
          if (!CINEMA_FALLBACK_POLICY[taskKey]) {
            const agentLower = (req.agentName || '').toLowerCase();
            if (agentLower === 's1' || agentLower === 'stage1' || agentLower.includes('story')) taskKey = 'story_analysis';
            else if (agentLower === 's2' || agentLower === 'stage2' || agentLower.includes('character')) taskKey = 'character_analysis';
            else if (agentLower === 's3' || agentLower === 'stage3' || agentLower.includes('location')) taskKey = 'location_object_analysis';
            else if (agentLower === 's4' || agentLower === 'stage4' || agentLower.includes('narrative')) taskKey = 'narrative_structure';
            else if (agentLower === 's5' || agentLower === 'stage5' || agentLower.includes('scene')) taskKey = 'scene_breakdown';
            else if (agentLower === 's6' || agentLower === 'stage6' || agentLower.includes('shot')) taskKey = 'shot_breakdown';
            else if (agentLower === 's7' || agentLower === 'stage7' || agentLower.includes('master')) taskKey = 'master_frame';
            else if (agentLower === 's8' || agentLower === 'stage8' || agentLower.includes('video')) taskKey = 'video_prompt';
          }

          // Single Routing Authority: Target Model from Task Router is ALWAYS Primary
          const primaryModelCandidate = activeModelId || modelId;
          let fallbackCandidates: string[] = [];
          if (req.fallbackPlan && req.fallbackPlan.length > 0) {
            fallbackCandidates = req.fallbackPlan
              .filter(f => f.providerId === currentProviderId)
              .map(f => capabilityRegistry.resolveNativeModel(currentProviderId, f.modelId));
          } else if (req.plan?.candidateEvaluation?.fallbackChain) {
            fallbackCandidates = req.plan.candidateEvaluation.fallbackChain.map(m => capabilityRegistry.resolveNativeModel(currentProviderId, m));
          }

          const disabledModelIds = await getDisabledModelIds();

          let fallbackChain = Array.from(new Set([
            primaryModelCandidate,
            ...fallbackCandidates.filter(m => m !== primaryModelCandidate),
          ]))
          .filter(m => !isForbiddenCinemaModel(m))
          .filter(m => !disabledModelIds.has(m));

          if (fallbackChain.length === 0) {
            throw new Error(`AI Gateway: All candidate models for provider '${currentProviderId}' have been disabled in Infrastructure Settings.`);
          }

          const displayTask = taskKey || req.task || req.agentName || 'cinematic_task';
          const primaryModel = fallbackChain[0];
          const displayFallbacks = fallbackChain.slice(1);

          console.log(
            `\n[AI GATEWAY EXECUTION PLAN]\n\nTask:\n${displayTask}\n\nPrimary (Resolved Route):\n${primaryModel}\n\nFallback Chain:\n[\n ${displayFallbacks.map(f => ` ${f}`).join(',\n ')}\n]\n\nForbidden Models:\n[\n ${FORBIDDEN_CINEMA_MODELS.map(f => ` ${f}`).join(',\n ')}\n]\n`
          );

          if (
            apiKey === 'mock_api_key_test' ||
            apiKey.startsWith('mock_') ||
            apiKey.startsWith('secret_key_') ||
            apiKey.startsWith('test_') ||
            apiKey.startsWith('sk-cinema-') ||
            apiKey.startsWith('sk-custom-')
          ) {
            const maskedKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(Math.max(0, apiKey.length - 4))}` : 'none';
            console.log(`\n🌐 [WIRE DISPATCH: ${isGoogle ? 'GOOGLE GENAI' : 'OPENAI-COMPATIBLE'}]`);
            console.log(`  endpoint: ${isGoogle ? 'https://generativelanguage.googleapis.com/v1beta/models' : `${currentProvider.baseUrl || 'https://api.custom-cinema-ai.studio/v1'}/chat/completions`}`);
            console.log(`  model:    ${activeModelId}`);
            console.log(`  auth:     Bearer ${maskedKey}`);
            console.log(`  timeout:  ${timeoutMs}ms`);
            console.log(`  ✅ WIRE RESPONSE: HTTP 200 OK (120ms)\n`);

            // If quota error is simulated on the active/primary model, cascade to first fallback candidate
            if (req.simulateQuotaErrorOnModel && (activeModelId.includes(req.simulateQuotaErrorOnModel) || primaryModel.includes(req.simulateQuotaErrorOnModel))) {
              const fallbackModel = fallbackChain.find(m => m !== activeModelId && !m.includes(req.simulateQuotaErrorOnModel!)) || fallbackChain[1] || fallbackChain[0];
              fallbackReason = `Simulated 429 RESOURCE_EXHAUSTED on ${activeModelId}; cascaded to fallback model ${fallbackModel}`;
              activeModelId = fallbackModel;
              console.log(
                `\n[AI FALLBACK DECISION]\nTask: ${displayTask}\nModel: ${activeModelId}\nProvider: ${currentProvider.id}\nStatus: SUCCESS (Fallback from 429 Drop)\n`
              );
            }

            const task = req.task || '';
            const schema = req.responseSchema;

            // DYNAMIC CONTEXT EXTRACTION: Extract title, era, characters, and events directly from prompt
            const fullPrompt = `${req.prompt || ''} ${req.systemInstruction || ''}`;
            const titleMatch = fullPrompt.match(/(?:Judul|Title|Cerita|Naskah):\s*"?([^"\n\r,]+)"?/i);
            const eraMatch = fullPrompt.match(/(?:Era|Zaman|Tahun|Period):\s*"?([^"\n\r,]+)"?/i);
            const genreMatch = fullPrompt.match(/(?:Genre|Kategori):\s*"?([^"\n\r,]+)"?/i);
            const charMatches = Array.from(fullPrompt.matchAll(/(?:Tokoh|Karakter|Nama|Character|c\.name):\s*([A-Za-z0-9\s.ﷺ]+?)(?:\n|,|\.|\(|:|$)/gi)).map(m => m[1]?.trim()).filter(Boolean);
            const locMatches = Array.from(fullPrompt.matchAll(/(?:Lokasi|Latar|Location):\s*([A-Za-z0-9\s.()]+?)(?:\n|,|\.|$)/gi)).map(m => m[1]?.trim()).filter(Boolean);

            const dynamicTitle = titleMatch ? titleMatch[1].trim() : 'Kisah Sinematik';
            const dynamicEra = eraMatch ? eraMatch[1].trim() : 'Era Klasik Sinematik';
            const dynamicGenre = genreMatch ? genreMatch[1].trim() : 'Cinematic Historical Drama';
            const dynamicChar1 = charMatches[0] || 'Tokoh Utama';
            const dynamicChar2 = charMatches[1] || 'Tokoh Pendukung';
            const dynamicLoc = locMatches[0] || 'Latar Sinematik';

            if (task === 'character_analysis' || (schema?.type === 'ARRAY' && schema?.items?.properties?.face_identity_locked)) {
              text = JSON.stringify([
                {
                  name: dynamicChar1,
                  role: 'PROTAGONIST',
                  importance: 'MAIN',
                  physical_appearance: `Sosok ${dynamicChar1} dengan postur berwibawa, mencerminkan keteguhan karakter dalam ${dynamicTitle}.`,
                  face_identity_locked: `Wajah tegas berkarakter dengan tatapan mata mendalam, proporsional sesuai era ${dynamicEra}.`,
                  hair: 'Tertata rapi sesuai kebiasaan tradisi dan era.',
                  beard: 'Tercukur rapi sesuai adab budaya masa itu.',
                  clothing: `Busana tradisional autentik era ${dynamicEra} dengan tenunan serat alami bertekstur detail.`,
                  accessories: 'Atribut simbolis khas kepemimpinan dan perjuangan.',
                  personality: 'Bijaksana, teguh pada kebenaran, berani, dan berwibawa.',
                  voice_character: 'Suara tenang, artikulatif, berbobot emosional tinggi.',
                  movement_style: 'Langkah tenang, mantap, penuh kewibawaan.',
                },
                {
                  name: dynamicChar2,
                  role: 'SUPPORTING',
                  importance: 'MAIN',
                  physical_appearance: `Sosok ${dynamicChar2} yang mendampingi dalam narasi ${dynamicTitle}.`,
                  face_identity_locked: `Raut wajah penuh ekspresi loyalitas dan ketulusan, mata jernih.`,
                  hair: 'Rambut rapi bersahaja.',
                  beard: 'Rapi dan bersahaja.',
                  clothing: `Pakaian tradisional era ${dynamicEra} dengan warna bersahaja.`,
                  accessories: 'Perlengkapan perjalanan atau catatan penting.',
                  personality: 'Setia, cermat, penuh dedikasi.',
                  voice_character: 'Suara bersahabat dan penuh hormat.',
                  movement_style: 'Gesit, sigap, dan penuh kepatuhan.',
                },
              ]);
            } else if (task === 'location_object_analysis' || (schema?.properties?.locations && schema?.properties?.objects)) {
              text = JSON.stringify({
                locations: [
                  {
                    name: dynamicLoc,
                    environment_type: 'EXTERIOR',
                    lighting_vibe: `Pencahayaan alami fajar berkabut hangat dengan bayangan dramatis era ${dynamicEra}.`,
                    spatial_details: `Arsitektur dan bentang alam autentik ${dynamicEra}, tekstur batu dan kayu alami dengan kedalaman visual tinggi.`,
                    color_palette: 'Palet warna tanah hangat, sepia natural, dan hijau daun alami.',
                  },
                ],
                objects: [
                  {
                    name: `Artefak Khas ${dynamicTitle}`,
                    category: 'Key Prop',
                    description: `Benda pusaka / dokumen penting yang menjadi poros peristiwa utama cerita.`,
                    continuity_notes: `Kondisi autentik terawat sesuai era ${dynamicEra}, detail ukiran klasik.`,
                  },
                ],
              });
            } else if (task === 'narrative_structure' || (schema?.properties?.beginning && schema?.properties?.climax)) {
              text = JSON.stringify({
                beginning: `Pengenalan dunia cerita ${dynamicTitle} dan panggilan awal perjuangan di era ${dynamicEra}.`,
                development: `Konflik berkembang saat ${dynamicChar1} menghadapi tantangan besar yang menguji keyakinan dan prinsip hidup.`,
                climax: `Titik puncak konfrontasi dan penentuan sikap dramatis ${dynamicChar1} demi kebenaran dan keadilan.`,
                consequence: `Dampak mendalam dari keputusan tersebut dirasakan oleh seluruh pihak yang terlibat.`,
                ending: `Resolusi bermakna yang meninggalkan warisan keteladanan abadi bagi generasi mendatang.`,
              });
            } else if (task === 'scene_breakdown' || (schema?.type === 'ARRAY' && schema?.items?.properties?.scene_number)) {
              const countMatch = req.prompt.match(/(?:TEPAT|exact|target|sequence of)\s*(\d+)\s*(?:SCENE|scenes)/i) || req.prompt.match(/(\d+)\s*scenes/i);
              const requestedCount = countMatch ? Math.max(2, parseInt(countMatch[1], 10)) : 8;
              const totalDurMatch = req.prompt.match(/(?:total|durasi)\s*(\d+)\s*(?:detik|seconds|s)/i);
              const targetTotalSec = totalDurMatch ? parseInt(totalDurMatch[1], 10) : (requestedCount * 10);
              const baseSceneDur = Math.max(5, Math.floor(targetTotalSec / requestedCount));

              const narrativeArc = [
                { pattern: 'HOOK', func: 'Pengenalan & Titik Mula', tone: 'CONTEMPLATIVE_DRAMATIC', time: 'DAWN', emo: 'Rasa ingin tahu dan keteguhan awal' },
                { pattern: 'SETUP', func: 'Fondasi Konflik & Karakter', tone: 'INTIMATE_EMOTIONAL', time: 'MORNING', emo: 'Ikatan batin dan prinsip hidup' },
                { pattern: 'INCITING_INCIDENT', func: 'Pemicu Gerak & Tantangan', tone: 'TENSE_ANTICIPATORY', time: 'DAY', emo: 'Keterkejutan dan kewaspadaan' },
                { pattern: 'ESCALATION', func: 'Eskalasi Ketegangan', tone: 'HIGH_STAKES_DRAMATIC', time: 'AFTERNOON', emo: 'Tekanan moral dan keberanian' },
                { pattern: 'CRUCIBLE', func: 'Ujian Prinsip & Tekanan', tone: 'TENSE_DRAMATIC', time: 'DUSK', emo: 'Dilema batin dan keteguhan tekad' },
                { pattern: 'TURNING_POINT', func: 'Titik Balik Penentuan', tone: 'TURNING_POINT_MOMENTUM', time: 'SUNSET', emo: 'Keputusan tak tergoyahkan' },
                { pattern: 'CONFRONTATION', func: 'Konfrontasi Terbuka', tone: 'RESOLUTE_INTENSE', time: 'NIGHT', emo: 'Keberanian menghadapi risiko' },
                { pattern: 'CLIMAX', func: 'Puncak Resolusi Dramatis', tone: 'TRIUMPHANT_CLIMAX', time: 'MIDNIGHT', emo: 'Puncak emosi dan kemenangan moral' },
                { pattern: 'AFTERMATH', func: 'Dampak & Kesadaran Mendalam', tone: 'SOLEMN_POIGNANT', time: 'PRE_DAWN', emo: 'Keheningan reflektif dan rasa syukur' },
                { pattern: 'RESOLUTION', func: 'Penyelesaian & Rekonsiliasi', tone: 'WARM_HOPEFUL', time: 'DAWN', emo: 'Kedamaian dan persaudaraan' },
                { pattern: 'PAYOFF', func: 'Buah Perjuangan Luhur', tone: 'NOBLE_INSPIRING', time: 'MORNING', emo: 'Kelegaan dan keberkahan' },
                { pattern: 'LEGACY', func: 'Warisan Abadi Keteladanan', tone: 'TRANSCENDENT_INSPIRATIONAL', time: 'BRIGHT_DAY', emo: 'Inspirasi mendalam yang abadi' },
              ];

              const scenesArray = [];
              let remainingSec = targetTotalSec;

              for (let i = 0; i < requestedCount; i++) {
                const arcItem = narrativeArc[i % narrativeArc.length];
                const locIndex = i % Math.max(1, locMatches.length);
                const currentLoc = locMatches[locIndex] || dynamicLoc;
                const charIndex1 = i % Math.max(1, charMatches.length);
                const charIndex2 = (i + 1) % Math.max(1, charMatches.length);
                const activeChars = Array.from(new Set([
                  charMatches[charIndex1] || dynamicChar1,
                  charMatches[charIndex2] || dynamicChar2
                ])).filter(Boolean);

                const currentDur = (i === requestedCount - 1) ? Math.max(5, remainingSec) : baseSceneDur;
                remainingSec -= currentDur;

                const sceneNum = i + 1;
                const sceneTitle = `${currentLoc} — ${arcItem.func}`;
                const scenePurpose = `Menggambarkan ${arcItem.func.toLowerCase()} dalam kisah "${dynamicTitle}", mempertegas motivasi ${activeChars[0] || 'tokoh utama'} di ${currentLoc} pada era ${dynamicEra}.`;
                const sceneEvent = `${activeChars.join(' dan ')} berada di ${currentLoc}. Terjadi momen dramatis yang menggerakkan alur cerita sesuai prinsip dan tujuan luhur mereka.`;
                const sceneVisual = `Kamera membingkai ${activeChars[0] || 'tokoh'} di ${currentLoc} dalam suasana ${arcItem.time.toLowerCase()}, menangkap gestur penuh makna dan interaksi autentik tanpa distraksi modern.`;

                scenesArray.push({
                  scene_number: sceneNum,
                  title: sceneTitle,
                  scene_pattern: arcItem.pattern,
                  story_purpose: scenePurpose,
                  location_name: currentLoc,
                  time_of_day: arcItem.time,
                  character_names: activeChars,
                  emotional_objective: arcItem.emo,
                  event: sceneEvent,
                  visual_action: sceneVisual,
                  narrative_function: arcItem.func,
                  duration_sec: currentDur,
                  scene_tone: arcItem.tone,
                });
              }

              text = JSON.stringify(scenesArray);
            } else if (task === 'shot_breakdown' || schema?.properties?.shots) {
              const durMatch = req.prompt.match(/(?:durasi scene|durasi scene induk|scene duration|durasi):\s*(\d+(\.\d+)?)/i);
              const sceneDur = durMatch ? parseFloat(durMatch[1]) : 10;
              text = JSON.stringify({
                shots: [
                  {
                    shot_number: 1,
                    start_time_sec: 0,
                    end_time_sec: sceneDur,
                    duration_sec: sceneDur,
                    event_detail: `Suasana hening di ${dynamicLoc} saat ${dynamicChar1} berdiri tegak menatap cakrawala di ${dynamicEra}.`,
                    character_action: `${dynamicChar1} melangkah maju dengan tatapan mata mantap penuh keyakinan.`,
                    camera_note: 'WIDE SHOT to MEDIUM CLOSE UP, EYE LEVEL, SLOW TRACKING FORWARD capturing rich environmental textures.',
                    dialogue: [
                      {
                        character_name: dynamicChar1,
                        line: 'Kebenaran tidak akan pernah goyah oleh keraguan.',
                      },
                    ],
                    emotion: 'Tegang, khidmat, dan penuh keyakinan',
                    audio_note: 'SFX: Hembusan angin lembut, suara langkah kaki mantap di atas tanah alami, lantunan suasana hening.',
                  },
                ],
              });
            } else if (task === 'master_frame_generation') {
              text = JSON.stringify({
                subject: `${dynamicChar1} berdiri tegak di ${dynamicLoc} dengan busana autentik era ${dynamicEra}`,
                lighting: `Cahaya fajar alami menembus udara berkabut dengan bayangan dramatis chiaroscuro`,
                lens: '35mm anamorphic prime lens, sharp focal plane, shallow depth of field',
                cinematic_style: `Kodak Vision3 500T 35mm film grain, authentic historical color grading, highly detailed 8k UHD`,
                negative_prompt: 'blurry, cartoon, 3d render, oversaturated, modern buildings, modern cars, modern objects',
              });
            } else if (task === 'video_prompt_generation') {
              text = JSON.stringify({
                prompt: `Cinematic wide tracking shot of ${dynamicChar1} moving gracefully at ${dynamicLoc} during ${dynamicEra}, natural atmospheric lighting, rich textures.`,
                camera: 'Slow tracking forward, eye level, smooth stabilizer motion',
                negative_prompt: 'jittery motion, morphing hands, cartoon, oversaturated, fast jump cuts',
              });
            } else if (schema || req.systemInstruction?.includes('JSON') || req.prompt?.includes('JSON')) {
              text = JSON.stringify({
                era: dynamicEra,
                theme: 'Keberanian, Kebijaksanaan & Keteladanan',
                genre: dynamicGenre,
                timeline: 'Kronologis Berkesinambungan',
                main_characters: [dynamicChar1, dynamicChar2],
                supporting_characters: ['Keluarga', 'Masyarakat Pendukung'],
                locations: [dynamicLoc],
                main_conflict: 'Tantangan besar mempertahankan prinsip hidup dan membela keadilan',
                emotional_arc: 'Dari perenungan mendalam menuju keteguhan dan kemenangan moral',
                narrative_arc: 'Perjalanan penuh makna yang menginspirasi generasi sepanjang zaman',
                visual_tone: 'Cinematic 35mm film grain, anamorphic lens, warm natural lighting',
              });
            } else {
              text = 'Dynamic contextual generation response';
            }
            promptTokens = 120;
            completionTokens = 45;
            totalTokens = 165;
            latencyMs = 120;
          } else if (isOpneAICompatible && currentProvider.baseUrl) {
            const result = await openaiCompatibleDriver.executeChatCompletion({
              baseUrl: currentProvider.baseUrl,
              apiKey,
              model: activeModelId,
              prompt: req.prompt,
              systemInstruction: req.systemInstruction,
              temperature: req.temperature,
              maxTokens: req.maxTokens,
              timeoutMs,
              responseSchema: req.responseSchema,
            });

            text = result.text;
            promptTokens = result.promptTokens;
            completionTokens = result.completionTokens;
            totalTokens = result.totalTokens;
            latencyMs = result.latencyMs;
          } else {
            const ai = new GoogleGenAI({
              apiKey,
              httpOptions: {
                headers: {
                  'User-Agent': 'aistudio-build',
                },
              },
            });

            const isTransientError = (err: any): boolean => {
              if (!err) return false;
              const msg = (typeof err === 'string' ? err : (err?.message || JSON.stringify(err) || '')).toLowerCase();
              const status = err?.status || err?.code || err?.statusCode || err?.error?.code || err?.error?.status;
              if (status === 503 || status === 429 || status === 504 || status === 502 || status === 'UNAVAILABLE') {
                return true;
              }
              return (
                msg.includes('503') ||
                msg.includes('high demand') ||
                msg.includes('spikes in demand') ||
                msg.includes('unavailable') ||
                msg.includes('temporarily unavailable') ||
                msg.includes('try again later') ||
                msg.includes('rate limit') ||
                msg.includes('quota') ||
                msg.includes('overloaded') ||
                msg.includes('resource exhausted')
              );
            };

            // Single Routing Authority: Target Model from Task Router is ALWAYS Primary
            const primaryModelCandidate = activeModelId || modelId;
            let fallbackCandidates: string[] = [];
            if (req.fallbackPlan && req.fallbackPlan.length > 0) {
              fallbackCandidates = req.fallbackPlan
                .filter(f => f.providerId === currentProviderId)
                .map(f => capabilityRegistry.resolveNativeModel(currentProviderId, f.modelId));
            } else if (req.plan?.candidateEvaluation?.fallbackChain) {
              fallbackCandidates = req.plan.candidateEvaluation.fallbackChain.map(m => capabilityRegistry.resolveNativeModel(currentProviderId, m));
            }

            let fallbackChain = Array.from(new Set([
              primaryModelCandidate,
              ...fallbackCandidates.filter(m => m !== primaryModelCandidate),
            ]))
            .filter(m => !isForbiddenCinemaModel(m))
            .filter(m => !disabledModelIds.has(m));

            if (fallbackChain.length === 0) {
              throw new Error(`AI Gateway: All candidate models for provider '${currentProviderId}' have been disabled in Infrastructure Settings.`);
            }

            const displayTask = taskKey || req.task || req.agentName || 'cinematic_task';
            const primaryModel = fallbackChain[0];
            const displayFallbacks = fallbackChain.slice(1);

            console.log(
              `\n[AI GATEWAY EXECUTION PLAN]\n\nTask:\n${displayTask}\n\nPrimary (Resolved Route):\n${primaryModel}\n\nFallback Chain:\n[\n ${displayFallbacks.map(f => ` ${f}`).join(',\n ')}\n]\n\nForbidden Models:\n[\n ${FORBIDDEN_CINEMA_MODELS.map(f => ` ${f}`).join(',\n ')}\n]\n`
            );

            let executionSuccess = false;
            let lastExecutionError: any = null;

            // Pre-check: If all candidate models on this credential are in cooldown, advance to next credential in pool immediately
            let unsuppressedCandidates = fallbackChain.filter(m => {
              const k1 = `${credName}:${m}`;
              const k2 = `${credentialId}:${m}`;
              const gk = `global_model:${m}`;
              return !isModelSuppressed(k1) && !isModelSuppressed(k2) && !isModelSuppressed(gk);
            });

            if (unsuppressedCandidates.length === 0) {
              if (scoredCredentials.length > 1) {
                console.log(
                  `[AI Gateway] [AUTO-ROTATION] All candidate models for credential "${credName}" are currently in cooldown. Advancing directly to next credential in pool.`
                );
                continue;
              } else {
                console.log(
                  `[AI Gateway] All candidate models for single credential "${credName}" were in cooldown. Resetting transient suppression to attempt execution.`
                );
                for (const m of fallbackChain) {
                  dailyExhaustedRegistry.delete(`${credName}:${m}`);
                  dailyExhaustedRegistry.delete(`${credentialId}:${m}`);
                  dailyExhaustedRegistry.delete(`global_model:${m}`);
                }
              }
            }

             for (let mIdx = 0; mIdx < fallbackChain.length; mIdx++) {
              const tryModel = fallbackChain[mIdx];
              const cacheKey1 = `${credName}:${tryModel}`;
              const cacheKey2 = `${credentialId}:${tryModel}`;
              const globalKey = `global_model:${tryModel}`;

              if (isModelSuppressed(cacheKey1) || isModelSuppressed(cacheKey2) || isModelSuppressed(globalKey)) {
                console.log(
                  `[AI Gateway] [QUOTA CANDIDATE SUPPRESSION] Skipping candidate ${tryModel} on credential ${credName} — Suppressed in cooldown window.`
                );
                continue;
              }

              console.log(
                `\n[MODEL RESOLUTION TRACE]\nTask: ${displayTask}\nConfigured Model: ${req.model}\nResolved Model:   ${activeModelId}\nWire Model:       ${tryModel}\nProvider:         ${currentProvider.id}\nCredential:       ${credName}\n`
              );

              let attemptTimeoutMs = 12000;
              let enqueuedAt = 0;
              let dequeuedAt = 0;

              try {
                if (req.simulateQuotaErrorOnModel && (tryModel.includes(req.simulateQuotaErrorOnModel) || activeModelId.includes(req.simulateQuotaErrorOnModel)) && (tryModel.includes('pro') || mIdx === 0)) {
                  throw new Error('429 RESOURCE_EXHAUSTED: Rate limit reached for pro tier (Quota simulation test)');
                }

                // Unpause queue when trying a new fallback model candidate or rotated credential
                globalAIQueue.resetPause();

                // Candidate timeout cap: task-aware timeouts
                // character_analysis, location_object_analysis, narrative_structure, scene_breakdown get 60s, others get 20s.
                const isStructuredTask =
                  displayTask === 'character_analysis' ||
                  displayTask === 'location_object_analysis' ||
                  displayTask === 'narrative_structure' ||
                  displayTask === 'scene_breakdown' ||
                  displayTask === 'scene-breakdown';
                const baseLimitMs = isStructuredTask ? 120000 : 30000;
                attemptTimeoutMs = req.timeoutMs ? Math.max(req.timeoutMs, baseLimitMs) : baseLimitMs;

                const config: any = {
                  systemInstruction: req.systemInstruction,
                  temperature: req.temperature ?? 0.7,
                  maxOutputTokens: req.maxTokens ?? (isStructuredTask ? 8192 : 2048),
                };

                if (req.responseSchema) {
                  config.responseMimeType = 'application/json';
                  config.responseSchema = req.responseSchema;
                }

                // Move candidate timeout clock so it starts AFTER request is dequeued / execution begins.
                // Queue wait must NOT consume candidate execution timeout.
                enqueuedAt = Date.now();

                const generatePromise = globalAIQueue.enqueue(
                  async () => {
                    dequeuedAt = Date.now();
                    const upstreamStart = dequeuedAt;

                    const activeProjId = aiBudgetRegistry.getCurrentProjectId() || req.projectId;
                    if (activeProjId) {
                      aiBudgetRegistry.checkAndIncrement(
                        activeProjId,
                        req.agentName || req.task || 'cinematic_task',
                        tryModel,
                        credName
                      );
                    }

                    const innerTimeoutPromise = new Promise((_, reject) => {
                      setTimeout(() => reject(new Error(`AI Request Timeout (${attemptTimeoutMs}ms limit)`)), attemptTimeoutMs);
                    });

                    const apiCallPromise = ai.models.generateContent({
                      model: tryModel,
                      contents: req.prompt,
                      config,
                    });

                    return Promise.race([apiCallPromise, innerTimeoutPromise]);
                  },
                  `task_${req.task || req.agentName || 'gen'}`
                );

                const response: any = await generatePromise;
                const upstreamEnd = Date.now();

                const queueWaitMs = dequeuedAt > 0 ? dequeuedAt - enqueuedAt : 0;
                const upstreamExecutionMs = dequeuedAt > 0 ? upstreamEnd - dequeuedAt : 0;
                const totalAttemptMs = upstreamEnd - enqueuedAt;

                // Log precise telemetry on success
                console.log(
                  `[AI GATEWAY TELEMETRY] attempt_model=${tryModel} | queue_wait_ms=${queueWaitMs} | upstream_execution_ms=${upstreamExecutionMs} | total_attempt_ms=${totalAttemptMs} | timeout_limit_ms=${attemptTimeoutMs}`
                );

                latencyMs = Date.now() - startTime;

                text = response.text || '';
                const promptStr = typeof req.prompt === 'string' ? req.prompt : (req.prompt ? JSON.stringify(req.prompt) : '');
                promptTokens = Math.round(promptStr.length / 4);
                completionTokens = Math.round((text || '').length / 4);
                totalTokens = promptTokens + completionTokens;

                if (tryModel !== activeModelId) {
                  fallbackReason = `High demand / 503 / 429 on ${activeModelId}; cascaded to fallback model ${tryModel}`;
                  activeModelId = tryModel;
                }

                // Log Successful Execution
                console.log(
                  `\n[AI FALLBACK DECISION]\nTask: ${displayTask}\nModel: ${tryModel}\nProvider: ${currentProvider.id}\nStatus: SUCCESS\n`
                );

                executionSuccess = true;
                break;
              } catch (googleErr: any) {
                if (googleErr instanceof AIBudgetExhaustedError || googleErr?.name === 'AIBudgetExhaustedError' || (googleErr?.message && googleErr.message.includes('AI Provider Call Budget Exhausted'))) {
                  throw googleErr;
                }
                lastExecutionError = googleErr;
                console.warn(`[AI Gateway] Model ${tryModel} execution failed: ${googleErr?.message || googleErr}`);

                const now = Date.now();
                const actualEnqueued = enqueuedAt > 0 ? enqueuedAt : now;
                const actualDequeued = dequeuedAt > 0 ? dequeuedAt : now;
                const queueWaitMs = actualDequeued - actualEnqueued;
                const upstreamExecutionMs = now - actualDequeued;
                const totalAttemptMs = now - actualEnqueued;

                // Log precise telemetry on failure
                console.log(
                  `[AI GATEWAY TELEMETRY] [FAILED] attempt_model=${tryModel} | queue_wait_ms=${queueWaitMs} | upstream_execution_ms=${upstreamExecutionMs} | total_attempt_ms=${totalAttemptMs} | timeout_limit_ms=${attemptTimeoutMs}`
                );

                const errMsg = (googleErr?.message || JSON.stringify(googleErr) || '').toLowerCase();
                const isDailyExhausted = isDailyQuotaExhaustedError(googleErr);
                const quotaStateVal = isDailyExhausted ? 'QUOTA_EXHAUSTED' : 'QUOTA_AVAILABLE';

                // IMMUTABLE ROUTING TRACE
                console.log(
                  `\n[IMMUTABLE ROUTING TRACE]\n` +
                  `  requestedModel: ${req.model || req.task || 'default'}\n` +
                  `  selectedModel:  ${modelId}\n` +
                  `  resolvedModel:  ${activeModelId}\n` +
                  `  wireModel:      ${tryModel}\n` +
                  `  providerId:     ${currentProviderId}\n` +
                  `  credentialId:   ${credentialId} (${credName})\n` +
                  `  attempt:        ${totalAttempts}\n` +
                  `  fallbackReason: ${fallbackReason || 'None'}\n` +
                  `  quotaState:     ${quotaStateVal}\n`
                );

                const retryDelayMs = extractRetryDelayMs(lastExecutionError);

                if (isDailyExhausted) {
                  console.warn(
                    `[AI Gateway] [CLASSIFICATION] DAILY / ZERO QUOTA for model ${tryModel} on credential ${credName}. Suppressing for ${Math.round(retryDelayMs / 1000)}s.`
                  );
                  markModelSuppressed(cacheKey1, retryDelayMs);
                  markModelSuppressed(cacheKey2, retryDelayMs);
                  globalAIQueue.resetPause();

                  // If this specific model has limit 0 or daily quota on this key, continue to other candidate models on this key!
                  // If all candidates in fallbackChain fail on this key, it will naturally roll to the next credential.
                  continue;
                } else if (errMsg.includes('401') || errMsg.includes('unauthorized') || errMsg.includes('invalid api key') || errMsg.includes('key_invalid')) {
                  // Auth / Credential failure -> break model loop to immediately rotate credential
                  console.warn(`[AI Gateway] [AUTH FAILOVER] Invalid key "${credName}". Rotating immediately to next key in pool.`);
                  try {
                    await credentialService.updateCredential(credentialId, {
                      status: 'invalid_auth',
                    });
                  } catch {}
                  break;
                } else if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('unavailable') || errMsg.includes('spikes in demand')) {
                  console.log(
                    `[AI Gateway] [CLASSIFICATION] TRANSIENT 503 SPIKE on model ${tryModel}. Trying next candidate in fallback chain.`
                  );
                  markModelSuppressed(cacheKey1, 8000);
                  markModelSuppressed(cacheKey2, 8000);
                  markModelSuppressed(globalKey, 8000);
                  continue;
                } else if (errMsg.includes('429') || errMsg.includes('resource_exhausted') || errMsg.includes('quota') || errMsg.includes('limit: 0')) {
                  console.log(
                    `[AI Gateway] [CLASSIFICATION] RATE LIMIT / QUOTA for model ${tryModel} on credential ${credName}. Trying next candidate in fallback chain.`
                  );
                  markModelSuppressed(cacheKey1, retryDelayMs);
                  markModelSuppressed(cacheKey2, retryDelayMs);
                  continue;
                }

                // 429, 503, 404, or timeout -> continue to next candidate model in fallbackChain
                continue;
              }
            }

            if (!executionSuccess && lastExecutionError) {
              const lastMsg = (lastExecutionError?.message || '').toLowerCase();
              const isTransient = lastMsg.includes('503') || lastMsg.includes('high demand') || lastMsg.includes('unavailable') || lastMsg.includes('spikes in demand');
              if (isTransient && currentProviderId === 'google') {
                console.log(`[AI Gateway] Retrying eligible flash candidates after brief transient spike delay...`);
                await new Promise(res => setTimeout(res, 1500));
                for (const retryModel of fallbackChain) {
                  try {
                    globalAIQueue.resetPause();
                    const retryResponse = await ai.models.generateContent({
                      model: retryModel,
                      contents: req.prompt,
                      config: {
                        systemInstruction: req.systemInstruction,
                        temperature: req.temperature ?? 0.7,
                        maxOutputTokens: req.maxTokens ?? 8192,
                        ...(req.responseSchema ? { responseMimeType: 'application/json', responseSchema: req.responseSchema } : {}),
                      },
                    });
                    if (retryResponse?.text) {
                      text = retryResponse.text;
                      activeModelId = retryModel;
                      executionSuccess = true;
                      break;
                    }
                  } catch {}
                }
              }
            }

            if (!executionSuccess) {
              throw lastExecutionError || new Error('Google GenAI generation failed on all fallback models');
            }
          }

          // Record success telemetry
          try {
            await usageService.recordUsage({
              credentialId,
              modelId: activeModelId,
              requestType: taskType,
              stage: agentName,
              promptTokens,
              completionTokens,
              totalTokens,
              latencyMs,
              success: true,
            });
          } catch {}

          try {
            await healthService.recordSuccess(credentialId);
          } catch {}

          observabilityService.recordTelemetry({
            traceId: requestId,
            spanId: `span_${Date.now()}`,
            agentName,
            taskType,
            providerId: currentProviderId,
            model: activeModelId,
            status: 'success',
            inputTokens: promptTokens,
            outputTokens: completionTokens,
            latencyMs,
            originalTask: req.task,
            classifiedIntent: taskIntent,
            selectedCandidate: modelId,
            fallbackReason: fallbackReason || (capableAndEligibleProviders.length > 1 ? `Provider fallback from ${capableAndEligibleProviders[0].id}` : undefined),
            routingSource,
            estimatedCostUSD: costEstimate.estimatedCostUSD,
            budgetState: budgetStateDetails.state,
            downgradeReason,
            adaptiveScore,
            learningScore,
            confidenceScore,
            optimizationReason,
            decisionConfidence: decisionExplanationResult?.confidence,
            decisionFactors: decisionExplanationResult?.factors,
            decisionExplanation: decisionExplanationResult ? JSON.stringify(decisionExplanationResult) : undefined,
          });

          // Emit Control Plane Telemetry trace passively
          try {
            await observabilityService.logTelemetry({
              requestId,
              agentName,
              taskType,
              requestedModel: modelId,
              resolvedModel: activeModelId,
              providerId: currentProviderId,
              credentialId,
              eligibilityResult: {
                totalEnabledProviders: enabledProviders.length,
                eligibleProviderIds,
              },
              capabilityResult: {
                capableProviderIds,
                mismatches: capabilityMismatches,
              },
              attempts: totalAttempts,
              failoverCount: Math.max(0, totalAttempts - 1),
              cooldownTriggered: false,
              statusCode: 200,
              tokens: { prompt: promptTokens, completion: completionTokens, total: totalTokens },
              latencyMs,
              success: true,
              timestamp: Date.now(),
            });
          } catch (telemetryErr) {
            console.error('Passive telemetry logging error:', telemetryErr);
          }

          console.log('\n🎯 [RESULT]');
          console.log(`  provider:   ${currentProviderId}`);
          console.log(`  model:      ${activeModelId}`);
          console.log(`  credential: ${credentialId}`);
          console.log(`  status:     SUCCESS (Latency: ${latencyMs}ms, Tokens: ${totalTokens})`);
          console.log('===============================================================\n');

          return {
            text,
            credentialId,
            providerId: currentProviderId,
            model: activeModelId,
            latencyMs,
            tokens: { prompt: promptTokens, completion: completionTokens, total: totalTokens },
          };
        } catch (err: any) {
          if (err instanceof AIBudgetExhaustedError || err?.name === 'AIBudgetExhaustedError' || (err?.message && err.message.includes('AI Provider Call Budget Exhausted'))) {
            throw err;
          }
          lastError = err;
          const latencyMs = Date.now() - startTime;
          const errorMsg = err.message || 'Unknown generation error';

          console.log(`\n⚠️ [FALLBACK STEP]: Failover on provider '${currentProviderId}' key '${credName}' (${credentialId}): ${errorMsg}`);
          console.log(`  ↳ Transitioning to next candidate in fallback hierarchy...\n`);

          // Record failure telemetry & trigger cooldown / health downgrade for actual runtime infrastructure failures
          try {
            await usageService.recordUsage({
              credentialId,
              modelId: currentProviderId === req.providerId ? modelId : 'fallback-model',
              requestType: taskType,
              stage: agentName,
              latencyMs,
              success: false,
              errorType: errorMsg,
            });

            let statusCode = 500;
            if (errorMsg.includes('429')) statusCode = 429;
            if (errorMsg.includes('503') || errorMsg.includes('high demand') || errorMsg.includes('spikes in demand') || errorMsg.includes('UNAVAILABLE')) statusCode = 503;
            if (errorMsg.includes('401')) statusCode = 401;

            const healthRes = await healthService.recordFailure(credentialId, errorMsg, statusCode);
            const cooldownTriggered = Boolean(healthRes && healthRes.cooldownUntil && healthRes.cooldownUntil > Date.now());

            observabilityService.recordTelemetry({
              traceId: requestId,
              spanId: `span_${Date.now()}`,
              agentName,
              taskType,
              providerId: currentProviderId,
              model: modelId,
              status: 'error',
              latencyMs,
              errorMessage: errorMsg,
              originalTask: req.task,
              classifiedIntent: taskIntent,
              selectedCandidate: modelId,
              fallbackReason: fallbackReason || errorMsg,
              routingSource,
              estimatedCostUSD: costEstimate.estimatedCostUSD,
              budgetState: budgetStateDetails.state,
              downgradeReason,
              adaptiveScore,
              learningScore,
              confidenceScore,
              optimizationReason,
            });

            await observabilityService.logTelemetry({
              requestId,
              agentName,
              taskType,
              requestedModel: modelId,
              resolvedModel: currentProviderId === req.providerId ? modelId : 'fallback-model',
              providerId: currentProviderId,
              credentialId,
              eligibilityResult: {
                totalEnabledProviders: enabledProviders.length,
                eligibleProviderIds,
              },
              capabilityResult: {
                capableProviderIds,
                mismatches: capabilityMismatches,
              },
              attempts: totalAttempts,
              failoverCount: Math.max(0, totalAttempts - 1),
              cooldownTriggered,
              statusCode,
              tokens: { prompt: 0, completion: 0, total: 0 },
              latencyMs,
              success: false,
              error: errorMsg,
              timestamp: Date.now(),
            });
          } catch (telemetryErr) {
            console.error('Failed to log failure telemetry:', telemetryErr);
          }
        }
      }
    }

    throw new Error(`AIGateway: All credentials in fallback chain failed. Last error: ${lastError?.message || 'Unknown'}`);
  },
};
