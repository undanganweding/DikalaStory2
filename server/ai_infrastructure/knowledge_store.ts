export type MemoryType = 'CHARACTER_MEMORY' | 'LOCATION_MEMORY' | 'FACT_MEMORY' | 'VISUAL_MEMORY' | 'DECISION_MEMORY';

export interface KnowledgeItem {
  id: string;
  projectId: string;
  type: MemoryType;
  content: Record<string, any>;
  sourceAgent: string;
  confidence: number;
  createdAt: number;
  updatedAt: number;
  version: number;
  locked?: boolean;
}

const knowledgeStoreMemory: Map<string, KnowledgeItem[]> = new Map();

export const knowledgeStore = {
  async saveKnowledge(item: Omit<KnowledgeItem, 'createdAt' | 'updatedAt' | 'version'>): Promise<KnowledgeItem> {
    const projectItems = knowledgeStoreMemory.get(item.projectId) || [];
    const existingIndex = projectItems.findIndex(i => i.id === item.id);

    const now = Date.now();
    let newItem: KnowledgeItem;

    if (existingIndex >= 0) {
      const existing = projectItems[existingIndex];
      if (existing.locked) {
        throw new Error(`KnowledgeStore: Item ${item.id} is locked and cannot be overwritten.`);
      }
      newItem = {
        ...existing,
        ...item,
        updatedAt: now,
        version: existing.version + 1,
      };
      projectItems[existingIndex] = newItem;
    } else {
      newItem = {
        ...item,
        createdAt: now,
        updatedAt: now,
        version: 1,
        locked: item.locked || false,
      };
      projectItems.push(newItem);
    }

    knowledgeStoreMemory.set(item.projectId, projectItems);
    return newItem;
  },

  async getKnowledge(projectId: string, id: string): Promise<KnowledgeItem | null> {
    const projectItems = knowledgeStoreMemory.get(projectId) || [];
    return projectItems.find(i => i.id === id) || null;
  },

  async listKnowledge(projectId: string, type?: MemoryType): Promise<KnowledgeItem[]> {
    const projectItems = knowledgeStoreMemory.get(projectId) || [];
    if (type) {
      return projectItems.filter(i => i.type === type);
    }
    return projectItems;
  },

  async updateKnowledge(projectId: string, id: string, updates: Partial<KnowledgeItem>): Promise<KnowledgeItem> {
    const projectItems = knowledgeStoreMemory.get(projectId) || [];
    const index = projectItems.findIndex(i => i.id === id);
    if (index < 0) {
      throw new Error(`KnowledgeStore: Item ${id} not found in project ${projectId}`);
    }
    const existing = projectItems[index];
    if (existing.locked && updates.locked !== false) {
      throw new Error(`KnowledgeStore: Item ${id} is locked.`);
    }

    const updated: KnowledgeItem = {
      ...existing,
      ...updates,
      id: existing.id,
      projectId: existing.projectId,
      type: updates.type || existing.type,
      updatedAt: Date.now(),
      version: existing.version + 1,
    };
    projectItems[index] = updated;
    knowledgeStoreMemory.set(projectId, projectItems);
    return updated;
  },

  async lockItem(projectId: string, id: string, locked = true): Promise<void> {
    const projectItems = knowledgeStoreMemory.get(projectId) || [];
    const item = projectItems.find(i => i.id === id);
    if (item) {
      item.locked = locked;
    }
  },

  async clearProject(projectId: string): Promise<void> {
    knowledgeStoreMemory.delete(projectId);
  },
};
