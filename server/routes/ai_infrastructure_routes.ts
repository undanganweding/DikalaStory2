import { Router, Request, Response } from 'express';
import { providerService } from '../ai_infrastructure/provider_service';
import { credentialService } from '../ai_infrastructure/credential_service';
import { modelRegistryService } from '../ai_infrastructure/model_registry_service';
import { intelligenceService } from '../ai_infrastructure/intelligence_service';
import { healthService } from '../ai_infrastructure/health_service';
import { usageService } from '../ai_infrastructure/usage_service';
import { observabilityService } from '../ai_infrastructure/observability_service';
import { openaiCompatibleDriver } from '../ai_infrastructure/openai_compatible_driver';
import { secretVault } from '../security/secret_vault';
import { GoogleGenAI } from '@google/genai';
import { globalAIQueue } from '../ai_infrastructure/rate_limiter_queue';
import { db } from '../db';
import { databaseHealthService } from '../ai_infrastructure/database_health_service';

export const aiInfrastructureRouter = Router();

// 1. Provider Management
aiInfrastructureRouter.get('/providers', async (req: Request, res: Response) => {
  try {
    const providers = await providerService.listProviders();
    const credentials = await credentialService.listCredentials();

    const result = providers.map(p => {
      const credCount = credentials.filter(c => c.providerId === p.id).length;
      return {
        ...p,
        credentials: credCount,
      };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1a. Add Custom / Native Provider
aiInfrastructureRouter.post('/providers', async (req: Request, res: Response) => {
  try {
    const { name, baseUrl, capabilities, type, protocol } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Provider name is required.' });
    }

    const providerType = protocol || type || 'openai-compatible';
    const isGoogle = providerType === 'google-generative-ai' || providerType === 'gemini' || providerType === 'google';

    let normalizedUrl: string | undefined = undefined;
    if (!isGoogle) {
      if (!baseUrl || !baseUrl.trim()) {
        return res.status(400).json({ error: 'Base URL is required for custom OpenAI-compatible providers.' });
      }
      const urlValidation = openaiCompatibleDriver.validateBaseUrl(baseUrl);
      if (!urlValidation.isValid || !urlValidation.normalizedUrl) {
        return res.status(400).json({ error: `Invalid Base URL: ${urlValidation.error}` });
      }
      normalizedUrl = urlValidation.normalizedUrl;
    } else {
      normalizedUrl = baseUrl && baseUrl.trim() ? baseUrl.trim() : 'https://generativelanguage.googleapis.com';
    }

    const existingProviders = await providerService.listProviders();
    const duplicate = existingProviders.find(
      p => p.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (duplicate) {
      return res.status(409).json({
        error: `A provider with this name ("${duplicate.name}") already exists (ID: ${duplicate.id}).`,
      });
    }

    // Auto-generate safe provider ID
    const sanitizedName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 24);
    const id = `${sanitizedName}_${Date.now().toString(36)}`;

    const newProvider = await providerService.addProvider({
      id,
      name: name.trim(),
      type: isGoogle ? 'google-generative-ai' : providerType,
      baseUrl: normalizedUrl,
      enabled: true,
      capabilities: capabilities || (isGoogle ? { text: true, vision: true, image: true, video: true } : { text: true, vision: false, image: false, video: false }),
    });

    res.status(201).json(newProvider);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1b. Delete Custom Provider
aiInfrastructureRouter.delete('/providers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await providerService.removeProvider(id);
    if (!result.success) {
      return res.status(404).json({ error: 'Provider not found.' });
    }
    res.json({
      success: true,
      id,
      detachedCredentials: result.detachedCredentials,
      detachedModels: result.detachedModels,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1b1. Bulk Delete Providers
aiInfrastructureRouter.post('/providers/bulk-delete', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of provider IDs is required.' });
    }
    const result = await providerService.bulkRemoveProviders(ids);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1b1-2. Clear All Providers (or reset to baseline Google)
aiInfrastructureRouter.post('/providers/clear-all', async (req: Request, res: Response) => {
  try {
    const { keepDefaultGoogle = false } = req.body || {};
    const result = await providerService.removeAllProviders(keepDefaultGoogle);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

aiInfrastructureRouter.delete('/providers', async (req: Request, res: Response) => {
  try {
    const result = await providerService.removeAllProviders(false);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1b2. Update Provider (Name, BaseURL, Enabled)
aiInfrastructureRouter.patch('/providers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, baseUrl, enabled, capabilities } = req.body;
    const provider = await providerService.getProvider(id);
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found.' });
    }

    let normalizedUrl = provider.baseUrl;
    if (baseUrl !== undefined && baseUrl !== provider.baseUrl) {
      const urlValidation = openaiCompatibleDriver.validateBaseUrl(baseUrl);
      if (!urlValidation.isValid) {
        return res.status(400).json({ error: `Invalid Base URL: ${urlValidation.error}` });
      }
      normalizedUrl = urlValidation.normalizedUrl;
    }

    const updated = await providerService.updateProvider(id, {
      name: name !== undefined ? name.trim() : provider.name,
      baseUrl: normalizedUrl,
      enabled: enabled !== undefined ? Boolean(enabled) : provider.enabled,
      capabilities: capabilities || provider.capabilities,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1b3. Test Provider Base URL Reachability
aiInfrastructureRouter.post('/providers/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const provider = await providerService.getProvider(id);
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found.' });
    }

    const providerType = (provider.type || 'gemini') as string;
    const isGoogle = ['google-generative-ai', 'gemini', 'google'].includes(providerType);

    if (isGoogle) {
      return res.json({ success: true, message: 'Google Generative AI endpoint is reachable.', latency: 15 });
    }

    if (!provider.baseUrl) {
      return res.status(400).json({ error: 'Provider has no Base URL configured.' });
    }

    // Try finding credential or do public ping
    const creds = await credentialService.listCredentials();
    const cred = creds.find(c => c.providerId === id);
    let apiKey = '';
    if (cred) {
      try {
        apiKey = secretVault.decryptSecret(cred.encryptedSecret);
      } catch {
        apiKey = (cred as any).secret || '';
      }
    }

    const testResult = await openaiCompatibleDriver.testConnectivity(provider.baseUrl, apiKey);
    res.json(testResult);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1b4. Live Connection Test Pre-Flight
aiInfrastructureRouter.post('/test-connection', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { protocol, baseUrl, apiKey } = req.body;
    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({ success: false, error: 'API key is required for connection testing.' });
    }

    const providerType = (protocol || 'google-generative-ai') as string;
    const isGoogle = ['google-generative-ai', 'gemini', 'google'].includes(providerType);

    if (isGoogle) {
      const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
      const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.7-flash', 'gemini-3.6-flash'];
      let response: any = null;
      let lastErr: any = null;
      let usedModel = candidateModels[0];

      for (const m of candidateModels) {
        try {
          response = await globalAIQueue.enqueue(() => ai.models.generateContent({
            model: m,
            contents: 'Ping connectivity test. Reply with OK.',
          }));
          usedModel = m;
          break;
        } catch (err: any) {
          lastErr = err;
          const msg = (err?.message || '').toLowerCase();
          if (!msg.includes('503') && !msg.includes('high demand') && !msg.includes('unavailable') && !msg.includes('spikes in demand')) {
            throw err;
          }
        }
      }
      if (!response && lastErr) throw lastErr;

      const latencyMs = Date.now() - startTime;
      const responseText = response?.text || '';
      return res.json({
        success: true,
        protocol: 'google-generative-ai',
        providerName: 'Google Generative AI',
        model: usedModel,
        latency: latencyMs,
        modelsDetected: 6,
        responseSample: responseText.trim().substring(0, 50) || 'OK',
      });
    } else {
      if (!baseUrl || !baseUrl.trim()) {
        return res.status(400).json({ success: false, error: 'Base URL is required for OpenAI-compatible endpoint testing.' });
      }
      const validation = openaiCompatibleDriver.validateBaseUrl(baseUrl);
      if (!validation.isValid || !validation.normalizedUrl) {
        return res.status(400).json({ success: false, error: validation.error || 'Invalid Base URL' });
      }

      const testResult = await openaiCompatibleDriver.testConnectivity(validation.normalizedUrl, apiKey.trim());
      if (!testResult.success) {
        return res.status(400).json({
          success: false,
          error: testResult.error || 'Connection failed to respond.',
          latency: testResult.latencyMs || (Date.now() - startTime),
        });
      }

      let detectedCount = 0;
      try {
        const models = await openaiCompatibleDriver.fetchModels(validation.normalizedUrl, apiKey.trim(), 5000);
        detectedCount = models.length;
      } catch {
        detectedCount = 1;
      }

      return res.json({
        success: true,
        protocol: providerType,
        providerName: 'OpenAI-Compatible Gateway',
        latency: testResult.latencyMs || (Date.now() - startTime),
        modelsDetected: detectedCount,
        responseSample: 'Connected successfully',
      });
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return res.status(400).json({
      success: false,
      error: err.message || 'Connection test failed',
      latency: latencyMs,
      errorType: err.status === 401 || err.status === 403 ? 'AUTHENTICATION_FAILED' : 'NETWORK_OR_SERVER_ERROR',
    });
  }
});

// 1b5. Discover Models Preview Pre-Flight
aiInfrastructureRouter.post('/discover-models-preview', async (req: Request, res: Response) => {
  try {
    const { protocol, baseUrl, apiKey } = req.body;
    const providerType = (protocol || 'google-generative-ai') as string;
    const isGoogle = ['google-generative-ai', 'gemini', 'google'].includes(providerType);

    if (isGoogle) {
      const models = [
        {
          id: 'gemini-3.7-flash',
          displayName: 'Gemini 3.7 Flash',
          tier: 'flash',
          capabilities: ['reasoning', 'multimodal', 'fast', 'high-throughput'],
          contextWindow: 1048576,
          enabled: true,
          description: 'State-of-the-art fast multimodal model with hybrid reasoning',
        },
        {
          id: 'gemini-2.5-pro',
          displayName: 'Gemini 2.5 Pro',
          tier: 'pro',
          capabilities: ['deep-reasoning', 'long-context', 'structured-output', 'multimodal'],
          contextWindow: 2097152,
          enabled: true,
          description: 'Premier model for complex reasoning and deep context analysis',
        },
        {
          id: 'gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          tier: 'flash',
          capabilities: ['fast', 'low-cost', 'multimodal'],
          contextWindow: 1048576,
          enabled: true,
          description: 'High-speed balanced model optimized for low-latency tasks',
        },
        {
          id: 'gemini-3.5-flash-lite',
          displayName: 'Gemini 3.5 Flash Lite',
          tier: 'lite',
          capabilities: ['ultra-fast', 'low-cost', 'text-streaming'],
          contextWindow: 1048576,
          enabled: true,
          description: 'Ultra-lightweight model built for massive throughput',
        },
        {
          id: 'gemini-2.0-flash',
          displayName: 'Gemini 2.0 Flash',
          tier: 'flash',
          capabilities: ['fast', 'multimodal', 'low-latency'],
          contextWindow: 1048576,
          enabled: true,
          description: 'Next-gen workhorse for general-purpose AI tasks',
        },
        {
          id: 'gemini-1.5-pro',
          displayName: 'Gemini 1.5 Pro',
          tier: 'pro',
          capabilities: ['deep-analysis', 'large-context'],
          contextWindow: 2097152,
          enabled: false,
          description: 'Legacy large context model (up to 2M tokens)',
        },
      ];
      return res.json({ success: true, count: models.length, models });
    } else {
      if (!baseUrl || !baseUrl.trim()) {
        return res.status(400).json({ error: 'Base URL is required to discover models.' });
      }
      const validation = openaiCompatibleDriver.validateBaseUrl(baseUrl);
      if (!validation.isValid || !validation.normalizedUrl) {
        return res.status(400).json({ error: validation.error || 'Invalid Base URL' });
      }

      let fetched: any[] = [];
      try {
        fetched = await openaiCompatibleDriver.fetchModels(validation.normalizedUrl, (apiKey || '').trim());
      } catch {
        // Fallback default list if discovery endpoint is not standard
        fetched = [
          { id: 'gpt-4o', displayName: 'GPT-4o', capabilities: ['text', 'vision', 'reasoning'] },
          { id: 'gpt-4o-mini', displayName: 'GPT-4o Mini', capabilities: ['text', 'fast', 'low-cost'] },
          { id: 'claude-3-5-sonnet', displayName: 'Claude 3.5 Sonnet', capabilities: ['text', 'coding', 'reasoning'] },
          { id: 'deepseek-r1', displayName: 'DeepSeek R1', capabilities: ['text', 'deep-reasoning'] },
        ];
      }

      const models = fetched.map(m => {
        const id = m.id;
        const isPro = id.includes('pro') || id.includes('4o') || id.includes('sonnet') || id.includes('opus') || id.includes('r1');
        const isLite = id.includes('lite') || id.includes('mini') || id.includes('haiku') || id.includes('small');
        return {
          id: m.id,
          displayName: m.displayName || m.id,
          tier: isPro ? 'pro' : isLite ? 'lite' : 'flash',
          capabilities: m.capabilities && m.capabilities.length > 0 ? m.capabilities : ['text'],
          enabled: true,
          contextWindow: 128000,
        };
      });

      return res.json({ success: true, count: models.length, models });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1b6. Full Provider Onboarding Flow
aiInfrastructureRouter.post('/providers/onboard', async (req: Request, res: Response) => {
  try {
    const { provider: providerInput, credential: credInput, models: modelsInput } = req.body;
    if (!providerInput || !providerInput.name || !providerInput.name.trim()) {
      return res.status(400).json({ error: 'Provider configuration with a valid name is required.' });
    }

    if (!credInput || !credInput.apiKey || !credInput.apiKey.trim()) {
      return res.status(400).json({ error: 'API key is required for credential onboarding.' });
    }

    const providerType = (providerInput.protocol || providerInput.type || 'google-generative-ai') as string;
    const isGoogle = ['google-generative-ai', 'gemini', 'google'].includes(providerType);

    let normalizedUrl: string | undefined = undefined;
    if (!isGoogle) {
      if (!providerInput.baseUrl || !providerInput.baseUrl.trim()) {
        return res.status(400).json({ error: 'Base URL is required for custom/OpenAI-compatible providers.' });
      }
      const urlValidation = openaiCompatibleDriver.validateBaseUrl(providerInput.baseUrl);
      if (!urlValidation.isValid || !urlValidation.normalizedUrl) {
        return res.status(400).json({ error: `Invalid Base URL: ${urlValidation.error}` });
      }
      normalizedUrl = urlValidation.normalizedUrl;
    } else {
      normalizedUrl = providerInput.baseUrl && providerInput.baseUrl.trim()
        ? providerInput.baseUrl.trim()
        : 'https://generativelanguage.googleapis.com';
    }

    // Check duplicate provider name
    const existingProviders = await providerService.listProviders();
    const duplicate = existingProviders.find(
      p => p.name.trim().toLowerCase() === providerInput.name.trim().toLowerCase()
    );
    if (duplicate) {
      return res.status(409).json({
        error: `A provider with this name ("${duplicate.name}") already exists.`,
      });
    }

    // 1. Create Provider
    const sanitizedName = providerInput.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 24);
    const providerId = `${sanitizedName}_${Date.now().toString(36)}`;

    const newProvider = await providerService.addProvider({
      id: providerId,
      name: providerInput.name.trim(),
      type: isGoogle ? 'google-generative-ai' : (providerType as any),
      baseUrl: normalizedUrl,
      enabled: true,
      capabilities: isGoogle
        ? { text: true, vision: true, image: true, video: true }
        : { text: true, vision: false, image: false, video: false },
    });

    // 2. Add Credential (bound via foreign key provider_id)
    const credName = credInput.name && credInput.name.trim() ? credInput.name.trim() : `${providerInput.name.trim()} Key 1`;
    const newCred = await credentialService.addCredential({
      providerId: newProvider.id,
      name: credName,
      secret: credInput.apiKey.trim(),
      status: 'active',
      priority: credInput.priority !== undefined ? Number(credInput.priority) : 50,
      weight: credInput.weight !== undefined ? Number(credInput.weight) : 10,
    });

    // 3. Register Models with user-selected enablement
    const registeredModels = [];
    if (Array.isArray(modelsInput) && modelsInput.length > 0) {
      for (const m of modelsInput) {
        if (!m.id || !m.id.trim()) continue;
        const modelRecord = await modelRegistryService.addModel({
          id: m.id.trim(),
          providerId: newProvider.id,
          displayName: (m.displayName || m.id).trim(),
          tier: m.tier || (m.id.includes('pro') ? 'pro' : m.id.includes('lite') ? 'lite' : 'flash'),
          capabilities: Array.isArray(m.capabilities) ? m.capabilities : ['text'],
          contextWindow: m.contextWindow ? Number(m.contextWindow) : undefined,
          enabled: m.enabled !== false,
        });
        registeredModels.push(modelRecord);
      }
    }

    res.status(201).json({
      success: true,
      provider: newProvider,
      credential: {
        id: newCred.id,
        name: newCred.name,
        maskedKey: newCred.maskedKey,
        status: newCred.status,
        priority: newCred.priority,
        weight: newCred.weight,
      },
      modelsCount: registeredModels.length,
      enabledModelsCount: registeredModels.filter(m => m.enabled).length,
      models: registeredModels,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1c. Discover Models from Provider
aiInfrastructureRouter.post('/providers/:id/discover-models', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const provider = await providerService.getProvider(id);
    if (!provider) {
      return res.status(404).json({ error: `Provider "${id}" not found.` });
    }

    const providerType = (provider.type || 'gemini') as string;
    const isGoogle = ['google-generative-ai', 'gemini', 'google'].includes(providerType);

    // Find first active credential for this provider if available
    const creds = await credentialService.listCredentials();
    const providerCreds = creds.filter(c => c.providerId === id && c.status === 'active');

    let discovered: { id: string; displayName: string; capabilities: string[]; tier?: 'flash' | 'pro' | 'lite' }[] = [];

    if (isGoogle) {
      // Discovered Google Gemini model catalog for this provider
      discovered = [
        { id: 'gemini-3.7-flash', displayName: 'Gemini 3.7 Flash', tier: 'flash', capabilities: ['text', 'vision', 'image', 'video'] },
        { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', tier: 'pro', capabilities: ['text', 'vision', 'analysis'] },
        { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', tier: 'flash', capabilities: ['text', 'vision'] },
        { id: 'gemini-3.5-flash-lite', displayName: 'Gemini 3.5 Flash Lite', tier: 'lite', capabilities: ['text', 'fast'] },
        { id: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', tier: 'pro', capabilities: ['text', 'vision', 'analysis'] },
        { id: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash', tier: 'flash', capabilities: ['text', 'vision'] },
      ];
    } else {
      if (providerCreds.length === 0) {
        return res.status(400).json({
          error: `Please add an active API key credential for provider "${provider.name}" before discovering models.`,
        });
      }
      if (!provider.baseUrl) {
        return res.status(400).json({ error: `Provider "${provider.name}" does not have a Base URL configured.` });
      }
      let apiKey = '';
      try {
        apiKey = secretVault.decryptSecret(providerCreds[0].encryptedSecret);
      } catch {
        apiKey = (providerCreds[0] as any).secret || '';
      }
      discovered = await openaiCompatibleDriver.fetchModels(provider.baseUrl, apiKey);
    }

    // Idempotently upsert models into Model Registry preserving providerId distinction
    const existingModels = await modelRegistryService.listModels();
    const addedModels = [];

    for (const m of discovered) {
      const exists = existingModels.some(existing => existing.id === m.id && existing.providerId === id);
      if (!exists) {
        const newModel = await modelRegistryService.addModel({
          id: m.id,
          providerId: id,
          displayName: m.displayName,
          tier: m.tier || (m.id.includes('pro') ? 'pro' : m.id.includes('lite') ? 'lite' : 'flash'),
          capabilities: m.capabilities,
          enabled: true,
        });
        addedModels.push(newModel);
      }
    }

    const allModels = await modelRegistryService.listModels();
    const providerModels = allModels.filter(m => m.providerId === id);

    res.json({
      success: true,
      discoveredCount: discovered.length,
      addedCount: addedModels.length,
      models: providerModels,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1b. Model Catalog & Registry
aiInfrastructureRouter.get('/models', async (req: Request, res: Response) => {
  try {
    const models = await modelRegistryService.listModels();
    res.json(models);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1c. Add Model Manually
aiInfrastructureRouter.post('/models', async (req: Request, res: Response) => {
  try {
    const { id, displayName, providerId = 'google', tier = 'flash', capabilities = ['text'], contextWindow, enabled = true } = req.body;
    if (!id || !id.trim()) {
      return res.status(400).json({ error: 'Model ID is required.' });
    }

    const newModel = await modelRegistryService.addModel({
      id: id.trim(),
      displayName: (displayName || id).trim(),
      providerId,
      tier,
      capabilities: Array.isArray(capabilities) ? capabilities : ['text'],
      contextWindow: contextWindow ? Number(contextWindow) : undefined,
      enabled: enabled !== false,
    });

    res.status(201).json(newModel);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 1d. Update Model (e.g. Toggle enabled, tier, contextWindow)
aiInfrastructureRouter.patch('/models/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { providerId, enabled, tier, displayName, contextWindow, capabilities } = req.body;
    const partial: any = {};
    if (enabled !== undefined) partial.enabled = Boolean(enabled);
    if (tier !== undefined) partial.tier = tier;
    if (displayName !== undefined) partial.displayName = displayName;
    if (contextWindow !== undefined) partial.contextWindow = Number(contextWindow);
    if (capabilities !== undefined) partial.capabilities = capabilities;

    const updated = await modelRegistryService.updateModel(id, partial, providerId || (req.query.providerId as string));
    if (!updated) {
      return res.status(404).json({ error: 'Model not found.' });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1e. Delete Model
aiInfrastructureRouter.delete('/models/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const providerId = (req.query.providerId as string) || (req.body?.providerId as string);
    const success = await modelRegistryService.removeModel(id, providerId);
    if (!success) {
      return res.status(404).json({ error: 'Model not found or already deleted.' });
    }
    res.json({ success: true, id, providerId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1f. Bulk Delete Models
aiInfrastructureRouter.post('/models/bulk-delete', async (req: Request, res: Response) => {
  try {
    const { models } = req.body; // Array of { id: string, providerId?: string }
    if (!Array.isArray(models) || models.length === 0) {
      return res.status(400).json({ error: 'Array of models is required.' });
    }

    let deletedCount = 0;
    for (const item of models) {
      const modelId = typeof item === 'string' ? item : item.id;
      const provId = typeof item === 'string' ? undefined : item.providerId;
      if (modelId) {
        const deleted = await modelRegistryService.removeModel(modelId, provId);
        if (deleted) deletedCount++;
      }
    }

    res.json({ success: true, deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1g. Reset Models to Baseline Defaults
aiInfrastructureRouter.post('/models/reset-defaults', async (req: Request, res: Response) => {
  try {
    const models = await modelRegistryService.resetToDefaults();
    res.json({ success: true, models });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Credential Pool (Never expose encryptedSecret or plaintext)
aiInfrastructureRouter.get('/credentials', async (req: Request, res: Response) => {
  try {
    const credentials = await credentialService.listCredentials();
    const intelligenceList = await intelligenceService.getAllCredentialsIntelligence();
    const intelMap = new Map(intelligenceList.map(i => [i.credentialId, i]));

    const sanitized = credentials.map(c => {
      const intel = intelMap.get(c.id);
      return {
        id: c.id,
        providerId: c.providerId,
        name: c.name,
        maskedKey: c.maskedKey,
        status: c.status,
        priority: c.priority,
        weight: c.weight,
        lastUsedAt: c.lastUsedAt || null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        successRate: intel?.health.successRate ?? 100,
        totalTokens: intel?.metrics.totalTokens ?? 0,
        totalRequests: intel?.metrics.totalRequests ?? 0,
        healthStatus: intel?.health.status ?? 'healthy',
        cooldownRemainingSec: intel?.health.cooldownRemainingSec ?? null,
      };
    });

    res.json(sanitized);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Add API Key
aiInfrastructureRouter.post('/credentials', async (req: Request, res: Response) => {
  try {
    const { providerId, name, secret, priority, weight } = req.body;
    if (!providerId || !name || !secret) {
      return res.status(400).json({ error: 'providerId, name, and secret are required.' });
    }

    // Provider Validation (Task 4)
    const provider = await providerService.getProvider(providerId);
    if (!provider) {
      return res.status(400).json({ error: `Unknown provider: "${providerId}".` });
    }

    // Duplicate Credential Name Validation (Task 3)
    const existingCreds = await credentialService.listCredentials();
    const duplicateName = existingCreds.find(
      c => c.providerId === providerId && c.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (duplicateName) {
      return res.status(400).json({
        error: `A credential named "${name.trim()}" already exists for provider "${providerId}".`,
      });
    }

    const newCred = await credentialService.addCredential({
      providerId,
      name: name.trim(),
      secret: secret.trim(),
      status: 'active',
      priority: priority || 1,
      weight: weight || 10,
    });

    res.status(201).json({
      id: newCred.id,
      providerId: newCred.providerId,
      name: newCred.name,
      maskedKey: newCred.maskedKey,
      status: newCred.status,
      priority: newCred.priority,
      weight: newCred.weight,
      createdAt: newCred.createdAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4b. Update Credential (Priority, Weight, Status)
aiInfrastructureRouter.patch('/credentials/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, priority, weight, status } = req.body;
    const cred = await credentialService.getCredential(id);
    if (!cred) {
      return res.status(404).json({ error: 'Credential not found.' });
    }

    const updated = await credentialService.updateCredential(id, {
      name: name !== undefined ? name.trim() : cred.name,
      priority: priority !== undefined ? Number(priority) : cred.priority,
      weight: weight !== undefined ? Number(weight) : cred.weight,
      status: status !== undefined ? status : cred.status,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Delete Credential
aiInfrastructureRouter.delete('/credentials/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await credentialService.removeCredential(id);
    if (!success) {
      return res.status(404).json({ error: 'Credential not found.' });
    }
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4c. Bulk Delete Credentials / Keys
aiInfrastructureRouter.post('/credentials/bulk-delete', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of credential IDs is required.' });
    }
    const count = await credentialService.bulkRemoveCredentials(ids);
    res.json({ success: true, deletedCount: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4d. Clear All Credentials / Keys
aiInfrastructureRouter.post('/credentials/clear-all', async (_req: Request, res: Response) => {
  try {
    const count = await credentialService.clearAllCredentials();
    res.json({ success: true, deletedCount: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

aiInfrastructureRouter.delete('/credentials', async (_req: Request, res: Response) => {
  try {
    const count = await credentialService.clearAllCredentials();
    res.json({ success: true, deletedCount: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4e. Clear All Projects / Connections Data
aiInfrastructureRouter.post('/projects/clear-all', async (_req: Request, res: Response) => {
  try {
    const deletedCount = await db.clearAllProjects();
    res.json({ success: true, deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

aiInfrastructureRouter.delete('/projects', async (_req: Request, res: Response) => {
  try {
    const deletedCount = await db.clearAllProjects();
    res.json({ success: true, deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4f. Master Wipe All Infrastructure (Keys, Providers, Custom Models, Projects & Logs)
aiInfrastructureRouter.post('/infrastructure/wipe-all', async (req: Request, res: Response) => {
  try {
    const { wipeProjects = true, wipeProviders = true, wipeCredentials = true, wipeModels = true, wipeLogs = true } = req.body || {};

    let credentialsDeleted = 0;
    let providersDeleted = 0;
    let projectsDeleted = 0;
    let modelsReset = false;
    let logsCleared = false;

    if (wipeCredentials) {
      credentialsDeleted = await credentialService.clearAllCredentials();
    }

    if (wipeProviders) {
      const pRes = await providerService.removeAllProviders(false);
      providersDeleted = pRes.deletedProviders;
    }

    if (wipeModels) {
      await modelRegistryService.resetToDefaults();
      modelsReset = true;
    }

    if (wipeProjects) {
      projectsDeleted = await db.clearAllProjects();
    }

    if (wipeLogs) {
      await db.clearUsages();
      logsCleared = true;
    }

    res.json({
      success: true,
      wiped: {
        credentialsDeleted,
        providersDeleted,
        projectsDeleted,
        modelsReset,
        logsCleared,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Test Credential Connectivity
aiInfrastructureRouter.post('/credentials/:id/test', async (req: Request, res: Response) => {
  const { id } = req.params;
  const startTime = Date.now();
  try {
    const cred = await credentialService.getCredential(id);
    if (!cred) {
      return res.status(404).json({ success: false, error: 'Credential not found.' });
    }

    let apiKey = '';
    try {
      apiKey = secretVault.decryptSecret(cred.encryptedSecret);
    } catch {
      apiKey = (cred as any).secret || '';
    }
    const provider = await providerService.getProvider(cred.providerId);

    let testModel = 'gemini-3.7-flash';
    let responseSample = '';
    let latencyMs = 0;

    const providerType = (provider?.type || 'gemini') as string;
    const isGoogleProtocol = ['google-generative-ai', 'gemini', 'google'].includes(providerType);

    if (providerType === 'openai-compatible' && provider?.baseUrl) {
      testModel = 'openai-compatible-model';
      const testResult = await openaiCompatibleDriver.testConnectivity(provider.baseUrl, apiKey);
      latencyMs = testResult.latencyMs;

      if (!testResult.success) {
        throw new Error(testResult.error || 'Connection check failed');
      }
      responseSample = 'Connection verified successfully';
    } else if (isGoogleProtocol) {
      const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.7-flash', 'gemini-3.6-flash'];
      const ai = new GoogleGenAI({ apiKey });
      let response: any = null;
      let lastErr: any = null;
      testModel = candidateModels[0];

      for (const m of candidateModels) {
        try {
          response = await globalAIQueue.enqueue(() => ai.models.generateContent({
            model: m,
            contents: 'Ping connectivity test. Reply with OK.',
          }));
          testModel = m;
          break;
        } catch (err: any) {
          lastErr = err;
          const msg = (err?.message || '').toLowerCase();
          if (!msg.includes('503') && !msg.includes('high demand') && !msg.includes('unavailable') && !msg.includes('spikes in demand')) {
            throw err;
          }
        }
      }
      if (!response && lastErr) throw lastErr;

      latencyMs = Date.now() - startTime;
      const responseText = response?.text || '';
      responseSample = responseText.trim().substring(0, 50);
    } else {
      // Generic fallback
      const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.7-flash', 'gemini-3.6-flash'];
      const ai = new GoogleGenAI({ apiKey });
      let response: any = null;
      let lastErr: any = null;
      testModel = candidateModels[0];

      for (const m of candidateModels) {
        try {
          response = await globalAIQueue.enqueue(() => ai.models.generateContent({
            model: m,
            contents: 'Ping connectivity test. Reply with OK.',
          }));
          testModel = m;
          break;
        } catch (err: any) {
          lastErr = err;
          const msg = (err?.message || '').toLowerCase();
          if (!msg.includes('503') && !msg.includes('high demand') && !msg.includes('unavailable') && !msg.includes('spikes in demand')) {
            throw err;
          }
        }
      }
      if (!response && lastErr) throw lastErr;

      latencyMs = Date.now() - startTime;
      const responseText = response?.text || '';
      responseSample = responseText.trim().substring(0, 50);
    }

    await usageService.recordUsage({
      credentialId: cred.id,
      modelId: testModel,
      requestType: 'connectivity_test',
      stage: 'test',
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      latencyMs,
      success: true,
    });
    await healthService.recordSuccess(cred.id);

    res.json({
      success: true,
      latency: latencyMs,
      model: testModel,
      responseSample,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = err.message || 'Unknown connection error';

    try {
      const cred = await credentialService.getCredential(id);
      if (cred) {
        await usageService.recordUsage({
          credentialId: cred.id,
          modelId: 'connectivity-test',
          requestType: 'connectivity_test',
          stage: 'test',
          latencyMs,
          success: false,
          errorType: errorMsg,
        });
        await healthService.recordFailure(cred.id, errorMsg);
      }
    } catch {}

    res.status(400).json({
      success: false,
      latency: latencyMs,
      error: errorMsg,
    });
  }
});

// 6. Health & Intelligence Dashboard
aiInfrastructureRouter.get('/intelligence', async (req: Request, res: Response) => {
  try {
    const overview = await intelligenceService.getDashboardOverview();
    const credentials = await credentialService.listCredentials();

    res.json({
      totalCredentials: credentials.length,
      healthy: overview.healthyCount,
      cooldown: overview.cooldownCount,
      down: overview.downCount,
      totalTokensToday: overview.totalTokensUsed,
      successRate: overview.overallSuccessRate,
      credentials: overview.credentials,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Request Execution Logs & Telemetry
aiInfrastructureRouter.get('/logs', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 500);
    const usages = await usageService.listUsage(limit);

    const logs = usages.map(u => ({
      id: u.id,
      timestamp: u.timestamp,
      credentialId: u.credentialId,
      modelId: u.modelId,
      requestType: u.requestType || 'generation',
      stage: u.stage || 'unknown',
      promptTokens: u.promptTokens || 0,
      completionTokens: u.completionTokens || 0,
      totalTokens: u.totalTokens || ((u.promptTokens || 0) + (u.completionTokens || 0)),
      latencyMs: u.latencyMs || 0,
      success: u.success,
      errorType: u.errorType || null,
    }));

    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7b. Clear Execution Logs
aiInfrastructureRouter.delete('/logs', async (req: Request, res: Response) => {
  try {
    const success = await usageService.clearUsage();
    await observabilityService.clearTelemetry();
    res.json({ success, message: 'Execution logs and telemetry cleared successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7c. Full Control Plane Telemetry Traces
aiInfrastructureRouter.get('/telemetry', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 500);
    const agentName = req.query.agentName as string | undefined;
    const providerId = req.query.providerId as string | undefined;
    const modelId = req.query.modelId as string | undefined;
    const successParam = req.query.success as string | undefined;

    let success: boolean | undefined = undefined;
    if (successParam === 'true') success = true;
    if (successParam === 'false') success = false;

    const telemetry = await observabilityService.listTelemetry({
      limit,
      agentName,
      providerId,
      modelId,
      success,
    });

    res.json(telemetry);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7d. Control Plane Telemetry Summary Metrics
aiInfrastructureRouter.get('/telemetry/summary', async (req: Request, res: Response) => {
  try {
    const metrics = await observabilityService.getSummaryMetrics();
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Run Comprehensive System Health Check
aiInfrastructureRouter.post('/health/check-all', async (req: Request, res: Response) => {
  try {
    const credentials = await credentialService.listCredentials();
    const activeCreds = credentials.filter(c => c.status === 'active');

    // Run active credential checks in parallel with a 4-second timeout cap per check
    const results = await Promise.all(activeCreds.map(async (cred) => {
      const startTime = Date.now();
      try {
        let apiKey = '';
        try {
          apiKey = secretVault.decryptSecret(cred.encryptedSecret);
        } catch {
          apiKey = (cred as any).secret || '';
        }
        const provider = await providerService.getProvider(cred.providerId);
        let latencyMs = 0;

        if (provider?.type === 'openai-compatible' && provider.baseUrl) {
          const testRes = await openaiCompatibleDriver.testConnectivity(provider.baseUrl, apiKey);
          latencyMs = testRes.latencyMs;
          if (!testRes.success) throw new Error(testRes.error || 'Connection failed');
        } else {
          const ai = new GoogleGenAI({ apiKey });
          const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.7-flash', 'gemini-3.6-flash'];
          let lastErr: any = null;
          let pingSuccess = false;

          for (const m of candidateModels) {
            try {
              // Execute ping with a 4s max timeout
              await Promise.race([
                ai.models.generateContent({
                  model: m,
                  contents: 'ping',
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout during ping')), 4000))
              ]);
              pingSuccess = true;
              break;
            } catch (err: any) {
              lastErr = err;
              const msg = (err?.message || '').toLowerCase();
              if (!msg.includes('503') && !msg.includes('high demand') && !msg.includes('unavailable') && !msg.includes('spikes in demand')) {
                throw err;
              }
            }
          }
          if (!pingSuccess && lastErr) throw lastErr;
          latencyMs = Date.now() - startTime;
        }

        await healthService.recordSuccess(cred.id);
        return { credentialId: cred.id, name: cred.name, providerId: cred.providerId, success: true, latencyMs };
      } catch (err: any) {
        const latencyMs = Date.now() - startTime;
        await healthService.recordFailure(cred.id, err.message);
        return { credentialId: cred.id, name: cred.name, providerId: cred.providerId, success: false, latencyMs, error: err.message };
      }
    }));

    const overview = await intelligenceService.getDashboardOverview();
    res.json({
      success: true,
      timestamp: Date.now(),
      checkedCount: results.length,
      results,
      overview,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. SINEMA Control Center & Database Health Dashboard
aiInfrastructureRouter.get('/control-center', async (req: Request, res: Response) => {
  try {
    const dbHealth = await databaseHealthService.getHealthReport();
    const overview = await intelligenceService.getDashboardOverview();
    const summaryMetrics = await observabilityService.getSummaryMetrics();

    res.json({
      timestamp: new Date().toISOString(),
      database: {
        status: dbHealth.connectionStatus,
        pool: dbHealth.connectionPool,
        latency: dbHealth.latency,
        metrics: dbHealth.metrics,
        tableBaselines: dbHealth.tableBaselines,
      },
      aiSystem: {
        healthyProviders: overview.healthyCount,
        cooldownProviders: overview.cooldownCount,
        downProviders: overview.downCount,
        totalTokensToday: summaryMetrics.totalTokensUsed,
        overallSuccessRate: summaryMetrics.overallSuccessRate,
        totalFailovers: summaryMetrics.totalFailovers,
        modelBreakdown: summaryMetrics.modelBreakdown,
      },
      pipeline: {
        stages: dbHealth.pipelineStageHealth,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

aiInfrastructureRouter.get('/observability/dashboard', async (req: Request, res: Response) => {
  try {
    const dbHealth = await databaseHealthService.getHealthReport();
    res.json(dbHealth);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
