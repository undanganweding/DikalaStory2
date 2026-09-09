import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { flowSessionManager } from './flow_session_manager';
import { flowReadonlyAdapter } from './flow_readonly_adapter';
import { flowSessionPersistence } from './flow_session_persistence';
import { observabilityService } from '../ai_infrastructure/observability_service';
import { credentialResolver } from '../ai_infrastructure/credential_resolver';

async function main() {
  await observabilityService.clearTelemetry();
  observabilityService.clearExecutionEvents();
  observabilityService.clearRecords();
  const sessionId = 'phase-session-proof';
  flowSessionManager.register({
    sessionId, accountId: 'operator-account', status: 'AUTHENTICATED',
    transport: 'UNKNOWN', capabilities: ['video'],
  });
  const authenticated = await flowReadonlyAdapter.checkStatus(sessionId);
  assert.equal(authenticated.authenticated, true);
  assert.equal(authenticated.status, 'AUTHENTICATED');
  assert.equal((await credentialResolver.resolveCredential({ providerId: 'google-flow', sessionId, credentialDomain: 'GOOGLE_FLOW_SESSION' })).domain, 'GOOGLE_FLOW_SESSION');

  flowSessionManager.updateStatus(sessionId, 'EXPIRED');
  await assert.rejects(credentialResolver.resolveCredential({ providerId: 'google-flow', sessionId, credentialDomain: 'GOOGLE_FLOW_SESSION' }), /REAUTH_REQUIRED/);

  flowSessionManager.updateStatus(sessionId, 'BOT_CHALLENGE');
  const challenge = await flowReadonlyAdapter.checkStatus(sessionId);
  assert.equal(challenge.status, 'BOT_CHALLENGE');
  assert.equal(challenge.authenticated, false);

  const missing = await flowReadonlyAdapter.checkStatus('missing-session');
  assert.equal(missing.status, 'UNAVAILABLE');

  const persisted = flowSessionPersistence.load().find((session) => session.sessionId === sessionId);
  assert.equal(persisted?.accountId, 'operator-account');
  const metadataPath = path.join(process.env.VERCEL ? '/tmp/data' : path.join(process.cwd(), 'data'), 'flow_sessions_meta.json');
  const raw = fs.readFileSync(metadataPath, 'utf8');
  assert.equal(raw.includes('password'), false);
  assert.equal(raw.includes('cookie'), false);
  assert.equal(raw.includes('apiKey'), false);

  const records = observabilityService.getExecutionEvents().filter((record) => record.providerId === 'google-flow');
  assert.ok(records.length > 0);
  assert.ok(records.some((record) => record.type === 'FLOW_SESSION_CHECK'));
  assert.ok(records.some((record) => record.type === 'FLOW_CAPABILITY_CHECK'));
  console.log('Flow session phase tests passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
