import 'dotenv/config';
import { credentialResolver } from './credential_resolver';
import { healthService } from './health_service';
import { quotaRouter } from './quota_router';
import { db } from '../db';

const providerId = 'local_9router_mtssnvob';
const credentialId = 'cred_1788879494520_dtsgo';
const resolved = await credentialResolver.resolveCredential({ providerId, modelId: 'codex', credentialDomain: 'API', requiredCapability: 'text' }).catch(() => null);
if (!resolved || resolved.domain !== 'API') throw new Error('Official credential resolver cannot resolve current 9Router credential');
await healthService.recordSuccess(credentialId);
await quotaRouter.resetProviderState(providerId);
const provider = await db.getProvider(providerId);
const credential = await db.getCredential(credentialId);
const health = await healthService.getHealth(credentialId);
const state = await quotaRouter.getProviderOperationalState(providerId);
console.log(JSON.stringify({ provider: provider && { id: provider.id, enabled: provider.enabled }, credential: credential && { id: credential.id, status: credential.status }, health: { status: health.status, consecutiveFailures: health.consecutiveFailures, successRate: health.successRate, cooldownUntil: health.cooldownUntil }, operational: { eligibility: state.eligibility, healthState: state.healthState, quotaState: state.quotaState, circuitState: state.circuitState } }));
