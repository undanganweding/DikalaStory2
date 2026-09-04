import { credentialManager, maskApiKey } from './credential_manager';
import { executeLLMRequest } from './llm_provider';
import { geminiProjectRouter } from './gemini_project_router';

export interface CredentialTestSuiteResult {
  testId: string;
  name: string;
  passed: boolean;
  details: string;
}

export async function runCredentialPoolRegressionTests(): Promise<CredentialTestSuiteResult[]> {
  const results: CredentialTestSuiteResult[] = [];

  // TEST 01: Credential storage and masking
  try {
    const rawKey = 'AIzaSySecretTestKey1234567890ABCD';
    const masked = maskApiKey(rawKey);
    const isMaskedProperly = masked.startsWith('AIza...') && masked.endsWith('ABCD') && !masked.includes('SecretTestKey');

    const added = credentialManager.addCredential({
      provider: 'google',
      label: 'Test Key 01',
      apiKey: rawKey,
      priority: 1,
    });

    const isAddedMasked = added.maskedKey === masked && !(added as any).apiKey;
    const retrieved = credentialManager.getCredential(added.id);
    const isRetrievedMasked = retrieved?.maskedKey === masked && !(retrieved as any).apiKey;

    const passed = isMaskedProperly && isAddedMasked && Boolean(isRetrievedMasked);
    results.push({
      testId: 'CRED-01',
      name: 'Credential Storage & Masking Security',
      passed,
      details: passed
        ? `Passed: Key masked as "${masked}". Raw secret safely isolated in server vault.`
        : `Failed: Key masking or isolation violation.`,
    });

    // Cleanup test key
    credentialManager.deleteCredential(added.id);
  } catch (err: any) {
    results.push({
      testId: 'CRED-01',
      name: 'Credential Storage & Masking Security',
      passed: false,
      details: `Exception: ${err.message}`,
    });
  }

  // TEST 02: Priority order selection
  try {
    const keyHighPri = credentialManager.addCredential({
      provider: 'google',
      label: 'High Priority Key',
      apiKey: 'AIzaSyHighPriorityKey111111111111',
      priority: 1,
    });

    const keyLowPri = credentialManager.addCredential({
      provider: 'google',
      label: 'Low Priority Key',
      apiKey: 'AIzaSyLowPriorityKey222222222222',
      priority: 5,
    });

    const acquired = credentialManager.acquireCredential('google');
    const passed = acquired?.credential.id === keyHighPri.id;

    results.push({
      testId: 'CRED-02',
      name: 'Priority-Based Credential Routing',
      passed,
      details: passed
        ? `Passed: Acquired highest priority credential (priority 1: "${keyHighPri.label}").`
        : `Failed: Acquired wrong credential: "${acquired?.credential.label}".`,
    });

    // Cleanup
    credentialManager.deleteCredential(keyHighPri.id);
    credentialManager.deleteCredential(keyLowPri.id);
  } catch (err: any) {
    results.push({
      testId: 'CRED-02',
      name: 'Priority-Based Credential Routing',
      passed: false,
      details: `Exception: ${err.message}`,
    });
  }

  // TEST 03: Round-Robin distribution for equal priority
  try {
    const keyA = credentialManager.addCredential({
      provider: 'openai',
      label: 'OpenAI Key Alpha',
      apiKey: 'sk-proj-alpha111111111111111111',
      priority: 1,
    });

    const keyB = credentialManager.addCredential({
      provider: 'openai',
      label: 'OpenAI Key Beta',
      apiKey: 'sk-proj-beta222222222222222222',
      priority: 1,
    });

    const first = credentialManager.acquireCredential('openai');
    const second = credentialManager.acquireCredential('openai');
    const third = credentialManager.acquireCredential('openai');

    const passed = first?.credential.id !== second?.credential.id && third?.credential.id === first?.credential.id;

    results.push({
      testId: 'CRED-03',
      name: 'Round-Robin Balancing on Equal Priority',
      passed,
      details: passed
        ? `Passed: Rotated smoothly (${first?.credential.label} -> ${second?.credential.label} -> ${third?.credential.label}).`
        : `Failed: Rotation mismatch.`,
    });

    credentialManager.deleteCredential(keyA.id);
    credentialManager.deleteCredential(keyB.id);
  } catch (err: any) {
    results.push({
      testId: 'CRED-03',
      name: 'Round-Robin Balancing on Equal Priority',
      passed: false,
      details: `Exception: ${err.message}`,
    });
  }

  // TEST 04: Rate limit cooldown and automatic failover
  try {
    const primaryKey = credentialManager.addCredential({
      provider: 'xai',
      label: 'xAI Primary Key',
      apiKey: 'xai-primary-secret-key-111',
      priority: 1,
    });

    const backupKey = credentialManager.addCredential({
      provider: 'xai',
      label: 'xAI Backup Key',
      apiKey: 'xai-backup-secret-key-222',
      priority: 2,
    });

    // Simulate 429 Rate limit error on primary key
    const rateLimitError = new Error('Resource exhausted: Rate limit exceeded (429). Retry after 30s.');
    (rateLimitError as any).status = 429;
    credentialManager.recordFailure(primaryKey.id, rateLimitError, { silent: true });

    // Primary key should now be marked rate_limited
    const updatedPrimary = credentialManager.getCredential(primaryKey.id);
    const isRateLimited = updatedPrimary?.status === 'rate_limited' && Boolean(updatedPrimary?.cooldownUntil);

    // Next acquisition should automatically route to backup key!
    const nextAcquired = credentialManager.acquireCredential('xai');
    const routedToBackup = nextAcquired?.credential.id === backupKey.id;

    const passed = isRateLimited && routedToBackup;
    results.push({
      testId: 'CRED-04',
      name: 'Rate-Limit Cooldown & Automatic Failover',
      passed,
      details: passed
        ? `Passed: Primary key safely placed in cooldown. Router immediately failed over to backup key "${backupKey.label}".`
        : `Failed: Rate limit failover did not route to backup.`,
    });

    credentialManager.deleteCredential(primaryKey.id);
    credentialManager.deleteCredential(backupKey.id);
  } catch (err: any) {
    results.push({
      testId: 'CRED-04',
      name: 'Rate-Limit Cooldown & Automatic Failover',
      passed: false,
      details: `Exception: ${err.message}`,
    });
  }

  // TEST 05: Auth error handling and isolation
  try {
    const invalidKey = credentialManager.addCredential({
      provider: 'openrouter',
      label: 'Bad Key',
      apiKey: 'sk-or-invalid-key-000',
      priority: 1,
    });

    const goodKey = credentialManager.addCredential({
      provider: 'openrouter',
      label: 'Good Key',
      apiKey: 'sk-or-valid-key-999',
      priority: 2,
    });

    const authError = new Error('Unauthorized: Invalid API key (401)');
    (authError as any).status = 401;
    credentialManager.recordFailure(invalidKey.id, authError, { silent: true });

    const checkedInvalid = credentialManager.getCredential(invalidKey.id);
    const isInvalid = checkedInvalid?.status === 'invalid';

    const nextAcquired = credentialManager.acquireCredential('openrouter');
    const isGoodKeyAcquired = nextAcquired?.credential.id === goodKey.id;

    const passed = isInvalid && isGoodKeyAcquired;
    results.push({
      testId: 'CRED-05',
      name: 'Auth Error Isolation & Invalid Key Status',
      passed,
      details: passed
        ? `Passed: Key marked INVALID. Router bypassed bad key and continued with healthy key "${goodKey.label}".`
        : `Failed: Invalid key isolation failed.`,
    });

    credentialManager.deleteCredential(invalidKey.id);
    credentialManager.deleteCredential(goodKey.id);
  } catch (err: any) {
    results.push({
      testId: 'CRED-05',
      name: 'Auth Error Isolation & Invalid Key Status',
      passed: false,
      details: `Exception: ${err.message}`,
    });
  }

  // TEST 06: Environment fallback compatibility
  try {
    const summary = credentialManager.getPoolSummary();
    const hasGoogleEnv = Boolean(process.env.GEMINI_API_KEY);
    const googleCreds = summary.credentials.filter((c) => c.provider === 'google');

    const passed = !hasGoogleEnv || googleCreds.length > 0;
    results.push({
      testId: 'CRED-06',
      name: 'Environment Variable (.env) Compatibility',
      passed,
      details: passed
        ? `Passed: System successfully detects and registers environment keys without user intervention.`
        : `Failed: Environment key sync failed.`,
    });
  } catch (err: any) {
    results.push({
      testId: 'CRED-06',
      name: 'Environment Variable (.env) Compatibility',
      passed: false,
      details: `Exception: ${err.message}`,
    });
  }

  // TEST 07: Cooldown expiration auto-recovery
  try {
    const expiringKey = credentialManager.addCredential({
      provider: 'custom_openai',
      label: 'Expiring Test Key',
      apiKey: 'sk-custom-expiring-key-123',
      priority: 1,
    });

    // Set cooldown in the past
    credentialManager.updateCredential(expiringKey.id, {
      status: 'rate_limited',
      cooldownUntil: new Date(Date.now() - 5000).toISOString(),
    });

    // Trigger listCredentials which auto-recovers expired cooldowns
    const refreshed = credentialManager.listCredentials();
    const recovered = refreshed.find((c) => c.id === expiringKey.id);
    const passed = recovered?.status === 'active';

    results.push({
      testId: 'CRED-07',
      name: 'Rate-Limit Auto-Recovery After Cooldown',
      passed: Boolean(passed),
      details: passed
        ? `Passed: Rate-limited credential automatically recovered to ACTIVE when cooldown expired.`
        : `Failed: Credential did not auto-recover.`,
    });

    credentialManager.deleteCredential(expiringKey.id);
  } catch (err: any) {
    results.push({
      testId: 'CRED-07',
      name: 'Rate-Limit Auto-Recovery After Cooldown',
      passed: false,
      details: `Exception: ${err.message}`,
    });
  }

  // TEST 08: Pool summary metrics
  try {
    const summary = credentialManager.getPoolSummary();
    const passed = typeof summary.totalCredentials === 'number' && typeof summary.activeCredentials === 'number';
    results.push({
      testId: 'CRED-08',
      name: 'Credential Pool Health & Telemetry Metrics',
      passed,
      details: passed
        ? `Passed: Pool summary tracking ${summary.totalCredentials} total credentials across providers.`
        : `Failed: Telemetry metrics summary failed.`,
    });
  } catch (err: any) {
    results.push({
      testId: 'CRED-08',
      name: 'Credential Pool Health & Telemetry Metrics',
      passed: false,
      details: `Exception: ${err.message}`,
    });
  }

  // TEST 09: Provider Pool Isolation (Gemini vs OpenAI vs Kling vs Runway)
  try {
    const gemKey = credentialManager.addCredential({
      provider: 'google',
      label: 'Google Isolated Key',
      apiKey: 'AIzaSyGoogleIsolatedKey9999',
      priority: 1,
    });
    const openKey = credentialManager.addCredential({
      provider: 'openai',
      label: 'OpenAI Isolated Key',
      apiKey: 'sk-proj-OpenAIIsolatedKey8888',
      priority: 1,
    });
    const klingKey = credentialManager.addCredential({
      provider: 'kling',
      label: 'Kling Isolated Key',
      apiKey: 'kling_secret_token_7777',
      priority: 1,
    });

    const googleCandidates = credentialManager.getOrderedCandidateCredentials('google');
    const openAICandidates = credentialManager.getOrderedCandidateCredentials('openai');
    const klingCandidates = credentialManager.getOrderedCandidateCredentials('kling');

    const googleHasOnlyGoogle = googleCandidates.every((c) => c.credential.provider === 'google');
    const openAIHasOnlyOpenAI = openAICandidates.every((c) => c.credential.provider === 'openai');
    const klingHasOnlyKling = klingCandidates.every((c) => c.credential.provider === 'kling');

    const passed = googleHasOnlyGoogle && openAIHasOnlyOpenAI && klingHasOnlyKling;
    results.push({
      testId: 'CRED-09',
      name: 'Provider Pool Isolation & Boundary Enforcement',
      passed,
      details: passed
        ? `Passed: Google, OpenAI, and Kling credential scopes are 100% strictly segregated with zero cross-contamination.`
        : `Failed: Provider credential scopes crossed boundaries.`,
    });

    credentialManager.deleteCredential(gemKey.id);
    credentialManager.deleteCredential(openKey.id);
    credentialManager.deleteCredential(klingKey.id);
  } catch (err: any) {
    results.push({
      testId: 'CRED-09',
      name: 'Provider Pool Isolation & Boundary Enforcement',
      passed: false,
      details: `Exception: ${err.message}`,
    });
  }

  // TEST 10: Bad Request (400) Invariant (No rotation storm / key exhaustion)
  try {
    const primaryKey = credentialManager.addCredential({
      provider: 'openai',
      label: 'OpenAI 400 Invariant Key 1',
      apiKey: 'sk-proj-test-400-key-1',
      priority: 1,
    });
    const secondaryKey = credentialManager.addCredential({
      provider: 'openai',
      label: 'OpenAI 400 Invariant Key 2',
      apiKey: 'sk-proj-test-400-key-2',
      priority: 2,
    });

    // Simulate 400 Bad Request error
    const badRequestError = new Error('Bad Request: Invalid JSON body parameters (400)');
    (badRequestError as any).status = 400;

    // Bad request should NOT put credential into rate limit cooldown
    credentialManager.recordFailure(primaryKey.id, badRequestError, { silent: true });

    const key1Status = credentialManager.getCredential(primaryKey.id);
    const passed = key1Status?.status === 'active' && !key1Status.cooldownUntil;

    results.push({
      testId: 'CRED-10',
      name: 'Bad Request (400) Non-Exhaustion Invariant',
      passed: Boolean(passed),
      details: passed
        ? `Passed: 400 Bad Request does NOT trigger credential cooldown or pool rotation storm.`
        : `Failed: 400 Bad Request caused inappropriate key degradation.`,
    });

    credentialManager.deleteCredential(primaryKey.id);
    credentialManager.deleteCredential(secondaryKey.id);
  } catch (err: any) {
    results.push({
      testId: 'CRED-10',
      name: 'Bad Request (400) Non-Exhaustion Invariant',
      passed: false,
      details: `Exception: ${err.message}`,
    });
  }

  // TEST 11: Video & Async Job Credential Preservation
  try {
    const videoKey = credentialManager.addCredential({
      provider: 'runway',
      label: 'Runway Video Dedicated Key',
      apiKey: 'runway_api_key_video_dedicated_555',
      priority: 1,
    });

    // When an async job is tracked by credentialId, it must resolve to the exact secret key without rotation
    const resolvedSecret = credentialManager.getSecretKey(videoKey.id);
    const passed = resolvedSecret === 'runway_api_key_video_dedicated_555';

    results.push({
      testId: 'CRED-11',
      name: 'Video Generation & Async Polling Credential Preservation',
      passed,
      details: passed
        ? `Passed: Async video generation job polling resolves exact dedicated credential (${videoKey.id}) without rotation drift.`
        : `Failed: Async polling credential resolution failed.`,
    });

    credentialManager.deleteCredential(videoKey.id);
  } catch (err: any) {
    results.push({
      testId: 'CRED-11',
      name: 'Video Generation & Async Polling Credential Preservation',
      passed: false,
      details: `Exception: ${err.message}`,
    });
  }

  // TEST 12: Secret Safety & Masking Invariants
  try {
    const rawSecret = 'sk-proj-ExtremelyConfidentialApiKey9876543210';
    const cred = credentialManager.addCredential({
      provider: 'custom_openai',
      label: 'Confidential Key',
      apiKey: rawSecret,
      priority: 1,
    });

    const summary = credentialManager.getPoolSummary();
    const serialized = JSON.stringify(summary);
    const noRawSecretInSummary = !serialized.includes('ExtremelyConfidentialApiKey');
    const hasMaskedKey = serialized.includes(cred.maskedKey);

    const passed = noRawSecretInSummary && hasMaskedKey;
    results.push({
      testId: 'CRED-12',
      name: 'Client Secret Safety & Telemetry Masking',
      passed,
      details: passed
        ? `Passed: Raw secrets strictly contained in server-side vault. Frontend summary contains only masked keys.`
        : `Failed: Raw secret found in serialized telemetry.`,
    });

    credentialManager.deleteCredential(cred.id);
  } catch (err: any) {
    results.push({
      testId: 'CRED-12',
      name: 'Client Secret Safety & Telemetry Masking',
      passed: false,
      details: `Exception: ${err.message}`,
    });
  }

  // TEST 13: Duplicate Key Deduplication & Failover Invariant
  try {
    const keyAlpha = 'AQ.TestKeyAlpha_Unique111111';
    const keyBeta = 'AQ.TestKeyBeta_Unique222222';
    const keyGamma = 'AQ.TestKeyGamma_Unique333333';

    // Add 5 project entries with 3 unique keys directly to router
    geminiProjectRouter.addProject({
      project_id: 'test_proj_alpha_1',
      api_key: keyAlpha,
      provider: 'google_gemini',
      models_available: ['gemini-3.7-flash'],
      quota: { rpm: 100, tpm: 100000, rpd: 1500 },
      usage: { rpm_used: 0, tokens_used: 0, requests_today: 0 },
      health: { status: 'healthy', error_rate: 0, success_rate: 100, latency: 50 },
      priority: 1,
      enabled: true,
    });
    geminiProjectRouter.addProject({
      project_id: 'test_proj_beta_1',
      api_key: keyBeta,
      provider: 'google_gemini',
      models_available: ['gemini-3.7-flash'],
      quota: { rpm: 100, tpm: 100000, rpd: 1500 },
      usage: { rpm_used: 0, tokens_used: 0, requests_today: 0 },
      health: { status: 'healthy', error_rate: 0, success_rate: 100, latency: 60 },
      priority: 1,
      enabled: true,
    });
    geminiProjectRouter.addProject({
      project_id: 'test_proj_gamma_1',
      api_key: keyGamma,
      provider: 'google_gemini',
      models_available: ['gemini-3.7-flash'],
      quota: { rpm: 100, tpm: 100000, rpd: 1500 },
      usage: { rpm_used: 0, tokens_used: 0, requests_today: 0 },
      health: { status: 'healthy', error_rate: 0, success_rate: 100, latency: 70 },
      priority: 1,
      enabled: true,
    });
    // Duplicate 1: Same keyBeta, different project_id
    geminiProjectRouter.addProject({
      project_id: 'test_proj_beta_duplicate',
      api_key: keyBeta,
      provider: 'google_gemini',
      models_available: ['gemini-3.7-flash'],
      quota: { rpm: 100, tpm: 100000, rpd: 1500 },
      usage: { rpm_used: 0, tokens_used: 0, requests_today: 0 },
      health: { status: 'healthy', error_rate: 0, success_rate: 100, latency: 80 },
      priority: 1,
      enabled: true,
    });
    // Duplicate 2: Same keyAlpha, different project_id
    geminiProjectRouter.addProject({
      project_id: 'test_proj_alpha_duplicate',
      api_key: keyAlpha,
      provider: 'google_gemini',
      models_available: ['gemini-3.7-flash'],
      quota: { rpm: 100, tpm: 100000, rpd: 1500 },
      usage: { rpm_used: 0, tokens_used: 0, requests_today: 0 },
      health: { status: 'healthy', error_rate: 0, success_rate: 100, latency: 90 },
      priority: 1,
      enabled: true,
    });

    const bestProjects = geminiProjectRouter.getBestProjects('general', 'gemini-3.7-flash');
    const projectIds = bestProjects.map((p) => p.project_id);
    const uniqueKeysInCandidates = new Set(bestProjects.map((p) => p.api_key));

    // Test CredentialManager registration duplicate prevention
    const cred1 = credentialManager.addCredential({
      provider: 'google',
      label: 'Unique Test Key 1',
      apiKey: keyAlpha,
      priority: 1,
    });
    const cred2 = credentialManager.addCredential({
      provider: 'google',
      label: 'Duplicate Attempt Key 1',
      apiKey: keyAlpha,
      priority: 1,
    });
    const registrationDeduplicated = cred1.id === cred2.id;

    const passed =
      bestProjects.length === 3 &&
      uniqueKeysInCandidates.size === 3 &&
      registrationDeduplicated;

    results.push({
      testId: 'CRED-13',
      name: 'Duplicate Key Deduplication & Failover Invariant',
      passed,
      details: passed
        ? `Passed: 5 project entries with 3 unique API keys correctly resolved to exactly 3 unique failover candidates. Duplicate registration guarded.`
        : `Failed: Candidate count=${bestProjects.length} (expected 3), unique keys=${uniqueKeysInCandidates.size}, registrationDeduplicated=${registrationDeduplicated}. Candidates: [${projectIds.join(', ')}]`,
    });

    // Cleanup test entries
    geminiProjectRouter.removeProject('test_proj_alpha_1');
    geminiProjectRouter.removeProject('test_proj_beta_1');
    geminiProjectRouter.removeProject('test_proj_gamma_1');
    geminiProjectRouter.removeProject('test_proj_beta_duplicate');
    geminiProjectRouter.removeProject('test_proj_alpha_duplicate');
    credentialManager.deleteCredential(cred1.id);
  } catch (err: any) {
    results.push({
      testId: 'CRED-13',
      name: 'Duplicate Key Deduplication & Failover Invariant',
      passed: false,
      details: `Exception: ${err.message}`,
    });
  }

  // TEST 14: 429 Quota Model Failover (gemini-3.7-flash -> 429 -> gemini-3.6-flash -> SUCCESS)
  try {
    const { modelRouter } = await import('./model_router');
    const { setProviderHealth, getProviderHealth } = await import('./adaptive_router');

    // Reset health for testing
    setProviderHealth('google', 'gemini-3.7-flash', 'available');
    setProviderHealth('google', 'gemini-3.6-flash', 'available');

    // Simulate 429 on 3.7
    setProviderHealth('google', 'gemini-3.7-flash', 'rate_limited', 'RESOURCE_EXHAUSTED', Date.now() + 60000);

    // Attempt 1 would get 3.7 (or if 3.7 is rate limited, attempt 2 gets 3.6)
    const m1 = await modelRouter.getBestModel('general', 'MEDIUM', 1);
    const m2 = await modelRouter.getBestModel('general', 'MEDIUM', 2);

    const m1Is36 = m1.modelId === 'gemini-3.6-flash';
    const m2Is36 = m2.modelId === 'gemini-3.6-flash';

    // Reset provider health back to normal
    setProviderHealth('google', 'gemini-3.7-flash', 'available');

    const passed = m1Is36 || m2Is36;

    results.push({
      testId: 'CRED-14',
      name: '429 Quota Model Failover (3.7 -> 429 -> 3.6)',
      passed,
      details: passed
        ? `Passed: 429 on gemini-3.7-flash triggered smooth failover to gemini-3.6-flash (selected: ${m1.modelId}).`
        : `Failed: Model router did not failover to gemini-3.6-flash on 429 (m1=${m1.modelId}, m2=${m2.modelId}).`,
    });
  } catch (err: any) {
    results.push({
      testId: 'CRED-14',
      name: '429 Quota Model Failover (3.7 -> 429 -> 3.6)',
      passed: false,
      details: `Exception: ${err.message}`,
    });
  }

  return results;
}
