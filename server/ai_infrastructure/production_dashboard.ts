import { pipelineAnalytics, PipelineAnalyticsReport } from './pipeline_analytics';
import { jobMonitor, JobMonitorStatus } from './job_monitor';
import { costMonitor } from './cost_monitor';

export interface DashboardMissionControl {
  analytics: PipelineAnalyticsReport;
  jobStatus: JobMonitorStatus;
  asciiProgressBar: string;
}

export const productionDashboard = {
  async getMissionControlData(projectId: string, episodeId: string): Promise<DashboardMissionControl> {
    const analytics = await pipelineAnalytics.analyzePipeline(projectId, episodeId);
    const jobStatus = await jobMonitor.getJobStatus(projectId, episodeId);

    // Build ASCII progress bar (10 blocks)
    const filledBlocks = Math.round((analytics.progressPercentage / 100) * 10);
    const emptyBlocks = 10 - filledBlocks;
    const asciiProgressBar = `[${'█'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)}] ${analytics.progressPercentage}%`;

    return {
      analytics,
      jobStatus,
      asciiProgressBar,
    };
  },
};
