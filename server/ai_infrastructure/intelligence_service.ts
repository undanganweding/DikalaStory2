import { credentialService } from './credential_service';
import { healthService } from './health_service';
import { usageService } from './usage_service';

export interface CredentialIntelligence {
  credentialId: string;
  name: string;
  providerId: string;
  maskedKey: string;
  status: string;
  health: {
    status: 'healthy' | 'degraded' | 'down';
    consecutiveFailures: number;
    successRate: number;
    cooldownUntil?: number;
    cooldownRemainingSec?: number;
    lastError?: string;
  };
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    rateLimitHits: number;
    totalTokens: number;
    avgLatencyMs: number;
  };
}

export const intelligenceService = {
  async getCredentialIntelligence(credentialId: string): Promise<CredentialIntelligence | null> {
    const cred = await credentialService.getCredential(credentialId);
    if (!cred) return null;

    const health = await healthService.getHealth(credentialId);
    const usages = await usageService.listUsage(500);
    const credUsages = usages.filter(u => u.credentialId === credentialId);

    const totalRequests = credUsages.length;
    const successfulRequests = credUsages.filter(u => u.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const rateLimitHits = credUsages.filter(u => u.errorType === 'rate_limit' || (u.errorType && u.errorType.includes('429'))).length;

    let totalTokens = 0;
    let totalLatency = 0;

    for (const u of credUsages) {
      totalTokens += u.totalTokens || ((u.promptTokens || 0) + (u.completionTokens || 0));
      totalLatency += u.latencyMs || 0;
    }

    const avgLatencyMs = totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0;
    
    let cooldownRemainingSec: number | undefined = undefined;
    if (health.cooldownUntil && health.cooldownUntil > Date.now()) {
      cooldownRemainingSec = Math.ceil((health.cooldownUntil - Date.now()) / 1000);
    }

    return {
      credentialId: cred.id,
      name: cred.name,
      providerId: cred.providerId,
      maskedKey: cred.maskedKey,
      status: cred.status,
      health: {
        status: health.status,
        consecutiveFailures: health.consecutiveFailures,
        successRate: health.successRate,
        cooldownUntil: health.cooldownUntil,
        cooldownRemainingSec,
        lastError: health.lastError,
      },
      metrics: {
        totalRequests,
        successfulRequests,
        failedRequests,
        rateLimitHits,
        totalTokens,
        avgLatencyMs,
      },
    };
  },

  async getAllCredentialsIntelligence(): Promise<CredentialIntelligence[]> {
    const creds = await credentialService.listCredentials();
    const results: CredentialIntelligence[] = [];
    for (const cred of creds) {
      const intel = await this.getCredentialIntelligence(cred.id);
      if (intel) {
        results.push(intel);
      }
    }
    return results;
  },

  async getDashboardOverview(): Promise<{
    totalTokensUsed: number;
    totalRequests: number;
    overallSuccessRate: number;
    healthyCount: number;
    cooldownCount: number;
    downCount: number;
    credentials: CredentialIntelligence[];
  }> {
    const credentials = await this.getAllCredentialsIntelligence();
    let totalTokensUsed = 0;
    let totalRequests = 0;
    let totalSuccess = 0;
    let healthyCount = 0;
    let cooldownCount = 0;
    let downCount = 0;

    for (const c of credentials) {
      totalTokensUsed += c.metrics.totalTokens;
      totalRequests += c.metrics.totalRequests;
      totalSuccess += c.metrics.successfulRequests;

      if (c.health.status === 'healthy' && !c.health.cooldownRemainingSec) {
        healthyCount++;
      } else if (c.health.cooldownRemainingSec) {
        cooldownCount++;
      } else if (c.health.status === 'down' || c.health.status === 'degraded') {
        downCount++;
      } else {
        healthyCount++;
      }
    }

    const overallSuccessRate = totalRequests > 0 ? Math.round((totalSuccess / totalRequests) * 100) : 100;

    return {
      totalTokensUsed,
      totalRequests,
      overallSuccessRate,
      healthyCount,
      cooldownCount,
      downCount,
      credentials,
    };
  },
};
