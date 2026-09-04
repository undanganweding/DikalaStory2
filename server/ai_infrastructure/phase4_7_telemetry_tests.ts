import '../isolate_test_env';
import { aiGateway } from './ai_gateway';
import { observabilityService } from './observability_service';
import { providerService } from './provider_service';
import { credentialService } from './credential_service';
import { quotaRouter } from './quota_router';
import { healthService } from './health_service';
import { secretVault } from '../security/secret_vault';
import { GoogleGenAI } from '@google/genai';

/**
 * PHASE 4.7 — TELEMETRY & OBSERVABILITY TEST SUITE
 * 
 * Verifies that:
 * 1. End-to-End Control Plane Telemetry Capture: Every AI Gateway generation captures full trace metadata.
 * 2. Passivity & Non-Interference: Telemetry failure or errors MUST NEVER disrupt generation or alter routing decisions.
 * 3. Observer Principle: Telemetry is purely an observer and never becomes a control plane participant.
 * 4. Summary Metrics & Analytics: Accurate calculation of latencies, token counts, success rates, failover trails, and error status breakdown.
 */

// Global fetch mock for full offline execution safety
const originalFetch = global.fetch;
global.fetch = (async (url: any, options: any) => {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [{ text: 'Mock Telemetry Response from Google Gemini' }],
          },
        },
      ],
      usageMetadata: {
        promptTokenCount: 15,
        candidatesTokenCount: 25,
        totalTokenCount: 40,
      },
    }),
    text: async () => JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'Mock Telemetry Response from Google Gemini' }] } }],
    }),
  } as any;
}) as any;

// Mock GoogleGenAI for 100% offline test execution
Object.defineProperty(GoogleGenAI.prototype, 'models', {
  get() {
    return {
      generateContent: async (args: any) => {
        return {
          text: `[Mock Telemetry Generation Response for model ${args.model}]`,
        };
      },
    };
  },
  set(val) {
    // Ignore assignment inside GoogleGenAI constructor
  },
  configurable: true,
});

