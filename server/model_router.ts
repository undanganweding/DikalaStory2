import { AVAILABLE_MODELS, GeminiModelInfo } from './gemini';
import { getProviderHealth } from './adaptive_router';
import { credentialManager } from './credential_manager';

export type TaskType = 'research' | 'narrative' | 'scene' | 'image' | 'tts' | 'general';
export type Complexity = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export interface RouterLogEntry {
  task: TaskType;
  complexity: Complexity;
  selected_model: string;
  attempt: number;
  fallback_reason?: string;
  latency: number;
  status: 'success' | 'fallback' | 'failed';
}

interface RankedModel {
  info: GeminiModelInfo;
  provider: string;
  score: number;
}

class ModelRouter {
  private log: RouterLogEntry[] = [];

  private scoreModel(model: GeminiModelInfo, task: TaskType, complexity: Complexity): number {
    let score = 0;
    
    // Capability Check
    if (task === 'image' && !model.capabilities.image) return -1000;
    if (task === 'tts' && !model.capabilities.audio) return -1000;
    if (task === 'research' && !model.capabilities.reasoning) return -500;
    
    // Tier/Quality Scoring + Complexity Affinity
    const isHighComplexity = ['HIGH', 'VERY_HIGH'].includes(complexity);
    
    if (isHighComplexity) {
      if (model.tier === 'pro') score += 1000;
      else score += 100;
    } else {
      if (model.tier === 'flash') score += 500;
      else score += 300;
    }
    
    // Task Affinity
    if (['research', 'narrative'].includes(task)) {
        if (model.tier === 'pro') score += 500;
        else score += 200;
    }
    
    // Runtime Health/Recommendation
    const health = getProviderHealth('google', model.id);
    if (health.status === 'rate_limited') score -= 5000;
    if (health.status === 'temporarily_unavailable') score -= 10000;
    
    if (model.isRecommended) score += 100;
    
    return score;
  }

  // Routing matrix: Task -> Capability Requirements -> Ranked Models
  private getRankedModelsForTask(task: TaskType, complexity: Complexity): RankedModel[] {
    const models = [...AVAILABLE_MODELS.map(m => ({ 
        info: m, 
        provider: 'google', 
        score: this.scoreModel(m, task, complexity) 
    }))];
    
    return models.sort((a, b) => b.score - a.score);
  }

  public async getBestModel(task: TaskType, complexity: Complexity = 'MEDIUM', attempt: number = 1): Promise<{ modelId: string; provider: string }> {
    const ranked = this.getRankedModelsForTask(task, complexity);
    
    // Filter healthy models AND models with available credentials
    const validModels = ranked.filter(m => {
        const health = getProviderHealth(m.provider, m.info.id);
        const credentials = credentialManager.getOrderedCandidateCredentials(m.provider);
        return health.status === 'available' && credentials.length > 0;
    });
    
    // Fallback logic
    const selected = validModels[Math.min(attempt - 1, validModels.length - 1)] || ranked[0];
    
    return { modelId: selected.info.id, provider: selected.provider };
  }

  public logActivity(entry: RouterLogEntry) {
    this.log.push(entry);
    console.log(`[MODEL ROUTER] ${entry.task} | ${entry.complexity} | ${entry.selected_model} | ${entry.attempt} | ${entry.fallback_reason || '-'} | ${entry.latency}ms | ${entry.status}`);
  }

  public getLogs(): RouterLogEntry[] {
    return this.log;
  }
}

export const modelRouter = new ModelRouter();
