export interface ProductionMetricsSnapshot {
  projectId: string;
  episodeId: string;
  timestamp: number;
  progressPercentage: number;
  scenesCompleted: number;
  totalScenes: number;
  shotsCompleted: number;
  totalShots: number;
  assetsGenerated: number;
  totalCostUsd: number;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  failedJobsCount: number;
  retryCount: number;
  currentBottleneck?: string;
  etaMinutes: number;
}

const metricsStore: Map<string, ProductionMetricsSnapshot> = new Map();

export const productionMetrics = {
  async updateMetrics(projectId: string, episodeId: string, updates: Partial<ProductionMetricsSnapshot>): Promise<ProductionMetricsSnapshot> {
    const key = `${projectId}:${episodeId}`;
    let current = metricsStore.get(key) || {
      projectId,
      episodeId,
      timestamp: Date.now(),
      progressPercentage: 0,
      scenesCompleted: 0,
      totalScenes: 0,
      shotsCompleted: 0,
      totalShots: 0,
      assetsGenerated: 0,
      totalCostUsd: 0.0,
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      failedJobsCount: 0,
      retryCount: 0,
      etaMinutes: 0,
    };

    current = {
      ...current,
      ...updates,
      timestamp: Date.now(),
    };

    metricsStore.set(key, current);
    return current;
  },

  async getMetrics(projectId: string, episodeId: string): Promise<ProductionMetricsSnapshot | null> {
    const key = `${projectId}:${episodeId}`;
    return metricsStore.get(key) || null;
  },
};
