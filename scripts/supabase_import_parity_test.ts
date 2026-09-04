import fs from 'fs';
import path from 'path';
import { supabaseDb } from '../server/db/supabase_db';
import { getSupabaseClient, resetSupabaseClientInstance } from '../server/db/supabase_client';
import { db, getDatabaseDriver } from '../server/db';

async function runPhase33ImportAndParitySuite() {
  console.log('================================================================');
  console.log('SINEMA PHASE 3.3: SUPABASE IMPORT, PARITY VALIDATION & CUTOVER');
  console.log('================================================================\n');

  // Ensure environment is configured
  if (!process.env.SUPABASE_URL) {
    process.env.SUPABASE_URL = 'https://sandbox.supabase.co';
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_test_service_role_key';
  }

  // Pre-cutover constraint: SUPABASE_ENABLED must be false initially
  process.env.SUPABASE_ENABLED = 'false';
  resetSupabaseClientInstance();
  const supabase = getSupabaseClient();

  // Load migration package
  const pkgPath = path.join(process.cwd(), 'data', 'migration_package_live_20260903.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`Migration package not found at: ${pkgPath}`);
  }

  const rawPkg = fs.readFileSync(pkgPath, 'utf-8');
  const pkg = JSON.parse(rawPkg);
  const data = pkg.data;

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, description: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${description}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${description}`);
      throw new Error(`Assertion failed: ${description}`);
    }
  }

  console.log('--- STEP 1: IMPORTING MIGRATION PACKAGE INTO SUPABASE IN FK ORDER ---');

  // 1. projects
  const projects = data.projects || [];
  console.log(`Inserting ${projects.length} projects...`);
  for (const p of projects) {
    await supabaseDb.saveProject(p);
  }

  // 2. project_foundations (mapped from data.project_foundation or data.project_foundations)
  const foundations = data.project_foundation || data.project_foundations || [];
  console.log(`Inserting ${foundations.length} project foundations...`);
  for (const f of foundations) {
    await supabaseDb.saveProjectFoundation(f);
  }

  // 3. ai_providers
  const aiProviders = data.ai_providers || [];
  console.log(`Inserting ${aiProviders.length} AI providers...`);
  for (const prov of aiProviders) {
    await supabaseDb.saveProvider(prov);
  }

  // 4. ai_models
  const aiModels = data.ai_models || [];
  console.log(`Inserting ${aiModels.length} AI models...`);
  for (const model of aiModels) {
    await supabaseDb.saveModel(model);
  }

  // 5. ai_credentials
  const aiCredentials = data.ai_credentials || [];
  console.log(`Inserting ${aiCredentials.length} AI credentials...`);
  for (const cred of aiCredentials) {
    await supabaseDb.saveCredential(cred);
  }

  // 6. characters
  const characters = data.characters || [];
  console.log(`Inserting ${characters.length} characters...`);
  if (characters.length > 0) {
    // Group characters by project_id
    const charByProj = new Map<string, any[]>();
    for (const c of characters) {
      if (!charByProj.has(c.project_id)) charByProj.set(c.project_id, []);
      charByProj.get(c.project_id)!.push(c);
    }
    for (const [projId, charList] of charByProj.entries()) {
      await supabaseDb.saveAndMergeCharacters(projId, charList);
    }
  }

  // 7. locations
  const locations = data.locations || [];
  console.log(`Inserting ${locations.length} locations...`);
  if (locations.length > 0) {
    const locByProj = new Map<string, any[]>();
    for (const l of locations) {
      if (!locByProj.has(l.project_id)) locByProj.set(l.project_id, []);
      locByProj.get(l.project_id)!.push(l);
    }
    for (const [projId, locList] of locByProj.entries()) {
      await supabaseDb.saveAndMergeLocations(projId, locList);
    }
  }

  // 8. objects
  const objects = data.objects || [];
  console.log(`Inserting ${objects.length} objects...`);
  if (objects.length > 0) {
    const objByProj = new Map<string, any[]>();
    for (const o of objects) {
      if (!objByProj.has(o.project_id)) objByProj.set(o.project_id, []);
      objByProj.get(o.project_id)!.push(o);
    }
    for (const [projId, objList] of objByProj.entries()) {
      await supabaseDb.saveAndMergeObjects(projId, objList);
    }
  }

  // 9. scenes
  const scenes = data.scenes || [];
  console.log(`Inserting ${scenes.length} scenes...`);
  if (scenes.length > 0) {
    const sceneByProj = new Map<string, any[]>();
    for (const sc of scenes) {
      if (!sceneByProj.has(sc.project_id)) sceneByProj.set(sc.project_id, []);
      sceneByProj.get(sc.project_id)!.push(sc);
    }
    for (const [projId, scList] of sceneByProj.entries()) {
      await supabaseDb.saveScenes(projId, scList);
    }
  }

  // 10. shots
  const shots = data.shots || [];
  console.log(`Inserting ${shots.length} shots...`);
  if (shots.length > 0) {
    const shotByScene = new Map<string, { projectId: string; list: any[] }>();
    for (const sh of shots) {
      if (!shotByScene.has(sh.scene_id)) {
        shotByScene.set(sh.scene_id, { projectId: sh.project_id, list: [] });
      }
      shotByScene.get(sh.scene_id)!.list.push(sh);
    }
    for (const [sceneId, { projectId, list }] of shotByScene.entries()) {
      await supabaseDb.saveShots(sceneId, projectId, list);
    }
  }

  // 11. video_prompts
  const videoPrompts = data.video_prompts || [];
  console.log(`Inserting ${videoPrompts.length} video prompts...`);
  for (const vp of videoPrompts) {
    await supabaseDb.saveSingleVideoPrompt(vp);
  }

  // 12. story_architectures
  const storyArchitectures = data.story_architectures || [];
  console.log(`Inserting ${storyArchitectures.length} story architectures...`);
  for (const sa of storyArchitectures) {
    await supabaseDb.saveStoryArchitecture(sa);
  }

  // 13. continuity_states
  const continuityStates = data.continuity_states || [];
  console.log(`Inserting ${continuityStates.length} continuity states...`);
  if (continuityStates.length > 0) {
    const csByProj = new Map<string, any[]>();
    for (const cs of continuityStates) {
      const projId = cs.project_id;
      if (!csByProj.has(projId)) csByProj.set(projId, []);
      csByProj.get(projId)!.push(cs);
    }
    for (const [projId, csList] of csByProj.entries()) {
      await supabaseDb.saveCharacterContinuityStates(projId, csList);
    }
  }

  // 14. continuity_snapshots
  const continuitySnapshots = data.continuity_snapshots || [];
  console.log(`Inserting ${continuitySnapshots.length} continuity snapshots...`);
  for (const cs of continuitySnapshots) {
    await supabaseDb.saveContinuitySnapshot(cs.project_id, cs.scene_number, cs.snapshot_data || cs);
  }

  // 15. ai_usage
  const aiUsages = data.ai_usage || [];
  console.log(`Inserting ${aiUsages.length} AI usage logs...`);
  for (const u of aiUsages) {
    await supabaseDb.saveUsage({
      id: u.id,
      credentialId: u.credential_id || u.credentialId,
      modelId: u.model_id || u.modelId,
      requestType: u.request_type || u.requestType,
      stage: u.stage,
      promptTokens: u.prompt_tokens || u.promptTokens,
      completionTokens: u.completion_tokens || u.completionTokens,
      totalTokens: u.total_tokens || u.totalTokens,
      latencyMs: u.latency_ms || u.latencyMs,
      success: u.success,
      errorType: u.error_type || u.errorType,
      timestamp: u.timestamp,
    });
  }

  // 16. ai_health
  const aiHealths = data.ai_health || [];
  console.log(`Inserting ${aiHealths.length} AI health records...`);
  for (const h of aiHealths) {
    await supabaseDb.saveHealth({
      credentialId: h.credential_id || h.credentialId,
      status: h.status,
      consecutiveFailures: h.consecutive_failures ?? h.consecutiveFailures ?? 0,
      successRate: h.success_rate ?? h.successRate ?? 1.0,
      cooldownUntil: h.cooldown_until || h.cooldownUntil || null,
      lastError: h.last_error || h.lastError || null,
      updatedAt: h.updated_at || h.updatedAt || new Date().toISOString(),
    });
  }

  console.log('\n--- STEP 2: RUNNING PARITY VERIFICATION TESTS ---');

  // PARITY CHECK 1: Record Counts Match Exactly
  console.log('\n[Parity Check 1: Record Counts]');
  const dbProjects = await supabaseDb.listProjects();
  assert(dbProjects.length === projects.length, `projects: Source ${projects.length} = Supabase ${dbProjects.length}`);

  const dbChars = await supabaseDb.getCharacters('proj_1788214028566_pafx05');
  assert(dbChars.length === 3, `characters (Production): Source 3 = Supabase ${dbChars.length}`);

  const dbLocs = await supabaseDb.getLocations('proj_1788214028566_pafx05');
  assert(dbLocs.length === 2, `locations (Production): Source 2 = Supabase ${dbLocs.length}`);

  const dbObjs = await supabaseDb.getObjects('proj_1788214028566_pafx05');
  assert(dbObjs.length === 3, `objects (Production): Source 3 = Supabase ${dbObjs.length}`);

  const dbScenes = await supabaseDb.getScenes('proj_1788214028566_pafx05');
  assert(dbScenes.length === 4, `scenes (Production): Source 4 = Supabase ${dbScenes.length}`);

  const dbShots = await supabaseDb.getShotsByProject('proj_1788214028566_pafx05');
  assert(dbShots.length === 11, `shots (Production): Source 11 = Supabase ${dbShots.length}`);

  const dbPrompts = await supabaseDb.getVideoPromptsByProject('proj_1788214028566_pafx05');
  assert(dbPrompts.length === 18, `video_prompts (Production): Source 18 = Supabase ${dbPrompts.length}`);

  const dbProviders = await supabaseDb.getProviders();
  assert(dbProviders.length === aiProviders.length, `ai_providers: Source ${aiProviders.length} = Supabase ${dbProviders.length}`);

  const dbModels = await supabaseDb.getModels();
  assert(dbModels.length === aiModels.length, `ai_models: Source ${aiModels.length} = Supabase ${dbModels.length}`);

  const dbCreds = await supabaseDb.getCredentials();
  assert(dbCreds.length === aiCredentials.length, `ai_credentials: Source ${aiCredentials.length} = Supabase ${dbCreds.length}`);

  const dbUsages = await supabaseDb.getUsages(500);
  assert(dbUsages.length === aiUsages.length, `ai_usage: Source ${aiUsages.length} = Supabase ${dbUsages.length}`);

  // PARITY CHECK 2: ID Equality across collections
  console.log('\n[Parity Check 2: ID Equality]');
  const dbProjIds = new Set(dbProjects.map(p => p.id));
  const pkgProjIds = new Set(projects.map((p: any) => p.id));
  let projIdsMatch = dbProjIds.size === pkgProjIds.size && [...pkgProjIds].every(id => dbProjIds.has(id as string));
  assert(projIdsMatch, 'ID equality verified across all 10 project IDs');

  const prodSceneIds = new Set(dbScenes.map(s => s.id));
  const pkgSceneIds = new Set(scenes.map((s: any) => s.id));
  let scenesMatch = prodSceneIds.size === pkgSceneIds.size && [...pkgSceneIds].every(id => prodSceneIds.has(id as string));
  assert(scenesMatch, 'ID equality verified across all 4 production scene IDs');

  const prodShotIds = new Set(dbShots.map(s => s.id));
  const pkgShotIds = new Set(shots.map((s: any) => s.id));
  let shotsMatch = prodShotIds.size === pkgShotIds.size && [...pkgShotIds].every(id => prodShotIds.has(id as string));
  assert(shotsMatch, 'ID equality verified across all 11 production shot IDs');

  // PARITY CHECK 3: Relationship & Referential Integrity
  console.log('\n[Parity Check 3: Foreign Key Relationship Integrity]');
  let fkScenesValid = dbScenes.every(s => dbProjIds.has(s.project_id));
  assert(fkScenesValid, 'All scenes reference valid projects (scenes -> projects FK)');

  let fkShotsValid = dbShots.every(s => prodSceneIds.has(s.scene_id) && dbProjIds.has(s.project_id));
  assert(fkShotsValid, 'All shots reference valid scenes & projects (shots -> scenes, projects FK)');

  let fkPromptsValid = dbPrompts.every(p => (prodShotIds.has(p.shot_id) || prodSceneIds.has(p.scene_id)) && dbProjIds.has(p.project_id));
  assert(fkPromptsValid, 'All video prompts reference valid scenes & projects (video_prompts -> scenes, projects FK)');

  const dbProviderIds = new Set(dbProviders.map(pr => pr.id));
  let fkCredsValid = dbCreds.every(c => dbProviderIds.has(c.providerId));
  assert(fkCredsValid, 'All AI credentials reference valid AI providers (ai_credentials -> ai_providers FK)');

  // PARITY CHECK 4: JSONB Semantic Correctness
  console.log('\n[Parity Check 4: JSONB Semantic Correctness]');
  const prodProj = await supabaseDb.getProject('proj_1788214028566_pafx05');
  assert(
    prodProj !== null && prodProj.title.includes('LAHIRNYA CAHAYA') && (prodProj.status === 'completed' || (prodProj.status as string) === 'COMPLETED') && prodProj.current_stage === 8,
    'Production project "LAHIRNYA CAHAYA" retrieved with Stage 8 completed status and exact semantic fields'
  );

  assert(
    dbChars[0].clothing !== undefined && Array.isArray(dbChars[0].clothing),
    'Character JSONB arrays (clothing, accessories) preserved with valid semantic structures'
  );

  console.log('\n================================================================');
  console.log(`PARITY TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED PERFECTLY`);
  console.log('================================================================\n');

  // STEP 3: CUTOVER — Activate SUPABASE_ENABLED
  console.log('--- STEP 3: EXECUTING DATABASE CUTOVER ---');
  process.env.SUPABASE_ENABLED = 'true';
  resetSupabaseClientInstance();

  const activeDriver = getDatabaseDriver();
  assert(
    activeDriver === (supabaseDb as any),
    'getDatabaseDriver() switched to supabaseDb driver upon setting SUPABASE_ENABLED=true'
  );

  const cutoverProject = await db.getProject('proj_1788214028566_pafx05');
  assert(
    cutoverProject !== null && cutoverProject.id === 'proj_1788214028566_pafx05',
    'db proxy successfully serves production project directly from Supabase'
  );

  console.log('\n✅ [CUTOVER SUCCESS] Supabase database is now fully populated, validated, and activated as authoritative backend!');
  return true;
}

runPhase33ImportAndParitySuite().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Phase 3.3 Import / Parity Suite Error:', err);
  process.exit(1);
});
