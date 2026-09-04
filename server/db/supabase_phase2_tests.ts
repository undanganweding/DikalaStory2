import { db, firestoreDb, getDatabaseDriver } from '../db';
import { supabaseDb } from './supabase_db';
import { resetSupabaseClientInstance } from './supabase_client';
import { Project, ProjectFoundation, Scene, Shot, VideoPrompt, AIProvider, AICredential } from '../../src/types';

async function runPhase2VerificationSuite() {
  console.log('================================================================');
  console.log('SINEMA PHASE 2 VERIFICATION SUITE — SUPABASE DRIVER ACTIVATION');
  console.log('================================================================\n');

  // Preserve original environment variables
  const origSupabaseEnabled = process.env.SUPABASE_ENABLED;
  const origSupabaseUrl = process.env.SUPABASE_URL;
  const origSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const origForceLocalDb = process.env.FORCE_LOCAL_DB;

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, description: string) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] ${description}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${description}`);
      throw new Error(`Test assertion failed: ${description}`);
    }
  }

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Backend Selection & Default Authority
    // ------------------------------------------------------------------------
    console.log('--- TEST 1: Default Authority (Firestore) ---');
    delete process.env.SUPABASE_ENABLED;
    const defaultDriver = getDatabaseDriver();
    assert(
      defaultDriver === firestoreDb,
      'When SUPABASE_ENABLED is unset, getDatabaseDriver() returns firestoreDb'
    );

    process.env.SUPABASE_ENABLED = 'false';
    const explicitFalseDriver = getDatabaseDriver();
    assert(
      explicitFalseDriver === firestoreDb,
      'When SUPABASE_ENABLED=false, getDatabaseDriver() returns firestoreDb'
    );

    // ------------------------------------------------------------------------
    // TEST 2: Invalid Supabase Configuration Fail-Closed
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Invalid Supabase Config Fail-Closed Posture ---');
    process.env.SUPABASE_ENABLED = 'true';
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_KEY;
    delete process.env.VITE_SUPABASE_URL;
    resetSupabaseClientInstance();

    let failClosedCaught = false;
    try {
      getDatabaseDriver();
    } catch (err: any) {
      failClosedCaught = err.message.includes('[SUPABASE FAIL-CLOSED]');
    }
    assert(
      failClosedCaught,
      'When SUPABASE_ENABLED=true but config is missing, getDatabaseDriver() fails closed with [SUPABASE FAIL-CLOSED]'
    );

    let methodFailClosedCaught = false;
    try {
      await db.getProject('test-p1');
    } catch (err: any) {
      methodFailClosedCaught = err.message.includes('[SUPABASE FAIL-CLOSED]');
    }
    assert(
      methodFailClosedCaught,
      'Calling db method when SUPABASE_ENABLED=true and config missing throws [SUPABASE FAIL-CLOSED] without fallback'
    );

    // ------------------------------------------------------------------------
    // TEST 3: Supabase Driver Activation
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Supabase Driver Activation ---');
    process.env.SUPABASE_ENABLED = 'true';
    process.env.SUPABASE_URL = origSupabaseUrl || 'https://sandbox.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = origSupabaseKey || 'sb_service_role_secret';
    resetSupabaseClientInstance();

    const supabaseDriver = getDatabaseDriver();
    assert(
      supabaseDriver === (supabaseDb as any),
      'When SUPABASE_ENABLED=true with valid config, getDatabaseDriver() returns supabaseDb'
    );

    // ------------------------------------------------------------------------
    // TEST 4: Runtime Failure Isolation (No Cross-Database Fallback)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Runtime Failure Isolation & No Fallback ---');
    // Ensure that when Supabase is enabled, a method failure in supabaseDb throws directly and does not touch firestoreDb
    const origGetProjectSupabase = supabaseDb.getProject;
    supabaseDb.getProject = async () => {
      throw new Error('[SIMULATED SUPABASE DB ERROR] Table locked or network error');
    };

    let runtimeErrorCaught = false;
    try {
      await db.getProject('test-p1');
    } catch (err: any) {
      runtimeErrorCaught = err.message.includes('[SIMULATED SUPABASE DB ERROR]');
    }
    assert(
      runtimeErrorCaught,
      'Runtime error in Supabase driver is re-thrown as-is and does NOT trigger fallback to Firestore'
    );

    // Restore original method
    supabaseDb.getProject = origGetProjectSupabase;

    // ------------------------------------------------------------------------
    // TEST 5: FORCE_LOCAL_DB Context Isolation
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: FORCE_LOCAL_DB Context Isolation ---');
    process.env.SUPABASE_ENABLED = 'false';
    process.env.FORCE_LOCAL_DB = 'true';
    const localDriver = getDatabaseDriver();
    assert(
      localDriver === firestoreDb,
      'When SUPABASE_ENABLED=false, FORCE_LOCAL_DB=true returns firestoreDb (in local JSON mode)'
    );

    // ------------------------------------------------------------------------
    // TEST 6: Representative CRUD Matrix via db Proxy in Supabase Mode
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Representative CRUD Operations via db Proxy in Supabase Mode ---');
    process.env.SUPABASE_ENABLED = 'true';
    process.env.SUPABASE_URL = origSupabaseUrl || 'https://sandbox.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = origSupabaseKey || 'sb_service_role_secret';
    resetSupabaseClientInstance();

    const testProjectId = `proj_phase2_${Date.now()}`;
    const testProject: Project = {
      id: testProjectId,
      title: 'SINEMA Phase 2 Test Project',
      raw_script: 'FADE IN: A cinematic testing environment.',
      total_duration_target_sec: 60,
      max_scene_shot_duration_sec: null,
      prompt_language: 'en',
      image_model: 'nano_banana_pro',
      video_model: ['veo'],
      include_seedance_format: false,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Mock supabase calls inside supabaseDb if running without live network or verify method calls
    // Note: If live Supabase or mock, test calls through db Proxy
    let projectSaved = false;
    const origSaveProject = supabaseDb.saveProject;
    supabaseDb.saveProject = async (p: Project) => {
      projectSaved = true;
      return p;
    };

    const savedP = await db.saveProject(testProject);
    assert(projectSaved && savedP.id === testProjectId, 'db.saveProject successfully routed to supabaseDb');
    supabaseDb.saveProject = origSaveProject;

    // Test getProject through db Proxy
    let getProjectCalled = false;
    supabaseDb.getProject = async (id: string) => {
      getProjectCalled = true;
      return id === testProjectId ? testProject : null;
    };

    const fetchedP = await db.getProject(testProjectId);
    assert(getProjectCalled && fetchedP?.id === testProjectId, 'db.getProject successfully routed to supabaseDb');
    supabaseDb.getProject = origGetProjectSupabase;

    // Test deleteProject through db Proxy
    let deleteProjectCalled = false;
    const origDeleteProject = supabaseDb.deleteProject;
    supabaseDb.deleteProject = async (id: string) => {
      deleteProjectCalled = true;
      return true;
    };

    const deleted = await db.deleteProject(testProjectId);
    assert(deleteProjectCalled && deleted === true, 'db.deleteProject successfully routed to supabaseDb');
    supabaseDb.deleteProject = origDeleteProject;

    // ------------------------------------------------------------------------
    // TEST 7: Method Parity Verification
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 7: Method Parity across db Proxy ---');
    const proxyKeys = Object.getOwnPropertyNames(firestoreDb).filter(
      (k) => typeof (firestoreDb as any)[k] === 'function'
    );

    let methodParityPassed = true;
    for (const key of proxyKeys) {
      if (typeof (db as any)[key] !== 'function') {
        console.error(`Missing method on db proxy: ${key}`);
        methodParityPassed = false;
      }
    }
    assert(
      methodParityPassed && proxyKeys.length === 60,
      `All ${proxyKeys.length} methods are accessible through db Proxy`
    );

    console.log(`\n================================================================`);
    console.log(`PHASE 2 VERIFICATION RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log(`================================================================\n`);
  } finally {
    // Restore original env vars
    if (origSupabaseEnabled !== undefined) process.env.SUPABASE_ENABLED = origSupabaseEnabled;
    else delete process.env.SUPABASE_ENABLED;

    if (origSupabaseUrl !== undefined) process.env.SUPABASE_URL = origSupabaseUrl;
    else delete process.env.SUPABASE_URL;

    if (origSupabaseKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = origSupabaseKey;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (origForceLocalDb !== undefined) process.env.FORCE_LOCAL_DB = origForceLocalDb;
    else delete process.env.FORCE_LOCAL_DB;

    resetSupabaseClientInstance();
  }
}

// Execute tests if run directly via tsx
runPhase2VerificationSuite().catch((err) => {
  console.error('Phase 2 Test Suite Failed:', err);
  process.exit(1);
});
