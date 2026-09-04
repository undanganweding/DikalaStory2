import { ReasoningModelPreferences, ModelReference, TaskTier } from '../src/types';
import { getProviderHealth, isModelAvailable, setProviderHealth, DEFAULT_TASK_PROFILES } from './adaptive_router';
import { credentialManager } from './credential_manager';

// 1. Model Capability Registry
export interface ARMOModelMetadata {
  modelId: string;
  provider: string;
  tier: 'fast_structured' | 'general_reasoning' | 'deep_reasoning';
  capabilities: {
    structured_output: boolean;
    json_schema: boolean;
    long_context: boolean;
    reasoning: boolean;
    image?: boolean;
    audio?: boolean;
  };
  contextWindow: number;
  costWeight: number; // e.g. 1 for flash, 5 for pro
  isRecommended: boolean;
}

export const ARMO_MODEL_REGISTRY: Record<string, ARMOModelMetadata> = {
  // Google Gemini Family
  'gemini-3.8-flash': {
    modelId: 'gemini-3.8-flash',
    provider: 'google',
    tier: 'fast_structured',
    capabilities: { structured_output: true, json_schema: true, long_context: true, reasoning: true },
    contextWindow: 1000000,
    costWeight: 1,
    isRecommended: true,
  },
  'gemini-flash-latest': {
    modelId: 'gemini-flash-latest',
    provider: 'google',
    tier: 'fast_structured',
    capabilities: { structured_output: true, json_schema: true, long_context: true, reasoning: true },
    contextWindow: 1000000,
    costWeight: 1,
    isRecommended: true,
  },
  'gemini-3.7-flash': {
    modelId: 'gemini-3.7-flash',
    provider: 'google',
    tier: 'fast_structured',
    capabilities: { structured_output: true, json_schema: true, long_context: true, reasoning: true },
    contextWindow: 1000000,
    costWeight: 1,
    isRecommended: true,
  },
  'gemini-3.6-flash': {
    modelId: 'gemini-3.6-flash',
    provider: 'google',
    tier: 'general_reasoning',
    capabilities: { structured_output: true, json_schema: true, long_context: true, reasoning: true },
    contextWindow: 1000000,
    costWeight: 1.5,
    isRecommended: false,
  },
  'gemini-3.1-pro-preview': {
    modelId: 'gemini-3.1-pro-preview',
    provider: 'google',
    tier: 'deep_reasoning',
    capabilities: { structured_output: true, json_schema: true, long_context: true, reasoning: true },
    contextWindow: 2000000,
    costWeight: 5,
    isRecommended: true,
  },
  'gemini-3.1-flash-lite': {
    modelId: 'gemini-3.1-flash-lite',
    provider: 'google',
    tier: 'fast_structured',
    capabilities: { structured_output: true, json_schema: true, long_context: false, reasoning: false },
    contextWindow: 500000,
    costWeight: 0.5,
    isRecommended: false,
  },
  'gemini-2.5-pro': {
    modelId: 'gemini-2.5-pro',
    provider: 'google',
    tier: 'deep_reasoning',
    capabilities: { structured_output: true, json_schema: true, long_context: true, reasoning: true },
    contextWindow: 1000000,
    costWeight: 4,
    isRecommended: false,
  },
  // OpenAI Family
  'gpt-4o-mini': {
    modelId: 'gpt-4o-mini',
    provider: 'openai',
    tier: 'fast_structured',
    capabilities: { structured_output: true, json_schema: true, long_context: true, reasoning: false },
    contextWindow: 128000,
    costWeight: 1,
    isRecommended: true,
  },
  'gpt-4o': {
    modelId: 'gpt-4o',
    provider: 'openai',
    tier: 'deep_reasoning',
    capabilities: { structured_output: true, json_schema: true, long_context: true, reasoning: true },
    contextWindow: 128000,
    costWeight: 8,
    isRecommended: true,
  },
  'o3-mini': {
    modelId: 'o3-mini',
    provider: 'openai',
    tier: 'deep_reasoning',
    capabilities: { structured_output: true, json_schema: true, long_context: true, reasoning: true },
    contextWindow: 2000000,
    costWeight: 6,
    isRecommended: true,
  },
  // Claude Family
  'claude-3-5-sonnet': {
    modelId: 'claude-3-5-sonnet',
    provider: 'anthropic',
    tier: 'deep_reasoning',
    capabilities: { structured_output: true, json_schema: true, long_context: true, reasoning: true },
    contextWindow: 2000000,
    costWeight: 10,
    isRecommended: true,
  },
  'claude-3-5-haiku': {
    modelId: 'claude-3-5-haiku',
    provider: 'anthropic',
    tier: 'fast_structured',
    capabilities: { structured_output: true, json_schema: true, long_context: true, reasoning: false },
    contextWindow: 200000,
    costWeight: 2,
    isRecommended: true,
  },
};

