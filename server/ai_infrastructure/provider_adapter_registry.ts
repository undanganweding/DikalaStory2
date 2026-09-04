import { GoogleGenAI } from '@google/genai';
import { openaiCompatibleDriver } from './openai_compatible_driver';
import { AIProvider } from '../../src/types';

export interface ProviderExecutionAdapter {
  execute(params: {
    provider: AIProvider;
    apiKey: string;
    model: string;
    prompt: string;
    systemInstruction?: string;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
    responseSchema?: any;
  }): Promise<{
    text: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
  }>;

  testConnection(provider: AIProvider, apiKey: string): Promise<{
    success: boolean;
    latencyMs: number;
    error?: string;
  }>;

  /**
   * Fetch available models for this protocol. Returns null when the
   * protocol does not support automatic discovery (manual input required).
   */
  discoverModels?(provider: AIProvider, apiKey: string): Promise<{
    models: Array<{ id: string; displayName: string; capabilities: string[] }>;
  } | null>;
}

/**
 * Canonical provider protocol registry. Single source of truth for the UI
 * dropdown, validation, and adapter resolution. No hardcoded provider names.
 */
export const PROVIDER_PROTOCOLS: Array<{ id: string; label: string; supportsDiscovery: boolean; baseUrlRequired: boolean }> = [
  { id: 'google-generative-ai', label: 'Google Generative AI (Gemini)', supportsDiscovery: true, baseUrlRequired: false },
  { id: 'openai-compatible', label: 'OpenAI-Compatible', supportsDiscovery: true, baseUrlRequired: true },
  { id: 'anthropic-compatible', label: 'Anthropic-Compatible', supportsDiscovery: false, baseUrlRequired: false },
  { id: 'ollama', label: 'Ollama (Local)', supportsDiscovery: true, baseUrlRequired: false },
  { id: 'custom-http', label: 'Custom HTTP', supportsDiscovery: false, baseUrlRequired: true },
];

/**
 * Legacy provider IDs / type values that must map onto canonical protocols.
 * This is a compatibility mapping ONLY — it never controls execution.
 */
export function normalizeLegacyProtocol(value?: string | null): string {
  const v = (value || '').toLowerCase().trim();
  switch (v) {
    case 'google':
    case 'gemini':
      return 'google-generative-ai';
    case 'openai':
    case 'openrouter':
    case 'xai':
    case 'custom_openai':
      return 'openai-compatible';
    case 'anthropic':
      return 'anthropic-compatible';
    default:
      return v;
  }
}

const googleGenerativeAIAdapter: ProviderExecutionAdapter = {
  async execute({ provider, apiKey, model, prompt, systemInstruction, temperature, maxTokens, timeoutMs, responseSchema }) {
    const ai = new GoogleGenAI({ apiKey });
    const startTime = Date.now();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI Request Timeout')), timeoutMs || 30000)
    );
    const config: any = {
      systemInstruction,
      temperature: temperature ?? 0.7,
      maxOutputTokens: maxTokens ?? 2048,
    };
    if (responseSchema) {
      config.responseMimeType = 'application/json';
      config.responseSchema = responseSchema;
    }
    const generatePromise = ai.models.generateContent({
      model,
      contents: prompt,
      config,
    });
    const response: any = await Promise.race([generatePromise, timeoutPromise]);
    const latencyMs = Date.now() - startTime;
    const text = response.text || '';
    const promptStr = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
    return {
      text,
      promptTokens: Math.round(promptStr.length / 4),
      completionTokens: Math.round(text.length / 4),
      totalTokens: Math.round((promptStr.length + text.length) / 4),
      latencyMs,
    };
  },

  async testConnection(provider, apiKey) {
    const startTime = Date.now();
    try {
      const ai = new GoogleGenAI({ apiKey });
      const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.7-flash', 'gemini-3.1-flash-lite'];
      let lastErr: any = null;
      let ok = false;
      for (const m of candidateModels) {
        try {
          await ai.models.generateContent({
            model: m,
            contents: 'Ping connectivity test. Reply with OK.',
          });
          ok = true;
          break;
        } catch (err: any) {
          lastErr = err;
          const msg = (err?.message || '').toLowerCase();
          if (!msg.includes('503') && !msg.includes('high demand') && !msg.includes('unavailable') && !msg.includes('spikes in demand')) {
            throw err;
          }
        }
      }
      if (!ok && lastErr) throw lastErr;
      return { success: true, latencyMs: Date.now() - startTime };
    } catch (err: any) {
      return { success: false, latencyMs: Date.now() - startTime, error: err.message };
    }
  },

  async discoverModels(provider, apiKey) {
    const ai = new GoogleGenAI({ apiKey });
    const response: any = await ai.models.list();
    const models = (response.page || response.models || response || [])
      .filter((m: any) => m && m.name)
      .map((m: any) => {
        const rawName: string = m.name || '';
        const id = rawName.replace(/^models\//, '');
        const actions = m.supportedActions || m.supportedGenerationMethods || [];
        const capabilities: string[] = ['text'];
        if (actions.includes('generateContent')) capabilities.push('text');
        if (actions.includes('countTokens')) capabilities.push('vision');
        return { id, displayName: m.displayName || id, capabilities };
      })
      .filter((m: any) => m.id && !m.id.includes('embedding'));
    return { models };
  },
};

