export interface AgentContract {
  id: string;
  purpose: string;
  inputSchema: {
    description: string;
    requiredFields: string[];
  };
  outputSchema: {
    description: string;
    expectedFields: string[];
  };
  allowedTools: string[];
  allowedModels: string[];
  maxTokens: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  failureStrategy: 'FAIL_FAST' | 'FALLBACK_MODEL' | 'RETRY_WITH_BACKOFF';
}

export const AGENT_CONTRACTS: Record<string, AgentContract> = {
  research_agent: {
    id: 'research_agent',
    purpose: 'Fact-checking and narrative context grounding',
    inputSchema: {
      description: 'Input story or topic subject',
      requiredFields: ['story'],
    },
    outputSchema: {
      description: 'Strict structured research output',
      expectedFields: ['sources', 'claims', 'confidence', 'historical_notes'],
    },
    allowedTools: ['search', 'grounding'],
    allowedModels: ['gemini-3.1-flash-lite', 'gemini-3.7-flash'],
    maxTokens: 8000,
    priority: 'MEDIUM',
    failureStrategy: 'RETRY_WITH_BACKOFF',
  },
  story_analyzer: {
    id: 'story_analyzer',
    purpose: 'Deep thematic analysis and script breakdown',
    inputSchema: {
      description: 'Script or narrative material',
      requiredFields: ['scriptText'],
    },
    outputSchema: {
      description: 'Thematic analysis and structural beats',
      expectedFields: ['themes', 'beats', 'characterArcs', 'pacingScore'],
    },
    allowedTools: [],
    allowedModels: ['gemini-3.7-flash', 'gemini-2.5-pro'],
    maxTokens: 10000,
    priority: 'HIGH',
    failureStrategy: 'FALLBACK_MODEL',
  },
  film_director: {
    id: 'film_director',
    purpose: 'Cinematic scene direction and visual prompt generation',
    inputSchema: {
      description: 'Scene breakdown and thematic beats',
      requiredFields: ['sceneNumber', 'beatDescription'],
    },
    outputSchema: {
      description: 'Cinematic direction and camera blocking',
      expectedFields: ['cameraAngle', 'lightingTone', 'blockingNotes'],
    },
    allowedTools: [],
    allowedModels: ['gemini-3.7-flash', 'gemini-3.1-flash-lite'],
    maxTokens: 15000,
    priority: 'CRITICAL',
    failureStrategy: 'FALLBACK_MODEL',
  },
  storyboard_agent: {
    id: 'storyboard_agent',
    purpose: 'Visual shot breakdown and storyboard planning',
    inputSchema: {
      description: 'Scene direction and blocking',
      requiredFields: ['sceneId', 'direction'],
    },
    outputSchema: {
      description: 'Shot list and visual layout',
      expectedFields: ['shots', 'compositionNotes', 'lightingStyle'],
    },
    allowedTools: [],
    allowedModels: ['gemini-3.7-flash'],
    maxTokens: 8000,
    priority: 'HIGH',
    failureStrategy: 'FALLBACK_MODEL',
  },
  prompt_engineer: {
    id: 'prompt_engineer',
    purpose: 'Prompt optimization and stylistic refinement',
    inputSchema: {
      description: 'Scene description, character, location',
      requiredFields: ['scene', 'character', 'location'],
    },
    outputSchema: {
      description: 'Optimized generation prompts',
      expectedFields: ['image_prompt', 'video_prompt', 'negative_prompt'],
    },
    allowedTools: [],
    allowedModels: ['gemini-3.7-flash'],
    maxTokens: 5000,
    priority: 'MEDIUM',
    failureStrategy: 'FAIL_FAST',
  },
  video_agent: {
    id: 'video_agent',
    purpose: 'Video generation orchestration and rendering coordination',
    inputSchema: {
      description: 'Optimized prompts and storyboard shots',
      requiredFields: ['video_prompt', 'duration'],
    },
    outputSchema: {
      description: 'Render status and media asset references',
      expectedFields: ['assetId', 'status', 'renderUrl', 'durationSec'],
    },
    allowedTools: ['media_renderer'],
    allowedModels: ['gemini-3.7-flash', 'gemini-3.1-flash-lite'],
    maxTokens: 12000,
    priority: 'CRITICAL',
    failureStrategy: 'RETRY_WITH_BACKOFF',
  },
};
