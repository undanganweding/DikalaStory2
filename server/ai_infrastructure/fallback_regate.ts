import { createApiGenerationSnapshot, evaluateApiGenerationGate, type ApiGenerationSnapshot, type ApiGenerationPreflight } from './api_generation_gate';
import { modelUsability, type ModelUsabilityRecord } from './model_usability';
import type { RegistryGateRequest } from '../flow/registry_gate';

export interface FreshFallbackCandidate {
  providerId: string;
  modelId: string;
  snapshot: ApiGenerationSnapshot;
  usability: ModelUsabilityRecord | undefined;
  checkedAt: number;
  snapshotVersion: string;
}

export interface FallbackRegateResult {
  candidate: FreshFallbackCandidate;
  status: 'READY_FOR_EXECUTION' | 'REJECTED';
  reasonCode?: string;
  reason?: string;
}

export async function freshFallbackRegate(input: {
  provider: any;
  model: any;
  adapterProtocol: string;
  request: RegistryGateRequest;
  preflight: ApiGenerationPreflight;
}): Promise<FallbackRegateResult> {
  const snapshot = createApiGenerationSnapshot(input.provider, input.model, input.adapterProtocol);
  const usability = modelUsability.get(input.provider.id, input.model.id);
  const checkedAt = Date.now();
  const candidate = { providerId: input.provider.id, modelId: input.model.id, snapshot, usability, checkedAt, snapshotVersion: snapshot.registryVersion };
  if (usability && !modelUsability.isEligible(input.provider.id, input.model.id)) {
    return { candidate, status: 'REJECTED', reasonCode: usability.state, reason: usability.reason || `Fresh usability state ${usability.state}` };
  }
  const gate = evaluateApiGenerationGate(input.request, snapshot, input.preflight);
  if (gate.status !== 'READY_FOR_EXECUTION') return { candidate, status: 'REJECTED', reasonCode: gate.reasonCode, reason: gate.reason };
  return { candidate, status: 'READY_FOR_EXECUTION', reasonCode: undefined, reason: 'Fresh snapshot and usability gate passed' };
}
