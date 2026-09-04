export interface AdaptiveMemoryRecord {
  modelId: string;
  taskClass: string;
  sampleCount: number;
  averageScore: number;
  qualityTrend: number;
  reliabilityTrend: number;
  lastUpdated: number;
}

export class AdaptiveMemoryService {
  private memoryMap: Map<string, AdaptiveMemoryRecord> = new Map();

  private getKey(modelId: string, taskClass: string): string {
    return `${modelId}::${taskClass}`;
  }

  update(
    modelId: string,
    taskClass: string,
    currentScore: number,
    qualityScore: number,
    reliabilityScore: number
  ): AdaptiveMemoryRecord {
    const key = this.getKey(modelId, taskClass);
    const existing = this.memoryMap.get(key);

    if (!existing) {
      const newRecord: AdaptiveMemoryRecord = {
        modelId,
        taskClass,
        sampleCount: 1,
        averageScore: Math.round(currentScore),
        qualityTrend: Math.round(qualityScore),
        reliabilityTrend: Math.round(reliabilityScore),
        lastUpdated: Date.now(),
      };
      this.memoryMap.set(key, newRecord);
      return newRecord;
    }

    // Exponential Moving Average (EMA): newScore = (oldScore * 0.7) + (currentScore * 0.3)
    const newAverageScore = Math.round(existing.averageScore * 0.7 + currentScore * 0.3);
    const newQualityTrend = Math.round(existing.qualityTrend * 0.7 + qualityScore * 0.3);
    const newReliabilityTrend = Math.round(existing.reliabilityTrend * 0.7 + reliabilityScore * 0.3);

    const updatedRecord: AdaptiveMemoryRecord = {
      modelId,
      taskClass,
      sampleCount: existing.sampleCount + 1,
      averageScore: newAverageScore,
      qualityTrend: newQualityTrend,
      reliabilityTrend: newReliabilityTrend,
      lastUpdated: Date.now(),
    };

    this.memoryMap.set(key, updatedRecord);
    return updatedRecord;
  }

  get(modelId: string, taskClass: string): AdaptiveMemoryRecord | undefined {
    return this.memoryMap.get(this.getKey(modelId, taskClass));
  }

  getAll(): AdaptiveMemoryRecord[] {
    return Array.from(this.memoryMap.values());
  }

  clear() {
    this.memoryMap.clear();
  }
}

export const adaptiveMemoryService = new AdaptiveMemoryService();
