import { productionContextManager, ProductionState } from './production_context';
import { agentRuntime } from './agent_runtime';

export const productionBridge = {
  async createScenePlan(projectId: string, sceneData: { sceneNumber: number; title: string; setting: string; mood: string; beats: string[] }): Promise<ProductionState> {
    return productionContextManager.updateProductionState(projectId, state => {
      const sceneId = `scene_${sceneData.sceneNumber}`;
      state.sceneState[sceneId] = sceneData;
    });
  },

  async analyzeCharacter(projectId: string, charData: { id: string; name: string; age: number; era: string; visualLock: string; traits: string[] }): Promise<ProductionState> {
    return productionContextManager.updateProductionState(projectId, state => {
      state.characterState[charData.id] = charData;
      state.assetState[`asset_char_${charData.id}`] = {
        assetId: `asset_char_${charData.id}`,
        type: 'CHARACTER',
        status: 'READY',
      };
    });
  },

  async buildShotPlan(projectId: string, shotData: { shotId: string; sceneId: string; cameraAngle: string; lightingTone: string; blockingNotes: string }): Promise<ProductionState> {
    return productionContextManager.updateProductionState(projectId, state => {
      state.shotState[shotData.shotId] = shotData;
    });
  },

  async compilePrompt(projectId: string, shotId: string): Promise<{ imagePrompt: string; videoPrompt: string; negativePrompt: string }> {
    const state = await productionContextManager.getOrCreateProductionState(projectId);
    const shot = state.shotState[shotId];
    const setting = Object.values(state.sceneState)[0]?.setting || 'cinematic setting';
    const era = Object.values(state.characterState)[0]?.era || 'historical era';

    const imagePrompt = `Cinematic 8k resolution shot, ${shot?.cameraAngle || 'medium shot'}, ${setting}, ${era}, ${shot?.lightingTone || 'dramatic lighting'}, highly detailed, masterwork`;
    const videoPrompt = `Cinematic motion, camera slowly panning, ${shot?.blockingNotes || 'actors moving naturally'}, high fidelity film grain`;
    const negativePrompt = `modern cars, smartphones, plastic, low quality, distortion, artifacts`;

    return {
      imagePrompt,
      videoPrompt,
      negativePrompt,
    };
  },

  async executeDirectorBlueprint(projectId: string, rawStory: string): Promise<{ blueprint: any; state: ProductionState }> {
    // 1. Run Research Agent
    const researchRes = await agentRuntime.executeAgent({
      agentId: 'research_agent',
      task: 'historical_grounding',
      prompt: `Research and fact-check historical context and key figures for: ${rawStory}`,
      projectId,
    });

    // 2. Run Story Analyst
    const analysisRes = await agentRuntime.executeAgent({
      agentId: 'story_analyzer',
      task: 'thematic_breakdown',
      prompt: `Analyze themes and structure for: ${rawStory}. Research context: ${researchRes.text}`,
      projectId,
    });

    // 3. Run Film Director Agent
    const directorRes = await agentRuntime.executeAgent({
      agentId: 'film_director',
      task: 'cinematic_direction',
      prompt: `Create a complete cinematic production blueprint (scenes, character blocks, and visual tone) based on story: ${rawStory} and analysis: ${analysisRes.text}`,
      projectId,
    });

    const blueprint = {
      story: rawStory,
      research: researchRes.text,
      analysis: analysisRes.text,
      directorDirection: directorRes.text,
      timestamp: Date.now(),
    };

    // Update state
    const state = await productionContextManager.updateProductionState(projectId, s => {
      s.storyState.rawStory = rawStory;
      s.storyState.logline = `Cinematic adaptation of: ${rawStory.substring(0, 80)}...`;
    });

    return {
      blueprint,
      state,
    };
  },
};
