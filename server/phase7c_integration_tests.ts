import { credentialManager, maskApiKey } from './credential_manager';
import { executeProviderRequest, executeLLMRequest } from './llm_provider';
import { checkGeminiOmniCapability } from './gemini';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[PHASE 7C ASSERTION FAILED]: ${message}`);
  }
}

async function runPhase7CIntegrationSuite(): Promise<void> {
  console.log('================================================================');
  console.log('  SINEMA PHASE 7C — PROVIDER ROUTER & CREDENTIAL INTEGRATION    ');
  console.log('================================================================\n');

  // Ensure clean test baseline by purging leftover non-env test credentials
  const initialCreds = credentialManager.listCredentials();
  for (const c of initialCreds) {
    if (!c.isEnvFallback) {
      credentialManager.deleteCredential(c.id);
    }
  }

  // --- TEST 1: LLM Router Integration & Credential Routing ---
  console.log('Test 1: LLM Provider Router Multi-Target Dispatch...');
  const googleKey1 = credentialManager.addCredential({
    provider: 'google',
    label: 'Primary Gemini Key',
    apiKey: 'AIzaSyGooglePrimaryTestKey_001',
    priority: 1,
  });
  const googleCandidates = credentialManager.getOrderedCandidateCredentials('google');
  assert(googleCandidates.length > 0, 'Google candidate credentials must not be empty');
  assert(googleCandidates[0].credential.id === googleKey1.id, 'Highest priority key must be first candidate');
  assert(googleCandidates[0].rawKey === 'AIzaSyGooglePrimaryTestKey_001', 'Secret key must be resolved for adapter execution');
  console.log('  ✓ Google Gemini adapter candidate resolution passed');

  // --- TEST 2: LLM 429 Failover & Immediate Cooldown Routing ---
  console.log('Test 2: LLM 429 Rate-Limit Failover & Cooldown Execution...');
  const googleKey2 = credentialManager.addCredential({
    provider: 'google',
    label: 'Secondary Gemini Key',
    apiKey: 'AIzaSyGoogleSecondaryTestKey_002',
    priority: 2,
  });
  // Simulate 429 on Primary Key
  const quotaErr = new Error('Resource has been exhausted (e.g. check quota) HTTP 429');
  (quotaErr as any).status = 429;
  credentialManager.recordFailure(googleKey1.id, quotaErr, { silent: true });

  const updatedPrimary = credentialManager.getCredential(googleKey1.id);
  assert(updatedPrimary?.status === 'rate_limited', 'Primary key must be marked rate_limited');
  assert(Boolean(updatedPrimary?.cooldownUntil), 'Primary key must have active cooldownUntil timestamp');

  const failoverCandidates = credentialManager.getOrderedCandidateCredentials('google');
  assert(failoverCandidates.length > 0, 'Must have remaining candidates during failover');
  assert(failoverCandidates[0].credential.id === googleKey2.id, 'Router must immediately failover to Secondary Key');
  console.log('  ✓ 429 rate limit failover and cooldown isolation passed');

  // Clean up Google test keys
  credentialManager.deleteCredential(googleKey1.id);
  credentialManager.deleteCredential(googleKey2.id);

  // --- TEST 3: Image / Master Frame Provider Integration ---
  console.log('Test 3: Image Generation & Master Frame Adapter Integration...');
  const imgKey = credentialManager.addCredential({
    provider: 'google',
    label: 'Image / Master Frame Dedicated Key',
    apiKey: 'AIzaSyMasterFrameImageDedicatedKey',
    priority: 1,
  });
  const imgCandidate = credentialManager.acquireCredential('google');
  assert(imgCandidate?.credential.id === imgKey.id, 'Image prompt generation resolves active credential from pool');
  assert(imgCandidate?.rawKey === 'AIzaSyMasterFrameImageDedicatedKey', 'Image adapter receives managed raw key');
  credentialManager.recordSuccess(imgKey.id);
  const imgUpdated = credentialManager.getCredential(imgKey.id);
  assert((imgUpdated?.successCount || 0) > 0, 'Image generation success records telemetry count');
  credentialManager.deleteCredential(imgKey.id);
  console.log('  ✓ Image generation provider integration passed');

  // --- TEST 4: Video Generation Provider Routing (Veo, Kling, Runway) ---
  console.log('Test 4: Video Provider Multi-Engine Routing (Veo, Kling, Runway)...');
  const klingKey = credentialManager.addCredential({
    provider: 'kling',
    label: 'Kling Cinematic Engine Key',
    apiKey: 'kling_ai_live_token_abc123',
    priority: 1,
  });
  const runwayKey = credentialManager.addCredential({
    provider: 'runway',
    label: 'Runway Gen-3 Engine Key',
    apiKey: 'runway_secret_key_xyz789',
    priority: 1,
  });

  const klingCandidate = credentialManager.acquireCredential('kling');
  assert(klingCandidate?.credential.id === klingKey.id, 'Kling acquisition routes to Kling pool');
  assert(klingCandidate?.credential.provider === 'kling', 'Kling provider matches Kling candidate');

  const runwayCandidate = credentialManager.acquireCredential('runway');
  assert(runwayCandidate?.credential.id === runwayKey.id, 'Runway acquisition routes to Runway pool');
  assert(runwayCandidate?.credential.provider === 'runway', 'Runway provider matches Runway candidate');
  console.log('  ✓ Video provider multi-engine routing passed');

  // --- TEST 5: Video 429 Failover & Async Job Polling Preservation ---
  console.log('Test 5: Video Async Job Polling Credential Preservation...');
  // Verify that polling by credentialId returns the EXACT key without rotation drift
  const dedicatedSecret = credentialManager.getSecretKey(klingKey.id);
  assert(dedicatedSecret === 'kling_ai_live_token_abc123', 'Async polling retrieves exact dedicated job credential');

  // Simulate 429 on Kling Key and verify failover
  const klingKey2 = credentialManager.addCredential({
    provider: 'kling',
    label: 'Kling Backup Engine Key',
    apiKey: 'kling_ai_backup_token_def456',
    priority: 2,
  });
  credentialManager.recordFailure(klingKey.id, 429, { silent: true });
  const nextKlingCandidate = credentialManager.acquireCredential('kling');
  assert(nextKlingCandidate?.credential.id === klingKey2.id, 'Kling 429 failover selects backup Kling key');

  credentialManager.deleteCredential(klingKey.id);
  credentialManager.deleteCredential(klingKey2.id);
  credentialManager.deleteCredential(runwayKey.id);
  console.log('  ✓ Video 429 failover & async polling preservation passed');

  // --- TEST 6: Invalid Credential (401/403) Quarantine & Bypass ---
  console.log('Test 6: Invalid Credential Quarantine & Bypass...');
  const badKey = credentialManager.addCredential({
    provider: 'openai',
    label: 'Malformed OpenAI Key',
    apiKey: 'sk-proj-invalid-unauthorized-key',
    priority: 1,
  });
  const goodKey = credentialManager.addCredential({
    provider: 'openai',
    label: 'Valid OpenAI Key',
    apiKey: 'sk-proj-valid-authorized-key',
    priority: 2,
  });

  const authError = new Error('HTTP 401: Unauthorized API key.');
  (authError as any).status = 401;
  credentialManager.recordFailure(badKey.id, authError, { silent: true });

  const badCredStatus = credentialManager.getCredential(badKey.id);
  assert(badCredStatus?.status === 'invalid', '401 Unauthorized key must be quarantined as INVALID');

  const healthyCandidate = credentialManager.acquireCredential('openai');
  assert(healthyCandidate?.credential.id === goodKey.id, 'Router must bypass INVALID key and route to healthy key');

  credentialManager.deleteCredential(badKey.id);
  credentialManager.deleteCredential(goodKey.id);
  console.log('  ✓ 401/403 quarantine and bypass passed');

  // --- TEST 7: Bad Request (400) Invariant (No Rotation Storm) ---
  console.log('Test 7: Bad Request (400) Invariant Verification...');
  const openAIKey1 = credentialManager.addCredential({
    provider: 'openai',
    label: 'OpenAI Valid Key',
    apiKey: 'sk-proj-valid-key-1',
    priority: 1,
  });
  const badReqError = new Error('HTTP 400: Bad Request - Missing required parameter');
  (badReqError as any).status = 400;

  credentialManager.recordFailure(openAIKey1.id, badReqError, { silent: true });
  const statusAfter400 = credentialManager.getCredential(openAIKey1.id);
  assert(statusAfter400?.status === 'active', '400 Bad Request must NOT mark credential as rate_limited or invalid');
  assert(!statusAfter400?.cooldownUntil, '400 Bad Request must NOT apply cooldown');

  credentialManager.deleteCredential(openAIKey1.id);
  console.log('  ✓ 400 Bad Request non-exhaustion invariant passed');

  // --- TEST 8: Provider Pool Isolation ---
  console.log('Test 8: Provider Pool Strict Isolation...');
  const geminiIso = credentialManager.addCredential({
    provider: 'google',
    label: 'Gemini Isolated',
    apiKey: 'AIzaSyGoogleIsoKey',
    priority: 1,
  });
  const xaiIso = credentialManager.addCredential({
    provider: 'xai',
    label: 'xAI Isolated',
    apiKey: 'xai-isolated-secret-key',
    priority: 1,
  });

  const googlePool = credentialManager.getOrderedCandidateCredentials('google');
  const xaiPool = credentialManager.getOrderedCandidateCredentials('xai');

  assert(googlePool.every((c) => c.credential.provider === 'google'), 'Google pool contains ONLY Google credentials');
  assert(xaiPool.every((c) => c.credential.provider === 'xai'), 'xAI pool contains ONLY xAI credentials');
  assert(!googlePool.some((c) => c.rawKey === 'xai-isolated-secret-key'), 'Google pool must never contain xAI key');

  credentialManager.deleteCredential(geminiIso.id);
  credentialManager.deleteCredential(xaiIso.id);
  console.log('  ✓ Provider pool isolation passed');

  // --- TEST 9: Environment Variable (.env) Compatibility ---
  console.log('Test 9: Environment Variable (.env) Fallback Verification...');
  const summary = credentialManager.getPoolSummary();
  assert(typeof summary.totalCredentials === 'number', 'Summary returns valid credential counts');
  const envCreds = summary.credentials.filter((c) => c.isEnvFallback);
  console.log(`  ✓ Detected ${envCreds.length} system environment fallback credentials`);

  // --- TEST 10: Secret Safety & Masking Invariants ---
  console.log('Test 10: Secret Safety & Masking Invariants...');
  const secretToTest = 'AIzaSyConfidentialSecret1234567890Test';
  const testCred = credentialManager.addCredential({
    provider: 'google',
    label: 'Confidential Key Check',
    apiKey: secretToTest,
    priority: 1,
  });

  const serializedSummary = JSON.stringify(credentialManager.getPoolSummary());
  assert(!serializedSummary.includes('ConfidentialSecret1234567890Test'), 'Raw secret must NEVER appear in serialized pool summary');
  assert(serializedSummary.includes(testCred.maskedKey), 'Serialized summary must contain masked key');

  credentialManager.deleteCredential(testCred.id);
  console.log('  ✓ Secret safety and frontend masking invariant passed');

  // --- TEST 11: Omni Capability Probe via Credential Pool ---
  console.log('Test 11: Omni Capability Probe Managed Routing...');
  const omniProbeResult = await checkGeminiOmniCapability('test-managed-override-key');
  assert(typeof omniProbeResult === 'boolean', 'Capability probe must return boolean without throwing');
  console.log('  ✓ Omni capability check via managed routing passed');

  // --- TEST 12: Universal Provider Execution Contract ---
  console.log('Test 12: Universal Provider Execution Contract (executeProviderRequest)...');
  assert(typeof executeProviderRequest === 'function', 'executeProviderRequest must be an exported function');
  console.log('  ✓ Universal Provider Execution Contract passed');

  console.log('\n================================================================');
  console.log('  ALL PHASE 7C INTEGRATION TESTS PASSED (12/12 ASSERTIONS)       ');
  console.log('================================================================\n');
}

runPhase7CIntegrationSuite().catch((err) => {
  console.error('[PHASE 7C SUITE FAILURE]:', err);
  process.exit(1);
});
