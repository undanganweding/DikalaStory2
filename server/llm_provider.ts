import { modelRouter, TaskType } from './model_router';
import { getGeminiAI, resolveGeminiModel } from './gemini';
import {
  ReasoningConfig,
  ReasoningProviderType,
  ProviderType,
  ReasoningModelPreferences,
  ModelReference,
  TaskTier,
  FallbackLogEntry,
  ErrorClassification,
} from '../src/types';
import {
  DEFAULT_TASK_PROFILES,
  getModelCapabilities,
  satisfiesTaskTier,
  resolveEffectiveModelForStage,
  getDeterministicFallbacks,
  isFatalNonRecoverableError,
  isRateLimitOrQuotaError,
  setProviderHealth,
  isModelAvailable,
} from './adaptive_router';
import { credentialManager } from './credential_manager';
import { quotaRouter } from './ai_infrastructure/quota_router';
import { db } from './db';
import { aiGateway, getDisabledModelIds } from './ai_infrastructure/ai_gateway';
import { taskExecutor } from './ai_infrastructure/task_executor';
import { geminiProjectRouter, TaskType as GTaskType } from './gemini_project_router';
import {
  getTaskWeight,
  getDirectionalRollingSequence,
  classifyARMOError,
  armoOrchestrator,
  ARMO_MODEL_REGISTRY,
} from './armo';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

export interface LLMGenerateOptions {
  reasoningConfig?: ReasoningConfig | null;
  modelPreferences?: Partial<ReasoningModelPreferences> | null;
  stage?: string;
  entityId?: string;
  model?: string | null;
  prompt: string;
  systemInstruction?: string;
  responseSchema?: any;
  temperature?: number;
  maxOutputTokens?: number;
  onProgress?: (message: string) => void;
}

export interface LLMGenerateResult {
  text: string;
}

export interface LLMCapabilities {
  structured_output: boolean;
  json_schema: boolean;
  long_context: boolean;
  reasoning: boolean;
}

/**
  Strip markdown code blocks, think tags, or surrounding whitespace from AI JSON output
 */
export function cleanJsonResponse(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText.trim();

  // Strip <think>...</think> reasoning tags emitted by reasoning models (e.g. DeepSeek-R1, Qwen, 9router proxies)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  text = text.trim();

  // If text contains conversational preamble or reasoning before JSON, extract JSON substring
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  
  let startIndex = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIndex = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIndex = firstBrace;
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
  }

  const lastBrace = text.lastIndexOf('}');
  const lastBracket = text.lastIndexOf(']');
  let endIndex = Math.max(lastBrace, lastBracket);

  if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
    text = text.slice(startIndex, endIndex + 1);
  }

  return text.trim();
}

/**
 * Safely parse JSON text from LLM responses, stripping code fences,
 * fixing unescaped newlines inside strings, escaping inner quotes, and repairing truncated JSON objects.
 */
export function safeParseJSON<T = any>(rawText: string): T {
  const cleaned = cleanJsonResponse(rawText);

  // 1. Direct parse attempt
  try {
    return JSON.parse(cleaned);
  } catch (err1) {
    // 2. State-machine string repair: escapes raw newlines, tabs, and unescaped inner quotes inside strings
    try {
      const repairedStrings = repairJsonStrings(cleaned);
      return JSON.parse(repairedStrings);
    } catch (err2) {
      // 3. Balance open brackets and braces for truncated JSON
      let repaired = repairJsonStrings(cleaned);

      const stack: string[] = [];
      let inString = false;
      let escaped = false;
      for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        if (char === '\\' && !escaped) {
          escaped = true;
          continue;
        }
        if (char === '"' && !escaped) {
          inString = !inString;
        }
        escaped = false;

        if (!inString) {
          if (char === '{') stack.push('}');
          else if (char === '[') stack.push(']');
          else if (char === '}' || char === ']') {
            if (stack.length > 0 && stack[stack.length - 1] === char) {
              stack.pop();
            }
          }
        }
      }

      if (inString) {
        repaired += '"';
      }

      // Strip any trailing commas before balancing
      repaired = repaired.replace(/,\s*$/, '');

      while (stack.length > 0) {
        repaired += stack.pop();
      }

      // Strip trailing commas before closing braces/brackets
      repaired = repaired.replace(/,\s*([\}\]])/g, '$1');

      try {
        return JSON.parse(repaired);
      } catch (err3) {
        throw new Error(`JSON parse gagal (Unterminated/Invalid JSON): ${(err1 as Error).message}`);
      }
    }
  }
}

