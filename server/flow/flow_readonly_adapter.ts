import { flowSessionManager } from './flow_session_manager';
import { FlowSession, FlowSessionState } from './flow_types';
import { recordFlowLifecycleEvent } from './flow_events';

export interface FlowReadonlyStatus {
  providerId: 'google-flow';
  sessionId: string;
  accountId: string;
  status: FlowSessionState;
  authenticated: boolean;
  capabilities: string[];
  transport: FlowSession['transport'];
  checkedAt: string;
}

export interface FlowReadonlyAdapter {
  checkStatus(sessionId: string): Promise<FlowReadonlyStatus>;
}

/** Read-only boundary. Browser/CDP worker implements this later. */
export const flowReadonlyAdapter: FlowReadonlyAdapter = {
  async checkStatus(sessionId) {
    const session = flowSessionManager.get(sessionId);
    const checkedAt = new Date().toISOString();
    if (!session) {
      recordFlowLifecycleEvent({ providerId: 'google-flow',
        type: 'FLOW_SESSION_CHECK', operation: 'status', credentialDomain: 'GOOGLE_FLOW_SESSION',
        resourceDomain: 'GOOGLE_FLOW_CREDITS', sessionId, status: 'UNAVAILABLE',
      });
      return {
        providerId: 'google-flow', sessionId, accountId: '', status: 'UNAVAILABLE',
        authenticated: false, capabilities: [], transport: 'UNKNOWN', checkedAt,
      };
    }
    flowSessionManager.markChecked(sessionId, checkedAt);
    recordFlowLifecycleEvent({ providerId: 'google-flow',
      type: 'FLOW_SESSION_CHECK', operation: 'status', credentialDomain: 'GOOGLE_FLOW_SESSION',
      resourceDomain: 'GOOGLE_FLOW_CREDITS', sessionId, status: session.status,
    });
    recordFlowLifecycleEvent({ providerId: 'google-flow',
      type: 'FLOW_CAPABILITY_CHECK', operation: 'status', credentialDomain: 'GOOGLE_FLOW_SESSION',
      resourceDomain: 'GOOGLE_FLOW_CREDITS', sessionId, status: session.capabilities.length ? 'AVAILABLE' : 'UNKNOWN',
      metadata: { capabilities: session.capabilities },
    });
    return {
      providerId: 'google-flow', sessionId, accountId: session.accountId,
      status: session.status, authenticated: session.status === 'AUTHENTICATED',
      capabilities: [...session.capabilities], transport: session.transport, checkedAt,
    };
  },
};
