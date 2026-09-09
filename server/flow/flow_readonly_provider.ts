import { flowSessionManager } from './flow_session_manager';
import { credentialResolver } from '../ai_infrastructure/credential_resolver';
import { createExternalWorkerBoundary, FlowWorkerBoundary } from './flow_worker_boundary';
import { FlowReadonlyOperation, FlowTransport, FlowTransportResult } from './flow_transport';
import { recordFlowLifecycleEvent } from './flow_events';

export interface FlowReadonlyProviderRequest {
  sessionId: string;
  operation: FlowReadonlyOperation;
}

export interface FlowReadonlyProviderResult extends FlowTransportResult {
  providerId: 'google-flow';
  sessionId: string;
}

export interface FlowReadonlyProvider {
  executeReadonly(request: FlowReadonlyProviderRequest): Promise<FlowReadonlyProviderResult>;
}

export function createFlowReadonlyProvider(worker?: FlowWorkerBoundary): FlowReadonlyProvider {
  const boundary = worker || createExternalWorkerBoundary();
  return {
    async executeReadonly({ sessionId, operation }) {
      const session = flowSessionManager.get(sessionId);
      if (session?.status === 'AUTHENTICATED') {
        await credentialResolver.resolveCredential({ providerId: 'google-flow', credentialDomain: 'GOOGLE_FLOW_SESSION', sessionId });
      }
      if (!session) {
        const status: FlowReadonlyProviderResult = {
          providerId: 'google-flow', sessionId, ok: false, transport: 'WORKER_UNAVAILABLE',
          status: 'UNAVAILABLE', accountId: '', capabilities: [], reason: 'Flow session unavailable',
        };
        return status;
      }
      if (session.status !== 'AUTHENTICATED') {
        const status = session.status === 'EXPIRED' ? 'REAUTH_REQUIRED' : session.status;
        recordFlowLifecycleEvent({ providerId: 'google-flow', type: 'FLOW_SESSION_CHECK', operation, credentialDomain: 'GOOGLE_FLOW_SESSION', resourceDomain: 'GOOGLE_FLOW_CREDITS', sessionId, status });
        return { providerId: 'google-flow', sessionId, ok: false, transport: 'WORKER_UNAVAILABLE', status, accountId: session.accountId, capabilities: [], reason: `Flow session blocked: ${status}` };
      }
      const result = await boundary.executeReadonly({ session, operation });
      recordFlowLifecycleEvent({ providerId: 'google-flow', type: 'FLOW_CAPABILITY_CHECK', operation, credentialDomain: 'GOOGLE_FLOW_SESSION', resourceDomain: 'GOOGLE_FLOW_CREDITS', sessionId, status: result.status, metadata: { transport: result.transport, readOnly: true } });
      return { providerId: 'google-flow', sessionId, ...result };
    },
  };
}

export const flowReadonlyProvider = createFlowReadonlyProvider();
