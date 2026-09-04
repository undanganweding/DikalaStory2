import { AITaskDefinition, AITaskId } from '../../src/types';
import { TaskIntentRecommendation } from './intelligence_router';

export const AI_TASKS: Record<AITaskId, AITaskDefinition> = {
  // S1: Script & Story Foundation Understanding
  story_analysis: {
    id: 'story_analysis',
    stageCode: 'S1',
    name: 'Story Understanding & Script Analysis',
    description: 'Deep narrative analysis, cinematic theme extraction, premise parsing, and screenplay understanding.',
    requiredCapabilities: ['text', 'reasoning'],
    preferredTier: 'pro',
    contextRequirement: 'massive',
    minContextWindow: 200000,
    outputFormatRequirement: 'json',
    qualityPriority: 'critical',
    speedPriority: 'normal',
    recommendedFallbackStrategy: 'cross_provider',
  },

  // S2: Character Detection & Character Bible
  character_analysis: {
    id: 'character_analysis',
    stageCode: 'S2',
    name: 'Character Detection & Bible Construction',
    description: 'Entity recognition, psychological profiles, character arc tracking, and visual casting bibles.',
    requiredCapabilities: ['text', 'reasoning'],
    preferredTier: 'pro',
    contextRequirement: 'large',
    minContextWindow: 128000,
    outputFormatRequirement: 'json',
    qualityPriority: 'high',
    speedPriority: 'normal',
    recommendedFallbackStrategy: 'cross_provider',
  },

  // S3: Location & Key Object Detection
  location_object_analysis: {
    id: 'location_object_analysis',
    stageCode: 'S3',
    name: 'Location & Object Detection',
    description: 'Cinematic set identification, atmospheric props, spatial architecture, and location bibles.',
    requiredCapabilities: ['text', 'structured_output'],
    preferredTier: 'pro',
    contextRequirement: 'large',
    minContextWindow: 128000,
    outputFormatRequirement: 'json',
    qualityPriority: 'high',
    speedPriority: 'normal',
    recommendedFallbackStrategy: 'cross_provider',
  },

  // S4: Narrative Structure & 5-Act Plot Mapping
  narrative_structure: {
    id: 'narrative_structure',
    stageCode: 'S4',
    name: '5-Act Narrative Structure Mapping',
    description: 'Pacing curve analysis, tension beat tracking, sequence organization, and dramatic inflection points.',
    requiredCapabilities: ['text', 'reasoning'],
    preferredTier: 'pro',
    contextRequirement: 'large',
    minContextWindow: 128000,
    outputFormatRequirement: 'json',
    qualityPriority: 'critical',
    speedPriority: 'normal',
    recommendedFallbackStrategy: 'cross_provider',
  },

  // S5: Scene Breakdown & Beat Extraction
  scene_breakdown: {
    id: 'scene_breakdown',
    stageCode: 'S5',
    name: 'Scene Breakdown & Dynamic Beat Extraction',
    description: 'Sequential scene decomposition, dramatic beats, emotional shifts, and rigorous structured JSON output.',
    requiredCapabilities: ['text', 'structured_output'],
    preferredTier: 'pro',
    contextRequirement: 'large',
    minContextWindow: 128000,
    outputFormatRequirement: 'structured_schema',
    qualityPriority: 'critical',
    speedPriority: 'normal',
    recommendedFallbackStrategy: 'tier_downgrade',
  },

  // S6: Shot Breakdown & Cinematic Framing
  shot_breakdown: {
    id: 'shot_breakdown',
    stageCode: 'S6',
    name: 'Shot Breakdown & Cinematic Camera Grammar',
    description: 'Cinematic camera grammar, shot composition, lens choice, lighting, and timeline rhythm continuity.',
    requiredCapabilities: ['text', 'structured_output', 'fast'],
    preferredTier: 'pro',
    contextRequirement: 'standard',
    minContextWindow: 64000,
    outputFormatRequirement: 'structured_schema',
    qualityPriority: 'high',
    speedPriority: 'fast',
    recommendedFallbackStrategy: 'tier_downgrade',
  },

  // S7: Master Frame & Visual Generation Prompting
  master_frame_generation: {
    id: 'master_frame_generation',
    stageCode: 'S7',
    name: 'Master Frame & Image Prompt Compiler',
    description: 'Visual stylization, composition prompt engineering, negative prompt curation, and aesthetic fidelity.',
    requiredCapabilities: ['text', 'creative'],
    preferredTier: 'pro',
    contextRequirement: 'standard',
    minContextWindow: 32000,
    outputFormatRequirement: 'json',
    qualityPriority: 'high',
    speedPriority: 'fast',
    recommendedFallbackStrategy: 'tier_downgrade',
  },

  // S8: Video Prompt & Motion Mechanics Compiler
  video_prompt_generation: {
    id: 'video_prompt_generation',
    stageCode: 'S8',
    name: 'Video Prompt & Motion Synthesis Compiler',
    description: 'Temporal dynamics, camera motion verbs, subject kinematics, and cinematic video engine prompting.',
    requiredCapabilities: ['text', 'creative'],
    preferredTier: 'flash',
    contextRequirement: 'standard',
    minContextWindow: 32000,
    outputFormatRequirement: 'json',
    qualityPriority: 'high',
    speedPriority: 'fast',
    recommendedFallbackStrategy: 'tier_downgrade',
  },

  // General fallback reasoning task
  general_reasoning: {
    id: 'general_reasoning',
    stageCode: 'GENERAL',
    name: 'General Cinematic Reasoning',
    description: 'Ad-hoc script questions, project modifications, and unstructured cinematic guidance.',
    requiredCapabilities: ['text'],
    preferredTier: 'flash',
    contextRequirement: 'standard',
    minContextWindow: 32000,
    outputFormatRequirement: 'markdown',
    qualityPriority: 'balanced',
    speedPriority: 'normal',
    recommendedFallbackStrategy: 'tier_downgrade',
  },

  // General creative generation task
  creative_generation: {
    id: 'creative_generation',
    stageCode: 'GENERAL',
    name: 'General Creative Generation',
    description: 'Brainstorming loglines, pitch decks, taglines, and creative story synopses.',
    requiredCapabilities: ['text', 'creative'],
    preferredTier: 'flash',
    contextRequirement: 'standard',
    minContextWindow: 32000,
    outputFormatRequirement: 'creative_text',
    qualityPriority: 'balanced',
    speedPriority: 'fast',
    recommendedFallbackStrategy: 'tier_downgrade',
  },
};

