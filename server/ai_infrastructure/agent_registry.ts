export interface AgentDefinition {
  id: string;
  name: string;
  purpose: string;
  allowedModels: string[];
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  maxTokensPerRequest: number;
}

export const AI_AGENT_REGISTRY: Record<string, AgentDefinition> = {
  story_analyzer: {
    id: 'story_analyzer',
    name: 'AI Story Analyst',
    purpose: 'Deep thematic analysis and script breakdown',
    allowedModels: ['gemini-3.7-flash', 'gemini-2.5-pro'],
    priority: 'HIGH',
    maxTokensPerRequest: 10000,
  },
  film_director: {
    id: 'film_director',
    name: 'AI Film Director',
    purpose: 'Cinematic scene direction and visual prompt generation',
    allowedModels: ['gemini-3.7-flash', 'gemini-3.1-flash-lite'],
    priority: 'CRITICAL',
    maxTokensPerRequest: 15000,
  },
  research_agent: {
    id: 'research_agent',
    name: 'AI Research Agent',
    purpose: 'Fact-checking and narrative context grounding',
    allowedModels: ['gemini-3.1-flash-lite', 'gemini-3.7-flash'],
    priority: 'MEDIUM',
    maxTokensPerRequest: 8000,
  },
  prompt_engineer: {
    id: 'prompt_engineer',
    name: 'AI Prompt Engineer',
    purpose: 'Prompt optimization and stylistic refinement',
    allowedModels: ['gemini-3.7-flash'],
    priority: 'MEDIUM',
    maxTokensPerRequest: 5000,
  },
};
