import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  ProviderCredential,
  ProviderCredentialSummary,
  ProviderType,
  CredentialStatus,
  ReasoningProviderType,
} from '../src/types';
import { classifyError } from './llm_provider';
import { getGeminiAI } from './gemini';

const DATA_DIR = process.env.VERCEL ? path.join('/tmp', 'data') : path.join(process.cwd(), 'data');
const CREDENTIALS_META_FILE = path.join(DATA_DIR, 'credentials_meta.json');
const CREDENTIALS_SECRETS_FILE = path.join(DATA_DIR, 'credentials_secrets.json');

// In-memory runtime secrets vault (never exposed to client)
const inMemorySecrets = new Map<string, string>();
// In-memory round-robin pointer per provider
const providerPointers = new Map<string, number>();

/**
 * Mask an API key for safe UI display and logging.
 * Never reveals more than prefix and last 4 characters.
 */
export function maskApiKey(key: string): string {
  if (!key || typeof key !== 'string') return '••••••••';
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return '••••••••';
  }
  if (trimmed.startsWith('AIzaSy')) {
    return `AIza...${trimmed.slice(-4)}`;
  }
  if (trimmed.startsWith('sk-proj-') || trimmed.startsWith('sk-')) {
    return `sk-...${trimmed.slice(-4)}`;
  }
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

/**
 * Ensures data directory exists
 */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Load persisted credentials metadata
 */
