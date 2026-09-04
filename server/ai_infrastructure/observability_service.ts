import { usageService } from './usage_service';

export interface AIRequestLog {
  requestId: string;
  agentName: string;
  taskType: string;
  provider: string;
  credentialId: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  latencyMs: number;
  success: boolean;
  error?: string;
  timestamp: number;
}

export interface AITelemetryLog {
  requestId: string;
  agentName: string;
  taskType: string;
  requestedModel: string;
  resolvedModel: string;
  providerId: string;
  credentialId: string;
  eligibilityResult: {
    totalEnabledProviders: number;
    eligibleProviderIds: string[];
  };
  capabilityResult: {
    capableProviderIds: string[];
    mismatches?: Array<{ providerId: string; reason: string }>;
  };
  attempts: number;
  failoverCount: number;
  cooldownTriggered: boolean;
  statusCode?: number;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  latencyMs: number;
  success: boolean;
  error?: string;
  timestamp: number;
}

export interface TelemetrySummaryMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  overallSuccessRate: number;
  averageLatencyMs: number;
  totalTokensUsed: number;
  totalFailovers: number;
  providerBreakdown: Record<string, { requests: number; successes: number; failures: number; tokens: number }>;
  modelBreakdown: Record<string, { requests: number; successes: number; avgLatencyMs: number }>;
  statusCodeBreakdown: Record<number, number>;
}

export interface TelemetryRecord {
  traceId: string;
  spanId: string;
  agentName: string;
  taskType: string;
  providerId: string;
  model: string;
  status: 'success' | 'error';
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  errorMessage?: string;
  timestamp?: number;
  originalTask?: string;
  classifiedIntent?: any;
  selectedCandidate?: string;
  fallbackReason?: string;
  routingSource?: 'explicit_override' | 'intelligence_router' | 'default_fallback';
  estimatedCostUSD?: number;
  budgetState?: string;
  downgradeReason?: string;
  adaptiveScore?: number;
  learningScore?: number;
  confidenceScore?: number;
  optimizationReason?: string;
  decisionConfidence?: number;
  decisionFactors?: any[];
  decisionExplanation?: string;
}

const memoryLogs: AIRequestLog[] = [];
const telemetryLogs: AITelemetryLog[] = [];
const telemetryRecords: TelemetryRecord[] = [];

