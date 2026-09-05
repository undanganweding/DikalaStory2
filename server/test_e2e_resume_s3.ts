import { db } from './db';
import { runProjectInitialization } from './orchestrator';
import { aiGateway } from './ai_infrastructure/ai_gateway';

// Store original generator
const originalGenerate = aiGateway.generate;

aiGateway.generate = async function (req) {
  console.log(`[MOCK AI GATEWAY] Intercepted generate call. Task: ${req.task}, Agent: ${req.agentName}`);

  let mockText = '';

  if (req.task === 'location_object_analysis' || req.agentName === 'S3') {
    mockText = JSON.stringify({
      locations: [
        {
          name: 'chamber',
          era: '7th Century Arabia',
          architecture: 'Mud-brick dwelling with exposed roof logs and woven wool drapes',
          environment: 'Interior',
          landscape: 'Slightly elevated rocky desert hills of Makkah',
          climate: 'Hot, dry desert air with soft dust-motes suspended in air',
          culture: 'Ancient Hijazi traditional household',
          lighting_style: 'Strong volumetric morning sunlight casting deep latticed wooden shadows across carpets',
          color_palette: ['terracotta', 'desert sand', 'unbleached flaxen linen', 'charred wood'],
          material: 'mud-brick walling, rough date-palm planks, heavy wool rugs'
        },
        {
          name: 'garden',
          era: '7th Century Arabia',
          architecture: 'Low stone wall enclosure framing wild date palm trees and sparse shrubbery',
          environment: 'Exterior',
          landscape: 'Garden outskirts overlooking the distant caravanserais',
          climate: 'Warm with cooling late afternoon breezes',
          culture: 'Tranquil private family garden sanctuary',
          lighting_style: 'Soft golden hour sidelight transitioning to twilight glow',
          color_palette: ['dusty olive green', 'parched earth ochre', 'dim rose twilight'],
          material: 'rough limestone walls, clay soil, living organic wood'
        }
      ],
      objects: [
        {
          name: 'Golden Antique Compass',
          category: 'Key Prop',
          description: 'A pocket-sized polished brass compass decorated with celestial tracking lines',
          continuity_notes: 'Held by Abdullah in Scene 1 inside the chamber; used for orientation.'
        },
        {
          name: 'Heavy Wooden Chest',
          category: 'Heirloom',
          description: 'A masterfully carved cedar chest banded with thick iron hoops and a rusty clasp',
          continuity_notes: 'Placed visibly on the wooden table in Scene 1.'
        },
        {
          name: 'Brass Inkwell',
          category: 'Key Prop',
          description: 'A heavy cylindrical brass pot filled with dark viscous writing fluid',
          continuity_notes: 'Sits near Aminah as she writes on parchment in Scene 2 in the garden.'
        }
      ]
    });
  } else if (req.task === 'narrative_structure' || req.agentName === 'S4') {
    mockText = JSON.stringify({
      beginning: 'Abdullah stands in his quiet chamber, gazing out at Makkah, seeking clarity before his grand desert journey.',
      development: 'Aminah is introduced in her family garden, carefully composing her thoughts on parchment using her writing tools.',
      climax: 'Abdullah packs the heavy wooden chest, preparing his trading goods while holding his golden antique compass.',
      consequence: 'Aminah writes with deep emotional intensity, hoping for a safe return and successful trade route.',
      ending: 'Abdullah departs into the dust as the wind rustles the date palms, leaving a poignant cinematic parting image.'
    });
  } else if (req.task === 'scene_breakdown' || req.agentName === 'S5') {
    mockText = JSON.stringify([
      {
        scene_number: 1,
        title: 'INT. ABDULLAH CHAMBER - MORNING SETUP',
        duration_sec: 10,
        story_purpose: 'Establish Abdullah preparing for the journey in his chamber.',
        location_name: 'chamber',
        time_of_day: 'DAWN',
        character_names: ['Abdullah'],
        emotional_objective: 'Noble resolve and focus',
        event: 'Abdullah places the heavy wooden chest on the table and looks out the window.',
        narrative_function: 'Exposition'
      },
      {
        scene_number: 2,
        title: 'EXT. AMINAH GARDEN - QUIET REFLECTION',
        duration_sec: 10,
        story_purpose: 'Introduce Aminah and her creative writing context.',
        location_name: 'garden',
        time_of_day: 'DAY',
        character_names: ['Aminah'],
        emotional_objective: 'Deep connection and artistic reflection',
        event: 'Aminah writes on a parchment using the brass inkwell under a palm tree.',
        narrative_function: 'Development'
      },
      {
        scene_number: 3,
        title: 'INT. ABDULLAH CHAMBER - FINAL PACKING',
        duration_sec: 10,
        story_purpose: 'Complete packing of the chest using the golden compass.',
        location_name: 'chamber',
        time_of_day: 'DUSK',
        character_names: ['Abdullah'],
        emotional_objective: 'Imminent transition and anticipation',
        event: 'Abdullah inspects his golden antique compass and secures the wooden chest.',
        narrative_function: 'Climax Beat 1'
      }
    ]);
  } else {
    // Pass through for other tasks if any
    return originalGenerate.apply(aiGateway, [req]);
  }

  return {
    text: mockText,
    credentialId: 'mock-cred',
    providerId: 'mock-provider',
    model: req.model || 'mock-model',
    latencyMs: 50,
    tokens: {
      prompt: 100,
      completion: 150,
      total: 250,
    },
  };
};

