export interface ProductionJob {
  jobId: string;
  projectId: string;
  episodeId: string;
  sceneId: string;
  shotId?: string;
  type: 'RESEARCH' | 'STORY_ANALYSIS' | 'DIRECTOR_PLAN' | 'STORYBOARD' | 'PROMPT_COMPILE' | 'RENDER_GENERATION' | 'QUALITY_CONTROL';
  priority: number; // 1 (Highest) to 10 (Lowest)
  status: 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING';
  dependencies: string[]; // jobIds that must complete first
  retries: number;
  maxRetries: number;
  payload: Record<string, any>;
  result?: any;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export const productionPlanner = {
  planEpisodeJobs(projectId: string, episodeId: string, scenes: { sceneId: string; title: string; shots: string[] }[]): ProductionJob[] {
    const jobs: ProductionJob[] = [];
    const now = Date.now();

    // 1. Global Research & Story Analysis Job
    const prepJobId = `job_${episodeId}_prep`;
    jobs.push({
      jobId: prepJobId,
      projectId,
      episodeId,
      sceneId: 'GLOBAL',
      type: 'RESEARCH',
      priority: 1,
      status: 'PENDING',
      dependencies: [],
      retries: 0,
      maxRetries: 3,
      payload: { episodeId },
      createdAt: now,
      updatedAt: now,
    });

    // 2. Scene & Shot jobs
    for (const scene of scenes) {
      const sceneJobId = `job_${episodeId}_${scene.sceneId}`;
      jobs.push({
        jobId: sceneJobId,
        projectId,
        episodeId,
        sceneId: scene.sceneId,
        type: 'DIRECTOR_PLAN',
        priority: 2,
        status: 'PENDING',
        dependencies: [prepJobId],
        retries: 0,
        maxRetries: 3,
        payload: { sceneTitle: scene.title },
        createdAt: now,
        updatedAt: now,
      });

      for (const shotId of scene.shots) {
        const shotJobId = `job_${episodeId}_${scene.sceneId}_${shotId}`;
        jobs.push({
          jobId: shotJobId,
          projectId,
          episodeId,
          sceneId: scene.sceneId,
          shotId,
          type: 'RENDER_GENERATION',
          priority: 3,
          status: 'PENDING',
          dependencies: [sceneJobId],
          retries: 0,
          maxRetries: 3,
          payload: { shotId },
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return jobs;
  },
};
