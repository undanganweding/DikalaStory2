import assert from 'node:assert/strict';
import { credentialResolver } from '../ai_infrastructure/credential_resolver';
import { flowSessionManager } from './flow_session_manager';
import { flowResourceManager } from './flow_resource_manager';
import { checkFlowPreflight } from './flow_preflight';

async function main() {
  const sessionId = 'flow-integration-session';
  const resourceId = 'flow-integration-resource';
  flowSessionManager.register({
    sessionId,
    accountId: 'flow-account',
    status: 'AUTHENTICATED',
    transport: 'UNKNOWN',
    capabilities: ['video'],
  });
  flowResourceManager.record({
    resourceDomain: 'GOOGLE_FLOW_CREDITS',
    resourceId,
    accountId: 'flow-account',
    credits: 5,
    checkedAt: new Date().toISOString(),
  });

  const resolved = await credentialResolver.resolveCredential({
    providerId: 'google-flow',
    credentialDomain: 'GOOGLE_FLOW_SESSION',
    sessionId,
    requiredCapability: 'video',
  });
  assert.equal(resolved.domain, 'GOOGLE_FLOW_SESSION');
  assert.equal(resolved.providerId, 'google-flow');
  assert.equal('apiKey' in resolved, false);

  await assert.rejects(
    credentialResolver.resolveCredential({ providerId: 'google-flow', credentialDomain: 'API' }),
    /requires GOOGLE_FLOW_SESSION/
  );

  const prepare = checkFlowPreflight({
    operation: 'video-generation',
    capability: 'video',
    sessionId,
    resourceId,
    policy: 'PREPARE_ONLY',
  });
  assert.equal(prepare.viable, true);
  assert.equal(prepare.canSubmitPaidGeneration, false);

  const execute = checkFlowPreflight({
    operation: 'video-generation',
    capability: 'video',
    sessionId,
    resourceId,
    policy: 'EXECUTE',
  });
  assert.equal(execute.viable, false);
  assert.match(execute.reason, /cost estimation/);

  flowSessionManager.updateStatus(sessionId, 'EXPIRED');
  const expired = checkFlowPreflight({
    operation: 'video-generation',
    capability: 'video',
    sessionId,
    resourceId,
    policy: 'PREPARE_ONLY',
  });
  assert.equal(expired.viable, false);
  assert.match(expired.reason, /REAUTH_REQUIRED/);

  console.log('Flow integration tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
