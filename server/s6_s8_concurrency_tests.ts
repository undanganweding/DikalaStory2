import { db } from './db';
import {
  generateAllScenes,
  runOrchestratedPipeline,
  runPipelineForScene,
  resetPipelineInFlightLocks,
} from './orchestrator';
import { createSceneAssetCoverageReport } from './scene_asset_integrity_engine';

// Enable mock LLM bypass for fast, quota-safe concurrency assertions
process.env.MOCK_LLM = 'true';

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`[PASS] ${name}`);
    passed++;
  } else {
    console.error(`[FAIL] ${name}`);
    failed++;
  }
}

async function setupTestProject(suffix: string) {
  const projectId = `concurrency_test_${suffix}_${Date.now()}`;
  
  // Save test project
  await db.saveProject({
    id: projectId,
    title: `Concurrency Test Project ${suffix}`,
    raw_script: 'Cerita tentang dunia sinema, 60 detik.',
    prompt_language: 'id',
    foundation_status: 'ready',
    status: 'draft',
    current_stage: 5,
    total_duration_target_sec: 60,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as any);

  // Save S2 characters
  await db.saveAndMergeCharacters(projectId, [
    {
      name: 'Alice',
      role_type: 'MAIN',
      description: 'Test Alice description',
    } as any,
  ]);

  // Save S3 locations
  await db.saveAndMergeLocations(projectId, [
    {
      name: 'Coffee Shop',
      description: 'Test Coffee Shop description',
      lighting_condition: 'DAY',
    } as any,
  ]);

  // Save support foundation data to satisfy verification guards
  await db.saveProjectFoundation({
    project_id: projectId,
    genre: 'Drama',
    era: 'Modern',
    theme: 'Technology',
    timeline: 'Present',
    main_characters: ['Alice', 'Bob'],
    supporting_characters: [],
    locations: ['Coffee Shop'],
    objects: [],
    climax: 'Climax point',
    moral_lesson: 'No moral lesson',
    narrative_beats: {
      beginning: 'Beginning beat',
      middle: 'Middle beat',
      climax: 'Climax beat',
      ending: 'Ending beat',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as any);

  // Save continuity snapshots for both scenes to satisfy S8 validation baseline
  await db.saveContinuitySnapshot(projectId, 1, { characters: [], locations: [], objects: [] } as any);
  await db.saveContinuitySnapshot(projectId, 2, { characters: [], locations: [], objects: [] } as any);

  // Save two scenes
  const scenes = await db.saveScenes(projectId, [
    {
      scene_number: 1,
      slug: 'EXT. STREET - DAY',
      description: 'Alice walks down the street.',
      duration_sec: 10,
      visual_quality_target: 'MEDIUM',
      status: 'pending',
      character_names: ['Alice'],
      location_name: 'Coffee Shop',
    } as any,
    {
      scene_number: 2,
      slug: 'INT. COFFEE SHOP - DAY',
      description: 'Alice meets Bob.',
      duration_sec: 15,
      visual_quality_target: 'MEDIUM',
      status: 'pending',
      character_names: ['Alice'],
      location_name: 'Coffee Shop',
    } as any,
  ]);

  return { projectId, scenes };
}

async function runAllTests() {
  console.log('====================================================');
  console.log('SINEMA S6–S8 PIPELINE CONCURRENCY & LOCKING TEST SUITE');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST 1: Single normal S6-S8 generation (generateAllScenes)
  // ----------------------------------------------------
  {
    console.log('--- TEST 1: Single Normal S6–S8 Pipeline Run ---');
    resetPipelineInFlightLocks();
    const { projectId } = await setupTestProject('test1');
    
    // Debug: Manually test createSceneAssetCoverageReport
    const p = await db.getProject(projectId);
    const scs = await db.getScenes(projectId);
    const chars = await db.getCharacters(projectId);
    const locs = await db.getLocations(projectId);
    const objs = await db.getObjects(projectId);
    const r = createSceneAssetCoverageReport(scs[0], chars, locs, objs, p?.contextPackage || null, null);
    console.log('MANUAL ASSET COVERAGE REPORT:', JSON.stringify(r, null, 2));

    try {
      const result = await generateAllScenes(projectId, 2, (stage, stageName, msg, level) => {
        console.log(`[PIPELINE PROGRESS] stage=${stage} name=${stageName} [${level}]: ${msg}`);
      });
      console.log('TEST 1 RESULT:', result);
      
      const scenes = await db.getScenes(projectId);
      for (const s of scenes) {
        const anyS = s as any;
        console.log(`Scene ${anyS.scene_number} slug=${anyS.slug} status=${anyS.status} pipeline_status=${anyS.pipeline_status} error=${anyS.error || ''} blockers=${JSON.stringify(anyS.blockers || [])}`);
      }
      
      assert(result.success === true && result.readyScenes === 2, 'Should process both scenes successfully');
    } catch (err: any) {
      console.error('TEST 1 THREW ERROR:', err);
      assert(false, `Should process both scenes successfully. Got error: ${err.message}`);
    }
  }

  // ----------------------------------------------------
  // TEST 2: Double /generate (Simultaneous)
  // ----------------------------------------------------
  {
    console.log('\n--- TEST 2: Double Orchestrated Pipeline (/generate) ---');
    resetPipelineInFlightLocks();
    const { projectId } = await setupTestProject('test2');
    
    let callCount = 0;
    const oldGenerateAllScenes = generateAllScenes;
    
    // Track execution counts
    const run1Promise = runOrchestratedPipeline({ projectId, sceneConcurrency: 2 });
    const run2Promise = runOrchestratedPipeline({ projectId, sceneConcurrency: 2 });
    
    const [res1, res2] = await Promise.all([run1Promise, run2Promise]);
    assert(res1.success === true && res2.success === true, 'Both calls resolve successfully due to joining');
    assert(res1.runId === res2.runId, 'Both joined calls share the exact same runId');
  }

  // ----------------------------------------------------
  // TEST 3: Double /generate-scenes (Simultaneous)
  // ----------------------------------------------------
  {
    console.log('\n--- TEST 3: Double Scene Generation (/generate-scenes) ---');
    resetPipelineInFlightLocks();
    const { projectId } = await setupTestProject('test3');
    
    const run1Promise = generateAllScenes(projectId, 2);
    const run2Promise = generateAllScenes(projectId, 2);
    
    const [res1, res2] = await Promise.all([run1Promise, run2Promise]);
    assert(res1.success === true && res2.success === true, 'Both concurrent project-wide runs succeed');
    assert(res1.readyScenes === res2.readyScenes, 'Both concurrent project-wide runs returned identical scene results (Joined)');
  }

  // ----------------------------------------------------
  // TEST 4: /generate + /generate-scenes (Simultaneous)
  // ----------------------------------------------------
  {
    console.log('\n--- TEST 4: Simultaneous /generate + /generate-scenes ---');
    resetPipelineInFlightLocks();
    const { projectId } = await setupTestProject('test4');
    
    const run1Promise = runOrchestratedPipeline({ projectId, sceneConcurrency: 2 });
    await delay(10); // Slight stagger so /generate sets locks
    const run2Promise = generateAllScenes(projectId, 2);
    
    const [res1, res2] = await Promise.all([run1Promise, run2Promise]);
    assert(res1.success === true, '/generate runs successfully');
    assert(res2.success === true && res2.readyScenes === 2, '/generate-scenes awaits and joins the orchestrated run');
  }

  // ----------------------------------------------------
  // TEST 5: /generate-scenes + /scenes/:id/run-pipeline (Simultaneous Project + Scene)
  // ----------------------------------------------------
  {
    console.log('\n--- TEST 5: Simultaneous Project-Wide + Single-Scene Pipeline ---');
    resetPipelineInFlightLocks();
    const { projectId, scenes } = await setupTestProject('test5');
    const targetSceneId = scenes[0].id!;
    
    const projectPromise = generateAllScenes(projectId, 2);
    await delay(20); // allow project run to lock
    
    try {
      await runPipelineForScene(targetSceneId);
      assert(false, 'Single-scene request should have been rejected while project-wide run is active');
    } catch (err: any) {
      assert(err.message.includes('Project-wide pipeline is currently running'), 'Successfully rejected single-scene request with: ' + err.message);
    }
    await projectPromise;
  }

  // ----------------------------------------------------
  // TEST 6: Double /scenes/:id/run-pipeline (Same Scene Twice)
  // ----------------------------------------------------
  {
    console.log('\n--- TEST 6: Double Single-Scene Pipeline on Same Scene ---');
    resetPipelineInFlightLocks();
    const { scenes } = await setupTestProject('test6');
    const targetSceneId = scenes[0].id!;
    
    const run1Promise = runPipelineForScene(targetSceneId);
    const run2Promise = runPipelineForScene(targetSceneId);
    
    const [res1, res2] = await Promise.all([run1Promise, run2Promise]);
    assert(res1.success === true && res2.success === true, 'Both pipeline runs on same scene complete successfully (Joined)');
  }

  // ----------------------------------------------------
  // TEST 7: Simultaneous Different Scenes (Allowed & Concurrent)
  // ----------------------------------------------------
  {
    console.log('\n--- TEST 7: Simultaneous Single-Scene Pipeline on Different Scenes ---');
    resetPipelineInFlightLocks();
    const { scenes } = await setupTestProject('test7');
    
    const run1Promise = runPipelineForScene(scenes[0].id!);
    const run2Promise = runPipelineForScene(scenes[1].id!);
    
    const [res1, res2] = await Promise.all([run1Promise, run2Promise]);
    assert(res1.success === true && res2.success === true, 'Both independent scene runs succeed in parallel');
  }

  // ----------------------------------------------------
  // TEST 8: Failure Releases Lock
  // ----------------------------------------------------
  {
    console.log('\n--- TEST 8: S6 Failure correctly releases lock and allows retry ---');
    resetPipelineInFlightLocks();
    const { projectId, scenes } = await setupTestProject('test8');
    
    // Create a scenario where verifyProjectFoundation fails/throws to force failure
    const oldGetProject = db.getProject;
    db.getProject = async (id: string) => {
      if (id === projectId) {
        throw new Error('Forced DB Error for test');
      }
      return oldGetProject(id);
    };
    
    try {
      await generateAllScenes(projectId, 2);
    } catch (err: any) {
      // Expected to fail
    }
    
    // Restore db.getProject
    db.getProject = oldGetProject;
    
    // Check if we can run it again successfully
    const retryResult = await generateAllScenes(projectId, 2);
    assert(retryResult.success === true, 'Lock was correctly cleared after failure; second run succeeded');
  }

  // ----------------------------------------------------
  // SUMMARY REPORT
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`CONCURRENCY TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Unhandled failure in concurrency test suite:', err);
  process.exit(1);
});
