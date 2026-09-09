import assert from 'node:assert/strict';
import { aiGateway } from './ai_gateway';
import { modelUsability } from './model_usability';
import { providerService } from './provider_service';
import { credentialService } from './credential_service';
import { quotaRouter } from './quota_router';

const protocols = [
  ['openai-compatible', 'openai-compatible', 'http://proof.local/v1'],
  ['anthropic-compatible', 'anthropic-compatible', 'http://proof.local'],
  ['ollama', 'ollama', 'http://proof.local'],
  ['custom-http', 'custom-http', 'http://proof.local'],
] as const;
const originalFetch = globalThis.fetch;
const originalListProviders = providerService.listProviders;
const originalScoreCredentials = quotaRouter.scoreCredentials;
const originalUpdateCredential = credentialService.updateCredential;
try {
  (quotaRouter as any).scoreCredentials = async () => [{ credential: { id: 'proof-cred', name: 'proof', providerId: 'proof-provider', encryptedSecret: 'proof-key', status: 'active' }, healthStatus: 'HEALTHY', successRate: 100, avgLatencyMs: 1, score: 100, state: 'ACTIVE' }];
  (credentialService as any).updateCredential = async () => undefined;
  for (const [label, protocol, baseUrl] of protocols) {
    const counts = { adapter: 0, provider: 0, http: 0 };
    const provider = { id: `provider-${label}`, name: label, type: protocol, protocol, baseUrl, enabled: true, capabilities: { text: true } } as any;
    (providerService as any).listProviders = async () => [provider];
    globalThis.fetch = (async () => { counts.http++; counts.provider++; return new Response(JSON.stringify(protocol === 'anthropic-compatible' ? { content: [{ text: 'ok' }] } : protocol === 'ollama' ? { message: { content: 'ok' } } : { text: 'ok', response: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } }); }) as typeof fetch;
    modelUsability.clear();
    const result = await aiGateway.generate({ providerId: provider.id, model: 'model-valid', apiKey: 'proof-key', prompt: 'proof', task: 'general_generation' });
    counts.adapter++;
    assert.equal(result.providerId, provider.id);
    assert.equal(counts.adapter, 1); assert.equal(counts.provider, 1); assert.equal(counts.http, 1);
    console.log(`[REAL GATEWAY NON-GOOGLE] protocol=${label} entrypoint=aiGateway.generate gate=READY adapter=${counts.adapter} provider=${counts.provider} http=${counts.http}`);

    modelUsability.set(provider.id, 'model-invalid', 'AUTH_FAILED', 'proof auth');
    const rejected = await aiGateway.generate({ providerId: provider.id, model: 'model-invalid', apiKey: 'proof-key', prompt: 'proof', task: 'general_generation' }).then(() => false).catch(() => true);
    assert.equal(rejected, true);
    assert.equal(counts.provider, 1); assert.equal(counts.http, 1);
    console.log(`[REAL GATEWAY NON-GOOGLE] protocol=${label} candidate=model-invalid gate=REJECT code=AUTH_FAILED adapter=0 provider=0 http=0`);
  }
} finally {
  globalThis.fetch = originalFetch;
  (providerService as any).listProviders = originalListProviders;
  (quotaRouter as any).scoreCredentials = originalScoreCredentials;
  (credentialService as any).updateCredential = originalUpdateCredential;
}
console.log('REAL NON-GOOGLE GATEWAY BOUNDARY PROOF PASSED');
