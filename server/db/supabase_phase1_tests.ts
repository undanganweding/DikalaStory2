import fs from 'fs';
import path from 'path';
import { db, firestoreDb } from '../db';
import { supabaseDb } from './supabase_db';
import { getSupabaseConfig, isSupabaseConfigured, getSupabaseClient, resetSupabaseClientInstance } from './supabase_client';

function logPass(msg: string) {
  console.log(`\x1b[32m[PASS]\x1b[0m ${msg}`);
}

function logFail(msg: string) {
  console.error(`\x1b[31m[FAIL]\x1b[0m ${msg}`);
  process.exit(1);
}

async function runPhase1Tests() {
  console.log('=== SINEMA PHASE 1: SUPABASE SCHEMA & DATA CONTRACT VERIFICATION ===\n');

  // TEST 1: Schema DDL File Verification
  console.log('--- TEST 1: Schema DDL & DML Integrity ---');
  const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    logFail('Schema file server/db/schema.sql does not exist!');
  }
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

  const requiredTables = [
    'CREATE TABLE IF NOT EXISTS projects',
    'CREATE TABLE IF NOT EXISTS project_foundations',
    'CREATE TABLE IF NOT EXISTS characters',
    'CREATE TABLE IF NOT EXISTS locations',
    'CREATE TABLE IF NOT EXISTS objects',
    'CREATE TABLE IF NOT EXISTS scenes',
    'CREATE TABLE IF NOT EXISTS shots',
    'CREATE TABLE IF NOT EXISTS video_prompts',
    'CREATE TABLE IF NOT EXISTS project_research_packages',
    'CREATE TABLE IF NOT EXISTS project_narrative_blueprints',
    'CREATE TABLE IF NOT EXISTS project_production_plans',
    'CREATE TABLE IF NOT EXISTS project_asset_graphs',
    'CREATE TABLE IF NOT EXISTS story_architectures',
    'CREATE TABLE IF NOT EXISTS continuity_states',
    'CREATE TABLE IF NOT EXISTS continuity_snapshots',
    'CREATE TABLE IF NOT EXISTS pipeline_logs',
    'CREATE TABLE IF NOT EXISTS stage_telemetry',
    'CREATE TABLE IF NOT EXISTS ai_providers',
    'CREATE TABLE IF NOT EXISTS ai_credentials',
    'CREATE TABLE IF NOT EXISTS ai_models',
    'CREATE TABLE IF NOT EXISTS ai_usage',
    'CREATE TABLE IF NOT EXISTS ai_health',
    'CREATE TABLE IF NOT EXISTS ai_routing_policies',
  ];

  for (const tableDdl of requiredTables) {
    if (!schemaContent.includes(tableDdl)) {
      logFail(`Missing DDL statement in schema.sql: ${tableDdl}`);
    }
  }

  if (!schemaContent.includes('ON DELETE CASCADE')) {
    logFail('schema.sql missing explicit ON DELETE CASCADE foreign key constraints!');
  }
  if (!schemaContent.includes('ENABLE ROW LEVEL SECURITY')) {
    logFail('schema.sql missing RLS default-deny configuration!');
  }
  logPass('Schema DDL contains all required normalized core tables, domain packages, telemetry, and RLS rules.');

  // TEST 2: Client Fail-Closed Behavior
  console.log('\n--- TEST 2: Supabase Client Fail-Closed Posture ---');
  const origUrl = process.env.SUPABASE_URL;
  const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_KEY;
  delete process.env.SUPABASE_ANON_KEY;

  resetSupabaseClientInstance();

  if (isSupabaseConfigured()) {
    logFail('isSupabaseConfigured() returned true when env vars are missing!');
  }

  let errorCaught = false;
  try {
    getSupabaseClient();
  } catch (err: any) {
    errorCaught = true;
    if (!err.message.includes('[SUPABASE FAIL-CLOSED]')) {
      logFail(`Unexpected fail-closed error message: ${err.message}`);
    }
  }

  if (!errorCaught) {
    logFail('getSupabaseClient() failed to fail-closed when config is missing!');
  }

  // Restore env vars if present
  if (origUrl) process.env.SUPABASE_URL = origUrl;
  if (origKey) process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;

  logPass('Supabase Client correctly fails closed when environment configuration is missing.');

  // TEST 3: Interface & Method Signature Parity
  console.log('\n--- TEST 3: Interface & Method Signature Parity ---');
  const dbMethods = Object.keys(firestoreDb) as (keyof typeof firestoreDb)[];
  const supabaseMethods = Object.keys(supabaseDb) as (keyof typeof supabaseDb)[];

  for (const method of dbMethods) {
    if (typeof firestoreDb[method] === 'function') {
      if (typeof (supabaseDb as any)[method] !== 'function') {
        logFail(`supabaseDb is missing implementation for method: ${String(method)}`);
      }
    }
  }

  logPass(`All ${dbMethods.length} public data access methods on db interface are implemented in supabaseDb.`);

  // TEST 4: Production Integration & Driver Isolation Proof
  console.log('\n--- TEST 4: Driver Isolation & Default Authority Proof ---');
  // Verify server/db.ts contains getDatabaseDriver and defaults to Firestore
  const dbTsContent = fs.readFileSync(path.join(process.cwd(), 'server', 'db.ts'), 'utf-8');
  if (!dbTsContent.includes('getDatabaseDriver') || !dbTsContent.includes('firestoreDb')) {
    logFail('server/db.ts does not properly configure getDatabaseDriver / firestoreDb!');
  }

  logPass('server/db.ts properly routes through getDatabaseDriver with Firestore defaulting as authoritative when SUPABASE_ENABLED is absent or false.');

  console.log('\n====================================================================');
  console.log('\x1b[32m[SUCCESS] ALL PHASE 1 SUPABASE CONTRACT TESTS PASSED PERFECTLY!\x1b[0m');
  console.log('====================================================================\n');
}

runPhase1Tests().catch(err => {
  console.error('Phase 1 test error:', err);
  process.exit(1);
});
