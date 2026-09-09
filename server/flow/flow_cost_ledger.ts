import { randomUUID } from 'node:crypto';
import { flowResourceManager } from './flow_resource_manager';
import { recordFlowLifecycleEvent } from './flow_events';

export type FlowLedgerState =
  | 'QUOTE_REQUESTED' | 'QUOTED' | 'APPROVAL_REQUIRED' | 'APPROVED'
  | 'RESERVED' | 'RELEASED' | 'CHARGED' | 'CHARGE_UNKNOWN' | 'RECONCILED';

export type FlowExecutionPolicy = 'PREPARE_ONLY' | 'NO_SPEND' | 'EXECUTE';

export interface FlowQuoteRequest {
  operation: string;
  model?: string;
  durationSeconds?: number;
  sessionId: string;
  resourceId: string;
}

export interface FlowQuote {
  quoteId: string;
  status: 'QUOTED' | 'QUOTE_UNAVAILABLE';
  estimatedCredits?: number;
  resourceDomain: 'GOOGLE_FLOW_CREDITS';
  expiresAt?: string;
  reason?: string;
}

export interface FlowLedgerEntry {
  ledgerId: string;
  state: FlowLedgerState;
  quoteId: string;
  resourceId: string;
  operation: string;
  credits?: number;
  approvalId?: string;
  reservationId?: string;
  remoteJobId?: string;
  submissionFingerprint?: string;
  updatedAt: string;
  reconciliationRequired?: boolean;
}

const entries = new Map<string, FlowLedgerEntry>();

export const flowCostLedger = {
  requestQuote(request: FlowQuoteRequest): FlowQuote {
    const quote: FlowQuote = {
      quoteId: randomUUID(),
      status: 'QUOTE_UNAVAILABLE',
      resourceDomain: 'GOOGLE_FLOW_CREDITS',
      reason: 'Real Flow quote not verified; no estimated credit value fabricated',
    };
    recordFlowLifecycleEvent({ providerId: 'google-flow', type: 'FLOW_COST_ESTIMATE', operation: request.operation, credentialDomain: 'GOOGLE_FLOW_SESSION', resourceDomain: 'GOOGLE_FLOW_CREDITS', sessionId: request.sessionId, resourceId: request.resourceId, status: quote.status });
    return quote;
  },

  prepareQuoted(quote: FlowQuote, request: FlowQuoteRequest, ceiling: number, policy: FlowExecutionPolicy): FlowLedgerEntry {
    if (policy === 'NO_SPEND') throw new Error('Flow NO_SPEND blocks approval and reservation');
    if (quote.status !== 'QUOTED' || quote.estimatedCredits === undefined) throw new Error('QUOTE_UNAVAILABLE: paid Flow execution blocked');
    if (quote.estimatedCredits > ceiling) throw new Error('Flow quote exceeds configured credit ceiling');
    const entry: FlowLedgerEntry = { ledgerId: randomUUID(), state: policy === 'PREPARE_ONLY' ? 'APPROVAL_REQUIRED' : 'APPROVAL_REQUIRED', quoteId: quote.quoteId, resourceId: request.resourceId, operation: request.operation, credits: quote.estimatedCredits, updatedAt: new Date().toISOString() };
    entries.set(entry.ledgerId, entry);
    recordFlowLifecycleEvent({ providerId: 'google-flow', type: 'FLOW_BUDGET_GATE', operation: request.operation, credentialDomain: 'GOOGLE_FLOW_SESSION', resourceDomain: 'GOOGLE_FLOW_CREDITS', sessionId: request.sessionId, resourceId: request.resourceId, status: entry.state, metadata: { policy, ceiling } });
    return { ...entry };
  },

  approve(ledgerId: string, approvalId: string): FlowLedgerEntry {
    const entry = requireEntry(ledgerId);
    if (entry.state !== 'APPROVAL_REQUIRED') throw new Error(`Invalid Flow approval transition from ${entry.state}`);
    const updated = { ...entry, state: 'APPROVED' as const, approvalId, updatedAt: new Date().toISOString() };
    entries.set(ledgerId, updated); return { ...updated };
  },

  reserve(ledgerId: string): FlowLedgerEntry {
    const entry = requireEntry(ledgerId);
    if (entry.state !== 'APPROVED') throw new Error(`Invalid Flow reservation transition from ${entry.state}`);
    const snapshot = flowResourceManager.get(entry.resourceId);
    if (!snapshot || snapshot.credits === undefined || entry.credits === undefined || snapshot.credits < entry.credits) throw new Error('Insufficient Flow credits');
    const updated = { ...entry, state: 'RESERVED' as const, reservationId: randomUUID(), updatedAt: new Date().toISOString() };
    entries.set(ledgerId, updated); return { ...updated };
  },

  release(ledgerId: string): FlowLedgerEntry { return transition(ledgerId, 'RELEASED'); },
  markChargeUnknown(ledgerId: string): FlowLedgerEntry { return transition(ledgerId, 'CHARGE_UNKNOWN', true); },
  reconcile(ledgerId: string): FlowLedgerEntry { const entry = requireEntry(ledgerId); if (entry.state !== 'CHARGE_UNKNOWN') throw new Error('Reconciliation requires CHARGE_UNKNOWN'); return transition(ledgerId, 'RECONCILED'); },
  get(ledgerId: string): FlowLedgerEntry | undefined { const entry = entries.get(ledgerId); return entry ? { ...entry } : undefined; },
};

function requireEntry(id: string): FlowLedgerEntry { const entry = entries.get(id); if (!entry) throw new Error(`Flow ledger entry not found: ${id}`); return entry; }
function transition(id: string, state: FlowLedgerState, reconciliationRequired = false): FlowLedgerEntry { const entry = requireEntry(id); const updated = { ...entry, state, reconciliationRequired, updatedAt: new Date().toISOString() }; entries.set(id, updated); return { ...updated }; }