const REAL_SCRIPT_S3 = `
Scene 1: Abdullah stands in his chamber. The room is decorated in traditional Arabian style.
Abdullah holds a golden antique compass and places a heavy wooden chest on the table. He looks out of the window.

Scene 2: Aminah sits in the garden under a shady palm tree.
Aminah is elegant, wearing a traditional abaya. She is writing on a large parchment using a brass inkwell and a feather quill.
`;

async function runE2EResumeS3() {
  console.log('================================================================');
  console.log('E2E RESUME FROM S3 PIPELINE VALIDATION (MOCKED GATEWAY)');
  console.log('================================================================\n');

  const projectId = `e2e_resume_s3_${Date.now()}`;
  const now = new Date().toISOString();

  console.log(`Step 1: Seeding project: ${projectId}`);
  await db.saveProject({
    id: projectId,
    title: `E2E Resume Project [${projectId}]`,
    raw_script: REAL_SCRIPT_S3,
    total_duration_target_sec: 30,
    max_scene_shot_duration_sec: 10,
    scene_duration_sec: 10,
    allow_final_scene_override: false,
    prompt_language: 'en',
    ai_model: 'gemini-3.7-flash',
    reasoning_config: {
      provider_type: 'google',
      provider_name: 'Google Gemini',
      model_id: 'gemini-3.7-flash',
      display_name: 'gemini-3.7-flash',
    },
    image_model: 'nano_banana_pro',
    video_model: ['veo'],
    include_seedance_format: false,
    created_at: now,
    updated_at: now,
    status: 'draft',
    current_stage: 0,
  } as any);

  console.log('Step 2: Pre-seeding S1 (Project Foundation) in database');
  await db.saveProjectFoundation({
    project_id: projectId,
    era: 'Period-appropriate Arabian era',
    theme: 'Love, dedication, and journey',
    genre: 'Cinematic History',
    timeline: '7th Century Arabia',
    main_characters: ['Abdullah', 'Aminah'],
    supporting_characters: [],
    locations: ['chamber', 'garden'],
    main_conflict: 'The upcoming trade journey',
    emotional_arc: 'Peaceful connections to long-distance yearning',
    narrative_arc: 'Departure planning and setting up the emotional anchors',
    visual_tone: 'Soft sunlit lighting, earthy hues, rich cinematic shadows',
    updated_at: now,
    is_historical_religious_biography: false,
    research_basic_facts: {
      subject: 'Abdullah Journey',
      birth_info: 'Makkah',
      places_lived: 'Makkah',
      opponents_enemies: 'None',
      key_events: [],
      end_of_life: 'Unknown',
    },
    research_timeline: [],
    research_era_context: {
      century_era: '7th Century Arabia',
      forbidden_elements: [],
      allowed_elements: [],
      technology_weapons: 'None',
      clothing_costumes: 'Tunic',
    },
    research_sources: [],
    act_1_world_setup: {
      description: 'World is introduced',
      visual_guide: 'Soft sand tones',
      audio_guide: 'Wind blowing',
    },
    act_2_human_element: {
      character_focus: 'Abdullah and Aminah',
      internal_feelings: 'Deep longing',
      early_education_struggle: 'Writing techniques',
    },
    act_3_rising_conflict: {
      tension_type: 'Upcoming departure',
      tempo_visual_note: 'Slow rhythmic pacing',
      tempo_audio_note: 'Muted drums',
    },
    act_4_climax_breath: {
      silent_before_climax: 'Quiet packing',
      climax_impact: 'The compass is checked',
      audio_contrast_guide: 'Complete silence',
    },
    act_5_legacy_meaning: {
      deeper_meaning: 'Legacy of dedication',
      message_for_posterity: 'Safe journeys start at home',
    },
    narrative_style_mode: 'epic',
    islamic_validation_safeguard: {
      fact_validation_notes: 'Valid',
      reverence_protocol_applied: true,
      forbidden_dialogue_safeguards: 'Checked',
    },
  });

  console.log('Step 3: Pre-seeding S2 (Characters) in database');
  await db.saveAndMergeCharacters(projectId, [
    {
      name: 'Abdullah',
      age: 'Young adult',
      gender: 'Male',
      physical_appearance: 'Noble posture, contemplative eyes, light Arabian attire',
      face_identity_locked: true,
      hair: 'Dark hair',
      beard: 'Neatly trimmed beard',
      clothing: ['Light beige tunic', 'Traditional sandals'],
      accessories: [],
      personality: 'Kind, protective, highly dedicated',
      voice_character: 'Deep and calm',
      movement_style: 'Calm and steady',
    },
    {
      name: 'Aminah',
      age: 'Young adult',
      gender: 'Female',
      physical_appearance: 'Wise facial features, graceful expression, elegant attire',
      face_identity_locked: true,
      hair: 'Dark hair, covered with headscarf',
      beard: '',
      clothing: ['Earthy-toned long abaya', 'matching headscarf'],
      accessories: [],
      personality: 'Extremely patient, gentle, creative writer',
      voice_character: 'Soft and articulate',
      movement_style: 'Graceful and deliberate',
    }
  ]);

  // Let's verify state detection
  console.log('\nStep 4: Checking pre-seeded S1/S2 status before trigger');
  const [existingFoundation, resumeCharacters, resumeLocations, resumeObjects, resumeScenes] = await Promise.all([
    db.getProjectFoundation(projectId),
    db.getCharacters(projectId),
    db.getLocations(projectId),
    db.getObjects(projectId),
    db.getScenes(projectId),
  ]);

  const haveS1 = Boolean(existingFoundation);
  const haveS2 = resumeCharacters.length > 0;
  const haveS3 = resumeLocations.length > 0;
  
  console.log(`Pre-seed Check: haveS1=${haveS1}, haveS2=${haveS2}, haveS3=${haveS3}`);
  if (!haveS1 || !haveS2 || haveS3) {
    console.error('FAILED: Initial pre-seed state is incorrect for resuming from S3!');
    process.exit(1);
  }
  console.log('PASSED: Pre-seed verification. Starting stable E2E run...\n');

  console.log('Step 5: Triggering Project Initialization E2E Resume S3 Pipeline...');
  const initResult = await runProjectInitialization(projectId, (stage, stageName, message, level) => {
    console.log(`[PROGRESS S${stage}] [${stageName}] [${level?.toUpperCase()}] -> ${message}`);
  });

  console.log('\nStep 6: Real Execution Output Verification');
  console.log(`Initialization Result Success: ${initResult.success}`);
  if (initResult.error) {
    console.error(`Initialization Result Error: ${initResult.error}`);
  }

  // Reload data from DB to verify successful stage completions
  const [finalFoundation, finalLocations, finalObjects, finalScenes] = await Promise.all([
    db.getProjectFoundation(projectId),
    db.getLocations(projectId),
    db.getObjects(projectId),
    db.getScenes(projectId),
  ]);

  const hasS3Locations = finalLocations.length > 0;
  const hasS3Objects = finalObjects.length > 0;
  const hasS4Narrative = Boolean(finalFoundation?.narrative_beats?.beginning);
  const hasS5Scenes = finalScenes.length > 0;

  console.log('\n=========================================');
  console.log('POST-PIPELINE INTEGRITY CHECKS:');
  console.log(`S3 Locations Created:   ${finalLocations.length} (${hasS3Locations ? '🟢 YES' : '🔴 NO'})`);
  console.log(`S3 Objects Created:     ${finalObjects.length} (${hasS3Objects ? '🟢 YES' : '🔴 NO'})`);
  console.log(`S4 Narrative Beats:     ${hasS4Narrative ? '🟢 YES' : '🔴 NO'}`);
  console.log(`S5 Scenes Breakdown:    ${finalScenes.length} (${hasS5Scenes ? '🟢 YES' : '🔴 NO'})`);
  console.log('=========================================\n');

  if (!initResult.success) {
    console.error('FAILED: Initialization pipeline did not report success!');
    process.exit(1);
  }

  if (!hasS3Locations || !hasS3Objects || !hasS4Narrative || !hasS5Scenes) {
    console.error('FAILED: One or more stages failed to save data to database!');
    process.exit(1);
  }

  console.log('================================================================');
  console.log('SUCCESS: E2E RESUME FROM S3 FLOW VALIDATED PERFECTLY!');
  console.log('================================================================');
  process.exit(0);
}

runE2EResumeS3().catch(err => {
  console.error('Fatal E2E Error:', err);
  process.exit(1);
});
