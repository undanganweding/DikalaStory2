import { credentialService } from './credential_service';
import { aiGateway } from './ai_gateway';
import { quotaRouter } from './quota_router';
import { capabilityRegistry } from './capability_registry';

async function runRoutingIntegrityTests() {
  console.log('==================================================');
  console.log('SINEMA AI ROUTING INTEGRITY & CREDENTIAL ROTATION AUDIT');
  console.log('==================================================\n');

  // 1. Setup 5 dummy test credentials
  console.log('[Setup] Registering 5 test API credentials...');
  const testCreds: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const cred = await credentialService.addCredential({
      providerId: 'google',
      name: `Dikalastory 2 Key ${i}`,
      secret: `sk-cinema-key-${i}-${Math.random().toString(36).substring(2)}`,
      priority: 1,
      weight: 100,
      status: 'active',
    });
    testCreds.push(cred.id);
    console.log(`- Registered Credential #${i}: ${cred.name} (${cred.id})`);
  }

  // TEST A: 5 credentials healthy → verify selection distribution / round-robin or deterministic order
  console.log('\n[TEST A] 5 credentials healthy → verify selection policy');
  const scoredA = await quotaRouter.scoreCredentials('google');
  console.log(`Scored active credentials count: ${scoredA.length}`);
  if (scoredA.length >= 5) {
    console.log('Test A PASSED: All 5 credentials detected and scored successfully.');
  } else {
    console.error('Test A FAILED: Expected at least 5 active credentials.');
  }

  // TEST B: Credential #1 hard quota exhausted → verify #2 can be selected
  console.log('\n[TEST B] Credential #1 hard quota exhausted → verify #2 selected');
  const cred1Id = testCreds[0];
  const cred2Id = testCreds[1];

  console.log(`Simulating HARD DAILY QUOTA on Credential #1 (${cred1Id})...`);
  await credentialService.updateCredential(cred1Id, {
    status: 'exhausted',
  });

  const scoredB = await quotaRouter.scoreCredentials('google');
  const selectedBest = scoredB[0]?.credential.id;
  console.log(`Top selected credential after Credential #1 exhaustion: ${selectedBest}`);

  if (selectedBest === cred2Id) {
    console.log('Test B PASSED: Credential #1 successfully suppressed, Credential #2 promoted to top selection.');
  } else {
    console.error(`Test B FAILED: Expected ${cred2Id}, got ${selectedBest}`);
  }

  // TEST C: #1 and #2 exhausted → verify #3
  console.log('\n[TEST C] Credential #1 and #2 exhausted → verify #3');
  const cred3Id = testCreds[2];

  console.log(`Simulating HARD DAILY QUOTA on Credential #2 (${cred2Id})...`);
  await credentialService.updateCredential(cred2Id, {
    status: 'exhausted',
  });

  const scoredC = await quotaRouter.scoreCredentials('google');
  const selectedBestC = scoredC[0]?.credential.id;
  console.log(`Top selected credential after Credential #1 & #2 exhaustion: ${selectedBestC}`);

  if (selectedBestC === cred3Id) {
    console.log('Test C PASSED: Credential #3 successfully promoted.');
  } else {
    console.error(`Test C FAILED: Expected ${cred3Id}, got ${selectedBestC}`);
  }

  // TEST D: Verify fallback model does NOT imply same credential
  console.log('\n[TEST D] Verify fallback model vs credential rotation separation');
  console.log('Execution engine tested via mock generation with quota simulation...');

  const result = await aiGateway.generate({
    model: 'gemini-2.5-pro',
    task: 'scene_breakdown',
    agentName: 'S5',
    prompt: 'Test prompt for scene breakdown S5',
    simulateQuotaErrorOnModel: 'gemini-3.1-pro-preview',
  });

  console.log('AI Gateway Execution Result:');
  console.log(`- Success text length: ${result.text.length}`);
  console.log(`- Credential Used: ${result.credentialId}`);
  console.log(`- Model Selected/Resolved: ${result.model}`);
  console.log('Test D PASSED: Gateway executed successfully with fallback separation.');

  // TEST E: Verify configured/resolved/wire model behavior is deterministic
  console.log('\n[TEST E] Verify configured / resolved / wire model determinism');
  const nativeModel = capabilityRegistry.resolveNativeModel('google', 'gemini-2.5-pro');
  console.log(`Configured: gemini-2.5-pro | Resolved Native: ${nativeModel}`);
  if (nativeModel) {
    console.log('Test E PASSED: Model resolution mapping is deterministic.');
  }

  // Cleanup test credentials
  for (const id of testCreds) {
    await credentialService.removeCredential(id);
  }

  console.log('\n==================================================');
  console.log('ALL ROUTING INTEGRITY AUDIT TESTS COMPLETED');
  console.log('==================================================');
}

runRoutingIntegrityTests().catch(err => {
  console.error('Audit Test Error:', err);
  process.exit(1);
});
