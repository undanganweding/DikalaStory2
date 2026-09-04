import { knowledgeStore, KnowledgeItem, MemoryType } from './knowledge_store';

export interface ConsistencyValidationResult {
  status: 'OK' | 'CONFLICT';
  entries: { id: string; reason: string }[];
}

export const projectMemoryManager = {
  async createProjectMemory(projectId: string): Promise<string> {
    await knowledgeStore.clearProject(projectId);
    return projectId;
  },

  async getProjectMemory(projectId: string): Promise<KnowledgeItem[]> {
    return knowledgeStore.listKnowledge(projectId);
  },

  async updateMemory(projectId: string, itemId: string, updates: Partial<KnowledgeItem>): Promise<KnowledgeItem> {
    return knowledgeStore.updateKnowledge(projectId, itemId, updates);
  },

  async appendMemoryEntry(
    projectId: string,
    entry: {
      id: string;
      type: MemoryType;
      content: Record<string, any>;
      sourceAgent: string;
      confidence?: number;
    }
  ): Promise<KnowledgeItem> {
    return knowledgeStore.saveKnowledge({
      id: entry.id,
      projectId,
      type: entry.type,
      content: entry.content,
      sourceAgent: entry.sourceAgent,
      confidence: entry.confidence ?? 1.0,
    });
  },

  async queryMemory(projectId: string, query: { type?: MemoryType; sourceAgent?: string; keyword?: string }): Promise<KnowledgeItem[]> {
    let items = await knowledgeStore.listKnowledge(projectId, query.type);
    if (query.sourceAgent) {
      items = items.filter(i => i.sourceAgent === query.sourceAgent);
    }
    if (query.keyword) {
      const kw = query.keyword.toLowerCase();
      items = items.filter(i => JSON.stringify(i.content).toLowerCase().includes(kw));
    }
    return items;
  },

  async lockMemoryEntry(projectId: string, itemId: string): Promise<void> {
    await knowledgeStore.lockItem(projectId, itemId, true);
  },

  async validateMemoryConsistency(projectId: string): Promise<ConsistencyValidationResult> {
    const items = await knowledgeStore.listKnowledge(projectId);
    const conflicts: { id: string; reason: string }[] = [];

    // Check for character conflicts (same character name or ID with differing conflicting fields like age)
    const characters = items.filter(i => i.type === 'CHARACTER_MEMORY');
    const charMap = new Map<string, KnowledgeItem[]>();

    for (const c of characters) {
      const name = (c.content.name || c.id).toLowerCase();
      const list = charMap.get(name) || [];
      list.push(c);
      charMap.set(name, list);
    }

    for (const [name, list] of charMap.entries()) {
      if (list.length > 1) {
        // Compare ages or attributes if present
        const ages = list.map(l => l.content.age).filter(a => a !== undefined);
        if (new Set(ages).size > 1) {
          conflicts.push({
            id: list[1].id,
            reason: `Character '${name}' has conflicting age entries: [${ages.join(', ')}]`,
          });
        }
      }
    }

    return {
      status: conflicts.length > 0 ? 'CONFLICT' : 'OK',
      entries: conflicts,
    };
  },
};
