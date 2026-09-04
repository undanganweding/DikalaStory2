import { AIModel } from '../../src/types';

export interface OpenAICompatibleExecutionParams {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  responseSchema?: any;
}

export interface OpenAICompatibleExecutionResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
}

export interface OpenAICompatibleModelInfo {
  id: string;
  displayName: string;
  capabilities: string[];
}

export const openaiCompatibleDriver = {
  /**
   * Validates and normalizes an OpenAI-compatible Base URL.
   * Enforces SSRF protections and eliminates path duplication.
   */
  validateBaseUrl(rawUrl: string): { isValid: boolean; normalizedUrl?: string; error?: string } {
    if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
      return { isValid: false, error: 'Base URL cannot be empty.' };
    }

    let trimmed = rawUrl.trim();

    // Ensure valid protocol
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return { isValid: false, error: 'Base URL must start with http:// or https://.' };
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmed);
    } catch {
      return { isValid: false, error: 'Malformed Base URL format.' };
    }

    // Reject userinfo/credentials in URL (e.g. https://user:pass@host)
    if (parsedUrl.username || parsedUrl.password) {
      return { isValid: false, error: 'Base URL must not contain embedded username or password.' };
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // SSRF Protections
    const isCloudMetadata = hostname === '169.254.169.254' || hostname === 'metadata.google.internal';
    if (isCloudMetadata) {
      return { isValid: false, error: 'Access to cloud metadata endpoints is strictly forbidden.' };
    }

    // Block 0.0.0.0
    if (hostname === '0.0.0.0') {
      return { isValid: false, error: 'Access to 0.0.0.0 is forbidden.' };
    }

    // Normalize path by stripping trailing slashes and redundant endpoint tails
    let normalized = trimmed.replace(/\/+$/, '');
    if (normalized.endsWith('/chat/completions')) {
      normalized = normalized.substring(0, normalized.length - '/chat/completions'.length);
    }

    return { isValid: true, normalizedUrl: normalized };
  },

  /**
   * Resolves the completion endpoint URL cleanly without producing /v1/v1/
   */
  resolveChatCompletionsUrl(baseUrl: string): string {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    if (cleanBase.endsWith('/chat/completions')) {
      return cleanBase;
    }
    return `${cleanBase}/chat/completions`;
  },

  /**
   * Resolves the models discovery endpoint URL
   */
  resolveModelsUrl(baseUrl: string): string {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    if (cleanBase.endsWith('/models')) {
      return cleanBase;
    }
    return `${cleanBase}/models`;
  },

  /**
   * Executes a standard OpenAI-compatible /v1/chat/completions request
   */
  async executeChatCompletion(params: OpenAICompatibleExecutionParams): Promise<OpenAICompatibleExecutionResult> {
    const { baseUrl, apiKey, model, prompt, systemInstruction, temperature = 0.7, maxTokens = 2048, timeoutMs = 30000 } = params;

    const validation = this.validateBaseUrl(baseUrl);
    if (!validation.isValid || !validation.normalizedUrl) {
      throw new Error(`Invalid Base URL: ${validation.error}`);
    }

    const endpointUrl = this.resolveChatCompletionsUrl(validation.normalizedUrl);

    // Build messages array
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    let systemMsg = systemInstruction?.trim() || '';
    let userMsg = prompt;
    if (params.responseSchema) {
      if (systemMsg.length > 0) {
        systemMsg += `\n\nCRITICAL MANDATE: Output ONLY valid JSON matching the required schema. Do NOT wrap in markdown fences.`;
      } else {
        userMsg += `\n\nCRITICAL MANDATE: Output ONLY valid JSON strictly matching the schema.`;
      }
    }

    if (systemMsg.length > 0) {
      messages.push({ role: 'system', content: systemMsg });
    }
    messages.push({ role: 'user', content: userMsg });

    const payload: any = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    if (params.responseSchema) {
      payload.response_format = { type: 'json_object' };
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        let errBodyText = '';
        try {
          const errJson = await response.json();
          errBodyText = errJson.error?.message || JSON.stringify(errJson);
        } catch {
          errBodyText = await response.text();
        }

        const sanitizedStatus = this.mapHttpStatus(response.status, errBodyText);
        throw new Error(`OpenAI-compatible provider error (${response.status}): ${sanitizedStatus}`);
      }

      const json = await response.json();
      const text = json.choices?.[0]?.message?.content || json.choices?.[0]?.text || '';

      // Extract or estimate tokens
      const promptTokens = json.usage?.prompt_tokens ?? Math.round(prompt.length / 4);
      const completionTokens = json.usage?.completion_tokens ?? Math.round(text.length / 4);
      const totalTokens = json.usage?.total_tokens ?? (promptTokens + completionTokens);

      return {
        text,
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`OpenAI-compatible request timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Fetches the available models list via GET /v1/models
   */
  async fetchModels(baseUrl: string, apiKey: string, timeoutMs: number = 10000): Promise<OpenAICompatibleModelInfo[]> {
    const validation = this.validateBaseUrl(baseUrl);
    if (!validation.isValid || !validation.normalizedUrl) {
      throw new Error(`Invalid Base URL: ${validation.error}`);
    }

    const endpointUrl = this.resolveModelsUrl(validation.normalizedUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpointUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        let errText = '';
        try {
          const errJson = await response.json();
          errText = errJson.error?.message || JSON.stringify(errJson);
        } catch {
          errText = await response.text();
        }
        throw new Error(`Model discovery failed (${response.status}): ${errText}`);
      }

      const json = await response.json();
      const rawList = Array.isArray(json.data) ? json.data : Array.isArray(json.models) ? json.models : [];

      return rawList
        .filter((m: any) => m && (typeof m === 'string' || m.id))
        .map((m: any) => {
          const id = typeof m === 'string' ? m.trim() : String(m.id || '').trim();
          const rawName = m.name && typeof m.name === 'string' ? m.name.trim() : '';
          const displayName = rawName || id;
          return {
            id,
            displayName,
            capabilities: ['text'],
          };
        })
        .filter((m: any) => m.id.length > 0);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Model discovery timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Tests connectivity to an OpenAI-compatible endpoint with minimal latency
   */
  async testConnectivity(baseUrl: string, apiKey: string): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const startTime = Date.now();
    try {
      // First attempt fast /models discovery ping
      try {
        await this.fetchModels(baseUrl, apiKey, 5000);
        return {
          success: true,
          latencyMs: Date.now() - startTime,
        };
      } catch {
        // Fallback: minimal chat test
        await this.executeChatCompletion({
          baseUrl,
          apiKey,
          model: 'gpt-3.5-turbo',
          prompt: 'ping',
          maxTokens: 1,
          timeoutMs: 5000,
        });
        return {
          success: true,
          latencyMs: Date.now() - startTime,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: err.message || 'Connectivity check failed',
      };
    }
  },

  mapHttpStatus(status: number, message: string): string {
    switch (status) {
      case 400:
        return `Bad Request - ${message}`;
      case 401:
        return 'Authentication Failed: Invalid API Key or token.';
      case 403:
        return 'Forbidden: Access denied to requested model or resource.';
      case 404:
        return 'Not Found: Endpoint or Model ID does not exist.';
      case 408:
        return 'Request Timeout from upstream provider.';
      case 429:
        return 'Rate Limit / Quota Exceeded.';
      case 500:
      case 502:
      case 503:
      case 504:
        return `Upstream Provider Service Failure (${status}): ${message}`;
      default:
        return message || `HTTP Error ${status}`;
    }
  },
};