export const observabilityService = {
  recordTelemetry(record: TelemetryRecord) {
    telemetryRecords.push({
      ...record,
      timestamp: record.timestamp || Date.now(),
    });
  },

  getRecords(): TelemetryRecord[] {
    return telemetryRecords;
  },

  clearRecords() {
    telemetryRecords.length = 0;
  },
  /**
   * Log legacy request (kept for backward compatibility)
   */
  async logRequest(log: AIRequestLog): Promise<void> {
    try {
      memoryLogs.unshift(log);
      if (memoryLogs.length > 1000) {
        memoryLogs.pop();
      }
      await usageService.recordUsage({
        credentialId: log.credentialId,
        modelId: log.provider,
        requestType: log.taskType,
        stage: log.agentName,
        promptTokens: log.tokens.prompt,
        completionTokens: log.tokens.completion,
        totalTokens: log.tokens.total,
        latencyMs: log.latencyMs,
        success: log.success,
        errorType: log.error,
      });
    } catch (err) {
      console.error('[Observability] Passive logRequest failed:', err);
    }
  },

  /**
   * Log full Control Plane Telemetry trace.
   * STRICT PRINCIPLE: Must be a passive observer. Exceptions must be caught silently.
   */
  async logTelemetry(log: AITelemetryLog): Promise<void> {
    try {
      telemetryLogs.unshift(log);
      if (telemetryLogs.length > 2000) {
        telemetryLogs.pop();
      }

      // Also populate legacy log array for backward compatibility
      memoryLogs.unshift({
        requestId: log.requestId,
        agentName: log.agentName,
        taskType: log.taskType,
        provider: log.providerId,
        credentialId: log.credentialId,
        tokens: log.tokens,
        latencyMs: log.latencyMs,
        success: log.success,
        error: log.error,
        timestamp: log.timestamp,
      });
      if (memoryLogs.length > 1000) {
        memoryLogs.pop();
      }
    } catch (err) {
      console.error('[Observability] Passive logTelemetry failed:', err);
    }
  },

  /**
   * List legacy logs
   */
  async listLogs(limit = 100): Promise<AIRequestLog[]> {
    return memoryLogs.slice(0, limit);
  },

  /**
   * List telemetry logs with optional filtering
   */
  async listTelemetry(filters?: {
    limit?: number;
    agentName?: string;
    providerId?: string;
    modelId?: string;
    success?: boolean;
  }): Promise<AITelemetryLog[]> {
    let result = [...telemetryLogs];
    if (filters) {
      if (filters.agentName) {
        result = result.filter(l => l.agentName === filters.agentName);
      }
      if (filters.providerId) {
        result = result.filter(l => l.providerId === filters.providerId);
      }
      if (filters.modelId) {
        result = result.filter(l => l.requestedModel === filters.modelId || l.resolvedModel === filters.modelId);
      }
      if (filters.success !== undefined) {
        result = result.filter(l => l.success === filters.success);
      }
      if (filters.limit && filters.limit > 0) {
        result = result.slice(0, filters.limit);
      }
    }
    return result;
  },

  async getLogsByAgent(agentName: string, limit = 50): Promise<AIRequestLog[]> {
    return memoryLogs.filter(l => l.agentName === agentName).slice(0, limit);
  },

  async getLogsByCredential(credentialId: string, limit = 50): Promise<AIRequestLog[]> {
    return memoryLogs.filter(l => l.credentialId === credentialId).slice(0, limit);
  },

  /**
   * Calculate aggregated telemetry summary metrics for Control Plane Observability
   */
  async getSummaryMetrics(): Promise<TelemetrySummaryMetrics> {
    const totalRequests = telemetryLogs.length;
    let successfulRequests = 0;
    let failedRequests = 0;
    let totalLatencyMs = 0;
    let totalTokensUsed = 0;
    let totalFailovers = 0;

    const providerBreakdown: Record<string, { requests: number; successes: number; failures: number; tokens: number }> = {};
    const modelBreakdown: Record<string, { requests: number; successes: number; totalLatencyMs: number; avgLatencyMs: number }> = {};
    const statusCodeBreakdown: Record<number, number> = {};

    for (const log of telemetryLogs) {
      if (log.success) {
        successfulRequests++;
      } else {
        failedRequests++;
      }

      totalLatencyMs += log.latencyMs;
      totalTokensUsed += log.tokens.total;
      totalFailovers += log.failoverCount;

      if (log.statusCode) {
        statusCodeBreakdown[log.statusCode] = (statusCodeBreakdown[log.statusCode] || 0) + 1;
      }

      // Provider breakdown
      const pId = log.providerId || 'unknown';
      if (!providerBreakdown[pId]) {
        providerBreakdown[pId] = { requests: 0, successes: 0, failures: 0, tokens: 0 };
      }
      providerBreakdown[pId].requests++;
      if (log.success) providerBreakdown[pId].successes++;
      else providerBreakdown[pId].failures++;
      providerBreakdown[pId].tokens += log.tokens.total;

      // Model breakdown
      const mId = log.resolvedModel || log.requestedModel || 'unknown';
      if (!modelBreakdown[mId]) {
        modelBreakdown[mId] = { requests: 0, successes: 0, totalLatencyMs: 0, avgLatencyMs: 0 };
      }
      modelBreakdown[mId].requests++;
      if (log.success) modelBreakdown[mId].successes++;
      modelBreakdown[mId].totalLatencyMs += log.latencyMs;
    }

    // Calculate model average latencies
    const formattedModelBreakdown: Record<string, { requests: number; successes: number; avgLatencyMs: number }> = {};
    for (const [mKey, mData] of Object.entries(modelBreakdown)) {
      formattedModelBreakdown[mKey] = {
        requests: mData.requests,
        successes: mData.successes,
        avgLatencyMs: mData.requests > 0 ? Math.round(mData.totalLatencyMs / mData.requests) : 0,
      };
    }

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      overallSuccessRate: totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 1000) / 10 : 100,
      averageLatencyMs: totalRequests > 0 ? Math.round(totalLatencyMs / totalRequests) : 0,
      totalTokensUsed,
      totalFailovers,
      providerBreakdown,
      modelBreakdown: formattedModelBreakdown,
      statusCodeBreakdown,
    };
  },

  /**
   * Clear all telemetry logs (useful for isolation in tests)
   */
  async clearTelemetry(): Promise<void> {
    telemetryLogs.length = 0;
    memoryLogs.length = 0;
  },
};

