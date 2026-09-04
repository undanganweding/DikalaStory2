
import { modelRouter, TaskType } from './model_router';
import { setProviderHealth } from './adaptive_router';
import { credentialManager } from './credential_manager';

async function runAudit() {
  console.log('Running Production Routing Audit: "Lahirnya Cahaya"');
  
  const pipeline: { stage: string; task: TaskType }[] = [
    { stage: 'Stage 1', task: 'research' },
    { stage: 'Stage 2', task: 'narrative' },
    { stage: 'Stage 3', task: 'scene' },
    { stage: 'Stage 4', task: 'general' }
  ];

  const scenarios = [
    { name: 'Scenario 1: Healthy', setup: () => {} },
    { name: 'Scenario 2: Rate-limited', setup: () => {
        setProviderHealth('google', 'gemini-3.1-pro-preview', 'rate_limited', '429', Date.now() + 60000);
    }},
    { name: 'Scenario 3: Degraded', setup: () => {
        setProviderHealth('google', 'gemini-3.1-pro-preview', 'rate_limited', '429', Date.now() + 60000);
        setProviderHealth('google', 'gemini-3.7-flash', 'rate_limited', '429', Date.now() + 60000);
    }}
  ];

  console.log('Stage | Task | Selected Model | Provider | Status');
  console.log('--------------------------------------------------');

  for (const scenario of scenarios) {
    console.log(`\n--- ${scenario.name} ---`);
    scenario.setup();
    for (const step of pipeline) {
      const decision = await modelRouter.getBestModel(step.task);
      console.log(`${step.stage} | ${step.task.padEnd(10)} | ${decision.modelId.padEnd(20)} | ${decision.provider.padEnd(8)} | Success`);
    }
  }
}

runAudit().catch(console.error);
