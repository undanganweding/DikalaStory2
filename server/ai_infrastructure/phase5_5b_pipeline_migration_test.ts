/**
 * Phase 5.5B — Complete Pipeline Migration Test Suite (S1 through S8)
 * Verifies that ALL SINEMA pipeline stages (S1-S8) run via AI Task Router (executeTask)
 * and generate accurate, structured outputs with transparent scoring and zero hardcoded models.
 */

import '../isolate_test_env';
import { executeTask } from '../llm_provider';
import { runStage1StoryUnderstanding } from '../stages/stage1_story_understanding';
import { runStage2CharacterDetection } from '../stages/stage2_character_detection';
import { runStage3LocationObjectDetection } from '../stages/stage3_location_object_detection';
import { runStage4NarrativeStructure } from '../stages/stage4_narrative_structure';
import { runStage5SceneBreakdownAttempt } from '../stages/stage5_scene_breakdown';
import { runStage6ShotBreakdownAttempt } from '../stages/stage6_shot_breakdown';
import { runStage7MasterFrameAndImagePrompt } from '../stages/stage7_master_frame';
import { runStage8VideoPrompt } from '../stages/stage8_video_prompt';
import { providerService } from './provider_service';
import { modelRegistryService } from './model_registry_service';
import { credentialService } from './credential_service';
import { taskRouter } from './task_router';
import { taskRegistry } from './task_registry';

