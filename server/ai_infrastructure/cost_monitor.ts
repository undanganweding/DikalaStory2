import { costIntelligenceService } from './cost_intelligence';

export interface CostRecord {
  projectId: string;
  episodeId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  timestamp: number;
}

export type BudgetState = 'NORMAL' | 'WARNING' | 'CONSTRAINED' | 'LOCKED';

export interface BudgetStateDetails {
  state: BudgetState;
  consumedPercentage: number;
  currentUSD: number;
  capUSD: number;
  agentName?: string;
}

const costLedger: Map<string, CostRecord[]> = new Map();

// Standard cost per 1k tokens (approximate model pricing)
const COST_PER_1K_PROMPT = 0.00015;
const COST_PER_1K_COMPLETION = 0.00060;

let globalCapUSD = 50.0;

export const costMonitor = {
  setGlobalBudgetCap(capUSD: number) {
    globalCapUSD = capUSD;
  },

  getBudgetState(agentName?: string): BudgetStateDetails {
    const summary = costIntelligenceService.calculateTotalCosts();
    const cap = globalCapUSD;
    const current = summary.totalCostUSD || 0;

    const consumedPercentage = cap > 0 ? (current / cap) * 100 : 0;

    let state: BudgetState = 'NORMAL';
    if (consumedPercentage >= 95) {
      state = 'LOCKED';
    } else if (consumedPercentage >= 85) {
      state = 'CONSTRAINED';
    } else if (consumedPercentage >= 70) {
      state = 'WARNING';
    }

    return {
      state,
      consumedPercentage: Number(consumedPercentage.toFixed(2)),
      currentUSD: current,
      capUSD: cap,
      agentName,
    };
  },
  async recordUsage(projectId: string, episodeId: string, model: string, promptTokens: number, completionTokens: number): Promise<number> {
    const key = `${projectId}:${episodeId}`;
    const records = costLedger.get(key) || [];

    const cost = (promptTokens / 1000) * COST_PER_1K_PROMPT + (completionTokens / 1000) * COST_PER_1K_COMPLETION;

    records.push({
      projectId,
      episodeId,
      model,
      promptTokens,
      completionTokens,
      estimatedCostUsd: cost,
      timestamp: Date.now(),
    });

    costLedger.set(key, records);
    return cost;
  },

  async getTotalCost(projectId: string, episodeId: string): Promise<{ totalCostUsd: number; totalTokens: number; recordsCount: number }> {
    const key = `${projectId}:${episodeId}`;
    const records = costLedger.get(key) || [];

    let totalCostUsd = 0;
    let totalTokens = 0;

    for (const r of records) {
      totalCostUsd += r.estimatedCostUsd;
      totalTokens += r.promptTokens + r.completionTokens;
    }

    return {
      totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
      totalTokens,
      recordsCount: records.length,
    };
  },
};