/**
 * State-machine parser that repairs raw unescaped newlines/tabs and inner quotes inside JSON strings.
 */
function repairJsonStrings(input: string): string {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const code = input.charCodeAt(i);

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      result += char;
      continue;
    }

    if (char === '"') {
      if (!inString) {
        inString = true;
        result += '"';
      } else {
        // Look ahead to see if this is truly the closing quote or an unescaped inner quote
        let j = i + 1;
        while (j < input.length && (input[j] === ' ' || input[j] === '\t' || input[j] === '\r' || input[j] === '\n')) {
          j++;
        }
        const nextChar = j < input.length ? input[j] : '';
        const isStructuralDelim = nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === ':' || nextChar === '';

        if (isStructuralDelim) {
          inString = false;
          result += '"';
        } else {
          // Unescaped inner quote inside string literal
          result += '\\"';
        }
      }
      continue;
    }

    if (inString) {
      if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else if (code < 32) {
        result += ' ';
      } else {
        result += char;
      }
    } else {
      result += char;
    }
  }

  if (inString) {
    result += '"';
  }

  return result;
}

function sanitizeErrorMessage(rawMsg: string, status: number): string {
  if (status === 401 || status === 403) {
    return 'Autentikasi gagal atau API Key tidak valid / tidak memiliki izin akses.';
  }
  if (status === 429) {
    return 'Batas kuota terlampaui (Rate limit / Quota exceeded).';
  }
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return 'Server provider mengalami gangguan sementara (Transient service failure / 5xx error).';
  }
  return rawMsg;
}

function getEffectiveBaseUrl(config?: ReasoningConfig | null): string {
  if (config?.base_url && config.base_url.trim().length > 0) {
    return config.base_url.trim().replace(/\/+$/, '');
  }
  switch (config?.provider_type) {
    case 'openrouter':
      return 'https://openrouter.ai/api/v1';
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'xai':
      return 'https://api.x.ai/v1';
    case 'custom_openai':
      return 'https://api.tabitoken.com/v1'; // Default custom proxy
    default:
      return 'https://api.openai.com/v1';
  }
}

function buildEndpointUrl(baseUrl: string): string {
  if (baseUrl.endsWith('/chat/completions')) {
    return baseUrl;
  }
  return `${baseUrl}/chat/completions`;
}

function getEffectiveApiKey(config?: ReasoningConfig | null): string | undefined {
  if (config?.api_key && config.api_key.trim().length > 0) {
    return config.api_key.trim();
  }
  switch (config?.provider_type) {
    case 'openrouter':
      return process.env.OPENROUTER_API_KEY;
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'xai':
      return process.env.XAI_API_KEY;
    case 'custom_openai':
      return process.env.CUSTOM_OPENAI_API_KEY || 'sk-custom-token';
    default:
      return undefined;
  }
}

function extractResponseText(data: any): string | null {
  if (typeof data.output_text === 'string') {
    return data.output_text;
  }
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item && Array.isArray(item.content)) {
        for (const contentItem of item.content) {
          if (contentItem && typeof contentItem.text === 'string') {
            return contentItem.text;
          }
        }
      }
    }
  }
  if (Array.isArray(data.choices) && data.choices.length > 0) {
    const choice = data.choices[0];
    if (choice.message && typeof choice.message.content === 'string') {
      return choice.message.content;
    }
    if (typeof choice.text === 'string') {
      return choice.text;
    }
  }
  return JSON.stringify(data);
}

function parseRetryDelayMs(err: any, attemptNumber: number): number {
  if (err) {
    const msg = typeof err === 'string' ? err : (err.message ? String(err.message) : JSON.stringify(err));
    const match = msg.match(/retry after ([\d.]+)/i) ||
                  msg.match(/try again in ([\d.]+)s/i) ||
                  msg.match(/please retry in ([\d.]+)\s*s/i) ||
                  msg.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
    if (match && match[1]) {
      const parsedSeconds = parseFloat(match[1]);
      if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
        return Math.min(Math.ceil(parsedSeconds * 1000), 15000);
      }
    }
  }

  const baseDelays = [1500, 3000, 6000, 10000];
  const base = baseDelays[Math.min(attemptNumber - 1, baseDelays.length - 1)] || 3000;
  const jitter = Math.floor(Math.random() * 500);
  return Math.min(base + jitter, 10000);
}

