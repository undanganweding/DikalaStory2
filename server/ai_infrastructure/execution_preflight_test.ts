import { executionPreflight } from './execution_preflight';
import { dailyExhaustedRegistry } from './ai_gateway';
import { db, firestoreDb } from '../db';
import { supabaseDb } from '../db/supabase_db';
import { AICredential, AIModel, AIProvider } from '../../src/types';

console.log('==================================================');
console.log('RUNNING EXECUTION PREFLIGHT V1 TEST SUITE...');
console.log('==================================================');

let failedCount = 0;

(async () => {
  // Store original DB driver methods
  const origGetModelsSupabase = supabaseDb.getModels;
  const origGetProviderSupabase = supabaseDb.getProvider;
  const origListCredentialsSupabase = (supabaseDb as any).listCredentials;
  const origGetCredentialsSupabase = (supabaseDb as any).getCredentials;
  const origGetCredentialSupabase = supabaseDb.getCredential;
  const origGetCredentialOperationalStateSupabase = (supabaseDb as any).getCredentialOperationalState || (() => ({ healthState: 'HEALTHY', quotaState: 'QUOTA_AVAILABLE', circuitState: 'CLOSED', eligibility: true }));

  const origGetModelsFirestore = firestoreDb.getModels;
  const origGetProviderFirestore = firestoreDb.getProvider;
  const origListCredentialsFirestore = (firestoreDb as any).listCredentials;
  const origGetCredentialsFirestore = (firestoreDb as any).getCredentials;
  const origGetCredentialFirestore = firestoreDb.getCredential;
  const origGetCredentialOperationalStateFirestore = (firestoreDb as any).getCredentialOperationalState || (() => ({ healthState: 'HEALTHY', quotaState: 'QUOTA_AVAILABLE', circuitState: 'CLOSED', eligibility: true }));

  try {
    // 1. Mock DB data
    const mockModel: AIModel = {
      id: 'gemini-2.5-pro',
      providerId: 'google',
      enabled: true,
      tier: 'pro',
      capabilities: ['text', 'reasoning'],
      contextWindow: 1000000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any;

    const mockProvider: AIProvider = {
      id: 'google',
      name: 'Google API',
      enabled: true,
      type: 'google',
      capabilities: { text: true, vision: true, image: true, video: true },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any;

    const mockCredential: AICredential = {
      id: 'preflight_mock_google_key',
      name: 'Preflight Mock Key 1',
      providerId: 'google',
      status: 'active',
      priority: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any;

    // Proxy database mocks
    const mockGetModels = async () => [mockModel];
    const mockGetProvider = async (id: string) => {
      if (id === 'google') return mockProvider;
      return null;
    };
    const mockListCredentials = async () => [mockCredential];
    const mockGetCredential = async (id: string) => {
      if (id === mockCredential.id) return mockCredential;
      return null;
    };
    const mockGetCredentialOperationalState = async (id: string) => ({
      healthState: 'HEALTHY' as const,
      quotaState: 'QUOTA_AVAILABLE' as const,
      circuitState: 'CLOSED' as const,
      eligibility: true,
    });

    // Patch drivers
    supabaseDb.getModels = mockGetModels;
    supabaseDb.getProvider = mockGetProvider;
    (supabaseDb as any).listCredentials = mockListCredentials as any;
    (supabaseDb as any).getCredentials = mockListCredentials as any;
    supabaseDb.getCredential = mockGetCredential;
    (supabaseDb as any).getCredentialOperationalState = mockGetCredentialOperationalState;

    firestoreDb.getModels = mockGetModels;
    firestoreDb.getProvider = mockGetProvider;
    (firestoreDb as any).listCredentials = mockListCredentials as any;
    (firestoreDb as any).getCredentials = mockListCredentials as any;
    firestoreDb.getCredential = mockGetCredential;
    (firestoreDb as any).getCredentialOperationalState = mockGetCredentialOperationalState;

    // --- TEST 1: All execution paths healthy ---
    console.log('👉 TEST 1: Running Preflight on clean, healthy active credentials');
    
    // Clear registry to simulate clean state
    dailyExhaustedRegistry.clear();

    const result1 = await executionPreflight.checkExecutionPreflight(['S1', 'S2']);

    if (!result1.viable) {
      failedCount++;
      console.log('❌ [FAIL] Preflight should have returned viable=true for healthy credentials.');
    } else {
      console.log('  ✅ [PASS] Preflight correctly returned viable=true.');
    }

    if (result1.confidence !== 'LOCAL_STATE_ONLY' || result1.remainingQuota !== 'UNKNOWN') {
      failedCount++;
      console.log('❌ [FAIL] Preflight returned incorrect confidence or remaining quota metrics!');
      console.log('   Got:', { confidence: result1.confidence, remainingQuota: result1.remainingQuota });
    } else {
      console.log('  ✅ [PASS] Confidence and remaining quota metrics are 100% honest and correct.');
    }

    // --- TEST 2: Triggering single-model daily exhaustion and verifying blocking ---
    console.log('\n👉 TEST 2: Running Preflight with all candidate models exhausted in registry');
    
    // Inject mock candidate model exhaustion into the in-memory registry
    const cacheKey1 = `${mockCredential.name}:${mockModel.id}`;
    const cacheKey2 = `${mockCredential.id}:${mockModel.id}`;
    dailyExhaustedRegistry.set(cacheKey1, Date.now() + 3600000);
    dailyExhaustedRegistry.set(cacheKey2, Date.now() + 3600000);

    const result2 = await executionPreflight.checkExecutionPreflight(['S1', 'S2']);

    if (result2.viable) {
      failedCount++;
      console.log('❌ [FAIL] Preflight should have returned viable=false when all candidate models are exhausted.');
    } else {
      console.log('  ✅ [PASS] Preflight correctly returned viable=false (Early-Stopped).');
    }

    if (!result2.reason.includes('Pipeline blocked before AI request')) {
      failedCount++;
      console.log('❌ [FAIL] Preflight fail reason did not indicate pipeline early block! Got:', result2.reason);
    } else {
      console.log('  ✅ [PASS] Checked: Reason correctly warns "Pipeline blocked before AI request".');
    }

    if (result2.exhaustedPathsCount !== 2 || result2.viablePathsCount !== 0) {
      failedCount++;
      console.log('❌ [FAIL] Unexpected path tracking metrics on exhaustion!', {
        viableCount: result2.viablePathsCount,
        exhaustedCount: result2.exhaustedPathsCount,
      });
    } else {
      console.log('  ✅ [PASS] Checked: Path tracking metrics correctly show 2 exhausted candidate paths.');
    }

    // Clean up registry
    dailyExhaustedRegistry.clear();

    console.log('\n==================================================');
    if (failedCount === 0) {
      console.log('🎉 ALL EXECUTION PREFLIGHT V1 TESTS COMPLETED SUCCESSFULLY!');
    } else {
      console.log(`⚠️ ${failedCount} PREFLIGHT TEST(S) FAILED.`);
      process.exit(1);
    }
    console.log('==================================================');

  } catch (err: any) {
    console.error('❌ CRITICAL TEST EXCEPTION:', err);
    process.exit(1);
  } finally {
    // Restore original driver behaviors to protect the global state
    supabaseDb.getModels = origGetModelsSupabase;
    supabaseDb.getProvider = origGetProviderSupabase;
    (supabaseDb as any).listCredentials = origListCredentialsSupabase;
    (supabaseDb as any).getCredentials = origGetCredentialsSupabase;
    supabaseDb.getCredential = origGetCredentialSupabase;
    (supabaseDb as any).getCredentialOperationalState = origGetCredentialOperationalStateSupabase;

    firestoreDb.getModels = origGetModelsFirestore;
    firestoreDb.getProvider = origGetProviderFirestore;
    (firestoreDb as any).listCredentials = origListCredentialsFirestore;
    (firestoreDb as any).getCredentials = origGetCredentialsFirestore;
    firestoreDb.getCredential = origGetCredentialFirestore;
    (firestoreDb as any).getCredentialOperationalState = origGetCredentialOperationalStateFirestore;
  }
})();