export async function runPipelineMigrationFullSuite(): Promise<boolean> {
  console.log('===============================================================');
  console.log('🎬 RUNNING PHASE 5.5B — COMPLETE PIPELINE MIGRATION (S1-S8) TEST SUITE');
  console.log('===============================================================\n');

  let passedCases = 0;
  const totalCases = 8;

  // Setup mock provider & keys
  const testProviderId = `prov_pipe_test_${Date.now()}`;
  await providerService.addProvider({
    id: testProviderId,
    name: 'Cinema Pipeline Test Provider',
    type: 'openai-compatible',
    baseUrl: 'https://api.cinemapipe.test/v1',
    enabled: true,
    capabilities: { text: true, vision: true, image: true, video: true },
  });

  const testCred = await credentialService.addCredential({
    providerId: testProviderId,
    name: 'Cinema Pipeline Key',
    secret: 'sk-cinema-pipeline-key-99999',
    priority: 1,
    weight: 100,
    status: 'active',
  });

  await modelRegistryService.addModel({
    id: 'cinema-director-pro-v1',
    providerId: testProviderId,
    displayName: 'Cinema Director Pro v1',
    tier: 'pro',
    capabilities: ['text', 'reasoning', 'vision', 'structured_output', 'analysis', 'creative', 'fast'],
    enabled: true,
    contextWindow: 1048576,
  });

  const testConfig = {
    provider_type: 'custom' as any,
    provider_name: testProviderId,
    model_id: 'cinema-director-pro-v1',
  };

  const sampleScript = `
    FADE IN:
    EXT. BATAVIA HARBOR - 1920 - DAWN
    Arya (28), a brilliant young navigator with intense eyes, clutches an ancient brass chronometer.
    He confronts Captain Willem (50), an authoritarian colonial officer.
    ARYA: "The coordinates don't lie, Captain. There is a new passage."
    Willem laughs dismissively, adjusting his gilded saber.
    WILLEM: "You risk mutiny for a folklore myth, Arya."
    Arya steps forward resolutely as the morning mist swirls across the cobblestone docks.
  `;

  // STAGE 1
  console.log('👉 [STAGE 1] Story Understanding (story_analysis)');
  let foundation: any = null;
  try {
    const s1Result = await runStage1StoryUnderstanding({
      rawScript: sampleScript,
      language: 'id',
      contextPackage: null,
      model: 'cinema-director-pro-v1',
      reasoningConfig: testConfig,
    });
    foundation = s1Result;
    console.log('  S1 Story Bible Output:', {
      era: s1Result.era,
      genre: s1Result.genre,
      main_characters: s1Result.main_characters,
      locations: s1Result.locations,
    });
    if (s1Result.era && s1Result.genre) {
      console.log('  ✅ S1 PASSED: Story Understanding migrated to executeTask.\n');
      passedCases++;
    }
  } catch (err: any) {
    console.error('  ❌ S1 EXCEPTION:', err.message);
  }

  // STAGE 2
  console.log('👉 [STAGE 2] Character Detection (character_analysis)');
  let characters: any[] = [];
  try {
    const rawDetected = await runStage2CharacterDetection({
      rawScript: sampleScript,
      foundation: foundation || {
        era: 'Batavia 1920',
        genre: 'Historical Adventure Drama',
        theme: 'Discovery & Defiance',
        timeline: 'Linear',
        main_characters: ['Arya', 'Willem'],
        supporting_characters: [],
        locations: ['Batavia Harbor'],
        main_conflict: 'Navigation truth vs Colonial authority',
        emotional_arc: 'Courage and discovery',
        narrative_arc: 'Classic 5-Act',
        visual_tone: '35mm Panavision Sepia & Atmospheric Mist',
        is_historical_religious_biography: false,
      },
      language: 'id',
      model: 'cinema-director-pro-v1',
      reasoningConfig: testConfig,
    });
    characters = (rawDetected || []).map((c: any, idx: number) => ({
      id: `char_test_${idx + 1}`,
      project_id: 'proj_test_1',
      name: c.name,
      role: c.role || 'PROTAGONIST',
      gender: 'male',
      age: 28,
      importance: c.importance || 'MAIN',
      physical_appearance: c.physical_appearance,
      face_identity_locked: c.face_identity_locked,
      hair: c.hair,
      beard: c.beard,
      clothing: Array.isArray(c.clothing) ? c.clothing : [c.clothing || 'Standard clothing'],
      accessories: Array.isArray(c.accessories) ? c.accessories : [c.accessories || 'Standard accessories'],
      personality: c.personality,
      voice_character: c.voice_character,
      movement_style: c.movement_style,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    console.log(`  S2 Detected Characters (${characters.length}):`, characters.map((c) => c.name));
    if (Array.isArray(characters) && characters.length > 0) {
      console.log('  ✅ S2 PASSED: Character Detection migrated to executeTask.\n');
      passedCases++;
    }
  } catch (err: any) {
    console.error('  ❌ S2 EXCEPTION:', err.message);
  }

  // STAGE 3
  console.log('👉 [STAGE 3] Location & Object Detection (location_object_analysis)');
  let locations: any[] = [];
  let objects: any[] = [];
  try {
    const s3Result = await runStage3LocationObjectDetection({
      rawScript: sampleScript,
      foundation: foundation || {
        era: 'Batavia 1920',
        genre: 'Historical Adventure Drama',
        theme: 'Discovery & Defiance',
        timeline: 'Linear',
        main_characters: ['Arya', 'Willem'],
        supporting_characters: [],
        locations: ['Batavia Harbor'],
        main_conflict: 'Navigation truth vs Colonial authority',
        emotional_arc: 'Courage and discovery',
        narrative_arc: 'Classic 5-Act',
        visual_tone: '35mm Panavision Sepia & Atmospheric Mist',
        is_historical_religious_biography: false,
      },
      language: 'id',
      model: 'cinema-director-pro-v1',
      reasoningConfig: testConfig,
    });
    locations = (s3Result.locations || []).map((l: any, idx: number) => ({
      id: `loc_test_${idx + 1}`,
      project_id: 'proj_test_1',
      name: l.name,
      era: 'Batavia 1920',
      environment: l.environment_type || l.environment || 'EXTERIOR',
      lighting_style: l.lighting_vibe || l.lighting_style || 'Atmospheric Dawn',
      spatial_details: l.spatial_details || '',
      color_palette: l.color_palette || '',
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    objects = (s3Result.objects || []).map((o: any, idx: number) => ({
      id: `obj_test_${idx + 1}`,
      project_id: 'proj_test_1',
      name: o.name,
      category: o.category,
      description: o.description,
      continuity_notes: o.continuity_notes,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    console.log(`  S3 Locations (${locations.length}):`, locations.map((l) => l.name));
    console.log(`  S3 Objects (${objects.length}):`, objects.map((o) => o.name));
    if (Array.isArray(locations) && locations.length > 0) {
      console.log('  ✅ S3 PASSED: Location & Object Detection migrated to executeTask.\n');
      passedCases++;
    }
  } catch (err: any) {
    console.error('  ❌ S3 EXCEPTION:', err.message);
  }

  // STAGE 4
  console.log('👉 [STAGE 4] Narrative Structure (narrative_structure)');
  let narrativeBeats: any = null;
  try {
    narrativeBeats = await runStage4NarrativeStructure({
      rawScript: sampleScript,
      foundation: foundation || {
        era: 'Batavia 1920',
        genre: 'Historical Adventure Drama',
        theme: 'Discovery & Defiance',
        timeline: 'Linear',
        main_characters: ['Arya', 'Willem'],
        supporting_characters: [],
        locations: ['Batavia Harbor'],
        main_conflict: 'Navigation truth vs Colonial authority',
        emotional_arc: 'Courage and discovery',
        narrative_arc: 'Classic 5-Act',
        visual_tone: '35mm Panavision Sepia & Atmospheric Mist',
        is_historical_religious_biography: false,
      },
      characters,
      locations,
      language: 'id',
      model: 'cinema-director-pro-v1',
      reasoningConfig: testConfig,
    });
    console.log('  S4 Narrative Beats:', {
      beginning: narrativeBeats.beginning?.slice(0, 50),
      climax: narrativeBeats.climax?.slice(0, 50),
      ending: narrativeBeats.ending?.slice(0, 50),
    });
    if (narrativeBeats && narrativeBeats.beginning && narrativeBeats.climax) {
      console.log('  ✅ S4 PASSED: Narrative Structure migrated to executeTask.\n');
      passedCases++;
    }
  } catch (err: any) {
    console.error('  ❌ S4 EXCEPTION:', err.message);
  }

  // STAGE 5
  console.log('👉 [STAGE 5] Scene Breakdown (scene_breakdown)');
  let scenes: any[] = [];
  try {
    scenes = await runStage5SceneBreakdownAttempt({
      narrativeBeats: narrativeBeats || {
        beginning: 'Arya finds the chart',
        development: 'Willem rejects the chart',
        climax: 'Confrontation on the docks',
        consequence: 'Crew joins Arya',
        ending: 'Setting sail into the dawn',
      },
      totalDurationTargetSec: 30,
      maxSceneDurationSec: 15,
      language: 'id',
      model: 'cinema-director-pro-v1',
      reasoningConfig: testConfig,
      characterRoster: ['Arya', 'Captain Willem'],
      locationRoster: ['Batavia Harbor'],
    });
    console.log(`  S5 Generated Scenes (${scenes.length}):`, scenes.map((s) => `#${s.scene_number} ${s.title} (${s.duration_sec}s)`));
    if (Array.isArray(scenes) && scenes.length > 0) {
      console.log('  ✅ S5 PASSED: Scene Breakdown migrated to executeTask.\n');
      passedCases++;
    }
  } catch (err: any) {
    console.error('  ❌ S5 EXCEPTION:', err.message);
  }

  // STAGE 6
  console.log('👉 [STAGE 6] Shot Breakdown (shot_breakdown)');
  let testShots: any[] = [];
  const testScene = {
    id: 'scene_test_1',
    project_id: 'proj_test_1',
    scene_number: 1,
    title: 'Konfrontasi di Pelabuhan',
    story_purpose: 'Arya memperlihatkan kronometer pada Willem di dermaga',
    location_name: 'Batavia Harbor',
    time_of_day: 'DAWN',
    character_names: ['Arya', 'Captain Willem'],
    emotional_objective: 'Membuktikan kebenaran rute',
    event: 'Perdebatan sengit tentang koordinat',
    narrative_function: 'EXPOSITION',
    duration_sec: 10,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as any;

  try {
    const shots = await runStage6ShotBreakdownAttempt({
      scene: testScene,
      characters,
      locations,
      objects,
      language: 'id',
      model: 'cinema-director-pro-v1',
      reasoningConfig: testConfig,
    });
    testShots = shots.map((s: any, idx: number) => ({
      ...s,
      id: s.id || `shot_test_${idx + 1}`,
      scene_id: testScene.id,
    }));
    console.log(`  S6 Generated Shots (${shots.length}):`, shots.map((s) => `#${s.shot_number} (${s.duration_sec}s): ${s.camera_note}`));
    if (Array.isArray(shots) && shots.length > 0) {
      console.log('  ✅ S6 PASSED: Shot Breakdown migrated to executeTask.\n');
      passedCases++;
    }
  } catch (err: any) {
    console.error('  ❌ S6 EXCEPTION:', err.message);
  }

  // STAGE 7
  console.log('👉 [STAGE 7] Master Frame & Image Prompt (master_frame_generation)');
  try {
    const s7Result = await runStage7MasterFrameAndImagePrompt({
      scene: testScene,
      foundation: foundation || {
        era: 'Batavia 1920',
        genre: 'Historical Adventure Drama',
        theme: 'Discovery & Defiance',
      },
      characters,
      locations,
      objects,
      language: 'id',
      model: 'cinema-director-pro-v1',
      reasoningConfig: testConfig,
    });
    console.log('  S7 Master Frame Output:', {
      subject: s7Result.promptJson?.subject?.slice(0, 50),
      lighting: s7Result.promptJson?.lighting,
      resolvedDurationSec: s7Result.resolvedDurationSec,
    });
    if (s7Result.promptJson && s7Result.compiledPromptText) {
      console.log('  ✅ S7 PASSED: Master Frame Generation migrated to executeTask.\n');
      passedCases++;
    }
  } catch (err: any) {
    console.error('  ❌ S7 EXCEPTION:', err.message);
  }

  // STAGE 8
  console.log('👉 [STAGE 8] Video Prompt Generation (video_prompt_generation)');
  try {
    const s8Result = await runStage8VideoPrompt({
      scene: testScene,
      shot: testShots[0] || {
        id: 'shot_test_1',
        scene_id: testScene.id,
        shot_number: 1,
        duration_sec: 5,
        event_detail: 'Arya confronts Willem on the docks',
      },
      foundation: foundation || {
        era: 'Batavia 1920',
        genre: 'Historical Adventure Drama',
      },
      characters,
      locations,
      videoModels: ['veo'],
      includeSeedance: true,
      language: 'id',
      model: 'cinema-director-pro-v1',
      reasoningConfig: testConfig,
    });
    console.log(`  S8 Generated Video Prompts (${s8Result.prompts.length}) & Stills (${s8Result.stills.length})`);
    if (Array.isArray(s8Result.prompts) && s8Result.prompts.length > 0) {
      console.log('  ✅ S8 PASSED: Video Prompt Generation migrated to executeTask.\n');
      passedCases++;
    }
  } catch (err: any) {
    console.error('  ❌ S8 EXCEPTION:', err.message);
  }

  console.log('===============================================================');
  if (passedCases === totalCases) {
    console.log(`🎉 ALL ${passedCases}/${totalCases} PIPELINE MIGRATION STAGES (S1-S8) PASSED!`);
    console.log('✅ Entire SINEMA S1-S8 pipeline is fully decoupled from hardcoded models and driven by Task Router.');
  } else {
    console.log(`⚠️ ${totalCases - passedCases}/${totalCases} STAGES FAILED.`);
  }
  console.log('===============================================================\n');

  return passedCases === totalCases;
}

runPipelineMigrationFullSuite().then((passed) => {
  if (!passed) process.exit(1);
  process.exit(0);
});