export function getFallbackModels(primaryModel: string, provider: string = 'google'): string[] {
  const resolved = resolveGeminiModel(primaryModel);
  const candidates = [
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.1-pro-preview',
    'gemini-2.5-pro',
  ];

  const fallbacks: string[] = [];
  if (isModelAvailable(provider, resolved)) {
    fallbacks.push(resolved);
  }

  for (const candidate of candidates) {
    if (!fallbacks.includes(candidate) && isModelAvailable(provider, candidate)) {
      fallbacks.push(candidate);
    }
  }

  if (fallbacks.length === 0) {
    if (!fallbacks.includes(resolved)) fallbacks.push(resolved);
    for (const candidate of candidates) {
      if (!fallbacks.includes(candidate)) fallbacks.push(candidate);
    }
  }

  return fallbacks;
}

/**
 * Race a promise against a hard timeout. Rejects with a descriptive Error when
 * the deadline elapses, so a hanging HTTP/streaming call cannot leave an await
 * pending forever. The thrown error (message contains "timed out") classifies
 * as `network` via classifyError(), so it propagates to retry/fallback instead
 * of being swallowed.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/**
 * Execute a single model request with credential pool rotation and health tracking
 */
async function executeSingleModelRequest(
  options: LLMGenerateOptions
): Promise<LLMGenerateResult> {
  const config = options.reasoningConfig;
  const providerType: ReasoningProviderType = config?.provider_type || 'google';

  // Guard: Check if provider or models are disabled in Infrastructure Settings
  try {
    const disabledModelIds = await getDisabledModelIds();
    const dbProviders = await db.getProviders();
    const targetProv = dbProviders.find(p => p.id === providerType || p.type === providerType);
    if (targetProv && targetProv.enabled === false) {
      throw new Error(`Provider '${providerType}' is disabled in Infrastructure Settings.`);
    }
    const dbModels = await db.getModels();
    const enabledProvModels = dbModels.filter(m => (m.providerId === providerType || (targetProv && m.providerId === targetProv.id)) && m.enabled !== false && !disabledModelIds.has(m.id));
    if (enabledProvModels.length === 0 && dbModels.length > 0 && providerType === 'google') {
      throw new Error(`All Gemini models for provider '${providerType}' have been disabled in Infrastructure Settings.`);
    }
  } catch (dbCheckErr: any) {
    if (dbCheckErr?.message?.includes('disabled in Infrastructure Settings') || dbCheckErr?.message?.includes('disabled')) {
      throw dbCheckErr;
    }
  }

  const MAX_ATTEMPTS = 3;

  // Determine key candidates: explicit override OR ordered keys from Credential Pool
  let candidateCredentials: { credentialId?: string; rawKey?: string; label?: string }[] = [];
  if (config?.api_key && config.api_key.trim().length > 0) {
    candidateCredentials = [{ rawKey: config.api_key.trim(), label: 'Explicit Request Key' }];
  } else {
    const poolCandidates = credentialManager.getOrderedCandidateCredentials(providerType);
    if (poolCandidates.length > 0) {
      candidateCredentials = poolCandidates.map((c) => ({
        credentialId: c.credential.id,
        rawKey: c.rawKey,
        label: c.credential.label,
      }));
    } else {
      candidateCredentials = [{ label: `Default ${providerType} fallback` }];
    }
  }

  let lastCredentialError: any = null;

  for (let credIdx = 0; credIdx < candidateCredentials.length; credIdx++) {
    const activeCandidate = candidateCredentials[credIdx];
    const currentApiKey = activeCandidate.rawKey;
    const credId = activeCandidate.credentialId;

    if (providerType === 'google') {
      const stageTag = `[${options.stage || 'GENERAL'}]`;
      const GOOGLE_CONTENT_TIMEOUT_MS = 35000;
      let lastAttemptError: any = null;
      const taskProfile = DEFAULT_TASK_PROFILES[options.stage || 'GENERAL'] || { task: 'general', tier: 'general_reasoning' };
      const taskStr = taskProfile.task as GTaskType;
      
      // 1. Determine model: Use Task Profile preference as authority, fallback to Model Router
      const forcedModel = typeof options.modelPreferences?.force_model === 'string' 
        ? options.modelPreferences.force_model 
        : (typeof options.model === 'string' ? options.model : undefined);
      let currentModelId: string = '';

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (attempt === 1) {
          if (config?.model_id) {
            currentModelId = resolveGeminiModel(config.model_id);
          } else if (forcedModel) {
            currentModelId = resolveGeminiModel(forcedModel);
          } else {
            const primaryModel = taskProfile.default_model || (await modelRouter.getBestModel(taskStr as any, taskProfile.tier as any, 1)).modelId;
            currentModelId = resolveGeminiModel(primaryModel);
          }
        } else {
          // On subsequent attempts, query ModelRouter for next best available model
          // If strictly forced without rate-limiting error, keep it, otherwise allow failover
          const isRateOrQuota = lastAttemptError && isRateLimitOrQuotaError(lastAttemptError);
          const isStrictlyForced = options.modelPreferences?.force_model === true && !isRateOrQuota;
          
          if (isStrictlyForced && config?.model_id) {
            currentModelId = resolveGeminiModel(config.model_id);
          } else {
            const candidateModel = (await modelRouter.getBestModel(taskStr as any, taskProfile.tier as any, attempt)).modelId;
            if (candidateModel) {
              const resolvedCandidate = resolveGeminiModel(candidateModel);
              if (resolvedCandidate !== currentModelId) {
                console.warn(`${stageTag} Model ${currentModelId} exhausted/rate-limited. Failing over to ${resolvedCandidate} for attempt ${attempt}`);
              }
              currentModelId = resolvedCandidate;
            }
          }
        }

        let modelId = resolveGeminiModel(currentModelId);
        let activeProjects = geminiProjectRouter.getBestProjects(taskStr, modelId);
        
        if (activeProjects.length === 0) {
            const fallbackModel = (await modelRouter.getBestModel(taskStr as any, taskProfile.tier as any, attempt + 1)).modelId;
            if (fallbackModel) {
                const resolvedFallback = resolveGeminiModel(fallbackModel);
                if (resolvedFallback !== modelId) {
                    console.warn(`${stageTag} Preferred model ${modelId} unavailable. Falling back to ${resolvedFallback}`);
                    currentModelId = resolvedFallback;
                    modelId = resolvedFallback;
                    activeProjects = geminiProjectRouter.getBestProjects(taskStr, modelId);
                }
            }
            if (activeProjects.length === 0) {
              throw new Error(`No available Gemini projects for task ${taskStr} and model ${modelId}`);
            }
        }

        let lastActiveProjectError;

        for (const activeProject of activeProjects) {
            const ai = getGeminiAI(activeProject.api_key);
            const attemptStart = Date.now();
            
            try {
              const requestStart = Date.now();
              console.log(`${stageTag} AI REQUEST model=${modelId} project="${activeProject.project_id}" attempt=${attempt} stage=${options.stage || 'GENERAL'}`);
              if (options.onProgress) {
                options.onProgress(`${options.entityId ? `${options.entityId}: ` : ''}Menghubungi AI Model ${modelId} (Project ${activeProject.project_id.split('-').pop()})...`);
              }

              let response;
              // Request Queue & Gemini Project Router
              response = await geminiProjectRouter.queueRequest(() => withTimeout(
                ai.models.generateContent({
                  model: modelId,
                  contents: options.prompt,
                  config: {
                    systemInstruction: options.systemInstruction,
                    temperature: options.temperature ?? 0.3,
                    maxOutputTokens: options.maxOutputTokens,
                    responseMimeType: options.responseSchema ? 'application/json' : undefined,
                    responseSchema: options.responseSchema,
                  },
                }),
                GOOGLE_CONTENT_TIMEOUT_MS,
                `Google Gemini request timed out after ${GOOGLE_CONTENT_TIMEOUT_MS}ms (model ${modelId})`
              ));
              
              const requestElapsed = Date.now() - requestStart;
              console.log(`${stageTag} AI RESPONSE model=${modelId} project="${activeProject.project_id}" attempt=${attempt} elapsedMs=${requestElapsed} stage=${options.stage || 'GENERAL'}`);
              
              if (!response.text) {
                throw new Error('Google Gemini returned an empty response.');
              }

              // Log success usage
              const estimatedTokens = Math.floor(response.text.length / 4); // rough estimate
              geminiProjectRouter.recordUsageAndLog(activeProject.project_id, taskStr, modelId, estimatedTokens, requestElapsed, 'success');

              if (options.onProgress) {
                options.onProgress(`${options.entityId ? `${options.entityId}: ` : ''}Respons AI (${modelId}) berhasil diterima dalam ${requestElapsed}ms!`);
              }

              // Return result immediately (bypassing loop)
              return { text: cleanJsonResponse(response.text) };
            } catch (err: any) {
              lastAttemptError = err;
              lastActiveProjectError = err;
              lastCredentialError = err;
              const attemptElapsed = Date.now() - attemptStart;
              console.warn(`${stageTag} AI ERROR model=${modelId} project="${activeProject.project_id}" attempt=${attempt} elapsedMs=${attemptElapsed} error="${err?.message || err}" stage=${options.stage || 'GENERAL'}`);

              const isQuota = isRateLimitOrQuotaError(err);
              const isAuth = classifyError(err) === 'auth_error';

              geminiProjectRouter.recordUsageAndLog(activeProject.project_id, taskStr, modelId, 0, attemptElapsed, 'fail', err);

              if (isFatalNonRecoverableError(err) && !isQuota) {
                if (isAuth) {
                  console.warn(`[GeminiRouter] Project "${activeProject.project_id}" auth failed. Switching...`);
                  continue; // Try next project
                }
                throw err;
              }

              // On quota/transient, continue to next project
              console.warn(`[GeminiRouter] Project "${activeProject.project_id}" failed. Failover to next project...`);
              continue;
            }
        }
        
        // If all projects for modelId failed in this attempt, check if we can failover on next attempt
        if (attempt < MAX_ATTEMPTS && lastActiveProjectError && isRateLimitOrQuotaError(lastActiveProjectError)) {
          console.warn(`${stageTag} Attempt ${attempt} failed for model ${modelId} with quota/transient error. Transitioning to attempt ${attempt + 1}...`);
          const errMsg = lastActiveProjectError?.message?.toLowerCase() || '';
          let backoffMs = 1500;
          const retryMatch = errMsg.match(/retry in ([\d\.]+)s/i) || errMsg.match(/retry after ([\d\.]+)s/i);
          if (retryMatch && retryMatch[1]) {
            const s = parseFloat(retryMatch[1]);
            if (!isNaN(s) && s > 0) backoffMs = Math.min(Math.ceil(s * 1000), 5000);
          }
          await new Promise(r => setTimeout(r, backoffMs));
          continue;
        }

        throw lastActiveProjectError || new Error('Max attempts reached for Google provider');
      }
      throw lastAttemptError || new Error('Max attempts reached for Google provider');

    } else {
      // External OpenAI-Compatible Provider
      const baseUrl = getEffectiveBaseUrl(config);
      const endpoint = buildEndpointUrl(baseUrl);
      const apiKey = currentApiKey || getEffectiveApiKey(config);
      const modelId = config?.model_id || options.model || 'ops-5';
      const providerName = config?.provider_name || providerType;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else if (providerType === 'custom_openai') {
        headers['Authorization'] = 'Bearer sk-custom-token';
      } else {
        throw new Error(
          `API Key untuk provider external "${providerName}" belum dikonfigurasi. Silakan masukkan API Key pada form project atau Credential Pool.`
        );
      }

      if (providerType === 'openrouter') {
        headers['HTTP-Referer'] = 'https://ai.studio/build';
        headers['X-Title'] = 'AI Cinematic Production Studio';
      }

      const systemContent = options.systemInstruction || '';
      let lastAttemptError: any = null;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const sendResponseFormat = attempt === 1 && Boolean(options.responseSchema);
          const useSystemRole = attempt <= 2;

          let messages: { role: string; content: string }[];
          if (useSystemRole && systemContent.trim()) {
            let systemMsg = systemContent.trim();
            if (options.responseSchema) {
              systemMsg += `\n\nCRITICAL MANDATE: Output ONLY valid JSON matching the required schema. Do NOT wrap in markdown fences.`;
            }
            messages = [
              { role: 'system', content: systemMsg },
              { role: 'user', content: options.prompt },
            ];
          } else {
            let mergedPrompt = options.prompt;
            if (systemContent.trim()) {
              mergedPrompt = `[SYSTEM INSTRUCTIONS]\n${systemContent.trim()}\n\n[USER REQUEST]\n${options.prompt}`;
            }
            if (options.responseSchema) {
              mergedPrompt += `\n\nCRITICAL MANDATE: Output ONLY valid JSON strictly matching the schema.`;
            }
            messages = [{ role: 'user', content: mergedPrompt }];
          }

          const bodyPayload: any = {
            model: modelId,
            messages,
            temperature: options.temperature ?? 0.3,
          };

          if (options.maxOutputTokens) {
            bodyPayload.max_tokens = options.maxOutputTokens;
          }

          if (sendResponseFormat) {
            bodyPayload.response_format = { type: 'json_object' };
          }

          let response: Response;
          try {
            const controller = new AbortController();
            const timeoutMs = providerType === 'custom_openai' ? 60000 : 45000;
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            response = await fetch(endpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify(bodyPayload),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
          } catch (fetchErr: any) {
            if (fetchErr.name === 'AbortError' || fetchErr.message?.includes('aborted')) {
              throw new Error(
                `Timeout (60s) menghubungi provider "${providerName}" (${endpoint}). Server tidak merespons tepat waktu.`
              );
            }
            throw new Error(
              `Koneksi ke endpoint provider "${providerName}" (${endpoint}) gagal: ${fetchErr?.message || fetchErr}`
            );
          }

          if (!response.ok) {
            const errText = await response.text();
            let parsedErr: any = null;
            try {
              parsedErr = JSON.parse(errText);
            } catch {}
            const rawMsg = parsedErr?.error?.message || parsedErr?.message || errText;
            const cleanMsg = sanitizeErrorMessage(rawMsg, response.status);
            const customErr: any = new Error(`Provider "${providerName}" menolak request (HTTP ${response.status}): ${cleanMsg}`);
            customErr.status = response.status;
            customErr.details = parsedErr?.error?.details || parsedErr;
            throw customErr;
          }

          const data = await response.json();
          const extractedText = extractResponseText(data);
          if (!extractedText || typeof extractedText !== 'string') {
            throw new Error(`Provider "${providerName}" mengembalikan respons tanpa konten teks yang dapat dibaca.`);
          }

          if (credId) {
            credentialManager.recordSuccess(credId);
          }

          const cleanedText = cleanJsonResponse(extractedText);
          return { text: cleanedText };
        } catch (err: any) {
          lastAttemptError = err;
          lastCredentialError = err;

          if (credId) {
            credentialManager.recordFailure(credId, err);
          }

          const isQuota = isRateLimitOrQuotaError(err);
          if (isQuota && credIdx < candidateCredentials.length - 1) {
            console.warn(`[CredentialPool] Provider "${providerName}" Key "${activeCandidate.label}" hit quota/rate limit. Failover to next key in pool...`);
            break;
          }

          const isRetryable = isRetryableError(err);
          if (isRetryable && attempt < MAX_ATTEMPTS) {
            const delayMs = parseRetryDelayMs(err, attempt);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else {
            break;
          }
        }
      }
    }
  }

  throw lastCredentialError || new Error(`Provider "${providerType}" gagal memenuhi request pada seluruh key yang tersedia.`);
}

