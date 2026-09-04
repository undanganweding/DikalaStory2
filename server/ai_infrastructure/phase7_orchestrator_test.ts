import { productionPlanner } from './production_planner';
import { JobGraph } from './job_graph';
import { autonomousOrchestrator } from './autonomous_orchestrator';
import { productionContextManager } from './production_context';
import { assetIntelligence } from './asset_intelligence';

async function runPhase7Tests() {
  console.log('Running Phase 7 Autonomous Production Orchestrator Tests...');

  const projectId = 'proj_phase7_test_01';
  const episodeId = 'ep_01';

  await productionContextManager.getOrCreateProductionState(projectId, 'The Epic Arabia Era');

  // Populate required assets so pipeline gate passes
  await productionContextManager.updateProductionState(projectId, state => {
    state.characterState['char_test'] = {
      name: 'Test Hero',
      age: 30,
      era: '6th Century',
      visualLock: 'lock_hero_01',
      traits: ['Brave'],
    };
    state.sceneState['scene_1'] = {
      sceneNumber: 1,
      title: 'Desert Arrival',
      setting: 'Desert',
      mood: 'Epic',
      beats: ['Arrival'],
    };
  });

  await assetIntelligence.registerAsset({
    assetId: 'asset_char_char_test',
    projectId,
    name: 'Hero Master Frame',
    type: 'MASTER_FRAME',
    status: 'READY',
    metadata: {},
  });

  // 1. Test Production Planner
  const scenes = [
    { sceneId: 'scene_1', title: 'Desert Arrival', shots: ['shot_01', 'shot_02'] },
    { sceneId: 'scene_2', title: 'Oasis Meeting', shots: ['shot_01'] },
  ];

  const jobs = productionPlanner.planEpisodeJobs(projectId, episodeId, scenes);
  if (jobs.length !== 6) { // 1 prep + 2 scenes + 3 shots
    throw new Error(`Test Failed: Expected 6 planned jobs, got ${jobs.length}`);
  }
  console.log(`✅ 1. Production Planner successfully planned ${jobs.length} jobs.`);

  // 2. Test Job Graph & Ready queue
  const graph = new JobGraph(jobs);
  const readyJobs = graph.getReadyJobs();
  if (readyJobs.length !== 1 || readyJobs[0].type !== 'RESEARCH') {
    throw new Error('Test Failed: Job graph initial ready jobs incorrect');
  }
  console.log('✅ 2. Job Graph correctly prioritized initial prep job.');

  // 3. Test Autonomous Orchestrator Execution
  const report = await autonomousOrchestrator.runEpisodeProduction(projectId, episodeId, scenes);
  console.log('Autonomous Orchestration Report:', report);

  if (report.stats.total !== 6) {
    throw new Error('Test Failed: Orchestration report total jobs mismatch');
  }
  console.log('✅ 3. Autonomous Orchestrator executed episode production queue successfully.');

  console.log('🎉 All Phase 7 Autonomous Production Orchestrator tests passed successfully!');
}

runPhase7Tests().catch(err => {
  console.error('❌ Phase 7 Test Error:', err);
  process.exit(1);
});