// Stage Code to Task ID mapping
export const STAGE_TO_TASK_MAP: Record<string, AITaskId> = {
  S1: 'story_analysis',
  S2: 'character_analysis',
  S3: 'location_object_analysis',
  S4: 'narrative_structure',
  S5: 'scene_breakdown',
  S6: 'shot_breakdown',
  S7: 'master_frame_generation',
  S8: 'video_prompt_generation',
  STAGE1: 'story_analysis',
  STAGE2: 'character_analysis',
  STAGE3: 'location_object_analysis',
  STAGE4: 'narrative_structure',
  STAGE5: 'scene_breakdown',
  STAGE6: 'shot_breakdown',
  STAGE7: 'master_frame_generation',
  STAGE8: 'video_prompt_generation',
};

export const taskRegistry = {
  /**
   * Retrieves a task definition by taskId or stageCode
   */
  getTask(taskIdOrStage?: string): AITaskDefinition | undefined {
    if (!taskIdOrStage) return undefined;
    const normalized = taskIdOrStage.trim();
    const upper = normalized.toUpperCase();

    // 1. Direct match in STAGE_TO_TASK_MAP
    if (STAGE_TO_TASK_MAP[upper]) {
      return AI_TASKS[STAGE_TO_TASK_MAP[upper]];
    }

    // 2. Direct match in AI_TASKS keys
    const lowerStr = normalized.toLowerCase();
    if (AI_TASKS[lowerStr as AITaskId]) {
      return AI_TASKS[lowerStr as AITaskId];
    }

    // 3. Partial / heuristic / alias matching for cinematic task names
    if (lowerStr === 'story_analysis' || lowerStr.includes('story') || lowerStr.includes('script') || lowerStr.includes('s1')) {
      return AI_TASKS.story_analysis;
    }
    if (lowerStr === 'character_detection' || lowerStr === 'character_analysis' || lowerStr.includes('character') || lowerStr.includes('s2')) {
      return AI_TASKS.character_analysis;
    }
    if (lowerStr === 'location_detection' || lowerStr === 'location_object_analysis' || lowerStr.includes('location') || lowerStr.includes('object') || lowerStr.includes('s3')) {
      return AI_TASKS.location_object_analysis;
    }
    if (lowerStr === 'narrative_structure' || lowerStr.includes('narrative') || lowerStr.includes('structure') || lowerStr.includes('s4')) {
      return AI_TASKS.narrative_structure;
    }
    if (lowerStr === 'scene_breakdown' || lowerStr.includes('scene') || lowerStr.includes('s5')) {
      return AI_TASKS.scene_breakdown;
    }
    if (lowerStr === 'shot_breakdown' || lowerStr.includes('shot') || lowerStr.includes('s6')) {
      return AI_TASKS.shot_breakdown;
    }
    if (lowerStr === 'master_frame' || lowerStr === 'master_frame_generation' || lowerStr.includes('master_frame') || lowerStr.includes('image') || lowerStr.includes('s7')) {
      return AI_TASKS.master_frame_generation;
    }
    if (lowerStr === 'video_prompt' || lowerStr === 'video_prompt_generation' || lowerStr.includes('video') || lowerStr.includes('s8')) {
      return AI_TASKS.video_prompt_generation;
    }

    return undefined;
  },

  /**
   * Retrieves task by standard pipeline stage code (S1-S8)
   */
  getTaskForStage(stageCode: string): AITaskDefinition | undefined {
    const taskId = STAGE_TO_TASK_MAP[stageCode.toUpperCase().trim()];
    return taskId ? AI_TASKS[taskId] : undefined;
  },

  /**
   * Lists all registered AI Tasks
   */
  listTasks(): AITaskDefinition[] {
    return Object.values(AI_TASKS);
  },

  /**
   * Converts a registered task definition to an Intelligence Router TaskIntentRecommendation
   */
  toTaskIntentRecommendation(taskIdOrStage?: string): TaskIntentRecommendation {
    const task = this.getTask(taskIdOrStage);
    if (!task) {
      return {
        taskClass: 'general_generation',
        complexity: 'low',
        requiredCapabilities: ['text'],
        preferredTier: 'flash',
      };
    }

    let complexity: 'low' | 'medium' | 'high' = 'medium';
    if (task.qualityPriority === 'critical') complexity = 'high';
    else if (task.qualityPriority === 'fast') complexity = 'low';

    return {
      taskClass: task.id,
      complexity,
      requiredCapabilities: [...task.requiredCapabilities],
      preferredTier: task.preferredTier === 'ultra' ? 'ultra' : task.preferredTier === 'pro' ? 'pro' : 'flash',
    };
  },

  /**
   * Validates whether a candidate model fulfills the task's hard requirements
   */
  isModelEligibleForTask(
    model: {
      id?: string;
      capabilities: string[];
      contextWindow?: number;
      tier?: string;
    },
    task: AITaskDefinition
  ): { eligible: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // Cinematic reasoning guard: flash-lite / lite tier models are strictly ineligible for cinematic reasoning (S1-S8)
    const isCinematicTask = [
      'story_analysis',
      'character_analysis',
      'character_detection',
      'location_object_analysis',
      'location_detection',
      'narrative_structure',
      'scene_breakdown',
      'shot_breakdown',
      'master_frame_generation',
      'master_frame',
      'video_prompt_generation',
      'video_prompt',
    ].includes(task.id) || ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'].includes(task.stageCode || '');

    const modelIdLower = ((model.id || '')).toLowerCase();
    if (isCinematicTask && (model.tier === 'lite' || modelIdLower.includes('flash-lite') || modelIdLower.includes('lite'))) {
      reasons.push(`Model '${model.id || 'lite'}' (tier: lite) is ineligible for cinematic reasoning in SINEMA pipeline`);
    }

    // 1. Capability check
    for (const reqCap of task.requiredCapabilities) {
      if (!model.capabilities.includes(reqCap)) {
        reasons.push(`Missing required capability: '${reqCap}'`);
      }
    }

    // 2. Minimum Context Window check
    if (task.minContextWindow && model.contextWindow && model.contextWindow < task.minContextWindow) {
      reasons.push(`Context window too small (${model.contextWindow} < ${task.minContextWindow})`);
    }

    return {
      eligible: reasons.length === 0,
      reasons,
    };
  },
};

export function getTaskByStageCode(stageCode: string): AITaskDefinition | undefined {
  return taskRegistry.getTaskForStage(stageCode);
}

export function getTask(taskIdOrStage?: string): AITaskDefinition | undefined {
  return taskRegistry.getTask(taskIdOrStage);
}
