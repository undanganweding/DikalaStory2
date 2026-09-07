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
    const { baseUrl, apiKey, model, prompt, systemInstruction, temperature = 0.7, maxTokens = 2048, timeoutMs = 45000 } = params;

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

    const maskedKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(Math.max(0, apiKey.length - 4))}` : 'none';
    console.log(`\n🌐 [WIRE DISPATCH: OPENAI-COMPATIBLE]`);
    console.log(`  endpoint: ${endpointUrl}`);
    console.log(`  model:    ${model}`);
    console.log(`  auth:     Bearer ${maskedKey}`);
    console.log(`  timeout:  ${timeoutMs}ms`);

    try {
      let response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey ? `Bearer ${apiKey}` : 'Bearer sk-custom-token',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      // Fallback if provider/proxy (like 9router or older models) rejects response_format
      if (!response.ok && payload.response_format && (response.status === 400 || response.status === 422)) {
        const rawErr = await response.text();
        if (rawErr.toLowerCase().includes('response_format') || rawErr.toLowerCase().includes('json_object') || rawErr.toLowerCase().includes('unsupported')) {
          delete payload.response_format;
          response = await fetch(endpointUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': apiKey ? `Bearer ${apiKey}` : 'Bearer sk-custom-token',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
        } else {
          const sanitizedStatus = this.mapHttpStatus(response.status, rawErr);
          throw new Error(`OpenAI-compatible provider error (${response.status}): ${sanitizedStatus}`);
        }
      }

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        let errBodyText = '';
        try {
          const rawText = await response.text();
          try {
            const errJson = JSON.parse(rawText);
            errBodyText = errJson.error?.message || JSON.stringify(errJson);
          } catch {
            errBodyText = rawText;
          }
        } catch (readErr: any) {
          errBodyText = `(failed to read response: ${readErr?.message || String(readErr)})`;
        }

        const sanitizedStatus = this.mapHttpStatus(response.status, errBodyText);
        console.log(`  ❌ WIRE ERROR: HTTP ${response.status} - ${sanitizedStatus} (${latencyMs}ms)\n`);
        throw new Error(`OpenAI-compatible provider error (${response.status}): ${sanitizedStatus}`);
      }

      console.log(`  ✅ WIRE RESPONSE: HTTP 200 OK (${latencyMs}ms)\n`);

      let json: any;
      try {
        const rawText = await response.text();
        json = JSON.parse(rawText);
      } catch (parseErr: any) {
        throw new Error(`OpenAI-compatible provider returned invalid JSON: ${parseErr?.message || String(parseErr)}`);
      }
      
      const choice = json.choices?.[0];
      let text = '';
      if (typeof choice?.message?.content === 'string') {
        text = choice.message.content;
      } else if (typeof choice?.message?.reasoning_content === 'string') {
        text = choice.message.reasoning_content;
      } else if (typeof choice?.text === 'string') {
        text = choice.text;
      } else if (typeof choice?.message === 'string') {
        text = choice.message;
      }

      // Strip <think>...</think> reasoning tags if emitted by reasoning models like DeepSeek-R1 / Qwen
      if (text.includes('<think>')) {
        text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      }

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

    const cleanBase = validation.normalizedUrl;
    let endpointUrl = this.resolveModelsUrl(cleanBase);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let response = await fetch(endpointUrl, {
        method: 'GET',
        headers: {
          'Authorization': apiKey ? `Bearer ${apiKey}` : 'Bearer sk-custom-token',
        },
        signal: controller.signal,
      });

      // If /models returned 404 and cleanBase does not have /v1, attempt cleanBase/v1/models
      if (response.status === 404 && !cleanBase.endsWith('/v1')) {
        endpointUrl = `${cleanBase}/v1/models`;
        response = await fetch(endpointUrl, {
          method: 'GET',
          headers: {
            'Authorization': apiKey ? `Bearer ${apiKey}` : 'Bearer sk-custom-token',
          },
          signal: controller.signal,
        });
      }

      if (!response.ok) {
        let errText = '';
        try {
          const rawText = await response.text();
          try {
            const errJson = JSON.parse(rawText);
            errText = errJson.error?.message || JSON.stringify(errJson);
          } catch {
            errText = rawText;
          }
        } catch (readErr: any) {
          errText = `(failed to read response: ${readErr?.message || String(readErr)})`;
        }
        throw new Error(`Model discovery failed (${response.status}): ${errText}`);
      }

      let json: any;
      try {
        const rawText = await response.text();
        json = JSON.parse(rawText);
      } catch (parseErr: any) {
        throw new Error(`Model discovery returned invalid JSON: ${parseErr?.message || String(parseErr)}`);
      }
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