export const fallbackAuditLogs: FallbackLogEntry[] = [];

export function classifyError(err: any): ErrorClassification {
  if (err === 429) return 'rate_limit';
  if (err === 401 || err === 403) return 'auth_error';
  if (err === 500 || err === 502 || err === 503 || err === 504) return 'network';
  const msg = (typeof err === 'string' ? err : err?.message || '').toLowerCase();
  const status = typeof err === 'number' ? err : err?.status;
  if (msg.includes('quota') || msg.includes('resource exhausted')) {
    return 'quota_exceeded';
  }
  if (status === 429 || msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'rate_limit';
  }
  if (status === 401 || status === 403 || msg.includes('api key') || msg.includes('unauthorized')) {
    return 'auth_error';
  }
  if (status === 500 || status === 502 || status === 503 || status === 504 || msg.includes('timeout') || msg.includes('unavailable') || msg.includes('high demand') || msg.includes('overloaded')) {
    return 'network';
  }
  if (msg.includes('json') || msg.includes('schema') || msg.includes('parse')) {
    return 'schema_validation';
  }
  return 'unknown';
}

export function isRetryableError(err: any): boolean {
  const classification = classifyError(err);
  return classification === 'quota_exceeded' || classification === 'rate_limit' || classification === 'network';
}