const openaiCompatibleAdapter: ProviderExecutionAdapter = {
  async execute({ provider, apiKey, model, prompt, systemInstruction, temperature, maxTokens, timeoutMs, responseSchema }) {
    const baseUrl = provider.baseUrl || '';
    return openaiCompatibleDriver.executeChatCompletion({
      baseUrl,
      apiKey,
      model,
      prompt,
      systemInstruction,
      temperature,
      maxTokens,
      timeoutMs,
      responseSchema,
    });
  },

  async testConnection(provider, apiKey) {
    const baseUrl = provider.baseUrl || '';
    return openaiCompatibleDriver.testConnectivity(baseUrl, apiKey);
  },

  async discoverModels(provider, apiKey) {
    if (!provider.baseUrl) return null;
    const models = await openaiCompatibleDriver.fetchModels(provider.baseUrl, apiKey);
    return { models: models.map(m => ({ id: m.id, displayName: m.displayName, capabilities: m.capabilities })) };
  },
};

const anthropicCompatibleAdapter: ProviderExecutionAdapter = {
  async execute({ provider, apiKey, model, prompt, systemInstruction, maxTokens, timeoutMs }) {
    const baseUrl = provider.baseUrl || 'https://api.anthropic.com';
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs || 30000);
    try {
      const messages: Array<{ role: string; content: string }> = [{ role: 'user', content: prompt }];
      const payload: any = {
        model,
        max_tokens: maxTokens || 2048,
        messages,
      };
      if (systemInstruction) {
        payload.system = systemInstruction;
      }
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const latencyMs = Date.now() - startTime;
      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`Anthropic API error (${response.status}): ${errBody}`);
      }
      const json = await response.json();
      const text = json.content?.[0]?.text || '';
      const promptTokens = json.usage?.input_tokens || Math.round(prompt.length / 4);
      const completionTokens = json.usage?.output_tokens || Math.round(text.length / 4);
      return { text, promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, latencyMs };
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async testConnection(provider, apiKey) {
    const startTime = Date.now();
    try {
      const baseUrl = provider.baseUrl || 'https://api.anthropic.com';
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
        signal: AbortSignal.timeout(10000),
      });
      return { success: response.ok, latencyMs: Date.now() - startTime, error: response.ok ? undefined : `HTTP ${response.status}` };
    } catch (err: any) {
      return { success: false, latencyMs: Date.now() - startTime, error: err.message };
    }
  },
};

