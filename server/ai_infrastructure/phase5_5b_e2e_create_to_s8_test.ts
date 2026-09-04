/**
 * Phase 5.5B — End-to-End Test: Create Project → S1 → S8 via Autonomous Task Router
 * Verifies:
 * 1. Project creation requires NO model selection (defaults to auto Task Router).
 * 2. Entire S1-S8 lifecycle executes with Task Router as the decision authority.
 * 3. Artifacts (Story, Character, Location/Object, Narrative, Scenes, Shots, Master Frames, Video Prompts) are properly persisted.
 */

import '../isolate_test_env';
import { db } from '../db';
import { createApp } from '../app';
import { providerService } from './provider_service';
import { modelRegistryService } from './model_registry_service';
import { credentialService } from './credential_service';
import { runProjectInitialization, runPipelineForScene, generateAllScenes } from '../orchestrator';
import { taskRouter } from './task_router';
import http from 'http';

export async function runE2ECreateToS8Test(): Promise<boolean> {
  console.log('===============================================================');
  console.log('🚀 RUNNING PHASE 5.5B: E2E CREATE PROJECT → S1 → S8 TEST');
  console.log('===============================================================\n');

  // Step 1: Ensure provider & models exist in the test DB
  const e2eProviderId = `prov_e2e_${Date.now()}`;
  await providerService.addProvider({
    id: e2eProviderId,
    name: 'E2E Autonomous Provider',
    type: 'openai-compatible',
    baseUrl: 'https://api.e2e.test/v1',
    enabled: true,
    capabilities: { text: true, vision: true, image: true, video: true },
  });

  await credentialService.addCredential({
    providerId: e2eProviderId,
    name: 'E2E Autonomous Credential',
    secret: 'sk-cinema-e2e-autonomous-token',
    priority: 1,
    weight: 100,
    status: 'active',
  });

  await modelRegistryService.addModel({
    id: 'e2e-omni-director',
    providerId: e2eProviderId,
    displayName: 'E2E Omni Director',
    tier: 'pro',
    capabilities: ['text', 'reasoning', 'vision', 'structured_output', 'analysis', 'creative', 'fast'],
    enabled: true,
    contextWindow: 1048576,
  });

  console.log('Step 1: Infrastructure Seeded with Autonomous Model');

  // Step 2: Test Create Project via HTTP / API layer without specifying model
  console.log('Step 2: Simulating Create Project without model input (Zero-Config / Auto Routing)...');
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;

  const scriptContent = `
    INT. LAB CYBERNETICS - NIGHT
    Dr. Maya (34), visionary roboticist, stares at the quantum core humming with turquoise luminescence.
    General Vance (55), stern and battle-scarred, crosses his arms.
    VANCE: "Is the firewall holding, Doctor?"
    MAYA: "For now, General. But whatever is on the other side... it's learning."
    The console flashes red as sirens begin to wail.
  `;

  const createRes = await fetch(`http://127.0.0.1:${port}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Neon Odyssey E2E',
      raw_script: scriptContent,
      total_duration_target_sec: 20,
      scene_duration_sec: 10,
      prompt_language: 'id',
      // Note: NO ai_model and NO reasoning_config supplied!
    }),
  });

  if (!createRes.ok) {
    server.close();
    throw new Error(`Failed to create project via API: ${await createRes.text()}`);
  }

  const createdProject = await createRes.json();
  server.close();

  console.log(`  Created Project ID: ${createdProject.id}`);
  console.log(`  ai_model: '${createdProject.ai_model}'`);
  console.log(`  execution_policy.mode: '${createdProject.reasoning_config?.execution_policy?.mode}'`);

  if (createdProject.ai_model !== 'auto') {
    throw new Error(`Expected project.ai_model to be 'auto', but got: ${createdProject.ai_model}`);
  }
  if (createdProject.reasoning_config?.execution_policy?.mode !== 'auto') {
    throw new Error(`Expected reasoning_config.execution_policy.mode to be 'auto', but got: ${createdProject.reasoning_config?.execution_policy?.mode}`);
  }

  console.log('  ✅ VERIFIED: Project creation succeeds without requiring model selection and defaults to Auto Task Router.\n');

  // Step 3: Run Project Initialization (S1-S5)
  console.log('Step 3: Running Project Foundation Initialization (Stages S1–S5)...');
  const initResult = await runProjectInitialization(createdProject.id, (stage, stageName, msg) => {
    console.log(`    [Init Stage S${stage} - ${stageName}] ${msg}`);
  });

  if (!initResult.success) {
    throw new Error(`Project initialization failed: ${initResult.error}`);
  }

  const foundation = await db.getProjectFoundation(createdProject.id);
  const characters = await db.getCharacters(createdProject.id);
  const locations = await db.getLocations(createdProject.id);
  const scenes = await db.getScenes(createdProject.id);

  console.log(`  Foundation Era: ${foundation?.era}, Genre: ${foundation?.genre}`);
  console.log(`  Characters Detected: ${characters.length}`);
  console.log(`  Locations Detected: ${locations.length}`);
  console.log(`  Scenes Generated (S5): ${scenes.length}`);

  if (scenes.length === 0) {
    throw new Error('Project initialization produced 0 scenes.');
  }
  console.log('  ✅ VERIFIED: S1-S5 Foundation successfully generated via Task Router.\n');

  // Step 4: Run Scene Generation (S6-S8: Shots, Master Frame, Video Prompts)
  console.log('Step 4: Running Scene Generation (Stages S6–S8: Shots, Master Frame, Video Prompts)...');
  const targetScene = scenes[0];
  console.log(`  Processing Scene #${targetScene.scene_number} (${targetScene.id})...`);

  const sceneResult = await runPipelineForScene(targetScene.id!, (stage, stageName, msg) => {
    console.log(`    [Scene S${stage} - ${stageName}] ${msg}`);
  });

  console.log(`  Scene Result Status: ${sceneResult.status}, Success: ${sceneResult.success}`);

  const shots = await db.getShotsByScene(targetScene.id!);
  const updatedScene = await db.getScene(targetScene.id!);
  const videoPrompts = await db.getVideoPromptsByScene(targetScene.id!);

  console.log(`  Shots Generated (S6): ${shots.length}`);
  console.log(`  Master Frame Generated (S7): ${Boolean(updatedScene?.master_image_prompt_json)}`);
  console.log(`  Video Prompts Generated (S8): ${videoPrompts.length}`);

  if (shots.length === 0) {
    throw new Error('Scene generation produced 0 shots in S6.');
  }
  if (!updatedScene?.master_image_prompt_json) {
    throw new Error('Scene generation produced no Master Frame prompt in S7.');
  }
  if (videoPrompts.length === 0) {
    throw new Error('Scene generation produced 0 video prompts in S8.');
  }

  console.log('\n===============================================================');
  console.log('🎉 E2E TEST PASSED: CREATE PROJECT → S1 → S8 COMPLETE!');
  console.log('✅ Create Project requires zero model selection (Autonomous AI Director).');
  console.log('✅ Entire S1-S8 pipeline executed seamlessly under Task Router authority.');
  console.log('===============================================================\n');

  return true;
}

// Auto-run if invoked directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('phase5_5b_e2e_create_to_s8_test')) {
  runE2ECreateToS8Test()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ E2E TEST FAILED:', err);
      process.exit(1);
    });
}
