import express from 'express';
import { apiRouter } from './routes';
import { db } from './db';
import { Project, Scene, Shot, CharacterBible, LocationBible, ObjectBible, PromptLockState } from '../src/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`API TEST ASSERTION FAILED: ${message}`);
  }
}

// In-memory mock HTTP helper for express app
async function mockRequest(
  app: express.Express,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: any,
  query?: Record<string, string>
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    let queryString = '';
    if (query && Object.keys(query).length > 0) {
      queryString = '?' + new URLSearchParams(query).toString();
    }

    const req: any = {
      method,
      url: path + queryString,
      originalUrl: path + queryString,
      path,
      query: query || {},
      params: {},
      headers: { 'content-type': 'application/json' },
      body: body || {},
      get: (header: string) => (header.toLowerCase() === 'content-type' ? 'application/json' : undefined),
    };

    let statusCode = 200;
    let responseBody: any = null;

    const res: any = {
      statusCode: 200,
      status: function (code: number) {
        statusCode = code;
        return res;
      },
      json: function (data: any) {
        responseBody = data;
        resolve({ status: statusCode, body: responseBody });
        return res;
      },
      send: function (data: any) {
        responseBody = data;
        resolve({ status: statusCode, body: responseBody });
        return res;
      },
      setHeader: function () {
        return res;
      },
      write: function () {
        return true;
      },
      end: function (data: any) {
        if (data) responseBody = data;
        resolve({ status: statusCode, body: responseBody });
      },
    };

    // Dispatch through express app
    app(req, res, (err: any) => {
      if (err) reject(err);
      else resolve({ status: statusCode, body: responseBody });
    });
  });
}