// 2. Preflight Scanner Report
export interface ModelPreflightStatus {
  modelId: string;
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';
  evidence: string;
}

export interface PreflightReport {
  ready: boolean;
  modelCount: number;
  unhealthyModels: string[];
  activeCredentials: Record<string, number>;
  message: string;
  modelStatuses: ModelPreflightStatus[];
}

export function performPreflightScan(provider: string): PreflightReport {
  const models = Object.values(ARMO_MODEL_REGISTRY).filter((m) => m.provider === provider);
  const unhealthy: string[] = [];
  const modelStatuses: ModelPreflightStatus[] = [];

  for (const m of models) {
    const isAvail = isModelAvailable(provider, m.modelId);
    const history = armoOrchestrator.modelCallHistory.get(m.modelId);

    let status: 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN' = 'UNKNOWN';
    let evidence = 'No active API ping performed; status is UNKNOWN due to lack of prior execution history in current session';

    if (!isAvail) {
      status = 'UNAVAILABLE';
      evidence = `Model is confirmed UNAVAILABLE (rate limited, quota exhausted, or server error in current session history; failures: ${history?.failures || 1})`;
      unhealthy.push(m.modelId);
    } else if (history && history.successes > 0) {
      status = 'AVAILABLE';
      evidence = `Model is confirmed AVAILABLE (validated via successful active runtime call during current session; successes: ${history.successes})`;
    }

    modelStatuses.push({
      modelId: m.modelId,
      status,
      evidence,
    });
  }

  const credentials = credentialManager.getOrderedCandidateCredentials(provider);
  const activeCredsCount = credentials.length;

  return {
    ready: activeCredsCount > 0,
    modelCount: models.length,
    unhealthyModels: unhealthy,
    activeCredentials: { [provider]: activeCredsCount },
    message: activeCredsCount > 0
      ? `Preflight scan passed: ${activeCredsCount} active credentials for provider ${provider}.`
      : `Preflight scan failed: No active credentials for provider ${provider}.`,
    modelStatuses,
  };
}

// 3. Task Weighting
export type ARMOTaskWeight = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export function getTaskWeight(stage: string): ARMOTaskWeight {
  const profile = DEFAULT_TASK_PROFILES[stage];
  if (!profile) return 'MEDIUM';
  if (profile.tier === 'deep_reasoning') {
    return stage === 'S4' || stage === 'S9' ? 'CRITICAL' : 'HIGH';
  }
  if (profile.tier === 'general_reasoning') {
    return 'MEDIUM';
  }
  return 'LOW';
}

// 4. Directional Rolling
export function getDirectionalRollingSequence(
  provider: string,
  weight: ARMOTaskWeight,
  primaryModelId: string
): string[] {
  const family = Object.values(ARMO_MODEL_REGISTRY)
    .filter((m) => m.provider === provider);

  const primaryMeta = ARMO_MODEL_REGISTRY[primaryModelId] || family[0];

  // Helper to determine capability compatibility
  const satisfiesCompatibility = (m: ARMOModelMetadata): boolean => {
    if (m.modelId === primaryModelId) return true; // Primary is always allowed
    if (weight === 'HIGH' || weight === 'CRITICAL') {
      // Must support reasoning
      return m.capabilities.reasoning === true;
    }
    // LOW or MEDIUM tasks must support structured outputs
    return m.capabilities.structured_output === true;
  };

  // Filter family for compatible candidates
  const compatibleFamily = family.filter(satisfiesCompatibility);

  // Split into primary and remaining compatible candidates
  const remaining = compatibleFamily.filter((m) => m.modelId !== primaryModelId);

  // Rank the remaining candidates based on:
  // capability -> task suitability -> quality/reasoning -> cost
  const rankCandidates = (a: ARMOModelMetadata, b: ARMOModelMetadata): number => {
    const tierRanks: Record<string, number> = {
      'deep_reasoning': 3,
      'general_reasoning': 2,
      'fast_structured': 1,
    };

    const rankA = tierRanks[a.tier] || 1;
    const rankB = tierRanks[b.tier] || 1;

    if (weight === 'HIGH' || weight === 'CRITICAL') {
      // For heavy tasks: prefer higher tier rank first (deep_reasoning -> general_reasoning -> fast_structured)
      if (rankA !== rankB) {
        return rankB - rankA;
      }
      // If same tier rank: descending cost weight (strongest/most expensive first)
      return b.costWeight - a.costWeight;
    } else {
      // For light tasks: prefer lower tier rank first (fast_structured -> general_reasoning -> deep_reasoning)
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      // If same tier rank: ascending cost weight (cheapest first)
      return a.costWeight - b.costWeight;
    }
  };

  // Sort remaining candidates
  const sortedRemaining = remaining.sort(rankCandidates).map((m) => m.modelId);

  return [primaryModelId, ...sortedRemaining];
}

