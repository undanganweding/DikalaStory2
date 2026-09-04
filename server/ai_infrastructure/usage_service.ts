import { AIUsage } from '../../src/types';
import { db } from '../db';

const inMemoryUsages: AIUsage[] = [];

export const usageService = {
  async recordUsage(data: Omit<AIUsage, 'id' | 'timestamp'>): Promise<AIUsage> {
    const id = `usage_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const usage: AIUsage = {
      ...data,
      id,
      timestamp: Date.now(),
    };
    inMemoryUsages.push(usage);
    try {
      await db.saveUsage(usage);
    } catch {}
    return usage;
  },

  async listUsage(limitCount: number = 100): Promise<AIUsage[]> {
    try {
      const dbUsages = await db.getUsages(limitCount);
      if (dbUsages && dbUsages.length > 0) return dbUsages;
    } catch {}
    return inMemoryUsages.slice(-limitCount);
  },

  async clearUsage(): Promise<boolean> {
    inMemoryUsages.length = 0;
    try {
      await db.clearUsages();
    } catch {}
    return true;
  },

  getInMemoryUsagesSync(): AIUsage[] {
    return inMemoryUsages;
  },

  async getUsageStats(): Promise<{ totalTokens: number; totalRequests: number; successRate: number }> {
    const usages = await db.getUsages(1000);
    const totalRequests = usages.length;
    if (totalRequests === 0) return { totalTokens: 0, totalRequests: 0, successRate: 100 };

    let totalTokens = 0;
    let successCount = 0;

    for (const u of usages) {
      totalTokens += u.totalTokens || ((u.promptTokens || 0) + (u.completionTokens || 0));
      if (u.success) successCount++;
    }

    const successRate = Math.round((successCount / totalRequests) * 100);
    return { totalTokens, totalRequests, successRate };
  },
};
