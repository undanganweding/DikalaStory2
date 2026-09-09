import { AIModel, AIProvider } from '../../src/types';
import { RegistryModelSnapshot, RegistryGateRequest, RegistryGateResult, validateRegistryGate } from '../flow/registry_gate';

export interface ApiGenerationSnapshot extends RegistryModelSnapshot {
  providerType: string;
  adapterProtocol: string;
}

export interface ApiGenerationPreflight {
  credentialAvailable: boolean;
  providerEnabled: boolean;
  adapterAvailable: boolean;
  requestValid: boolean;
  reason?: string;
}

export interface ApiGenerationGateResult {
  status: 'READY_FOR_EXECUTION' | 'REGISTRY_REJECTED' | 'PREFLIGHT_REJECTED';
  reasonCode?: string;
  reason?: string;
  snapshot?: ApiGenerationSnapshot;
}

const REGISTRY_VERSION = 'api-registry-v1';
const PRICING_POLICY_VERSION = 'api-pricing-policy-v1';
const CONSTRAINT_SET = 'api-text-default-v1';

export function createApiGenerationSnapshot(provider: AIProvider, model: AIModel, adapterProtocol: string): ApiGenerationSnapshot {
  const capabilities = Array.from(new Set([...(model.capabilities || []), 'text']));
  return Object.freeze({
    providerId: provider.id,
    modelId: model.id,
    registryVersion: REGISTRY_VERSION,
    enabled: model.enabled === true && provider.enabled === true,
    capabilities,
    modalities: ['text'],
    allowedDurationsSeconds: [1],
    constraintSet: CONSTRAINT_SET,
    pricingPolicyVersion: PRICING_POLICY_VERSION,
    providerType: provider.type,
    adapterProtocol,
  });
}

export function evaluateApiGenerationGate(
  request: RegistryGateRequest,
  snapshot: ApiGenerationSnapshot | undefined,
  preflight: ApiGenerationPreflight,
): ApiGenerationGateResult {
  const registry: RegistryGateResult = validateRegistryGate(request, snapshot);
  if (registry.status !== 'REGISTRY_PASS') {
    return { status: 'REGISTRY_REJECTED', reasonCode: registry.reasonCode, reason: registry.reason };
  }
  if (!preflight.credentialAvailable || !preflight.providerEnabled || !preflight.adapterAvailable || !preflight.requestValid) {
    const reasonCode = preflight.reason && /^[A-Z_]+$/.test(preflight.reason) ? preflight.reason : 'API_PREFLIGHT_FAILED';
    return { status: 'PREFLIGHT_REJECTED', reasonCode, reason: preflight.reason || 'API runtime preflight failed' };
  }
  return { status: 'READY_FOR_EXECUTION', snapshot };
}

export { CONSTRAINT_SET, PRICING_POLICY_VERSION, REGISTRY_VERSION };
