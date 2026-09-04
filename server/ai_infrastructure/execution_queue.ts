import { JobGraph } from './job_graph';
import { ProductionJob } from './production_planner';
import { pipelineGate } from './pipeline_gate';

export interface ExecutionReport {
  episodeId: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  stats: { total: number; completed: number; failed: number };
  jobLogs: { jobId: string; type: string; status: string; error?: string }[];
}

export const executionQueue = {
  async executeGraph(projectId: string, episodeId: string, graph: JobGraph): Promise<ExecutionReport> {
    const jobLogs: { jobId: string; type: string; status: string; error?: string }[] = [];

    while (!graph.isFinished()) {
      const readyJobs = graph.getReadyJobs();

      if (readyJobs.length === 0) {
        // Deadlock or unresolvable failed dependencies
        break;
      }

      // Execute ready jobs (can be parallelized or sequential)
      for (const job of readyJobs) {
        graph.updateJobStatus(job.jobId, 'RUNNING');

        try {
          // Check pipeline gate for render jobs
          if (job.type === 'RENDER_GENERATION') {
            const gate = await pipelineGate.evaluateAndGate(projectId, {
              prompt: `Cinematic shot for scene ${job.sceneId}, shot ${job.shotId}`,
              negativePrompt: 'low quality, artifacts',
              durationSec: 10,
              fps: 24,
              resolution: '1080p',
            });

            if (!gate.allowed) {
              throw new Error(`Pipeline Gate Blocked: ${gate.reason}`);
            }
          }

          // Simulate job execution success
          await new Promise(resolve => setTimeout(resolve, 50));
          graph.updateJobStatus(job.jobId, 'COMPLETED', { success: true });
          jobLogs.push({ jobId: job.jobId, type: job.type, status: 'COMPLETED' });
        } catch (err: any) {
          job.retries++;
          if (job.retries <= job.maxRetries) {
            graph.updateJobStatus(job.jobId, 'RETRYING', undefined, err.message);
            // Reset to pending for retry
            setTimeout(() => graph.updateJobStatus(job.jobId, 'PENDING'), 100);
          } else {
            graph.updateJobStatus(job.jobId, 'FAILED', undefined, err.message);
            jobLogs.push({ jobId: job.jobId, type: job.type, status: 'FAILED', error: err.message });
          }
        }
      }
    }

    const stats = graph.getProgressStats();
    let status: 'SUCCESS' | 'PARTIAL' | 'FAILED' = 'SUCCESS';
    if (stats.failed > 0 && stats.completed > 0) status = 'PARTIAL';
    else if (stats.failed === stats.total) status = 'FAILED';

    return {
      episodeId,
      status,
      stats: { total: stats.total, completed: stats.completed, failed: stats.failed },
      jobLogs,
    };
  },
};
