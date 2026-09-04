import {
  runStage5SceneBreakdownAttempt,
  validateSceneDurations,
  allocateAndNormalizeSceneDurations,
  ensureSufficientSceneCount,
  DetectedScene,
} from './stages/stage5_scene_breakdown';

async function runAllTests() {
  console.log('===============================================================');
  console.log('🧪 S5 SCENE BREAKDOWN DURATION CONTRACT TEST SUITE');
  console.log('===============================================================\n');

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

  const sampleScenes: DetectedScene[] = [
    {
      scene_number: 1,
      title: 'Dermaga Batavia - Awal Ekspedisi',
      duration_sec: 15,
      story_purpose: 'Arya memperlihatkan peta kuno kepada Willem',
      location_name: 'Dermaga Batavia',
      time_of_day: 'DAWN',
      character_names: ['Arya', 'Willem'],
      emotional_objective: 'Meyakinkan Willem tentang rute misterius',
      event: 'Perdebatan sengit tentang koordinat ekspedisi',
      narrative_function: 'EXPOSITION',
    },
    {
      scene_number: 2,
      title: 'Badai Laut Jawa - Ujian Pertama',
      duration_sec: 15,
      story_purpose: 'Kapal diterjang ombak raksasa di tengah malam',
      location_name: 'Geladak Kapal Batavia',
      time_of_day: 'NIGHT',
      character_names: ['Arya', 'Willem'],
      emotional_objective: 'Mempertahankan kemudi dalam bahaya maut',
      event: 'Tiang layar patah dan kru panik',
      narrative_function: 'CLIMAX',
    },
  ];

  // TEST 1: Unit allocation test for 60s
  console.log('👉 [TEST 1] Deterministic allocation for 60s narrative target');
  const alloc60 = allocateAndNormalizeSceneDurations(sampleScenes, 60, 30, null, false, 'id');
  const sum60 = alloc60.reduce((acc, s) => acc + s.duration_sec, 0);
  console.log(`   Allocated 60s scenes (${alloc60.length}):`, alloc60.map(s => `${s.title}: ${s.duration_sec}s`));
  assert(sum60 === 60, `Sum of 60s allocation must equal 60 (got ${sum60})`);
  assert(alloc60.every(s => s.duration_sec <= 30 && s.duration_sec >= 5), 'All scenes <= 30s and >= 5s');
  assert(validateSceneDurations(alloc60, 60, 30).valid, 'validateSceneDurations must be valid for 60s');

  // TEST 2: Unit allocation test for 90s
  console.log('\n👉 [TEST 2] Deterministic allocation for 90s narrative target');
  const alloc90 = allocateAndNormalizeSceneDurations(sampleScenes, 90, 30, null, false, 'id');
  const sum90 = alloc90.reduce((acc, s) => acc + s.duration_sec, 0);
  console.log(`   Allocated 90s scenes (${alloc90.length}):`, alloc90.map(s => `${s.title}: ${s.duration_sec}s`));
  assert(sum90 === 90, `Sum of 90s allocation must equal 90 (got ${sum90})`);
  assert(alloc90.length >= 3, `Need at least 3 scenes for 90s with max 30s ceiling (got ${alloc90.length})`);
  assert(alloc90.every(s => s.duration_sec <= 30 && s.duration_sec >= 5), 'All scenes <= 30s and >= 5s');
  assert(validateSceneDurations(alloc90, 90, 30).valid, 'validateSceneDurations must be valid for 90s');

  // TEST 3: Unit allocation test for 120s
  console.log('\n👉 [TEST 3] Deterministic allocation for 120s narrative target');
  const alloc120 = allocateAndNormalizeSceneDurations(sampleScenes, 120, 30, null, false, 'id');
  const sum120 = alloc120.reduce((acc, s) => acc + s.duration_sec, 0);
  console.log(`   Allocated 120s scenes (${alloc120.length}):`, alloc120.map(s => `${s.title}: ${s.duration_sec}s`));
  assert(sum120 === 120, `Sum of 120s allocation must equal 120 (got ${sum120})`);
  assert(alloc120.length >= 4, `Need at least 4 scenes for 120s with max 30s ceiling (got ${alloc120.length})`);
  assert(alloc120.every(s => s.duration_sec <= 30 && s.duration_sec >= 5), 'All scenes <= 30s and >= 5s');
  assert(validateSceneDurations(alloc120, 120, 30).valid, 'validateSceneDurations must be valid for 120s');

  // TEST 4: Unit allocation test for 180s
  console.log('\n👉 [TEST 4] Deterministic allocation for 180s narrative target');
  const alloc180 = allocateAndNormalizeSceneDurations(sampleScenes, 180, 30, null, false, 'id');
  const sum180 = alloc180.reduce((acc, s) => acc + s.duration_sec, 0);
  console.log(`   Allocated 180s scenes (${alloc180.length}):`, alloc180.map(s => `${s.title}: ${s.duration_sec}s`));
  assert(sum180 === 180, `Sum of 180s allocation must equal 180 (got ${sum180})`);
  assert(alloc180.length >= 6, `Need at least 6 scenes for 180s with max 30s ceiling (got ${alloc180.length})`);
  assert(alloc180.every(s => s.duration_sec <= 30 && s.duration_sec >= 5), 'All scenes <= 30s and >= 5s');
  assert(validateSceneDurations(alloc180, 180, 30).valid, 'validateSceneDurations must be valid for 180s');

  // TEST 5: Verify distinction between Platform Container (30s) and Narrative Target (120s)
  console.log('\n👉 [TEST 5] Architectural distinction between Platform Container & Narrative Target');
  const platformContainerLimit: number = 30;
  const projectNarrativeTarget: number = 120;
  assert(platformContainerLimit !== projectNarrativeTarget, 'Container limit and narrative duration are strictly distinct');
  assert(sum120 === projectNarrativeTarget, 'Total project narrative duration is preserved across all scenes');
  assert(alloc120.every(s => s.duration_sec <= platformContainerLimit), 'Every individual scene respects container ceiling');

  // TEST 6: Fixed Scene Duration mode validation (e.g. 15s fixed across 60s project)
  console.log('\n👉 [TEST 6] Fixed scene duration mode (60s total / 15s fixed = 4 scenes)');
  const allocFixed = allocateAndNormalizeSceneDurations(sampleScenes, 60, 15, 15, false, 'id');
  const sumFixed = allocFixed.reduce((acc, s) => acc + s.duration_sec, 0);
  console.log(`   Fixed scenes (${allocFixed.length}):`, allocFixed.map(s => `${s.title}: ${s.duration_sec}s`));
  assert(sumFixed === 60, `Fixed duration scenes sum to 60 (got ${sumFixed})`);
  assert(allocFixed.length === 4, `Expected exactly 4 scenes (got ${allocFixed.length})`);
  assert(allocFixed.every(s => s.duration_sec === 15), 'All scenes have exactly 15s');

  // TEST 7: End-to-end Task Router execution for 120s target
  console.log('\n👉 [TEST 7] Live runStage5SceneBreakdownAttempt via Task Router (120s target)');
  const live120 = await runStage5SceneBreakdownAttempt({
    narrativeBeats: {
      beginning: 'Arya menemukan kronometer kuno di dermaga Batavia',
      development: 'Willem meragukan keaslian peta namun dipaksa oleh ancaman bajak laut',
      climax: 'Konfrontasi bersenjata di Selat Sunda saat badai menerjang',
      consequence: 'Kru kapal memilih setia pada panduan Arya daripada kompas lama',
      ending: 'Kapal berlayar menuju ufuk fajar menyongsong pulau tak bertuan',
    },
    totalDurationTargetSec: 120,
    maxSceneDurationSec: 30,
    language: 'id',
    characterRoster: ['Arya', 'Willem'],
    locationRoster: ['Dermaga Batavia', 'Selat Sunda'],
  });
  const liveSum120 = live120.reduce((acc, s) => acc + s.duration_sec, 0);
  console.log(`   Live S5 Scenes (${live120.length}):`, live120.map(s => `#${s.scene_number} ${s.title} (${s.duration_sec}s)`));
  assert(liveSum120 === 120, `Live S5 sum must equal 120 (got ${liveSum120})`);
  assert(live120.every(s => s.duration_sec <= 30), 'Live S5 scenes all <= 30s');
  const liveVal120 = validateSceneDurations(live120, 120, 30);
  assert(liveVal120.valid, 'Live S5 validation passes exact 120s contract');

  // TEST 8: Retry behavior with corrective feedback
  console.log('\n👉 [TEST 8] Retry execution with corrective context');
  const liveRetry = await runStage5SceneBreakdownAttempt({
    narrativeBeats: {
      beginning: 'A', development: 'B', climax: 'C', consequence: 'D', ending: 'E'
    },
    totalDurationTargetSec: 120,
    maxSceneDurationSec: 30,
    language: 'id',
    feedbackPrompt: 'Pastikan jumlah sum(scene.duration_sec) TEPAT 120 detik. Sebelumnya total durasi hanya 30 detik.',
  });
  const retrySum = liveRetry.reduce((acc, s) => acc + s.duration_sec, 0);
  assert(retrySum === 120, `Retry S5 sum must equal 120 (got ${retrySum})`);
  assert(validateSceneDurations(liveRetry, 120, 30).valid, 'Retry validation is valid');

  console.log('\n===============================================================');
  console.log(`🎉 ALL ${passed}/${total} S5 DURATION CONTRACT TESTS PASSED!`);
  console.log('===============================================================\n');
}

runAllTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
