import { projectMemoryManager } from './agent_memory';
import { KnowledgeItem, MemoryType } from './knowledge_store';

export const agentAccessPolicies: Record<string, { readTypes: MemoryType[]; writeTypes: MemoryType[] }> = {
  research_agent: {
    readTypes: ['FACT_MEMORY'],
    writeTypes: ['FACT_MEMORY'],
  },
  story_analyzer: {
    readTypes: ['FACT_MEMORY', 'CHARACTER_MEMORY'],
    writeTypes: ['DECISION_MEMORY'],
  },
  film_director: {
    readTypes: ['CHARACTER_MEMORY', 'LOCATION_MEMORY', 'FACT_MEMORY'],
    writeTypes: ['DECISION_MEMORY'],
  },
  storyboard_agent: {
    readTypes: ['DECISION_MEMORY', 'VISUAL_MEMORY'],
    writeTypes: ['VISUAL_MEMORY'],
  },
  prompt_engineer: {
    readTypes: ['VISUAL_MEMORY', 'CHARACTER_MEMORY', 'LOCATION_MEMORY'],
    writeTypes: ['VISUAL_MEMORY'],
  },
  video_agent: {
    readTypes: ['VISUAL_MEMORY', 'DECISION_MEMORY'],
    writeTypes: ['DECISION_MEMORY'],
  },
};

export const contextManager = {
  async buildAgentContext(
    agentId: string,
    projectId: string,
    task: string
  ): Promise<{ memoryContext: Record<string, any>; allowedWriteTypes: MemoryType[] }> {
    const policy = agentAccessPolicies[agentId] || { readTypes: ['FACT_MEMORY'], writeTypes: [] };
    const allMemory = await projectMemoryManager.getProjectMemory(projectId);

    const filteredMemory: Record<string, any[]> = {};

    for (const type of policy.readTypes) {
      filteredMemory[type] = allMemory.filter(item => {
        if (type === 'FACT_MEMORY') return item.type === 'FACT_MEMORY';
        if (type === 'CHARACTER_MEMORY') return item.type === 'CHARACTER_MEMORY';
        if (type === 'LOCATION_MEMORY') return item.type === 'LOCATION_MEMORY';
        if (type === 'VISUAL_MEMORY') return item.type === 'VISUAL_MEMORY';
        if (type === 'DECISION_MEMORY') return item.type === 'DECISION_MEMORY';
        return false;
      });
    }

    return {
      memoryContext: filteredMemory,
      allowedWriteTypes: policy.writeTypes,
    };
  },
};
