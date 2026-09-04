import { productionPlanner } from './production_planner';
import { jobMonitor } from './job_monitor';
import { costMonitor } from './cost_monitor';
import { pipelineAnalytics } from './pipeline_analytics';
import { productionDashboard } from './production_dashboard';

async function runPhase8Tests() {
  console.log('Running Phase 8 Production Command Center & Intelligence Dashboard Tests...');

  const projectId = 'proj_phase8_test_01';
  const episodeId = 'ep_08';

  // 1. Plan and register jobs
  const scenes = [
    { sceneId: 'scene_01', title: 'Arrival', shots: ['shot_1', 'shot_2'] },
    { sceneId: 'scene_02', title: 'Council', shots: ['shot_1'] },
  ];
  const jobs = productionPlanner.planEpisodeJobs(projectId, episodeId, scenes);
  await jobMonitor.registerJobs(projectId, episodeId, jobs);

  // Complete some jobs
  await jobMonitor.updateJob(projectId, episodeId, jobs[0].jobId, 'COMPLETED');
  await jobMonitor.updateJob(projectId, episodeId, jobs[1].jobId, 'COMPLETED');
  await jobMonitor.updateJob(projectId, episodeId, jobs[2].jobId, 'RUNNING');

  console.log('✅ 1. Jobs registered and status updated successfully.');

  // 2. Record cost usage
  await costMonitor.recordUsage(projectId, episodeId, 'gemini-3.5-flash-lite', 1500, 450);
  await costMonitor.recordUsage(projectId, episodeId, 'gemini-3.5-flash-lite', 2000, 600);
  const costReport = await costMonitor.getTotalCost(projectId, episodeId);
  console.log('Cost Report:', costReport);
  if (costReport.recordsCount !== 2 || costReport.totalCostUsd <= 0) {
    throw new Error('Test Failed: Cost monitor failed to calculate usage');
  }
  console.log('✅ 2. Cost Monitor tracking verified.');

  // 3. Pipeline Analytics
  const analytics = await pipelineAnalytics.analyzePipeline(projectId, episodeId);
  console.log('Pipeline Analytics:', analytics);
  if (analytics.progressPercentage <= 0) {
    throw new Error('Test Failed: Pipeline analytics progress percentage invalid');
  }
  console.log('✅ 3. Pipeline Analytics computed successfully.');

  // 4. Production Dashboard Mission Control
  const missionControl = await productionDashboard.getMissionControlData(projectId, episodeId);
  console.log('Mission Control ASCII Bar:', missionControl.asciiProgressBar);
  console.log('Mission Control Bottleneck:', missionControl.analytics.bottleneck);
  console.log('Mission Control ETA:', missionControl.analytics.etaMinutes, 'minutes');

  if (!missionControl.asciiProgressBar.includes('%')) {
    throw new Error('Test Failed: Dashboard ASCII progress bar malformed');
  }
  console.log('✅ 4. Production Dashboard Mission Control data verified.');

  console.log('🎉 All Phase 8 Production Command Center & Intelligence Dashboard tests passed successfully!');
}

runPhase8Tests().catch(err => {
  console.error('❌ Phase 8 Test Error:', err);
  process.exit(1);
});