async function runTelemetryTestSuite() {
  console.log('=== RUNNING PHASE 4.7 INFRASTRUCTURE TELEMETRY & OBSERVABILITY TESTS ===\n');

  if (!process.env.AI_SECRET_MASTER_KEY) {
    process.env.AI_SECRET_MASTER_KEY = 'test-phase4.7-master-key-123';
  }

  // Setup test environment
  await observabilityService.clearTelemetry();
  await quotaRouter.resetProviderState('google');

  // Ensure default google provider and active credential exist
  let googleProv = await providerService.getProvider('google');
  if (!googleProv) {
    googleProv = await providerService.addProvider({
      id: 'google',
      name: 'Google Gemini',
      type: 'gemini',
      enabled: true,
      capabilities: { text: true, vision: true, image: true, video: true },
    });
  } else {
    await providerService.updateProvider('google', {
      enabled: true,
      capabilities: { text: true, vision: true, image: true, video: true },
    });
  }

  const allCreds = await credentialService.listCredentials();
  const googleCreds = allCreds.filter(c => c.providerId === 'google');
  for (const c of googleCreds) {
    await credentialService.updateCredential(c.id, { status: 'active' });
    await healthService.recordSuccess(c.id);
  }

  let testCred = googleCreds[0];
  if (!testCred) {
    testCred = await credentialService.addCredential({
      providerId: 'google',
      name: 'Test Google Key 47',
      secret: 'dummy_test_api_key_47',
      status: 'active',
      priority: 1,
      weight: 10,
    });
    await healthService.recordSuccess(testCred.id);
  }

  const googleOpState = await quotaRouter.getProviderOperationalState('google');

  // ----------------------------------------------------
  // TEST 1: End-to-End Telemetry Trace Capture
  // ----------------------------------------------------
  console.log('1. Testing End-to-End Control Plane Telemetry Trace Capture...');
  const req1 = {
    model: 'ops-5',
    providerId: 'google',
    agentName: 'S1_StoryUnderstanding',
    task: 'script_analysis',
    prompt: 'Analyze story character arcs.',
  };

  const response1 = await aiGateway.generate(req1);
  const telemetryLogs1 = await observabilityService.listTelemetry({ limit: 10 });

  if (telemetryLogs1.length === 0) {
    throw new Error('❌ Test 1 Failed: No telemetry trace recorded after aiGateway.generate()!');
  }

  const trace1 = telemetryLogs1[0];
  console.log('Captured Telemetry Trace:', JSON.stringify(trace1, null, 2));

  if (
    !trace1.requestId ||
    trace1.agentName !== 'S1_StoryUnderstanding' ||
    trace1.requestedModel !== 'ops-5' ||
    !trace1.resolvedModel ||
    !trace1.providerId ||
    !trace1.credentialId ||
    !trace1.eligibilityResult.eligibleProviderIds.includes(trace1.providerId) ||
    !trace1.capabilityResult.capableProviderIds.includes(trace1.providerId) ||
    trace1.latencyMs < 0 ||
    trace1.success !== true
  ) {
    throw new Error(`❌ Test 1 Failed: Telemetry trace payload incomplete or mismatched! Trace: ${JSON.stringify(trace1)}`);
  }
  console.log('✅ Test 1 PASSED: Full trace metadata correctly captured.\n');

  // ----------------------------------------------------
  // TEST 2: Passivity & Non-Interference Verification
  // ----------------------------------------------------
  console.log('2. Testing Telemetry Passivity & Non-Interference (Failure Resilience)...');
  const originalLogTelemetry = observabilityService.logTelemetry;

  // Force logTelemetry to throw an unhandled error
  observabilityService.logTelemetry = async () => {
    throw new Error('Simulated Telemetry Buffer Critical Crash');
  };

  try {
    const response2 = await aiGateway.generate({
      model: 'ops-5',
      providerId: 'google',
      agentName: 'S2_CharacterDetection',
      prompt: 'Detect characters in scene.',
    });

    if (!response2 || !response2.text) {
      throw new Error('❌ Test 2 Failed: AI Gateway failed when telemetry threw an error!');
    }
    console.log('✅ Test 2 PASSED: AI Gateway succeeded cleanly despite telemetry crash (Observer Non-Interference proven).\n');
  } finally {
    // Restore original logTelemetry
    observabilityService.logTelemetry = originalLogTelemetry;
  }

  // ----------------------------------------------------
  // TEST 3: Aggregated Metrics & Summary Calculations
  // ----------------------------------------------------
  console.log('3. Testing Control Plane Telemetry Aggregated Summary Metrics...');
  await observabilityService.clearTelemetry();

  // Simulate multiple traces
  await observabilityService.logTelemetry({
    requestId: 'req_test_01',
    agentName: 'S1_Story',
    taskType: 'analysis',
    requestedModel: 'ops-5',
    resolvedModel: 'gemini-2.5-flash',
    providerId: 'google',
    credentialId: testCred.id,
    eligibilityResult: { totalEnabledProviders: 1, eligibleProviderIds: ['google'] },
    capabilityResult: { capableProviderIds: ['google'] },
    attempts: 1,
    failoverCount: 0,
    cooldownTriggered: false,
    statusCode: 200,
    tokens: { prompt: 100, completion: 50, total: 150 },
    latencyMs: 120,
    success: true,
    timestamp: Date.now(),
  });

  await observabilityService.logTelemetry({
    requestId: 'req_test_02',
    agentName: 'S3_Location',
    taskType: 'detection',
    requestedModel: 'ops-5',
    resolvedModel: 'gemini-2.5-flash',
    providerId: 'google',
    credentialId: testCred.id,
    eligibilityResult: { totalEnabledProviders: 1, eligibleProviderIds: ['google'] },
    capabilityResult: { capableProviderIds: ['google'] },
    attempts: 2,
    failoverCount: 1,
    cooldownTriggered: true,
    statusCode: 429,
    tokens: { prompt: 0, completion: 0, total: 0 },
    latencyMs: 300,
    success: false,
    error: 'Rate limit exceeded (429)',
    timestamp: Date.now(),
  });

  const summary = await observabilityService.getSummaryMetrics();
  console.log('Summary Metrics Output:', JSON.stringify(summary, null, 2));

  if (
    summary.totalRequests !== 2 ||
    summary.successfulRequests !== 1 ||
    summary.failedRequests !== 1 ||
    summary.overallSuccessRate !== 50 ||
    summary.averageLatencyMs !== 210 ||
    summary.totalTokensUsed !== 150 ||
    summary.totalFailovers !== 1 ||
    !summary.providerBreakdown['google'] ||
    summary.statusCodeBreakdown[429] !== 1
  ) {
    throw new Error(`❌ Test 3 Failed: Telemetry summary metrics calculation mismatch! Summary: ${JSON.stringify(summary)}`);
  }
  console.log('✅ Test 3 PASSED: Control Plane telemetry summary metrics verified.\n');

  // ----------------------------------------------------
  // TEST 4: Telemetry Filtering Capabilities
  // ----------------------------------------------------
  console.log('4. Testing Telemetry Log Query & Filtering...');
  const s1Logs = await observabilityService.listTelemetry({ agentName: 'S1_Story' });
  const failedLogs = await observabilityService.listTelemetry({ success: false });

  if (s1Logs.length !== 1 || s1Logs[0].requestId !== 'req_test_01') {
    throw new Error('❌ Test 4 Failed: Filtering by agentName failed!');
  }

  if (failedLogs.length !== 1 || failedLogs[0].requestId !== 'req_test_02') {
    throw new Error('❌ Test 4 Failed: Filtering by success status failed!');
  }
  console.log('✅ Test 4 PASSED: Telemetry log filtering operates cleanly.\n');

  console.log('=====================================================');
  console.log('🎉 ALL PHASE 4.7 TELEMETRY & OBSERVABILITY TESTS PASSED!');
  console.log('=====================================================\n');
  process.exit(0);
}

runTelemetryTestSuite().catch((err) => {
  console.error('Fatal error in Phase 4.7 Telemetry Test Suite:', err);
  process.exit(1);
});
