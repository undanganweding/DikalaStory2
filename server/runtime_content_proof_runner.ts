import { runStage4NarrativeStructure } from './stages/stage4_narrative_structure';
import { runStage5SceneBreakdownAttempt } from './stages/stage5_scene_breakdown';
import { QUALITY_FIXTURES } from './test_narrative_quality_proof';
import { ProjectFoundation } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runFullLiveRuntimeProof() {
  console.log('=== STARTING LIVE RUNTIME CONTENT PROOF FOR 6 CROSS-GENRE FIXTURES ===\n');

  const results: any[] = [];

  for (let i = 0; i < QUALITY_FIXTURES.length; i++) {
    const fixture = QUALITY_FIXTURES[i];
    console.log(`\n================================================================================`);
    console.log(`[${i + 1}/6] RUNNING PIPELINE: ${fixture.id} — ${fixture.name}`);
    console.log(`================================================================================`);

    const foundation: Partial<ProjectFoundation> = {
      genre: fixture.genre,
      era: fixture.era,
      theme: fixture.theme,
      main_conflict: fixture.main_conflict,
      emotional_arc: fixture.emotional_arc,
      visual_tone: fixture.visual_tone,
      main_characters: fixture.characters.map((c) => c.name),
      is_historical_religious_biography: fixture.id === 'TEST_A_HISTORICAL',
    };

    console.log(`>> Invoking Stage 4 (Narrative Structure)...`);
    const stage4Start = Date.now();
    const narrativeBeats = await runStage4NarrativeStructure({
      rawScript: fixture.rawScript,
      foundation: foundation as any,
      characters: fixture.characters,
      locations: fixture.locations,
      contextPackage: null,
      language: 'id',
    });
    const stage4DurationMs = Date.now() - stage4Start;

    console.log(`>> Stage 4 Complete (${stage4DurationMs}ms). Arc: ${narrativeBeats.dramatic_arc_type}, Ending Strategy: ${narrativeBeats.narrative_strategy?.ending_strategy}`);

    // Wait 2.5 seconds to respect Gemini API rate limits
    await delay(2500);

    console.log(`>> Invoking Stage 5 (Scene Breakdown - Target: ${fixture.targetDurationSec}s)...`);
    const stage5Start = Date.now();
    const scenes = await runStage5SceneBreakdownAttempt({
      narrativeBeats,
      totalDurationTargetSec: fixture.targetDurationSec,
      maxSceneDurationSec: 30,
      fixedSceneDurationSec: null,
      targetSceneCount: narrativeBeats.narrative_strategy?.pacing?.recommended_scene_count,
      contextPackage: null,
      language: 'id',
    });
    const stage5DurationMs = Date.now() - stage5Start;
    const totalSceneDuration = scenes.reduce((sum, s) => sum + s.duration_sec, 0);

    console.log(`>> Stage 5 Complete (${stage5DurationMs}ms). Scenes generated: ${scenes.length}, Total Duration: ${totalSceneDuration}s (Target: ${fixture.targetDurationSec}s)`);

    results.push({
      fixtureId: fixture.id,
      name: fixture.name,
      genre: fixture.genre,
      era: fixture.era,
      targetDurationSec: fixture.targetDurationSec,
      totalDurationCalculated: totalSceneDuration,
      narrativeBeats,
      scenes,
      telemetry: {
        stage4DurationMs,
        stage5DurationMs,
      },
    });

    // Write incrementally after each fixture so progress is never lost
    const outputPath = path.join(process.cwd(), 'server', 'runtime_content_proof_output.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`>> Incremental result saved for [${fixture.id}] to ${outputPath}`);

    if (i < QUALITY_FIXTURES.length - 1) {
      console.log(`Waiting 5 seconds before next fixture...`);
      await delay(5000);
    }
  }

  const outputPath = path.join(process.cwd(), 'server', 'runtime_content_proof_output.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n=== ALL COMPLETED. SAVED TO ${outputPath} ===\n`);
  return results;
}

if (process.argv[1]?.endsWith('runtime_content_proof_runner.ts')) {
  runFullLiveRuntimeProof()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Runtime Proof Failed:', err);
      process.exit(1);
    });
}