const ollamaAdapter: ProviderExecutionAdapter = {
  async execute({ provider, apiKey, model, prompt, systemInstruction, temperature, maxTokens, timeoutMs }) {
    const baseUrl = provider.baseUrl || 'http://localhost:11434';
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs || 60000);
    try {
      const messages: Array<{ role: string; content: string }> = [];
      if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
      messages.push({ role: 'user', content: prompt });
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: false, options: { temperature: temperature ?? 0.7, num_predict: maxTokens ?? 2048 } }),
        signal: controller.signal,
      });
      const latencyMs = Date.now() - startTime;
      if (!response.ok) throw new Error(`Ollama API error (${response.status})`);
      const json = await response.json();
      const text = json.message?.content || '';
      return { text, promptTokens: 0, completionTokens: 0, totalTokens: 0, latencyMs };
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async testConnection(provider, apiKey) {
    const startTime = Date.now();
    try {
      const baseUrl = provider.baseUrl || 'http://localhost:11434';
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return { success: response.ok, latencyMs: Date.now() - startTime, error: response.ok ? undefined : `HTTP ${response.status}` };
    } catch (err: any) {
      return { success: false, latencyMs: Date.now() - startTime, error: err.message };
    }
  },
};

const customHttpAdapter: ProviderExecutionAdapter = {
  async execute({ provider, apiKey, model, prompt, systemInstruction, maxTokens, timeoutMs }) {
    const baseUrl = provider.baseUrl || '';
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs || 30000);
    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ model, prompt, systemInstruction, max_tokens: maxTokens || 2048 }),
        signal: controller.signal,
      });
      const latencyMs = Date.now() - startTime;
      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`Custom HTTP provider error (${response.status}): ${errBody}`);
      }
      const json = await response.json();
      const text = json.response || json.text || json.content || json.output || '';
      return { text, promptTokens: 0, completionTokens: 0, totalTokens: 0, latencyMs };
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async testConnection(provider, apiKey) {
    const startTime = Date.now();
    try {
      const baseUrl = provider.baseUrl || '';
      const response = await fetch(baseUrl.replace(/\/+$/, ''), { signal: AbortSignal.timeout(5000) });
      return { success: response.ok, latencyMs: Date.now() - startTime, error: response.ok ? undefined : `HTTP ${response.status}` };
    } catch (err: any) {
      return { success: false, latencyMs: Date.now() - startTime, error: err.message };
    }
  },
};

/**
 * Resolve a ProviderExecutionAdapter based on the provider's protocol.
 * Falls back to google-generative-ai for the built-in google provider
 * and to openai-compatible for any unknown protocol.
 */
export function resolveProviderAdapter(provider: AIProvider): ProviderExecutionAdapter {
  const protocol = normalizeLegacyProtocol(provider.protocol || provider.type).toLowerCase();

  switch (protocol) {
    case 'google-generative-ai':
    case 'gemini':
      return googleGenerativeAIAdapter;
    case 'openai-compatible':
      return openaiCompatibleAdapter;
    case 'anthropic':
    case 'anthropic-compatible':
      return anthropicCompatibleAdapter;
    case 'ollama':
      return ollamaAdapter;
    case 'custom-http':
      return customHttpAdapter;
    default:
      // If the provider has a baseUrl, treat as openai-compatible; otherwise google-generative-ai
      if (provider.baseUrl) {
        return openaiCompatibleAdapter;
      }
      return googleGenerativeAIAdapter;
  }
}

/**
 * Convenience helper that returns the adapter type label for display.
 */
export function getAdapterLabel(protocol: string): string {
  switch (normalizeLegacyProtocol(protocol).toLowerCase()) {
    case 'google-generative-ai':
    case 'gemini':
      return 'Google Generative AI';
    case 'openai-compatible':
      return 'OpenAI-Compatible';
    case 'anthropic':
    case 'anthropic-compatible':
      return 'Anthropic-Compatible';
    case 'ollama':
      return 'Ollama';
    case 'custom-http':
      return 'Custom HTTP';
    default:
      return protocol || 'Unknown';
  }
}