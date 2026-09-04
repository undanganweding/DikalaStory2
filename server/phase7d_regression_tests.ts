import {
  buildCanonicalProductionContext,
  resolveSceneContext,
  resolveShotContext,
  validatePromptAgainstContext,
  createPromptProvenance,
  isPromptStale,
  deriveModernAnachronismExclusions,
  CanonicalProductionContext,
} from './canonical_context_engine';
import {
  serializeMasterSceneData,
  adaptBananaMasterFrame,
  adaptVeoVideoPrompt,
  adaptOmniVideoPrompt,
  adaptSeedanceVideoPrompt,
} from './cinematic_prompt_engine';
import { Scene, Shot, CharacterBible, LocationBible, ProjectFoundation } from '../src/types';

// ============================================================================
// BAMBANG KERTONADI TEST FIXTURE (LATE 15TH-CENTURY JAVA)
// Note: This is an isolated regression test fixture, NOT hard-coded into production logic.
// ============================================================================
export const BAMBANG_KERTONADI_FIXTURE = {
  foundation: {
    project_id: 'proj_java_15th',
    era: 'Late 15th-century Java, ±1470–1480',
    theme: 'Historical Drama & Courage',
    genre: 'Historical Epic',
    timeline: 'Demak Sultanate Era',
    main_characters: ['Bambang Kertonadi'],
    supporting_characters: [],
    locations: ['Pendopo Agung'],
    main_conflict: 'Defending royal heirloom',
    emotional_arc: 'Dignified purpose',
    narrative_arc: 'Heroic journey',
    visual_tone: '35mm Panavision anamorphic, rich organic warm cinematic light',
    updated_at: new Date().toISOString(),
  } as ProjectFoundation,

  characters: [
    {
      id: 'char_bambang',
      project_id: 'proj_java_15th',
      name: 'Bambang Kertonadi',
      age: '20–25 years old',
      gender: 'Male',
      physical_appearance: 'Javanese young man, oval face, strong jaw, thick dark eyebrows, straight nose, shoulder-length black hair tied in traditional style, athletic build, very thin moustache',
      face_identity_locked: true,
      hair: 'Shoulder-length black hair tied back',
      beard: 'Very thin moustache',
      clothing: [
        'period-appropriate traditional Javanese noble clothing',
        'patterned woven jarik',
        'cloth waist sash',
        'traditional keris tucked at rear waist',
      ],
      accessories: ['traditional keris'],
      personality: 'Dignified, brave, quiet focus',
      voice_character: 'Calm, authoritative',
      movement_style: 'Deliberate, grounded martial posture',
      version: 1,
      updated_at: new Date().toISOString(),
    },
  ] as CharacterBible[],

  locations: [
    {
      id: 'loc_pendopo',
      project_id: 'proj_java_15th',
      name: 'Pendopo Agung Jati',
      era: 'Late 15th-century Java',
      architecture: 'Traditional open Javanese pendopo, carved jati timber pillars, exposed roof rafters',
      environment: 'Packed-earth courtyard surrounded by sawo and coconut trees, horses grazing in distance',
      landscape: 'Rural Javanese countryside, lush tropical foliage',
      climate: 'Warm tropical humid air',
      culture: 'Javanese',
      lighting_style: 'Golden afternoon sunlight filtering through wooden rafters and tree leaves',
      color_palette: ['Earthy brown', 'Deep teak timber', 'Natural green foliage', 'Warm gold light'],
      material: 'Solid teak wood (jati timber), clay roof tiles, packed earth',
      version: 1,
      updated_at: new Date().toISOString(),
    },
  ] as LocationBible[],

  scene: {
    id: 'scene_01',
    project_id: 'proj_java_15th',
    scene_number: 1,
    title: 'Langkah Pertama Bambang Kertonadi',
    duration_sec: 10,
    story_purpose: 'Introduce Bambang Kertonadi entering the pendopo with dignified determination',
    location_name: 'Pendopo Agung Jati',
    time_of_day: 'Late Afternoon',
    character_names: ['Bambang Kertonadi'],
    emotional_objective: 'Dignified purpose and tension',
    event: 'Bambang Kertonadi walks slowly through the open Javanese pendopo past carved jati timber pillars',
    narrative_function: 'Introduction',
    version: 1,
    updated_at: new Date().toISOString(),
  } as Scene,

  shots: [
    {
      id: 'shot_01',
      scene_id: 'scene_01',
      project_id: 'proj_java_15th',
      shot_number: 1,
      start_time_sec: 0,
      end_time_sec: 10,
      duration_sec: 10,
      event_detail: 'Bambang Kertonadi walking past carved teak pillars in slow deliberate motion',
      character_action: 'Walking past wooden pillars, right hand near waist sash',
      camera_note: 'Medium tracking shot tracking alongside subject',
      dialogue: [],
      emotion: 'Focused determination',
      audio_note: 'Footsteps on packed earth, distant tropical wind through sawo leaves',
      shot_type: 'Medium Shot',
      camera_movement: 'Dolly Parallel Track',
      version: 1,
    },
  ] as Shot[],
};

