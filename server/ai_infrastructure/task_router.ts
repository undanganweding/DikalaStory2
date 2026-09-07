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

    // 2. Fetch all registered AI Models from Database
    let allModels = await db.getModels();
    let enabledModels = allModels.filter(m => m.enabled === true);

    // ONLY initialize baseline defaults if the database is COMPLETELY EMPTY (0 models total)
    if (allModels.length === 0) {
      try {
        await providerService.initializeDefaults();
        await modelRegistryService.initializeDefaults();
        allModels = await db.getModels();
        enabledModels = allModels.filter(m => m.enabled === true);
      } catch (seedErr: any) {
        console.warn('[TaskRouter] Baseline registry seed warning:', seedErr?.message || seedErr);
      }
    }

    if (enabledModels.length === 0) {
      throw new Error(`TaskRouter: No active AI models enabled in Infrastructure Settings. Please enable at least one model in Settings.`);
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

      // Provider & Credential Health + Priority Scoring
      const topCred = activeCreds[0] || availableCreds[0];
      const quotaScore = topCred ? Math.min(topCred.score, 100) : 50;
      if (topCred) {
        score += 5;
        reasons.push(`Provider '${model.providerId}' healthy with top key (${topCred.credential.name || topCred.credential.id})`);
      }

      // Provider Priority Enforcement (User / Project Config -> Provider Priority)
      if (projectPolicy.pinnedProviderId && projectPolicy.pinnedProviderId === model.providerId) {
        score += 30;
        reasons.push(`Provider Priority: Pinned provider '${model.providerId}' matched (+30)`);
      } else if (projectPolicy.preferredProvider && projectPolicy.preferredProvider === model.providerId) {
        score += 20;
        reasons.push(`Provider Priority: Preferred provider '${model.providerId}' matched (+20)`);
      } else if (model.providerId !== 'google') {
        // Priority 1: Healthy custom provider with active credential
        score += 15;
        reasons.push(`Provider Priority: Active custom provider '${model.providerId}' (Priority 1)`);
      }

      // Stage-aware Cinematic Production Policy based on Minimum Capability + Quality Tier:
      const stage = (task.stageCode || '').toUpperCase();
      const taskIdStr = task.id as string;
      const isS1toS5 = ['S1', 'S2', 'S3', 'S4', 'S5'].includes(stage) ||
        ['story_analysis', 'character_analysis', 'character_detection', 'location_object_analysis', 'location_detection', 'narrative_structure', 'scene_breakdown'].includes(taskIdStr);
      const isS6 = stage === 'S6' || taskIdStr === 'shot_breakdown';
      const isS7 = stage === 'S7' || taskIdStr === 'master_frame_generation' || taskIdStr === 'master_frame';
      const isS8 = stage === 'S8' || taskIdStr === 'video_prompt_generation' || taskIdStr === 'video_prompt';

      const isProOrReasoning = model.tier === 'pro' || model.tier === 'ultra' || model.id.includes('pro') || model.capabilities?.includes('reasoning');
      const isFlashOrFast = model.tier === 'flash' || model.tier === 'lite' || model.id.includes('flash') || model.capabilities?.includes('fast');

      if (isS1toS5) {
        // S1-S5: Deep Narrative & Screenplay Understanding -> Quality Tier 'pro' (high reasoning)
        if (isProOrReasoning) {
          score += 25;
          reasons.push(`Production Policy [${stage || 'S1-S5'}]: High-reasoning pro model '${model.id}'`);
        } else if (isFlashOrFast) {
          score += 15;
          reasons.push(`Production Policy [${stage || 'S1-S5'}]: Fast model alternative '${model.id}'`);
        }
      } else if (isS6) {
        // S6: Shot Breakdown & Camera Grammar -> Flexible
        if (projectPolicy.priority === 'speed' || projectPolicy.priority === 'cost') {
          if (isFlashOrFast) {
            score += 25;
            reasons.push(`Production Policy [S6]: Fast structured model '${model.id}' for speed/cost`);
          } else if (isProOrReasoning) {
            score += 20;
            reasons.push(`Production Policy [S6]: Pro tier alternative '${model.id}'`);
          }
        } else {
          if (isProOrReasoning) {
            score += 25;
            reasons.push(`Production Policy [S6]: Cinematic framing model '${model.id}'`);
          } else if (isFlashOrFast) {
            score += 22;
            reasons.push(`Production Policy [S6]: High-efficiency framing candidate '${model.id}'`);
          }
        }
      } else if (isS7) {
        // S7: Master Frame Generation -> Quality Tier 'pro' for rich visual fidelity
        if (isProOrReasoning) {
          score += 25;
          reasons.push(`Production Policy [S7]: Visual composition model '${model.id}'`);
        } else if (isFlashOrFast) {
          score += 15;
          reasons.push(`Production Policy [S7]: Fast visual fallback candidate '${model.id}'`);
        }
      } else if (isS8) {
        // S8: Video Prompt Generation -> Quality Tier 'flash' for motion mechanics & cost control
        if (isFlashOrFast) {
          score += 25;
          reasons.push(`Production Policy [S8]: Cost-efficient motion compiler '${model.id}'`);
        } else if (isProOrReasoning) {
          score += 15;
          reasons.push(`Production Policy [S8]: Pro tier alternative '${model.id}'`);
        }
      } else {
        if (projectPolicy.priority === 'speed' && isFlashOrFast) {
          score += 10;
          reasons.push(`Speed policy preference applied`);
        } else if (projectPolicy.priority === 'quality' && isProOrReasoning) {
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

    // 6. Build Structured Sequential Fallback Hierarchy:
    // Resolved Route -> FAIL -> (1) same provider / next credential -> (2) next eligible model -> (3) next provider
    const fallbackPlan: Array<{
      type: 'same_provider_next_credential' | 'next_eligible_model' | 'next_provider';
      providerId: string;
      modelId: string;
      credentialId?: string;
      score?: number;
      description: string;
    }> = [];

    // Step 1: Same provider, next active credentials
    const chosenProviderCreds = providerScoredCredsCache.get(chosen.model.providerId) || [];
    for (const sc of chosenProviderCreds) {
      if (sc.credential.id !== credSelection.credentialId && sc.state === 'ACTIVE' && sc.credential.status === 'active') {
        fallbackPlan.push({
          type: 'same_provider_next_credential',
          providerId: chosen.model.providerId,
          modelId: chosen.model.id,
          credentialId: sc.credential.id,
          score: sc.score,
          description: `Fallback: Same provider '${chosen.model.providerId}' using backup key '${sc.credential.name || sc.credential.id}'`,
        });
      }
    }

    // Step 2: Next eligible models on the same provider
    const sameProviderCandidates = candidates.slice(1).filter(c => c.model.providerId === chosen.model.providerId);
    for (const altCandidate of sameProviderCandidates) {
      fallbackPlan.push({
        type: 'next_eligible_model',
        providerId: altCandidate.model.providerId,
        modelId: altCandidate.model.id,
        score: altCandidate.score,
        description: `Fallback: Alternative model '${altCandidate.model.id}' on provider '${altCandidate.model.providerId}' (Score: ${altCandidate.score})`,
      });
    }

    // Step 3: Next eligible providers & models
    const otherProviderCandidates = candidates.slice(1).filter(c => c.model.providerId !== chosen.model.providerId);
    for (const nextProvCandidate of otherProviderCandidates) {
      fallbackPlan.push({
        type: 'next_provider',
        providerId: nextProvCandidate.model.providerId,
        modelId: nextProvCandidate.model.id,
        score: nextProvCandidate.score,
        description: `Fallback: Alternative provider '${nextProvCandidate.model.providerId}' with model '${nextProvCandidate.model.id}' (Score: ${nextProvCandidate.score})`,
      });
    }

    const executionPlan: TaskExecutionPlan = {
      taskId: task.id,
      stageCode: task.stageCode,
      providerId: chosen.model.providerId,
      modelId: chosen.model.id,
      credentialId: credSelection.credentialId,
      apiKey: credSelection.apiKey,
      score: chosen.score,
      priority: chosen.model.providerId !== 'google' ? 1 : 2,
      reasons: chosen.reasons,
      fallbackPlan,
      candidateEvaluation: {
        totalCandidates: allModels.length,
        eligibleCandidates: candidates.length,
        selectedModelTier: chosen.model.tier || 'pro',
        contextWindow: chosen.model.contextWindow || 128000,
        fallbackChain: candidates.slice(1).map(c => c.model.id),
        candidatesSummary: candidates.map(c => ({
          providerId: c.model.providerId,
          modelId: c.model.id,
          score: c.score,
          priority: c.model.providerId !== 'google' ? 1 : 2,
          tier: c.model.tier,
        })),
      },
      decisionTimestamp: Date.now(),
    };

    // 7. Log Single Resolved Route for Auditing
    this.logDecision(executionPlan);

    return executionPlan;
  },

  /**
   * Structured audit logging for all AI routing decisions
   */
  logDecision(plan: TaskExecutionPlan): void {
    console.log('\n===============================================================');
    console.log('🤖 [TASK ROUTER]');
    console.log('===============================================================');
    const taskName = plan.stageCode ? `${plan.stageCode}.${plan.taskId}` : String(plan.taskId);
    console.log(`requested task: ${taskName}\n`);
    
    if (plan.candidateEvaluation?.candidatesSummary && plan.candidateEvaluation.candidatesSummary.length > 0) {
      console.log('candidate providers / models:');
      plan.candidateEvaluation.candidatesSummary.forEach((cand, idx) => {
        const isChosen = cand.providerId === plan.providerId && cand.modelId === plan.modelId;
        const mark = isChosen ? '👉' : '  ';
        console.log(`${mark} ${idx + 1}. [Provider: ${cand.providerId}] Model: ${cand.modelId} (Score: ${cand.score}/100, Priority: ${cand.priority})`);
      });
      console.log('');
    }

    console.log('[RESOLVED ROUTE]');
    console.log(`  provider:   ${plan.providerId}`);
    console.log(`  model:      ${plan.modelId}`);
    console.log(`  credential: ${plan.credentialId}`);
    console.log(`  score:      ${plan.score}/100`);
    console.log(`  priority:   ${plan.priority || 1}`);
    console.log('  reasons:');
    for (const r of plan.reasons) {
      console.log(`    ✓ ${r}`);
    }
    if (plan.fallbackPlan && plan.fallbackPlan.length > 0) {
      console.log('  fallback plan:');
      for (const fb of plan.fallbackPlan) {
        console.log(`    ↳ [${fb.type}] ${fb.providerId} / ${fb.modelId} (Key: ${fb.credentialId || 'auto'})`);
      }
    }
    console.log('===============================================================\n');
  },
};
