import { db } from '../db';
import { taskRegistry } from './task_registry';
import { quotaRouter } from './quota_router';
import { providerService } from './provider_service';
import { capabilityRegistry } from './capability_registry';
import { isForbiddenCinemaModel, dailyExhaustedRegistry, isModelSuppressed, markModelSuppressed } from './ai_gateway';
import { healthService } from './health_service';
import { credentialService } from './credential_service';
import { secretVault } from '../security/secret_vault';
import { GoogleGenAI } from '@google/genai';
import { AITaskDefinition, AICredential } from '../../src/types';

export interface PreflightCandidatePath {
  stage: string;
  credentialId: string;
  providerId: string;
  modelId: string;
  quotaLevel?: 'abundant' | 'moderate' | 'low' | 'exhausted';
}

export interface PreflightCheckResult {
  viable: boolean;
  confidence: 'LIVE_VERIFIED' | 'LOCAL_STATE_ONLY';
  remainingQuota: 'ABUNDANT' | 'MODERATE' | 'LOW' | 'EXHAUSTED' | 'UNKNOWN';
  viablePathsCount: number;
  exhaustedPathsCount: number;
  viablePaths: PreflightCandidatePath[];
  exhaustedPaths: PreflightCandidatePath[];
  activeCredentialName?: string;
  activeProviderId?: string;
  totalCredentialsInPool?: number;
  readyModels?: string[];
  modelQuotaLevels?: Record<string, 'abundant' | 'moderate' | 'low' | 'exhausted'>;
  reason: string;
}

