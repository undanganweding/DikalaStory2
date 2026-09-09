import { db } from '../db';
import { aiGateway } from './ai_gateway';
import { credentialResolver } from './credential_resolver';
import { resolveProviderAdapter } from './provider_adapter_registry';
import { modelUsability } from './model_usability';

const baseUrl = 'http://localhost:20128/v1';
const providerId = '9router-local';
const modelId = 'codex';

async function main() {
  const providers = await db.getProviders();
  const credentials = await db.getCredentials();
  const models = await db.getModels();
  const provider = providers.find(p => p.baseUrl === baseUrl);
  const credential = provider ? credentials.find(c => c.providerId === provider.id && c.status === 'active') : undefined;
  const model = provider ? models.find(m => m.providerId === provider.id && m.id === modelId && m.enabled === true) : undefined;
  console.log(JSON.stringify({ registryProvider: provider ? { id: provider.id, name: provider.name, type: provider.type, baseUrl: provider.baseUrl, enabled: provider.enabled } : null, activeCredential: Boolean(credential), model: model ? { id: model.id, enabled: model.enabled } : null }));
  if (!provider || !credential || !model) {
    console.log(JSON.stringify({ status: 'BLOCKED', missing: { provider: !provider, activeCredential: !credential, model: !model } }));
    return;
  }
  const resolved = await credentialResolver.resolveCredential({ providerId: provider.id, modelId, credentialDomain: 'API', requiredCapability: 'text' });
  const adapter = resolveProviderAdapter(provider);
  console.log(JSON.stringify({ status: 'READY', providerId: provider.id, modelId, authorizationPresent: Boolean(resolved.domain === 'API' && resolved.apiKey), adapterResolved: Boolean(adapter) }));
  modelUsability.clear();
  const result = await aiGateway.generate({ task: 'general_generation', agentName: 'REAL_9ROUTER_PROOF', providerId: provider.id, model: modelId, apiKey: resolved.domain === 'API' ? resolved.apiKey : '', prompt: 'Reply exactly OK.', timeoutMs: 30000 });
  console.log(JSON.stringify({ status: 'SUCCESS', providerId: result.providerId, model: result.model, responsePresent: Boolean(result.text), responseText: result.text }));
}
main().catch(error => { console.error(JSON.stringify({ status: 'FAILED', error: error.message })); process.exitCode = 1; });