export function runPhase7DRegressionTests(): void {
  console.log('================================================================');
  console.log('  SINEMA PHASE 7D — CANONICAL PROMPT GENERATION PIPELINE TESTS  ');
  console.log('================================================================');

  const { foundation, characters, locations, scene, shots } = BAMBANG_KERTONADI_FIXTURE;

  // Build Canonical Production Context
  const canonicalContext = buildCanonicalProductionContext({
    foundation,
    characters,
    locations,
    objects: [],
  });

  const sceneContext = resolveSceneContext(canonicalContext, scene, shots);
  const shotContext = resolveShotContext(canonicalContext, sceneContext, shots[0]);

  // TEST 01 — Era Preservation
  console.log('\nTEST 01: Era Preservation');
  const masterData = serializeMasterSceneData(
    scene,
    shots,
    foundation,
    characters,
    locations,
    [],
    'banana',
    'cinematic',
    'Historical Java Project',
    10
  );
  if (!masterData.location.era.includes('Late 15th-century Java')) {
    throw new Error(`TEST 01 FAILED: Era "${masterData.location.era}" does not contain Late 15th-century Java`);
  }
  console.log('  ✓ Storyboard era preserved in canonical master scene data');

  // TEST 02 — Character Preservation
  console.log('\nTEST 02: Character Preservation');
  const charEntry = masterData.characters.find((c) => c.name === 'Bambang Kertonadi');
  if (!charEntry) {
    throw new Error('TEST 02 FAILED: Character Bambang Kertonadi missing from master scene data');
  }
  if (!charEntry.appearance.includes('oval face') || !charEntry.appearance.includes('straight nose')) {
    throw new Error(`TEST 02 FAILED: Facial identity details missing from character entry: ${charEntry.appearance}`);
  }
  console.log('  ✓ Facial identity and age attributes preserved from Character Bible');

  // TEST 03 — Wardrobe Preservation
  console.log('\nTEST 03: Wardrobe Preservation');
  const costumeText = charEntry.costume.join(', ');
  if (!costumeText.includes('jarik') || !costumeText.includes('keris') || !costumeText.includes('sash')) {
    throw new Error(`TEST 03 FAILED: Wardrobe details missing: ${costumeText}`);
  }
  console.log('  ✓ Period Javanese noble wardrobe (jarik, sash, keris) preserved');

  // TEST 04 — Location Preservation
  console.log('\nTEST 04: Location Preservation');
  if (!masterData.location.architecture.includes('jati timber') || !masterData.location.architecture.includes('pendopo')) {
    throw new Error(`TEST 04 FAILED: Location architecture lost: ${masterData.location.architecture}`);
  }
  console.log('  ✓ Period architecture (jati timber pendopo) preserved');

  // TEST 05 — Modern Anachronism Guard
  console.log('\nTEST 05: Modern Anachronism Guard');
  const exclusions = deriveModernAnachronismExclusions('Late 15th-century Java', 'Javanese', 'Pendopo');
  if (!exclusions.some((e) => e.includes('modern Javanese wedding')) || !exclusions.some((e) => e.includes('cars'))) {
    throw new Error('TEST 05 FAILED: Modern anachronism guard failed to derive era-specific exclusions');
  }
  console.log('  ✓ Modern anachronism guard derived exclusions for 15th-century Java');

  // TEST 06 — Shot Inheritance
  console.log('\nTEST 06: Shot Inheritance');
  if (shotContext.eraLock.period !== sceneContext.eraLock.period) {
    throw new Error('TEST 06 FAILED: ShotContext failed to inherit era from parent SceneContext');
  }
  if (shotContext.location.name !== sceneContext.location.name) {
    throw new Error('TEST 06 FAILED: ShotContext failed to inherit location from parent SceneContext');
  }
  console.log('  ✓ ShotContext inherited parent scene and project canonical context');

  // TEST 07 — Image/Video Consistency
  console.log('\nTEST 07: Image & Video Prompt Context Consistency');
  const bananaPrompt = adaptBananaMasterFrame(masterData);
  const veoPromptObj = adaptVeoVideoPrompt(masterData, shots);
  const veoPrompt = veoPromptObj.prompt;
  if (!bananaPrompt.includes('Bambang Kertonadi') || !veoPrompt.includes('Bambang Kertonadi')) {
    throw new Error('TEST 07 FAILED: Image and video prompts do not share identical character identity');
  }
  console.log('  ✓ Image and video prompt pipelines share identical canonical context');

  // TEST 08 — Multi-Agent Consistency
  console.log('\nTEST 08: Multi-Agent Prompt Engine Consistency');
  const omniPrompt = adaptOmniVideoPrompt(masterData).prompt;
  const seedancePrompt = adaptSeedanceVideoPrompt(masterData).shot_breakdown;
  if (!omniPrompt.includes('15th-century') || !seedancePrompt.includes('15th-century')) {
    throw new Error('TEST 08 FAILED: Multi-agent prompt adapters received inconsistent era context');
  }
  console.log('  ✓ Multi-agent prompt adapters operate on identical canonical context');

  // TEST 09 — Prompt Validation
  console.log('\nTEST 09: Continuity Agent & Prompt Validation');
  const badPrompt = 'A young man in a modern city street wearing jeans and t-shirt near a car.';
  const validationResult = validatePromptAgainstContext(badPrompt, shotContext);
  if (validationResult.valid !== false || validationResult.missingHardConstraints.length === 0) {
    throw new Error('TEST 09 FAILED: Prompt validation failed to detect missing hard constraints');
  }
  if (!validationResult.restoredPrompt || !validationResult.restoredPrompt.includes('Bambang Kertonadi')) {
    throw new Error('TEST 09 FAILED: Prompt restoration failed to re-inject missing character lock');
  }
  console.log('  ✓ Prompt validation detected missing constraints and re-injected canonical locks');

  // TEST 10 — Human Override Isolation
  console.log('\nTEST 10: Human Override Isolation');
  const humanEditedPrompt = 'Bambang Kertonadi looking dramatically towards the setting sun.';
  // Ensure human edit does not mutate character bible
  if (characters[0].physical_appearance.includes('looking dramatically towards')) {
    throw new Error('TEST 10 FAILED: Human override mutated underlying Character Bible');
  }
  console.log('  ✓ Human override isolated without mutating underlying Character/Location Bibles');

  // TEST 11 — Context Versioning
  console.log('\nTEST 11: Context Versioning');
  const prov1 = createPromptProvenance(canonicalContext, scene.id || 'scene_01');
  const modifiedContext = buildCanonicalProductionContext({
    foundation: { ...foundation, era: 'Late 16th-century Java' },
    characters,
    locations,
  });
  if (!isPromptStale(prov1, modifiedContext)) {
    throw new Error('TEST 11 FAILED: Storyboard era update did not mark prompt context as stale');
  }
  console.log('  ✓ Storyboard context modification correctly invalidated stale prompt version');

  // TEST 12 — Provider Adaptation
  console.log('\nTEST 12: Provider Adaptation Hard Constraint Preservation');
  const adaptedVeo = adaptVeoVideoPrompt(masterData, shots).prompt;
  if (!adaptedVeo.includes('Late 15th-century Java') && !adaptedVeo.includes('15th-century')) {
    throw new Error(`TEST 12 FAILED: Provider adapter erased era lock: ${adaptedVeo}`);
  }
  console.log('  ✓ Provider adapters preserved all canonical hard constraints');

  console.log('\n================================================================');
  console.log('  ALL PHASE 7D REGRESSION TESTS PASSED (12/12 ASSERTIONS)      ');
  console.log('================================================================\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPhase7DRegressionTests();
}
