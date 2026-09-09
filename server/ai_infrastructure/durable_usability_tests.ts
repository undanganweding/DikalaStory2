import assert from 'node:assert/strict';
import { modelUsability } from './model_usability';

modelUsability.clear();
const failed = modelUsability.set('test-provider', 'test-model', 'UNAVAILABLE', 'HTTP 404', Date.now() + 60_000);
assert.equal(modelUsability.isEligible('test-provider', 'test-model'), false);
modelUsability.clear();
modelUsability.loadFromModels([{ id: 'test-model', providerId: 'test-provider', usabilityState: failed.state, usabilityReason: failed.reason, retryAfter: failed.retryAfter, lastProbeAt: failed.checkedAt }]);
assert.equal(modelUsability.isEligible('test-provider', 'test-model'), false);
modelUsability.set('test-provider', 'test-model', 'AVAILABLE', 'Probe succeeded');
assert.equal(modelUsability.isEligible('test-provider', 'test-model'), true);
modelUsability.set('test-provider', 'present-model', 'UNAVAILABLE', 'Runtime failure', Date.now() + 60_000);
modelUsability.loadFromModels([{ id: 'present-model', providerId: 'test-provider', usabilityState: 'UNAVAILABLE', usabilityReason: 'Runtime failure', retryAfter: Date.now() + 60_000 }]);
assert.equal(modelUsability.isEligible('test-provider', 'present-model'), false);
console.log('Durable usability lifecycle tests passed');
