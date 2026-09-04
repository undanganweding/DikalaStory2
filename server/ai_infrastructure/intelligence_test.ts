import { credentialService } from './credential_service';
import { healthService } from './health_service';
import { usageService } from './usage_service';
import { intelligenceService } from './intelligence_service';

async function runIntelligenceTests() {
  console.log('Running AI Usage & Health Intelligence Tests...');

  if (!process.env.AI_SECRET_MASTER_KEY) {
    process.env.AI_SECRET_MASTER_KEY = 'test-master-secret-key-intelligence-12345';
  }

  // Create a test credential
  const cred = await credentialService.addCredential({
    providerId: 'google',
    name: 'Intel Test Key',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'AIzaSyIntelTestKey1234567890abcdef',
  });

  // Record some mock usages
  await usageService.recordUsage({
    credentialId: cred.id,
    modelId: 'gemini-3.1-flash-lite',
    promptTokens: 500,
    completionTokens: 200,
    totalTokens: 700,
    latencyMs: 1200,
    success: true,
  });

  await usageService.recordUsage({
    credentialId: cred.id,
    modelId: 'gemini-3.1-flash-lite',
    promptTokens: 800,
    completionTokens: 300,
    totalTokens: 1100,
    latencyMs: 1500,
    success: true,
  });

  await usageService.recordUsage({
    credentialId: cred.id,
    modelId: 'gemini-3.1-flash-lite',
    promptTokens: 300,
    completionTokens: 100,
    totalTokens: 400,
    latencyMs: 2500,
    success: false,
    errorType: 'rate_limit',
  });

  // Record health status / failure
  await healthService.recordFailure(cred.id, '429 Rate Limit Exceeded', 429);

  // Fetch intelligence report
  const intel = await intelligenceService.getCredentialIntelligence(cred.id);
  if (!intel) {
    throw new Error('Test Failed: Intelligence report not returned for test credential');
  }

  console.log('Credential Intelligence Report:', JSON.stringify(intel, null, 2));

  if (intel.metrics.totalRequests !== 3) {
    throw new Error(`Test Failed: Expected 3 total requests, got ${intel.metrics.totalRequests}`);
  }
  if (intel.metrics.totalTokens !== 2200) {
    throw new Error(`Test Failed: Expected 2200 total tokens, got ${intel.metrics.totalTokens}`);
  }
  if (intel.metrics.rateLimitHits !== 1) {
    throw new Error(`Test Failed: Expected 1 rate limit hit, got ${intel.metrics.rateLimitHits}`);
  }

  const overview = await intelligenceService.getDashboardOverview();
  console.log('Dashboard Overview Summary:', {
    totalRequests: overview.totalRequests,
    totalTokensUsed: overview.totalTokensUsed,
    overallSuccessRate: overview.overallSuccessRate,
    healthyCount: overview.healthyCount,
    cooldownCount: overview.cooldownCount,
  });

  if (overview.totalRequests < 3) {
    throw new Error('Test Failed: Dashboard overview total requests mismatch');
  }

  // Cleanup
  await credentialService.removeCredential(cred.id);

  console.log('🎉 All AI Usage & Health Intelligence tests passed successfully!');
}

runIntelligenceTests().catch(err => {
  console.error('❌ Intelligence Test Error:', err);
  process.exit(1);
});
