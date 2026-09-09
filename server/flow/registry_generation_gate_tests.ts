import { strict as assert } from 'node:assert';
import { validateRegistryGate } from './registry_gate';
import { evaluateGenerationGate, type ReadOnlyPreflightEvidence } from './generation_gate';

const snapshot = { providerId: 'google-flow', modelId: 'flow-model-x', registryVersion: 'r1', enabled: true, capabilities: ['video'], modalities: ['text-to-video'], allowedDurationsSeconds: [5], constraintSet: 'c1', pricingPolicyVersion: 'p1' } as const;
const request = { providerId: 'google-flow', modelId: 'flow-model-x', registryVersion: 'r1', capability: 'video', modality: 'text-to-video', durationSeconds: 5, constraintSet: 'c1', pricingPolicyVersion: 'p1' };
const preflight: ReadOnlyPreflightEvidence = { status: 'PREFLIGHT_PASS', cdpConnected: true, flowPageValid: true, authenticated: true, targetAvailable: true, runtimeSurfaceAvailable: true, sessionHealthy: true, mutationDetected: false, paidSubmission: false, snapshotVersion: 'r1' };

assert.equal(validateRegistryGate(request, snapshot).status, 'REGISTRY_PASS');
assert.equal(validateRegistryGate({ ...request, modelId: 'missing' }, snapshot).status, 'REGISTRY_REJECTED');
assert.equal(validateRegistryGate({ ...request, capability: 'audio' }, snapshot).status, 'REGISTRY_REJECTED');
assert.equal(validateRegistryGate({ ...request, registryVersion: 'stale' }, snapshot).status, 'REGISTRY_REJECTED');
assert.equal(evaluateGenerationGate(request, snapshot, preflight).status, 'READY_FOR_FUTURE_EXECUTION');
assert.equal(evaluateGenerationGate(request, snapshot, { ...preflight, authenticated: false }).status, 'PREFLIGHT_REJECTED');
assert.equal(evaluateGenerationGate(request, snapshot, { ...preflight, snapshotVersion: 'r2' }).status, 'PREFLIGHT_REJECTED');
assert.equal(evaluateGenerationGate(request, snapshot, { ...preflight, mutationDetected: true }).status, 'PREFLIGHT_REJECTED');
assert.equal(evaluateGenerationGate(request, snapshot, { ...preflight, paidSubmission: true }).status, 'PREFLIGHT_REJECTED');

console.log('Registry and generation gate tests passed; no executor invoked');
