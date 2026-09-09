import assert from 'node:assert/strict';
import { createApiGenerationSnapshot, evaluateApiGenerationGate } from './api_generation_gate';
import { validateRegistryGate, type RegistryGateRequest, type RegistryModelSnapshot } from '../flow/registry_gate';

const snapshot: RegistryModelSnapshot = {
  providerId: 'provider-a',
  modelId: 'model-a',
  registryVersion: 'r1',
  enabled: true,
  capabilities: ['text'],
  modalities: ['text'],
  allowedDurationsSeconds: [1],
  constraintSet: 'c1',
  pricingPolicyVersion: 'p1',
};
const request: RegistryGateRequest = {
  providerId: 'provider-a',
  modelId: 'model-a',
  registryVersion: 'r1',
  capability: 'text',
  modality: 'text',
  durationSeconds: 1,
  constraintSet: 'c1',
  pricingPolicyVersion: 'p1',
};

const provider = { id: 'provider-a', type: 'custom-http', enabled: true, capabilities: { text: true } } as any;
const model = { id: 'model-a', providerId: 'provider-a', enabled: true, capabilities: ['text'] } as any;
const apiSnapshot = createApiGenerationSnapshot(provider, model, 'custom-http');
const apiRequest = { ...request, registryVersion: apiSnapshot.registryVersion, constraintSet: apiSnapshot.constraintSet, pricingPolicyVersion: apiSnapshot.pricingPolicyVersion };
let adapterExecutions = 0;
let providerHttpCalls = 0;
const reject = (code: string, result: ReturnType<typeof evaluateApiGenerationGate>) => {
  assert.equal(result.status, 'REGISTRY_REJECTED', code);
  assert.equal(result.reasonCode, code);
  assert.equal(adapterExecutions, 0, `${code}: adapter.execute() must not run`);
  assert.equal(providerHttpCalls, 0, `${code}: provider HTTP call must not run`);
};

reject('UNKNOWN_PROVIDER', evaluateApiGenerationGate({ ...request, providerId: 'missing-provider', providerKnown: false }, apiSnapshot, { credentialAvailable: true, providerEnabled: true, adapterAvailable: true, requestValid: true }));
reject('UNKNOWN_MODEL', evaluateApiGenerationGate({ ...request, modelId: 'missing-model' }, apiSnapshot, { credentialAvailable: true, providerEnabled: true, adapterAvailable: true, requestValid: true }));
reject('DISABLED_MODEL', evaluateApiGenerationGate(apiRequest, { ...apiSnapshot, enabled: false }, { credentialAvailable: true, providerEnabled: true, adapterAvailable: true, requestValid: true }));
reject('UNSUPPORTED_CAPABILITY', evaluateApiGenerationGate({ ...apiRequest, capability: 'vision' }, apiSnapshot, { credentialAvailable: true, providerEnabled: true, adapterAvailable: true, requestValid: true }));
reject('UNSUPPORTED_MODALITY', evaluateApiGenerationGate({ ...apiRequest, modality: 'image' }, apiSnapshot, { credentialAvailable: true, providerEnabled: true, adapterAvailable: true, requestValid: true }));
reject('INVALID_DURATION', evaluateApiGenerationGate({ ...apiRequest, durationSeconds: 0 }, apiSnapshot, { credentialAvailable: true, providerEnabled: true, adapterAvailable: true, requestValid: true }));
reject('STALE_SNAPSHOT', evaluateApiGenerationGate(apiRequest, { ...apiSnapshot, stale: true }, { credentialAvailable: true, providerEnabled: true, adapterAvailable: true, requestValid: true }));
reject('PROVIDER_MODEL_MISMATCH', evaluateApiGenerationGate({ ...request, providerId: 'provider-b' }, apiSnapshot, { credentialAvailable: true, providerEnabled: true, adapterAvailable: true, requestValid: true }));

const preflightReject = (code: string, preflight: Parameters<typeof evaluateApiGenerationGate>[2]) => {
  const result = evaluateApiGenerationGate(apiRequest, apiSnapshot, preflight);
  assert.equal(result.status, 'PREFLIGHT_REJECTED', code);
  assert.equal(result.reasonCode, code);
  assert.equal(adapterExecutions, 0);
  assert.equal(providerHttpCalls, 0);
};
preflightReject('MISSING_CREDENTIAL', { credentialAvailable: false, providerEnabled: true, adapterAvailable: true, requestValid: true, reason: 'MISSING_CREDENTIAL' });
preflightReject('DISABLED_PROVIDER', { credentialAvailable: true, providerEnabled: false, adapterAvailable: true, requestValid: true, reason: 'DISABLED_PROVIDER' });
preflightReject('UNAVAILABLE_ADAPTER', { credentialAvailable: true, providerEnabled: true, adapterAvailable: false, requestValid: true, reason: 'UNAVAILABLE_ADAPTER' });
preflightReject('EMPTY_PROMPT', { credentialAvailable: true, providerEnabled: true, adapterAvailable: true, requestValid: false, reason: 'EMPTY_PROMPT' });

// Stale eligibility cannot bypass fresh usability state.
const eligibleSnapshot = { ...apiSnapshot };
const freshState = { credentialAvailable: true, providerEnabled: true, adapterAvailable: true, requestValid: true, reason: 'QUOTA_EXHAUSTED' };
const staleEligibilityGate = evaluateApiGenerationGate(apiRequest, { ...eligibleSnapshot, stale: true }, { ...freshState, adapterAvailable: false, reason: 'STALE_SNAPSHOT' });
assert.equal(staleEligibilityGate.status, 'REGISTRY_REJECTED');
assert.equal(staleEligibilityGate.reasonCode, 'STALE_SNAPSHOT');
assert.equal(adapterExecutions, 0);
assert.equal(providerHttpCalls, 0);

console.log('Negative API gate matrix passed: 12 cases, adapter.execute()=0, provider HTTP=0');
