import { AIModel } from '../../src/types';
import { db } from '../db';
import { capabilityRegistry } from './capability_registry';

export const DEFAULT_BASELINE_MODELS: Omit<AIModel, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'gemini-3.7-flash',
    providerId: 'google',
    displayName: 'Gemini 3.7 Flash',
    tier: 'flash' as const,
    capabilities: ['text', 'vision', 'image', 'video'],
    enabled: true,
    contextWindow: 1048576,
  },
  {
    id: 'gemini-2.5-pro',
    providerId: 'google',
    displayName: 'Gemini 2.5 Pro',
    tier: 'pro' as const,
    capabilities: ['text', 'vision', 'analysis'],
    enabled: true,
    contextWindow: 2097152,
  },
  {
    id: 'gemini-3.5-flash-lite',
    providerId: 'google',
    displayName: 'Gemini 3.5 Flash Lite',
    tier: 'lite' as const,
    capabilities: ['text', 'fast'],
    enabled: true,
    contextWindow: 1048576,
  },
];

export const modelRegistryService = {
  async listModels(): Promise<AIModel[]> {
    return db.getModels();
  },

  async getModel(id: string, providerId?: string): Promise<AIModel | null> {
    return db.getModel(id, providerId);
  },

  async addModel(data: Omit<AIModel, 'createdAt' | 'updatedAt'> & { createdAt?: number; updatedAt?: number }): Promise<AIModel> {
    // Check referential integrity: provider must exist (unless it's 'google' during default seeding)
    let providerType = 'gemini';
    if (data.providerId !== 'google') {
      const provider = await db.getProvider(data.providerId);
      if (!provider) {
        throw new Error(`Cannot register model for nonexistent provider "${data.providerId}".`);
      }
      providerType = provider.type || 'openai-compatible';
    }

    // Pass through AMM Capability Classifier to ensure strict AMM Capability Authority
    const ammClassified = capabilityRegistry.classifyRawModelCapability({
      id: data.id,
      displayName: data.displayName,
      capabilities: data.capabilities,
      tier: data.tier,
      contextWindow: data.contextWindow,
    }, providerType);

    // Synchronize into AMM Model Definition registry
    capabilityRegistry.registerAMMModel(
      data.id,
      data.providerId,
      ammClassified.requiredCapability,
      data.id
    );

    const now = Date.now();
    const newModel: AIModel = {
      ...data,
      displayName: ammClassified.displayName,
      tier: ammClassified.tier,
      capabilities: ammClassified.supportedCapabilities,
      contextWindow: ammClassified.contextWindow,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    };
    return db.saveModel(newModel);
  },

  async updateModel(id: string, partial: Partial<AIModel>, providerId?: string): Promise<AIModel | null> {
    const existing = await db.getModel(id, providerId);
    if (!existing) return null;

    if (partial.capabilities || partial.tier) {
      const ammClassified = capabilityRegistry.classifyRawModelCapability({
        id,
        displayName: partial.displayName || existing.displayName,
        capabilities: partial.capabilities || existing.capabilities,
        tier: partial.tier || existing.tier,
        contextWindow: partial.contextWindow || existing.contextWindow,
      });

      capabilityRegistry.registerAMMModel(
        id,
        existing.providerId,
        ammClassified.requiredCapability,
        id
      );
    }

    const updated: AIModel = {
      ...existing,
      ...partial,
      id,
      providerId: existing.providerId,
      updatedAt: Date.now(),
    };
    return db.saveModel(updated);
  },

  async removeModel(id: string, providerId?: string): Promise<boolean> {
    return db.deleteModel(id, providerId);
  },

  async removeModelsByProvider(providerId: string): Promise<number> {
    const models = await db.getModels();
    const toRemove = models.filter(m => m.providerId === providerId);
    let count = 0;
    for (const m of toRemove) {
      await db.deleteModel(m.id, providerId);
      count++;
    }
    return count;
  },

  async initializeDefaults(): Promise<void> {
    const models = await db.getModels();
    if (models.length === 0) {
      for (const m of DEFAULT_BASELINE_MODELS) {
        await this.addModel(m);
      }
    }
  },

  async resetToDefaults(): Promise<AIModel[]> {
    for (const m of DEFAULT_BASELINE_MODELS) {
      const existing = await this.getModel(m.id, 'google');
      if (!existing) {
        await this.addModel(m);
      } else {
        await this.updateModel(m.id, m, 'google');
      }
    }
    return this.listModels();
  },
};
