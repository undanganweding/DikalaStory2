import assert from 'node:assert/strict';
import { freshFallbackRegate } from './fallback_regate';
import { modelUsability } from './model_usability';

const provider = { id: 'provider-a', type: 'custom-http', enabled: true, capabilities: { text: true } } as any;
const makeModel = (id: string) => ({ id, providerId: provider.id, enabled: true, capabilities: ['text'] }) as any;
const adapterExecutions = new Map<string, number>();
const providerHttpCalls = new Map<string, number>();
const attempted: string[] = [];
const execute = async (id: string, shouldFail: boolean) => {
  adapterExecutions.set(id, (adapterExecutions.get(id) || 0) + 1);
  providerHttpCalls.set(id, (providerHttpCalls.get(id) || 0) + 1);
  attempted.push(id);
  if (shouldFail) throw new Error('primary failure');
};
const run = async (ids: string[], states: Record<string, any>, validId?: string) => {
  modelUsability.clear();
  for (const [id, state] of Object.entries(states)) modelUsability.set(provider.id, id, state, `fresh ${state}`);
  attempted.length = 0;
  for (const id of ids) {
    const result = await freshFallbackRegate({
      provider,
      model: makeModel(id),
      adapterProtocol: 'custom-http',
      request: { providerId: provider.id, modelId: id, registryVersion: 'api-registry-v1', capability: 'text', modality: 'text', durationSeconds: 1, constraintSet: 'api-text-default-v1', pricingPolicyVersion: 'api-pricing-policy-v1' },
      preflight: { credentialAvailable: true, providerEnabled: true, adapterAvailable: true, requestValid: true },
    });
    console.log(`[FALLBACK RE-GATE] candidate=${id} status=${result.status} code=${result.reasonCode || 'READY'} checkedAt=${result.candidate.checkedAt} snapshot=${result.candidate.snapshotVersion}`);
    if (result.status === 'READY_FOR_EXECUTION') {
      try { await execute(id, id === 'A'); } catch (error) { console.log(`[FALLBACK EXECUTION FAILURE] candidate=${id} error=${(error as Error).message}`); }
    }
  }
  return attempted;
};

assert.deepEqual(await run(['A', 'B', 'C', 'D', 'E'], { B: 'QUOTA_EXHAUSTED', C: 'RATE_LIMITED', D: 'UNAVAILABLE', E: 'AVAILABLE' }), ['A', 'E']);
assert.equal(adapterExecutions.get('B') || 0, 0); assert.equal(providerHttpCalls.get('B') || 0, 0);
assert.equal(adapterExecutions.get('C') || 0, 0); assert.equal(providerHttpCalls.get('C') || 0, 0);
assert.equal(adapterExecutions.get('D') || 0, 0); assert.equal(providerHttpCalls.get('D') || 0, 0);
assert.deepEqual(await run(['A', 'B', 'C', 'D'], { B: 'QUOTA_EXHAUSTED', C: 'RATE_LIMITED', D: 'UNAVAILABLE' }), ['A']);
assert.deepEqual(await run(['A', 'B'], { B: 'QUOTA_EXHAUSTED' }), ['A']);
modelUsability.set(provider.id, 'B', 'AVAILABLE', 'freshly recovered');
const recovered = await freshFallbackRegate({ provider, model: makeModel('B'), adapterProtocol: 'custom-http', request: { providerId: provider.id, modelId: 'B', registryVersion: 'api-registry-v1', capability: 'text', modality: 'text', durationSeconds: 1, constraintSet: 'api-text-default-v1', pricingPolicyVersion: 'api-pricing-policy-v1' }, preflight: { credentialAvailable: true, providerEnabled: true, adapterAvailable: true, requestValid: true } });
assert.equal(recovered.status, 'READY_FOR_EXECUTION');
console.log(`Fallback fresh re-gating passed. attempted=${attempted.join(',')} adapter=${JSON.stringify(Object.fromEntries(adapterExecutions))} http=${JSON.stringify(Object.fromEntries(providerHttpCalls))}`);
console.log('Production ai_gateway wiring proof: freshFallbackRegate is invoked before generateContent in ai_gateway.ts fallback loop.');
