import { validateSceneSemanticPayload, DetectedScene } from './stages/stage5_scene_breakdown';

async function runSemanticTests() {
  console.log('==================================================');
  console.log('🧪 S5 SEMANTIC CONTRACT & RETRY VALIDATION SUITE');
  console.log('==================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, label: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${label}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${label}`);
      throw new Error(`Assertion failed: ${label}`);
    }
  }

  // Test 1: Valid payload
  const validScenes: DetectedScene[] = [
    {
      scene_number: 1,
      title: 'INT. COFFEE SHOP - DAY',
      event: 'Character enters and orders coffee.',
      story_purpose: 'Establishing shot',
      duration_sec: 10,
      audio_ambience: 'Coffee grinder',
      dialogue_summary: 'Hello',
      character_names: ['Alice'],
      location_name: 'Coffee Shop',
      shot_count: 1
    } as any
  ];
  const res1 = validateSceneSemanticPayload(validScenes, 'en');
  assert(res1.valid === true, 'Valid scene payload passes semantic validation');

  // Test 2: Continuation marker in title
  const invalidTitleScenes: DetectedScene[] = [
    {
      ...validScenes[0],
      title: 'INT. COFFEE SHOP - DAY (Continuation)'
    }
  ];
  const res2 = validateSceneSemanticPayload(invalidTitleScenes, 'en');
  assert(res2.valid === false, 'Title with (Continuation) is rejected');
  assert(Boolean(res2.correctivePrompt && res2.correctivePrompt.includes('Continuation')), 'Corrective prompt generated for continuation title');

  // Test 3: Empty or dash event
  const invalidEventScenes: DetectedScene[] = [
    {
      ...validScenes[0],
      event: '-'
    }
  ];
  const res3 = validateSceneSemanticPayload(invalidEventScenes, 'en');
  assert(res3.valid === false, 'Event with "-" is rejected');
  assert(Boolean(res3.correctivePrompt && res3.correctivePrompt.includes('event')), 'Corrective prompt generated for empty/dash event');

  console.log(`\nResults: ${passed}/${total} semantic contract tests passed.`);
  console.log('==================================================');
}

runSemanticTests().catch(err => {
  console.error('Semantic Test Error:', err);
  process.exit(1);
});
