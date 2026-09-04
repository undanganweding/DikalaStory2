import { supabaseDb } from './supabase_db';
import { getSupabaseClient, isSupabaseConfigured, resetSupabaseClientInstance } from './supabase_client';
import { Project, Scene, Shot, VideoPrompt, CharacterBible, LocationBible, ObjectBible } from '../../src/types';

export async function runPhase31TransactionSuite(): Promise<boolean> {
  console.log('================================================================');
  console.log('SINEMA PHASE 3.1: TRANSACTION SEMANTICS & FAILURE INJECTION SUITE');
  console.log('================================================================');

  if (!process.env.SUPABASE_URL) {
    process.env.SUPABASE_URL = 'https://sandbox.supabase.co';
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_test_service_role_key';
  }
  resetSupabaseClientInstance();

  const supabase = getSupabaseClient();
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
      failedCount++;
    }
  }

  try {
    const testProjectId = `proj_tx_test_${Date.now()}`;
    const now = new Date().toISOString();

    // -------------------------------------------------------------------------
    // TEST 1: Seed Base Project
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Seeding Base Project ---');
    const baseProject: Project = {
      id: testProjectId,
      title: 'Phase 3.1 Transaction Proof Project',
      raw_script: 'EXT. TRANSACTION FIELD - DAY\nTesting atomic rollback.',
      total_duration_target_sec: 60,
      max_scene_shot_duration_sec: null,
      prompt_language: 'en',
      image_model: 'nano_banana_pro',
      video_model: ['veo'],
      include_seedance_format: false,
      status: 'draft',
      created_at: now,
      updated_at: now,
    };

    await supabaseDb.saveProject(baseProject);
    const fetchedProj = await supabaseDb.getProject(testProjectId);
    assert(fetchedProj !== null && fetchedProj.id === testProjectId, 'Base Project Seeding');

    // -------------------------------------------------------------------------
    // TEST 2: saveScenes Atomic Rollback on Failure
    // -------------------------------------------------------------------------
    console.log('\n--- 2. saveScenes Atomic Rollback Test ---');
    // Step A: Seed initial 3 scenes
    const initialScenes: Omit<Scene, 'id' | 'project_id' | 'version' | 'created_at' | 'updated_at'>[] = [
      { scene_number: 1, title: 'Old Scene 1', duration_sec: 5, location_name: 'Loc 1', time_of_day: 'DAY', character_names: ['A'], beats: [], narrative_modes: [], created_at: now, updated_at: now } as any,
      { scene_number: 2, title: 'Old Scene 2', duration_sec: 5, location_name: 'Loc 2', time_of_day: 'NIGHT', character_names: ['B'], beats: [], narrative_modes: [], created_at: now, updated_at: now } as any,
      { scene_number: 3, title: 'Old Scene 3', duration_sec: 5, location_name: 'Loc 3', time_of_day: 'DAWN', character_names: ['C'], beats: [], narrative_modes: [], created_at: now, updated_at: now } as any,
    ];

    const savedInitialScenes = await supabaseDb.saveScenes(testProjectId, initialScenes);
    assert(savedInitialScenes.length === 3, 'Initial Scenes Seeded', `Count: ${savedInitialScenes.length}`);
    const initialSceneIds = savedInitialScenes.map(s => s.id);

    // Step B: Attempt atomic replacement with payload containing invalid numeric value for scene_number to trigger DB error
    let sceneTxFailed = false;
    try {
      const invalidScenesPayload = [
        { id: `scene_new_valid_1`, scene_number: 10, title: 'New Valid Scene 1', duration_sec: 5, location_name: 'Loc X' },
        { id: `scene_new_invalid`, scene_number: 'INVALID_NUMERIC' as any, title: 'New Invalid Scene', duration_sec: 5 },
      ];
      // Direct call to RPC to force transaction rollback failure
      const { error } = await supabase.rpc('replace_scenes', {
        p_project_id: testProjectId,
        p_scenes: invalidScenesPayload,
      });
      if (error) {
        sceneTxFailed = true;
      }
    } catch (err) {
      sceneTxFailed = true;
    }

    assert(sceneTxFailed, 'saveScenes Rejected Invalid Insert in RPC Transaction');

    // Step C: Verify old scenes STILL EXIST unchanged and no partial new scenes exist
    const postFailScenes = await supabaseDb.getScenes(testProjectId);
    const postFailSceneIds = postFailScenes.map(s => s.id);
    const oldScenesPreserved = initialSceneIds.every(id => postFailSceneIds.includes(id));
    const noNewScenesInserted = !postFailSceneIds.includes('scene_new_valid_1');

    assert(
      postFailScenes.length === 3 && oldScenesPreserved && noNewScenesInserted,
      'saveScenes Transaction Rollback Proof (Old Data Preserved Intact, Partial Inserts Atomically Aborted)',
      `Actual Count: ${postFailScenes.length}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: saveShots Atomic Rollback on Failure
    // -------------------------------------------------------------------------
    console.log('\n--- 3. saveShots Atomic Rollback Test ---');
    const targetSceneId = initialSceneIds[0];

    // Step A: Seed initial 3 shots for targetSceneId
    const initialShots: Omit<Shot, 'id' | 'scene_id' | 'project_id' | 'version' | 'created_at' | 'updated_at'>[] = [
      { shot_number: 1, start_time_sec: 0, end_time_sec: 5, duration_sec: 5, visual_description: 'Old Shot 1', dialogue: [] } as any,
      { shot_number: 2, start_time_sec: 5, end_time_sec: 10, duration_sec: 5, visual_description: 'Old Shot 2', dialogue: [] } as any,
      { shot_number: 3, start_time_sec: 10, end_time_sec: 15, duration_sec: 5, visual_description: 'Old Shot 3', dialogue: [] } as any,
    ];

    const savedInitialShots = await supabaseDb.saveShots(targetSceneId, testProjectId, initialShots);
    assert(savedInitialShots.length === 3, 'Initial Shots Seeded', `Count: ${savedInitialShots.length}`);
    const initialShotIds = savedInitialShots.map(s => s.id);

    // Step B: Attempt atomic replacement with payload containing invalid data
    let shotTxFailed = false;
    try {
      const invalidShotsPayload = [
        { id: `shot_new_valid_1`, shot_number: 10, visual_description: 'New Valid Shot 1' },
        { id: `shot_new_invalid`, shot_number: 'INVALID_NUMERIC' as any, visual_description: 'New Invalid Shot' },
      ];
      const { error } = await supabase.rpc('replace_shots', {
        p_scene_id: targetSceneId,
        p_project_id: testProjectId,
        p_shots: invalidShotsPayload,
      });
      if (error) {
        shotTxFailed = true;
      }
    } catch (err) {
      shotTxFailed = true;
    }

    assert(shotTxFailed, 'saveShots Rejected Invalid Insert in RPC Transaction');

    // Step C: Verify old shots STILL EXIST unchanged
    const postFailShots = await supabaseDb.getShotsByScene(targetSceneId);
    const postFailShotIds = postFailShots.map(s => s.id);
    const oldShotsPreserved = initialShotIds.every(id => postFailShotIds.includes(id));
    const noNewShotsInserted = !postFailShotIds.includes('shot_new_valid_1');

    assert(
      postFailShots.length === 3 && oldShotsPreserved && noNewShotsInserted,
      'saveShots Transaction Rollback Proof (Old Data Preserved Intact, Partial Inserts Atomically Aborted)',
      `Actual Count: ${postFailShots.length}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: saveVideoPrompts Atomic Rollback on Failure
    // -------------------------------------------------------------------------
    console.log('\n--- 4. saveVideoPrompts Atomic Rollback Test ---');
    const targetShotId = initialShotIds[0];

    // Step A: Seed initial 2 video prompts
    const initialPrompts: Omit<VideoPrompt, 'id' | 'shot_id' | 'scene_id' | 'project_id' | 'version' | 'created_at' | 'updated_at'>[] = [
      { target_platform: 'veo', prompt_text: 'Old Prompt 1', negative_prompt: '', duration_seconds: 5 } as any,
      { target_platform: 'seedance', prompt_text: 'Old Prompt 2', negative_prompt: '', duration_seconds: 5 } as any,
    ];

    const savedInitialPrompts = await supabaseDb.saveVideoPrompts(targetShotId, targetSceneId, testProjectId, initialPrompts);
    assert(savedInitialPrompts.length === 2, 'Initial Video Prompts Seeded', `Count: ${savedInitialPrompts.length}`);
    const initialPromptIds = savedInitialPrompts.map(p => p.id);

    // Step B: Attempt atomic replacement with payload containing invalid data
    let promptTxFailed = false;
    try {
      const invalidPromptsPayload = [
        { id: `vprompt_new_valid_1`, target_platform: 'veo', prompt_text: 'New Valid Prompt' },
        { id: `vprompt_new_invalid`, target_platform: 'veo', seed: 'INVALID_BIGINT' as any },
      ];
      const { error } = await supabase.rpc('replace_video_prompts', {
        p_shot_id: targetShotId,
        p_scene_id: targetSceneId,
        p_project_id: testProjectId,
        p_prompts: invalidPromptsPayload,
      });
      if (error) {
        promptTxFailed = true;
      }
    } catch (err) {
      promptTxFailed = true;
    }

    assert(promptTxFailed, 'saveVideoPrompts Rejected Invalid Insert in RPC Transaction');

    // Step C: Verify old video prompts STILL EXIST
    const postFailPrompts = await supabaseDb.getVideoPromptsByShot(targetShotId);
    const postFailPromptIds = postFailPrompts.map(p => p.id);
    const oldPromptsPreserved = initialPromptIds.every(id => postFailPromptIds.includes(id));
    const noNewPromptsInserted = !postFailPromptIds.includes('vprompt_new_valid_1');

    assert(
      postFailPrompts.length === 2 && oldPromptsPreserved && noNewPromptsInserted,
      'saveVideoPrompts Transaction Rollback Proof (Old Data Preserved Intact, Partial Inserts Atomically Aborted)',
      `Actual Count: ${postFailPrompts.length}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Atomic Foreign Key Cascade Deletion (deleteProject)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. deleteProject Cascade Atomicity Test ---');
    // Seed characters & locations for test project
    await supabaseDb.saveAndMergeCharacters(testProjectId, [{ name: 'Test Hero', age: '30', gender: 'male', physical_appearance: 'tall', face_identity_locked: false, hair: 'short', beard: 'none', clothing: [], accessories: [] } as any]);
    await supabaseDb.saveAndMergeLocations(testProjectId, [{ name: 'Test Castle', era: 'medieval', architecture: 'gothic', environment: 'mountain', landscape: 'rocky', color_palette: [] } as any]);

    const preDelChars = await supabaseDb.getCharacters(testProjectId);
    const preDelLocs = await supabaseDb.getLocations(testProjectId);
    const preDelScenes = await supabaseDb.getScenes(testProjectId);
    assert(preDelChars.length > 0 && preDelLocs.length > 0 && preDelScenes.length > 0, 'Pre-deletion Dependent Records Present');

    // Perform deleteProject
    const deleteSuccess = await supabaseDb.deleteProject(testProjectId);
    assert(deleteSuccess === true, 'deleteProject Returned True');

    // Verify complete cascade deletion in single atomic operation
    const postDelProj = await supabaseDb.getProject(testProjectId);
    const postDelChars = await supabaseDb.getCharacters(testProjectId);
    const postDelLocs = await supabaseDb.getLocations(testProjectId);
    const postDelScenes = await supabaseDb.getScenes(testProjectId);
    const postDelShots = await supabaseDb.getShotsByProject(testProjectId);
    const postDelPrompts = await supabaseDb.getVideoPromptsByProject(testProjectId);

    const cascadeComplete =
      postDelProj === null &&
      postDelChars.length === 0 &&
      postDelLocs.length === 0 &&
      postDelScenes.length === 0 &&
      postDelShots.length === 0 &&
      postDelPrompts.length === 0;

    assert(
      cascadeComplete,
      'deleteProject Atomic Foreign Key Cascade Proof (Project and All Dependent Records Completely Removed in Single Transaction)'
    );

    // -------------------------------------------------------------------------
    // TEST 6: Atomic Upsert Merges
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Atomic Upsert Merge Test ---');
    const mergeProjectId = `proj_merge_tx_${Date.now()}`;
    await supabaseDb.saveProject({
      id: mergeProjectId,
      title: 'Merge Tx Test Project',
      raw_script: 'Script',
      total_duration_target_sec: 60,
      max_scene_shot_duration_sec: null,
      prompt_language: 'en',
      image_model: 'nano_banana_pro',
      video_model: ['veo'],
      include_seedance_format: false,
      status: 'draft',
      created_at: now,
      updated_at: now,
    });

    const mergedChars = await supabaseDb.saveAndMergeCharacters(mergeProjectId, [
      { name: 'Alice', role: 'Protagonist' } as any,
      { name: 'Bob', role: 'Antagonist' } as any,
    ]);
    assert(mergedChars.length === 2, 'saveAndMergeCharacters Atomic Upsert Executed');

    // Cleanup merge project
    await supabaseDb.deleteProject(mergeProjectId);

    console.log('\n================================================================');
    console.log(`PHASE 3.1 SUITE COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('================================================================\n');

    return failedCount === 0;
  } catch (err: any) {
    console.error('❌ Phase 3.1 Transaction Suite Unexpected Exception:', err);
    return false;
  }
}

// Allow CLI execution directly
if (process.argv[1] && process.argv[1].includes('supabase_phase3_1_tests')) {
  runPhase31TransactionSuite().then(success => {
    process.exit(success ? 0 : 1);
  });
}
