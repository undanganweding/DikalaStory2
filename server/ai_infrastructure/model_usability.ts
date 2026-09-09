export type ModelUsabilityState = 'AVAILABLE' | 'UNAVAILABLE' | 'QUOTA_EXHAUSTED' | 'RATE_LIMITED' | 'AUTH_FAILED' | 'UNKNOWN';

export interface ModelUsabilityRecord {
  providerId: string;
  modelId: string;
  state: ModelUsabilityState;
  reason?: string;
  retryAfter?: number;
  checkedAt: number;
}

const states = new Map<string, ModelUsabilityRecord>();
const keyOf = (providerId: string, modelId: string) => `${providerId}:${modelId}`;

function fromModel(model: any): ModelUsabilityRecord | undefined {
  if (!model?.usabilityState) return undefined;
  return { providerId: model.providerId, modelId: model.id, state: model.usabilityState, reason: model.usabilityReason, retryAfter: model.retryAfter, checkedAt: model.lastProbeAt || model.stateUpdatedAt || Date.now() };
}

export const modelUsability = {
  get(providerId: string, modelId: string): ModelUsabilityRecord | undefined {
    return states.get(keyOf(providerId, modelId));
  },
  loadFromModels(models: any[]): void {
    for (const model of models) {
      const record = fromModel(model);
      if (record) states.set(keyOf(record.providerId, record.modelId), record);
    }
  },
  set(providerId: string, modelId: string, state: ModelUsabilityState, reason?: string, retryAfter?: number): ModelUsabilityRecord {
    const checkedAt = Date.now();
    const record = { providerId, modelId, state, reason, retryAfter, checkedAt };
    states.set(keyOf(providerId, modelId), record);
    return record;
  },
  async persist(providerId: string, modelId: string, record: ModelUsabilityRecord): Promise<void> {
    const { db } = await import('../db');
    const model = await db.getModel(modelId, providerId);
    if (!model) return;
    await db.saveModel({ ...model, discoveredAt: model.discoveredAt || record.checkedAt, usabilityState: record.state, usabilityReason: record.reason, lastProbeAt: record.checkedAt, retryAfter: record.retryAfter, stateUpdatedAt: record.checkedAt });
  },
  async loadPersisted(): Promise<void> {
    const { db } = await import('../db');
    this.loadFromModels(await db.getModels());
  },
  isEligible(providerId: string, modelId: string): boolean {
    const record = this.get(providerId, modelId);
    if (!record) return true;
    if ((record.state === 'RATE_LIMITED' || record.state === 'QUOTA_EXHAUSTED') && record.retryAfter && record.retryAfter <= Date.now()) {
      states.delete(keyOf(providerId, modelId));
      return true;
    }
    return record.state === 'AVAILABLE' || record.state === 'UNKNOWN';
  },
  classify(error: unknown): ModelUsabilityState {
    const message = String((error as any)?.message || error || '').toLowerCase();
    if (message.includes('404') || message.includes('not found') || message.includes('no longer available')) return 'UNAVAILABLE';
    if (message.includes('api key') || message.includes('unauthorized') || message.includes('permission denied') || message.includes('401')) return 'AUTH_FAILED';
    if (message.includes('quota') || message.includes('resource_exhausted') || message.includes('limit: 0') || message.includes('perday')) return 'QUOTA_EXHAUSTED';
    if (message.includes('429') || message.includes('rate limit') || message.includes('rate_limited')) return 'RATE_LIMITED';
    return 'UNKNOWN';
  },
  clear(): void { states.clear(); },
};
