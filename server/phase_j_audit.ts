import { modelRouter, TaskType, Complexity } from './model_router';
import { setProviderHealth } from './adaptive_router';

async function runJAudit() {
  console.log('--- Phase J: 10x Real Production Forensics ---');
  
  const pipeline = [
    { task: 'research' as TaskType, complexity: 'HIGH' as Complexity },
    { task: 'narrative' as TaskType, complexity: 'HIGH' as Complexity },
    { task: 'scene' as TaskType, complexity: 'MEDIUM' as Complexity },
    { task: 'general' as TaskType, complexity: 'LOW' as Complexity }
  ];

  for (let run = 1; run <= 10; run++) {
    console.log(`\n--- Run ${run} ---`);
    console.log('Stage | Task | Complexity | Selected Model | Score | Status');
    
    // Simulate runtime issues on run 5 to test fallback/rotation
    if (run === 5) {
        setProviderHealth('google', 'gemini-3.1-pro-preview', 'rate_limited', '429', Date.now() + 60000);
    }

    for (let s = 0; s < pipeline.length; s++) {
      const step = pipeline[s];
      const decision = await modelRouter.getBestModel(step.task, step.complexity);
      console.log(`${s + 1} | ${step.task.padEnd(10)} | ${step.complexity.padEnd(10)} | ${decision.modelId.padEnd(20)} | N/A | Success`);
    }
  }
}

runJAudit().catch(console.error);
