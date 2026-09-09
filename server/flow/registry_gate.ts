export type RegistryRejectionCode =
  | 'UNKNOWN_PROVIDER'
  | 'UNKNOWN_MODEL'
  | 'DISABLED_MODEL'
  | 'UNSUPPORTED_CAPABILITY'
  | 'UNSUPPORTED_MODALITY'
  | 'INVALID_DURATION'
  | 'STALE_SNAPSHOT'
  | 'PROVIDER_MODEL_MISMATCH'
  | 'MISSING_CREDENTIAL'
  | 'DISABLED_PROVIDER'
  | 'UNAVAILABLE_ADAPTER'
  | 'EMPTY_PROMPT'
  | 'REGISTRY_CONSTRAINT_INVALID'
  | 'REGISTRY_PRICING_POLICY_MISSING'
  | 'REGISTRY_SNAPSHOT_INVALID'
  | 'REGISTRY_REQUEST_INCOMPLETE';

export interface RegistryModelSnapshot {
  providerId: string;
  modelId: string;
  registryVersion: string;
  enabled: boolean;
  capabilities: readonly string[];
  modalities: readonly string[];
  allowedDurationsSeconds: readonly number[];
  constraintSet: string;
  pricingPolicyVersion: string;
  stale?: boolean;
}

export interface RegistryGateRequest {
  providerId?: string;
  providerKnown?: boolean;
  modelId?: string;
  registryVersion?: string;
  capability?: string;
  modality?: string;
  durationSeconds?: number;
  constraintSet?: string;
  pricingPolicyVersion?: string;
}

export interface RegistryGatePass {
  status: 'REGISTRY_PASS';
  snapshot: RegistryModelSnapshot;
}

export interface RegistryGateReject {
  status: 'REGISTRY_REJECTED';
  reasonCode: RegistryRejectionCode;
  reason: string;
}

export type RegistryGateResult = RegistryGatePass | RegistryGateReject;

export function validateRegistryGate(request: RegistryGateRequest, snapshot?: RegistryModelSnapshot): RegistryGateResult {
  if (!request.providerId || !request.modelId || !request.registryVersion || !request.capability || !request.modality || request.durationSeconds === undefined || !request.constraintSet || !request.pricingPolicyVersion) return { status: 'REGISTRY_REJECTED', reasonCode: 'REGISTRY_REQUEST_INCOMPLETE', reason: 'Registry request metadata incomplete' };
  if (!snapshot) return { status: 'REGISTRY_REJECTED', reasonCode: 'UNKNOWN_MODEL', reason: 'Registry model snapshot unavailable' };
  if (request.providerKnown === false) return { status: 'REGISTRY_REJECTED', reasonCode: 'UNKNOWN_PROVIDER', reason: 'Provider unavailable' };
  if (snapshot.providerId !== request.providerId) return { status: 'REGISTRY_REJECTED', reasonCode: 'PROVIDER_MODEL_MISMATCH', reason: 'Provider does not match registry snapshot' };
  if (snapshot.modelId !== request.modelId) return { status: 'REGISTRY_REJECTED', reasonCode: 'UNKNOWN_MODEL', reason: 'Model does not match registry snapshot' };
  if (snapshot.registryVersion !== request.registryVersion || !snapshot.registryVersion) return { status: 'REGISTRY_REJECTED', reasonCode: 'STALE_SNAPSHOT', reason: 'Registry version mismatch or missing' };
  if (!snapshot.enabled) return { status: 'REGISTRY_REJECTED', reasonCode: 'DISABLED_MODEL', reason: 'Registry model disabled' };
  if (snapshot.stale) return { status: 'REGISTRY_REJECTED', reasonCode: 'STALE_SNAPSHOT', reason: 'Registry metadata stale' };
  if (!snapshot.capabilities.includes(request.capability)) return { status: 'REGISTRY_REJECTED', reasonCode: 'UNSUPPORTED_CAPABILITY', reason: 'Requested capability unsupported' };
  if (!snapshot.modalities.includes(request.modality)) return { status: 'REGISTRY_REJECTED', reasonCode: 'UNSUPPORTED_MODALITY', reason: 'Requested modality unsupported' };
  if (!Number.isFinite(request.durationSeconds) || request.durationSeconds <= 0) return { status: 'REGISTRY_REJECTED', reasonCode: 'INVALID_DURATION', reason: 'Requested duration invalid' };
  if (!snapshot.allowedDurationsSeconds.includes(request.durationSeconds)) return { status: 'REGISTRY_REJECTED', reasonCode: 'INVALID_DURATION', reason: 'Requested duration unsupported' };
  if (snapshot.constraintSet !== request.constraintSet) return { status: 'REGISTRY_REJECTED', reasonCode: 'REGISTRY_CONSTRAINT_INVALID', reason: 'Constraint set mismatch' };
  if (snapshot.pricingPolicyVersion !== request.pricingPolicyVersion) return { status: 'REGISTRY_REJECTED', reasonCode: 'REGISTRY_PRICING_POLICY_MISSING', reason: 'Pricing policy missing or mismatched' };
  return { status: 'REGISTRY_PASS', snapshot: { ...snapshot, capabilities: [...snapshot.capabilities], modalities: [...snapshot.modalities], allowedDurationsSeconds: [...snapshot.allowedDurationsSeconds] } };
}
