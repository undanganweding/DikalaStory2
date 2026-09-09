import 'dotenv/config';
import { db } from '../db';
import { quotaRouter } from './quota_router';
import { credentialService } from './credential_service';
import { healthService } from './health_service';
import { modelUsability } from './model_usability';

const providerId = 'local_9router_mtssnvob';
const credentialId = 'cred_1788879494520_dtsgo';
const modelId = 'codex';
const now = Date.now();
const provider = await db.getProvider(providerId);
const credential = await credentialService.getCredential(credentialId);
const health = credential ? await healthService.getHealth(credentialId) : null;
const providerState = await quotaRouter.getProviderOperationalState(providerId);
const credentialState = await quotaRouter.getCredentialOperationalState(credentialId);
const usable = modelUsability.get(providerId, modelId);
const predicates = {
  providerExists: Boolean(provider),
  providerEnabled: provider?.enabled === true,
  credentialExists: Boolean(credential),
  credentialStatusEnabled: credential ? credential.status !== 'disabled' : false,
  credentialAuthValid: credential ? credential.status !== 'invalid_auth' : false,
  credentialQuotaValid: credential ? credential.status !== 'exhausted' : false,
  credentialRateLimitValid: credential ? credential.status !== 'rate_limited' || !health?.cooldownUntil || health.cooldownUntil <= now : false,
  credentialCircuitValid: !health || health.consecutiveFailures < 3 || !health.cooldownUntil || health.cooldownUntil <= now,
  credentialCooldownExpired: !health?.cooldownUntil || health.cooldownUntil <= now,
  credentialOperationalEligibility: credentialState.eligibility,
  providerOperationalEligibility: providerState.eligibility,
  modelUsabilityEligible: modelUsability.isEligible(providerId, modelId),
};
const firstFalse = Object.entries(predicates).find(([, value]) => value === false);
console.log(JSON.stringify({ provider: provider && { id: provider.id, enabled: provider.enabled, status: (provider as any).status, baseUrl: provider.baseUrl }, credential: credential && { id: credential.id, providerId: credential.providerId, status: credential.status, priority: credential.priority }, health: health && { status: health.status, consecutiveFailures: health.consecutiveFailures, cooldownUntil: health.cooldownUntil, successRate: health.successRate, lastError: health.lastError, updatedAt: health.updatedAt }, modelUsability: usable || null, providerState, credentialState, predicates, firstFalse: firstFalse ? { predicate: firstFalse[0], value: firstFalse[1] } : null }));
