export type AICapability = 'text' | 'vision' | 'image' | 'video';

export interface ModelCapability {
  id: string;
  name: string;
  providerId: string;
  supportedCapabilities: string[];
  costPer1kInputTokens?: number;
  costPer1kOutputTokens?: number;
  tier?: 'flash' | 'pro' | 'ultra';
}

export interface ModelDefinition {
  id: string;
  requiredCapability: AICapability;
  providers: {
    [providerId: string]: {
      supported: boolean;
      nativeModelName?: string;
    };
  };
}

export class AICapabilityError extends Error {
  readonly isCapabilityError = true;
  constructor(message: string) {
    super(message);
    this.name = 'AICapabilityError';
  }
}

// Config-driven capability registry
export const modelsRegistry: Record<string, ModelDefinition> = {
  'ops-5': {
    id: 'ops-5',
    requiredCapability: 'text',
    providers: {
      'google': {
        supported: true,
        nativeModelName: 'gemini-3.7-flash',
      },
      // Any custom provider id will support ops-5 by default (native exact match)
      'custom_gate_provider': {
        supported: true,
        nativeModelName: 'ops-5',
      },
    },
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    requiredCapability: 'text',
    providers: {
      'google': {
        supported: true,
        nativeModelName: 'gemini-3.7-flash',
      },
    },
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    requiredCapability: 'text',
    providers: {
      'google': {
        supported: true,
        nativeModelName: 'gemini-3.7-flash',
      },
    },
  },
  'gemini-3.7-flash': {
    id: 'gemini-3.7-flash',
    requiredCapability: 'text',
    providers: {
      'google': {
        supported: true,
        nativeModelName: 'gemini-3.7-flash',
      },
    },
  },
  'gemini-3.6-flash': {
    id: 'gemini-3.6-flash',
    requiredCapability: 'text',
    providers: {
      'google': {
        supported: true,
        nativeModelName: 'gemini-3.6-flash',
      },
    },
  },
  'gemini-3.8-flash': {
    id: 'gemini-3.8-flash',
    requiredCapability: 'text',
    providers: {
      'google': {
        supported: true,
        nativeModelName: 'gemini-3.8-flash',
      },
    },
  },
};

