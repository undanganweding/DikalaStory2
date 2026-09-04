import { modelRouter, TaskType, Complexity } from './model_router';
import { setProviderHealth } from './adaptive_router';

async function runFullPipelineAudit() {
  console.log('--- Phase K.4: 10x Full Pipeline Forensic Audit ---');
  
  // Pipeline definition (Stage 1-8 mapping)
  const pipeline = [
    { stage: 'S1', task: 'research' as TaskType, complexity: 'HIGH' as Complexity },
    { stage: 'S2', task: 'narrative' as TaskType, complexity: 'MEDIUM' as Complexity },
    { stage: 'S3', task: 'scene' as TaskType, complexity: 'MEDIUM' as Complexity },
    { stage: 'S4', task: 'narrative' as TaskType, complexity: 'HIGH' as Complexity },
    { stage: 'S5', task: 'narrative' as TaskType, complexity: 'HIGH' as Complexity },
    { stage: 'S6', task: 'scene' as TaskType, complexity: 'MEDIUM' as Complexity },
    { stage: 'S7', task: 'image' as TaskType, complexity: 'MEDIUM' as Complexity },
    { stage: 'S8', task: 'image' as TaskType, complexity: 'HIGH' as Complexity }
  ];

  for (let run = 1; run <= 10; run++) {
    console.log(`\n--- Run ${run} ---`);
    console.log('Stage | Task | Complexity | Selected Model | Provider | Status');
    
    // Simulate runtime issues on run 5 & 6 to test fallback/retry resilience
    if (run === 5) {
        setProviderHealth('google', 'gemini-3.1-pro-preview', 'rate_limited', '429', Date.now() + 60000);
    }

    for (const step of pipeline) {
      const decision = await modelRouter.getBestModel(step.task, step.complexity);
      console.log(`${step.stage} | ${step.task.padEnd(10)} | ${step.complexity.padEnd(10)} | ${decision.modelId.padEnd(20)} | ${decision.provider.padEnd(10)} | Success`);
    }
  }
}

runFullPipelineAudit().catch(console.error);
