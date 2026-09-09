import { db } from '../db';
import { aiGateway } from './ai_gateway';
import { modelUsability } from './model_usability';

const providerId = 'local_9router_mtssnvob';
const invalidModelId = 'codex-invalid-negative-control';
let httpCount = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
  httpCount++;
  return originalFetch(...args);
}) as typeof fetch;

async function main() {
  const provider = await db.getProvider(providerId);
  if (!provider) throw new Error(`Missing registered provider: ${providerId}`);
  modelUsability.set(providerId, invalidModelId, 'AUTH_FAILED', 'negative control invalid candidate');
  try {
    await aiGateway.generate({
      task: 'general_generation',
      agentName: 'NEGATIVE_9ROUTER_CONTROL',
      providerId,
      model: invalidModelId,
      apiKey: 'negative-control-placeholder',
      prompt: 'Must not execute.',
      timeoutMs: 30000,
    });
    console.log(JSON.stringify({ status: 'FAILED_CONTROL', reason: 'Invalid candidate unexpectedly executed', adapterExecutions: 'unknown', httpCount }));
    process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ status: 'REJECTED', rejection: error instanceof Error ? error.message : String(error), adapterExecutions: 0, httpCount }));
    if (httpCount !== 0) process.exitCode = 1;
  } finally {
    globalThis.fetch = originalFetch;
  }
}
main().catch(error => { console.error(JSON.stringify({ status: 'CONTROL_ERROR', error: error instanceof Error ? error.message : String(error) })); process.exitCode = 1; });
