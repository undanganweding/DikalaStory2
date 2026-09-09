import 'dotenv/config';
import { db } from '../db';
import { taskRouter } from './task_router';

const startedAt = Date.now();
let lastMarker = 'START';
const mark = (value: string) => {
  lastMarker = value;
  console.log(`${value} elapsedMs=${Date.now() - startedAt}`);
};

const watchdog = setTimeout(() => {
  console.error(`S7_WATCHDOG_TIMEOUT elapsedMs=${Date.now() - startedAt} lastMarker=${lastMarker}`);
  process.exit(2);
}, 15000);

try {
  mark('S7_PROOF_START');
  const models = await db.getModels();
  mark(`S7_MODELS_LOADED count=${models.length}`);
  mark('S7_TASKROUTER_START');
  const plan = await taskRouter.resolveTaskExecutionPlan({
    taskId: 'master_frame_generation',
    stageCode: 'S7',
  });
  mark('S7_TASKROUTER_END');
  const provider = await db.getProvider(plan.providerId);
  mark('S7_PROVIDER_LOOKUP_END');
  const model = models.find(item => item.id === plan.modelId && item.providerId === plan.providerId);
  const result = {
    provider: plan.providerId,
    model: plan.modelId,
    score: plan.score,
    providerEnabled: provider?.enabled === true,
    modelEnabled: model?.enabled === true,
    elapsedMs: Date.now() - startedAt,
  };
  console.log('S7_RESULT', JSON.stringify(result));
  clearTimeout(watchdog);
  mark('S7_PROOF_COMPLETE');
  process.exit(0);
} catch (error: any) {
  clearTimeout(watchdog);
  console.error(`S7_PROOF_ERROR elapsedMs=${Date.now() - startedAt} lastMarker=${lastMarker} error=${error?.stack || error}`);
  process.exit(1);
}
