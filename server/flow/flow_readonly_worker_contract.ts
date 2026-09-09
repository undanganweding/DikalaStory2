import { FlowSession } from './flow_types';
import { FlowReadonlyOperation, FlowTransportResult } from './flow_transport';

export type FlowWorkerReadOnlyOperation =
  | FlowReadonlyOperation
  | 'MODEL_DISCOVERY'
  | 'CREDIT_STATUS'
  | 'QUOTE_DISCOVERY';

export interface FlowWorkerEnvelope {
  requestId: string;
  sessionId: string;
  operation: FlowWorkerReadOnlyOperation;
  session: Pick<FlowSession, 'sessionId' | 'accountId' | 'status' | 'transport' | 'capabilities'>;
}

export interface FlowReadOnlyDiscoveryResult extends FlowTransportResult {
  models?: Array<{ id: string; displayName?: string; capabilities: string[] }>;
  credits?: number;
  quote?: {
    verified: boolean;
    operation: string;
    model?: string;
    durationSeconds?: number;
    credits?: number;
    source: 'AUTHENTICATED_PAGE' | 'BROWSER_UI' | 'DIRECT_HTTP_READONLY';
  };
  mutationDetected: false;
  paidSubmission: false;
}

export interface OperatorAuthenticatedFlowWorker {
  readonly runtime: 'EXTERNAL_BROWSER_WORKER';
  discoverReadOnly(envelope: FlowWorkerEnvelope): Promise<FlowReadOnlyDiscoveryResult>;
}

export function createOperatorWorkerAdapter(
  discover: OperatorAuthenticatedFlowWorker['discoverReadOnly']
): OperatorAuthenticatedFlowWorker {
  return {
    runtime: 'EXTERNAL_BROWSER_WORKER',
    discoverReadOnly: async (envelope) => {
      if (envelope.session.status !== 'AUTHENTICATED') {
        return {
          ok: false,
          transport: 'WORKER_UNAVAILABLE',
          status: envelope.session.status === 'EXPIRED' ? 'REAUTH_REQUIRED' : envelope.session.status,
          accountId: envelope.session.accountId,
          capabilities: [],
          reason: 'Flow session requires human-controlled authentication or verification',
          mutationDetected: false,
          paidSubmission: false,
        };
      }
      const result = await discover(envelope);
      if (result.mutationDetected || result.paidSubmission) {
        throw new Error('Safety violation: read-only worker returned mutation or paid submission');
      }
      return result;
    },
  };
}
