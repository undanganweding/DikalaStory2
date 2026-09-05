import { credentialService } from './credential_service';
import { healthService } from './health_service';
import { usageService } from './usage_service';
import { providerService } from './provider_service';
import { secretVault } from '../security/secret_vault';
import { AICredential } from '../../src/types';

export type CredentialState = 'ACTIVE' | 'WARNING' | 'RATE_LIMITED' | 'FAILED' | 'DISABLED';

export interface ScoredCredential {
  credential: AICredential;
  healthStatus: string;
  successRate: number;
  avgLatencyMs: number;
  score: number;
  state: CredentialState;
}

export interface RouterSelectionResult {
  credentialId: string;
  providerId: string;
  apiKey: string;
  state: CredentialState;
  score: number;
  fallbackChain: string[];
}

export interface CredentialOperationalState {
  healthState: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'UNKNOWN';
  quotaState: 'QUOTA_AVAILABLE' | 'QUOTA_EXHAUSTED' | 'QUOTA_UNKNOWN';
  rateLimitState: 'RATE_LIMITED' | 'OK';
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  cooldownUntil?: number;
  eligibility: boolean;
  lastCheckedAt: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
  failureReason?: string;
}

export interface ProviderOperationalState {
  healthState: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'UNKNOWN';
  quotaState: 'QUOTA_AVAILABLE' | 'QUOTA_EXHAUSTED';
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  cooldownUntil?: number;
  eligibility: boolean;
  lastCheckedAt: number;
  lastFailureAt?: number;
  failureReason?: string;
}

// Cached operational state for provider-wide failures
const providerGlobalStates = new Map<string, {
  status: 'healthy' | 'unavailable' | 'quota_exhausted';
  lastFailureReason?: string;
  lastCheckedAt: number;
}>();

