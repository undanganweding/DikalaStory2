import assert from 'node:assert/strict';
import { aiGateway, aiGatewayExecutionHooks, resetAIGatewayExecutionHooks } from './ai_gateway';
import { db } from '../db';
import { modelUsability } from './model_usability';
import { providerService } from './provider_service';
import { quotaRouter } from './quota_router';
import { credentialService } from './credential_service';
import { executeLLMRequest } from '../llm_provider';

const counts = { gateway: 0, legacyFallbackEntered: 0, adapter: 0, provider: 0, http: 0 };
const provider = { id: 'google', name: 'Proof Google', type: 'gemini', protocol: 'google-generative-ai', enabled: true, capabilities: { text: true } } as any;
const credential = { id: 'legacy-proof', name: 'Legacy proof', providerId: 'google', encryptedSecret: 'proof-key', status: 'active' } as any;
const originalListProviders = providerService.listProviders;
const originalScoreCredentials = quotaRouter.scoreCredentials;
const originalUpdateCredential = credentialService.updateCredential;
const originalFetch = globalThis.fetch;
const originalConsoleWarn = console.warn;
const originalGenerate = aiGatewayExecutionHooks.createGoogleClient;
const originalGetModels = db.getModels;
const originalGetProvider = db.getProvider;

const cases = [
  ['UNAVAILABLE', 'durable legacy unavailable'],
  ['QUOTA_EXHAUSTED', 'durable legacy quota'],
  ['RATE_LIMITED', 'durable legacy rate'],
  ['AUTH_FAILED', 'durable legacy auth'],
] as const;

try {
  (db as any).getModels = async () => [{ id: 'A', providerId: 'google', enabled: true, capabilities: ['text'] }];
  (db as any).getProvider = async () => provider;
  (providerService as any).listProviders = async () => [provider];
  (quotaRouter as any).scoreCredentials = async () => [{ credential, healthStatus: 'HEALTHY', successRate: 100, avgLatencyMs: 1, score: 100, state: 'ACTIVE' }];
  (credentialService as any).updateCredential = async () => undefined;
  aiGatewayExecutionHooks.createGoogleClient = () => ({ models: { generateContent: async () => {
    counts.gateway++;
    modelUsability.set('google', 'LEGACY', 'UNAVAILABLE', 'gateway failure persisted invalid state');
    throw new Error('503 forced gateway failure');
  } } });
  console.warn = (...args: any[]) => {
    if (args.some(value => String(value).includes('Attempting fallback execution'))) counts.legacyFallbackEntered++;
    originalConsoleWarn(...args);
  };
  globalThis.fetch = (async (...args: any[]) => {
    counts.http++;
    counts.provider++;
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'legacy-bypass' }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  const originalGatewayGenerate = aiGateway.generate;
  (aiGateway as any).generate = async () => {
    counts.gateway++;
    throw new Error('forced post-gate gateway failure');
  };
  modelUsability.set('google', 'A', 'AVAILABLE', 'valid candidate');
  await assert.rejects(() => executeLLMRequest({ model: 'A', prompt: 'legacy proof', stage: 'GENERAL', reasoningConfig: { provider_type: 'google', model_id: 'A', api_key: 'proof-key' } as any }));
  (aiGateway as any).generate = originalGatewayGenerate;
  assert.equal(counts.gateway, 1);
  assert.equal(counts.legacyFallbackEntered, 0);
  assert.equal(counts.adapter, 0);
  assert.equal(counts.provider, 0);
  assert.equal(counts.http, 0);
  console.log(JSON.stringify({ phase: 'post-patch-legacy-bypass', ...counts, result: 'NO_BYPASS' }));
} finally {
  globalThis.fetch = originalFetch;
  console.warn = originalConsoleWarn;
  (db as any).getModels = originalGetModels;
  (db as any).getProvider = originalGetProvider;
  (providerService as any).listProviders = originalListProviders;
  (quotaRouter as any).scoreCredentials = originalScoreCredentials;
  (credentialService as any).updateCredential = originalUpdateCredential;
  if (originalGenerate) aiGatewayExecutionHooks.createGoogleClient = originalGenerate;
  else resetAIGatewayExecutionHooks();
  modelUsability.clear();
}