/**
 * Central Abstraction Layer for executing LLM requests with Adaptive Router, Fallback Pool, and Explicit Logging
 */
export async function executeLLMRequest(
  options: LLMGenerateOptions
): Promise<LLMGenerateResult> {
  // FORENSIC LOGGING
  const stack = new Error().stack;
  try {
      console.error(`[FORENSIC]` +  `[FORENSIC] ${new Date().toISOString()} stage=${options.stage} model=${options.model} task=${options.entityId} stack=\n${stack}\n\n`);
  } catch (err) {
      console.error('Failed to write forensic log', err);
  }

  const stage = options.stage || 'GENERAL';
  const prefs = options.modelPreferences || (options.reasoningConfig as any)?.modelPreferences;
  const mode = prefs?.mode || 'fixed';

  const effectivePrimary = resolveEffectiveModelForStage(stage, prefs);

  let requestedModel = options.reasoningConfig?.model_id || options.model || effectivePrimary.model_id;
  if (mode === 'custom') {
    requestedModel = effectivePrimary.model_id;
  }

  if (process.env.MOCK_LLM === 'true') {
    const runId = (options.modelPreferences as any)?.runId || `run_${stage}_${options.entityId || 'global'}`;
    armoOrchestrator.recordTransition(
      runId,
      stage,
      1,
      requestedModel,
      requestedModel,
      requestedModel,
      'mock_credential',
      'Mock execution attempt',
      'SUCCESS'
    );

    let dur = 10; // default fallback
    const promptStr = options.prompt || '';
    const matchSec = promptStr.match(/(?:duration_sec|duration|durasi|target duration|durasi scene)[^\d]*(\d+)/i);
    if (matchSec) {
      dur = parseInt(matchSec[1], 10);
    } else {
      const matchAnyNum = promptStr.match(/(\d+)\s*(?:detik|seconds|sec|s\b)/i);
      if (matchAnyNum) {
        dur = parseInt(matchAnyNum[1], 10);
      }
    }

    return {
      text: JSON.stringify({
        shots: [
          {
            shot_number: 1,
            description: "Mock description",
            visual_prompt: "Mock visual prompt",
            duration_sec: dur,
            start_time_sec: 0,
            end_time_sec: dur,
            transition: "CUT",
            master_image_prompt: "Mock master image prompt",
            seedance_prompt: "Mock seedance prompt",
            video_prompt: "Mock video prompt",
          }
        ],
        prompt: "Mock prompt",
        shot_breakdown: "Mock shot breakdown"
      }),
    };
  }

  const runId = (options.modelPreferences as any)?.runId || `run_${stage}_${options.entityId || 'global'}`;

  // If explicitly configured with custom/external OpenAI-compatible provider (e.g. 9router, Tabitoken, Groq, OpenRouter) or ad-hoc config
  if (
    options.reasoningConfig &&
    (options.reasoningConfig.provider_type !== 'google' || options.reasoningConfig.base_url || (options.reasoningConfig.api_key && options.reasoningConfig.api_key.trim().length > 0))
  ) {
    try {
      const singleRes = await executeSingleModelRequest(options);
      armoOrchestrator.recordTransition(
        runId,
        stage,
        1,
        requestedModel,
        options.reasoningConfig.model_id || requestedModel,
        options.reasoningConfig.model_id || requestedModel,
        'custom_credential',
        `Executed via direct provider: ${options.reasoningConfig.provider_name || options.reasoningConfig.provider_type}`,
        'SUCCESS'
      );
      return singleRes;
    } catch (directErr: any) {
      const errorClassification = classifyARMOError(directErr);
      armoOrchestrator.recordTransition(
        runId,
        stage,
        1,
        requestedModel,
        requestedModel,
        requestedModel,
        'custom_credential',
        `Direct provider failed: ${directErr.message}`,
        `FAIL (${errorClassification.toUpperCase()})`
      );
      throw directErr;
    }
  }

  try {
    const gatewayResponse = await aiGateway.generate({
      model: requestedModel,
      prompt: options.prompt,
      systemInstruction: options.systemInstruction,
      responseSchema: options.responseSchema,
      maxTokens: options.maxOutputTokens,
      temperature: options.temperature ?? 0.3,
      agentName: stage,
      task: stage,
      providerId: options.reasoningConfig?.provider_type,
    });

    armoOrchestrator.recordTransition(
      runId,
      stage,
      1,
      requestedModel,
      gatewayResponse.model,
      gatewayResponse.model,
      gatewayResponse.credentialId,
      'Primary execution attempt via AI Gateway',
      'SUCCESS'
    );

    const cleanedText = cleanJsonResponse(gatewayResponse.text);
    return {
      text: cleanedText,
    };
  } catch (err: any) {
    if (
      err?.message?.includes('disabled in Infrastructure Settings') ||
      err?.message?.includes('No eligible and capable providers') ||
      err?.message?.includes('All candidate models') ||
      err?.message?.includes('disabled')
    ) {
      const errorClassification = classifyARMOError(err);
      armoOrchestrator.recordTransition(
        runId,
        stage,
        1,
        requestedModel,
        requestedModel,
        requestedModel,
        'none',
        `Failed via AI Gateway (Disabled): ${err.message}`,
        `FAIL (${errorClassification.toUpperCase()})`
      );
      throw err;
    }
    // Fallback attempt via executeSingleModelRequest
    try {
      console.warn(`[AIGateway] Gateway invocation failed (${err?.message}). Attempting fallback execution...`);
      const fallbackRes = await executeSingleModelRequest(options);
      armoOrchestrator.recordTransition(
        runId,
        stage,
        2,
        requestedModel,
        requestedModel,
        requestedModel,
        'fallback_driver',
        'Fallback execution succeeded via single model driver',
        'SUCCESS'
      );
      return fallbackRes;
    } catch (fallbackErr: any) {
      const errorClassification = classifyARMOError(err);
      armoOrchestrator.recordTransition(
        runId,
        stage,
        1,
        requestedModel,
        requestedModel,
        requestedModel,
        'none',
        `Failed via AI Gateway & Fallback: ${err.message}`,
        `FAIL (${errorClassification.toUpperCase()})`
      );
      throw err;
    }
  }
}

