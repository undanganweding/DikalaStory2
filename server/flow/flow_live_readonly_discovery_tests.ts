import assert from 'node:assert/strict';
import { flowSessionManager } from './flow_session_manager';
import { createOperatorWorkerAdapter } from './flow_readonly_worker_contract';
import { discoverFlowReadOnly } from './flow_live_readonly_discovery';

const sessionId = 'live-readonly-proof-session';
flowSessionManager.register({ sessionId, accountId: 'operator-account', status: 'AUTHENTICATED', transport: 'PLAYWRIGHT', capabilities: ['MODEL_DISCOVERY', 'CREDIT_STATUS', 'QUOTE_DISCOVERY'] });

const worker = createOperatorWorkerAdapter(async (envelope) => ({
  ok: true,
  transport: 'AUTHENTICATED_PAGE',
  status: 'AUTHENTICATED',
  accountId: envelope.session.accountId,
  capabilities: ['MODEL_DISCOVERY', 'CREDIT_STATUS', 'QUOTE_DISCOVERY'],
  models: [{ id: 'veo', capabilities: ['video'] }],
  credits: 12,
  quote: { verified: true, operation: 'video-generation', model: 'veo', durationSeconds: 8, credits: 4, source: 'AUTHENTICATED_PAGE' },
  mutationDetected: false,
  paidSubmission: false,
}));

const discovered = await discoverFlowReadOnly(worker, { sessionId, operation: 'QUOTE_DISCOVERY', resourceId: 'live-resource', quoteRequest: { operation: 'video-generation', model: 'veo', durationSeconds: 8 } });
assert.equal(discovered.result.ok, true);
assert.equal(discovered.result.models?.[0].id, 'veo');
assert.equal(discovered.result.credits, 12);
assert.equal(discovered.normalizedQuote.status, 'QUOTED');
assert.equal(discovered.normalizedQuote.estimatedCredits, 4);

const unavailableWorker = createOperatorWorkerAdapter(async () => ({ ok: false, transport: 'WORKER_UNAVAILABLE', status: 'UNAVAILABLE', accountId: 'operator-account', capabilities: [], mutationDetected: false, paidSubmission: false, reason: 'worker unavailable' }));
const unavailable = await discoverFlowReadOnly(unavailableWorker, { sessionId, operation: 'CREDIT_STATUS' });
assert.equal(unavailable.result.status, 'UNAVAILABLE');
assert.equal(unavailable.normalizedQuote.status, 'QUOTE_UNAVAILABLE');

flowSessionManager.updateStatus(sessionId, 'EXPIRED');
const expired = await discoverFlowReadOnly(worker, { sessionId, operation: 'QUOTE_DISCOVERY', quoteRequest: { operation: 'video-generation' } });
assert.equal(expired.result.status, 'REAUTH_REQUIRED');
assert.equal(expired.normalizedQuote.status, 'QUOTE_UNAVAILABLE');

flowSessionManager.updateStatus(sessionId, 'BOT_CHALLENGE');
const challenged = await discoverFlowReadOnly(worker, { sessionId, operation: 'QUOTE_DISCOVERY' });
assert.equal(challenged.result.status, 'BOT_CHALLENGE');
assert.equal(challenged.result.paidSubmission, false);

console.log('Flow live read-only discovery contract tests passed');