export const quotaRouter = {
  // Record provider-wide failure
  async recordProviderFailure(providerId: string, status: 'unavailable' | 'quota_exhausted', reason: string): Promise<void> {
    providerGlobalStates.set(providerId, {
      status,
      lastFailureReason: reason,
      lastCheckedAt: Date.now(),
    });
  },

  // Reset provider-wide failure (for recovery test or manual reset)
  async resetProviderState(providerId: string): Promise<void> {
    providerGlobalStates.delete(providerId);
  },

  // Determine Credential State Machine (for backward compatibility / legacy tests)
  async getCredentialState(credentialId: string): Promise<CredentialState> {
    const cred = await credentialService.getCredential(credentialId);
    if (!cred || cred.status === 'disabled') {
      return 'DISABLED';
    }
    if (cred.status === 'invalid_auth' || cred.status === 'exhausted') {
      return 'FAILED';
    }

    const health = await healthService.getHealth(credentialId);
    if (health.cooldownUntil && health.cooldownUntil > Date.now()) {
      return 'RATE_LIMITED';
    }
    if (health.status === 'down') {
      return 'FAILED';
    }
    if (health.status === 'degraded' || health.successRate < 90) {
      return 'WARNING';
    }

    return 'ACTIVE';
  },

  // Evolve into a detailed state-aware eligibility evaluation
  async getCredentialOperationalState(credentialId: string): Promise<CredentialOperationalState> {
    const cred = await credentialService.getCredential(credentialId);
    if (!cred) {
      return {
        healthState: 'UNKNOWN',
        quotaState: 'QUOTA_UNKNOWN',
        rateLimitState: 'OK',
        circuitState: 'CLOSED',
        eligibility: false,
        lastCheckedAt: Date.now(),
      };
    }

    const health = await healthService.getHealth(credentialId);
    
    // 1. Health State
    let healthState: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'UNKNOWN' = 'HEALTHY';
    if (cred.status === 'disabled' || cred.status === 'invalid_auth') {
      healthState = 'UNAVAILABLE';
    } else if (health.status === 'down') {
      healthState = 'UNAVAILABLE';
    } else if (health.status === 'degraded') {
      healthState = 'DEGRADED';
    }

    // 2. Quota State
    let quotaState: 'QUOTA_AVAILABLE' | 'QUOTA_EXHAUSTED' | 'QUOTA_UNKNOWN' = 'QUOTA_UNKNOWN';
    if (cred.status === 'exhausted') {
      quotaState = 'QUOTA_EXHAUSTED';
    } else if (cred.status === 'active') {
      // If there are recorded successes in usages, we consider it QUOTA_AVAILABLE, else QUOTA_UNKNOWN
      const usages = await usageService.listUsage(100);
      const credUsages = usages.filter(u => u.credentialId === credentialId);
      if (credUsages.some(u => u.success)) {
        quotaState = 'QUOTA_AVAILABLE';
      }
    }

    // 3. Rate Limit State
    const hasActiveCooldown = health.cooldownUntil && health.cooldownUntil > Date.now();
    let rateLimitState: 'RATE_LIMITED' | 'OK' = 'OK';
    if (cred.status === 'rate_limited') {
      if (hasActiveCooldown) {
        rateLimitState = 'RATE_LIMITED';
      } else {
        // Cooldown has expired, auto-heal status to active
        cred.status = 'active';
        await credentialService.updateCredential(cred.id, { status: 'active' });
      }
    } else if (health.lastError?.includes('RATE_LIMIT') && hasActiveCooldown) {
      rateLimitState = 'RATE_LIMITED';
    }

    // 4. Circuit Breaker State
    let circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    if (health.consecutiveFailures >= 3) {
      if (health.cooldownUntil && health.cooldownUntil > Date.now()) {
        circuitState = 'OPEN';
      } else {
        circuitState = 'HALF_OPEN';
      }
    }

    // 5. Cooldown Until
    const cooldownUntil = health.cooldownUntil;

    // 6. Eligibility
    const isEnabled = cred.status !== 'disabled';
    const isAuthValid = cred.status !== 'invalid_auth';
    const isQuotaValid = quotaState !== 'QUOTA_EXHAUSTED';
    const isRateLimitValid = rateLimitState !== 'RATE_LIMITED';
    const isCircuitValid = circuitState !== 'OPEN'; // CLOSED or HALF_OPEN is valid (probe allowed)
    const isCooldownExpired = !cooldownUntil || cooldownUntil <= Date.now();

    const eligibility = isEnabled && isAuthValid && isQuotaValid && isRateLimitValid && isCircuitValid && isCooldownExpired;

    return {
      healthState,
      quotaState,
      rateLimitState,
      circuitState,
      cooldownUntil,
      eligibility,
      lastCheckedAt: Date.now(),
      failureReason: health.lastError,
    };
  },

  // Evolve into provider-level eligibility evaluation
  async getProviderOperationalState(providerId: string): Promise<ProviderOperationalState> {
    const provider = await providerService.getProvider(providerId);
    if (!provider || !provider.enabled) {
      return {
        healthState: 'UNAVAILABLE',
        quotaState: 'QUOTA_EXHAUSTED',
        circuitState: 'OPEN',
        eligibility: false,
        lastCheckedAt: Date.now(),
      };
    }

    // Check cached provider-wide global failure (with 5-minute TTL recovery revalidation)
    const cachedGlobalState = providerGlobalStates.get(providerId);
    if (cachedGlobalState) {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      if (cachedGlobalState.lastCheckedAt > fiveMinutesAgo) {
        if (cachedGlobalState.status === 'unavailable') {
          return {
            healthState: 'UNAVAILABLE',
            quotaState: 'QUOTA_AVAILABLE',
            circuitState: 'OPEN',
            eligibility: false,
            lastCheckedAt: Date.now(),
            failureReason: cachedGlobalState.lastFailureReason,
          };
        } else if (cachedGlobalState.status === 'quota_exhausted') {
          return {
            healthState: 'HEALTHY',
            quotaState: 'QUOTA_EXHAUSTED',
            circuitState: 'CLOSED',
            eligibility: false,
            lastCheckedAt: Date.now(),
            failureReason: cachedGlobalState.lastFailureReason,
          };
        }
      } else {
        // Expired (cooldown recovery revalidation)
        providerGlobalStates.delete(providerId);
      }
    }

    const allCreds = await credentialService.listCredentials();
    const creds = allCreds.filter(c => c.providerId === providerId);

    if (creds.length === 0) {
      return {
        healthState: 'UNAVAILABLE',
        quotaState: 'QUOTA_EXHAUSTED',
        circuitState: 'OPEN',
        eligibility: false,
        lastCheckedAt: Date.now(),
        failureReason: 'No credentials configured',
      };
    }

    // Compute derived states across pool
    let someHealthy = false;
    let someDegraded = false;
    let allExhausted = true;
    let allCircuitOpen = true;
    let someEligible = false;

    for (const c of creds) {
      const state = await this.getCredentialOperationalState(c.id);
      if (state.healthState === 'HEALTHY') someHealthy = true;
      if (state.healthState === 'DEGRADED') someDegraded = true;
      if (state.quotaState !== 'QUOTA_EXHAUSTED') allExhausted = false;
      if (state.circuitState !== 'OPEN') allCircuitOpen = false;
      if (state.eligibility) someEligible = true;
    }

    const healthState = someHealthy ? 'HEALTHY' : (someDegraded ? 'DEGRADED' : 'UNAVAILABLE');
    const quotaState = allExhausted ? 'QUOTA_EXHAUSTED' : 'QUOTA_AVAILABLE';
    const circuitState = allCircuitOpen ? 'OPEN' : 'CLOSED';
    
    // Eligibility: must have at least one eligible credential
    const eligibility = someEligible;

    return {
      healthState,
      quotaState,
      circuitState,
      eligibility,
      lastCheckedAt: Date.now(),
    };
  },

  // Score all available credentials for smart rotation
  async scoreCredentials(providerId: string): Promise<ScoredCredential[]> {
    // 1. Verify Provider-level Eligibility first!
    const providerState = await this.getProviderOperationalState(providerId);
    if (!providerState.eligibility) {
      return [];
    }

    const allCreds = await credentialService.listCredentials();
    const scored: ScoredCredential[] = [];

    for (const cred of allCreds) {
      if (cred.providerId !== providerId) continue;

      const opState = await this.getCredentialOperationalState(cred.id);
      
      // Skip ineligible credentials in router selection
      if (!opState.eligibility) {
        continue;
      }

      // Keep getCredentialState for backwards-compatibility of return type "state"
      const state = await this.getCredentialState(cred.id);

      // Score strictly by priority (cred.priority: lower number = higher priority)
      const priority = cred.priority || 1;
      const statePenalty = state === 'WARNING' ? 5 : 0;
      
      // Compute a fully deterministic score where highest priority has highest score
      const totalScore = 1000 - (priority * 10) - statePenalty;

      scored.push({
        credential: cred,
        healthStatus: opState.healthState.toLowerCase(),
        successRate: 100, // bypassed
        avgLatencyMs: 0, // completely bypass latency monitoring
        score: totalScore,
        state,
      });
    }

    // Sort descending by score. If scores are equal, resolve deterministically by ID alphabetical order.
    scored.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      return a.credential.id.localeCompare(b.credential.id);
    });
    return scored;
  },

  // Determine Active Provider under Strict Provider Priority (Priority 1: Custom, Priority 2: Google)
  async determineActiveProvider(): Promise<string> {
    const providers = await providerService.listProviders();
    const customProviders = providers.filter(p => p.id !== 'google' && p.enabled);

    for (const p of customProviders) {
      const state = await this.getProviderOperationalState(p.id);
      if (state.eligibility) {
        return p.id; // Priority 1: Healthy custom provider
      }
    }

    // Priority 2: Fallback to Google
    return 'google';
  },

  // Select best credential with smart fallback chain
  async selectCredential(providerId: string, preScored?: ScoredCredential[]): Promise<RouterSelectionResult> {
    let scored = (preScored && preScored.length > 0) ? preScored : await this.scoreCredentials(providerId);
    if (scored.length === 0 && providerId !== 'google') {
      scored = await this.scoreCredentials('google');
    }
    if (scored.length === 0) {
      if (process.env.GEMINI_API_KEY) {
        return {
          credentialId: 'env_gemini_default',
          providerId: 'google',
          apiKey: process.env.GEMINI_API_KEY,
          state: 'ACTIVE',
          score: 990,
          fallbackChain: ['env_gemini_default'],
        };
      }
      throw new Error(`QuotaRouter: No available healthy credentials for provider: ${providerId}`);
    }

    const fallbackChain = scored.map(s => s.credential.id);
    const best = scored[0];

    let apiKey = '';
    try {
      apiKey = secretVault.decryptSecret(best.credential.encryptedSecret);
    } catch (err: any) {
      if ((best.credential as any).secret) {
        apiKey = (best.credential as any).secret;
      } else {
        throw new Error(`Failed to decrypt API key for selected credential ${best.credential.id}: ${err.message}`);
      }
    }
    if (!apiKey && (best.credential as any).secret) {
      apiKey = (best.credential as any).secret;
    }

    // Update last used timestamp
    await credentialService.updateCredential(best.credential.id, { lastUsedAt: Date.now() });

    return {
      credentialId: best.credential.id,
      providerId: best.credential.providerId,
      apiKey,
      state: best.state,
      score: best.score,
      fallbackChain,
    };
  },
};