/**
 * Ping test connection for external or Google models
 */
export async function testLLMConnection(
  config: ReasoningConfig
): Promise<{ success: boolean; message: string; latency?: number; textSample?: string }> {
  const startTime = Date.now();
  try {
    const result = await executeSingleModelRequest({
      stage: 'TEST_CONNECTION',
      prompt: 'Ping test connection. Respond with JSON object: {"status": "ok", "provider": "ready"}',
      systemInstruction: 'Output valid JSON strictly: {"status": "ok", "provider": "ready"}',
      temperature: 0.1,
      reasoningConfig: config,
      model: config.model_id,
    });
    const latency = Date.now() - startTime;
    if (!result.text) {
      throw new Error('Respons kosong dari model.');
    }
    return {
      success: true,
      latency,
      textSample: result.text.slice(0, 120),
      message: `Koneksi ke ${config.display_name || config.provider_name || config.provider_type} (${config.model_id}) berhasil! [${latency}ms]`,
    };
  } catch (err: any) {
    const latency = Date.now() - startTime;
    return {
      success: false,
      latency,
      message: err?.message || 'Gagal terhubung ke provider model.',
    };
  }
}

export interface ProviderRequestOptions {
  provider?: ProviderType;
  model?: string;
  stage?: string;
  operation?: 'llm_generate' | 'image_prompt' | 'video_prompt' | 'video_generate' | 'capability_probe';
  prompt?: string;
  systemInstruction?: string;
  responseSchema?: any;
  temperature?: number;
  maxOutputTokens?: number;
  reasoningConfig?: ReasoningConfig | null;
  jobId?: string;
  credentialId?: string;
  entityId?: string;
}

