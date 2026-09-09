import 'dotenv/config';
import { db } from '../db';
import { taskRegistry } from './task_registry';
import { modelUsability } from './model_usability';
import { quotaRouter } from './quota_router';
import { capabilityRegistry } from './capability_registry';
import { isForbiddenCinemaModel, CINEMA_FALLBACK_POLICY } from './ai_gateway';
import { taskRouter } from './task_router';

const providerId = 'local_9router_mtssnvob';
const modelId = 'codex';
const allCases = [['S1', 'story_analysis'], ['S7', 'master_frame_generation'], ['S8', 'video_prompt_generation']] as const;
const cases = process.argv[2] ? allCases.filter(([stage]) => stage === process.argv[2]) : allCases;

async function audit(stageCode: string, taskId: string) {
  const task = taskRegistry.getTask(taskId)!;
  const model = await db.getModel(modelId, providerId);
  const provider = await db.getProvider(providerId);
  const usabilityEligible = model ? modelUsability.isEligible(providerId, modelId) : false;
  const operational = await quotaRouter.getProviderOperationalState(providerId);
  const scored = await quotaRouter.scoreCredentials(providerId);
  const activeCredentials = scored.filter(c => c.credential.status === 'active' && (c.state === 'ACTIVE' || c.state === 'WARNING'));
  const credentialEligible = activeCredentials.length > 0;
  const requiredCapabilities = task.requiredCapabilities;
  const providerCapabilityEligible = Boolean(provider) && requiredCapabilities.every(cap => (provider!.capabilities as any)?.[cap] !== false);
  const amm = model && provider ? capabilityRegistry.isProviderCapable(providerId, modelId, provider) : { capable: false, reason: 'missing model/provider' } as any;
  const cinematic = ['story_analysis','character_analysis','character_detection','location_object_analysis','location_detection','narrative_structure','scene_breakdown','shot_breakdown','master_frame_generation','master_frame','video_prompt_generation','video_prompt'].includes(task.id) || ['S1','S2','S3','S4','S5','S6','S7','S8'].includes(stageCode);
  const forbidden = isForbiddenCinemaModel(modelId);
  const cinematicEligible = !(cinematic && ((model?.tier || '') === 'lite' || forbidden));
  const effectiveCapabilities = model?.capabilities?.length ? model.capabilities : ['text'];
  const taskEligibility = model ? taskRegistry.isModelEligibleForTask({ id: model.id, capabilities: effectiveCapabilities, contextWindow: model.contextWindow, tier: model.tier }, task) : { eligible: false, reason: 'model missing' } as any;
  let rejection = !model ? 'db.getModel() returned null' : !model.enabled ? 'model.enabled !== true' : !usabilityEligible ? 'modelUsability.isEligible() returned false' : !operational.eligibility ? 'quotaRouter.getProviderOperationalState().eligibility is false' : !provider ? 'db.getProvider() returned null' : provider.enabled === false ? 'provider.enabled === false' : (provider as any).status && (provider as any).status !== 'active' ? 'provider.status !== active' : !credentialEligible ? 'active credential filter returned zero' : !providerCapabilityEligible ? 'provider capabilities rejected required capability' : !amm.capable ? `capabilityRegistry.isProviderCapable() returned false: ${amm.reason || 'no reason'}` : !cinematicEligible ? 'cinematic forbidden/lite predicate' : !taskEligibility.eligible ? `taskRegistry.isModelEligibleForTask() returned false: ${taskEligibility.reason || 'capability/context mismatch'}` : '';
  let score = 50;
  let providerScore = 0;
  let cinematicScore = 0;
  if (!rejection) {
    score += 20;
    if (model!.tier === task.preferredTier) score += 15; else if (task.preferredTier === 'flash' && model!.tier === 'pro') score += 10; else if (task.preferredTier === 'pro' && model!.tier === 'ultra') score += 12;
    if (model!.contextWindow && model!.contextWindow >= task.minContextWindow) score += 10;
    if (activeCredentials[0]) score += 5;
    if (model!.providerId !== 'google') { providerScore = 15; score += 15; }
    const isPro = model!.tier === 'pro' || model!.tier === 'ultra' || model!.id.includes('pro') || model!.capabilities?.includes('reasoning');
    const isFlash = model!.tier === 'flash' || model!.tier === 'lite' || model!.id.includes('flash') || model!.capabilities?.includes('fast');
    if (['S1','S2','S3','S4','S5'].includes(stageCode)) cinematicScore = isPro ? 25 : isFlash ? 15 : 0;
    else if (stageCode === 'S7') cinematicScore = isPro ? 25 : isFlash ? 15 : 0;
    else if (stageCode === 'S8') cinematicScore = isFlash ? 25 : isPro ? 15 : 0;
    score += cinematicScore;
  }
  const plan = await taskRouter.resolveTaskExecutionPlan({ taskId, stageCode });
  const rank = plan.candidateEvaluation?.candidatesSummary?.findIndex(c => c.providerId === providerId && c.modelId === modelId);
  console.log(JSON.stringify({ stageCode, taskId, provider: providerId, model: modelId, enabled: model?.enabled === true, usabilityEligible, providerOperationalEligibility: operational.eligibility, credentialEligible, capabilities: effectiveCapabilities, contextWindow: model?.contextWindow, requiredContextWindow: task.minContextWindow, cinematicEligible, taskCapabilityEligibility: taskEligibility.eligible, ammEligible: amm.capable, forbiddenModel: forbidden, baseScore: rejection ? null : score - providerScore - cinematicScore, providerScore, cinematicScore, finalScore: rejection ? null : Math.min(99, score), finalCandidateStatus: rejection ? 'REJECTED' : 'ELIGIBLE', exactRejectionPredicate: rejection || null, rankingPosition: rank === undefined || rank < 0 ? null : rank + 1 }));
}
for (const [stage, task] of cases) await audit(stage, task);
