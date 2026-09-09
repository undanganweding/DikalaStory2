import { db } from '../db';
import { credentialService } from './credential_service';
import { secretVault } from '../security/secret_vault';
import { resolveProviderAdapter } from './provider_adapter_registry';
import { modelRegistryService } from './model_registry_service';
import { modelUsability } from './model_usability';

export async function reconcileProviderModels(providerId: string): Promise<{ discovered: string[]; unavailable: string[] }> {
  const provider = await db.getProvider(providerId);
  if (!provider || !provider.enabled) return { discovered: [], unavailable: [] };
  const credential = (await credentialService.listCredentials()).find(c => c.providerId === providerId && c.status === 'active');
  if (!credential) return { discovered: [], unavailable: [] };
  const apiKey = secretVault.decryptSecret(credential.encryptedSecret);
  const discoveredResult = await resolveProviderAdapter(provider).discoverModels?.(provider, apiKey);
  const discovered = discoveredResult?.models || [];
  const discoveredIds = new Set(discovered.map(m => m.id));
  const current = (await db.getModels()).filter(m => m.providerId === providerId);
  const unavailable: string[] = [];
  for (const model of current) {
    if (!discoveredIds.has(model.id) && model.enabled) {
      await modelRegistryService.updateModel(model.id, { enabled: false }, providerId);
      modelUsability.set(providerId, model.id, 'UNAVAILABLE', 'Absent from authoritative provider discovery');
      unavailable.push(model.id);
    }
  }
  return { discovered: [...discoveredIds], unavailable };
}

export async function reconcileEnabledProviderModels(): Promise<void> {
  const providers = (await db.getProviders()).filter(provider => provider.enabled);
  for (const provider of providers) {
    try {
      await reconcileProviderModels(provider.id);
    } catch (error) {
      console.warn(`[ProviderReconciliation] Discovery unavailable for ${provider.id}:`, error instanceof Error ? error.message : String(error));
    }
  }
}
