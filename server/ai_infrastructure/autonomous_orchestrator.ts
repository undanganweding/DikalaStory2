import { productionPlanner } from './production_planner';
import { JobGraph } from './job_graph';
import { executionQueue, ExecutionReport } from './execution_queue';

export const autonomousOrchestrator = {
  async runEpisodeProduction(
    projectId: string,
    episodeId: string,
    scenes: { sceneId: string; title: string; shots: string[] }[]
  ): Promise<ExecutionReport> {
    // 1. Plan episode jobs
    const jobs = productionPlanner.planEpisodeJobs(projectId, episodeId, scenes);

    // 2. Build Job Graph
    const graph = new JobGraph(jobs);

    // 3. Execute through Execution Queue
    const report = await executionQueue.executeGraph(projectId, episodeId, graph);

    return report;
  },
};
