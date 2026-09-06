import { AITaskDefinition, AITaskId, TaskExecutionPlan, TaskRouterRequest, AIModel } from '../../src/types';
export type { AITaskDefinition, AITaskId, TaskExecutionPlan, TaskRouterRequest, AIModel };
import { taskRegistry } from './task_registry';
import { db } from '../db';
import { capabilityRegistry } from './capability_registry';
import { quotaRouter } from './quota_router';
import { providerService } from './provider_service';
import { modelRegistryService } from './model_registry_service';
import { classifyTaskRequirements, rankCandidatesForIntent } from './intelligence_router';
import { healthService } from './health_service';
import { isForbiddenCinemaModel } from './ai_gateway';

export interface ScoredModelCandidate {
  model: AIModel;
  baseScore: number;
  score: number;
  reasons: string[];
  reputationScore: number;
  quotaScore: number;
  providerEligible: boolean;
}

export const taskRouter = {
  /**
   * Authoritative decision engine for selecting the optimal execution plan:
   * Task Definition -> Active DB Models -> AMM Capability Match -> Provider Health -> Credential Router -> Execution Plan
   */
  async resolveTaskExecutionPlan(request: TaskRouterRequest): Promise<TaskExecutionPlan> {
    const rawTaskIdentifier = request.taskId || request.stageCode || 'story_analysis';
    const task: AITaskDefinition = taskRegistry.getTask(rawTaskIdentifier) || taskRegistry.getTask('story_analysis')!;
    const projectPolicy = request.projectPolicy || { mode: 'auto', priority: 'quality' };

    // 1. Check for manual override / pinned model if policy explicitly pins a specific model
    if (projectPolicy.mode === 'pin' && projectPolicy.pinnedModelId && projectPolicy.pinnedModelId !== 'auto') {
      let pinnedModel = await db.getModel(projectPolicy.pinnedModelId, projectPolicy.pinnedProviderId);
      if (!pinnedModel) {
        pinnedModel = await db.getModel(projectPolicy.pinnedModelId);
      }
      if (pinnedModel && pinnedModel.enabled) {
        // Resolve best credential for this provider
        const credSelection = await quotaRouter.selectCredential(pinnedModel.providerId);
        const reasons = [
          `Pinned model override applied: '${pinnedModel.id}' on provider '${pinnedModel.providerId}'`,
          `Credential selected with priority score ${credSelection.score}`,
        ];

        this.logDecision({
          taskId: task.id,
          stageCode: task.stageCode,
          modelId: pinnedModel.id,
          providerId: pinnedModel.providerId,
          credentialId: credSelection.credentialId,
          score: 95,
          reasons,
        });

        return {
          taskId: task.id,
          stageCode: task.stageCode,
          providerId: pinnedModel.providerId,
          modelId: pinnedModel.id,
          credentialId: credSelection.credentialId,
          apiKey: credSelection.apiKey,
          score: 95,
          reasons,
          candidateEvaluation: {
            totalCandidates: 1,
            eligibleCandidates: 1,
            selectedModelTier: pinnedModel.tier || 'pro',
            contextWindow: pinnedModel.contextWindow || 128000,
          },
          decisionTimestamp: Date.now(),
        };
      }
    }

    // 2. Fetch all registered AI Models from Database (No hardcoded Gemini lists!)
    let allModels = await db.getModels();
    let enabledModels = allModels.filter(m => m.enabled !== false);

    // If database has no active models or lacks eligible models satisfying the task's required capabilities and context window,
    // invoke production registry initialization to prime baseline definitions.
    const hasEligibleCandidate = enabledModels.some(m => {
      const caps = m.capabilities || [];
      const hasCaps = task.requiredCapabilities.every(req => caps.includes(req));
      const hasCtx = !task.minContextWindow || (m.contextWindow || 0) >= task.minContextWindow;
      return hasCaps && hasCtx;
    });

    if (enabledModels.length === 0 || !hasEligibleCandidate) {
      try {
        await providerService.initializeDefaults();
        await modelRegistryService.initializeDefaults();
        allModels = await db.getModels();
        enabledModels = allModels.filter(m => m.enabled !== false);
      } catch (seedErr: any) {
        console.warn('[TaskRouter] Baseline registry seed warning:', seedErr?.message || seedErr);
      }
    }

    if (enabledModels.length === 0) {
      throw new Error(`TaskRouter: No active AI models found in database registry.`);
    }

    // 3. Evaluate each model against task requirements, AMM compatibility, provider health & credential status
    const candidates: ScoredModelCandidate[] = [];

    const isCinematicTask = [
      'story_analysis',
      'character_analysis',
      'character_detection',
      'location_object_analysis',
      'location_detection',
      'narrative_structure',
      'scene_breakdown',
      'shot_breakdown',
      'master_frame_generation',
      'master_frame',
      'video_prompt_generation',
      'video_prompt',
    ].includes(task.id) || ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'].includes(task.stageCode || '');

    // Per-resolution memoization caches to prevent redundant O(N) database calls across models sharing the same provider
    const providerStateCache = new Map<string, any>();
    const providerDbCache = new Map<string, any>();
    const providerScoredCredsCache = new Map<string, any[]>();

    for (const model of enabledModels) {
      // (a) Exclude test providers from production routing unless explicitly pinned by test harness
      const isTestProvider = model.providerId.startsWith('prov_pin_test_') ||
        model.providerId.startsWith('prov_test_') ||
        model.providerId.includes('_test_') ||
        model.providerId.includes('mock_');
      if (isTestProvider && projectPolicy?.pinnedProviderId !== model.providerId) {
        continue;
      }

      // (b) Provider-level health check, status & eligibility (memoized per provider)
      let providerState = providerStateCache.get(model.providerId);
      if (!providerState) {
        providerState = await quotaRouter.getProviderOperationalState(model.providerId);
        providerStateCache.set(model.providerId, providerState);
      }
      if (!providerState.eligibility) {
        // Skip models whose provider is down / circuit open / quota exhausted
        continue;
      }

      let provider = providerDbCache.get(model.providerId);
      if (provider === undefined) {
        provider = await db.getProvider(model.providerId);
        providerDbCache.set(model.providerId, provider);
      }
      if (!provider || provider.enabled === false) {
        continue;
      }
      if ((provider as any).status && (provider as any).status !== 'active') {
        continue;
      }

      // (c) Verify active credentials exist and are scored for this provider (memoized per provider)
      // Predicate must match execution preflight: a WARNING-state credential is still usable.
      let availableCreds = providerScoredCredsCache.get(model.providerId);
      if (!availableCreds) {
        availableCreds = await quotaRouter.scoreCredentials(model.providerId);
        providerScoredCredsCache.set(model.providerId, availableCreds);
      }
      const activeCreds = availableCreds.filter(
        c => c.credential.status === 'active' && (c.state === 'ACTIVE' || c.state === 'WARNING')
      );
      if (activeCreds.length === 0) {
        // Provider has no active healthy keys
        continue;
      }

      // (d) Provider Capabilities Check: Provider capabilities must include required capability
      if (provider.capabilities) {
        let providerHasRequired = true;
        for (const reqCap of task.requiredCapabilities) {
          if (reqCap === 'image' && provider.capabilities.image === false) providerHasRequired = false;
          if (reqCap === 'video' && provider.capabilities.video === false) providerHasRequired = false;
          if (reqCap === 'vision' && provider.capabilities.vision === false) providerHasRequired = false;
          if (reqCap === 'text' && provider.capabilities.text === false) providerHasRequired = false;
        }
        if (!providerHasRequired) {
          continue;
        }
      }

      // AMM Capability Authority check
      const providerCap = capabilityRegistry.isProviderCapable(model.providerId, model.id, provider);
      if (!providerCap.capable) {
        continue;
      }

      // (e) Cinematic Reasoning Eligibility Guard: Never use forbidden models (lite, preview, latest, experimental)
      if (isCinematicTask && (model.tier === 'lite' || isForbiddenCinemaModel(model.id))) {
        continue;
      }

      // (f) Task Capability & Context Window Eligibility
      // Resolve capabilities via model definition or fallback
      const effectiveCapabilities = (model.capabilities && model.capabilities.length > 0)
        ? model.capabilities
        : ['text'];

      const eligibility = taskRegistry.isModelEligibleForTask(
        {
          id: model.id,
          capabilities: effectiveCapabilities,
          contextWindow: model.contextWindow,
          tier: model.tier,
        },
        task
      );

      if (!eligibility.eligible) {
        // Incompatible capabilities or context window
        continue;
      }

      // (g) Compute Granular Transparent Scores & Reasons
      const reasons: string[] = [];
      let score = 50;

      // Capability Match
      reasons.push(`Capabilities satisfied: [${task.requiredCapabilities.join(', ')}] matched`);
      score += 20;

      // Tier Match
      if (model.tier === task.preferredTier) {
        score += 15;
        reasons.push(`Tier match: Preferred '${task.preferredTier}' exactly aligned`);
      } else if (task.preferredTier === 'flash' && model.tier === 'pro') {
        score += 10;
        reasons.push(`Tier compatibility: 'pro' tier accepted for '${task.preferredTier}' task`);
      } else if (task.preferredTier === 'pro' && model.tier === 'ultra') {
        score += 12;
        reasons.push(`Tier upgrade: 'ultra' tier accepted for '${task.preferredTier}' task`);
      }

      // Context Window Score
      if (model.contextWindow && model.contextWindow >= task.minContextWindow) {
        score += 10;
        const formattedCtx = model.contextWindow >= 1000000 
          ? `${(model.contextWindow / 1000000).toFixed(1)}M` 
          : `${Math.round(model.contextWindow / 1000)}k`;
        reasons.push(`Context window available: ${formattedCtx} tokens >= ${Math.round(task.minContextWindow / 1000)}k required`);
      }

      // Provider & Credential Health
      const topCred = activeCreds[0] || availableCreds[0];
      const quotaScore = topCred ? Math.min(topCred.score, 100) : 50;
      if (topCred) {
        score += 5;
        reasons.push(`Provider '${model.providerId}' healthy with top key (${topCred.credential.name || topCred.credential.id})`);
      }

      // Stage-aware Cinematic Production Policy based on Minimum Capability + Quality Tier:
      const stage = (task.stageCode || '').toUpperCase();
      const taskIdStr = task.id as string;
      const isS1toS5 = ['S1', 'S2', 'S3', 'S4', 'S5'].includes(stage) ||
        ['story_analysis', 'character_analysis', 'character_detection', 'location_object_analysis', 'location_detection', 'narrative_structure', 'scene_breakdown'].includes(taskIdStr);
      const isS6 = stage === 'S6' || taskIdStr === 'shot_breakdown';
      const isS7 = stage === 'S7' || taskIdStr === 'master_frame_generation' || taskIdStr === 'master_frame';
      const isS8 = stage === 'S8' || taskIdStr === 'video_prompt_generation' || taskIdStr === 'video_prompt';

      if (isS1toS5) {
        // S1-S5: Deep Narrative & Screenplay Understanding -> Quality Tier 'pro' (gemini-2.5-pro)
        if (model.id.includes('2.5-pro')) {
          score += 25;
          reasons.push(`Production Policy [${stage || 'S1-S5'}]: Selected 'pro' tier reasoning model 'gemini-2.5-pro'`);
        } else if (model.id.includes('2.5-flash')) {
          score += 15;
          reasons.push(`Production Policy [${stage || 'S1-S5'}]: Tier fallback candidate 'gemini-2.5-flash'`);
        } else if (model.tier === 'pro') {
          score += 12;
          reasons.push(`Quality tier 'pro' capability match`);
        } else if (model.id.includes('3.7-flash')) {
          score += 8;
          reasons.push(`Google provider fallback: 'gemini-3.7-flash'`);
        }
      } else if (isS6) {
        // S6: Shot Breakdown & Camera Grammar -> Flexible (gemini-2.5-pro or gemini-2.5-flash)
        if (projectPolicy.priority === 'speed' || projectPolicy.priority === 'cost') {
          if (model.id.includes('2.5-flash')) {
            score += 25;
            reasons.push(`Production Policy [S6]: Selected fast structured model 'gemini-2.5-flash' for speed/cost`);
          } else if (model.id.includes('2.5-pro')) {
            score += 20;
            reasons.push(`Production Policy [S6]: Pro tier alternative 'gemini-2.5-pro'`);
          }
        } else {
          // Default: gemini-2.5-pro preferred for maximum framing nuance, gemini-2.5-flash high second
          if (model.id.includes('2.5-pro')) {
            score += 25;
            reasons.push(`Production Policy [S6]: Selected cinematic framing model 'gemini-2.5-pro'`);
          } else if (model.id.includes('2.5-flash')) {
            score += 22;
            reasons.push(`Production Policy [S6]: High-efficiency framing candidate 'gemini-2.5-flash'`);
          }
        }
        if (model.id.includes('3.7-flash')) {
          score += 10;
          reasons.push(`Google provider fallback: 'gemini-3.7-flash'`);
        }
      } else if (isS7) {
        // S7: Master Frame Generation -> Quality Tier 'pro' (gemini-2.5-pro) for rich visual fidelity
        if (model.id.includes('2.5-pro')) {
          score += 25;
          reasons.push(`Production Policy [S7]: Selected visual composition model 'gemini-2.5-pro'`);
        } else if (model.id.includes('2.5-flash')) {
          score += 15;
          reasons.push(`Production Policy [S7]: Fallback candidate 'gemini-2.5-flash'`);
        } else if (model.tier === 'pro') {
          score += 12;
        } else if (model.id.includes('3.7-flash')) {
          score += 8;
          reasons.push(`Google provider fallback: 'gemini-3.7-flash'`);
        }
      } else if (isS8) {
        // S8: Video Prompt Generation -> Quality Tier 'flash' (gemini-2.5-flash) for motion mechanics & cost control
        if (model.id.includes('2.5-flash')) {
          score += 25;
          reasons.push(`Production Policy [S8]: Selected cost-efficient motion compiler 'gemini-2.5-flash'`);
        } else if (model.id.includes('2.5-pro')) {
          score += 15;
          reasons.push(`Production Policy [S8]: Pro tier alternative 'gemini-2.5-pro'`);
        } else if (model.id.includes('3.7-flash')) {
          score += 10;
          reasons.push(`Google provider fallback: 'gemini-3.7-flash'`);
        }
      } else {
        if (projectPolicy.priority === 'speed' && (model.tier === 'flash' || model.tier === 'lite' || effectiveCapabilities.includes('fast'))) {
          score += 10;
          reasons.push(`Speed policy preference applied`);
        } else if (projectPolicy.priority === 'quality' && (model.tier === 'pro' || model.tier === 'ultra' || effectiveCapabilities.includes('reasoning'))) {
          score += 10;
          reasons.push(`Quality priority policy aligned`);
        }
      }

      // Final score normalization (capped at 99 for realism)
      const finalScore = Math.min(99, Math.max(10, score));

      candidates.push({
        model,
        baseScore: score,
        score: finalScore,
        reasons,
        reputationScore: 85,
        quotaScore,
        providerEligible: true,
      });
    }

    if (candidates.length === 0) {
      throw new Error(
        `TaskRouter: No eligible active AI models found for task '${task.id}' (Stage: ${task.stageCode}, Required Caps: [${task.requiredCapabilities.join(', ')}], Min Context: ${task.minContextWindow}).`
      );
    }

    // 4. Sort candidates by score descending (breaking ties using uncapped baseScore)
    candidates.sort((a, b) => {
      if (b.baseScore !== a.baseScore) return b.baseScore - a.baseScore;
      return b.score - a.score;
    });
    const chosen = candidates[0];

    // 5. Select Best Credential for the chosen model's provider via Credential Router
    const memoizedCreds = providerScoredCredsCache.get(chosen.model.providerId);
    const credSelection = await quotaRouter.selectCredential(chosen.model.providerId, memoizedCreds);
    chosen.reasons.push(`Credential Router assigned key: '${credSelection.credentialId}' (score: ${credSelection.score})`);

    const executionPlan: TaskExecutionPlan = {
      taskId: task.id,
      stageCode: task.stageCode,
      providerId: chosen.model.providerId,
      modelId: chosen.model.id,
      credentialId: credSelection.credentialId,
      apiKey: credSelection.apiKey,
      score: chosen.score,
      reasons: chosen.reasons,
      candidateEvaluation: {
        totalCandidates: allModels.length,
        eligibleCandidates: candidates.length,
        selectedModelTier: chosen.model.tier || 'pro',
        contextWindow: chosen.model.contextWindow || 128000,
        fallbackChain: candidates.slice(1).map(c => c.model.id),
      },
      decisionTimestamp: Date.now(),
    };

    // 6. Log Structured Execution Plan for Auditing
    this.logDecision(executionPlan);

    return executionPlan;
  },

  /**
   * Structured audit logging for all AI routing decisions
   */
  logDecision(plan: {
    taskId: string;
    stageCode?: string;
    modelId: string;
    providerId: string;
    credentialId: string;
    score: number;
    reasons: string[];
  }): void {
    console.log('\n===============================================================');
    console.log('🤖 AI ROUTER DECISION');
    console.log('===============================================================');
    console.log(`Task:        ${plan.taskId} (${plan.stageCode || 'GENERAL'})`);
    console.log(`Selected:    ${plan.modelId}`);
    console.log(`Provider:    ${plan.providerId}`);
    console.log(`Credential:  ${plan.credentialId}`);
    console.log(`Score:       ${plan.score}/100`);
    console.log('Reasons:');
    for (const r of plan.reasons) {
      console.log(`  ✓ ${r}`);
    }
    console.log('===============================================================\n');
  },
};
