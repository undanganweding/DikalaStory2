import { healthService } from './health_service';
import { db, firestoreDb } from '../db';
import { supabaseDb } from '../db/supabase_db';
import { AICredential, AIHealth } from '../../src/types';

console.log('==================================================');
console.log('RUNNING TARGETED HEALTH CLASSIFIER TEST SUITE...');
console.log('==================================================\n');

interface TestCase {
  name: string;
  errorMsg: string;
  statusCode?: number;
  expectedType: string;
  expectedCooldown?: number;
}

const testCases: TestCase[] = [
  {
    name: 'A. Google DAILY request quota 429',
    errorMsg: 'Resource has been exhausted (e.g. queries per day limit reached). [429] GenerateRequestsPerDayPerProjectPerModel-FreeTier',
    statusCode: 429,
    expectedType: 'QUOTA_EXHAUSTED_ERROR',
  },
  {
    name: 'B. Google DAILY input-token quota 429',
    errorMsg: 'GenerateContentInputTokensPerModelPerDay-FreeTier limit exceeded.',
    statusCode: 429,
    expectedType: 'QUOTA_EXHAUSTED_ERROR',
  },
  {
    name: 'C. Google RPM 429',
    errorMsg: 'Rate limit exceeded for models/gemini-2.5-flash (RPM). Too many requests in 1 minute.',
    statusCode: 429,
    expectedType: 'RATE_LIMIT_ERROR',
    expectedCooldown: 60 * 1000,
  },
  {
    name: 'D. Google Generic 503',
    errorMsg: 'The service is temporarily unavailable.',
    statusCode: 503,
    expectedType: 'SERVER_5XX_ERROR',
    expectedCooldown: 2 * 60 * 1000,
  },
  {
    name: 'D2. Google Transient Demand 503',
    errorMsg: 'The service is temporarily unavailable due to high demand.',
    statusCode: 503,
    expectedType: 'SERVER_5XX_ERROR',
    expectedCooldown: 3 * 1000,
  },
  {
    name: 'E. 401/403 authorization failure',
    errorMsg: 'API key not valid or unauthorized access [403 Forbidden]',
    statusCode: 403,
    expectedType: 'AUTHENTICATION_ERROR',
  },
  {
    name: 'F. Non-quota 429 containing generic rate-limit wording',
    errorMsg: 'Too many requests. Rate limit has been reached, please try again in a bit.',
    statusCode: 429,
    expectedType: 'RATE_LIMIT_ERROR',
    expectedCooldown: 60 * 1000,
  }
];

let failedCount = 0;

for (const tc of testCases) {
  const result = healthService.classifyError(tc.errorMsg, tc.statusCode);
  const typeMatch = result.errorType === tc.expectedType;
  const cooldownMatch = tc.expectedCooldown === undefined || result.cooldownMs === tc.expectedCooldown;

  if (typeMatch && cooldownMatch) {
    console.log(`✅ [PASS] ${tc.name}`);
  } else {
    failedCount++;
    console.log(`❌ [FAIL] ${tc.name}`);
    console.log(`   Input Message: "${tc.errorMsg}"`);
    console.log(`   Input Status:   ${tc.statusCode}`);
    console.log(`   Expected Type:  ${tc.expectedType}, Got: ${result.errorType}`);
    if (tc.expectedCooldown !== undefined) {
      console.log(`   Expected Cooldown: ${tc.expectedCooldown}ms, Got: ${result.cooldownMs}ms`);
    }
  }
}

// =========================================================================
// ADDED SENSITIVE DB PERSISTENCE / CIRCUITE-BREAKER INTEGRITY VERIFICATION
// =========================================================================
console.log('\n--------------------------------------------------');
console.log('RUNNING TARGETED DB PERSISTENCE & CIRCUIT BREAKER TESTS...');
console.log('--------------------------------------------------');

