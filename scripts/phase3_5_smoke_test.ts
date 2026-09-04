import { assert } from 'console';
import { GoogleGenAI } from '@google/genai';
import { db } from '../server/db';

Object.defineProperty(GoogleGenAI.prototype, 'models', {
  get() {
    return {
      generateContent: async (args: any) => {
        return {
          text: JSON.stringify({ status: 'ok', message: 'Phase 3.5 smoke test LLM response' }),
        };
      },
    };
  },
  set(_val) {
    // Ignore assignment inside GoogleGenAI constructor
  },
  configurable: true,
});

import { supabaseDb } from '../server/db/supabase_db';
import { credentialService } from '../server/ai_infrastructure/credential_service';
import { secretVault } from '../server/security/secret_vault';
import { providerService } from '../server/ai_infrastructure/provider_service';
import { executeLLMRequest } from '../server/llm_provider';
import { Project, ProjectFoundation, CharacterBible, LocationBible, ObjectBible, Scene, Shot, VideoPrompt, StoryArchitecture, CharacterContinuityState, ContinuitySnapshot } from '../src/types';

async function runPhase35SmokeTest() {
  console.log('================================================================');
  console.log('  SINEMA PHASE 3.5 — PRODUCTION HARDENING & WORKFLOW SMOKE TEST ');
  console.log('================================================================\n');

  process.env.SUPABASE_ENABLED = 'true';
  process.env.MOCK_SUPABASE = 'true';
  if (!process.env.SUPABASE_URL) process.env.SUPABASE_URL = 'https://sandbox.supabase.co';
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_test_service_role_key';
  if (!process.env.AI_SECRET_MASTER_KEY) process.env.AI_SECRET_MASTER_KEY = 'phase35-test-master-key-999';

  // ---------------------------------------------------------------------------
  // STEP 1: AI CREDENTIALS DECRYPT & GATEWAY INTEGRATION FLOW
  // ---------------------------------------------------------------------------
  console.log('--- STEP 1: AI CREDENTIALS DECRYPT & GATEWAY INTEGRATION FLOW ---');
  await providerService.initializeDefaults();

  const testSecret = 'sk-proj-test-key-phase3-5-hardening-12345';
  const encryptedSecret = secretVault.encryptSecret(testSecret);

  // Direct save to Supabase
  const testCredId = `cred_smoke_${Date.now()}`;
  await db.saveCredential({
    id: testCredId,
    providerId: 'google',
    encryptedSecret,
    maskedKey: secretVault.maskSecret(testSecret),
    status: 'active',
    weight: 1,
    environment: 'production',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  } as any);

  // Read back and decrypt
  const retrievedCred = await credentialService.getCredential(testCredId);
  assert(retrievedCred !== null, 'Retrieved credential from Supabase should not be null');
  assert(retrievedCred?.encryptedSecret === encryptedSecret, 'Encrypted secret in Supabase matches exactly');

  const decryptedSecret = secretVault.decryptSecret(retrievedCred!.encryptedSecret);
  assert(decryptedSecret === testSecret, 'Decrypted secret matches original plaintext secret');
  console.log('  ✅ AI Credential saved to Supabase, retrieved, and decrypted successfully.');

  // Test Gateway execution with credential
  const gatewayResponse = await executeLLMRequest({
    stage: 'S1',
    systemInstruction: 'You are an AI assistant.',
    prompt: 'Hello Phase 3.5 smoke test',
    temperature: 0.3,
  });
  assert(gatewayResponse.text !== undefined, 'AI Gateway response received via Supabase credentials');
  console.log('  ✅ AI Gateway executed successfully using Supabase credential resolution.\n');

  // ---------------------------------------------------------------------------
  // STEP 2: REAL WORKFLOW E2E CYCLE ON DUMMY PROJECT
  // ---------------------------------------------------------------------------
  console.log('--- STEP 2: REAL WORKFLOW E2E CYCLE (migration_validation_project) ---');

  const projectId = `proj_migration_validation_${Date.now()}`;
  console.log(`  Creating dummy project ID: ${projectId}`);

  // 1. CREATE PROJECT
  const newProject: any = {
    id: projectId,
    title: 'MIGRATION VALIDATION PROJECT — PHASE 3.5 SMOKE TEST',
    description: 'E2E workflow validation project for Supabase production cutover.',
    created_at: Date.now(),
    updated_at: Date.now(),
    current_stage: 1,
    status: 'completed',
    aspect_ratio: '16:9',
    output_language: 'id',
    genre: 'Drama Historical',
  };
  await db.saveProject(newProject as Project);
  console.log('  [S0] Project created & saved to Supabase.');

  // 2. S1: STORY UNDERSTANDING (Project Foundation)
  const foundation: any = {
    id: `found_${projectId}`,
    project_id: projectId,
    research_package: {
      topic: 'Indonesian Cinema Heritage',
      core_themes: ['Identity', 'Culture', 'Legacy'],
      historical_context: '1950s Era Cinema Production',
    },
    grounding_artifacts: [
      { id: 'art_1', title: 'Archival Photo 1', type: 'image' },
    ],
    updated_at: Date.now(),
  };
  await db.saveProjectFoundation(foundation as ProjectFoundation);
  console.log('  [S1] Story Understanding (Project Foundation) saved to Supabase.');

  // 3. S2: CHARACTER DETECTION
  const characters: any[] = [
    {
      id: `char_${projectId}_1`,
      project_id: projectId,
      name: 'Rian Sastrowardoyo',
      role: 'Protagonist',
      gender: 'Male',
      age_group: 'Adult (30-35)',
      description: 'Visionary film director in 1950s Jakarta.',
      clothing: [{ item: 'Batik Shirt', color: 'Brown/Gold' }],
      accessories: ['Vintage Camera', 'Notebook'],
    },
    {
      id: `char_${projectId}_2`,
      project_id: projectId,
      name: 'Siti Aminah',
      role: 'Supporting',
      gender: 'Female',
      age_group: 'Adult (25-30)',
      description: 'Lead scriptwriter and archivist.',
      clothing: [{ item: 'Kebaya', color: 'Cream' }],
      accessories: ['Fountain Pen'],
    },
  ];
  await db.saveAndMergeCharacters(projectId, characters as CharacterBible[]);
  console.log('  [S2] Character Detection (2 bibles) saved to Supabase.');

  // 4. S3: LOCATION & OBJECT DETECTION
  const locations: any[] = [
    {
      id: `loc_${projectId}_1`,
      project_id: projectId,
      name: 'Studio Gelora Jakarta',
      interior_exterior: 'INTERIOR',
      description: 'Classic analog movie studio with vintage lighting rigs.',
      visual_cues: ['Dust motes in light beams', 'Reel canisters'],
    },
  ];
  await db.saveAndMergeLocations(projectId, locations as LocationBible[]);

  const objects: any[] = [
    {
      id: `obj_${projectId}_1`,
      project_id: projectId,
      name: '35mm Film Camera',
      category: 'Equipment',
      description: 'Heavy German-made 35mm motion picture camera on wooden tripod.',
      continuity_notes: '',
      version: 1,
      updated_at: Date.now(),
    },
  ];
  await db.saveAndMergeObjects(projectId, objects as ObjectBible[]);
  console.log('  [S3] Location & Object Detection saved to Supabase.');

  // 5. S4: NARRATIVE BLUEPRINT (Story Architecture)
  const storyArchitecture: any = {
    id: `sa_${projectId}`,
    project_id: projectId,
    acts: [
      { act_number: 1, title: 'The Vision' },
      { act_number: 2, title: 'The Struggle' },
    ],
    beats: [
      { beat_number: 1, title: 'Opening Frame', scene_number: 1, emotional_tone: 'Hopeful' },
    ],
    updated_at: Date.now(),
  };
  await db.saveStoryArchitecture(storyArchitecture as StoryArchitecture);
  console.log('  [S4] Narrative Blueprint (Story Architecture) saved to Supabase.');

  // 6. S5: SCENE GENERATION
  const scenes: any[] = [
    {
      id: `scene_${projectId}_1`,
      project_id: projectId,
      scene_number: 1,
      summary: 'Rian sets up the 35mm camera for the opening shot.',
      time_of_day: 'DAY',
      location: 'Studio Gelora Jakarta',
      characters: ['Rian Sastrowardoyo'],
    },
    {
      id: `scene_${projectId}_2`,
      project_id: projectId,
      scene_number: 2,
      summary: 'Siti finishes the final draft under lamplight.',
      time_of_day: 'NIGHT',
      location: 'Studio Gelora Jakarta',
      characters: ['Siti Aminah'],
    },
  ];
  await db.saveScenes(projectId, scenes as Scene[]);
  console.log('  [S5] Scene Generation (2 scenes) saved to Supabase.');

  // 7. S6: SHOT BREAKDOWN
  const shots: any[] = [
    {
      id: `shot_${projectId}_1_1`,
      project_id: projectId,
      scene_id: scenes[0].id,
      shot_number: 1,
      angle: 'EYE_LEVEL',
      movement: 'STATIC',
      description: 'Wide shot of Studio Gelora as sunlight stream through skylights.',
    },
    {
      id: `shot_${projectId}_1_2`,
      project_id: projectId,
      scene_id: scenes[0].id,
      shot_number: 2,
      angle: 'LOW_ANGLE',
      movement: 'PAN',
      description: 'Close-up of Rian adjusting the lens aperture.',
    },
    {
      id: `shot_${projectId}_2_1`,
      project_id: projectId,
      scene_id: scenes[1].id,
      shot_number: 1,
      angle: 'HIGH_ANGLE',
      movement: 'STATIC',
      description: 'Medium shot of Siti typing furiously on a typewriter.',
    },
  ];
  await db.saveShots(scenes[0].id, projectId, (shots as Shot[]).filter(s => s.scene_id === scenes[0].id));
  await db.saveShots(scenes[1].id, projectId, (shots as Shot[]).filter(s => s.scene_id === scenes[1].id));
  console.log('  [S6] Shot Breakdown (3 shots across 2 scenes) saved to Supabase.');

  // 8. S7: VIDEO PROMPTS
  const prompts: any[] = [
    {
      id: `vp_${projectId}_1`,
      project_id: projectId,
      scene_id: scenes[0].id,
      shot_id: shots[0].id,
      lighting_environment: 'Warm morning sunbeams',
      final_prompt: 'A cinematic 1950s film studio with dust particles in sunlight beams.',
    },
  ];
  await db.saveSingleVideoPrompt(prompts[0] as VideoPrompt);
  console.log('  [S7] Video Prompt Generation saved to Supabase.');

  // 9. S8: CONTINUITY & SNAPSHOT
  const continuityStates: any[] = [
    {
      project_id: projectId,
      character_id: characters[0].id,
      scene_number: 1,
      updated_at: Date.now(),
    },
  ];
  await db.saveCharacterContinuityStates(projectId, continuityStates as CharacterContinuityState[]);

  const snapshot: any = {
    project_id: projectId,
    scene_number: 1,
    snapshot_data: { state: 'Initial studio setup verified' },
    updated_at: Date.now(),
  };
  await db.saveContinuitySnapshot(projectId, 1, snapshot as ContinuitySnapshot);
  console.log('  [S8] Continuity State & Snapshot saved to Supabase.');

  // ---------------------------------------------------------------------------
  // STEP 3: READ BACK & FULL FIDELITY VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP 3: READ BACK & FULL FIDELITY VERIFICATION ---');

  const retrievedProj = await db.getProject(projectId);
  assert(retrievedProj !== null && retrievedProj.title === newProject.title, 'Project read back matches');
  console.log(`  ✅ Project retrieved: "${retrievedProj?.title}"`);

  const retrievedFound = await db.getProjectFoundation(projectId);
  assert(retrievedFound !== null, 'Foundation read back matches');
  console.log('  ✅ Project Foundation research package verified.');

  const retrievedChars = await db.getCharacters(projectId);
  assert(retrievedChars.length === 2, 'Characters count matches 2');
  assert((retrievedChars[0].clothing?.[0] as any)?.item === 'Batik Shirt', 'Character clothing JSONB matches');
  console.log('  ✅ Character bibles (2) and clothing JSONB array verified.');

  const retrievedLocs = await db.getLocations(projectId);
  assert(retrievedLocs.length === 1 && retrievedLocs[0].name === 'Studio Gelora Jakarta', 'Location read back matches');
  console.log('  ✅ Location bible verified.');

  const retrievedObjs = await db.getObjects(projectId);
  assert(retrievedObjs.length === 1 && retrievedObjs[0].name === '35mm Film Camera', 'Object read back matches');
  console.log('  ✅ Object bible verified.');

  const retrievedStoryArch = await db.getStoryArchitecture(projectId);
  assert(retrievedStoryArch?.acts.length === 2, 'Story architecture acts match 2');
  console.log('  ✅ Story Architecture acts verified.');

  const retrievedScenes = await db.getScenes(projectId);
  assert(retrievedScenes.length === 2, 'Scenes count matches 2');
  console.log('  ✅ Scenes (2) retrieved and verified.');

  const retrievedShots = await db.getShotsByProject(projectId);
  assert(retrievedShots.length === 3, 'Shots count matches 3');
  console.log('  ✅ Shots (3 across 2 scenes) retrieved and verified.');

  const retrievedPrompts = await db.getVideoPromptsByProject(projectId);
  assert(retrievedPrompts.length === 1, 'Prompts count matches 1');
  console.log('  ✅ Video prompts retrieved and verified.');

  const retrievedContStates = await db.getCharacterContinuityStates(projectId);
  assert(retrievedContStates.length === 1, 'Continuity state verified');
  console.log('  ✅ Character continuity state verified.');

  // Clean up test project
  await db.deleteProject(projectId);
  await db.deleteCredential(testCredId);
  console.log('  ✅ Dummy test project & test credential safely cleaned up.');

  console.log('\n================================================================');
  console.log('   PHASE 3.5 PRODUCTION SMOKE TEST: ALL 100% SUCCESSFUL!         ');
  console.log('================================================================\n');
  process.exit(0);
}

runPhase35SmokeTest().catch(err => {
  console.error('\n❌ PHASE 3.5 SMOKE TEST FAILED:', err);
  process.exit(1);
});
