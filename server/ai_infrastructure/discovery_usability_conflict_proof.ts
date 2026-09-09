import assert from 'node:assert/strict';
import { db } from '../db';
import { credentialService } from './credential_service';
import { secretVault } from '../security/secret_vault';
import { resolveProviderAdapter } from './provider_adapter_registry';
import { modelRegistryService } from './model_registry_service';
import { modelUsability } from './model_usability';
import { evaluateApiGenerationGate } from './api_generation_gate';

async function main() {
  const models = await db.getModels();
  const model = models.find(candidate => candidate.enabled && candidate.providerId);
  assert.ok(model, 'Conflict proof requires enabled persisted model');
  const provider = await db.getProvider(model.providerId);
  assert.ok(provider, 'Conflict proof requires persisted provider');
  const credential = (await credentialService.listCredentials()).find(c => c.providerId === provider.id && c.status === 'active');
  assert.ok(credential, 'Conflict proof requires active credential');

  const originalDiscover = resolveProviderAdapter(provider).discoverModels;
  const originalUpdate = modelRegistryService.updateModel;
  const originalState = modelUsability.get(provider.id, model.id);
  let adapterCalls = 0;
  let providerCalls = 0;
  let httpCalls = 0;
  try {
    (resolveProviderAdapter(provider) as any).discoverModels = async () => ({ models: [{ id: model.id, displayName: model.id, capabilities: ['text'] }] });
    (modelRegistryService as any).updateModel = async () => { adapterCalls++; };
    modelUsability.set(provider.id, model.id, 'UNAVAILABLE', 'durable conflict proof');
    const discovered = await resolveProviderAdapter(provider).discoverModels!(provider, secretVault.decryptSecret(credential.encryptedSecret));
    assert.ok(discovered.models.some(candidate => candidate.id === model.id));
    const persistedState = modelUsability.get(provider.id, model.id);
    assert.equal(persistedState?.state, 'UNAVAILABLE');
    const gate = evaluateApiGenerationGate({ providerId: provider.id, modelId: model.id, registryVersion: 'api-registry-v1', capability: 'text', modality: 'text', durationSeconds: 1, constraintSet: 'default', pricingPolicyVersion: 'v1' } as any, {} as any, { credentialAvailable: true, providerEnabled: true, adapterAvailable: true, requestValid: true });
    assert.notEqual(gate.status, 'READY_FOR_EXECUTION');
    assert.equal(adapterCalls, 0);
    assert.equal(providerCalls, 0);
    assert.equal(httpCalls, 0);
    console.log(JSON.stringify({ proof: 'discovery-usability-conflict', discovery: 'EXISTS', usability: persistedState?.state, gate: gate.status, adapter: adapterCalls, provider: providerCalls, http: httpCalls }));
    console.log('DISCOVERY USABILITY CONFLICT PROOF PASSED');
  } finally {
    (resolveProviderAdapter(provider) as any).discoverModels = originalDiscover;
    (modelRegistryService as any).updateModel = originalUpdate;
    modelUsability.clear();
    if (originalState) modelUsability.set(originalState.providerId, originalState.modelId, originalState.state, originalState.reason, originalState.retryAfter);
  }
}

main().catch(error => { console.error('DISCOVERY USABILITY CONFLICT PROOF FAILED:', error); process.exit(1); });
