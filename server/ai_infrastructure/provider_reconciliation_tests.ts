import assert from 'node:assert/strict';
import { modelUsability } from './model_usability';

modelUsability.clear();
modelUsability.set('google', 'gemini-2.5-pro', 'UNAVAILABLE', '404 unavailable');
assert.equal(modelUsability.isEligible('google', 'gemini-2.5-pro'), false);
modelUsability.set('google', 'gemini-3.1-pro-preview', 'QUOTA_EXHAUSTED', 'limit: 0', Date.now() + 60_000);
assert.equal(modelUsability.isEligible('google', 'gemini-3.1-pro-preview'), false);
modelUsability.set('google', 'gemini-flash-latest', 'AVAILABLE');
assert.equal(modelUsability.isEligible('google', 'gemini-flash-latest'), true);
console.log('Provider reconciliation state tests passed');
