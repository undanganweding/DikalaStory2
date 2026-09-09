import { FlowResourceSnapshot, ResourceRef } from './flow_types';
import { recordFlowLifecycleEvent } from './flow_events';

const snapshots = new Map<string, FlowResourceSnapshot>();

export const flowResourceManager = {
  record(snapshot: FlowResourceSnapshot): FlowResourceSnapshot {
    snapshots.set(snapshot.resourceId, { ...snapshot });
    recordFlowLifecycleEvent({ providerId: 'google-flow',
      type: 'FLOW_RESOURCE_CHECK', operation: 'snapshot', credentialDomain: 'GOOGLE_FLOW_SESSION',
      resourceDomain: 'GOOGLE_FLOW_CREDITS', resourceId: snapshot.resourceId,
      status: snapshot.credits === undefined ? 'UNKNOWN' : 'AVAILABLE',
      metadata: { accountId: snapshot.accountId },
    });
    return { ...snapshot };
  },

  get(resourceId: string): FlowResourceSnapshot | undefined {
    const snapshot = snapshots.get(resourceId);
    return snapshot ? { ...snapshot } : undefined;
  },

  toResourceRef(resourceId: string, providerId = 'google-flow'): ResourceRef {
    return { resourceDomain: 'GOOGLE_FLOW_CREDITS', resourceId, providerId };
  },

  list(): FlowResourceSnapshot[] {
    return [...snapshots.values()].map((snapshot) => ({ ...snapshot }));
  },
};