// 5. Quota / Error Classification
export type ARMOErrorType =
  | 'rate_limit'
  | 'quota_exhaustion'
  | 'provider_overload'
  | 'auth_failure'
  | 'unavailable'
  | 'unknown';

export function classifyARMOError(err: any): ARMOErrorType {
  const msg = (typeof err === 'string' ? err : (err?.message || JSON.stringify(err) || '')).toLowerCase();
  const status = err?.status || err?.code || err?.statusCode || err?.error?.code || err?.error?.status;

  if (status === 401 || status === 403 || msg.includes('api key') || msg.includes('unauthorized') || msg.includes('invalid credentials')) {
    return 'auth_failure';
  }
  if (status === 429) {
    if (msg.includes('quota') || msg.includes('exhausted')) {
      return 'quota_exhaustion';
    }
    return 'rate_limit';
  }
  if (
    status === 503 ||
    status === 'UNAVAILABLE' ||
    msg.includes('503') ||
    msg.includes('overloaded') ||
    msg.includes('high demand') ||
    msg.includes('spikes in demand') ||
    msg.includes('resource exhausted')
  ) {
    return 'provider_overload';
  }
  if (status === 504 || status === 502 || msg.includes('unavailable') || msg.includes('timeout')) {
    return 'unavailable';
  }
  return 'unknown';
}

// 6. Runtime Truth Telemetry Output
export function logTelemetry(entry: {
  runId: string;
  stage: string;
  attempt: number;
  requestedModel: string;
  resolvedModel: string;
  actualModel: string;
  credentialId: string;
  reason: string;
  result: string;
}) {
  const meta = ARMO_MODEL_REGISTRY[entry.actualModel];
  const provider = meta ? meta.provider : 'google';
  const line = `${entry.requestedModel} | ${entry.resolvedModel} | ${entry.actualModel} | ${entry.credentialId || 'N/A'} | ${provider} | ${entry.attempt} | ${entry.reason} | ${entry.result}`;
  console.log(`[ARMO TRACE] ${line}`);
}

// 7. Run-Scoped Availability Snapshot State
export interface RunSnapshot {
  runId: string;
  timestamp: string;
  modelAvailability: Record<string, 'available' | 'rate_limited' | 'degraded' | 'unavailable'>;
  credentialAvailability: Record<string, 'active' | 'cooldown' | 'invalid'>;
  transitions: Array<{
    stage: string;
    attempt: number;
    requestedModel: string;
    resolvedModel: string;
    actualModel: string;
    credentialId: string;
    reason: string;
    result: string;
  }>;
}

class ARMOOrchestrator {
  private activeRuns = new Map<string, RunSnapshot>();
  public modelCallHistory = new Map<string, { successes: number; failures: number }>();

  public createRun(runId: string): RunSnapshot {
    const snapshot: RunSnapshot = {
      runId,
      timestamp: new Date().toISOString(),
      modelAvailability: {},
      credentialAvailability: {},
      transitions: [],
    };

    for (const m of Object.keys(ARMO_MODEL_REGISTRY)) {
      const meta = ARMO_MODEL_REGISTRY[m];
      const health = getProviderHealth(meta.provider, meta.modelId);
      snapshot.modelAvailability[m] =
        health.status === 'rate_limited'
          ? 'rate_limited'
          : health.status === 'temporarily_unavailable'
          ? 'unavailable'
          : 'available';
    }

    this.activeRuns.set(runId, snapshot);
    return snapshot;
  }

  public getOrCreateRun(runId: string): RunSnapshot {
    let run = this.activeRuns.get(runId);
    if (!run) {
      run = this.createRun(runId);
    }
    return run;
  }

  public updateModelHealth(runId: string, provider: string, modelId: string, status: 'available' | 'rate_limited' | 'degraded' | 'unavailable') {
    const run = this.getOrCreateRun(runId);
    run.modelAvailability[modelId] = status;
    setProviderHealth(
      provider,
      modelId,
      status === 'rate_limited' ? 'rate_limited' : status === 'unavailable' ? 'temporarily_unavailable' : 'available'
    );
  }

  public recordTransition(
    runId: string,
    stage: string,
    attempt: number,
    requestedModel: string,
    resolvedModel: string,
    actualModel: string,
    credentialId: string,
    reason: string,
    result: string
  ) {
    const run = this.getOrCreateRun(runId);
    const entry = {
      stage,
      attempt,
      requestedModel,
      resolvedModel,
      actualModel,
      credentialId,
      reason,
      result,
    };
    run.transitions.push(entry);

    const history = this.modelCallHistory.get(actualModel) || { successes: 0, failures: 0 };
    if (result === 'SUCCESS') {
      history.successes++;
    } else {
      history.failures++;
    }
    this.modelCallHistory.set(actualModel, history);

    logTelemetry({ runId, ...entry });
  }

  public getRun(runId: string): RunSnapshot | undefined {
    return this.activeRuns.get(runId);
  }
}

export const armoOrchestrator = new ARMOOrchestrator();
