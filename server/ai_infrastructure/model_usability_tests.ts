import assert from 'node:assert/strict';
import { modelUsability } from './model_usability';

modelUsability.clear();
assert.equal(modelUsability.isEligible('google', 'm1'), true);
modelUsability.set('google', 'm1', 'UNAVAILABLE', '404');
assert.equal(modelUsability.isEligible('google', 'm1'), false);
modelUsability.set('google', 'm2', 'QUOTA_EXHAUSTED', 'limit: 0', Date.now() + 60_000);
assert.equal(modelUsability.isEligible('google', 'm2'), false);
modelUsability.set('google', 'm3', 'RATE_LIMITED', '429', Date.now() - 1);
assert.equal(modelUsability.isEligible('google', 'm3'), true);
assert.equal(modelUsability.classify(new Error('HTTP 404 model no longer available')), 'UNAVAILABLE');
assert.equal(modelUsability.classify(new Error('429 RESOURCE_EXHAUSTED quota limit: 0')), 'QUOTA_EXHAUSTED');
console.log('Model usability tests passed');
