import assert from 'node:assert/strict';
import { freshFallbackRegate } from './fallback_regate';
import { modelUsability } from './model_usability';

const provider = { id: 'google', type: 'gemini', enabled: true, capabilities: { text: true } } as any;
const counts = new Map<string, number>();
const http = new Map<string, number>();
const execute = (id: string) => { counts.set(id, (counts.get(id) || 0) + 1); http.set(id, (http.get(id) || 0) + 1); };
const gate = async (id: string) => freshFallbackRegate({
  provider,
  model: { id, providerId: 'google', enabled: true, capabilities: ['text'] },
  adapterProtocol: 'google-generative-ai',
  request: { providerId: 'google', modelId: id, registryVersion: 'api-registry-v1', capability: 'text', modality: 'text', durationSeconds: 1, constraintSet: 'api-text-default-v1', pricingPolicyVersion: 'api-pricing-policy-v1' },
  preflight: { credentialAvailable: true, providerEnabled: true, adapterAvailable: true, requestValid: true },
});

modelUsability.clear();
modelUsability.set('google', 'B', 'QUOTA_EXHAUSTED', 'retry quota exhausted');
modelUsability.set('google', 'C', 'RATE_LIMITED', 'retry rate limited');
modelUsability.set('google', 'D', 'UNAVAILABLE', 'retry unavailable');
for (const id of ['A', 'B', 'C', 'D', 'E']) {
  const result = await gate(id);
  console.log(`[AI RETRY FRESH REGATE] candidate=${id} status=${result.status} code=${result.reasonCode || 'READY'} checkedAt=${result.candidate.checkedAt}`);
  if (result.status === 'READY_FOR_EXECUTION') execute(id);
}
assert.equal(counts.get('A'), 1);
assert.equal(counts.get('B') || 0, 0);
assert.equal(counts.get('C') || 0, 0);
assert.equal(counts.get('D') || 0, 0);
assert.equal(counts.get('E'), 1);
assert.equal(http.get('B') || 0, 0);
assert.equal(http.get('C') || 0, 0);
assert.equal(http.get('D') || 0, 0);

modelUsability.set('google', 'E', 'UNAVAILABLE', 'became invalid after initial snapshot');
const invalidated = await gate('E');
assert.equal(invalidated.status, 'REJECTED');
assert.equal(counts.get('E'), 1);
modelUsability.set('google', 'E', 'AVAILABLE', 'freshly recovered');
const recovered = await gate('E');
assert.equal(recovered.status, 'READY_FOR_EXECUTION');
execute('E');
assert.equal(counts.get('E'), 2);

console.log(`Production retry fresh re-gating passed. counts=${JSON.stringify(Object.fromEntries(counts))} http=${JSON.stringify(Object.fromEntries(http))}`);