export const capabilityRegistry = {
  // AMM Capability Classifier: Authoritatively classifies raw model into canonical capabilities & tier
  classifyRawModelCapability(raw: {
    id: string;
    displayName?: string;
    description?: string;
    capabilities?: string[];
    tier?: string;
    contextWindow?: number;
  }, providerType?: string): {
    requiredCapability: AICapability;
    supportedCapabilities: string[];
    tier: 'flash' | 'pro' | 'lite' | 'ultra';
    contextWindow: number;
    displayName: string;
  } {
    const rawId = (raw.id || '').toLowerCase().trim();
    const rawName = (raw.displayName || raw.id || '').toLowerCase().trim();
    const rawDesc = (raw.description || '').toLowerCase();

    // 1. Determine canonical Required Capability
    let requiredCapability: AICapability = 'text';
    if (rawId.includes('veo') || rawId.includes('video') || rawId.includes('sora') || rawDesc.includes('video')) {
      requiredCapability = 'video';
    } else if (rawId.includes('imagen') || rawId.includes('image') || rawId.includes('dall-e') || rawDesc.includes('image generation')) {
      requiredCapability = 'image';
    } else if (rawId.includes('vision') && !rawId.includes('gemini') && !rawId.includes('gpt')) {
      requiredCapability = 'vision';
    }

    // 2. Determine Supported Capabilities list
    const capsSet = new Set<string>();
    capsSet.add('text');

    if (requiredCapability === 'video') {
      capsSet.add('video');
      capsSet.add('cinematic_generation');
    } else if (requiredCapability === 'image') {
      capsSet.add('image');
      capsSet.add('visual_generation');
    } else {
      // Multimodal text/vision models
      if (
        rawId.includes('gemini') ||
        rawId.includes('4o') ||
        rawId.includes('sonnet') ||
        rawId.includes('vision') ||
        rawId.includes('multimodal')
      ) {
        capsSet.add('vision');
        capsSet.add('multimodal');
      }

      // Reasoning / Deep analysis
      if (
        rawId.includes('pro') ||
        (rawId.includes('gemini') && !rawId.includes('lite')) ||
        rawId.includes('r1') ||
        rawId.includes('o1') ||
        rawId.includes('o3') ||
        rawId.includes('reasoning') ||
        rawDesc.includes('reasoning') ||
        rawId === 'ops-5'
      ) {
        capsSet.add('reasoning');
        capsSet.add('structured_output');
        capsSet.add('code');
      }

      // Fast / High throughput
      if (
        rawId.includes('flash') ||
        rawId.includes('mini') ||
        rawId.includes('haiku') ||
        rawId.includes('lite') ||
        rawId.includes('turbo')
      ) {
        capsSet.add('fast');
        capsSet.add('structured_output');
      }

      // Creative generation
      capsSet.add('creative');
    }

    // Explicitly enforce that lite models NEVER have reasoning capability
    if (rawId.includes('lite') || rawId.includes('flash-lite')) {
      capsSet.delete('reasoning');
    }

    // Incorporate any explicit user-specified or upstream detected capabilities
    if (Array.isArray(raw.capabilities)) {
      for (const c of raw.capabilities) {
        if (typeof c === 'string' && c.trim()) capsSet.add(c.trim().toLowerCase());
      }
    }

    // 3. Determine Canonical Tier
    let tier: 'flash' | 'pro' | 'lite' | 'ultra' = 'flash';
    if (raw.tier && ['flash', 'pro', 'lite', 'ultra'].includes(raw.tier)) {
      tier = raw.tier as any;
    } else if (rawId.includes('ultra') || rawId.includes('opus') || rawId.includes('o1-high')) {
      tier = 'ultra';
    } else if (
      rawId.includes('pro') ||
      rawId.includes('sonnet') ||
      rawId.includes('4o') ||
      rawId.includes('r1') ||
      rawId.includes('deepseek-r1')
    ) {
      tier = 'pro';
    } else if (
      rawId.includes('lite') ||
      rawId.includes('haiku') ||
      rawId.includes('small') ||
      rawId.includes('nano') ||
      /(?:^|[^a-z])mini(?:$|[^a-z])/i.test(rawId)
    ) {
      tier = 'lite';
    } else {
      tier = 'flash';
    }

    // 4. Calculate default Context Window
    let contextWindow = raw.contextWindow;
    if (!contextWindow || contextWindow <= 0) {
      if (rawId.includes('gemini-2.5-pro') || rawId.includes('gemini-1.5-pro')) {
        contextWindow = 2097152;
      } else if (rawId.includes('gemini')) {
        contextWindow = 1048576;
      } else if (rawId.includes('claude') || rawId.includes('sonnet')) {
        contextWindow = 200000;
      } else if (rawId.includes('gpt-4') || rawId.includes('deepseek')) {
        contextWindow = 128000;
      } else {
        contextWindow = 128000;
      }
    }

    const displayName = raw.displayName && raw.displayName.trim()
      ? raw.displayName.trim()
      : raw.id;

    return {
      requiredCapability,
      supportedCapabilities: Array.from(capsSet),
      tier,
      contextWindow,
      displayName,
    };
  },

  // Authoritatively register/sync a model with AMM Authority
  registerAMMModel(modelId: string, providerId: string, requiredCapability: AICapability = 'text', nativeModelName?: string): ModelDefinition {
    let modelDef = modelsRegistry[modelId];
    if (!modelDef) {
      modelDef = {
        id: modelId,
        requiredCapability,
        providers: {},
      };
      modelsRegistry[modelId] = modelDef;
    }
    modelDef.requiredCapability = requiredCapability;
    if (!modelDef.providers[providerId]) {
      modelDef.providers[providerId] = {
        supported: true,
        nativeModelName: nativeModelName || modelId,
      };
    } else {
      modelDef.providers[providerId].supported = true;
      if (nativeModelName) modelDef.providers[providerId].nativeModelName = nativeModelName;
    }
    return modelDef;
  },

  // Get canonical capability required for a model
  getRequiredCapability(modelId: string): AICapability {
    const model = modelsRegistry[modelId];
    if (model) {
      return model.requiredCapability;
    }
    // Default to text if unknown
    return 'text';
  },

  // Check if provider is capable based on requested model, required capability, and provider capabilities config
  isProviderCapable(providerId: string, modelId: string, provider: any): { capable: boolean; reason?: string } {
    // 1. Check provider-wide capabilities from db config
    const reqCap = this.getRequiredCapability(modelId);
    if (provider && provider.capabilities) {
      let capEnabled = true;
      if (Array.isArray(provider.capabilities)) {
        capEnabled = provider.capabilities.includes(reqCap);
      } else if (typeof provider.capabilities === 'object') {
        capEnabled = provider.capabilities[reqCap] !== false;
      } else if (typeof provider.capabilities === 'string') {
        try {
          const parsed = JSON.parse(provider.capabilities);
          if (Array.isArray(parsed)) {
            capEnabled = parsed.includes(reqCap);
          } else if (typeof parsed === 'object') {
            capEnabled = parsed[reqCap] !== false;
          }
        } catch {
          capEnabled = true;
        }
      }
      if (!capEnabled) {
        return {
          capable: false,
          reason: `Provider '${providerId}' does not support required capability '${reqCap}'`,
        };
      }
    }

    // 2. Google provider natively supports all Gemini, Imagen & Veo models
    const isGoogle = providerId === 'google' || provider?.type === 'gemini' || provider?.type === 'google-generative-ai' || provider?.type === 'google';
    if (isGoogle && (modelId.startsWith('gemini') || modelId.startsWith('veo') || modelId.startsWith('imagen') || modelId === 'ops-5')) {
      return { capable: true };
    }

    // 3. Check model-specific registry in AMM if defined
    const modelDef = modelsRegistry[modelId];
    if (modelDef) {
      const provConfig = modelDef.providers[providerId];
      if (provConfig && provConfig.supported) {
        return { capable: true };
      }
      if (provConfig && provConfig.supported === false) {
        return {
          capable: false,
          reason: `Provider '${providerId}' explicitly does not support model '${modelId}'`,
        };
      }
      // If ops-5, any custom provider supports it by default (native exact match)
      if (modelId === 'ops-5' && providerId !== 'google') {
        return { capable: true };
      }
      // If provider has an advertised model list, check if it's included
      const providerModelList = provider?.supportedModels || provider?.models || provider?.models_available;
      if (Array.isArray(providerModelList) && providerModelList.includes(modelId)) {
        return { capable: true };
      }
    }

    // 4. For OpenAI-compatible / custom providers or dynamically registered models in database
    const isCustomOrOpenAI = !isGoogle && (
      provider?.type === 'openai-compatible' ||
      Boolean(provider?.baseUrl) ||
      provider?.type === 'custom' ||
      providerId !== 'google'
    );
    if (isCustomOrOpenAI) {
      return { capable: true };
    }

    // For any other provider or dynamic models, capability is granted if provider satisfies required capability
    return { capable: true };
  },

  // Resolve native model name for a provider (strictly returns the authoritative model name)
  resolveNativeModel(providerId: string, modelId: string): string {
    const modelDef = modelsRegistry[modelId];
    if (modelDef) {
      const provConfig = modelDef.providers[providerId];
      if (provConfig && provConfig.nativeModelName) {
        return provConfig.nativeModelName;
      }
    }
    return modelId;
  },
};
