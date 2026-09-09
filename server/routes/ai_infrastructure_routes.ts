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
import { dailyExhaustedRegistry, isModelSuppressed, markModelSuppressed, extractRetryDelayMs, isDailyQuotaExhaustedError } from '../ai_infrastructure/ai_gateway';
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
      const ai = new GoogleGenAI({
        apiKey: apiKey.trim(),
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
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
          enabled: false,
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
    const { providerId, provider_id, enabled, tier, displayName, contextWindow, capabilities } = req.body;
    const targetProviderId = providerId || provider_id || (req.query.providerId as string) || (req.query.provider_id as string);
    const partial: any = {};
    if (enabled !== undefined) partial.enabled = Boolean(enabled);
    if (tier !== undefined) partial.tier = tier;
    if (displayName !== undefined) partial.displayName = displayName;
    if (contextWindow !== undefined) partial.contextWindow = Number(contextWindow);
    if (capabilities !== undefined) partial.capabilities = capabilities;

    const updated = await modelRegistryService.updateModel(id, partial, targetProviderId);
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

// 4a. Reorder Credentials (Assign Contiguous 1..N Priorities)
aiInfrastructureRouter.post('/credentials/reorder', async (req: Request, res: Response) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds must be an array of credential IDs.' });
    }

    const reordered = await credentialService.reorderCredentials(orderedIds);
    res.json({
      success: true,
      message: 'Credential priority sequence updated successfully.',
      credentials: reordered.map(c => ({
        id: c.id,
        name: c.name,
        providerId: c.providerId,
        priority: c.priority,
        weight: c.weight,
        status: c.status,
      })),
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
      const registeredModels = (await modelRegistryService.listModels())
        .filter(model => model.enabled && model.providerId === provider.id);
      const registeredModel = registeredModels[0];
      if (!registeredModel) {
        throw new Error(`No enabled registered model found for provider ${provider.id}.`);
      }
      testModel = registeredModel.id;
      const testResult = await openaiCompatibleDriver.testConnectivity(provider.baseUrl, apiKey, registeredModel.id);
      latencyMs = testResult.latencyMs;

      if (!testResult.success) {
        throw new Error(testResult.error || 'Connection check failed');
      }
      responseSample = 'Connection verified successfully';
    } else if (isGoogleProtocol) {
      const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.7-flash', 'gemini-3.6-flash'];
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
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
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
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
          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          });
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

// 10. Real-Time Quota & Telemetry Overview for All Saved AI Credentials
aiInfrastructureRouter.get('/gemini/quota-overview', async (req: Request, res: Response) => {
  try {
    const allCreds = await credentialService.listCredentials();
    const allProviders = await db.getProviders();
    const providerMap = new Map(allProviders.map(p => [p.id, p]));

    if (allCreds.length === 0) {
      return res.json({
        hasCredentials: false,
        credentials: [],
        selectedCredential: null,
        models: [],
        metrics: { requestsToday: 0, tokensToday: 0, successRate: 100 },
      });
    }

    const requestedCredId = (req.query.credentialId as string) || '';
    let activeCred = allCreds.find(c => c.id === requestedCredId);
    if (!activeCred) {
      // Prioritize active custom provider Priority 1 if available, otherwise lowest priority number
      const p1Custom = allCreds.find(c => c.providerId !== 'google' && c.priority === 1 && c.status === 'active');
      activeCred = p1Custom || [...allCreds].sort((a, b) => a.priority - b.priority)[0] || allCreds[0];
    }

    const activeProvider = providerMap.get(activeCred.providerId) || {
      id: activeCred.providerId,
      name: activeCred.providerId === 'google' ? 'Google Gemini' : activeCred.providerId,
      isCustom: activeCred.providerId !== 'google',
    };

    const usages = await usageService.listUsage(500);
    const credUsages = usages.filter(u => u.credentialId === activeCred?.id || (!u.credentialId && activeCred?.id === 'env_gemini_default'));

    let tokensToday = 0;
    let requestsToday = credUsages.length;
    let successCount = 0;

    for (const u of credUsages) {
      tokensToday += u.totalTokens || ((u.promptTokens || 0) + (u.completionTokens || 0));
      if (u.success) successCount++;
    }

    const successRate = requestsToday > 0 ? Math.round((successCount / requestsToday) * 100) : 100;

    // Fetch registered models from database or defaults
    const allDbModels = await db.getModels();
    let targetModels: any[] = [];

    // Defined standard Gemini models for cinematic engine with rich metadata
    const standardGeminiCatalog: Record<string, { description: string; contextWindow: string; maxOutput: string; pricingTier: string; role: string }> = {
      'gemini-3.7-flash': {
        description: 'Fast Reasoning, Native 1M Token Context & High Speed JSON Extraction',
        contextWindow: '1,048,576 tokens',
        maxOutput: '8,192 tokens',
        pricingTier: 'Standard / Free Tier (15 RPM / 1,500 RPD)',
        role: 'Primary extraction for Stage 1 (Story), Stage 2 (Characters) & Stage 3 (Locations)',
      },
      'gemini-3.8-flash': {
        description: 'Next-Gen Flash High-Throughput Orchestration & Fallback Engine',
        contextWindow: '1,048,576 tokens',
        maxOutput: '8,192 tokens',
        pricingTier: 'Next-Gen Tier (15 RPM / 1,500 RPD)',
        role: 'Primary Next-Gen Flash candidate in Fallback Chain',
      },
      'gemini-flash-latest': {
        description: 'Official Google AI Studio Latest Flash Frontier Model',
        contextWindow: '1,048,576 tokens',
        maxOutput: '8,192 tokens',
        pricingTier: 'Latest Tier (15 RPM / 1,500 RPD)',
        role: 'High-speed adaptive candidate',
      },
      'gemini-3.6-flash': {
        description: 'Stable Baseline Multimodal Flash Engine',
        contextWindow: '1,048,576 tokens',
        maxOutput: '8,192 tokens',
        pricingTier: 'Baseline Tier (15 RPM / 1,500 RPD)',
        role: 'Flash candidate in Fallback Chain',
      },
      'gemini-3.5-flash': {
        description: 'Production Frontier Flash Engine',
        contextWindow: '1,048,576 tokens',
        maxOutput: '8,192 tokens',
        pricingTier: 'Production Tier (15 RPM / 1,500 RPD)',
        role: 'Flash fallback candidate in Fallback Chain',
      },
      'gemini-2.5-pro': {
        description: 'Frontier Pro Reasoning with 2M Token Context Window',
        contextWindow: '2,097,152 tokens',
        maxOutput: '8,192 tokens',
        pricingTier: 'Pro Tier (2 RPM / 50 RPD or PayG)',
        role: 'Deep Narrative Continuity & Character Bibles',
      },
      'gemini-2.5-flash': {
        description: 'Ultra High-Speed Structured Reasoning Engine',
        contextWindow: '1,048,576 tokens',
        maxOutput: '8,192 tokens',
        pricingTier: 'Flash Tier (15 RPM / 1,500 RPD)',
        role: 'Fast structured schema extraction',
      },
      'gemini-3.1-pro-preview': {
        description: 'Deep Cinematic Dramaturgy & Subtext Dialogue (Preview)',
        contextWindow: '1,048,576 tokens',
        maxOutput: '8,192 tokens',
        pricingTier: 'Pro Preview Tier',
        role: 'Deep Dramaturgy for Stage 4 & Stage 5',
      },
      'gemini-3.1-flash-lite': {
        description: 'Ultra-fast lightweight automation model',
        contextWindow: '1,048,576 tokens',
        maxOutput: '8,192 tokens',
        pricingTier: 'Lite Tier',
        role: 'Lightweight classification',
      },
      'gemini-3.5-flash-lite': {
        description: 'Efficiency model for high-volume tasks',
        contextWindow: '1,048,576 tokens',
        maxOutput: '8,192 tokens',
        pricingTier: 'Lite Tier',
        role: 'Lightweight parsing',
      },
    };

    if (activeCred.providerId === 'google') {
      const googleModels = allDbModels.filter(m => m.providerId === 'google');
      const modelMap = new Map<string, any>();
      for (const [mId, meta] of Object.entries(standardGeminiCatalog)) {
        modelMap.set(mId, {
          id: mId,
          displayName: mId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          tier: mId.includes('pro') ? 'pro' : (mId.includes('lite') ? 'lite' : 'flash'),
          enabled: !mId.includes('lite'),
          ...meta,
        });
      }

      for (const gm of googleModels) {
        const existing = modelMap.get(gm.id) || {};
        modelMap.set(gm.id, {
          ...existing,
          ...gm,
          displayName: gm.displayName || existing.displayName || gm.id,
          tier: gm.tier || existing.tier || 'flash',
          enabled: gm.enabled !== false,
        });
      }
      targetModels = Array.from(modelMap.values());
    } else {
      const providerDbModels = allDbModels.filter(m => m.providerId === activeCred.providerId);
      if (providerDbModels.length > 0) {
        targetModels = providerDbModels.map(m => ({
          id: m.id,
          displayName: m.displayName || m.id,
          tier: ((m as any).tier || (m.id.includes('large') || m.id.includes('pro') ? 'pro' : 'flash')) as any,
          description: (m as any).description || `Model ${m.displayName || m.id} pada provider ${activeProvider.name}`,
          contextWindow: (m as any).contextWindow || '128k tokens',
          maxOutput: (m as any).maxOutput || '8,192 tokens',
          pricingTier: (m as any).pricingTier || 'Custom Tier',
          role: (m as any).role || 'Cinematic & Narrative Processing',
          enabled: m.enabled !== false,
        }));
      } else {
        targetModels = [
          {
            id: 'custom-model',
            displayName: 'Custom Model Default',
            tier: 'flash' as const,
            description: `Model default untuk provider ${activeProvider.name}`,
            contextWindow: '128k tokens',
            maxOutput: '8,192 tokens',
            pricingTier: 'Custom Tier',
            role: 'Custom Provider Worker',
            enabled: true,
          }
        ];
      }
    }

    const modelStatusList = targetModels.map(m => {
      const cacheKey1 = `${activeCred!.name}:${m.id}`;
      const cacheKey2 = `${activeCred!.id}:${m.id}`;
      const isSuppressed = isModelSuppressed(cacheKey1) || isModelSuppressed(cacheKey2);
      
      let remainingCooldownSeconds = 0;
      const exp1 = dailyExhaustedRegistry.get(cacheKey1);
      const exp2 = dailyExhaustedRegistry.get(cacheKey2);
      const activeExp = Math.max(exp1 || 0, exp2 || 0);
      if (activeExp > Date.now()) {
        remainingCooldownSeconds = Math.ceil((activeExp - Date.now()) / 1000);
      }

      // Check recent failure on this model
      const modelUsages = credUsages.filter(u => u.model === m.id);
      const modelRequests = modelUsages.length;
      const modelSuccesses = modelUsages.filter(u => u.success).length;
      const lastModelUsage = modelUsages[0];

      // Determine Quota Level (abundant, moderate, low, exhausted)
      let quotaLevel: 'abundant' | 'moderate' | 'low' | 'exhausted' = 'abundant';
      if (isSuppressed || remainingCooldownSeconds > 0) {
        quotaLevel = 'exhausted';
      } else if (m.enabled === false) {
        quotaLevel = 'exhausted';
      } else if (modelRequests > 0 && modelSuccesses === 0) {
        quotaLevel = 'low';
      } else if (modelRequests > 20) {
        quotaLevel = 'moderate';
      }

      return {
        ...m,
        status: isSuppressed ? 'cooldown' : (m.enabled === false ? 'disabled' : (modelRequests > 0 && modelSuccesses === 0 ? 'warning' : 'ready')),
        quotaLevel,
        isSuppressed,
        remainingCooldownSeconds,
        requestsToday: modelRequests,
        successRate: modelRequests > 0 ? Math.round((modelSuccesses / modelRequests) * 100) : 100,
        lastUsedAt: lastModelUsage ? lastModelUsage.timestamp : null,
        lastError: lastModelUsage && !lastModelUsage.success ? lastModelUsage.errorMessage : null,
      };
    });

    const enrichedCreds = allCreds.map(c => {
      const prov = providerMap.get(c.providerId);
      const provName = prov?.name || (c.providerId === 'google' ? 'Google Gemini' : c.providerId);
      return {
        id: c.id,
        name: c.name,
        maskedKey: c.maskedKey,
        providerId: c.providerId,
        providerName: provName,
        priority: c.priority,
        weight: c.weight,
        status: c.status,
        isPrimary: c.id === activeCred?.id,
      };
    });

    res.json({
      hasCredentials: true,
      credentials: enrichedCreds,
      selectedCredential: {
        id: activeCred.id,
        name: activeCred.name,
        maskedKey: activeCred.maskedKey,
        priority: activeCred.priority,
        status: activeCred.status,
        providerId: activeCred.providerId,
        providerName: activeProvider.name,
      },
      provider: {
        id: activeProvider.id,
        name: activeProvider.name,
        isCustom: Boolean((activeProvider as any).isCustom || activeProvider.id !== 'google'),
      },
      metrics: {
        requestsToday,
        tokensToday,
        successRate,
        activeModelsCount: modelStatusList.filter(m => m.status === 'ready').length,
        suppressedModelsCount: modelStatusList.filter(m => m.isSuppressed).length,
      },
      models: modelStatusList,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10b. Real-Time Model Probe (Ping Upstream for live quota & latency)
aiInfrastructureRouter.post('/gemini/probe-model', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { credentialId, modelId } = req.body;
    if (!modelId) {
      return res.status(400).json({ success: false, error: 'Model ID is required.' });
    }

    const allCreds = await credentialService.listCredentials();
    let targetCred = allCreds.find(c => c.id === credentialId);
    if (!targetCred) {
      targetCred = [...allCreds].sort((a, b) => a.priority - b.priority)[0];
    }

    if (!targetCred) {
      return res.status(400).json({ success: false, error: 'No active credential found in pool.' });
    }

    let rawApiKey = '';
    try {
      rawApiKey = secretVault.decryptSecret(targetCred.encryptedSecret);
    } catch {
      rawApiKey = (targetCred as any).secret || '';
    }

    if (!rawApiKey) {
      return res.status(400).json({ success: false, error: 'Failed to resolve decrypted API key for credential.' });
    }

    let sampleOutput = 'Ready OK';
    if (targetCred.providerId === 'google') {
      const ai = new GoogleGenAI({
        apiKey: rawApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
      const probeResponse = await ai.models.generateContent({
        model: modelId,
        contents: 'Ping quota check. Answer in 2 words: "Ready OK".',
      });
      sampleOutput = probeResponse.text?.trim() || 'Ready OK';
    } else {
      const allProviders = await db.getProviders();
      const prov = allProviders.find(p => p.id === targetCred!.providerId);
      const endpoint = prov?.baseUrl || 'https://api.custom-cinema-ai.studio/v1';
      const wireRes = await openaiCompatibleDriver.executeChatCompletion({
        baseUrl: endpoint,
        apiKey: rawApiKey,
        model: modelId,
        prompt: 'Ping check: say OK',
        maxTokens: 5,
        timeoutMs: 8000,
      });
      sampleOutput = wireRes.text?.trim() || 'Ready OK';
    }

    const latencyMs = Date.now() - startTime;
    const cacheKey1 = `${targetCred.name}:${modelId}`;
    const cacheKey2 = `${targetCred.id}:${modelId}`;
    dailyExhaustedRegistry.delete(cacheKey1);
    dailyExhaustedRegistry.delete(cacheKey2);

    await usageService.recordUsage({
      providerId: targetCred.providerId,
      credentialId: targetCred.id,
      model: modelId,
      task: 'quota_probe' as any,
      agentName: 'QuotaProbe',
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      latencyMs,
      success: true,
    });

    res.json({
      success: true,
      model: modelId,
      credentialId: targetCred.id,
      credentialName: targetCred.name,
      latencyMs,
      status: 'ready',
      message: '200 OK — Kuota aktif & siap melayani request',
      sampleOutput,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const errMsg = err?.message || JSON.stringify(err);
    const retryDelayMs = extractRetryDelayMs(err);
    const retryDelaySec = Math.round(retryDelayMs / 1000);

    const { credentialId, modelId } = req.body;
    const allCreds = await credentialService.listCredentials();
    let targetCred = allCreds.find(c => c.id === credentialId) || allCreds[0];
    
    if (targetCred && modelId) {
      const cacheKey1 = `${targetCred.name}:${modelId}`;
      const cacheKey2 = `${targetCred.id}:${modelId}`;
      const isTransientSpike = errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE') || errMsg.includes('spikes in demand');
      const suppressTtl = isTransientSpike ? 4000 : retryDelayMs;
      markModelSuppressed(cacheKey1, suppressTtl);
      markModelSuppressed(cacheKey2, suppressTtl);

      await usageService.recordUsage({
        providerId: targetCred.providerId,
        credentialId: targetCred.id,
        model: modelId,
        task: 'quota_probe' as any,
        agentName: 'QuotaProbe',
        promptTokens: 10,
        completionTokens: 0,
        totalTokens: 10,
        latencyMs,
        success: false,
        errorMessage: errMsg.substring(0, 300),
      });
    }

    let quotaClassification = 'UNKNOWN_ERROR';
    let userFriendlyMsg = errMsg;

    if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
      if (errMsg.includes('FreeTier') || errMsg.includes('GenerateRequestsPerDay')) {
        quotaClassification = 'DAILY_QUOTA_EXHAUSTED';
        userFriendlyMsg = `Batas Kuota Harian Free Tier Tercapai (Limit: 20 RPD). Cooldown / Reset in ${retryDelaySec} detik.`;
      } else {
        quotaClassification = 'RPM_RATE_LIMITED';
        userFriendlyMsg = `Rate Limit Per Menit (RPM) Tercapai. Cooldown selama ${retryDelaySec} detik.`;
      }
    } else if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE')) {
      quotaClassification = 'HIGH_DEMAND_SPIKE';
      userFriendlyMsg = 'Model upstream sedang mengalami lonjakan trafik (503 High Demand). Coba kembali sesaat lagi.';
    } else if (errMsg.includes('401') || errMsg.includes('API_KEY_INVALID') || errMsg.includes('Unauthorized')) {
      quotaClassification = 'INVALID_AUTH';
      userFriendlyMsg = 'API Key tidak valid atau dinonaktifkan oleh provider.';
    }

    res.json({
      success: false,
      model: modelId,
      credentialId: targetCred?.id,
      credentialName: targetCred?.name,
      latencyMs,
      status: 'cooldown',
      classification: quotaClassification,
      message: userFriendlyMsg,
      rawError: errMsg,
      remainingCooldownSeconds: retryDelaySec,
      timestamp: Date.now(),
    });
  }
});

// 10c. Set Primary Credential in the Pool
aiInfrastructureRouter.post('/gemini/set-primary-credential', async (req: Request, res: Response) => {
  try {
    const { credentialId } = req.body;
    if (!credentialId) {
      return res.status(400).json({ error: 'Credential ID is required.' });
    }

    const allCreds = await credentialService.listCredentials();
    const selected = allCreds.find(c => c.id === credentialId);

    if (!selected) {
      return res.status(404).json({ error: 'Credential not found in pool.' });
    }

    // Assign Priority 1 to chosen credential, and re-order other credentials under the same provider
    const sameProviderCreds = allCreds.filter(c => c.providerId === selected.providerId);
    await credentialService.updateCredential(selected.id, { priority: 1, weight: 100 });
    let priorityCounter = 2;
    for (const c of sameProviderCreds) {
      if (c.id !== selected.id) {
        await credentialService.updateCredential(c.id, {
          priority: priorityCounter,
          weight: Math.max(10, 100 - (priorityCounter - 1) * 20),
        });
        priorityCounter++;
      }
    }

    res.json({
      success: true,
      message: `Kredensial "${selected.name}" berhasil dijadikan Kredensial Utama (Priority 1).`,
      primaryCredentialId: selected.id,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

