import 'dotenv/config';
import { db } from '../db';
import { providerService } from './provider_service';
import { credentialService } from './credential_service';
import { modelRegistryService } from './model_registry_service';

const baseUrl = 'http://localhost:20128/v1';
const providerName = 'Local 9Router';
const apiKey = process.env.NINE_ROUTER_API_KEY?.trim();

async function main() {
  if (!apiKey) throw new Error('NINE_ROUTER_API_KEY missing from .env');

  let provider = (await providerService.listProviders()).find(candidate => candidate.baseUrl === baseUrl);
  if (!provider) {
    provider = await providerService.addProvider({
      id: `local_9router_${Date.now().toString(36)}`,
      name: providerName,
      type: 'openai-compatible',
      protocol: 'openai-compatible',
      baseUrl,
      enabled: true,
      capabilities: { text: true, vision: false, image: false, video: false },
    } as any);
  }

  let credential = (await credentialService.listCredentials()).find(candidate => candidate.providerId === provider!.id && candidate.status === 'active');
  if (!credential) {
    credential = await credentialService.addCredential({
      providerId: provider.id,
      name: `${provider.name} Key 1`,
      secret: apiKey,
      status: 'active',
      priority: 1,
      weight: 100,
    } as any);
  }

  let model = (await modelRegistryService.listModels()).find(candidate => candidate.providerId === provider!.id && candidate.id === 'codex');
  if (!model) {
    model = await modelRegistryService.addModel({
      id: 'codex',
      providerId: provider.id,
      displayName: 'codex',
      tier: 'pro',
      capabilities: ['text', 'reasoning'],
      contextWindow: 128000,
      enabled: true,
    } as any);
  } else if (!model.enabled) {
    model = await modelRegistryService.updateModel(model.id, { enabled: true });
  }

  const verifiedProvider = (await db.getProviders()).find(candidate => candidate.id === provider!.id);
  const verifiedCredential = (await db.getCredentials()).find(candidate => candidate.id === credential!.id);
  const verifiedModel = (await db.getModels()).find(candidate => candidate.providerId === provider!.id && candidate.id === 'codex');
  console.log(JSON.stringify({
    provider: verifiedProvider && { id: verifiedProvider.id, name: verifiedProvider.name, type: verifiedProvider.type, baseUrl: verifiedProvider.baseUrl, enabled: verifiedProvider.enabled },
    credential: verifiedCredential && { id: verifiedCredential.id, providerId: verifiedCredential.providerId, status: verifiedCredential.status, priority: verifiedCredential.priority },
    model: verifiedModel && { id: verifiedModel.id, providerId: verifiedModel.providerId, enabled: verifiedModel.enabled, capabilities: verifiedModel.capabilities },
  }));
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
