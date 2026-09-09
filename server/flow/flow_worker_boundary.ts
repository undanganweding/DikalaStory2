import { FlowSession } from './flow_types';
import { FlowReadonlyOperation, FlowTransport, FlowTransportResult } from './flow_transport';

export interface FlowWorkerRequest {
  session: FlowSession;
  operation: FlowReadonlyOperation;
}

export interface FlowWorkerBoundary {
  readonly runtime: 'EXTERNAL_BROWSER_WORKER';
  executeReadonly(request: FlowWorkerRequest): Promise<FlowTransportResult>;
}

/**
 * Contract only. Persistent Chrome/CDP must run in operator-controlled worker,
 * never inside Vercel request runtime.
 */
export function createExternalWorkerBoundary(transport?: FlowTransport): FlowWorkerBoundary {
  return {
    runtime: 'EXTERNAL_BROWSER_WORKER',
    async executeReadonly({ session, operation }) {
      if (!transport || !transport.supports(operation)) {
        return {
          ok: false,
          transport: 'WORKER_UNAVAILABLE',
          status: 'UNAVAILABLE',
          accountId: session.accountId,
          capabilities: [],
          reason: 'External authenticated Flow worker unavailable',
        };
      }
      return transport.execute({ session, operation });
    },
  };
}