export const executionPreflight = {
  /**
   * Evaluates the viability of running a list of pipeline stages based on live quota state,
   * active model health, and smart multi-key credential fallback across 3 to 10+ keys.
   */
  async checkExecutionPreflight(stages: string[]): Promise<PreflightCheckResult> {
    const viablePaths: PreflightCandidatePath[] = [];
    const exhaustedPaths: PreflightCandidatePath[] = [];
    const blockedStages: string[] = [];
    const modelQuotaLevels: Record<string, 'abundant' | 'moderate' | 'low' | 'exhausted'> = {};

    // 1. Bulk pre-fetch snapshot data to avoid N+1 DB reads
    const [allModels, allCredentials] = await Promise.all([
      db.getModels(),
      credentialService.listCredentials(),
    ]);

    const enabledModels = allModels.filter(m => m.enabled === true);
    const providerIds = Array.from(new Set(enabledModels.map(m => m.providerId)));

    const [healthResults, providerResults] = await Promise.all([
      Promise.all(allCredentials.map(async (c: any) => {
        const h = await healthService.getHealth(c.id);
        return { id: c.id, health: h };
      })),
      Promise.all(providerIds.map(async (pid) => {
        const prov = await db.getProvider(pid);
        return { id: pid, provider: prov };
      }))
    ]);

    const allHealth = new Map<string, any>();
    for (const res of healthResults) {
      allHealth.set(res.id, res.health);
    }

    const providers = new Map<string, any>();
    for (const res of providerResults) {
      if (res.provider) {
        providers.set(res.id, res.provider);
      }
    }

    const snapshot = {
      allModels,
      allCredentials,
      allHealth,
      providers
    };

    // Cache to store scored credentials per provider
    const providerScoredCredsCache = new Map<string, any[]>();

    for (const stage of stages) {
      const task: AITaskDefinition | undefined = taskRegistry.getTask(stage);
      if (!task) {
        // Unknown or custom non-AI step
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

        // Verify provider exists and is enabled in snapshot
        const provider = snapshot.providers.get(model.providerId);
        if (!provider || provider.enabled === false || (provider as any).status === 'inactive') {
          continue;
        }

        // Fetch scored active credentials for this provider from snapshot
        let availableCreds = providerScoredCredsCache.get(model.providerId);
        if (!availableCreds) {
          availableCreds = await quotaRouter.scoreCredentials(model.providerId, snapshot);
          providerScoredCredsCache.set(model.providerId, availableCreds);
        }
        const activeCreds = availableCreds.filter(
          c => c.credential.status === 'active' && (c.state === 'ACTIVE' || c.state === 'WARNING')
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

        // Evaluate each active credential for daily exhaustion and quota status
        for (const scoredCred of activeCreds) {
          const cred: AICredential = scoredCred.credential;
          const cacheKey1 = `${cred.name}:${model.id}`;
          const cacheKey2 = `${cred.id}:${model.id}`;

          const isExhausted = dailyExhaustedRegistry.has(cacheKey1) || dailyExhaustedRegistry.has(cacheKey2);
          const isSuppressed = isModelSuppressed(cacheKey1) || isModelSuppressed(cacheKey2);

          let quotaLevel: 'abundant' | 'moderate' | 'low' | 'exhausted' = 'abundant';
          if (isExhausted || isSuppressed) {
            quotaLevel = 'exhausted';
          } else if (scoredCred.state === 'WARNING') {
            quotaLevel = 'moderate';
          }

          modelQuotaLevels[model.id] = quotaLevel;

          const candidatePath: PreflightCandidatePath = {
            stage: task.stageCode || stage,
            credentialId: cred.id,
            providerId: model.providerId,
            modelId: model.id,
            quotaLevel,
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

    // 2. Perform live probe on candidate credentials in priority order to confirm active availability
    let liveVerified = false;
    let activeCredentialName: string | undefined;
    let activeProviderId: string | undefined;
    const readyModels: string[] = [];
    const totalCredentialsInPool = allCredentials.length;

    // Probe candidate paths until finding a live verified key
    for (const candPath of viablePaths) {
      if (liveVerified) break;
      const targetCred = allCredentials.find(c => c.id === candPath.credentialId);
      if (!targetCred) continue;

      let rawKey = '';
      try {
        rawKey = secretVault.decryptSecret(targetCred.encryptedSecret);
      } catch {
        rawKey = (targetCred as any).secret || '';
      }

      if (rawKey && rawKey.startsWith('AIza') && candPath.providerId === 'google') {
        const probeAi = new GoogleGenAI({
          apiKey: rawKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const probeModel = candPath.modelId || 'gemini-3.7-flash';
        try {
          const pingRes = await probeAi.models.generateContent({
            model: probeModel,
            contents: 'ping',
            config: { maxOutputTokens: 3 },
          });
          if (pingRes?.text) {
            liveVerified = true;
            activeProviderId = candPath.providerId;
            activeCredentialName = targetCred.name;
            modelQuotaLevels[probeModel] = 'abundant';
            if (!readyModels.includes(probeModel)) readyModels.push(probeModel);
            break;
          }
        } catch (probeErr: any) {
          const errMsg = (probeErr?.message || '').toLowerCase();
          if (errMsg.includes('429') || errMsg.includes('resource_exhausted') || errMsg.includes('limit: 0') || errMsg.includes('quota')) {
            const k1 = `${targetCred.name}:${probeModel}`;
            const k2 = `${targetCred.id}:${probeModel}`;
            dailyExhaustedRegistry.set(k1, Date.now() + 60000);
            dailyExhaustedRegistry.set(k2, Date.now() + 60000);
            modelQuotaLevels[probeModel] = 'exhausted';
          }
        }
      } else if (rawKey && candPath.providerId !== 'google') {
        // Custom provider is viable
        activeProviderId = candPath.providerId;
        activeCredentialName = targetCred.name;
        liveVerified = true;
        break;
      }
    }

    // Default active credential if not live probed
    if (!activeCredentialName && viablePaths.length > 0) {
      const topCred = allCredentials.find(c => c.id === viablePaths[0].credentialId);
      activeCredentialName = topCred ? topCred.name : undefined;
      activeProviderId = viablePaths[0].providerId;
    }

    // Collect all viable model IDs that are not marked exhausted
    for (const vp of viablePaths) {
      if (modelQuotaLevels[vp.modelId] !== 'exhausted' && !readyModels.includes(vp.modelId)) {
        readyModels.push(vp.modelId);
      }
    }

    const viable = blockedStages.length === 0 && viablePaths.length > 0;

    let remainingQuota: 'ABUNDANT' | 'MODERATE' | 'LOW' | 'EXHAUSTED' | 'UNKNOWN' = 'ABUNDANT';
    if (!viable) {
      remainingQuota = 'EXHAUSTED';
    } else if (readyModels.length <= 1 && totalCredentialsInPool <= 1) {
      remainingQuota = 'LOW';
    } else if (totalCredentialsInPool >= 2) {
      remainingQuota = 'ABUNDANT';
    } else if (exhaustedPaths.length > viablePaths.length) {
      remainingQuota = 'MODERATE';
    }

    let reason = '';
    if (viable) {
      reason = `PRECHECK RESULT: VIABLE. ${totalCredentialsInPool} API Key aktif di pool. Model AI Siap (${readyModels.length > 0 ? readyModels.join(', ') : 'Semua Model'}) pada "${activeCredentialName || 'Default'}". Fast multi-key rolling aktif.`;
    } else {
      reason = `Pipeline diblokir sebelum AI request. Tahap berikut tidak memiliki model/kredensial yang siap: ${blockedStages.join(', ')}.`;
    }

    return {
      viable,
      confidence: liveVerified ? 'LIVE_VERIFIED' : 'LOCAL_STATE_ONLY',
      remainingQuota,
      viablePathsCount: viablePaths.length,
      exhaustedPathsCount: exhaustedPaths.length,
      viablePaths,
      exhaustedPaths,
      activeCredentialName,
      activeProviderId,
      totalCredentialsInPool,
      readyModels,
      modelQuotaLevels,
      reason,
    };
  },
};

