import { AIProvider } from '../../src/types';
import { db } from '../db';
import { credentialService } from './credential_service';
import { modelRegistryService } from './model_registry_service';

export const providerService = {
  async listProviders(): Promise<AIProvider[]> {
    return db.getProviders();
  },

  async getProvider(id: string): Promise<AIProvider | null> {
    let provider = await db.getProvider(id);
    if (!provider && id === 'google') {
      await this.initializeDefaults();
      provider = await db.getProvider(id);
    }
    return provider;
  },

  async addProvider(data: Omit<AIProvider, 'createdAt' | 'updatedAt'>): Promise<AIProvider> {
    const now = Date.now();
    const newProvider: AIProvider = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    return db.saveProvider(newProvider);
  },

  async updateProvider(id: string, partial: Partial<AIProvider>): Promise<AIProvider | null> {
    const existing = await db.getProvider(id);
    if (!existing) return null;
    const updated: AIProvider = {
      ...existing,
      ...partial,
      id,
      updatedAt: Date.now(),
    };
    return db.saveProvider(updated);
  },

  async removeProvider(id: string): Promise<{ success: boolean; detachedCredentials: number; detachedModels: number }> {
    const provider = await db.getProvider(id);
    if (!provider) {
      return { success: false, detachedCredentials: 0, detachedModels: 0 };
    }

    // Safely detach/remove active credentials and models belonging to this provider
    // Note: ai_usage historical logs are strictly preserved
    const detachedCredentials = await credentialService.removeCredentialsByProvider(id);
    const detachedModels = await modelRegistryService.removeModelsByProvider(id);

    const success = await db.deleteProvider(id);
    return {
      success,
      detachedCredentials,
      detachedModels,
    };
  },

  async bulkRemoveProviders(ids: string[]): Promise<{ deletedCount: number; detachedCredentials: number; detachedModels: number }> {
    let deletedCount = 0;
    let detachedCredentials = 0;
    let detachedModels = 0;
    for (const id of ids) {
      const res = await this.removeProvider(id);
      if (res.success) {
        deletedCount++;
        detachedCredentials += res.detachedCredentials;
        detachedModels += res.detachedModels;
      }
    }
    return { deletedCount, detachedCredentials, detachedModels };
  },

  async removeAllProviders(keepDefaultGoogle = false): Promise<{ deletedProviders: number; detachedCredentials: number; detachedModels: number }> {
    const providers = await this.listProviders();
    let deletedProviders = 0;
    let detachedCredentials = 0;
    let detachedModels = 0;

    for (const prov of providers) {
      if (keepDefaultGoogle && prov.id === 'google') continue;
      const res = await this.removeProvider(prov.id);
      if (res.success) {
        deletedProviders++;
        detachedCredentials += res.detachedCredentials;
        detachedModels += res.detachedModels;
      }
    }

    if (!keepDefaultGoogle) {
      // Re-seed clean Google default
      await this.initializeDefaults();
    }

    return { deletedProviders, detachedCredentials, detachedModels };
  },

  async initializeDefaults(): Promise<void> {
    const google = await db.getProvider('google');
    if (!google) {
      await this.addProvider({
        id: 'google',
        name: 'Google Gemini',
        type: 'gemini',
        enabled: true,
        capabilities: { text: true, vision: true, image: true, video: true },
      });
    } else if (!google.enabled) {
      await this.updateProvider('google', { enabled: true });
    }
  },
};
