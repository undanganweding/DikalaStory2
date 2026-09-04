import { AITaskDefinition, AITaskId, TaskExecutionPlan, TaskRouterRequest, AIModel } from '../../src/types';
export type { AITaskDefinition, AITaskId, TaskExecutionPlan, TaskRouterRequest, AIModel };
import { taskRegistry } from './task_registry';
import { db } from '../db';
import { capabilityRegistry } from './capability_registry';
import { quotaRouter } from './quota_router';
import { providerService } from './provider_service';
import { classifyTaskRequirements, rankCandidatesForIntent } from './intelligence_router';
import { healthService } from './health_service';

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
    const allModels = await db.getModels();
    const enabledModels = allModels.filter(m => m.enabled !== false);

    if (enabledModels.length === 0) {
      throw new Error(`TaskRouter: No active AI models found in database registry.`);
    }

    // 3. Evaluate each model against task requirements, AMM compatibility, provider health & credential status
    const candidates: ScoredModelCandidate[] = [];

    for (const model of enabledModels) {
      // (a) Provider-level health check & eligibility
      const providerState = await quotaRouter.getProviderOperationalState(model.providerId);
      if (!providerState.eligibility) {
        // Skip models whose provider is down / circuit open / quota exhausted
        continue;
      }

      // (b) Verify credentials exist and are scored for this provider
      const availableCreds = await quotaRouter.scoreCredentials(model.providerId);
      if (availableCreds.length === 0) {
        // Provider has no available healthy keys
        continue;
      }

      // (c) Task Capability & Context Window Eligibility
      // Resolve capabilities via model definition or fallback
      const effectiveCapabilities = (model.capabilities && model.capabilities.length > 0)
        ? model.capabilities
        : ['text'];

      const eligibility = taskRegistry.isModelEligibleForTask(
        {
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

      // (d) Compute Granular Transparent Scores & Reasons
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
      const topCred = availableCreds[0];
      const quotaScore = topCred ? Math.min(topCred.score, 100) : 50;
      if (topCred) {
        score += 5;
        reasons.push(`Provider '${model.providerId}' healthy with top key (${topCred.credential.name || topCred.credential.id})`);
      }

      // Policy-specific adjustment (Quality vs Speed vs Cost)
      if (projectPolicy.priority === 'speed' && (model.tier === 'flash' || model.tier === 'lite' || effectiveCapabilities.includes('fast'))) {
        score += 10;
        reasons.push(`Speed policy preference applied`);
      } else if (projectPolicy.priority === 'quality' && (model.tier === 'pro' || model.tier === 'ultra' || effectiveCapabilities.includes('reasoning'))) {
        score += 10;
        reasons.push(`Quality priority policy aligned`);
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

    // 4. Sort candidates by score descending
    candidates.sort((a, b) => b.score - a.score);
    const chosen = candidates[0];

    // 5. Select Best Credential for the chosen model's provider via Credential Router
    const credSelection = await quotaRouter.selectCredential(chosen.model.providerId);
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
