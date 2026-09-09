import assert from 'node:assert/strict';
import { flowResourceManager } from './flow_resource_manager';
import { flowCostLedger } from './flow_cost_ledger';

const request = { operation: 'video-generation', model: 'veo', durationSeconds: 8, sessionId: 's', resourceId: 'r' };
flowResourceManager.record({ resourceDomain: 'GOOGLE_FLOW_CREDITS', resourceId: 'r', accountId: 'a', credits: 10, checkedAt: new Date().toISOString() });

const unavailable = flowCostLedger.requestQuote(request);
assert.equal(unavailable.status, 'QUOTE_UNAVAILABLE');
assert.throws(() => flowCostLedger.prepareQuoted(unavailable, request, 10, 'EXECUTE'), /QUOTE_UNAVAILABLE/);

const quoted = { ...unavailable, status: 'QUOTED' as const, estimatedCredits: 4 };
const prepared = flowCostLedger.prepareQuoted(quoted, request, 5, 'PREPARE_ONLY');
assert.equal(prepared.state, 'APPROVAL_REQUIRED');
const approved = flowCostLedger.approve(prepared.ledgerId, 'operator-approval');
assert.equal(approved.state, 'APPROVED');
const reserved = flowCostLedger.reserve(prepared.ledgerId);
assert.equal(reserved.state, 'RESERVED');

const insufficientQuote = { ...unavailable, status: 'QUOTED' as const, estimatedCredits: 11 };
const insufficient = flowCostLedger.prepareQuoted(insufficientQuote, request, 20, 'EXECUTE');
const insufficientLedger = flowCostLedger.approve(insufficient.ledgerId, 'operator-approval');
assert.throws(() => flowCostLedger.reserve(insufficientLedger.ledgerId), /Insufficient Flow credits/);

assert.throws(() => flowCostLedger.prepareQuoted(quoted, request, 5, 'NO_SPEND'), /NO_SPEND/);
const unknown = flowCostLedger.markChargeUnknown(reserved.ledgerId);
assert.equal(unknown.state, 'CHARGE_UNKNOWN');
assert.throws(() => flowCostLedger.reserve(reserved.ledgerId), /Invalid Flow reservation transition/);
assert.equal(flowCostLedger.reconcile(reserved.ledgerId).state, 'RECONCILED');

console.log('Flow cost ledger tests passed');
