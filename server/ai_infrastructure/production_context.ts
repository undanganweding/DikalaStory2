export interface ProductionState {
  projectId: string;
  storyState: {
    rawStory: string;
    themes: string[];
    logline: string;
  };
  characterState: Record<string, {
    name: string;
    age: number;
    era: string;
    visualLock: string;
    traits: string[];
  }>;
  sceneState: Record<string, {
    sceneNumber: number;
    title: string;
    setting: string;
    mood: string;
    beats: string[];
  }>;
  shotState: Record<string, {
    shotId: string;
    sceneId: string;
    cameraAngle: string;
    lightingTone: string;
    blockingNotes: string;
  }>;
  assetState: Record<string, {
    assetId: string;
    type: 'CHARACTER' | 'LOCATION' | 'PROPS' | 'STORYBOARD';
    referenceUrl?: string;
    status: 'READY' | 'PENDING' | 'RENDERING';
  }>;
  generationState: {
    queueLength: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
  };
}

const projectProductionStates: Map<string, ProductionState> = new Map();

export const productionContextManager = {
  async getOrCreateProductionState(projectId: string, initialStory?: string): Promise<ProductionState> {
    let state = projectProductionStates.get(projectId);
    if (!state) {
      state = {
        projectId,
        storyState: {
          rawStory: initialStory || '',
          themes: [],
          logline: '',
        },
        characterState: {},
        sceneState: {},
        shotState: {},
        assetState: {},
        generationState: {
          queueLength: 0,
          activeJobs: 0,
          completedJobs: 0,
          failedJobs: 0,
        },
      };
      projectProductionStates.set(projectId, state);
    }
    return state;
  },

  async updateProductionState(projectId: string, updater: (state: ProductionState) => void): Promise<ProductionState> {
    const state = await this.getOrCreateProductionState(projectId);
    updater(state);
    projectProductionStates.set(projectId, state);
    return state;
  },
};
