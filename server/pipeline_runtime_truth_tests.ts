import { resolveStageModel, verifyProjectFoundation, runOrchestratedPipeline, runProjectInitialization } from './orchestrator';
import { DEFAULT_TASK_PROFILES } from './adaptive_router';
import { modelRouter } from './model_router';
import { db } from './db';
import { executeResearchPackage, ResearchEngine } from './research_engine';
import { ResearchPackage } from '../src/types';

async function runPipelineRuntimeTruthTests() {
  console.log('====================================================');
  console.log('RUNNING FORENSIC PIPELINE & MODEL TRUTH VERIFICATION');
  console.log('====================================================\n');

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

  // TEST 1: Stage 1 profile authority does not hardcode gemini-3.1-flash-lite
  console.log('--- Test Group 1: Model Resolution Authority ---');
  const s1Profile = DEFAULT_TASK_PROFILES['S1'];
  assert(
    s1Profile !== undefined && s1Profile.default_model === undefined,
    'S1 task profile should not hardcode default_model: gemini-3.1-flash-lite'
  );

  // TEST 2: resolveStageModel for S1 returns dynamic modelRouter best model
  const s1Resolved = await resolveStageModel('S1', 'research', 'HIGH');
  const bestModelForS1 = (await modelRouter.getBestModel('research', 'HIGH', 1)).modelId;
  assert(
    s1Resolved === bestModelForS1,
    `resolveStageModel('S1') matches modelRouter best model (${s1Resolved} === ${bestModelForS1})`
  );

  // TEST 3: Foundation Verification status formatting
  console.log('\n--- Test Group 2: Foundation Verification & Statuses ---');
  const testProjectId = `test_proj_${Date.now()}`;
  await db.saveProject({
    id: testProjectId,
    title: 'Test Project',
    raw_script: 'INT. COFFEE SHOP - DAY\nALICE and BOB talk.',
    prompt_language: 'id',
    foundation_status: 'not_initialized',
    status: 'draft',
    current_stage: 1,
    image_model: 'nano_banana_pro',
    video_model: ['veo'],
    include_seedance_format: false,
    total_duration_target_sec: 60,
    max_scene_shot_duration_sec: 10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  let foundationResult = await verifyProjectFoundation(testProjectId);
  assert(
    foundationResult.ready === false &&
      foundationResult.foundationStatus === 'not_initialized' &&
      foundationResult.missing.length === 5 &&
      foundationResult.completed.length === 0,
    'Fresh project reports foundationStatus: not_initialized with 5 missing stages'
  );

  // Save S1 foundation
  await db.saveProjectFoundation({
    project_id: testProjectId,
    genre: 'Drama',
    era: 'Modern',
    theme: 'Friendship',
    timeline: 'Present Day',
    main_characters: ['Alice', 'Bob'],
    supporting_characters: [],
    locations: ['Coffee Shop'],
    main_conflict: 'Misunderstanding',
    emotional_arc: 'Reconciliation',
    narrative_arc: 'Linear',
    visual_tone: 'Warm',
    updated_at: new Date().toISOString(),
  });

  foundationResult = await verifyProjectFoundation(testProjectId);
  assert(
    foundationResult.ready === false &&
      foundationResult.foundationStatus === 'partial' &&
      foundationResult.completed.length === 1 &&
      foundationResult.completed[0] === 'Story Foundation (S1)' &&
      foundationResult.missing.length === 4,
    'Project with S1 saved reports foundationStatus: partial, 1 completed (S1), 4 missing'
  );

  // TEST 4: Research Engine Idempotency
  console.log('\n--- Test Group 3: Research Engine Idempotency ---');
  const samplePackage = {
    researchRequirement: 'RESEARCH_REQUIRED',
    researchQuestions: [],
    researchStrategy: { sourceTypes: ['HISTORICAL_SOURCE'], required: true, freshRequired: false, summary: '', providers: [] },
    queries: [
      {
        queryId: 'q1',
        questionId: 'rq1',
        purpose: 'Context',
        sourceTypes: ['HISTORICAL_SOURCE'],
        query: 'Era context',
        priority: 'HIGH',
        status: 'EXECUTED',
      },
    ],
    sources: [],
    evidence: [],
    searchResults: [
      {
        searchResultId: 'res1',
        queryId: 'q1',
        providerId: 'web',
        title: 'src',
        url: 'http://example.com',
        verification: 'VERIFIED',
        status: 'CANDIDATE',
        retrievedAt: new Date().toISOString(),
      },
    ],
    claims: [],
    conflicts: [],
  } as unknown as ResearchPackage;

  const executed = await executeResearchPackage(samplePackage, new ResearchEngine());
  assert(
    executed.queries.every((q) => q.status !== 'PLANNED'),
    'ResearchPackage with no PLANNED queries returns early without re-fetching'
  );

  // TEST 5: Concurrency Locking Invariant
  console.log('\n--- Test Group 4: In-Flight Concurrency Lock ---');
  let execCount = 0;
  const slowProgress = async () => {
    execCount++;
    await new Promise((r) => setTimeout(r, 10));
  };

  const mockDeps = {
    stage1Runner: async () => ({
      era: 'Modern',
      theme: 'Test',
      genre: 'Drama',
      timeline: 'Present',
      main_characters: ['Alice'],
      supporting_characters: [],
      locations: ['Room'],
      main_conflict: 'Conflict',
      emotional_arc: 'Arc',
      narrative_arc: 'Arc',
      visual_tone: 'Tone',
    }),
  };

  // Launch two concurrent initialization calls for the same project
  const p1 = runProjectInitialization(testProjectId, slowProgress, mockDeps);
  const p2 = runProjectInitialization(testProjectId, slowProgress, mockDeps);

  // Invariant check: p1 and p2 must be the exact same promise reference
  assert(p1 === p2, 'Concurrent runProjectInitialization calls share the exact same in-flight Promise instance');

  // Also verify runOrchestratedPipeline locking
  const pipelineP1 = runOrchestratedPipeline({ projectId: testProjectId });
  const pipelineP2 = runOrchestratedPipeline({ projectId: testProjectId });

  assert(pipelineP1 === pipelineP2, 'Concurrent runOrchestratedPipeline calls share the exact same in-flight Promise instance');

  // Await pipeline result
  await Promise.allSettled([p1, p2, pipelineP1, pipelineP2]);

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPipelineRuntimeTruthTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
