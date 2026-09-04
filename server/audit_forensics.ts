import { AVAILABLE_MODELS, GeminiModelInfo } from './gemini';
import { TaskType } from './model_router';

interface RankedModel {
  info: GeminiModelInfo;
  provider: string;
  score: number;
}

function scoreModel(model: GeminiModelInfo, task: TaskType): number {
  let score = 0;
  if (task === 'image' && !model.capabilities.image) return -1000;
  if (task === 'tts' && !model.capabilities.audio) return -1000;
  if (task === 'research' && !model.capabilities.reasoning) return -500;
  if (['research', 'narrative'].includes(task)) {
      if (model.tier === 'pro') score += 500;
      else if (model.tier === 'flash') score += 200;
  } else {
      if (model.tier === 'flash') score += 500;
      else if (model.tier === 'pro') score += 300;
  }
  if (model.isRecommended) score += 100;
  return score;
}

async function runForensics() {
  console.log('--- Phase H.1: Routing Decision Forensics ---');
  
  const pipelineScenarios = [
    { stage: '1', task: 'research', complexity: 'High' },
    { stage: '2', task: 'narrative', complexity: 'High' },
    { stage: '3', task: 'scene', complexity: 'Medium' },
    { stage: '4', task: 'general', complexity: 'Low' },
    { stage: '5', task: 'research', complexity: 'Very High' },
    { stage: '6', task: 'image', complexity: 'Medium' },
    { stage: '7', task: 'tts', complexity: 'Medium' },
    { stage: '8', task: 'scene', complexity: 'Medium' },
    { stage: '9', task: 'narrative', complexity: 'Medium' },
    { stage: '10', task: 'general', complexity: 'Low' }
  ];

  console.log('Stage | Task | Complexity | Selected Model | Score | Reason');
  console.log('------------------------------------------------------------------');

  for (const s of pipelineScenarios) {
    const models = AVAILABLE_MODELS.map(m => ({ 
        info: m, 
        provider: 'google', 
        score: scoreModel(m, s.task as TaskType) 
    }));
    const ranked = models.sort((a, b) => b.score - a.score);
    const selected = ranked[0];
    
    console.log(`${s.stage.padEnd(5)} | ${s.task.padEnd(10)} | ${s.complexity.padEnd(10)} | ${selected.info.id.padEnd(20)} | ${selected.score.toString().padEnd(5)} | Based on Capability/Tier`);
  }
}

runForensics();
