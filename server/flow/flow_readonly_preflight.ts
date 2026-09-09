import type { FlowReadOnlyDiscoveryResult } from './flow_readonly_worker_contract';

export type FlowPreflightReasonCode = 'PREFLIGHT_CDP_UNAVAILABLE' | 'PREFLIGHT_FLOW_PAGE_INVALID' | 'PREFLIGHT_AUTH_REQUIRED' | 'PREFLIGHT_TARGET_UNAVAILABLE' | 'PREFLIGHT_RUNTIME_SURFACE_UNAVAILABLE' | 'PREFLIGHT_RUNTIME_UNHEALTHY' | 'SAFETY_MUTATION_DETECTED' | 'SAFETY_PAID_SUBMISSION_DETECTED';

export interface FlowReadonlyPreflight {
  status: 'PREFLIGHT_PASS' | 'PREFLIGHT_REJECTED';
  cdpConnected: boolean;
  flowPageValid: boolean;
  authenticated: boolean;
  targetAvailable: boolean;
  runtimeSurfaceAvailable: boolean;
  sessionHealthy: boolean;
  mutationDetected: boolean;
  paidSubmission: boolean;
  reasonCode?: FlowPreflightReasonCode;
  reason?: string;
}

export function assessFlowReadonlyPreflight(result: FlowReadOnlyDiscoveryResult): FlowReadonlyPreflight {
  const base = { cdpConnected: result.transport !== 'WORKER_UNAVAILABLE', flowPageValid: result.transport === 'AUTHENTICATED_PAGE', authenticated: result.status === 'AUTHENTICATED', targetAvailable: result.transport !== 'WORKER_UNAVAILABLE', runtimeSurfaceAvailable: result.transport === 'AUTHENTICATED_PAGE', sessionHealthy: result.status === 'AUTHENTICATED', mutationDetected: result.mutationDetected, paidSubmission: result.paidSubmission };
  if (result.mutationDetected) return { ...base, status: 'PREFLIGHT_REJECTED', reasonCode: 'SAFETY_MUTATION_DETECTED', reason: 'Mutation detected' };
  if (result.paidSubmission) return { ...base, status: 'PREFLIGHT_REJECTED', reasonCode: 'SAFETY_PAID_SUBMISSION_DETECTED', reason: 'Paid submission detected' };
  if (result.transport === 'WORKER_UNAVAILABLE') return { ...base, status: 'PREFLIGHT_REJECTED', reasonCode: 'PREFLIGHT_CDP_UNAVAILABLE', reason: result.reason ?? 'Read-only worker unavailable' };
  if (result.status !== 'AUTHENTICATED') return { ...base, status: 'PREFLIGHT_REJECTED', reasonCode: 'PREFLIGHT_AUTH_REQUIRED', reason: result.reason ?? 'Authentication not proven' };
  return { ...base, status: 'PREFLIGHT_PASS' };
}
