import { randomUUID } from 'node:crypto';
import { flowSessionManager } from './flow_session_manager';
import { flowResourceManager } from './flow_resource_manager';
import { FlowQuote, flowCostLedger } from './flow_cost_ledger';
import { FlowWorkerReadOnlyOperation, FlowReadOnlyDiscoveryResult, OperatorAuthenticatedFlowWorker } from './flow_readonly_worker_contract';
import { recordFlowLifecycleEvent } from './flow_events';

export interface FlowDiscoveryRequest {
  sessionId: string;
  operation: FlowWorkerReadOnlyOperation;
  resourceId?: string;
  quoteRequest?: { operation: string; model?: string; durationSeconds?: number };
}

export interface FlowDiscoveryResponse {
  result: FlowReadOnlyDiscoveryResult;
  normalizedQuote: FlowQuote;
}

export async function discoverFlowReadOnly(
  worker: OperatorAuthenticatedFlowWorker,
  request: FlowDiscoveryRequest
): Promise<FlowDiscoveryResponse> {
  const session = flowSessionManager.get(request.sessionId);
  if (!session) {
    return {
      result: { ok: false, transport: 'WORKER_UNAVAILABLE', status: 'UNAVAILABLE', accountId: '', capabilities: [], reason: 'Flow session unavailable', mutationDetected: false, paidSubmission: false },
      normalizedQuote: { quoteId: randomUUID(), status: 'QUOTE_UNAVAILABLE', resourceDomain: 'GOOGLE_FLOW_CREDITS', reason: 'Flow session unavailable' },
    };
  }
  const result = await worker.discoverReadOnly({ requestId: randomUUID(), sessionId: session.sessionId, operation: request.operation, session: { sessionId: session.sessionId, accountId: session.accountId, status: session.status, transport: session.transport, capabilities: session.capabilities } });
  if (result.credits !== undefined && request.resourceId) {
    flowResourceManager.record({ resourceDomain: 'GOOGLE_FLOW_CREDITS', resourceId: request.resourceId, accountId: session.accountId, credits: result.credits, checkedAt: new Date().toISOString() });
  }
  const normalizedQuote = request.quoteRequest
    ? result.quote?.verified
      ? { quoteId: randomUUID(), status: 'QUOTED' as const, estimatedCredits: result.quote.credits, resourceDomain: 'GOOGLE_FLOW_CREDITS' as const, reason: 'Read-only quote verified by operator-authenticated worker' }
      : flowCostLedger.requestQuote({ ...request.quoteRequest, sessionId: request.sessionId, resourceId: request.resourceId || 'unbound' })
    : flowCostLedger.requestQuote({ operation: request.operation, sessionId: request.sessionId, resourceId: request.resourceId || 'unbound' });
  recordFlowLifecycleEvent({ providerId: 'google-flow', type: 'FLOW_COST_ESTIMATE', operation: request.quoteRequest?.operation || request.operation, credentialDomain: 'GOOGLE_FLOW_SESSION', resourceDomain: 'GOOGLE_FLOW_CREDITS', sessionId: request.sessionId, resourceId: request.resourceId, status: normalizedQuote.status, metadata: { verified: result.quote?.verified === true, transport: result.transport } });
  return { result, normalizedQuote };
}
