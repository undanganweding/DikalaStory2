import { jobMonitor } from './job_monitor';
import { costMonitor } from './cost_monitor';

export interface PipelineAnalyticsReport {
  projectId: string;
  episodeId: string;
  progressPercentage: number;
  bottleneck: string;
  etaMinutes: number;
  costSummary: { totalCostUsd: number; totalTokens: number };
  healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

export const pipelineAnalytics = {
  async analyzePipeline(projectId: string, episodeId: string): Promise<PipelineAnalyticsReport> {
    const jobStatus = await jobMonitor.getJobStatus(projectId, episodeId);
    const costSummary = await costMonitor.getTotalCost(projectId, episodeId);

    const total = jobStatus.totalJobs || 1;
    const completed = jobStatus.completedJobs;
    const progressPercentage = Math.round((completed / total) * 100);

    // Identify bottleneck
    let bottleneck = 'None (Pipeline running smoothly)';
    if (jobStatus.failedJobs > 0) {
      const failedJob = jobStatus.jobs.find(j => j.status === 'FAILED');
      bottleneck = `Failed Job in Scene ${failedJob?.sceneId || 'Unknown'} (${failedJob?.type || 'General'})`;
    } else if (jobStatus.runningJobs > 0) {
      const runningJob = jobStatus.jobs.find(j => j.status === 'RUNNING');
      bottleneck = `Active Rendering: Scene ${runningJob?.sceneId || 'Unknown'} / Shot ${runningJob?.shotId || 'Prep'}`;
    }

    // Estimate ETA (assume ~2 mins per remaining job)
    const remainingJobs = jobStatus.pendingJobs + jobStatus.runningJobs + jobStatus.retryingJobs;
    const etaMinutes = remainingJobs * 2;

    let healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    if (jobStatus.failedJobs > 5) healthStatus = 'CRITICAL';
    else if (jobStatus.failedJobs > 0 || jobStatus.retryingJobs > 2) healthStatus = 'WARNING';

    return {
      projectId,
      episodeId,
      progressPercentage,
      bottleneck,
      etaMinutes,
      costSummary,
      healthStatus,
    };
  },
};
