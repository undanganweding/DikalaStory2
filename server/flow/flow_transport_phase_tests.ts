import assert from 'node:assert/strict';
import { flowSessionManager } from './flow_session_manager';
import { createMockReadonlyTransport } from './flow_transport';
import { createExternalWorkerBoundary } from './flow_worker_boundary';
import { createFlowReadonlyProvider } from './flow_readonly_provider';

async function main() {
  const sessionId = 'transport-phase-session';
  flowSessionManager.register({
    sessionId, accountId: 'operator-account', status: 'AUTHENTICATED', transport: 'UNKNOWN',
    capabilities: ['session_status', 'capability_status'],
  });
  const provider = createFlowReadonlyProvider(createExternalWorkerBoundary(createMockReadonlyTransport()));
  const valid = await provider.executeReadonly({ sessionId, operation: 'CAPABILITY_STATUS' });
  assert.equal(valid.ok, true);
  assert.equal(valid.transport, 'AUTHENTICATED_PAGE');
  assert.equal(valid.status, 'AUTHENTICATED');

  flowSessionManager.updateStatus(sessionId, 'EXPIRED');
  const expired = await provider.executeReadonly({ sessionId, operation: 'CAPABILITY_STATUS' });
  assert.equal(expired.ok, false);
  assert.equal(expired.status, 'REAUTH_REQUIRED');

  flowSessionManager.updateStatus(sessionId, 'BOT_CHALLENGE');
  const challenge = await provider.executeReadonly({ sessionId, operation: 'CAPABILITY_STATUS' });
  assert.equal(challenge.ok, false);
  assert.equal(challenge.status, 'BOT_CHALLENGE');

  flowSessionManager.updateStatus(sessionId, 'AUTHENTICATED');
  const unavailable = await createFlowReadonlyProvider(createExternalWorkerBoundary()).executeReadonly({ sessionId, operation: 'SESSION_STATUS' });
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.transport, 'WORKER_UNAVAILABLE');

  const missing = await provider.executeReadonly({ sessionId: 'missing', operation: 'SESSION_STATUS' });
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 'UNAVAILABLE');
  console.log('Flow transport phase tests passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
