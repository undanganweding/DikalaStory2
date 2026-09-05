import { db } from '../server/db';
import { resolveStageModel, stoppedProjects } from '../server/orchestrator';
import { quotaRouter } from '../server/ai_infrastructure/quota_router';
import { healthService } from '../server/ai_infrastructure/health_service';

async function runBenchmark() {
  const projectId = 'gap_bench_' + Date.now();
  console.log('=== STARTING S1 -> S2 TRANSITION BENCHMARK ===');
  console.log('Target Project ID:', projectId);

  // Pre-seed project to measure realistic database update
  await db.saveProject({
    id: projectId,
    title: 'Benchmark Project',
    raw_script: 'A cinematic scene test script.',
    status: 'processing',
    current_stage: 1,
  } as any);

  // 1. saveProjectFoundation
  const t0 = performance.now();
  await db.saveProjectFoundation({
    project_id: projectId,
    era: '1980s',
    theme: 'Cyberpunk',
    genre: 'Sci-Fi Noir',
    main_characters: ['K', 'Deckard'],
  } as any);
  const durSaveFoundation = performance.now() - t0;

  // 2. success log (addLog S1 complete)
  const t1 = performance.now();
  await db.addLog(projectId, {
    stage: 1,
    stage_name: 'Story Understanding',
    stage_code: 'S1',
    scope: 'project',
    message: 'S1 Completed successfully',
    level: 'success',
    duration_ms: 2500,
  });
  const durSuccessLog = performance.now() - t1;

  // 3. stop check
  const t2 = performance.now();
  const isStopped = stoppedProjects.has(projectId);
  const durStopCheck = performance.now() - t2;

  // 4. getProject
  const t3 = performance.now();
  const project = await db.getProject(projectId);
  const durGetProject = performance.now() - t3;

  // 5. saveProject(current_stage=2)
  const t4 = performance.now();
  await db.saveProject({
    ...(project || {}),
    current_stage: 2,
  } as any);
  const durSaveProjectS2 = performance.now() - t4;

  // 6. resolveStageModel(S2)
  const t5 = performance.now();
  const selectedModelId = await resolveStageModel('S2', 'narrative', 'MEDIUM');
  const durResolveStageModel = performance.now() - t5;

  // 7. credential resolution
  const t6 = performance.now();
  const credSelection = await quotaRouter.selectCredential('google');
  const durCredResolution = performance.now() - t6;

  // 8. health resolution
  const t7 = performance.now();
  const health = await healthService.getHealth(credSelection.credentialId);
  const durHealthResolution = performance.now() - t7;

  // 9. S2 start log
  const t8 = performance.now();
  await db.addLog(projectId, {
    stage: 2,
    stage_name: 'Character Detection',
    stage_code: 'S2',
    scope: 'project',
    message: `Mendeteksi profil karakter... [Model: ${selectedModelId}]`,
    level: 'info',
  });
  const durS2StartLog = performance.now() - t8;

  const totalTransitionMs =
    durSaveFoundation +
    durSuccessLog +
    durStopCheck +
    durGetProject +
    durSaveProjectS2 +
    durResolveStageModel +
    durS2StartLog;

  console.log('\n===============================================================');
  console.log('RESULTS: S1 -> S2 TRANSITION LATENCY BREAKDOWN');
  console.log('===============================================================');
  console.log(`1. saveProjectFoundation:        ${durSaveFoundation.toFixed(2)} ms`);
  console.log(`2. success log (addLog S1):      ${durSuccessLog.toFixed(2)} ms`);
  console.log(`3. stop check:                   ${durStopCheck.toFixed(4)} ms`);
  console.log(`4. getProject:                   ${durGetProject.toFixed(2)} ms`);
  console.log(`5. saveProject(current_stage=2): ${durSaveProjectS2.toFixed(2)} ms`);
  console.log(`6. resolveStageModel(S2):        ${durResolveStageModel.toFixed(2)} ms (Model: ${selectedModelId})`);
  console.log(`7. credential resolution:        ${durCredResolution.toFixed(2)} ms (Cred: ${credSelection.credentialId})`);
  console.log(`8. health resolution:            ${durHealthResolution.toFixed(2)} ms (Status: ${health.status})`);
  console.log(`9. S2 start log (addLog S2):     ${durS2StartLog.toFixed(2)} ms`);
  console.log('---------------------------------------------------------------');
  console.log(`TOTAL S1->S2 TRANSITION TIME:    ${totalTransitionMs.toFixed(2)} ms (${(totalTransitionMs / 1000).toFixed(3)} s)`);
  console.log('===============================================================\n');

  // Clean up
  try {
    await db.deleteProject(projectId);
  } catch {}
}

runBenchmark().catch(err => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
