import { costIntelligenceService } from './cost_intelligence';
import { costMonitor } from './cost_monitor';
import { aiGateway } from './ai_gateway';
import { observabilityService } from './observability_service';
import { usageService } from './usage_service';

async function runPhase52Tests() {
  console.log('=== Phase 5.2 Pre-Execution Cost Intelligence Verification ===\n');

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

  // Test 1: Pre-execution Cost Estimation calculation
  const prompt = 'Analyze cinematic structure for scene 1 with character details';
  const estimateFlash = costIntelligenceService.estimateRequestCost(prompt, undefined, 'gemini-2.5-flash', 'medium');
  const estimatePro = costIntelligenceService.estimateRequestCost(prompt, undefined, 'gemini-2.5-pro', 'medium');

  assert(
    estimateFlash.estimatedInputTokens > 0 &&
    estimateFlash.estimatedOutputTokens > 0 &&
    estimateFlash.estimatedCostUSD > 0,
    `Test 1: Cost estimation returns non-zero pre-execution tokens and USD (Flash est: $${estimateFlash.estimatedCostUSD})`
  );

  // Test 2: Different model pricing produces different cost estimates
  assert(
    estimatePro.estimatedCostUSD > estimateFlash.estimatedCostUSD,
    `Test 2: Higher tier model produces higher pre-execution cost estimate (Pro: $${estimatePro.estimatedCostUSD} > Flash: $${estimateFlash.estimatedCostUSD})`
  );

  // Test 3: Budget State Evaluation (NORMAL, WARNING, CONSTRAINED, LOCKED)
  costMonitor.setGlobalBudgetCap(1.0);
  usageService.clearUsage();

  let initialState = costMonitor.getBudgetState();
  assert(initialState.state === 'NORMAL', `Test 3a: Initial budget state is NORMAL (0% consumed)`);

  usageService.recordUsage({
    providerId: 'google',
    credentialId: 'cred_1',
    modelId: 'gpt-4o',
    model: 'gpt-4o',
    inputTokens: 350000,
    outputTokens: 45000,
    latencyMs: 100,
    success: true,
  });

  let warningState = costMonitor.getBudgetState();
  assert(
    warningState.state === 'WARNING' && warningState.consumedPercentage >= 70,
    `Test 3b: Budget state transitions to WARNING (${warningState.consumedPercentage}% consumed)`
  );

  usageService.recordUsage({
    providerId: 'google',
    credentialId: 'cred_1',
    modelId: 'gpt-4o',
    model: 'gpt-4o',
    inputTokens: 50000,
    outputTokens: 10000,
    latencyMs: 100,
    success: true,
  });

  let constrainedState = costMonitor.getBudgetState();
  assert(
    constrainedState.state === 'CONSTRAINED' && constrainedState.consumedPercentage >= 85,
    `Test 3c: Budget state transitions to CONSTRAINED (${constrainedState.consumedPercentage}% consumed)`
  );

  // Test 4: Adaptation under CONSTRAINED budget state adapts hint to flash tier
  observabilityService.clearRecords();
  await aiGateway.generate({
    task: 'character_bible_cinematic_reasoning',
    prompt: 'Budget constrained task test',
  });

  const records = observabilityService.getRecords();
  const lastRecord = records[records.length - 1];

  assert(
    lastRecord.budgetState === 'CONSTRAINED' &&
    lastRecord.downgradeReason !== undefined &&
    lastRecord.estimatedCostUSD !== undefined,
    'Test 4: Gateway logs budgetState, downgradeReason, and estimatedCostUSD during CONSTRAINED state'
  );

  // Test 5: Explicit model override is preserved even under CONSTRAINED / LOCKED budget state
  observabilityService.clearRecords();
  const overrideRes = await aiGateway.generate({
    model: 'gemini-2.5-pro',
    task: 'character_bible_cinematic_reasoning',
    prompt: 'Explicit model override test under constrained budget',
  });

  const overrideRecord = observabilityService.getRecords()[0];

  assert(
    overrideRes.model === 'gemini-2.5-pro' &&
    overrideRecord.routingSource === 'explicit_override' &&
    overrideRecord.downgradeReason === undefined,
    'Test 5: Explicit model override preserved without forced downgrade under budget constraints'
  );

  costMonitor.setGlobalBudgetCap(50.0);
  usageService.clearUsage();

  console.log(`\n=== Verification Complete: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runPhase52Tests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
