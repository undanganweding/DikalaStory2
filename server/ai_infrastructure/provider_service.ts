import { AIProvider } from '../../src/types';
import { db } from '../db';
import { credentialService } from './credential_service';
import { modelRegistryService } from './model_registry_service';

export const providerService = {
  async listProviders(): Promise<AIProvider[]> {
    return db.getProviders();
  },

  async getProvider(id: string): Promise<AIProvider | null> {
    return db.getProvider(id);
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
    }
  },
};
