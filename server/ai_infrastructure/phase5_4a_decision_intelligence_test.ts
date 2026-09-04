import { modelsRegistry } from './capability_registry';
import { classifyTaskRequirements, rankCandidatesForIntent } from './intelligence_router';
import { decisionIntelligenceEngine } from './decision_intelligence';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

async function runPhase54aTests() {
  console.log('=== Phase 5.4A Decision Intelligence Verification ===');
  decisionIntelligenceEngine.clearCalibrationStore();

  const intent = classifyTaskRequirements('Analyze cinematic continuity and produce structured scene reasoning.');
  const ranked = rankCandidatesForIntent(intent, modelsRegistry);
  assert(ranked, 'Expected router to return a ranked candidate');
  assert(ranked!.decisionExplanation, 'Expected decision explanation to be attached');

  const explanation = ranked!.decisionExplanation!;
  assert(explanation.selectedModel === ranked!.modelId, 'Explanation selected model must match router winner');
  assert(explanation.confidence >= 1 && explanation.confidence <= 100, 'Confidence must be 1..100');
  assert(explanation.factors.length === 4, 'Expected 4 explainability factors');

  const weights = new Map(explanation.factors.map(f => [f.factor, f.weight]));
  assert(weights.get('Intent Match') === 40, 'Intent Match must carry 40% weight');
  assert(weights.get('Historical Memory') === 30, 'Historical Memory must carry 30% weight');
  assert(weights.get('Decision Calibration Accuracy') === 20, 'Calibration must carry 20% weight');
  assert(weights.get('Current Telemetry') === 10, 'Telemetry must carry 10% weight');

  assert(
    explanation.rejectedCandidates.every(r => r.modelId !== explanation.selectedModel),
    'Rejected candidates must not include selected model'
  );

  console.log(`[PASS] Explainable decision selected '${explanation.selectedModel}' with ${explanation.confidence}% confidence`);
  console.log('[PASS] Factor weights preserve router scoring: 40/30/20/10');
  console.log('[PASS] Rejected candidate reasoning is separated from selected candidate');
  console.log('\n=== Verification Complete: 3 Passed, 0 Failed ===');
}

runPhase54aTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
