import { quotaRouter } from './quota_router';
import { credentialService } from './credential_service';
import { healthService } from './health_service';
import { usageService } from './usage_service';

async function runQuotaRouterTests() {
  console.log('Running Quota-Aware Credential Router Simulation Tests...');

  if (!process.env.AI_SECRET_MASTER_KEY) {
    process.env.AI_SECRET_MASTER_KEY = 'test-master-secret-key-quota-router-12345';
  }

  // Cleanup old test credentials
  const existing = await credentialService.listCredentials();
  for (const c of existing) {
    if (c.id.startsWith('router_test_')) {
      await credentialService.removeCredential(c.id);
    }
  }

  // Setup test keys:
  // Key A: High success rate, low latency, active state
  const credA = await credentialService.addCredential({
    providerId: 'google',
    name: 'Router Key A (Fast & Healthy)',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'AIzaSyRouterKeyAPlaintext1234567890',
  });
  await healthService.recordSuccess(credA.id);
  await usageService.recordUsage({
    credentialId: credA.id,
    modelId: 'gemini-3.7-flash',
    latencyMs: 300,
    success: true,
    totalTokens: 1000,
  });

  // Key B: Slower latency, warning state
  const credB = await credentialService.addCredential({
    providerId: 'google',
    name: 'Router Key B (Slower)',
    status: 'active',
    priority: 2,
    weight: 10,
    secret: 'AIzaSyRouterKeyBPlaintext1234567890',
  });
  await healthService.recordFailure(credB.id, 'Temporary degradation', 500);

  // Key C: Rate limited / cooldown state
  const credC = await credentialService.addCredential({
    providerId: 'google',
    name: 'Router Key C (Rate Limited)',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'AIzaSyRouterKeyCPlaintext1234567890',
  });
  await healthService.recordFailure(credC.id, '429 Rate Limit Exceeded', 429);

  console.log('Seeded 3 router test credentials.');

  // Test State Machine
  const stateA = await quotaRouter.getCredentialState(credA.id);
  const stateC = await quotaRouter.getCredentialState(credC.id);
  console.log(`Credential A State: ${stateA} (Expected: ACTIVE)`);
  console.log(`Credential C State: ${stateC} (Expected: RATE_LIMITED)`);

  if (stateA !== 'ACTIVE') {
    throw new Error(`State Machine Test Failed: Credential A is ${stateA}, expected ACTIVE`);
  }
  if (stateC !== 'RATE_LIMITED') {
    throw new Error(`State Machine Test Failed: Credential C is ${stateC}, expected RATE_LIMITED`);
  }

  // Test Selection & Scoring
  const selection = await quotaRouter.selectCredential('google');
  console.log('Router Selection Result:', {
    credentialId: selection.credentialId,
    state: selection.state,
    score: selection.score,
    fallbackChain: selection.fallbackChain,
  });

  if (selection.credentialId !== credA.id) {
    throw new Error(`Router Selection Failed: Expected Key A (${credA.id}), got ${selection.credentialId}`);
  }

  console.log('✅ Quota-Aware Router Selection & State Machine Tests Passed Successfully!');

  // Cleanup
  await credentialService.removeCredential(credA.id);
  await credentialService.removeCredential(credB.id);
  await credentialService.removeCredential(credC.id);

  console.log('🎉 All Quota Router tests completed successfully!');
}

runQuotaRouterTests().catch(err => {
  console.error('❌ Quota Router Test Error:', err);
  process.exit(1);
});
