import { db } from '../server/db';
import { credentialService } from '../server/ai_infrastructure/credential_service';
import { secretVault } from '../server/security/secret_vault';
import { databaseHealthService } from '../server/ai_infrastructure/database_health_service';
import { Project, Scene, Shot, VideoPrompt } from '../src/types';

async function runProductionLoadSimulation() {
  process.env.SUPABASE_ENABLED = 'true';
  process.env.MOCK_SUPABASE = 'true';
  if (!process.env.SUPABASE_URL) process.env.SUPABASE_URL = 'https://sandbox.supabase.co';
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = 'sandbox-service-key';
  if (!process.env.AI_SECRET_MASTER_KEY) process.env.AI_SECRET_MASTER_KEY = 'sinema-master-vault-key-2026';

  console.log('================================================================');
  console.log('  SINEMA PHASE 4.2 — PRODUCTION LOAD & CONCURRENCY SIMULATION  ');
  console.log('================================================================\n');

  const testProjectId = `stress_proj_${Date.now()}`;
  const dummyProject: any = {
    id: testProjectId,
    title: 'STRESS TEST PROJECT — PHASE 4.2',
    raw_script: 'High concurrency stress test script for SINEMA pipeline.',
    total_duration_target_sec: 120,
    primaryVideoModel: 'veo',
    foundation_status: 'ready',
    allow_final_scene_override: false,
    prompt_language: 'id',
    image_model: 'nano_banana_pro',
    video_model: ['veo'],
    include_seedance_format: false,
    status: 'draft',
    current_stage: 1,
    owner_id: 'system',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await db.saveProject(dummyProject);

  // Seed scenes, shots, prompts
  const scenes: any[] = [];
  const shots: any[] = [];
  const prompts: any[] = [];

  for (let s = 1; s <= 5; s++) {
    const scId = `sc_${testProjectId}_${s}`;
    scenes.push({
      id: scId,
      project_id: testProjectId,
      scene_number: s,
      title: `Stress Scene ${s}`,
      duration_sec: 10,
      status: 'completed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    for (let sh = 1; sh <= 3; sh++) {
      const shId = `shot_${testProjectId}_${s}_${sh}`;
      shots.push({
        id: shId,
        scene_id: scId,
        project_id: testProjectId,
        shot_number: sh,
        start_time_sec: (sh - 1) * 3,
        end_time_sec: sh * 3,
        duration_sec: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      prompts.push({
        id: `vp_${testProjectId}_${s}_${sh}`,
        shot_id: shId,
        scene_id: scId,
        project_id: testProjectId,
        target_platform: 'veo',
        generation_type: 'direct',
        status: 'ready',
        timeline_json: {},
        negative_prompt: '',
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  await db.saveScenes(testProjectId, scenes as Scene[]);
  for (const sc of scenes) {
    const scShots = shots.filter(s => s.scene_id === sc.id);
    await db.saveShots(sc.id, testProjectId, scShots as Shot[]);
  }
  for (const vp of prompts) {
    await db.saveSingleVideoPrompt(vp as VideoPrompt);
  }

  // Seed test credential
  await db.saveProvider({
    id: 'google',
    name: 'Google Gemini Native',
    type: 'gemini',
    enabled: true,
    capabilities: { text: true, vision: true, image: true, video: true },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const cred = await credentialService.addCredential({
    name: 'Stress Test Credential',
    providerId: 'google',
    secret: 'AIzaSyA_STRESS_TEST_CREDENTIAL_SECRET_999999',
    priority: 1,
    weight: 1,
    status: 'active',
  });

  // ---------------------------------------------------------------------------
  // TEST A: 100 CONCURRENT PROJECT READS
  // ---------------------------------------------------------------------------
  console.log('--- TEST A: 100 CONCURRENT PROJECT READS ---');
  const readLatencies: number[] = [];
  const readStart = performance.now();

  const readPromises = Array.from({ length: 100 }).map(async () => {
    const t0 = performance.now();
    const p = await db.getFullProjectData(testProjectId);
    const latency = performance.now() - t0;
    readLatencies.push(latency);
    return p;
  });

  await Promise.all(readPromises);
  const readTotalTime = performance.now() - readStart;
  const avgReadLatency = readLatencies.reduce((a, b) => a + b, 0) / readLatencies.length;
  readLatencies.sort((a, b) => a - b);
  const p95Read = readLatencies[Math.floor(readLatencies.length * 0.95)];

  console.log(`  ✅ 100 Reads Completed in ${readTotalTime.toFixed(2)} ms`);
  console.log(`  📊 Avg Read Latency: ${avgReadLatency.toFixed(2)} ms | P95: ${p95Read.toFixed(2)} ms\n`);

  // ---------------------------------------------------------------------------
  // TEST B: 50 CONCURRENT GENERATION & CREDENTIAL LOOKUPS
  // ---------------------------------------------------------------------------
  console.log('--- TEST B: 50 CONCURRENT GENERATION REQUESTS & CREDENTIAL LOOKUPS ---');
  const genLatencies: number[] = [];
  const genStart = performance.now();

  const genPromises = Array.from({ length: 50 }).map(async (_, idx) => {
    const t0 = performance.now();
    // Lookup active credential & decrypt
    const activeCreds = await credentialService.getActiveCredentials();
    if (activeCreds.length === 0) throw new Error('No active credentials');
    const targetCred = activeCreds[0];
    const secret = secretVault.decryptSecret(targetCred.encryptedSecret);

    // Fetch video prompt
    const vpList = await db.getVideoPromptsByProject(testProjectId);
    const targetVp = vpList[idx % vpList.length];

    // Simulate saving usage log
    await db.saveUsage({
      id: `usage_${testProjectId}_${idx}_${Date.now()}`,
      credentialId: targetCred.id,
      modelId: 'veo',
      requestType: 'generation',
      stage: 'S7',
      promptTokens: 150,
      completionTokens: 300,
      totalTokens: 450,
      latencyMs: Math.round(performance.now() - t0),
      success: true,
      timestamp: Date.now(),
    });

    const latency = performance.now() - t0;
    genLatencies.push(latency);
    return { secret, promptId: targetVp?.id };
  });

  await Promise.all(genPromises);
  const genTotalTime = performance.now() - genStart;
  const avgGenLatency = genLatencies.reduce((a, b) => a + b, 0) / genLatencies.length;
  genLatencies.sort((a, b) => a - b);
  const p95Gen = genLatencies[Math.floor(genLatencies.length * 0.95)];

  console.log(`  ✅ 50 Concurrent Generation Requests Completed in ${genTotalTime.toFixed(2)} ms`);
  console.log(`  📊 Avg Latency: ${avgGenLatency.toFixed(2)} ms | P95: ${p95Gen.toFixed(2)} ms\n`);

  // ---------------------------------------------------------------------------
  // TEST C: SYSTEM HEALTH AUDIT AFTER STRESS
  // ---------------------------------------------------------------------------
  console.log('--- TEST C: SYSTEM HEALTH AUDIT AFTER STRESS ---');
  const healthReport = await databaseHealthService.getHealthReport();
  console.log(`  📊 Database Connection Status: ${healthReport.connectionStatus}`);
  console.log(`  📊 Latency Status: ${healthReport.latency.status} (Ping: ${healthReport.latency.pingMs} ms)`);
  console.log(`  📊 Connection Pool: ${healthReport.connectionPool.activeConnections} active / ${healthReport.connectionPool.idleConnections} idle`);
  console.log(`  📊 Total Table Baselines Audited: ${Object.keys(healthReport.tableBaselines).length} tables`);

  // Cleanup
  await credentialService.removeCredential(cred.id);
  await db.deleteProject(testProjectId);
  console.log('\n  ✅ Stress test project and credentials safely cleaned up.\n');

  console.log('================================================================');
  console.log('  PHASE 4.2 PRODUCTION LOAD SIMULATION: 100% SUCCESSFUL PASS!  ');
  console.log('================================================================\n');
}

runProductionLoadSimulation().catch(err => {
  console.error('❌ Production Load Simulation Failed:', err);
  process.exit(1);
});
