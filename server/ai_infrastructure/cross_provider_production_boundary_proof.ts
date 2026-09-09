import assert from 'node:assert/strict';
import { db } from '../db';
import { taskRouter } from './task_router';
import { aiGateway } from './ai_gateway';
import { modelUsability } from './model_usability';
import { resetCrossProviderTrace, traceCrossProviderEvent } from './cross_provider_trace';

const taskId = 'narrative_structure';
const stageCode = 'S4';

async function main() {
  resetCrossProviderTrace();
  traceCrossProviderEvent('PROOF_START');
  const startedAt = Date.now();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    console.log(`[BEFORE_FETCH] elapsedMs=${Date.now() - startedAt} url=${url} method=${init?.method || 'GET'} hasSignal=${Boolean(init?.signal)}`);
    try {
      const response = await originalFetch(input, init);
      console.log(`[AFTER_FETCH] elapsedMs=${Date.now() - startedAt} url=${url} status=${response.status} ok=${response.ok}`);
      try {
        const body = await response.clone().text();
        console.log(`[FETCH_BODY] elapsedMs=${Date.now() - startedAt} body=${body.slice(0, 1000)}`);
      } catch (bodyError) {
        console.log(`[FETCH_BODY_ERROR] elapsedMs=${Date.now() - startedAt} error=${bodyError instanceof Error ? bodyError.message : String(bodyError)}`);
      }
      return response;
    } catch (error) {
      console.log(`[FETCH_ERROR] elapsedMs=${Date.now() - startedAt} url=${url} error=${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }) as typeof fetch;
  process.on('beforeExit', code => console.log(`[BEFORE_EXIT] elapsedMs=${Date.now() - startedAt} code=${code}`));
  process.on('exit', code => console.log(`[EXIT] elapsedMs=${Date.now() - startedAt} code=${code}`));
  console.log('=== ISOLATED CROSS-PROVIDER PRODUCTION BOUNDARY PROOF ===');
  const plan = await taskRouter.resolveTaskExecutionPlan({ taskId, stageCode });
  const allModels = await db.getModels();
  const candidates = [{ type: 'primary', providerId: plan.providerId, modelId: plan.modelId, credentialId: plan.credentialId }, ...(plan.fallbackPlan || [])];

  console.log('PRIMARY:');
  console.log(`providerId=${plan.providerId} modelId=${plan.modelId} credentialId=${plan.credentialId}`);
  console.log('FALLBACK PLAN:');
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const provider = await db.getProvider(c.providerId);
    const model = allModels.find(m => m.providerId === c.providerId && m.id === c.modelId);
    const usability = modelUsability.get(c.providerId, c.modelId)?.state || model?.usabilityState || 'UNKNOWN';
    console.log(`[${i}] providerId=${c.providerId} providerName=${provider?.name || 'UNKNOWN'} modelId=${c.modelId} type=${c.type} usability=${usability} enabled=${provider?.enabled === true && model?.enabled === true}`);
  }

  const nonGoogle = candidates.find(c => c.providerId !== 'google');
  if (!nonGoogle) {
    console.log('NO_ELIGIBLE_NON_GOOGLE_FALLBACK');
    return;
  }
  console.log(`NON_GOOGLE_CANDIDATE providerId=${nonGoogle.providerId} modelId=${nonGoogle.modelId}`);
  console.log('EXECUTION: real aiGateway.generate with router plan');
  try {
    traceCrossProviderEvent('BEFORE_GATEWAY_GENERATE', { providerId: plan.providerId, modelId: plan.modelId, adapterType: 'openai-compatible', credentialPresent: Boolean(plan.apiKey) });
    console.log(`[BEFORE_GATEWAY_GENERATE] elapsedMs=${Date.now() - startedAt}`);
    const result = await aiGateway.generate({
      task: taskId,
      agentName: stageCode,
      providerId: plan.providerId,
      model: plan.modelId,
      apiKey: plan.apiKey,
      prompt: 'Return JSON: {"status":"ok"}',
      fallbackPlan: plan.fallbackPlan,
      timeoutMs: 15000,
    });
    traceCrossProviderEvent('AFTER_GATEWAY_GENERATE', { providerId: result.providerId, modelId: result.model, adapterType: 'openai-compatible', credentialPresent: Boolean(plan.apiKey) });
    console.log(`[AFTER_GATEWAY_GENERATE] elapsedMs=${Date.now() - startedAt} providerId=${result.providerId} modelId=${result.model}`);
    console.log(`FINAL: success providerId=${result.providerId} modelId=${result.model}`);
    assert.equal(result.providerId, nonGoogle.providerId, 'Expected cross-provider fallback to selected non-Google candidate');
    console.log('CROSS_PROVIDER_PRODUCTION_BOUNDARY_PROOF_PASS');
  } catch (error) {
    traceCrossProviderEvent('GATEWAY_ERROR', { providerId: plan.providerId, modelId: plan.modelId, adapterType: 'openai-compatible', credentialPresent: Boolean(plan.apiKey), error: error instanceof Error ? error.message : String(error) });
    console.log(`[GATEWAY_ERROR] elapsedMs=${Date.now() - startedAt} error=${error instanceof Error ? error.message : String(error)}`);
    console.log(`FINAL: failure error=${error instanceof Error ? error.message : String(error)}`);
    throw error;
  } finally {
    globalThis.fetch = originalFetch;
    traceCrossProviderEvent('HARNESS_FINALLY', { providerId: plan.providerId, modelId: plan.modelId, adapterType: 'openai-compatible', credentialPresent: Boolean(plan.apiKey) });
    console.log(`[HARNESS_FINALLY] elapsedMs=${Date.now() - startedAt}`);
  }
}

main().catch(error => { console.error('PROOF_FAILED', error); process.exitCode = 1; });
