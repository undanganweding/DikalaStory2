import { ProductionJob } from './production_planner';

export interface JobMonitorStatus {
  totalJobs: number;
  completedJobs: number;
  runningJobs: number;
  failedJobs: number;
  pendingJobs: number;
  retryingJobs: number;
  jobs: ProductionJob[];
}

const jobRegistry: Map<string, ProductionJob[]> = new Map();

export const jobMonitor = {
  async registerJobs(projectId: string, episodeId: string, jobs: ProductionJob[]): Promise<void> {
    const key = `${projectId}:${episodeId}`;
    jobRegistry.set(key, jobs);
  },

  async updateJob(projectId: string, episodeId: string, jobId: string, status: ProductionJob['status'], error?: string): Promise<void> {
    const key = `${projectId}:${episodeId}`;
    const jobs = jobRegistry.get(key) || [];
    const job = jobs.find(j => j.jobId === jobId);
    if (job) {
      job.status = status;
      job.updatedAt = Date.now();
      if (error) job.error = error;
    }
  },

  async getJobStatus(projectId: string, episodeId: string): Promise<JobMonitorStatus> {
    const key = `${projectId}:${episodeId}`;
    const jobs = jobRegistry.get(key) || [];

    let completed = 0, running = 0, failed = 0, pending = 0, retrying = 0;
    for (const j of jobs) {
      if (j.status === 'COMPLETED') completed++;
      else if (j.status === 'RUNNING') running++;
      else if (j.status === 'FAILED') failed++;
      else if (j.status === 'PENDING') pending++;
      else if (j.status === 'RETRYING') retrying++;
    }

    return {
      totalJobs: jobs.length,
      completedJobs: completed,
      runningJobs: running,
      failedJobs: failed,
      pendingJobs: pending,
      retryingJobs: retrying,
      jobs,
    };
  },
};