export interface ProviderExecutionResult {
  text?: string;
  data?: any;
  status?: string;
  provider: string;
  model?: string;
  credentialUsed?: string;
}

export { taskExecutor, executeTask, type ExecuteTaskOptions, type ExecuteTaskResult } from './ai_infrastructure/task_executor';

/**
 * Universal Provider Execution Gateway (Phase 7B & 7C Standard Provider Execution Contract)
 * Centralizes routing, credential management, pool rotation, cooldowns, and adapter dispatch.
 */
export async function executeProviderRequest(options: ProviderRequestOptions): Promise<ProviderExecutionResult> {
  const provider = (options.provider || options.reasoningConfig?.provider_type || 'google') as ReasoningProviderType;

  // If specific credentialId was supplied (e.g. for async polling or pinned generation)
  let explicitKey: string | undefined;
  if (options.credentialId) {
    explicitKey = credentialManager.getSecretKey(options.credentialId);
  } else if (options.reasoningConfig?.api_key) {
    explicitKey = options.reasoningConfig.api_key;
  }

  const res = await executeLLMRequest({
    stage: options.stage,
    prompt: options.prompt || '',
    systemInstruction: options.systemInstruction,
    responseSchema: options.responseSchema,
    temperature: options.temperature,
    maxOutputTokens: options.maxOutputTokens,
    reasoningConfig: options.reasoningConfig ? {
      ...options.reasoningConfig,
      api_key: explicitKey || options.reasoningConfig.api_key,
    } : (explicitKey ? {
      provider_type: provider,
      provider_name: provider,
      model_id: options.model || 'gemini-3.7-flash',
      api_key: explicitKey,
    } : (provider !== 'google' ? {
      provider_type: provider,
      provider_name: provider,
      model_id: options.model || (provider === 'openrouter' ? 'google/gemini-3.6-flash' : 'gpt-4o-mini'),
    } : null)),
    entityId: options.entityId,
  });

  return {
    text: res.text,
    provider: provider,
    model: options.model,
  };
}
