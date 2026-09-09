import assert from 'node:assert/strict';
import { aiGateway, aiGatewayExecutionHooks, resetAIGatewayExecutionHooks } from './ai_gateway';
import { modelUsability } from './model_usability';
import { providerService } from './provider_service';
import { credentialService } from './credential_service';
import { quotaRouter } from './quota_router';
import { executeLLMRequest } from '../llm_provider';
import { resolveProviderAdapter } from './provider_adapter_registry';

const counts = { adapter: new Map<string, number>(), generateContent: new Map<string, number>(), http: new Map<string, number>() };
const resetCounts = () => { counts.adapter.clear(); counts.generateContent.clear(); counts.http.clear(); };
const bump = (map: Map<string, number>, id: string) => map.set(id, (map.get(id) || 0) + 1);
const provider = { id: 'google', name: 'Proof Google', type: 'gemini', protocol: 'google-generative-ai', enabled: true, capabilities: { text: true } } as any;
const credential = { id: 'proof-credential', name: 'Proof credential', providerId: 'google', encryptedSecret: 'real-proof-key', status: 'active' } as any;
const model = (id: string) => ({ id, providerId: 'google', enabled: true, capabilities: ['text'] }) as any;

const originalListProviders = providerService.listProviders;
const originalScoreCredentials = quotaRouter.scoreCredentials;
const originalUpdateCredential = credentialService.updateCredential;
try {
  (providerService as any).listProviders = async () => [provider];
  (quotaRouter as any).scoreCredentials = async () => [{ credential, healthStatus: 'HEALTHY', successRate: 100, avgLatencyMs: 1, score: 100, state: 'ACTIVE' }];
  (credentialService as any).updateCredential = async () => undefined;
  aiGatewayExecutionHooks.createGoogleClient = () => ({ models: { generateContent: async ({ model: id }: { model: string }) => {
    bump(counts.generateContent, id); bump(counts.http, id);
    if (id === 'A') throw new Error('503 transient primary failure');
    if (id === 'AUTH') throw new Error('401 unauthorized API key');
    return { text: `proof-${id}` };
  } } });
  modelUsability.clear();
  modelUsability.set('google', 'B', 'QUOTA_EXHAUSTED', 'proof quota');
  modelUsability.set('google', 'C', 'RATE_LIMITED', 'proof rate');
  modelUsability.set('google', 'D', 'UNAVAILABLE', 'proof unavailable');
  modelUsability.set('google', 'E', 'AVAILABLE', 'proof available');

  const result = await aiGateway.generate({
    model: 'A', providerId: 'google', apiKey: 'real-proof-key', prompt: 'proof', task: 'general_generation',
    fallbackPlan: [
      { type: 'next_eligible_model', providerId: 'google', modelId: 'B', description: 'B' },
      { type: 'next_eligible_model', providerId: 'google', modelId: 'C', description: 'C' },
      { type: 'next_eligible_model', providerId: 'google', modelId: 'D', description: 'D' },
      { type: 'next_eligible_model', providerId: 'google', modelId: 'E', description: 'E' },
    ],
  });
  assert.equal(result.model, 'E');
  assert.equal(counts.generateContent.get('A'), 1);
  assert.equal(counts.generateContent.get('B') || 0, 0);
  assert.equal(counts.generateContent.get('C') || 0, 0);
  assert.equal(counts.generateContent.get('D') || 0, 0);
  assert.equal(counts.generateContent.get('E'), 1);
  assert.equal(counts.http.get('B') || 0, 0);
  assert.equal(counts.http.get('C') || 0, 0);
  assert.equal(counts.http.get('D') || 0, 0);

  resetCounts();
  modelUsability.clear();
  for (const id of ['B', 'C', 'D', 'AUTH']) modelUsability.set('google', id, id === 'AUTH' ? 'AVAILABLE' : 'UNAVAILABLE', `proof ${id}`);
  await assert.rejects(() => aiGateway.generate({ model: 'B', providerId: 'google', apiKey: 'real-proof-key', prompt: 'proof', task: 'general_generation', fallbackPlan: [
    { type: 'next_eligible_model', providerId: 'google', modelId: 'C', description: 'C' },
    { type: 'next_eligible_model', providerId: 'google', modelId: 'D', description: 'D' },
  ] }));
  assert.deepEqual(Object.fromEntries(counts.generateContent), {});
  assert.deepEqual(Object.fromEntries(counts.http), {});

  resetCounts();
  modelUsability.set('google', 'AUTH', 'AUTH_FAILED', 'proof auth');
  await assert.rejects(() => aiGateway.generate({ model: 'AUTH', providerId: 'google', apiKey: 'real-proof-key', prompt: 'proof', task: 'general_generation' }));
  assert.equal(counts.generateContent.get('AUTH') || 0, 0);
  assert.equal(counts.http.get('AUTH') || 0, 0);

  resetCounts();
  modelUsability.set('google', 'RECOVER', 'UNAVAILABLE', 'initially invalid');
  await assert.rejects(() => aiGateway.generate({ model: 'RECOVER', providerId: 'google', apiKey: 'real-proof-key', prompt: 'proof', task: 'general_generation' }));
  assert.equal(counts.generateContent.get('RECOVER') || 0, 0);
  modelUsability.set('google', 'RECOVER', 'AVAILABLE', 'freshly valid');
  const recovery = await aiGateway.generate({ model: 'RECOVER', providerId: 'google', apiKey: 'real-proof-key', prompt: 'proof', task: 'general_generation' });
  assert.equal(recovery.model, 'RECOVER');
  assert.equal(counts.generateContent.get('RECOVER'), 1);

  resetCounts();
  const llmResult = await executeLLMRequest({ model: 'LLM-ENTRY', prompt: 'proof', stage: 'GENERAL', reasoningConfig: { provider_type: 'google', model_id: 'LLM-ENTRY', api_key: 'real-proof-key' } as any });
  assert.ok(llmResult.text);
  assert.equal(counts.generateContent.get('LLM-ENTRY'), 1);
  const originalFetch = globalThis.fetch;
  const protocolCases = [
    ['openai-compatible', 'openai-compatible', 'http://proof.local/v1'],
    ['anthropic-compatible', 'anthropic-compatible', 'http://proof.local'],
    ['ollama', 'ollama', 'http://proof.local'],
    ['custom-http', 'custom-http', 'http://proof.local'],
  ] as const;
  for (const [label, protocol, baseUrl] of protocolCases) {
    let httpCount = 0;
    globalThis.fetch = (async () => { httpCount++; return new Response(JSON.stringify(protocol === 'anthropic-compatible' ? { content: [{ text: 'ok' }] } : protocol === 'ollama' ? { message: { content: 'ok' } } : { text: 'ok', response: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } }); }) as typeof fetch;
    const adapter = resolveProviderAdapter({ id: `proof-${label}`, name: label, type: protocol, protocol, baseUrl, enabled: true, capabilities: { text: true }, createdAt: 0, updatedAt: 0 } as any);
    const output = await adapter.execute({ provider: { id: `proof-${label}`, name: label, type: protocol, protocol, baseUrl, enabled: true, capabilities: { text: true } } as any, apiKey: 'proof-key', model: 'proof-model', prompt: 'proof' });
    assert.equal(output.text, 'ok');
    assert.equal(httpCount, 1);
    console.log(`[NON-GOOGLE BOUNDARY] protocol=${label} adapter=1 provider=1 http=${httpCount}`);
  }
  globalThis.fetch = originalFetch;
  console.log(`PRODUCTION BOUNDARY PROOF PASS result=${result.model} generateContent=${JSON.stringify(Object.fromEntries(counts.generateContent))} http=${JSON.stringify(Object.fromEntries(counts.http))}`);
} finally {
  (providerService as any).listProviders = originalListProviders;
  (quotaRouter as any).scoreCredentials = originalScoreCredentials;
  (credentialService as any).updateCredential = originalUpdateCredential;
  resetAIGatewayExecutionHooks();
}
