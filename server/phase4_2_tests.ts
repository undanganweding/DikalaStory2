import './isolate_test_env';
import { quotaRouter } from './ai_infrastructure/quota_router';
import { credentialService } from './ai_infrastructure/credential_service';
import { providerService } from './ai_infrastructure/provider_service';
import { healthService } from './ai_infrastructure/health_service';
import { usageService } from './ai_infrastructure/usage_service';
import { db } from './db';

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPhase42Tests() {
  console.log('================================================================');
  console.log('  SINEMA PHASE 4.2 — DETAILED QUOTA-AWARE ELIGIBILITY ENGINE   ');
  console.log('================================================================');

  if (!process.env.AI_SECRET_MASTER_KEY) {
    process.env.AI_SECRET_MASTER_KEY = 'test-master-secret-key-quota-router-12345';
  }

  // 1. Setup Providers
  const customProviderId = 'custom_test_provider';
  let customProvider = await providerService.getProvider(customProviderId);
  if (!customProvider) {
    customProvider = await providerService.addProvider({
      id: customProviderId,
      name: 'Custom Test Provider',
      type: 'openai-compatible',
      enabled: true,
      capabilities: { text: true, vision: true, image: true, video: true },
    });
  } else {
    // Ensure enabled
    await providerService.updateProvider(customProviderId, { enabled: true });
  }

  const googleProvider = await providerService.getProvider('google');
  if (!googleProvider) {
    await providerService.addProvider({
      id: 'google',
      name: 'Google Gemini',
      type: 'gemini',
      enabled: true,
      capabilities: { text: true, vision: true, image: true, video: true },
    });
  } else {
    // Ensure enabled
    await providerService.updateProvider('google', { enabled: true });
  }

  // Disable other custom providers to avoid interference from earlier test runs
  const allProviders = await providerService.listProviders();
  for (const p of allProviders) {
    if (p.id !== 'google' && p.id !== customProviderId) {
      await providerService.updateProvider(p.id, { enabled: false });
    }
  }

  // Helper to purge credentials belonging to our test providers
  async function cleanupCredentials() {
    const creds = await credentialService.listCredentials();
    for (const c of creds) {
      if (c.providerId === customProviderId || c.id.startsWith('test_')) {
        await credentialService.removeCredential(c.id);
      }
    }
    // Also reset any cached global states in router
    await quotaRouter.resetProviderState(customProviderId);
    await quotaRouter.resetProviderState('google');
  }

  // --- TEST-42A: Provider Priority ---
  console.log('\n--- TEST-42A: Provider Priority ---');
  await cleanupCredentials();

  const customK1 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'Custom Key 1',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'custom-secret-key-1-value',
  });
  await healthService.recordSuccess(customK1.id);

  const googleK1 = await credentialService.addCredential({
    providerId: 'google',
    name: 'Google Key 1',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'google-secret-key-1-value',
  });
  await healthService.recordSuccess(googleK1.id);

  // Custom (Priority 1) should be chosen over Google (Priority 2)
  const activeProvider = await quotaRouter.determineActiveProvider();
  console.log(`Active Provider: ${activeProvider} (Expected: ${customProviderId})`);
  if (activeProvider !== customProviderId) {
    throw new Error(`Provider Priority Failed: Expected ${customProviderId}, got ${activeProvider}`);
  }

  const selectedCred = await quotaRouter.selectCredential(activeProvider);
  console.log(`Selected Credential: ${selectedCred.credentialId} (Expected: ${customK1.id})`);
  if (selectedCred.credentialId !== customK1.id) {
    throw new Error(`Credential Priority Failed: Expected ${customK1.id}, got ${selectedCred.credentialId}`);
  }
  console.log('✓ TEST-42A Passed.');

  // --- TEST-42B: Credential Quota ---
  console.log('\n--- TEST-42B: Credential Quota ---');
  await cleanupCredentials();

  // Custom K1 is exhausted, Custom K2 is active
  const ck1 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'Custom Key 1 (Exhausted)',
    status: 'exhausted',
    priority: 1,
    weight: 10,
    secret: 'custom-secret-k1',
  });
  const ck2 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'Custom Key 2 (Active)',
    status: 'active',
    priority: 2,
    weight: 10,
    secret: 'custom-secret-k2',
  });
  await healthService.recordSuccess(ck2.id);

  const opCk1 = await quotaRouter.getCredentialOperationalState(ck1.id);
  const opCk2 = await quotaRouter.getCredentialOperationalState(ck2.id);

  console.log(`ck1 Quota State: ${opCk1.quotaState} (Expected: QUOTA_EXHAUSTED)`);
  console.log(`ck2 Quota State: ${opCk2.quotaState} (Expected: QUOTA_UNKNOWN or QUOTA_AVAILABLE)`);
  
  if (opCk1.quotaState !== 'QUOTA_EXHAUSTED') {
    throw new Error(`Quota State verification failed for ck1: expected QUOTA_EXHAUSTED, got ${opCk1.quotaState}`);
  }

  // Active provider should still be Custom, because CK2 is eligible
  const actProvB = await quotaRouter.determineActiveProvider();
  console.log(`Active Provider with CK1 exhausted: ${actProvB} (Expected: ${customProviderId})`);
  if (actProvB !== customProviderId) {
    throw new Error(`Provider Quota Isolation failed: Custom should remain active when at least one key is eligible`);
  }

  const selB = await quotaRouter.selectCredential(customProviderId);
  console.log(`Selected Credential: ${selB.credentialId} (Expected: ${ck2.id})`);
  if (selB.credentialId !== ck2.id) {
    throw new Error(`Quota Router Selection failed: Expected CK2 (${ck2.id}) to be selected, got ${selB.credentialId}`);
  }
  console.log('✓ TEST-42B Passed.');

  // --- TEST-42C: Provider Quota ---
  console.log('\n--- TEST-42C: Provider Quota ---');
  await cleanupCredentials();

  // All custom keys are exhausted, Google is active
  const ck3 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'Custom Key 3 (Exhausted)',
    status: 'exhausted',
    priority: 1,
    weight: 10,
    secret: 'custom-secret-k3',
  });
  const gk1 = await credentialService.addCredential({
    providerId: 'google',
    name: 'Google Key 1 (Active)',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'google-secret-k1',
  });
  await healthService.recordSuccess(gk1.id);

  const provState = await quotaRouter.getProviderOperationalState(customProviderId);
  console.log(`Custom Provider Quota State: ${provState.quotaState} (Expected: QUOTA_EXHAUSTED)`);
  console.log(`Custom Provider Eligibility: ${provState.eligibility} (Expected: false)`);

  if (provState.quotaState !== 'QUOTA_EXHAUSTED' || provState.eligibility !== false) {
    throw new Error(`Provider Quota State failed: Expected Custom to be QUOTA_EXHAUSTED & ineligible`);
  }

  // Google should be selected as active fallback
  const actProvC = await quotaRouter.determineActiveProvider();
  console.log(`Active Provider with Custom Exhausted: ${actProvC} (Expected: google)`);
  if (actProvC !== 'google') {
    throw new Error(`Failover failed: Expected fallback to google, got ${actProvC}`);
  }
  console.log('✓ TEST-42C Passed.');

  // --- TEST-42D: Rate Limit ---
  console.log('\n--- TEST-42D: Rate Limit ---');
  await cleanupCredentials();

  const ck4 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'Custom Key 4',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'custom-secret-k4',
  });
  const ck5 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'Custom Key 5',
    status: 'active',
    priority: 2,
    weight: 10,
    secret: 'custom-secret-k5',
  });
  await healthService.recordSuccess(ck5.id);

  // Trigger rate limit failure on CK4
  await healthService.recordFailure(ck4.id, '429 Rate Limit Exceeded', 429);

  const opCk4 = await quotaRouter.getCredentialOperationalState(ck4.id);
  console.log(`ck4 Rate Limit State: ${opCk4.rateLimitState} (Expected: RATE_LIMITED)`);
  console.log(`ck4 Eligibility: ${opCk4.eligibility} (Expected: false)`);

  if (opCk4.rateLimitState !== 'RATE_LIMITED' || opCk4.eligibility !== false) {
    throw new Error(`Rate limit state or eligibility incorrect for ck4`);
  }

  // Selection must route to ck5
  const selD = await quotaRouter.selectCredential(customProviderId);
  console.log(`Selected Credential under rate limit: ${selD.credentialId} (Expected: ${ck5.id})`);
  if (selD.credentialId !== ck5.id) {
    throw new Error(`Rate limit selection bypass failed: Expected ${ck5.id}, got ${selD.credentialId}`);
  }
  console.log('✓ TEST-42D Passed.');

  // --- TEST-42E: Health Failure ---
  console.log('\n--- TEST-42E: Health Failure ---');
  await cleanupCredentials();

  const ck6 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'Custom Key 6',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'custom-secret-k6',
  });
  const ck7 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'Custom Key 7',
    status: 'active',
    priority: 2,
    weight: 10,
    secret: 'custom-secret-k7',
  });
  await healthService.recordSuccess(ck7.id);

  // Trigger transient network failure on CK6
  await healthService.recordFailure(ck6.id, 'Network timeout', 504);

  const opCk6 = await quotaRouter.getCredentialOperationalState(ck6.id);
  console.log(`ck6 Health State: ${opCk6.healthState} (Expected: DEGRADED)`);
  console.log(`ck6 Circuit Breaker: ${opCk6.circuitState} (Expected: CLOSED)`);
  console.log(`ck6 Eligibility: ${opCk6.eligibility} (Expected: false due to active cooldown window)`);

  if (opCk6.healthState !== 'DEGRADED' || opCk6.eligibility !== false) {
    throw new Error(`Health failure mapping failed for ck6`);
  }

  const selE = await quotaRouter.selectCredential(customProviderId);
  if (selE.credentialId !== ck7.id) {
    throw new Error(`Health failure selection bypass failed: Expected ${ck7.id}, got ${selE.credentialId}`);
  }
  console.log('✓ TEST-42E Passed.');

  // --- TEST-42F: Circuit Breaker ---
  console.log('\n--- TEST-42F: Circuit Breaker ---');
  await cleanupCredentials();

  const ck8 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'Custom Key 8',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'custom-secret-k8',
  });

  // Record 3 consecutive connection failures to trip the circuit
  await healthService.recordFailure(ck8.id, '500 connection refused', 500);
  await healthService.recordFailure(ck8.id, '500 connection refused', 500);
  await healthService.recordFailure(ck8.id, '500 connection refused', 500);

  const opCk8 = await quotaRouter.getCredentialOperationalState(ck8.id);
  console.log(`ck8 Health State: ${opCk8.healthState} (Expected: UNAVAILABLE)`);
  console.log(`ck8 Circuit State: ${opCk8.circuitState} (Expected: OPEN)`);
  console.log(`ck8 Eligibility: ${opCk8.eligibility} (Expected: false)`);

  if (opCk8.circuitState !== 'OPEN' || opCk8.eligibility !== false) {
    throw new Error(`Circuit Breaker failed to trip into OPEN state`);
  }
  console.log('✓ TEST-42F Passed.');

  // --- TEST-42G: Cooldown & Cooldown Recovery ---
  console.log('\n--- TEST-42G: Cooldown & Cooldown Recovery ---');
  await cleanupCredentials();

  const ck9 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'Custom Key 9 (Priority 1)',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'custom-secret-k9',
  });
  const ck10 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'Custom Key 10 (Priority 2)',
    status: 'active',
    priority: 2,
    weight: 10,
    secret: 'custom-secret-k10',
  });
  await healthService.recordSuccess(ck10.id);

  // Trigger rate limit with tiny custom cooldown for test (using recordFailure first)
  await healthService.recordFailure(ck9.id, '429 too many requests', 429);
  
  // Directly overwrite cooldown to test immediate expiration / recovery
  const healthRec = await healthService.getHealth(ck9.id);
  healthRec.cooldownUntil = Date.now() - 1000; // expired
  await db.saveHealth(healthRec);

  const opCk9 = await quotaRouter.getCredentialOperationalState(ck9.id);
  console.log(`ck9 Cooldown Active: ${opCk9.cooldownUntil && opCk9.cooldownUntil > Date.now()} (Expected: false)`);
  console.log(`ck9 Eligibility after expired cooldown: ${opCk9.eligibility} (Expected: true)`);

  if (opCk9.eligibility !== true) {
    throw new Error(`Cooldown Recovery failed: ck9 should become eligible once cooldown expires`);
  }

  // Under deterministic priority, recovered CK9 (Priority 1) should be chosen over CK10 (Priority 2)
  const selG = await quotaRouter.selectCredential(customProviderId);
  console.log(`Selected Credential after recovery: ${selG.credentialId} (Expected: ${ck9.id})`);
  if (selG.credentialId !== ck9.id) {
    throw new Error(`Priority-based Cooldown Recovery failed: Expected ${ck9.id}, got ${selG.credentialId}`);
  }
  console.log('✓ TEST-42G Passed.');

  // --- TEST-42H: Unknown Quota ---
  console.log('\n--- TEST-42H: Unknown Quota ---');
  await cleanupCredentials();

  const ck11 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'Custom Key 11',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'custom-secret-k11',
  });

  const opCk11 = await quotaRouter.getCredentialOperationalState(ck11.id);
  console.log(`ck11 Quota State: ${opCk11.quotaState} (Expected: QUOTA_UNKNOWN)`);
  console.log(`ck11 Eligibility with Unknown Quota: ${opCk11.eligibility} (Expected: true)`);

  if (opCk11.quotaState !== 'QUOTA_UNKNOWN' || opCk11.eligibility !== true) {
    throw new Error(`Unknown quota state handling failed: should be QUOTA_UNKNOWN and eligible`);
  }
  console.log('✓ TEST-42H Passed.');

  // --- TEST-42I: Authentication Failure ---
  console.log('\n--- TEST-42I: Authentication Failure ---');
  await cleanupCredentials();

  const ck12 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'Custom Key 12',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'custom-secret-k12',
  });
  const ck13 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'Custom Key 13',
    status: 'active',
    priority: 2,
    weight: 10,
    secret: 'custom-secret-k13',
  });
  await healthService.recordSuccess(ck13.id);

  // Trigger auth failure
  await healthService.recordFailure(ck12.id, '401 Unauthorized API Key', 401);

  const opCk12 = await quotaRouter.getCredentialOperationalState(ck12.id);
  console.log(`ck12 Health State: ${opCk12.healthState} (Expected: UNAVAILABLE)`);
  console.log(`ck12 Eligibility: ${opCk12.eligibility} (Expected: false)`);

  const selI = await quotaRouter.selectCredential(customProviderId);
  console.log(`Selected Credential after auth failure: ${selI.credentialId} (Expected: ${ck13.id})`);
  if (selI.credentialId !== ck13.id) {
    throw new Error(`Authentication failure bypass failed: Expected ${ck13.id}`);
  }
  console.log('✓ TEST-42I Passed.');

  // --- TEST-42J: All Credentials Unavailable ---
  console.log('\n--- TEST-42J: All Credentials Unavailable ---');
  await cleanupCredentials();

  const ck14 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'Custom Key 14',
    status: 'exhausted',
    priority: 1,
    weight: 10,
    secret: 'custom-secret-k14',
  });
  const ck15 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'Custom Key 15',
    status: 'active',
    priority: 2,
    weight: 10,
    secret: 'custom-secret-k15',
  });
  await healthService.recordFailure(ck15.id, '429 Rate Limited', 429);

  const ck16 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'Custom Key 16',
    status: 'active',
    priority: 3,
    weight: 10,
    secret: 'custom-secret-k16',
  });
  await healthService.recordFailure(ck16.id, '401 Unauthorized', 401);

  const gk2 = await credentialService.addCredential({
    providerId: 'google',
    name: 'Google Key 2',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'google-secret-k2',
  });
  await healthService.recordSuccess(gk2.id);

  // All custom keys are ineligible (ck14 exhausted, ck15 rate limited, ck16 auth failed). Expect fallback to Google
  const actProvJ = await quotaRouter.determineActiveProvider();
  console.log(`Active Provider with all custom keys unavailable: ${actProvJ} (Expected: google)`);
  if (actProvJ !== 'google') {
    throw new Error(`Failover failed: Custom has no eligible keys, should route to google`);
  }
  console.log('✓ TEST-42J Passed.');

  // --- TEST-42K: Recovery ---
  console.log('\n--- TEST-42K: Recovery ---');
  await cleanupCredentials();

  // Custom initially has only rate-limited keys
  const ck17 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'Custom Key 17',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'custom-secret-k17',
  });
  await healthService.recordFailure(ck17.id, '429 Rate Limit', 429);

  const gk3 = await credentialService.addCredential({
    providerId: 'google',
    name: 'Google Key 3',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'google-secret-k3',
  });
  await healthService.recordSuccess(gk3.id);

  // 1. Google active
  const actProvK1 = await quotaRouter.determineActiveProvider();
  console.log(`Active Provider (Initially): ${actProvK1} (Expected: google)`);

  // 2. Custom recovers
  await healthService.recordSuccess(ck17.id);

  const actProvK2 = await quotaRouter.determineActiveProvider();
  console.log(`Active Provider (After Custom recovery): ${actProvK2} (Expected: ${customProviderId})`);
  if (actProvK2 !== customProviderId) {
    throw new Error(`Recovery failed: Custom recovered but Google remained active`);
  }
  console.log('✓ TEST-42K Passed.');

  // --- TEST-42L: Provider Isolation ---
  console.log('\n--- TEST-42L: Provider Isolation ---');
  await cleanupCredentials();

  const ck18 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'Custom Key 18 (Healthy but Slow)',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'custom-secret-k18',
  });
  await healthService.recordSuccess(ck18.id);

  const gk4 = await credentialService.addCredential({
    providerId: 'google',
    name: 'Google Key 4 (Ultrafast)',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'google-secret-k4',
  });
  await healthService.recordSuccess(gk4.id);

  // Custom is Priority 1, and eligible. Google is Priority 2, faster.
  // Google must remain completely untouched (NOT selected).
  const actProvL = await quotaRouter.determineActiveProvider();
  console.log(`Selected Provider under strict isolation: ${actProvL} (Expected: ${customProviderId})`);
  if (actProvL !== customProviderId) {
    throw new Error(`Isolation failed: Google selected instead of Custom even though Custom is eligible`);
  }
  console.log('✓ TEST-42L Passed.');

  // --- TEST-42M: Negative Cases Audit ---
  console.log('\n--- TEST-42M: Negative Cases Audit ---');
  await cleanupCredentials();

  // Let's seed 3 custom keys with different properties
  const k1 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'K1',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'k1-secret',
  });
  const k2 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'K2',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'k2-secret',
  });
  await healthService.recordSuccess(k1.id);
  await healthService.recordSuccess(k2.id);

  // Select credential multiple times. Under deterministic tie-breaking alphabetical by ID,
  // it must ALWAYS select the exact same key (first in alphabetical order of their ID), NOT round-robin, NOT random.
  const selections: string[] = [];
  for (let i = 0; i < 5; i++) {
    const sel = await quotaRouter.selectCredential(customProviderId);
    selections.push(sel.credentialId);
  }

  const allSame = selections.every(id => id === selections[0]);
  console.log(`Deterministic selection result: [${selections.join(', ')}] (All same: ${allSame})`);
  if (!allSame) {
    throw new Error(`Load-balancing / Round-Robin regression: selection is not deterministic!`);
  }

  // Ensure bad requests and model not found do not degrade health
  const k3 = await credentialService.addCredential({
    providerId: customProviderId,
    name: 'K3',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'k3-secret',
  });
  await healthService.recordSuccess(k3.id);
  await healthService.recordFailure(k3.id, 'Model gemini-fake is not supported', 404);

  const opK3 = await quotaRouter.getCredentialOperationalState(k3.id);
  console.log(`k3 consecutive failures after model not found: ${opK3.circuitState} (Expected: CLOSED)`);
  if (opK3.circuitState !== 'CLOSED') {
    throw new Error(`Regression: Model not found error incorrectly tripped the circuit breaker`);
  }

  console.log('✓ TEST-42M Passed.');

  await cleanupCredentials();
  console.log('\n================================================================');
  console.log('  ALL PHASE 4.2 TESTS COMPLETED SUCCESSFULLY (100% GREEN)       ');
  console.log('================================================================');
}

runPhase42Tests().catch((err) => {
  console.error('❌ PHASE 4.2 TEST SUITE FAILED:', err);
  process.exit(1);
});
