import { db } from '../db';
import { taskRegistry } from './task_registry';
import { quotaRouter } from './quota_router';
import { providerService } from './provider_service';
import { capabilityRegistry } from './capability_registry';
import { isForbiddenCinemaModel } from './ai_gateway';
import { dailyExhaustedRegistry } from './ai_gateway';
import { AITaskDefinition, AICredential } from '../../src/types';

export interface PreflightCandidatePath {
  stage: string;
  credentialId: string;
  providerId: string;
  modelId: string;
}

export interface PreflightCheckResult {
  viable: boolean;
  confidence: 'LOCAL_STATE_ONLY';
  remainingQuota: 'UNKNOWN';
  viablePathsCount: number;
  exhaustedPathsCount: number;
  viablePaths: PreflightCandidatePath[];
  exhaustedPaths: PreflightCandidatePath[];
  reason: string;
}

export const executionPreflight = {
  /**
   * Evaluates the viability of running a list of pipeline stages based purely on local state.
   * If any of the requested stages has zero viable paths available (all known candidates are exhausted),
   * the preflight fails and blocks the pipeline before making any AI requests.
   */
  async checkExecutionPreflight(stages: string[]): Promise<PreflightCheckResult> {
    const viablePaths: PreflightCandidatePath[] = [];
    const exhaustedPaths: PreflightCandidatePath[] = [];
    const blockedStages: string[] = [];

    // Fetch all registered models once
    const allModels = await db.getModels();
    const enabledModels = allModels.filter(m => m.enabled !== false);

    // Caches to prevent redundant DB calls within the same run
    const providerDbCache = new Map<string, any>();
    const providerScoredCredsCache = new Map<string, any[]>();

    for (const stage of stages) {
      const task: AITaskDefinition | undefined = taskRegistry.getTask(stage);
      if (!task) {
        // If the stage is unknown, it doesn't use AI routing directly or is a custom non-AI step
        continue;
      }

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

      let stageHasAtLeastOneViablePath = false;

      for (const model of enabledModels) {
        // Exclude test/mock providers to mirror task router production behavior
        const isTestProvider = model.providerId.startsWith('prov_pin_test_') ||
          model.providerId.startsWith('prov_test_') ||
          model.providerId.includes('_test_') ||
          model.providerId.includes('mock_');
        if (isTestProvider) {
          continue;
        }

        // Verify provider exists and is enabled
        let provider = providerDbCache.get(model.providerId);
        if (provider === undefined) {
          provider = await db.getProvider(model.providerId);
          providerDbCache.set(model.providerId, provider);
        }
        if (!provider || provider.enabled === false || (provider as any).status === 'inactive') {
          continue;
        }

        // Fetch scored active credentials for this provider
        let availableCreds = providerScoredCredsCache.get(model.providerId);
        if (!availableCreds) {
          availableCreds = await quotaRouter.scoreCredentials(model.providerId);
          providerScoredCredsCache.set(model.providerId, availableCreds);
        }
        const activeCreds = availableCreds.filter(
          c => c.credential.status === 'active' && c.state === 'ACTIVE'
        );
        if (activeCreds.length === 0) {
          continue;
        }

        // Provider Capabilities Check
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

        // AMM Capability check
        const providerCap = capabilityRegistry.isProviderCapable(model.providerId, model.id, provider);
        if (!providerCap.capable) {
          continue;
        }

        // Cinematic reasoning model constraints
        if (isCinematicTask && (model.tier === 'lite' || isForbiddenCinemaModel(model.id))) {
          continue;
        }

        // Model eligibility check
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
          continue;
        }

        // Evaluate each active credential for daily exhaustion
        for (const scoredCred of activeCreds) {
          const cred: AICredential = scoredCred.credential;
          const cacheKey1 = `${cred.name}:${model.id}`;
          const cacheKey2 = `${cred.id}:${model.id}`;

          const isExhausted = dailyExhaustedRegistry.has(cacheKey1) || dailyExhaustedRegistry.has(cacheKey2);

          const candidatePath: PreflightCandidatePath = {
            stage: task.stageCode || stage,
            credentialId: cred.id,
            providerId: model.providerId,
            modelId: model.id,
          };

          if (isExhausted) {
            exhaustedPaths.push(candidatePath);
          } else {
            viablePaths.push(candidatePath);
            stageHasAtLeastOneViablePath = true;
          }
        }
      }

      if (!stageHasAtLeastOneViablePath) {
        blockedStages.push(task.stageCode || stage);
      }
    }

    const viable = blockedStages.length === 0 && viablePaths.length > 0;

    let reason = '';
    if (viable) {
      reason = 'PRECHECK RESULT: VIABLE. At least one execution path is currently available based on known local health/quota state.';
    } else {
      reason = `Pipeline blocked before AI request. The following stages have no viable execution paths: ${blockedStages.join(', ')}.`;
    }

    return {
      viable,
      confidence: 'LOCAL_STATE_ONLY',
      remainingQuota: 'UNKNOWN',
      viablePathsCount: viablePaths.length,
      exhaustedPathsCount: exhaustedPaths.length,
      viablePaths,
      exhaustedPaths,
      reason,
    };
  },
};
