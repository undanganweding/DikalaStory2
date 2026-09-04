import { GeminiModelInfo } from './gemini';

export interface TaskRequirements {
  requiredCapabilities: (keyof GeminiModelInfo['capabilities'])[];
  preferredCapabilities?: (keyof GeminiModelInfo['capabilities'])[];
}

export function resolveModelForTask(
  models: GeminiModelInfo[],
  requirements: TaskRequirements
): GeminiModelInfo[] {
  return models.filter(model => 
    requirements.requiredCapabilities.every(cap => model.capabilities[cap])
  ).sort((a, b) => {
    // Basic preference scoring
    const aPref = requirements.preferredCapabilities?.filter(c => a.capabilities[c]).length || 0;
    const bPref = requirements.preferredCapabilities?.filter(c => b.capabilities[c]).length || 0;
    return bPref - aPref;
  });
}