function loadMetadata(): ProviderCredential[] {
  ensureDataDir();
  if (!fs.existsSync(CREDENTIALS_META_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(CREDENTIALS_META_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.error('[CredentialManager] Error loading credentials metadata:', err);
    return [];
  }
}

/**
 * Persist credentials metadata (contains NO raw secrets)
 */
function saveMetadata(credentials: ProviderCredential[]): void {
  ensureDataDir();
  const tmp = `${CREDENTIALS_META_FILE}.tmp`;
  try {
    // Sanitize to guarantee no raw apiKey exists in metadata
    const safeData = credentials.map((c) => {
      const { ...safe } = c as any;
      delete safe.apiKey;
      delete safe.secret;
      return safe;
    });
    fs.writeFileSync(tmp, JSON.stringify(safeData, null, 2), 'utf-8');
    fs.renameSync(tmp, CREDENTIALS_META_FILE);
  } catch (err) {
    console.error('[CredentialManager] Error saving credentials metadata:', err);
  }
}

/**
 * Load persisted secrets into in-memory vault
 */
function loadSecrets(): void {
  ensureDataDir();
  if (!fs.existsSync(CREDENTIALS_SECRETS_FILE)) {
    return;
  }
  try {
    const raw = fs.readFileSync(CREDENTIALS_SECRETS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [id, secret] of Object.entries(parsed)) {
        if (typeof secret === 'string' && secret.trim().length > 0) {
          inMemorySecrets.set(id, secret.trim());
        }
      }
    }
  } catch (err) {
    console.error('[CredentialManager] Error loading secrets:', err);
  }
}

/**
 * Persist secrets to server-only storage
 */
function saveSecrets(): void {
  ensureDataDir();
  const tmp = `${CREDENTIALS_SECRETS_FILE}.tmp`;
  try {
    const obj: Record<string, string> = {};
    for (const [id, secret] of inMemorySecrets.entries()) {
      obj[id] = secret;
    }
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf-8');
    fs.renameSync(tmp, CREDENTIALS_SECRETS_FILE);
  } catch (err) {
    console.error('[CredentialManager] Error saving secrets:', err);
  }
}

// Initial bootstrap
loadSecrets();

export class CredentialManager {
  private static instance: CredentialManager;

  private constructor() {
    this.syncEnvCredentials();
  }

  public static getInstance(): CredentialManager {
    if (!CredentialManager.instance) {
      CredentialManager.instance = new CredentialManager();
    }
    return CredentialManager.instance;
  }

  /**
   * Automatically detect environment variables and add them as system fallback credentials if not already stored
   */
  private syncEnvCredentials(): void {
    const metaList = loadMetadata();
    let changed = false;

    const envConfigs: { provider: ProviderType; key: string | undefined; label: string; id: string }[] = [
      { provider: 'google', key: process.env.GEMINI_API_KEY, label: 'Environment GEMINI_API_KEY', id: 'env_gemini_default' },
      { provider: 'openai', key: process.env.OPENAI_API_KEY, label: 'Environment OPENAI_API_KEY', id: 'env_openai_default' },
      { provider: 'openrouter', key: process.env.OPENROUTER_API_KEY, label: 'Environment OPENROUTER_API_KEY', id: 'env_openrouter_default' },
      { provider: 'xai', key: process.env.XAI_API_KEY, label: 'Environment XAI_API_KEY', id: 'env_xai_default' },
      { provider: 'custom_openai', key: process.env.CUSTOM_OPENAI_API_KEY, label: 'Environment CUSTOM_OPENAI_API_KEY', id: 'env_custom_openai_default' },
      { provider: 'kling', key: process.env.KLING_API_KEY, label: 'Environment KLING_API_KEY', id: 'env_kling_default' },
      { provider: 'runway', key: process.env.RUNWAY_API_KEY, label: 'Environment RUNWAY_API_KEY', id: 'env_runway_default' },
    ];

    for (const ec of envConfigs) {
      if (ec.key && ec.key.trim().length > 0) {
        const existing = metaList.find((c) => c.id === ec.id);
        if (!existing) {
          const now = new Date().toISOString();
          const newCred: ProviderCredential = {
            id: ec.id,
            provider: ec.provider,
            label: ec.label,
            status: 'active',
            priority: 10, // Higher number = lower priority than explicit user keys (1..5)
            weight: 1,
            maskedKey: maskApiKey(ec.key),
            isEnvFallback: true,
            totalRequests: 0,
            successCount: 0,
            failureCount: 0,
            rateLimitCount: 0,
            createdAt: now,
            updatedAt: now,
          };
          metaList.push(newCred);
          inMemorySecrets.set(ec.id, ec.key.trim());
          changed = true;
        } else {
          // Always ensure in-memory secret is up to date with env
          inMemorySecrets.set(ec.id, ec.key.trim());
        }
      }
    }

    if (changed) {
      saveMetadata(metaList);
      saveSecrets();
    }
  }

  /**
   * List all credentials with masked secrets (safe for UI / API response)
   */
  public listCredentials(): ProviderCredential[] {
    const list = loadMetadata();
    const nowTime = Date.now();

    // Auto-recover rate-limited credentials whose cooldown has expired
    let needsSave = false;
    for (const cred of list) {
      if (cred.status === 'rate_limited' && cred.cooldownUntil) {
        const cooldownTime = new Date(cred.cooldownUntil).getTime();
        if (nowTime >= cooldownTime) {
          cred.status = 'active';
          cred.cooldownUntil = undefined;
          cred.updatedAt = new Date().toISOString();
          needsSave = true;
        }
      }
    }

    // Filter out stale orphan records that have no secret in server vault and are not env fallbacks
    const validList = list.filter((c) => c.isEnvFallback || inMemorySecrets.has(c.id));
    if (validList.length !== list.length) {
      needsSave = true;
    }

    if (needsSave) {
      saveMetadata(validList);
    }

    return validList;
  }

  /**
   * Get credential by ID (masked)
   */
  public getCredential(id: string): ProviderCredential | null {
    const list = this.listCredentials();
    return list.find((c) => c.id === id) || null;
  }

  /**
   * Get raw API key for internal server-side request execution. NEVER expose to client!
   */
  public getSecretKey(credentialId: string): string | undefined {
    return inMemorySecrets.get(credentialId);
  }

  /**
   * Add a new API credential to the pool
   */
  public addCredential(data: {
    provider: ProviderType;
    label: string;
    apiKey: string;
    priority?: number;
    weight?: number;
    baseUrl?: string;
    notes?: string;
  }): ProviderCredential {
    if (!data.apiKey || typeof data.apiKey !== 'string' || data.apiKey.trim().length === 0) {
      throw new Error('API Key cannot be empty.');
    }
    if (!data.provider) {
      throw new Error('Provider type is required.');
    }

    const trimmedKey = data.apiKey.trim();
    const list = loadMetadata();

    // Guard against duplicate API keys for the same provider
    for (const [existingId, secret] of inMemorySecrets.entries()) {
      if (secret === trimmedKey) {
        const existingCred = list.find((c) => c.id === existingId && c.provider === data.provider);
        if (existingCred) {
          return existingCred;
        }
      }
    }

    const now = new Date().toISOString();
    const id = `cred_${data.provider}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    const newCred: ProviderCredential = {
      id,
      provider: data.provider,
      label: data.label?.trim() || `${data.provider.toUpperCase()} Key`,
      status: 'active',
      priority: typeof data.priority === 'number' ? data.priority : 1,
      weight: typeof data.weight === 'number' ? data.weight : 1,
      maskedKey: maskApiKey(trimmedKey),
      baseUrl: data.baseUrl?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
      isEnvFallback: false,
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      rateLimitCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    list.push(newCred);
    inMemorySecrets.set(id, trimmedKey);

    saveMetadata(list);
    saveSecrets();

    return newCred;
  }

  /**
   * Update an existing credential
   */
  public updateCredential(
    id: string,
    updates: Partial<{
      label: string;
      status: CredentialStatus;
      priority: number;
      weight: number;
      baseUrl?: string;
      notes?: string;
      apiKey?: string;
      cooldownUntil?: string;
    }>
  ): ProviderCredential {
    const list = loadMetadata();
    const index = list.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new Error(`Credential not found: ${id}`);
    }

    const cred = list[index];
    const now = new Date().toISOString();

    if (updates.label !== undefined) cred.label = updates.label.trim();
    if (updates.status !== undefined) {
      cred.status = updates.status;
      if (updates.status === 'active') {
        cred.cooldownUntil = undefined;
        cred.lastErrorMessage = undefined;
      }
    }
    if (updates.cooldownUntil !== undefined) cred.cooldownUntil = updates.cooldownUntil;
    if (updates.priority !== undefined) cred.priority = updates.priority;
    if (updates.weight !== undefined) cred.weight = updates.weight;
    if (updates.baseUrl !== undefined) cred.baseUrl = updates.baseUrl.trim() || undefined;
    if (updates.notes !== undefined) cred.notes = updates.notes.trim() || undefined;

    if (updates.apiKey && typeof updates.apiKey === 'string' && updates.apiKey.trim().length > 0) {
      const trimmed = updates.apiKey.trim();
      cred.maskedKey = maskApiKey(trimmed);
      inMemorySecrets.set(id, trimmed);
      cred.status = 'active';
      cred.cooldownUntil = undefined;
    }

    cred.updatedAt = now;
    list[index] = cred;

    saveMetadata(list);
    if (updates.apiKey) {
      saveSecrets();
    }

    return cred;
  }

  /**
   * Delete a credential from pool
   */
  public deleteCredential(id: string): boolean {
    const list = loadMetadata();
    const filtered = list.filter((c) => c.id !== id);
    if (filtered.length === list.length) {
      return false;
    }

    inMemorySecrets.delete(id);
    saveMetadata(filtered);
    saveSecrets();
    return true;
  }

  /**
   * Acquire next available healthy credential for a given provider.
   * Selection strategy:
   * 1. Filter to matching provider and status === 'active'.
   * 2. Sort strictly by priority (ascending, 1 = highest priority).
   * 3. Among equal priority, resolve deterministically alphabetically by ID to prevent random/round-robin load-balancing.
   */
  public acquireCredential(provider: ProviderType | string): { credential: ProviderCredential; rawKey: string } | null {
    const list = this.listCredentials();
    const candidates = list.filter(
      (c) => c.provider.toLowerCase() === provider.toLowerCase() && c.status === 'active' && (inMemorySecrets.has(c.id) || Boolean(this.getDirectEnvKey(provider)))
    );

    if (candidates.length === 0) {
      // Fallback check: is there an environment variable directly?
      const fallbackKey = this.getDirectEnvKey(provider);
      if (fallbackKey) {
        const dummy: ProviderCredential = {
          id: `direct_env_${provider}`,
          provider: provider as ProviderType,
          label: `Environment Fallback (${provider})`,
          status: 'active',
          priority: 99,
          maskedKey: maskApiKey(fallbackKey),
          isEnvFallback: true,
          totalRequests: 0,
          successCount: 0,
          failureCount: 0,
          rateLimitCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return { credential: dummy, rawKey: fallbackKey };
      }
      return null;
    }

    // Sort strictly by priority (ascending, 1 is highest priority), then alphabetically by ID
    candidates.sort((a, b) => {
      const priorityDiff = a.priority - b.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return a.id.localeCompare(b.id);
    });

    const selected = candidates[0];

    const rawKey = inMemorySecrets.get(selected.id) || this.getDirectEnvKey(provider);
    if (!rawKey) {
      return null;
    }

    // Update lastUsedAt
    selected.lastUsedAt = new Date().toISOString();
    selected.totalRequests = (selected.totalRequests || 0) + 1;
    saveMetadata(list);

    return { credential: selected, rawKey };
  }

  /**
   * Acquire a list of ordered fallback credentials for a provider.
   */
  public getOrderedCandidateCredentials(provider: ProviderType | string): { credential: ProviderCredential; rawKey: string }[] {
    const list = this.listCredentials();
    const candidates = list.filter(
      (c) => c.provider.toLowerCase() === provider.toLowerCase() && c.status === 'active'
    );

    // Sort strictly by priority (ascending), then alphabetically by ID
    candidates.sort((a, b) => {
      const priorityDiff = a.priority - b.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return a.id.localeCompare(b.id);
    });

    const result: { credential: ProviderCredential; rawKey: string }[] = [];
    for (const c of candidates) {
      const raw = inMemorySecrets.get(c.id);
      if (raw) {
        result.push({ credential: c, rawKey: raw });
      }
    }

    if (result.length === 0) {
      const directEnv = this.getDirectEnvKey(provider);
      if (directEnv) {
        result.push({
          credential: {
            id: `direct_env_${provider}`,
            provider: provider as ProviderType,
            label: `Environment Fallback (${provider})`,
            status: 'active',
            priority: 99,
            maskedKey: maskApiKey(directEnv),
            isEnvFallback: true,
            totalRequests: 0,
            successCount: 0,
            failureCount: 0,
            rateLimitCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          rawKey: directEnv,
        });
      }
    }

    return result;
  }

  /**
   * Record a successful request using a credential
   */
  public recordSuccess(credentialId: string): void {
    if (credentialId.startsWith('direct_env_')) return;
    const list = loadMetadata();
    const cred = list.find((c) => c.id === credentialId);
    if (!cred) return;

    cred.successCount = (cred.successCount || 0) + 1;
    cred.lastSuccessAt = new Date().toISOString();
    cred.updatedAt = new Date().toISOString();

    // If it was rate-limited or in error, restore to active
    if (cred.status === 'rate_limited') {
      cred.status = 'active';
      cred.cooldownUntil = undefined;
    }

    saveMetadata(list);
  }

  /**
   * Record a failure on a credential, triggering cooldown or status downgrade
   */
  public recordFailure(credentialId: string, error: any, options?: { silent?: boolean }): void {
    if (credentialId.startsWith('direct_env_')) return;
    const list = loadMetadata();
    const cred = list.find((c) => c.id === credentialId);
    if (!cred) return;

    const classification = classifyError(error);
    const now = new Date();
    cred.failureCount = (cred.failureCount || 0) + 1;
    cred.lastErrorAt = now.toISOString();
    cred.lastErrorMessage = error?.message ? String(error.message).slice(0, 300) : 'Unknown error';
    cred.lastErrorStatus = error?.status;
    cred.updatedAt = now.toISOString();

    if (classification === 'rate_limit' || classification === 'quota_exceeded') {
      cred.rateLimitCount = (cred.rateLimitCount || 0) + 1;
      cred.status = 'rate_limited';

      // Parse retry-after if present in error message
      let cooldownSec = 60; // default 60s cooldown
      if (error) {
        const msg = typeof error === 'string' ? error : (error.message ? String(error.message) : JSON.stringify(error));
        const match = msg.match(/retry after ([\d.]+)/i) ||
                      msg.match(/try again in ([\d.]+)s/i) ||
                      msg.match(/please retry in ([\d.]+)\s*s/i) ||
                      msg.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
        if (match && match[1]) {
          const parsed = parseFloat(match[1]);
          if (!isNaN(parsed) && parsed > 0) {
            cooldownSec = Math.min(Math.ceil(parsed), 300);
          }
        }
      }

      cred.cooldownUntil = new Date(now.getTime() + cooldownSec * 1000).toISOString();
      if (!options?.silent) {
        console.warn(`[CredentialManager] Credential "${cred.label}" (${cred.maskedKey}) marked RATE_LIMITED for ${cooldownSec}s.`);
      }
    } else if (classification === 'auth_error') {
      cred.status = 'invalid';
      if (!options?.silent) {
        console.warn(`[CredentialManager] Credential "${cred.label}" (${cred.maskedKey}) marked INVALID (Auth Error: ${cred.lastErrorMessage}).`);
      }
    }

    saveMetadata(list);
  }

  /**
   * Test connection with a specific credential or raw key
   */
  public async testCredential(
    target: { credentialId?: string; provider?: ProviderType; apiKey?: string; baseUrl?: string }
  ): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const startTime = Date.now();
    let provider: ProviderType = target.provider || 'google';
    let apiKey = target.apiKey;
    let baseUrl = target.baseUrl;

    if (target.credentialId) {
      const cred = this.getCredential(target.credentialId);
      if (!cred) {
        return { success: false, message: `Credential not found: ${target.credentialId}`, latencyMs: 0 };
      }
      provider = cred.provider;
      apiKey = this.getSecretKey(cred.id);
      baseUrl = cred.baseUrl;
    }

    if (!apiKey || apiKey.trim().length === 0) {
      apiKey = this.getDirectEnvKey(provider);
    }

    if (!apiKey) {
      return { success: false, message: `API Key missing for provider ${provider}`, latencyMs: 0 };
    }

    try {
      if (provider === 'google') {
        const ai = getGeminiAI(apiKey);
        const res = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: 'Ping test. Output {"status":"ok"} in valid JSON.',
          config: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        });
        const latency = Date.now() - startTime;
        if (!res.text) throw new Error('Empty response received from Gemini.');
        return {
          success: true,
          message: `Connection successful! Gemini response received in ${latency}ms.`,
          latencyMs: latency,
        };
      } else if (provider === 'kling') {
        // Kling Video API adapter test
        const effectiveBaseUrl = baseUrl || 'https://api.klingai.com/v1';
        const endpoint = `${effectiveBaseUrl.replace(/\/+$/, '')}/user/balance`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const latency = Date.now() - startTime;

        if (response.status === 401 || response.status === 403) {
          throw new Error(`HTTP ${response.status}: Kling API key is invalid or unauthorized.`);
        }

        return {
          success: true,
          message: `Connection successful! Kling Video API endpoint reached in ${latency}ms.`,
          latencyMs: latency,
        };
      } else if (provider === 'runway') {
        // Runway Gen-3 API adapter test
        const effectiveBaseUrl = baseUrl || 'https://api.dev.runwayml.com/v1';
        const endpoint = `${effectiveBaseUrl.replace(/\/+$/, '')}/tasks`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'X-Runway-Version': '2024-09-13',
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const latency = Date.now() - startTime;

        if (response.status === 401 || response.status === 403) {
          throw new Error(`HTTP ${response.status}: Runway API key is invalid or unauthorized.`);
        }

        return {
          success: true,
          message: `Connection successful! Runway Gen-3 API endpoint reached in ${latency}ms.`,
          latencyMs: latency,
        };
      } else {
        // OpenAI-compatible endpoint test (openai, openrouter, xai, custom_openai)
        const effectiveBaseUrl = baseUrl || (provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
        const endpoint = effectiveBaseUrl.endsWith('/chat/completions') ? effectiveBaseUrl : `${effectiveBaseUrl}/chat/completions`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: provider === 'openrouter' ? 'google/gemini-3.6-flash' : 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Ping test. Reply with OK.' }],
            max_tokens: 10,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const latency = Date.now() - startTime;

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`HTTP ${response.status}: ${errBody.slice(0, 150)}`);
        }

        return {
          success: true,
          message: `Connection successful! Provider responded in ${latency}ms.`,
          latencyMs: latency,
        };
      }
    } catch (err: any) {
      const latency = Date.now() - startTime;
      return {
        success: false,
        message: err?.message || 'Connection test failed.',
        latencyMs: latency,
      };
    }
  }

  /**
   * Get direct environment key fallback
   */
  private getDirectEnvKey(provider: string): string | undefined {
    switch (provider.toLowerCase()) {
      case 'google':
        return process.env.GEMINI_API_KEY;
      case 'openai':
        return process.env.OPENAI_API_KEY;
      case 'openrouter':
        return process.env.OPENROUTER_API_KEY;
      case 'xai':
        return process.env.XAI_API_KEY;
      case 'custom_openai':
        return process.env.CUSTOM_OPENAI_API_KEY;
      case 'kling':
        return process.env.KLING_API_KEY;
      case 'runway':
        return process.env.RUNWAY_API_KEY;
      default:
        return undefined;
    }
  }

  /**
   * Summary overview of all provider credentials in the pool
   */
  public getPoolSummary(): ProviderCredentialSummary {
    const list = this.listCredentials();
    const byProvider: Record<string, { total: number; active: number; rateLimited: number; invalid: number }> = {};

    for (const cred of list) {
      const p = cred.provider;
      if (!byProvider[p]) {
        byProvider[p] = { total: 0, active: 0, rateLimited: 0, invalid: 0 };
      }
      byProvider[p].total++;
      if (cred.status === 'active') byProvider[p].active++;
      else if (cred.status === 'rate_limited') byProvider[p].rateLimited++;
      else if (cred.status === 'invalid') byProvider[p].invalid++;
    }

    return {
      totalCredentials: list.length,
      activeCredentials: list.filter((c) => c.status === 'active').length,
      rateLimitedCredentials: list.filter((c) => c.status === 'rate_limited').length,
      invalidCredentials: list.filter((c) => c.status === 'invalid').length,
      providers: byProvider,
      credentials: list,
    };
  }
}

export const credentialManager = CredentialManager.getInstance();
