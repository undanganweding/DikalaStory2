import { decisionIntelligenceEngine } from './decision_intelligence';
import { rankCandidatesForIntent, classifyTaskRequirements } from './intelligence_router';
import { observabilityService } from './observability_service';
import { aiGateway } from './ai_gateway';

async function runPhase54Tests() {
  console.log('=== Phase 5.4 Decision Feedback Loop & Calibration Verification ===\n');

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

  // Cleanup store before tests
  decisionIntelligenceEngine.clearCalibrationStore();
  observabilityService.clearRecords();

  const modelId = 'gemini-2.5-pro';
  const taskClass = 'cinematic_reasoning';

  // Test 1: Successful decision increases reputation
  const initialRecord = decisionIntelligenceEngine.getCalibrationRecord(modelId, taskClass);
  const initialRep = initialRecord.reputationScore;

  const successRecord = decisionIntelligenceEngine.recordDecisionFeedback(modelId, taskClass, true, 80);
  assert(
    successRecord.reputationScore > initialRep,
    `Test 1: Successful decision increases reputation score from ${initialRep} to ${successRecord.reputationScore}`
  );

  // Test 2: Failed high-confidence decision gets penalty
  const prePenaltyRep = successRecord.reputationScore;
  const failureRecord = decisionIntelligenceEngine.recordDecisionFeedback(modelId, taskClass, false, 90);
  assert(
    failureRecord.reputationScore < prePenaltyRep - 15,
    `Test 2: Failed high-confidence decision gets severe penalty (from ${prePenaltyRep} to ${failureRecord.reputationScore})`
  );

  // Test 3: Decision accuracy separated by taskClass
  const otherTaskClass = 'code_generation';
  const otherRecord = decisionIntelligenceEngine.getCalibrationRecord(modelId, otherTaskClass);
  assert(
    otherRecord.reputationScore !== failureRecord.reputationScore,
    `Test 3: Decision accuracy is strictly separated by taskClass (${taskClass}: ${failureRecord.reputationScore} vs ${otherTaskClass}: ${otherRecord.reputationScore})`
  );

  // Test 4: Router prefers historically accurate model
  decisionIntelligenceEngine.clearCalibrationStore();
  const mockCandidates = [
    {
      id: 'model-accurate',
      name: 'Model Accurate',
      providerId: 'google',
      supportedCapabilities: ['text', 'reasoning'],
      tier: 'pro' as const,
    },
    {
      id: 'model-inaccurate',
      name: 'Model Inaccurate',
      providerId: 'google',
      supportedCapabilities: ['text', 'reasoning'],
      tier: 'pro' as const,
    },
  ];

  // Boost model-accurate reputation, penalize model-inaccurate
  decisionIntelligenceEngine.recordDecisionFeedback('model-accurate', 'cinematic_reasoning', true, 90);
  decisionIntelligenceEngine.recordDecisionFeedback('model-accurate', 'cinematic_reasoning', true, 90);

  decisionIntelligenceEngine.recordDecisionFeedback('model-inaccurate', 'cinematic_reasoning', false, 80);
  decisionIntelligenceEngine.recordDecisionFeedback('model-inaccurate', 'cinematic_reasoning', false, 80);

  const intent = classifyTaskRequirements('character_bible_cinematic_reasoning');
  const ranked = rankCandidatesForIntent(intent, mockCandidates);

  assert(
    ranked !== undefined && ranked.modelId === 'model-accurate',
    `Test 4: Router prefers historically accurate model (selected '${ranked?.modelId}')`
  );

  // Test 5: Drift detection works
  decisionIntelligenceEngine.clearCalibrationStore();
  decisionIntelligenceEngine.recordDecisionFeedback('model-drift', 'cinematic_reasoning', false, 80);
  decisionIntelligenceEngine.recordDecisionFeedback('model-drift', 'cinematic_reasoning', false, 80);
  const driftRecord = decisionIntelligenceEngine.recordDecisionFeedback('model-drift', 'cinematic_reasoning', false, 80);

  assert(
    driftRecord.driftDetected === true,
    `Test 5: Drift detection works (driftDetected: ${driftRecord.driftDetected} due to high failure rate)`
  );

  // Test 6: Telemetry records feedback
  observabilityService.clearRecords();
  decisionIntelligenceEngine.recordDecisionFeedback('gemini-2.5-pro', 'cinematic_reasoning', true, 85);
  const telemetryRecords = observabilityService.getRecords();
  const feedbackRecord = telemetryRecords.find(r => r.agentName === 'DecisionCalibrationEngine');

  assert(
    feedbackRecord !== undefined &&
    feedbackRecord.decisionConfidence === 85 &&
    feedbackRecord.decisionExplanation?.includes('Feedback recorded'),
    `Test 6: Telemetry records feedback accurately (found ${feedbackRecord?.agentName})`
  );

  // Test 7: AMM authority preserved
  observabilityService.clearRecords();
  const gatewayRes = await aiGateway.generate({
    task: 'character_bible_cinematic_reasoning',
    prompt: 'Verify AMM authority preservation',
  });

  assert(
    gatewayRes.model !== undefined && gatewayRes.providerId !== undefined,
    `Test 7: AMM authority preserved during generation execution (Model: '${gatewayRes.model}', Provider: '${gatewayRes.providerId}')`
  );

  console.log(`\n=== Verification Complete: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runPhase54Tests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
