import assert from 'node:assert/strict';
import { flowSessionManager } from './flow_session_manager';
import { flowResourceManager } from './flow_resource_manager';

const session = flowSessionManager.register({
  sessionId: 'test-flow-session',
  accountId: 'test-account',
  status: 'UNKNOWN',
  transport: 'UNKNOWN',
  capabilities: [],
});
assert.equal(session.status, 'UNKNOWN');
assert.equal(flowSessionManager.updateStatus(session.sessionId, 'REAUTH_REQUIRED').status, 'REAUTH_REQUIRED');

const snapshot = flowResourceManager.record({
  resourceDomain: 'GOOGLE_FLOW_CREDITS',
  resourceId: 'flow-resource-test',
  accountId: 'test-account',
  credits: 10,
  checkedAt: new Date().toISOString(),
});
assert.equal(snapshot.resourceDomain, 'GOOGLE_FLOW_CREDITS');
assert.equal(flowResourceManager.toResourceRef(snapshot.resourceId).resourceDomain, 'GOOGLE_FLOW_CREDITS');

console.log('Flow credential/resource domain tests passed');
