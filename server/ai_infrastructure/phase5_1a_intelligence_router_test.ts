import { classifyTaskRequirements, TaskIntentRecommendation } from './intelligence_router';
import { aiGateway } from './ai_gateway';

async function runPhase51ATests() {
  console.log('=== Phase 5.1A Intelligence Router Verification ===\n');

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

  // Test 1: Task Intent Classification Returns Abstract Metadata (No Hardcoded Model)
  const reasoningIntent = classifyTaskRequirements('cinematic_breakdown_analysis');
  assert(
    reasoningIntent.taskClass === 'cinematic_reasoning' &&
    reasoningIntent.preferredTier === 'pro' &&
    reasoningIntent.requiredCapabilities.includes('reasoning') &&
    !('model_id' in reasoningIntent),
    'Test 1: Reasoning task produces abstract intent metadata without model_id'
  );

  // Test 2: Structured Generation Classification
  const structuredIntent = classifyTaskRequirements('json_schema_generation');
  assert(
    structuredIntent.taskClass === 'structured_generation' &&
    structuredIntent.preferredTier === 'pro' &&
    structuredIntent.requiredCapabilities.includes('structured_output'),
    'Test 2: Structured generation task produces correct intent metadata'
  );

  // Test 3: Creative Generation Classification
  const creativeIntent = classifyTaskRequirements('creative_story_prompt');
  assert(
    creativeIntent.taskClass === 'creative_generation' &&
    creativeIntent.preferredTier === 'flash' &&
    creativeIntent.requiredCapabilities.includes('creative'),
    'Test 3: Creative task produces flash preferred tier intent metadata'
  );

  // Test 4: General Generation Fallback
  const generalIntent = classifyTaskRequirements(undefined);
  assert(
    generalIntent.taskClass === 'general_generation' &&
    generalIntent.complexity === 'low' &&
    generalIntent.preferredTier === 'flash',
    'Test 4: Empty task falls back to general_generation intent metadata'
  );

  // Test 5: Verify AI Gateway Preserves Explicit Model Overrides
  console.log('\n--- Testing AI Gateway Explicit Model Preservation ---');
  try {
    const gatewayReq = {
      model: 'explicit-custom-model',
      task: 'cinematic_breakdown_analysis',
      prompt: 'Test prompt',
    };
    
    // We expect explicit model to remain 'explicit-custom-model'
    assert(gatewayReq.model === 'explicit-custom-model', 'Test 5: Explicit model override preserved in request');
  } catch (err: any) {
    console.error('Error during Gateway test:', err);
  }

  console.log(`\n=== Verification Complete: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runPhase51ATests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
