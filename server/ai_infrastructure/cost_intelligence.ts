import { usageService } from './usage_service';

export interface CostIntelligenceSummary {
  totalTokensToday: number;
  estimatedCostTodayUsd: number;
  dailyBudgetUsd: number;
  dailyBudgetUsedPercentage: number;
  monthlyProjectionUsd: number;
  tokenForecastMonth: number;
  modelBreakdown: Record<string, { tokens: number; costUsd: number }>;
}

// Approximate cost per 1M tokens (USD) for Gemini models
const COST_PER_1M_TOKENS: Record<string, { prompt: number; completion: number }> = {
  'gemini-3.1-flash-lite': { prompt: 0.075, completion: 0.30 },
  'gemini-3.7-flash': { prompt: 0.10, completion: 0.40 },
  'gemini-2.5-pro': { prompt: 1.25, completion: 5.00 },
  'default': { prompt: 0.10, completion: 0.40 },
};

export interface PreExecutionCostEstimate {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUSD: number;
}

export const costIntelligenceService = {
  calculateTotalCosts() {
    const usages = usageService.getInMemoryUsagesSync ? usageService.getInMemoryUsagesSync() : [];
    let totalCostUSD = 0;
    const costByProvider: Record<string, number> = {};
    const costByModel: Record<string, number> = {};
    const costByAgent: Record<string, number> = {};

    for (const u of usages) {
      const promptTok = u.promptTokens || u.inputTokens || 0;
      const compTok = u.completionTokens || u.outputTokens || 0;
      const modelId = u.modelId || u.model || 'default';

      const cost = (promptTok / 1000) * 0.0015 + (compTok / 1000) * 0.006;
      totalCostUSD += cost;
      if (u.providerId) costByProvider[u.providerId] = (costByProvider[u.providerId] || 0) + cost;
      if (modelId) costByModel[modelId] = (costByModel[modelId] || 0) + cost;
      if (u.stage) costByAgent[u.stage] = (costByAgent[u.stage] || 0) + cost;
    }

    return { totalCostUSD, costByProvider, costByModel, costByAgent };
  },

  estimateRequestCost(
    prompt: string,
    systemInstruction?: string,
    modelId?: string,
    complexity: 'low' | 'medium' | 'high' = 'medium'
  ): PreExecutionCostEstimate {
    const inputChars = (prompt || '').length + (systemInstruction || '').length;
    const estimatedInputTokens = Math.max(1, Math.ceil(inputChars / 4));

    let outputMultiplier = 0.5;
    if (complexity === 'high') outputMultiplier = 1.5;
    else if (complexity === 'medium') outputMultiplier = 1.0;

    const estimatedOutputTokens = Math.max(1, Math.ceil(estimatedInputTokens * outputMultiplier));

    const targetModelId = modelId || 'gemini-2.5-flash';
    const pricing = COST_PER_1M_TOKENS[targetModelId] || COST_PER_1M_TOKENS['default'];

    const inputCost = (estimatedInputTokens / 1_000_000) * pricing.prompt;
    const outputCost = (estimatedOutputTokens / 1_000_000) * pricing.completion;

    const baseCost = inputCost + outputCost;
    const estimatedCostUSD = targetModelId.includes('pro') ? Math.max(baseCost, 0.000031) : Math.max(baseCost, 0.000003);

    return {
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCostUSD: Number(estimatedCostUSD.toFixed(6)),
    };
  },

  async getCostSummary(dailyBudgetUsd = 10.0): Promise<CostIntelligenceSummary> {
    const usages = await usageService.listUsage(5000);
    const now = Date.now();
    const startOfToday = new Date().setHours(0, 0, 0, 0);

    const todayUsages = usages.filter(u => u.timestamp >= startOfToday);

    let totalTokensToday = 0;
    let estimatedCostTodayUsd = 0;
    const modelBreakdown: Record<string, { tokens: number; costUsd: number }> = {};

    for (const u of todayUsages) {
      const promptTok = u.promptTokens || 0;
      const compTok = u.completionTokens || 0;
      const totalTok = u.totalTokens || (promptTok + compTok);
      totalTokensToday += totalTok;

      const modelId = u.modelId || 'default';
      const pricing = COST_PER_1M_TOKENS[modelId] || COST_PER_1M_TOKENS['default'];

      const cost = (promptTok / 1_000_000) * pricing.prompt + (compTok / 1_000_000) * pricing.completion;
      estimatedCostTodayUsd += cost;

      if (!modelBreakdown[modelId]) {
        modelBreakdown[modelId] = { tokens: 0, costUsd: 0 };
      }
      modelBreakdown[modelId].tokens += totalTok;
      modelBreakdown[modelId].costUsd += cost;
    }

    const dailyBudgetUsedPercentage = dailyBudgetUsd > 0 ? Math.min(100, Math.round((estimatedCostTodayUsd / dailyBudgetUsd) * 100 * 10) / 10) : 0;
    const monthlyProjectionUsd = Math.round(estimatedCostTodayUsd * 30 * 100) / 100;
    const tokenForecastMonth = totalTokensToday * 30;

    return {
      totalTokensToday,
      estimatedCostTodayUsd: Math.round(estimatedCostTodayUsd * 10000) / 10000,
      dailyBudgetUsd,
      dailyBudgetUsedPercentage,
      monthlyProjectionUsd,
      tokenForecastMonth,
      modelBreakdown,
    };
  },
};

export const costIntelligence = costIntelligenceService;
