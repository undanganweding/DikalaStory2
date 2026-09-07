import '../isolate_test_env';
import { db, firestoreDb } from '../db';
import { supabaseDb } from '../db/supabase_db';
import { runProjectInitialization } from '../orchestrator';
import { aiBudgetRegistry } from './ai_budget_registry';
import { dailyExhaustedRegistry } from './ai_gateway';
import { AIModel, AIProvider, AICredential } from '../../src/types';

async function runRuntimePreflightProof() {
  console.log('==================================================');
  console.log('🎬 RUNNING RUNTIME PREFLIGHT EARLY-STOP PROOF...');
  console.log('==================================================');

  const projectId = 'proj_preflight_proof_123';

  // Seed the project in the local DB
  const mockProject = {
    id: projectId,
    title: 'Preflight Proof Project',
    raw_script: 'INT. COAL MINE - DAY\nA miner picks at a dark wall.',
    total_duration_target_sec: 120,
    scene_duration_sec: 10,
    prompt_language: 'id',
    status: 'draft' as const,
    foundation_status: 'not_started' as const,
    current_stage: 0,
    retry_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Clear existing telemetry/logs/collections for clean verification
  await db.deleteProject?.(projectId);

  await db.saveProject(mockProject as any);

  // Store original DB driver methods to restore afterwards
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

  // Track if Stage 1 is ever called
  let s1RunnerCallCount = 0;
  const mockStage1Runner = async (input: any) => {
    s1RunnerCallCount++;
    return {
      genre: 'Drama',
      era: 'Modern',
      premises: 'A miner seeking truth.',
      theme_line: 'Truth is hard.',
      main_characters: ['Miner'],
      narrative_beats: {
        beginning: 'Miner starts digging.',
        middle: 'Miner finds shiny rock.',
        climax: 'Miner realizes it is pyrite.',
        ending: 'Miner goes home.',
      },
    };
  };

  try {
    // 1. Setup Mock Model, Provider, and Credential
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
      enabled: true,
      type: 'google',
      capabilities: { text: true, vision: true, image: true, video: true },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any;

    const mockCredential: AICredential = {
      id: 'preflight_mock_google_key',
      name: 'Preflight Proof Mock Key',
      providerId: 'google',
      status: 'active',
      priority: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any;

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

    // Patch Supabase & Firestore drivers
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

    // 2. FORCE PRECHECK BLOCKED BY MARKING CREDENTIALS AS EXHAUSTED IN DAILY EXHAUSTED REGISTRY
    dailyExhaustedRegistry.clear();
    const cacheKey1 = `${mockCredential.name}:${mockModel.id}`;
    const cacheKey2 = `${mockCredential.id}:${mockModel.id}`;
    dailyExhaustedRegistry.set(cacheKey1, Date.now() + 3600000);
    dailyExhaustedRegistry.set(cacheKey2, Date.now() + 3600000);

    console.log('👉 Force-exhausted credential paths:');
    console.log(`   - ${cacheKey1}`);
    console.log(`   - ${cacheKey2}`);

    // 3. RUN PROJECT INITIALIZATION (S1-S5)
    console.log('👉 Invoking runProjectInitialization...');
    const result = await runProjectInitialization(projectId, undefined, {
      stage1Runner: mockStage1Runner as any,
    });

    // 4. VERIFY THAT THE RUN WAS BLOCKED AND S1 / AI GATEWAY REMAINED EXACTLY ZERO
    console.log('\n==================================================');
    console.log('📊 VERIFYING PROOF METRICS:');
    console.log('==================================================');
    
    console.log(`- success: ${result.success}`);
    console.log(`- error: "${result.error}"`);
    console.log(`- S1 executor call count: ${s1RunnerCallCount}`);

    const budget = aiBudgetRegistry.getBudget(projectId);
    const callsUsed = budget ? budget.callsUsed : 0;
    console.log(`- AI calls registered in project budget: ${callsUsed}`);

    let failed = false;

    // Check 1: Must be unsuccessful
    if (result.success) {
      console.log('❌ [FAIL] runProjectInitialization should have returned success: false!');
      failed = true;
    } else {
      console.log('✅ [PASS] runProjectInitialization correctly returned success: false.');
    }

    // Check 2: Error must contain the "Pipeline blocked before AI request" message
    if (!result.error || !result.error.includes('Pipeline blocked before AI request')) {
      console.log(`❌ [FAIL] Error message did not mention preflight blocking. Got: "${result.error}"`);
      failed = true;
    } else {
      console.log('✅ [PASS] Preflight throws/returns correct NO_VIABLE_EXECUTION_PATH reason.');
    }

    // Check 3: S1 executor was NEVER invoked
    if (s1RunnerCallCount !== 0) {
      console.log(`❌ [FAIL] S1 executor was invoked ${s1RunnerCallCount} times! Expected 0.`);
      failed = true;
    } else {
      console.log('✅ [PASS] S1 executor was NEVER invoked.');
    }

    // Check 4: AI Gateway / budget was NEVER used
    if (callsUsed !== 0) {
      console.log(`❌ [FAIL] AI Gateway registered ${callsUsed} calls! Expected 0.`);
      failed = true;
    } else {
      console.log('✅ [PASS] AI Gateway / Budget usage is exactly 0.');
    }

    if (failed) {
      console.log('\n==================================================');
      console.log('🔴 RUNTIME PREFLIGHT PROOF FAILED.');
      console.log('==================================================');
      process.exit(1);
    } else {
      console.log('\n==================================================');
      console.log('🎉 RUNTIME PREFLIGHT PROOF PASSED SUCCESSFULLY!');
      console.log('==================================================');
    }

  } finally {
    // Clean up registry
    dailyExhaustedRegistry.clear();

    // Clean up mock project data
    await db.deleteProject?.(projectId);

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
}

runRuntimePreflightProof().catch(err => {
  console.error('❌ Proof execution crashed:', err);
  process.exit(1);
});