export async function runPhase6APIIntegrationTests(): Promise<{ passed: boolean; testCount: number; results: string[] }> {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const testLogs: string[] = [];
  const logPass = (name: string) => {
    testLogs.push(`[PASS] ${name}`);
  };

  const projectId = `p6_proj_${Date.now()}`;
  const sceneId1 = `p6_scene_1_${Date.now()}`;
  const sceneId2 = `p6_scene_2_${Date.now()}`;
  const shotId1 = `p6_shot_1_${Date.now()}`;
  const shotId2 = `p6_shot_2_${Date.now()}`;

  // Seed test data in DB
  const testProject: Project = {
    id: projectId,
    title: 'Perjalanan Hijrah Nabawiyyah',
    raw_script: 'Naskah perjalanan hijrah',
    total_duration_target_sec: 20,
    max_scene_shot_duration_sec: 10,
    prompt_language: 'id',
    image_model: 'nano_banana_pro',
    video_model: ['veo', 'gemini_omni'],
    include_seedance_format: true,
    status: 'completed',
    current_stage: 8,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await db.saveProject(testProject);

  const character1: CharacterBible = {
    id: `char_abu_bakr_${Date.now()}`,
    project_id: projectId,
    name: 'Abu Bakr Ash-Shiddiq',
    role: 'sahabat',
    age: '50-an',
    gender: 'pria',
    physical_appearance: 'Wajah teduh, jubah putih bersih berbahan katun tenun gurun pasir kuno, sorban putih rapi.',
    clothing: ['jubah putih bersih tenun gurun pasir kuno', 'sorban putih'],
    personality: 'Bijaksana dan setia',
    movement_style: 'Tenang dan terukur',
    hair: 'tertutup sorban',
    beard: 'rapi',
    accessories: ['tongkat kayu'],
    voice_character: 'tenang dan berwibawa',
    face_identity_locked: true,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await db.saveAndMergeCharacters(projectId, [character1]);

  const location1: LocationBible = {
    id: `loc_gua_tsur_${Date.now()}`,
    project_id: projectId,
    name: 'Gua Tsur',
    description: 'Gua berbatu terjal di pegunungan selatan Mekkah abad 7, remang dengan bias cahaya matahari sore keemasan.',
    environment: 'interior gua batu cadas kering',
    era: '622 Masehi',
    architecture: 'natural sandstone cave',
    landscape: 'desert mountain',
    climate: 'arid',
    culture: 'Ancient Arabian',
    lighting_style: 'ambient golden hour light piercing rocky entrance',
    color_palette: ['sandstone', 'gold', 'shadow'],
    material: 'rock',
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await db.saveAndMergeLocations(projectId, [location1]);

  const object1: ObjectBible = {
    id: `obj_tongkat_${Date.now()}`,
    project_id: projectId,
    name: 'Tongkat Kayu Zaitun',
    description: 'Tongkat kayu zaitun tua dengan ukiran sederhana',
    category: 'prop',
    owner: 'Abu Bakr Ash-Shiddiq',
    continuity_notes: 'Tongkat perjalanan gurun',
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await db.saveAndMergeObjects(projectId, [object1]);

  const scene1: Scene = {
    id: sceneId1,
    project_id: projectId,
    scene_number: 1,
    title: 'Perlindungan di Gua Tsur',
    location_name: 'Gua Tsur',
    characters_present: ['Abu Bakr Ash-Shiddiq'],
    character_names: ['Abu Bakr Ash-Shiddiq'],
    duration_sec: 10,
    story_purpose: 'Menampilkan kesetiaan dan perlindungan',
    time_of_day: 'Senja',
    emotional_objective: 'Ketenangan spiritual',
    narrative_function: 'Eksposisi',
    event: 'Abu Bakr menjaga mulut gua dengan kewaspadaan penuh di kala senja.',
    master_image_prompt: 'Abu Bakr standing in Gua Tsur in white desert robe',
    status: 'ready',
    version: 1,
    updated_at: new Date().toISOString(),
  };

  const scene2: Scene = {
    id: sceneId2,
    project_id: projectId,
    scene_number: 2,
    title: 'Melanjutkan Langkah ke Yatsrib',
    location_name: 'Gua Tsur',
    characters_present: ['Abu Bakr Ash-Shiddiq'],
    character_names: ['Abu Bakr Ash-Shiddiq'],
    duration_sec: 10,
    story_purpose: 'Melanjutkan perjalanan',
    time_of_day: 'Pagi',
    emotional_objective: 'Harapan dan tekad',
    narrative_function: 'Perkembangan',
    event: 'Abu Bakr melangkah keluar dari gua menatap hamparan gurun terbuka.',
    master_image_prompt: 'Abu Bakr exiting Gua Tsur into vast golden desert',
    status: 'ready',
    version: 1,
    updated_at: new Date().toISOString(),
  };

  const savedScenes = await db.saveScenes(projectId, [scene1, scene2]);
  const actualSceneId1 = savedScenes[0].id!;
  const actualSceneId2 = savedScenes[1].id!;

  const shot1: Shot = {
    id: shotId1,
    project_id: projectId,
    scene_id: actualSceneId1,
    shot_number: 1,
    start_time_sec: 0,
    end_time_sec: 10,
    duration_sec: 10,
    event_detail: 'Abu Bakr mengamati arah luar mulut gua dengan tatapan tenang.',
    character_action: 'Abu Bakr berdiri di dekat celah batu gua memegang tongkat zaitun.',
    camera_note: 'Medium eye-level shot, subtle push in, 50mm lens.',
    dialogue: [],
    emotion: 'Waspada dan berserah diri',
    audio_note: 'Suara desau angin gurun lembut',
    version: 1,
    lock_state: {
      character_locked: true,
      location_locked: true,
      costume_locked: true,
      lighting_locked: true,
      camera_locked: false,
      action_locked: false,
      composition_locked: false,
    },
    prompt_versions: [],
    video_prompt: 'Cinematic medium shot of Abu Bakr in Gua Tsur',
  };

  const shot2: Shot = {
    id: shotId2,
    project_id: projectId,
    scene_id: actualSceneId2,
    shot_number: 1,
    start_time_sec: 0,
    end_time_sec: 10,
    duration_sec: 10,
    event_detail: 'Abu Bakr melangkah maju melintasi pintu batu.',
    character_action: 'Abu Bakr melangkah perlahan ke arah luar.',
    camera_note: 'Wide tracking shot from interior to desert exterior.',
    dialogue: [],
    emotion: 'Harapan dan keteguhan',
    audio_note: 'Suara gemersik pasir tertiup angin',
    version: 1,
    lock_state: {
      character_locked: true,
      location_locked: true,
      costume_locked: true,
      lighting_locked: true,
      camera_locked: false,
      action_locked: false,
      composition_locked: false,
    },
    prompt_versions: [],
    video_prompt: 'Cinematic wide tracking shot of Abu Bakr walking out into desert',
  };

  const savedShots1 = await db.saveShots(actualSceneId1, projectId, [shot1]);
  const savedShots2 = await db.saveShots(actualSceneId2, projectId, [shot2]);
  const actualShotId1 = savedShots1[0].id!;
  const actualShotId2 = savedShots2[0].id!;

  // =========================================================================
  // TEST SUITE: API-01 to API-15
  // =========================================================================

  // API-01: GET /api/projects/:id/production-plan (Valid Project)
  {
    const res = await mockRequest(app, 'GET', `/api/projects/${projectId}/production-plan`);
    assert(res.status === 200, `API-01: Expected 200, got ${res.status}`);
    assert(res.body.success === true, 'API-01: Response must have success: true');
    assert(res.body.generation_plan !== undefined, 'API-01: Must return generation_plan');
    assert(Array.isArray(res.body.recommended_platform_per_shot), 'API-01: Must return recommended_platform_per_shot array');
    assert(res.body.production_readiness !== undefined, 'API-01: Must return production_readiness');
    assert(res.body.ai_call_budget !== undefined, 'API-01: Must return ai_call_budget');
    assert(res.body.ai_call_budget.actual_gemini_calls === 0, 'API-01: Plan generation must incur 0 AI calls');
    logPass('API-01: GET /api/projects/:id/production-plan returns deterministic plan (0 AI calls)');
  }

  // API-02: GET /api/projects/:id/production-plan (Non-existent Project)
  {
    const res = await mockRequest(app, 'GET', '/api/projects/non_existent_project_xyz/production-plan');
    assert(res.status === 404, `API-02: Expected 404 for missing project, got ${res.status}`);
    assert(res.body.success === false, 'API-02: Expected success: false on missing project');
    logPass('API-02: GET /api/projects/:id/production-plan returns 404 for non-existent project');
  }

  // API-03: POST /api/projects/:id/sequence-candidates/evaluate (Valid Project)
  {
    const res = await mockRequest(app, 'POST', `/api/projects/${projectId}/sequence-candidates/evaluate`);
    assert(res.status === 200, `API-03: Expected 200, got ${res.status}`);
    assert(res.body.success === true, 'API-03: Response must have success: true');
    assert(Array.isArray(res.body.candidates), 'API-03: Candidates must be an array');
    assert(res.body.evaluated_scenes_count === 2, `API-03: Expected 2 evaluated scenes, got ${res.body.evaluated_scenes_count}`);
    logPass('API-03: POST /api/projects/:id/sequence-candidates/evaluate returns candidates with metadata');
  }

  // API-04: POST /api/projects/:id/sequence-candidates/evaluate (Duration Non-mutation Invariant)
  {
    const scenesBefore = await db.getScenes(projectId);
    const shotsBefore = await db.getShotsByProject(projectId);
    const scene1DurationBefore = scenesBefore.find((s) => s.id === actualSceneId1)?.duration_sec;
    const shot1DurationBefore = shotsBefore.find((s) => s.id === actualShotId1)?.duration_sec;

    await mockRequest(app, 'POST', `/api/projects/${projectId}/sequence-candidates/evaluate`);

    const scenesAfter = await db.getScenes(projectId);
    const shotsAfter = await db.getShotsByProject(projectId);
    const scene1DurationAfter = scenesAfter.find((s) => s.id === actualSceneId1)?.duration_sec;
    const shot1DurationAfter = shotsAfter.find((s) => s.id === actualShotId1)?.duration_sec;

    assert(scene1DurationBefore === scene1DurationAfter, 'API-04: Scene duration must NOT be mutated');
    assert(shot1DurationBefore === shot1DurationAfter, 'API-04: Shot duration must NOT be mutated');
    logPass('API-04: Sequence candidate evaluation preserves narrative scene & shot durations');
  }

  // API-05: POST /api/projects/:id/sequence-candidates/evaluate (Non-existent Project)
  {
    const res = await mockRequest(app, 'POST', '/api/projects/non_existent_project_xyz/sequence-candidates/evaluate');
    assert(res.status === 404, `API-05: Expected 404, got ${res.status}`);
    logPass('API-05: Sequence candidate evaluation returns 404 for non-existent project');
  }

  // API-06: POST /api/projects/:id/quota-profiles (Valid Payload)
  {
    const quotaPayload = [
      {
        provider_id: 'veo',
        daily_quota: 100,
        used_quota: 30,
        cost_per_generation: 10,
      },
      {
        provider_id: 'seedance',
        daily_quota: 200,
        used_quota: 50,
        cost_per_generation: 15,
      },
    ];
    const res = await mockRequest(app, 'POST', `/api/projects/${projectId}/quota-profiles`, { quota_profiles: quotaPayload });
    assert(res.status === 200, `API-06: Expected 200, got ${res.status}`);
    assert(res.body.success === true, 'API-06: Expected success: true');
    assert(res.body.quota_profiles.length === 2, 'API-06: Expected 2 stored quota profiles');
    assert(res.body.quota_profiles[0].remaining_quota === 70, 'API-06: remaining_quota must be 70');
    assert(res.body.quota_profiles[0].estimated_usable_generations === 7, 'API-06: estimated_usable_generations must be 7');
    assert(res.body.quota_profiles[1].remaining_quota === 150, 'API-06: remaining_quota must be 150');
    assert(res.body.quota_profiles[1].estimated_usable_generations === 10, 'API-06: estimated_usable_generations must be 10');
    logPass('API-06: POST /api/projects/:id/quota-profiles computes remaining and usable generations');
  }

  // API-07: POST /api/projects/:id/quota-profiles (Invalid Payload Validation)
  {
    const invalidPayload = [{ provider_id: '' }]; // missing provider_id string
    const res = await mockRequest(app, 'POST', `/api/projects/${projectId}/quota-profiles`, { quota_profiles: invalidPayload });
    assert(res.status === 422 || res.status === 400, `API-07: Expected 422 or 400 for invalid quota payload, got ${res.status}`);
    logPass('API-07: POST /api/projects/:id/quota-profiles rejects invalid payload schema');
  }

  // API-08: POST /api/projects/:id/quota-profiles (Non-existent Project)
  {
    const res = await mockRequest(app, 'POST', '/api/projects/non_existent_project_xyz/quota-profiles', { quota_profiles: [] });
    assert(res.status === 404, `API-08: Expected 404, got ${res.status}`);
    logPass('API-08: POST /api/projects/:id/quota-profiles returns 404 for non-existent project');
  }

  // API-09: POST /api/shots/:id/smart-regenerate (Deterministic Execution & Contract Validation)
  {
    const res = await mockRequest(app, 'POST', `/api/shots/${actualShotId1}/smart-regenerate`, {
      target: 'veo',
      require_ai: false,
      reason: 'CAMERA',
      custom_instructions: 'Slow panning camera across rocky cave mouth',
    });
    assert(res.status === 200, `API-09: Expected 200, got ${res.status} (${JSON.stringify(res.body)})`);
    assert(res.body.success === true, 'API-09: Expected success: true');
    assert(res.body.deterministic === true, 'API-09: Expected deterministic: true (0 AI calls)');
    assert(res.body.target === 'veo', 'API-09: Expected target: veo');
    assert(typeof res.body.version === 'object', 'API-09: Expected version object in response');
    assert(res.body.version.created_by === 'compiler', 'API-09: Deterministic regenerate created_by compiler');
    logPass('API-09: POST /api/shots/:id/smart-regenerate executes deterministically and validates contract');
  }

  // API-10: POST /api/shots/:id/smart-regenerate (Field Lock Invariant Preservation)
  {
    const res = await mockRequest(app, 'POST', `/api/shots/${actualShotId1}/smart-regenerate`, {
      target: 'veo',
      require_ai: false,
      reason: 'LIGHTING',
      field_locks: {
        character_locked: true,
        location_locked: true,
        costume_locked: true,
        lighting_locked: false,
        camera_locked: true,
      },
      custom_instructions: 'Warm torchlight casting long flickering shadows on cave sandstone',
    });
    assert(res.status === 200, `API-10: Expected 200, got ${res.status}`);
    assert(res.body.lock_state.character_locked === true, 'API-10: Character must remain locked');
    assert(res.body.lock_state.location_locked === true, 'API-10: Location must remain locked');
    assert(res.body.lock_state.costume_locked === true, 'API-10: Costume must remain locked');
    assert(res.body.lock_state.camera_locked === true, 'API-10: Camera locked state preserved');
    assert(res.body.lock_state.lighting_locked === false, 'API-10: Lighting unlocked state honored');
    // Verify prompt text contains canonical character and location descriptors
    const promptText = res.body.version.prompt_text;
    assert(promptText.toLowerCase().includes('abu bakr') || promptText.toLowerCase().includes('sahabat'), 'API-10: Locked character preserved');
    assert(promptText.toLowerCase().includes('gua tsur') || promptText.toLowerCase().includes('cave'), 'API-10: Locked location preserved');
    logPass('API-10: Prompt regeneration strictly respects PromptLockState invariants');
  }

  // API-11: POST /api/shots/:id/smart-regenerate (Non-destructive Version History)
  {
    const shotBefore = await db.getShot(actualShotId1);
    const versionsCountBefore = shotBefore?.prompt_versions?.length || 0;

    const res = await mockRequest(app, 'POST', `/api/shots/${actualShotId1}/smart-regenerate`, {
      target: 'seedance_10',
      require_ai: false,
      reason: 'FULL',
    });
    assert(res.status === 200, `API-11: Expected 200, got ${res.status}`);
    const shotAfter = await db.getShot(actualShotId1);
    const versionsCountAfter = shotAfter?.prompt_versions?.length || 0;
    assert(versionsCountAfter === versionsCountBefore + 1, `API-11: Version count must increment from ${versionsCountBefore} to ${versionsCountBefore + 1}`);
    assert(shotAfter?.prompt_versions?.[versionsCountAfter - 1].prompt_target === 'seedance_10', 'API-11: Last version recorded correctly');
    logPass('API-11: Prompt versions are appended non-destructively without overwriting history');
  }

  // API-12: POST /api/shots/:id/smart-regenerate (Non-existent Shot 404)
  {
    const res = await mockRequest(app, 'POST', '/api/shots/non_existent_shot_xyz/smart-regenerate', {
      target: 'veo',
    });
    assert(res.status === 404, `API-12: Expected 404, got ${res.status}`);
    assert(res.body.code === 'SHOT_NOT_FOUND', 'API-12: Expected SHOT_NOT_FOUND code');
    logPass('API-12: POST /api/shots/:id/smart-regenerate returns 404 for non-existent shot');
  }

  // API-13: POST /api/shots/:id/smart-regenerate (Invalid Target 400)
  {
    const res = await mockRequest(app, 'POST', `/api/shots/${actualShotId1}/smart-regenerate`, {
      target: 'invalid_unsupported_platform_xyz',
    });
    assert(res.status === 400, `API-13: Expected 400 for invalid target, got ${res.status}`);
    logPass('API-13: POST /api/shots/:id/smart-regenerate returns 400 for invalid target platform');
  }

  // API-14: Consolidated PUT /scenes/:id and PUT /shots/:id
  {
    // Update Scene
    const sceneUpdateRes = await mockRequest(app, 'PUT', `/api/scenes/${actualSceneId1}`, {
      master_frame_image_url: 'https://storage.example.com/master_frame_1.jpg',
      title: 'Perlindungan di Gua Tsur (Updated Title)',
    });
    assert(sceneUpdateRes.status === 200, `API-14: Scene update expected 200, got ${sceneUpdateRes.status}`);
    assert(sceneUpdateRes.body.scene.master_frame_image_url === 'https://storage.example.com/master_frame_1.jpg', 'API-14: master_frame_image_url saved');
    assert(sceneUpdateRes.body.scene.title === 'Perlindungan di Gua Tsur (Updated Title)', 'API-14: Scene title saved');

    // Update Shot
    const shotUpdateRes = await mockRequest(app, 'PUT', `/api/shots/${actualShotId1}`, {
      shot_image_url: 'https://storage.example.com/shot_1.jpg',
      camera_movement: 'Pan Left 45 degrees',
    });
    assert(shotUpdateRes.status === 200, `API-14: Shot update expected 200, got ${shotUpdateRes.status}`);
    assert(shotUpdateRes.body.shot.shot_image_url === 'https://storage.example.com/shot_1.jpg', 'API-14: shot_image_url saved');
    assert(shotUpdateRes.body.shot.camera_movement === 'Pan Left 45 degrees', 'API-14: Shot camera_movement saved');

    // Missing Scene 404
    const missingSceneRes = await mockRequest(app, 'PUT', '/api/scenes/non_existent_scene_xyz', { title: 'Test' });
    assert(missingSceneRes.status === 404, 'API-14: Missing scene PUT returns 404');

    // Missing Shot 404
    const missingShotRes = await mockRequest(app, 'PUT', '/api/shots/non_existent_shot_xyz', { camera_movement: 'Test' });
    assert(missingShotRes.status === 404, 'API-14: Missing shot PUT returns 404');
    logPass('API-14: Consolidated PUT routes handle full payloads, images, and return 404 for missing entities');
  }

  // API-15: GET /api/projects/:id/asset-graph & GET /api/projects/:id/asset-graph/impact/:assetId
  {
    const graphRes = await mockRequest(app, 'GET', `/api/projects/${projectId}/asset-graph`);
    assert(graphRes.status === 200, `API-15: Graph expected 200, got ${graphRes.status}`);
    assert(graphRes.body.graph !== undefined, 'API-15: Graph returned');
    assert(graphRes.body.nodes_count > 0, 'API-15: Graph has nodes');

    // Impact analysis for character
    const charNode = Object.values(graphRes.body.graph.nodes as Record<string, any>).find((node: any) => node.type === 'character');
    assert(Boolean(charNode), 'API-15: Found character node in graph');
    const charAssetId = charNode.id;

    const impactRes = await mockRequest(app, 'GET', `/api/projects/${projectId}/asset-graph/impact/${charAssetId}`);
    assert(impactRes.status === 200, `API-15: Impact expected 200, got ${impactRes.status}`);
    assert(impactRes.body.impact_analysis !== undefined, 'API-15: Impact analysis returned');
    assert(impactRes.body.impact_analysis.target_asset_id === charAssetId, 'API-15: Impact analysis target asset matches');
    assert(impactRes.body.impact_analysis.affected_scenes_count >= 1, 'API-15: Character affects scenes');
    logPass('API-15: Asset Graph and Impact Analysis endpoints return deterministic topology (0 AI calls)');
  }

  // API-16: GET /api/projects/:id/story-architecture synthesis resilience with missing raw_script
  {
    const legacyProjId = `legacy_proj_${Date.now()}`;
    await db.saveProject({
      id: legacyProjId,
      title: 'Legacy Title Only Project',
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);

    const archRes = await mockRequest(app, 'GET', `/api/projects/${legacyProjId}/story-architecture`);
    assert(archRes.status === 200, `API-16: Expected 200 for legacy story architecture, got ${archRes.status}`);
    assert(archRes.body.project_id === legacyProjId, 'API-16: Correct project ID');
    assert(archRes.body.acts.length > 0, 'API-16: Synthesized acts');
    assert(typeof archRes.body.premise === 'string', 'API-16: Premise is string');
    logPass('API-16: GET /api/projects/:id/story-architecture handles undefined raw_script and missing fields safely');
  }

  return {
    passed: true,
    testCount: 16,
    results: testLogs,
  };
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('phase6_api_contract_tests.ts')) {
  runPhase6APIIntegrationTests()
    .then((summary) => {
      console.log('\n======================================================');
      console.log(`PHASE 6 API INTEGRATION SUITE: ${summary.passed ? 'ALL PASS' : 'FAIL'}`);
      console.log(`Test Count: ${summary.testCount}/${summary.testCount}`);
      console.log('======================================================');
      summary.results.forEach((r) => console.log(r));
      console.log('\nAI CALLS ADDED BY PHASE 6: 0');
      process.exit(summary.passed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}