(async () => {
  // Store original methods for both Supabase and Firestore drivers
  const origGetCredentialSupabase = supabaseDb.getCredential;
  const origGetHealthSupabase = supabaseDb.getHealth;
  const origSaveCredentialSupabase = supabaseDb.saveCredential;
  const origSaveHealthSupabase = supabaseDb.saveHealth;

  const origGetCredentialFirestore = firestoreDb.getCredential;
  const origGetHealthFirestore = firestoreDb.getHealth;
  const origSaveCredentialFirestore = firestoreDb.saveCredential;
  const origSaveHealthFirestore = firestoreDb.saveHealth;

  try {
    const mockCredentialId = 'test_cred_suppression_prevention';
    
    // Mock credential state
    let credentialState: AICredential = {
      id: mockCredentialId,
      name: 'Test Key for Quota Integration',
      providerId: 'google',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any;

    // Mock health state
    let healthState: AIHealth = {
      credentialId: mockCredentialId,
      status: 'healthy',
      consecutiveFailures: 0,
      successRate: 100,
      updatedAt: Date.now(),
    };

    // Spy tracking flags
    let saveCredentialCalls: AICredential[] = [];
    let saveHealthCalls: AIHealth[] = [];

    // Define mock operations
    const mockGetCredential = async (id: string) => {
      if (id === mockCredentialId) return credentialState;
      return null;
    };
    const mockGetHealth = async (id: string) => {
      if (id === mockCredentialId) return healthState;
      return null;
    };
    const mockSaveCredential = async (cred: AICredential) => {
      saveCredentialCalls.push({ ...cred });
      credentialState = { ...cred };
    };
    const mockSaveHealth = async (health: AIHealth) => {
      saveHealthCalls.push({ ...health });
      healthState = { ...health };
      return health;
    };

    // Patch both drivers
    supabaseDb.getCredential = mockGetCredential;
    supabaseDb.getHealth = mockGetHealth;
    supabaseDb.saveCredential = mockSaveCredential as any;
    supabaseDb.saveHealth = mockSaveHealth as any;

    firestoreDb.getCredential = mockGetCredential;
    firestoreDb.getHealth = mockGetHealth;
    firestoreDb.saveCredential = mockSaveCredential as any;
    firestoreDb.saveHealth = mockSaveHealth as any;

    // CASE 1: Google Daily Quota limit is hit
    console.log('👉 Running Verification: Google Hard Daily Quota Error should NOT suppress credential globally');
    
    const quotaErrorMsg = 'Resource has been exhausted (e.g. queries per day limit reached). [429] GenerateRequestsPerDayPerProjectPerModel-FreeTier';
    const postQuotaHealth = await healthService.recordFailure(mockCredentialId, quotaErrorMsg, 429);

    // Verify DB states:
    const credentialUpdatedToExhausted = saveCredentialCalls.some(c => c.status === 'exhausted');
    
    if (credentialUpdatedToExhausted) {
      failedCount++;
      console.log('❌ [FAIL] Credential status was incorrectly set to "exhausted" in the database!');
    } else {
      console.log('  ✅ [PASS] Checked: Credential status was NOT set to "exhausted" in the database.');
    }

    if (postQuotaHealth.status === 'down' || postQuotaHealth.status === 'degraded' || postQuotaHealth.consecutiveFailures > 0) {
      failedCount++;
      console.log('❌ [FAIL] Quota error incorrectly updated global credential health parameters!');
      console.log('   Health Status:', postQuotaHealth.status);
      console.log('   Consecutive Failures:', postQuotaHealth.consecutiveFailures);
    } else {
      console.log('  ✅ [PASS] Checked: Quota error did NOT increment global consecutive failures or degrade global health.');
    }

    // Reset spies for Case 2
    saveCredentialCalls = [];
    saveHealthCalls = [];

    // CASE 2: Actual Auth Error is hit (should mark as invalid)
    console.log('👉 Running Verification: Authentication failure should mark credential as invalid');
    const authErrorMsg = 'API key not valid or unauthorized [403 Forbidden]';
    const postAuthHealth = await healthService.recordFailure(mockCredentialId, authErrorMsg, 403);

    const credentialUpdatedToInvalid = saveCredentialCalls.some(c => c.status === 'invalid_auth');
    if (!credentialUpdatedToInvalid) {
      failedCount++;
      console.log('❌ [FAIL] Auth error failed to update credential status to "invalid_auth"!');
    } else {
      console.log('  ✅ [PASS] Checked: Credential correctly updated to "invalid_auth" in the database.');
    }

    if (postAuthHealth.status !== 'down') {
      failedCount++;
      console.log('❌ [FAIL] Auth error failed to set health status to "down"!');
    } else {
      console.log('  ✅ [PASS] Checked: Auth error correctly set health status to "down".');
    }

    console.log('\n==================================================');
    if (failedCount === 0) {
      console.log('🎉 ALL CLASSIFIER & INTEGRITY TESTS COMPLETED SUCCESSFULLY!');
    } else {
      console.log(`⚠️ ${failedCount} INTEGRITY TEST(S) FAILED.`);
      process.exit(1);
    }
    console.log('==================================================');

  } catch (err: any) {
    console.error('❌ CRITICAL TEST RUNNER EXCEPTION:', err);
    process.exit(1);
  } finally {
    // Restore original driver behaviors to protect the global state
    supabaseDb.getCredential = origGetCredentialSupabase;
    supabaseDb.getHealth = origGetHealthSupabase;
    supabaseDb.saveCredential = origSaveCredentialSupabase;
    supabaseDb.saveHealth = origSaveHealthSupabase;

    firestoreDb.getCredential = origGetCredentialFirestore;
    firestoreDb.getHealth = origGetHealthFirestore;
    firestoreDb.saveCredential = origSaveCredentialFirestore;
    firestoreDb.saveHealth = origSaveHealthFirestore;
  }
})();
