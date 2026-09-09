import { FlowSession, FlowSessionState } from './flow_types';

export type FlowTransportKind = 'DIRECT_HTTP_READONLY' | 'AUTHENTICATED_PAGE' | 'BROWSER_UI' | 'WORKER_UNAVAILABLE';
export type FlowReadonlyOperation = 'SESSION_STATUS' | 'CAPABILITY_STATUS';

export interface FlowTransportRequest {
  operation: FlowReadonlyOperation;
  session: FlowSession;
}

export interface FlowTransportResult {
  ok: boolean;
  transport: FlowTransportKind;
  status: FlowSessionState;
  accountId: string;
  capabilities: string[];
  reason?: string;
}

export interface FlowTransport {
  readonly kind: Exclude<FlowTransportKind, 'WORKER_UNAVAILABLE'>;
  supports(operation: FlowReadonlyOperation): boolean;
  execute(request: FlowTransportRequest): Promise<FlowTransportResult>;
}

export interface FlowTransportResolver {
  resolve(request: FlowTransportRequest): FlowTransport | undefined;
}

export const flowTransportResolver: FlowTransportResolver = {
  resolve({ operation, session }) {
    if (session.status !== 'AUTHENTICATED') return undefined;
    if (!session.capabilities.includes(operation === 'SESSION_STATUS' ? 'session_status' : 'capability_status')) return undefined;
    return undefined;
  },
};

export function createMockReadonlyTransport(
  kind: Exclude<FlowTransportKind, 'WORKER_UNAVAILABLE'> = 'AUTHENTICATED_PAGE'
): FlowTransport {
  return {
    kind,
    supports: (operation) => operation === 'SESSION_STATUS' || operation === 'CAPABILITY_STATUS',
    async execute({ session }) {
      return {
        ok: true,
        transport: kind,
        status: session.status,
        accountId: session.accountId,
        capabilities: [...session.capabilities],
      };
    },
  };
}
