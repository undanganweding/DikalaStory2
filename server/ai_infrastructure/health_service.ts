import { AIHealth } from '../../src/types';
import { db } from '../db';

export type ErrorTypeCode =
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'QUOTA_EXHAUSTED_ERROR'
  | 'CONNECTION_ERROR'
  | 'TIMEOUT_ERROR'
  | 'DNS_ERROR'
  | 'SERVER_5XX_ERROR'
  | 'BAD_REQUEST_ERROR'
  | 'MODEL_NOT_FOUND_ERROR'
  | 'UNKNOWN_ERROR';

export const healthService = {
  classifyError(errorMsg: string, statusCode?: number): { errorType: ErrorTypeCode; cooldownMs?: number; setDown?: boolean } {
    const msg = (errorMsg || '').toLowerCase();
    
    // 1. Model Not Found Error (not a temporary health failure)
    if (msg.includes('model not found') || msg.includes('model_not_found') || msg.includes('model is not supported') || msg.includes('404 model') || msg.includes('unsupported model')) {
      return { errorType: 'MODEL_NOT_FOUND_ERROR' };
    }
    
    // 2. Bad Request Error
    if (statusCode === 400 || msg.includes('bad request') || msg.includes('invalid argument') || msg.includes('invalid payload')) {
      return { errorType: 'BAD_REQUEST_ERROR' };
    }
    
    // 3. Authentication & Authorization Errors
    if (statusCode === 401 || statusCode === 403 || msg.includes('invalid_auth') || msg.includes('api key not valid') || msg.includes('unauthorized') || msg.includes('permission denied') || msg.includes('forbidden') || msg.includes('invalid api key') || msg.includes('auth_failed')) {
      return { errorType: 'AUTHENTICATION_ERROR', setDown: true };
    }
    
    // 3b. Quota Exhausted / Hard Daily Quota Error (must be evaluated BEFORE generic 429 rate limit check)
    const isHardDailyQuota =
      msg.includes('generaterequestsperday') ||
      msg.includes('generatecontentinputtokenspermodelperday') ||
      msg.includes('perdayperprojectpermodel') ||
      (msg.includes('freetier') && (msg.includes('day') || msg.includes('daily') || msg.includes('perday'))) ||
      msg.includes('quota exceeded') ||
      msg.includes('quota_exhausted') ||
      msg.includes('out of quota') ||
      msg.includes('exhausted quota') ||
      msg.includes('exhausted');

    if (isHardDailyQuota) {
      return { errorType: 'QUOTA_EXHAUSTED_ERROR' };
    }
    
    // 4. Rate Limit Error (transient RPM/TPM rate limits)
    if (statusCode === 429 || msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('rate_limited')) {
      return { errorType: 'RATE_LIMIT_ERROR', cooldownMs: 60 * 1000 };
    }
    
    // 6. Connection & Timeout & DNS Errors
    if (statusCode === 504 || msg.includes('timeout') || msg.includes('connect') || msg.includes('dns') || msg.includes('econnrefused') || msg.includes('network error') || msg.includes('fetch failed') || msg.includes('socket')) {
      return { errorType: 'CONNECTION_ERROR', cooldownMs: 30 * 1000 };
    }
    
    // 6b. Model Overload / High Demand Spikes (temporary transient demand, short backoff, do not lock down credential)
    if (msg.includes('high demand') || msg.includes('spikes in demand')) {
      return { errorType: 'SERVER_5XX_ERROR', cooldownMs: 3 * 1000 };
    }

    // 7. Server 5XX Error
    if ((statusCode && statusCode >= 500 && statusCode < 600) || msg.includes('internal server error') || msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('bad gateway') || msg.includes('service unavailable') || msg.includes('overloaded')) {
      return { errorType: 'SERVER_5XX_ERROR', cooldownMs: 2 * 60 * 1000 };
    }
    
    return { errorType: 'UNKNOWN_ERROR', cooldownMs: 30 * 1000 };
  },

  async getHealth(credentialId: string): Promise<AIHealth> {
    const existing = await db.getHealth(credentialId);
    if (existing) return existing;
    
    const defaultHealth: AIHealth = {
      credentialId,
      status: 'healthy',
      consecutiveFailures: 0,
      successRate: 100,
      updatedAt: Date.now(),
    };
    
    if (credentialId === 'env_gemini_default') {
      return defaultHealth;
    }

    const cred = await db.getCredential(credentialId);
    if (cred) {
      await db.saveHealth(defaultHealth);
    }
    return defaultHealth;
  },

  async recordSuccess(credentialId: string): Promise<AIHealth> {
    const health = await this.getHealth(credentialId);
    const consecutiveFailures = 0;
    const successRate = Math.min(100, health.successRate + 2);

    // Restore status to active if it was temporarily rate_limited or exhausted
    const cred = await db.getCredential(credentialId);
    if (cred && (cred.status === 'rate_limited' || cred.status === 'exhausted' || cred.status === 'invalid_auth')) {
      cred.status = 'active';
      await db.saveCredential(cred);
    }
    
    const updated: AIHealth = {
      ...health,
      status: 'healthy',
      consecutiveFailures,
      successRate,
      cooldownUntil: undefined,
      lastError: undefined,
      updatedAt: Date.now(),
    };
    return db.saveHealth(updated);
  },

  async recordFailure(credentialId: string, error: string, statusCode?: number): Promise<AIHealth> {
    const health = await this.getHealth(credentialId);
    const classification = this.classifyError(error, statusCode);

    // Update credential status in DB
    const cred = await db.getCredential(credentialId);
    if (cred) {
      if (classification.errorType === 'AUTHENTICATION_ERROR' || classification.errorType === 'AUTHORIZATION_ERROR') {
        cred.status = 'invalid_auth';
        await db.saveCredential(cred);
      } else if (classification.errorType === 'RATE_LIMIT_ERROR') {
        cred.status = 'rate_limited';
        await db.saveCredential(cred);
      }
    }

    // Do NOT treat model not found, bad request, or daily model quota exhaustion as network/connectivity failure (circuit breaker shouldn't open for resource/model limits)
    if (classification.errorType === 'MODEL_NOT_FOUND_ERROR' || classification.errorType === 'BAD_REQUEST_ERROR' || classification.errorType === 'QUOTA_EXHAUSTED_ERROR') {
      const updated: AIHealth = {
        ...health,
        lastError: `[${classification.errorType}] ${error}`,
        updatedAt: Date.now(),
      };
      return db.saveHealth(updated);
    }

    const consecutiveFailures = health.consecutiveFailures + 1;
    const successRate = Math.max(0, health.successRate - 15);
    
    let status: 'healthy' | 'degraded' | 'down' = 'degraded';
    let cooldownUntil: number | undefined = undefined;

    if (classification.cooldownMs) {
      cooldownUntil = Date.now() + classification.cooldownMs;
      status = 'degraded';
    }

    if (classification.setDown || consecutiveFailures >= 3) {
      status = 'down';
      cooldownUntil = Date.now() + 10 * 60 * 1000;
    }

    const updated: AIHealth = {
      ...health,
      status,
      consecutiveFailures,
      successRate,
      cooldownUntil,
      lastError: `[${classification.errorType}] ${error}`,
      updatedAt: Date.now(),
    };
    return db.saveHealth(updated);
  },

  async isAvailable(credentialId: string): Promise<boolean> {
    const health = await this.getHealth(credentialId);
    if (health.status === 'down') return false;
    if (health.cooldownUntil && health.cooldownUntil > Date.now()) {
      return false;
    }
    return true;
  },

  async resetHealth(credentialId: string): Promise<AIHealth> {
    const fresh: AIHealth = {
      credentialId,
      status: 'healthy',
      consecutiveFailures: 0,
      successRate: 100,
      updatedAt: Date.now(),
    };
    return db.saveHealth(fresh);
  },
};

