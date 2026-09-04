// Force local JSON store and disable live Firestore to prevent network quota limits (e.g. 8 RESOURCE_EXHAUSTED) during test execution.
process.env.FORCE_LOCAL_DB = 'true';
delete process.env.FIREBASE_PROJECT_ID;
delete process.env.GOOGLE_CLOUD_PROJECT;
delete process.env.GCLOUD_PROJECT;
delete process.env.FIRESTORE_PROJECT_ID;
delete process.env.FIREBASE_CLIENT_EMAIL;
delete process.env.FIREBASE_PRIVATE_KEY;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

import { aiGateway } from './ai_gateway';
import { credentialService } from './credential_service';
import { providerService } from './provider_service';
import { observabilityService } from './observability_service';
import { costIntelligence } from './cost_intelligence';

async function runGatewayTests() {
  console.log('Running Phase 4.6 - 4.8 AI Gateway, Observability & Cost Intelligence Tests...');

  if (!process.env.AI_SECRET_MASTER_KEY) {
    process.env.AI_SECRET_MASTER_KEY = 'test-master-secret-key-gateway-12345';
  }

  // Setup a mock / test provider & credential
  try {
    await providerService.addProvider({
      id: 'google',
      name: 'Google Gemini',
      type: 'gemini',
      enabled: true,
      capabilities: { text: true, vision: true, image: false, video: false },
    });
  } catch {}

  const cred = await credentialService.addCredential({
    providerId: 'google',
    name: 'Gateway Test Key',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'AIzaSyGatewayTestApiKey1234567890',
  });

  // Test Observability log recording
  await observabilityService.logRequest({
    requestId: 'req_test_123',
    agentName: 'AIFilmDirector',
    taskType: 'script_breakdown',
    provider: 'google',
    credentialId: cred.id,
    tokens: { prompt: 150, completion: 350, total: 500 },
    latencyMs: 850,
    success: true,
    timestamp: Date.now(),
  });

  const logs = await observabilityService.listLogs(10);
  if (logs.length === 0 || logs[0].requestId !== 'req_test_123') {
    throw new Error('Test Failed: Observability logs not recorded properly');
  }
  console.log('✅ Observability test passed: Log recorded and retrieved.');

  // Test Cost Intelligence
  const costSummary = await costIntelligence.getCostSummary(10.0);
  console.log('Cost Intelligence Summary:', costSummary);

  if (costSummary.totalTokensToday < 500) {
    throw new Error('Test Failed: Cost intelligence token summation mismatch');
  }
  console.log('✅ Cost Intelligence test passed.');

  // Cleanup
  await credentialService.removeCredential(cred.id);

  console.log('🎉 All Phase 4.6 - 4.8 Gateway & Observability tests passed successfully!');
}

runGatewayTests().catch(err => {
  console.error('❌ Gateway Test Error:', err);
  process.exit(1);
});
