import { adaptiveOptimizer } from './adaptive_optimizer';
import { adaptiveMemoryService } from './adaptive_memory';
import { observabilityService } from './observability_service';
import { classifyTaskRequirements, rankCandidatesForIntent } from './intelligence_router';
import { aiGateway } from './ai_gateway';

async function runPhase53bTests() {
  console.log('=== Phase 5.3B Adaptive Learning Verification ===\n');

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

  // Test 1: Unknown model gets baseline learning score (82)
  observabilityService.clearRecords();
  adaptiveMemoryService.clear();

  const unknownScore = adaptiveOptimizer.getLearningScore('unknown-model-xyz', 'cinematic_reasoning');
  assert(
    unknownScore === 82,
    `Test 1: Unknown model gets baseline learning score of 82 (actual: ${unknownScore})`
  );

  // Test 2: Repeated successful executions increase memory score
  observabilityService.clearRecords();
  adaptiveMemoryService.clear();

  // Record 5 successful telemetry runs with fast latency
  for (let i = 0; i < 5; i++) {
    observabilityService.recordTelemetry({
      traceId: `t_${i}`,
      spanId: `s_${i}`,
      agentName: 'TestAgent',
      taskType: 'cinematic_reasoning',
      providerId: 'google',
      model: 'model-growing',
      status: 'success',
      latencyMs: 200,
      estimatedCostUSD: 0.0001,
    });
    adaptiveOptimizer.calculateModelScore('model-growing', 'cinematic_reasoning');
  }

  const memoryAfterSuccess = adaptiveMemoryService.get('model-growing', 'cinematic_reasoning');

  assert(
    memoryAfterSuccess !== undefined &&
    memoryAfterSuccess.sampleCount === 5 &&
    memoryAfterSuccess.averageScore >= 88,
    `Test 2: Repeated successful executions increase memory score (${memoryAfterSuccess?.averageScore}/100 across 5 samples)`
  );

  // Test 3: Single failure does not destroy historical reputation (EMA dampens impact)
  const scoreBeforeFailure = memoryAfterSuccess?.averageScore || 90;

  // Record 1 failure
  observabilityService.recordTelemetry({
    traceId: 't_fail',
    spanId: 's_fail',
    agentName: 'TestAgent',
    taskType: 'cinematic_reasoning',
    providerId: 'google',
    model: 'model-growing',
    status: 'error',
    errorMessage: 'Transient network glitch',
    latencyMs: 1500,
  });

  const scoreWithFailure = adaptiveOptimizer.calculateModelScore('model-growing', 'cinematic_reasoning');

  assert(
    scoreWithFailure.learningScore > 60 &&
    scoreWithFailure.learningScore >= scoreBeforeFailure - 15,
    `Test 3: Single failure does not destroy historical reputation (EMA maintained score at ${scoreWithFailure.learningScore} vs prior ${scoreBeforeFailure})`
  );

  // Test 4: Different taskClass keeps independent memories
  observabilityService.recordTelemetry({
    traceId: 't_m1',
    spanId: 's_m1',
    agentName: 'TestAgent',
    taskType: 'cinematic_reasoning',
    providerId: 'google',
    model: 'multi-task-model',
    status: 'success',
    latencyMs: 300,
  });
  adaptiveOptimizer.calculateModelScore('multi-task-model', 'cinematic_reasoning');

  observabilityService.recordTelemetry({
    traceId: 't_m2',
    spanId: 's_m2',
    agentName: 'TestAgent',
    taskType: 'simple_extraction',
    providerId: 'google',
    model: 'multi-task-model',
    status: 'success',
    latencyMs: 100,
  });
  adaptiveOptimizer.calculateModelScore('multi-task-model', 'simple_extraction');

  const reasoningMemory = adaptiveMemoryService.get('multi-task-model', 'cinematic_reasoning');
  const extractionMemory = adaptiveMemoryService.get('multi-task-model', 'simple_extraction');

  assert(
    reasoningMemory !== undefined &&
    extractionMemory !== undefined &&
    reasoningMemory.taskClass === 'cinematic_reasoning' &&
    extractionMemory.taskClass === 'simple_extraction',
    'Test 4: Different taskClass keeps independent memories for the same model'
  );

  // Test 5: Router prefers historically stronger candidate
  observabilityService.clearRecords();
  adaptiveMemoryService.clear();

  // Populate model-strong with high score memory
  adaptiveMemoryService.update('model-strong', 'cinematic_reasoning', 95, 95, 100);
  // Populate model-weak with low score memory
  adaptiveMemoryService.update('model-weak', 'cinematic_reasoning', 40, 40, 40);

  const mockCandidates = [
    {
      id: 'model-weak',
      name: 'Model Weak',
      providerId: 'google',
      supportedCapabilities: ['text', 'reasoning'],
      costPer1kInputTokens: 0.001,
      costPer1kOutputTokens: 0.004,
      tier: 'pro' as const,
    },
    {
      id: 'model-strong',
      name: 'Model Strong',
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
    rankedCandidate?.modelId === 'model-strong' &&
    rankedCandidate?.learningScore === 95,
    `Test 5: Router prefers historically stronger candidate: selected ${rankedCandidate?.modelId} (learningScore: ${rankedCandidate?.learningScore})`
  );

  // Test 6: Capability filtering still blocks invalid models
  const invalidCandidateSet = [
    {
      id: 'model-strong',
      name: 'Model Strong',
      providerId: 'google',
      supportedCapabilities: ['vision'], // lacks required 'text' and 'reasoning'
      costPer1kInputTokens: 0.0001,
      costPer1kOutputTokens: 0.0001,
      tier: 'flash' as const,
    },
  ];

  const capabilityCheck = rankCandidatesForIntent(intent, invalidCandidateSet);

  assert(
    capabilityCheck === undefined,
    'Test 6: Capability filtering still blocks invalid models despite high historical memory score'
  );

  // Test 7: AMM remains final authority
  observabilityService.clearRecords();
  const gatewayRes = await aiGateway.generate({
    task: 'character_bible_cinematic_reasoning',
    prompt: 'AMM authority verification prompt for learning memory',
  });

  const gatewayRecord = observabilityService.getRecords()[0];

  assert(
    gatewayRes.model !== undefined &&
    gatewayRecord.learningScore !== undefined &&
    gatewayRecord.confidenceScore !== undefined &&
    gatewayRecord.optimizationReason !== undefined,
    `Test 7: AMM remains final authority - Gateway completed with model '${gatewayRes.model}', learningScore (${gatewayRecord.learningScore}), and confidence (${gatewayRecord.confidenceScore}%)`
  );

  console.log(`\n=== Verification Complete: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runPhase53bTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
