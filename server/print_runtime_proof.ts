import * as fs from 'fs';
import * as path from 'path';

const outputPath = path.join(process.cwd(), 'server', 'runtime_content_proof_output.json');

if (!fs.existsSync(outputPath)) {
  console.error('Output file not found at:', outputPath);
  process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
console.log(`Loaded ${rawData.length} runtime fixtures.\n`);

for (let i = 0; i < rawData.length; i++) {
  const item = rawData[i];
  console.log(`================================================================================`);
  console.log(`FIXTURE #${i + 1}: [${item.fixtureId}] ${item.name}`);
  console.log(`  Genre: ${item.genre}`);
  console.log(`  Era: ${item.era}`);
  console.log(`  Archetype (Arc): ${item.narrativeBeats?.dramatic_arc_type || item.narrativeBeats?.narrative_strategy?.dramatic_arc_type}`);
  console.log(`  Ending Strategy: ${item.narrativeBeats?.narrative_strategy?.ending_strategy}`);
  console.log(`  Pacing Curve: ${item.narrativeBeats?.narrative_strategy?.pacing?.pacing_curve}`);
  console.log(`  Target Duration: ${item.targetDurationSec}s | Actual Duration Sum: ${item.totalDurationCalculated}s (${item.scenes?.length} scenes)`);
  console.log(`\n  ACTUAL SCENES BREAKDOWN:`);
  
  for (const s of (item.scenes || [])) {
    console.log(`  ------------------------------------------------------------------------------`);
    console.log(`  Scene #${s.scene_number} [${s.scene_pattern || 'SCENE'}] (${s.duration_sec}s) — "${s.title}"`);
    console.log(`    Location: ${s.location_name} | Time: ${s.time_of_day}`);
    console.log(`    Story Purpose: ${s.story_purpose}`);
    console.log(`    Emotional Objective: ${s.emotional_objective}`);
    console.log(`    Visual Action: ${s.visual_action}`);
    if (s.dialogue && s.dialogue.length > 0) {
      for (const d of s.dialogue) {
        console.log(`    Dialogue: [${d.character_name}] "${d.line}"`);
        console.log(`      Subtext: ${d.emotional_subtext} | Delivery: ${d.delivery}`);
      }
    } else {
      console.log(`    Dialogue: (NONE - PURE VISUAL ACTION)`);
    }
    if (s.narrator_vo) {
      console.log(`    Narrator VO: "${s.narrator_vo}"`);
    } else {
      console.log(`    Narrator VO: (NONE - DRAMATIC ACTION)`);
    }
    console.log(`    SFX: ${JSON.stringify(s.sound_design?.sfx || [])}`);
    console.log(`    BGM Mood: ${s.sound_design?.bgm_mood || 'N/A'}`);
    if (s.historical_integrity) {
      console.log(`    Historical Tier: ${s.historical_integrity.tier} (${s.historical_integrity.basis})`);
    }
    if (s.prophet_depiction_safeguard?.is_prophet_present) {
      console.log(`    Prophet Safeguard: ACTIVE -> ${s.prophet_depiction_safeguard.visual_rule}`);
    }
  }
}
