import { ProductionJob } from './production_planner';

export class JobGraph {
  private jobs: Map<string, ProductionJob> = new Map();

  constructor(jobs: ProductionJob[]) {
    for (const job of jobs) {
      this.jobs.set(job.jobId, job);
    }
  }

  getJob(jobId: string): ProductionJob | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): ProductionJob[] {
    return Array.from(this.jobs.values());
  }

  updateJobStatus(jobId: string, status: ProductionJob['status'], result?: any, error?: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = status;
      job.updatedAt = Date.now();
      if (result !== undefined) job.result = result;
      if (error !== undefined) job.error = error;
    }
  }

  getReadyJobs(): ProductionJob[] {
    const ready: ProductionJob[] = [];
    for (const job of this.jobs.values()) {
      if (job.status === 'PENDING') {
        // Check if all dependencies are completed
        const depsMet = job.dependencies.every(depId => {
          const depJob = this.jobs.get(depId);
          return depJob && depJob.status === 'COMPLETED';
        });
        if (depsMet) {
          ready.push(job);
        }
      }
    }
    // Sort by priority (ascending: 1 is highest priority)
    return ready.sort((a, b) => a.priority - b.priority);
  }

  isFinished(): boolean {
    for (const job of this.jobs.values()) {
      if (job.status !== 'COMPLETED' && job.status !== 'FAILED') {
        return false;
      }
    }
    return true;
  }

  getProgressStats(): { total: number; completed: number; failed: number; running: number; pending: number } {
    let total = 0, completed = 0, failed = 0, running = 0, pending = 0;
    for (const job of this.jobs.values()) {
      total++;
      if (job.status === 'COMPLETED') completed++;
      else if (job.status === 'FAILED') failed++;
      else if (job.status === 'RUNNING' || job.status === 'RETRYING') running++;
      else if (job.status === 'PENDING') pending++;
    }
    return { total, completed, failed, running, pending };
  }
}
