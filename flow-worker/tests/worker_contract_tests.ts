import { strict as assert } from 'node:assert';
import { createFlowWorker } from '../worker';
import { createUnavailableBrowserSessionFactory } from '../browser/browser_session';
import type { FlowWorkerEnvelope } from '../../server/flow/flow_readonly_worker_contract';

const authenticated: FlowWorkerEnvelope = {
  requestId: 'test-request',
  sessionId: 'test-session',
  operation: 'SESSION_STATUS',
  session: {
    sessionId: 'test-session',
    accountId: 'operator-account',
    status: 'AUTHENTICATED',
    transport: 'CDP',
    capabilities: ['session_status'],
  },
};

const contractWorker = createFlowWorker(createUnavailableBrowserSessionFactory('Contract test browser disabled'));
const unavailable = await contractWorker.handle(authenticated);
assert.equal(unavailable.ok, false);
assert.equal(unavailable.transport, 'WORKER_UNAVAILABLE');
assert.equal(unavailable.mutationDetected, false);
assert.equal(unavailable.paidSubmission, false);

const unauthenticated = await contractWorker.handle({
  ...authenticated,
  session: { ...authenticated.session, status: 'EXPIRED' },
});
assert.equal(unauthenticated.status, 'REAUTH_REQUIRED');

console.log('Flow worker contract tests passed');
