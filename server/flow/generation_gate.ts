import { RegistryGatePass, RegistryGateResult, RegistryGateRequest, validateRegistryGate } from './registry_gate';

export type GenerationGateReasonCode = 'PREFLIGHT_REJECTED' | 'REGISTRY_REJECTED' | 'REGISTRY_SNAPSHOT_CHANGED' | 'SAFETY_MUTATION_DETECTED' | 'SAFETY_PAID_SUBMISSION_DETECTED' | 'PREFLIGHT_NOT_READY';

export interface ReadOnlyPreflightEvidence {
  status: 'PREFLIGHT_PASS' | 'PREFLIGHT_REJECTED';
  cdpConnected: boolean;
  flowPageValid: boolean;
  authenticated: boolean;
  targetAvailable: boolean;
  runtimeSurfaceAvailable: boolean;
  sessionHealthy: boolean;
  mutationDetected: boolean;
  paidSubmission: boolean;
  snapshotVersion?: string;
  reasonCode?: GenerationGateReasonCode;
  reason?: string;
}

export interface GenerationGateResult {
  status: 'REGISTRY_REJECTED' | 'PREFLIGHT_REJECTED' | 'READY_FOR_FUTURE_EXECUTION';
  reasonCode?: GenerationGateReasonCode;
  reason?: string;
  registry?: RegistryGatePass;
  preflight?: ReadOnlyPreflightEvidence;
}

export function evaluateGenerationGate(request: RegistryGateRequest, snapshot: Parameters<typeof validateRegistryGate>[1], preflight: ReadOnlyPreflightEvidence): GenerationGateResult {
  const registry = validateRegistryGate(request, snapshot);
  if (registry.status !== 'REGISTRY_PASS') return { status: 'REGISTRY_REJECTED', reason: registry.reason, reasonCode: 'REGISTRY_REJECTED' };
  if (preflight.mutationDetected) return { status: 'PREFLIGHT_REJECTED', reason: 'Mutation detected', reasonCode: 'SAFETY_MUTATION_DETECTED', registry, preflight };
  if (preflight.paidSubmission) return { status: 'PREFLIGHT_REJECTED', reason: 'Paid submission detected', reasonCode: 'SAFETY_PAID_SUBMISSION_DETECTED', registry, preflight };
  if (preflight.status !== 'PREFLIGHT_PASS' || !preflight.cdpConnected || !preflight.flowPageValid || !preflight.authenticated || !preflight.targetAvailable || !preflight.runtimeSurfaceAvailable || !preflight.sessionHealthy) return { status: 'PREFLIGHT_REJECTED', reason: 'Read-only runtime preflight failed', reasonCode: 'PREFLIGHT_NOT_READY', registry, preflight };
  if (preflight.snapshotVersion !== request.registryVersion) return { status: 'PREFLIGHT_REJECTED', reason: 'Registry snapshot changed', reasonCode: 'REGISTRY_SNAPSHOT_CHANGED', registry, preflight };
  return { status: 'READY_FOR_FUTURE_EXECUTION', registry, preflight };
}
