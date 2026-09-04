import { usageService } from './usage_service';

async function testLogsIntegration() {
  console.log('Testing AI Usage & Logs API Contract...');

  // Record a test execution
  const testRecord = await usageService.recordUsage({
    credentialId: 'cred_test_verify',
    modelId: 'gemini-3.7-flash',
    requestType: 'generation_test',
    stage: 'audit_validation',
    promptTokens: 120,
    completionTokens: 80,
    totalTokens: 200,
    latencyMs: 145,
    success: true,
  });

  console.log('Saved test usage record:', testRecord.id);

  // List usage
  const usages = await usageService.listUsage(10);
  console.log(`Retrieved ${usages.length} usage records.`);

  if (usages.length === 0) {
    throw new Error('Expected at least 1 usage record');
  }

  const latest = usages[0];
  console.log('Latest log record:', {
    id: latest.id,
    timestamp: latest.timestamp,
    modelId: latest.modelId,
    requestType: latest.requestType,
    stage: latest.stage,
    totalTokens: latest.totalTokens,
    latencyMs: latest.latencyMs,
    success: latest.success,
  });

  // Assertions
  if (!latest.id || !latest.timestamp || !latest.modelId || typeof latest.success !== 'boolean') {
    throw new Error('Usage record missing required fields');
  }

  // Security check: ensure no secrets are stored
  if ((latest as any).secret || (latest as any).apiKey || (latest as any).encryptedSecret) {
    throw new Error('Usage record leaked secret fields!');
  }

  console.log('✅ Real Logs & AI Usage Verification Test Passed Successfully!');
}

testLogsIntegration().catch(err => {
  console.error('❌ Logs test failed:', err);
  process.exit(1);
});
