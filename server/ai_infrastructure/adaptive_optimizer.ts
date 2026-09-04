import { observabilityService } from './observability_service';
import { adaptiveMemoryService } from './adaptive_memory';

export interface ModelPerformanceScore {
  modelId: string;
  taskClass: string;

  qualityScore: number;
  reliabilityScore: number;
  costEfficiencyScore: number;
  latencyScore: number;

  overallScore: number;
  learningScore: number;
  confidenceScore: number;
}

export class AdaptiveOptimizer {
  getLearningScore(modelId: string, taskClass: string = 'general'): number {
    const memory = adaptiveMemoryService.get(modelId, taskClass);
    return memory ? memory.averageScore : 82;
  }

  calculateModelScore(
    modelId: string,
    taskClass: string = 'general'
  ): ModelPerformanceScore {
    const records = observabilityService
      .getRecords()
      .filter(
        r => r.model === modelId || r.selectedCandidate === modelId
      );

    const memoryRecord = adaptiveMemoryService.get(modelId, taskClass);

    if (records.length === 0) {
      const baselineScore = memoryRecord ? memoryRecord.averageScore : 82;
      const confidence = memoryRecord ? Math.min(memoryRecord.sampleCount, 100) : 0;

      return {
        modelId,
        taskClass,

        qualityScore: 80,
        reliabilityScore: 100,
        costEfficiencyScore: 80,
        latencyScore: 80,

        overallScore: baselineScore,
        learningScore: baselineScore,
        confidenceScore: confidence,
      };
    }

    const totalCalls = records.length;

    const successCalls = records.filter(r => r.status === 'success').length;
    const errorCalls = records.filter(r => r.status === 'error').length;
    const fallbackCount = records.filter(r => r.fallbackReason).length;

    const reliabilityScore = Math.max(
      0,
      Math.min(100, (successCalls / totalCalls) * 100)
    );

    const qualityScore = Math.max(
      0,
      Math.min(
        100,
        90 -
          ((fallbackCount / totalCalls) * 20) -
          ((errorCalls / totalCalls) * 40)
      )
    );

    const avgLatency =
      records.reduce((sum, r) => sum + (r.latencyMs || 0), 0) / totalCalls;

    const latencyScore = Math.max(
      10,
      Math.min(100, 110 - avgLatency / 50)
    );

    const avgCost =
      records.reduce((sum, r) => sum + (r.estimatedCostUSD || 0.001), 0) /
      totalCalls;

    const costEfficiencyScore = Math.max(
      10,
      Math.min(100, 100 - avgCost * 10000)
    );

    const currentScore = Math.round(
      qualityScore * 0.4 +
        reliabilityScore * 0.25 +
        costEfficiencyScore * 0.2 +
        latencyScore * 0.15
    );

    // Update Adaptive Memory with EMA (Exponential Moving Average)
    const updatedMemory = adaptiveMemoryService.update(
      modelId,
      taskClass,
      currentScore,
      qualityScore,
      reliabilityScore
    );

    const confidenceScore = Math.min(updatedMemory.sampleCount, 100);

    return {
      modelId,
      taskClass,

      qualityScore: Math.round(qualityScore),
      reliabilityScore: Math.round(reliabilityScore),
      costEfficiencyScore: Math.round(costEfficiencyScore),
      latencyScore: Math.round(latencyScore),

      overallScore: currentScore,
      learningScore: updatedMemory.averageScore,
      confidenceScore,
    };
  }

  getAdaptiveRankingHints(
    taskClass: string,
    candidateModelIds: string[]
  ): Record<string, number> {
    const result: Record<string, number> = {};

    for (const modelId of candidateModelIds) {
      result[modelId] = this.calculateModelScore(modelId, taskClass).learningScore;
    }

    return result;
  }
}

export const adaptiveOptimizer = new AdaptiveOptimizer();
