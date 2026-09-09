import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { db } from '../db';
import { aiGateway, aiGatewayExecutionHooks, resetAIGatewayExecutionHooks } from './ai_gateway';
import { createApiGenerationSnapshot, CONSTRAINT_SET, PRICING_POLICY_VERSION, REGISTRY_VERSION } from './api_generation_gate';
import { freshFallbackRegate } from './fallback_regate';
import { modelUsability, type ModelUsabilityState } from './model_usability';
import { providerService } from './provider_service';
import { quotaRouter } from './quota_router';
import { credentialService } from './credential_service';

const childMode = process.argv[2];
const stateArg = childMode === 'write' ? process.argv[3] as ModelUsabilityState : undefined;
const retryAfterArg = childMode === 'write' ? Number(process.argv[4] || 0) : 0;
const targetModelId = childMode === 'write' ? process.argv[5] || process.env.DURABLE_PROOF_MODEL_ID : process.argv[3] || process.env.DURABLE_PROOF_MODEL_ID;

async function selectModel(modelId?: string) {
  const models = await db.getModels();
  const model = models.find(candidate => candidate.id === modelId) || models.find(candidate => candidate.enabled && candidate.providerId);
  if (!model) throw new Error('Durable proof requires one enabled persisted model');
  const provider = await db.getProvider(model.providerId);
  if (!provider) throw new Error(`Provider missing for ${model.providerId}`);
  return { model, provider };
}

async function writeState() {
  console.log(`PROCESS_A_START pid=${process.pid}`);
  if (!stateArg) throw new Error('Missing state');
  const { model } = await selectModel(targetModelId);
  modelUsability.clear();
  const record = modelUsability.set(model.providerId, model.id, stateArg, `durable-proof-${stateArg}`, retryAfterArg || undefined);
  console.log(`PROCESS_A_DB_WRITE pid=${process.pid} state=${stateArg}`);
  await modelUsability.persist(model.providerId, model.id, record);
  const readBack = await db.getModel(model.id, model.providerId);
  console.log(`PROCESS_A_DB_READ_BACK pid=${process.pid} state=${readBack?.usabilityState || 'NONE'}`);
  assert.equal(readBack?.usabilityState, stateArg);
  assert.equal(readBack?.usabilityReason, record.reason);
  if (retryAfterArg) assert.equal(readBack?.retryAfter, retryAfterArg);
  console.log(JSON.stringify({ phase: 'write', providerId: model.providerId, modelId: model.id, persisted: readBack?.usabilityState, retryAfter: readBack?.retryAfter }));
  console.log(`PROCESS_A_EXIT pid=${process.pid}`);
}

