import { adaptiveOptimizer } from './adaptive_optimizer';
import { adaptiveMemoryService } from './adaptive_memory';
import { observabilityService } from './observability_service';
import { classifyTaskRequirements, rankCandidatesForIntent } from './intelligence_router';
import { aiGateway } from './ai_gateway';

async function runPhase53Tests() {
  console.log('=== Phase 5.3A Adaptive Optimizer Verification ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // Test 1: Telemetry aggregation works
  observabilityService.clearRecords();
  adaptiveMemoryService.clear();
  const baselineScore = adaptiveOptimizer.calculateModelScore('untested-model-1', 'general');

  assert(
    baselineScore.overallScore === 82 &&
    baselineScore.reliabilityScore === 100 &&
    baselineScore.qualityScore === 80,
    `Test 1: Telemetry aggregation works - default baseline generated for unmonitored model (overall: ${baselineScore.overallScore})`
  );

  // Test 2: Failed model receives lower reliability score
  observabilityService.clearRecords();
  adaptiveMemoryService.clear();

  for (let i = 0; i < 3; i++) {
    observabilityService.recordTelemetry({
      traceId: `t_${i}`,
      spanId: `s_${i}`,
      agentName: 'TestAgent',
      taskType: 'cinematic_breakdown',
      providerId: 'google',
      model: 'error-model-a',
      status: 'success',
      latencyMs: 500,
    });
  }
  for (let i = 3; i < 10; i++) {
    observabilityService.recordTelemetry({
      traceId: `t_${i}`,
      spanId: `s_${i}`,
      agentName: 'TestAgent',
      taskType: 'cinematic_breakdown',
      providerId: 'google',
      model: 'error-model-a',
      status: 'error',
      errorMessage: 'Simulated API failure',
      latencyMs: 2000,
    });
  }

  const errorModelScore = adaptiveOptimizer.calculateModelScore('error-model-a', 'cinematic_breakdown');

  assert(
    errorModelScore.reliabilityScore === 30 &&
    errorModelScore.overallScore < baselineScore.overallScore,
    `Test 2: Failed model receives lower reliability score (${errorModelScore.reliabilityScore}/100) and overall score (${errorModelScore.overallScore})`
  );

  // Test 3: Adaptive ranking hints
  const mockCandidates = [
    {
      id: 'error-model-a',
      name: 'Error Model A',
      providerId: 'google',
      supportedCapabilities: ['text', 'reasoning'],
      costPer1kInputTokens: 0.001,
      costPer1kOutputTokens: 0.004,
      tier: 'pro' as const,
    },
    {
      id: 'healthy-model-b',
      name: 'Healthy Model B',
      providerId: 'google',
      supportedCapabilities: ['text', 'reasoning'],
      costPer1kInputTokens: 0.001,
      costPer1kOutputTokens: 0.004,
      tier: 'pro' as const,
    },
  ];

  const intent = classifyTaskRequirements('character_bible_cinematic_reasoning');
  const rankedCandidate = rankCandidatesForIntent(intent, mockCandidates);

  assert(
    rankedCandidate?.modelId === 'healthy-model-b',
    `Test 3: Adaptive score influences ranking hints - Healthy Model B selected over Error Model A: ${rankedCandidate?.modelId}`
  );

  // Test 4: Capability filtering prevents invalid model selection
  const incapableModel = [
    {
      id: 'high-scoring-incapable-model',
      name: 'Incapable Model',
      providerId: 'google',
      supportedCapabilities: ['vision'],
      costPer1kInputTokens: 0.0001,
      costPer1kOutputTokens: 0.0001,
      tier: 'flash' as const,
    },
  ];

  const capabilityResult = rankCandidatesForIntent(intent, incapableModel);

  assert(
    capabilityResult === undefined,
    'Test 4: Capability filtering still prevents invalid model selection even if model exists'
  );

  // Test 5: AMM remains final authority
  observabilityService.clearRecords();
  const gatewayRes = await aiGateway.generate({
    task: 'character_bible_cinematic_reasoning',
    prompt: 'AMM authority verification prompt',
  });

  const gatewayTelemetry = observabilityService.getRecords()[0];

  assert(
    gatewayRes.model !== undefined &&
    gatewayTelemetry.adaptiveScore !== undefined &&
    gatewayTelemetry.optimizationReason !== undefined,
    'Test 5: AMM remains final authority - Gateway completes generation with adaptiveScore & optimizationReason in telemetry'
  );

  console.log(`\n=== Verification Complete: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runPhase53Tests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