async function readAndEnforce() {
  console.log(`PROCESS_B_START pid=${process.pid}`);
  const { model, provider } = await selectModel(targetModelId);
  modelUsability.clear();
  assert.equal(modelUsability.get(provider.id, model.id), undefined);
  await modelUsability.loadPersisted();
  const readBack = modelUsability.get(provider.id, model.id);
  console.log(`PROCESS_B_DB_READ pid=${process.pid} state=${readBack?.state || 'NONE'}`);
  assert.ok(readBack, 'Process B must reconstruct usability from DB');
  const counts = { adapter: 0, provider: 0, http: 0 };
  const originalFetch = globalThis.fetch;
  const originalListProviders = providerService.listProviders;
  const originalScoreCredentials = quotaRouter.scoreCredentials;
  const originalUpdateCredential = credentialService.updateCredential;
  try {
    (providerService as any).listProviders = async () => [provider];
    (quotaRouter as any).scoreCredentials = async () => [{ credential: { id: 'durable-proof', name: 'proof', providerId: provider.id, encryptedSecret: 'proof-key', status: 'active' }, healthStatus: 'HEALTHY', successRate: 100, avgLatencyMs: 1, score: 100, state: 'ACTIVE' }];
    (credentialService as any).updateCredential = async () => undefined;
    aiGatewayExecutionHooks.createGoogleClient = () => ({ models: { generateContent: async () => { counts.provider++; counts.http++; return { text: 'ok' }; } } });
    const eligible = modelUsability.isEligible(provider.id, model.id);
    let gate = eligible ? 'READY' : `REJECT:${readBack.state}`;
    console.log(`PROCESS_B_GATE pid=${process.pid} gate=${gate}`);
    if (eligible) {
      console.log(`PROCESS_B_EXECUTION pid=${process.pid}`);
      const snapshot = createApiGenerationSnapshot(provider, model, provider.protocol || provider.type || 'google-generative-ai');
      const registryGate = await freshFallbackRegate({
        provider,
        model,
        adapterProtocol: provider.protocol || provider.type || 'google-generative-ai',
        request: {
          providerId: provider.id,
          modelId: model.id,
          registryVersion: REGISTRY_VERSION,
          capability: 'text',
          modality: 'text',
          durationSeconds: 1,
          constraintSet: CONSTRAINT_SET,
          pricingPolicyVersion: PRICING_POLICY_VERSION,
        },
        preflight: { credentialAvailable: true, providerEnabled: true, adapterAvailable: true, requestValid: true },
      });
      assert.equal(registryGate.status, 'READY_FOR_EXECUTION', `Proof fixture must pass canonical registry gate: ${registryGate.reasonCode}`);
      await aiGateway.generate({
        providerId: provider.id,
        model: model.id,
        apiKey: 'proof-key',
        prompt: 'durable proof',
        task: 'general_generation',
        verifiedExecutionSnapshot: snapshot,
        verifiedRegistryRequest: {
          providerId: provider.id,
          modelId: model.id,
          registryVersion: REGISTRY_VERSION,
          capability: 'text',
          modality: 'text',
          durationSeconds: 1,
          constraintSet: CONSTRAINT_SET,
          pricingPolicyVersion: PRICING_POLICY_VERSION,
        },
      });
      counts.adapter++;
    }
    const expectedEligible = readBack.state === 'AVAILABLE' || readBack.state === 'UNKNOWN' || ((readBack.state === 'RATE_LIMITED' || readBack.state === 'QUOTA_EXHAUSTED') && Boolean(readBack.retryAfter && readBack.retryAfter <= Date.now()));
    assert.equal(eligible, expectedEligible);
    if (!eligible) assert.deepEqual(counts, { adapter: 0, provider: 0, http: 0 });
    console.log(JSON.stringify({ phase: 'read-after-reset', resetBoundary: 'process-B-empty-memory', readBack, gate, adapter: counts.adapter, provider: counts.provider, http: counts.http }));
    console.log(`PROCESS_B_EXIT pid=${process.pid}`);
  } finally {
    globalThis.fetch = originalFetch;
    (providerService as any).listProviders = originalListProviders;
    (quotaRouter as any).scoreCredentials = originalScoreCredentials;
    (credentialService as any).updateCredential = originalUpdateCredential;
    resetAIGatewayExecutionHooks();
  }
}

async function main() {
  if (childMode === 'write') await writeState();
  else if (childMode === 'read') await readAndEnforce();
  else {
    const models = await db.getModels();
    const model = models.find(candidate => ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.7-flash'].includes(candidate.id) && candidate.enabled && candidate.providerId === 'google')
      || models.find(candidate => candidate.enabled && candidate.providerId === 'google');
    if (!model) throw new Error('Durable proof requires a supported enabled Google model');
    const cases: Array<[ModelUsabilityState, number]> = [
      ['UNAVAILABLE', 0], ['QUOTA_EXHAUSTED', Date.now() + 60_000], ['RATE_LIMITED', Date.now() + 60_000], ['AUTH_FAILED', 0],
    ];
    for (const [state, retryAfter] of cases) {
      runChild('write', state, retryAfter, model.id);
      runChild('read', undefined, 0, model.id);
    }
    runChild('write', 'RATE_LIMITED', Date.now() - 1, model.id);
    runChild('read', undefined, 0, model.id);
    runChild('write', 'AVAILABLE', 0, model.id);
    runChild('read', undefined, 0, model.id);
    console.log('DURABLE MODEL-USABILITY PROCESS-RESET PROOF PASSED');
  }
}

function runChild(mode: string, state: ModelUsabilityState | undefined, retryAfter: number, modelId: string) {
  const args = ['node_modules/tsx/dist/cli.mjs', '-r', 'dotenv/config', 'server/ai_infrastructure/durable_usability_process_proof.ts', mode];
  if (state) args.push(state, String(retryAfter));
  args.push(modelId);
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: { ...process.env, DURABLE_PROOF_CHILD: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: 15000,
    killSignal: 'SIGTERM',
    maxBuffer: 10 * 1024 * 1024,
  });
  const elapsedMs = Date.now() - startedAt;
  const evidence = { child: mode, modelId, pid: result.pid || null, status: result.status, signal: result.signal, timedOut: (result.error as any)?.code === 'ETIMEDOUT', elapsedMs, stdout: result.stdout || '', stderr: result.stderr || '' };
  console.log(JSON.stringify(evidence));
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Child process failed for ${mode}/${state || 'read'}: ${result.status}`);
}

main().then(() => {
  if (process.env.DURABLE_PROOF_CHILD === '1') process.exit(0);
}).catch(error => {
  console.error('DURABLE MODEL-USABILITY PROCESS-RESET PROOF FAILED:', error);
  process.exit(1);
});
