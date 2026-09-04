/**
 * PHASE 5.5B.1 — S1 (Story Understanding) Pipeline Migration Test Suite
 * 
 * Verifies:
 * 1. Task Router resolves `story_analysis` to optimal model + provider + credential.
 * 2. `executeTask` executes `story_analysis` cleanly.
 * 3. `runStage1StoryUnderstanding` executes via `executeTask` and returns structured Story Bible.
 * 4. Pinned model policy vs Auto mode resolution behavior.
 */

import { executeTask } from './task_executor';
import { taskRouter } from './task_router';
import { runStage1StoryUnderstanding } from '../stages/stage1_story_understanding';
import { providerService } from './provider_service';
import { credentialService } from './credential_service';
import { modelRegistryService } from './model_registry_service';

export async function runS1MigrationTest(): Promise<boolean> {
  console.log('===============================================================');
  console.log('🎬 RUNNING PHASE 5.5B.1 — S1 TASK ROUTER MIGRATION TEST');
  console.log('===============================================================\n');

  const now = Date.now();
  const testProviderId = `prov_s1_test_${now}`;

  // 1. Setup Test Provider, Models, and Credential in Database
  await providerService.addProvider({
    id: testProviderId,
    name: 'Cinema S1 Test Provider',
    type: 'openai-compatible',
    baseUrl: 'https://api.cinemas1test.ai/v1',
    enabled: true,
    capabilities: { text: true, vision: true, image: false, video: false },
  });

  const testCred = await credentialService.addCredential({
    providerId: testProviderId,
    name: 'Cinema S1 Test Key',
    secret: 'sk-cinema-s1-test-key-12345',
    priority: 1,
    weight: 100,
    status: 'active',
  });

  await modelRegistryService.addModel({
    id: 'gemini-2.5-pro',
    providerId: testProviderId,
    displayName: 'Gemini 2.5 Pro Test',
    tier: 'pro',
    capabilities: ['text', 'reasoning', 'vision', 'structured_output', 'analysis'],
    enabled: true,
    contextWindow: 2097152,
  });

  console.log('👉 [SETUP COMPLETE] Test Provider, Models, and Keys registered via Services.\n');

  let passedCases = 0;
  const totalCases = 4;

  // CASE 1: Direct executeTask for story_analysis
  console.log('👉 [CASE 1] Direct executeTask with taskId="story_analysis"');
  try {
    const res = await executeTask({
      taskId: 'story_analysis',
      stageCode: 'S1',
      prompt: 'Analisis cerita pendek tentang seorang pemuda di Batavia 1920.',
      systemInstruction: 'Anda adalah Story Analyst AI. Kembalikan JSON dengan ringkasan cerita.',
      temperature: 0.2,
      projectPolicy: {
        mode: 'pin',
        pinnedModelId: 'gemini-2.5-pro',
        pinnedProviderId: testProviderId,
        priority: 'quality',
      },
    });

    console.log('  Execution Result:', {
      taskId: res.plan.taskId,
      modelId: res.plan.modelId,
      providerId: res.plan.providerId,
      credentialId: res.plan.credentialId,
      score: res.plan.score,
      textPreview: res.text.slice(0, 80),
    });

    if (res.plan.taskId === 'story_analysis' && res.plan.modelId && res.text) {
      console.log('  ✅ CASE 1 PASSED: Direct executeTask successfully resolved and executed story_analysis.\n');
      passedCases++;
    } else {
      console.error('  ❌ CASE 1 FAILED: Unexpected execution result structure.');
    }
  } catch (err: any) {
    console.error('  ❌ CASE 1 EXCEPTION:', err.message);
  }

  console.log('---------------------------------------------------------------\n');

  // CASE 2: runStage1StoryUnderstanding Integration
  console.log('👉 [CASE 2] runStage1StoryUnderstanding execution with Task Router');
  try {
    const stage1Result = await runStage1StoryUnderstanding({
      rawScript: 'Di sebuah stasiun luar angkasa tahun 2140, Kapten Arya menghadapi kegagalan reaktor utama sementara krunya terjebak di ruang kargo.',
      language: 'id',
      contextPackage: null,
      model: 'gemini-2.5-pro',
      reasoningConfig: {
        provider_type: 'custom_openai',
        provider_name: testProviderId,
        model_id: 'gemini-2.5-pro',
      },
    });

    console.log('  Story Bible Output:', {
      era: stage1Result.era,
      genre: stage1Result.genre,
      theme: stage1Result.theme,
      main_characters: stage1Result.main_characters,
      locations: stage1Result.locations,
    });

    if (
      stage1Result.era &&
      stage1Result.genre &&
      Array.isArray(stage1Result.main_characters) &&
      Array.isArray(stage1Result.locations)
    ) {
      console.log('  ✅ CASE 2 PASSED: runStage1StoryUnderstanding generated complete Story Bible via Task Router.\n');
      passedCases++;
    } else {
      console.error('  ❌ CASE 2 FAILED: Missing essential Story Bible fields in result.');
    }
  } catch (err: any) {
    console.error('  ❌ CASE 2 EXCEPTION:', err.message);
  }

  console.log('---------------------------------------------------------------\n');

  // CASE 3: Pinned Model Policy Override in S1
  console.log('👉 [CASE 3] Pinned Model Policy Override in S1');
  try {
    const pinnedResult = await taskRouter.resolveTaskExecutionPlan({
      taskId: 'story_analysis',
      stageCode: 'S1',
      projectPolicy: {
        mode: 'pin',
        pinnedModelId: 'gemini-2.5-pro',
        pinnedProviderId: testProviderId,
      },
    });

    console.log('  Pinned Plan:', {
      modelId: pinnedResult.modelId,
      providerId: pinnedResult.providerId,
      score: pinnedResult.score,
      reasons: pinnedResult.reasons,
    });

    if (pinnedResult.modelId === 'gemini-2.5-pro' && pinnedResult.providerId === testProviderId) {
      console.log('  ✅ CASE 3 PASSED: Pinned model override successfully respected.\n');
      passedCases++;
    } else {
      console.error('  ❌ CASE 3 FAILED: Pinned model override was not respected.');
    }
  } catch (err: any) {
    console.error('  ❌ CASE 3 EXCEPTION:', err.message);
  }

  console.log('---------------------------------------------------------------\n');

  // CASE 4: Auto Mode selects optimal reasoning model with multi-factor scoring
  console.log('👉 [CASE 4] Auto Mode transparent scoring verification');
  try {
    const autoPlan = await taskRouter.resolveTaskExecutionPlan({
      taskId: 'story_analysis',
      stageCode: 'S1',
      projectPolicy: {
        mode: 'auto',
        priority: 'quality',
      },
    });

    console.log('  Auto Plan:', {
      modelId: autoPlan.modelId,
      score: autoPlan.score,
      reasonsCount: autoPlan.reasons.length,
      sampleReason: autoPlan.reasons[0],
    });

    if (autoPlan.score > 70 && autoPlan.reasons.length >= 3) {
      console.log('  ✅ CASE 4 PASSED: Auto mode transparently computed high score with explicit reasoning.\n');
      passedCases++;
    } else {
      console.error('  ❌ CASE 4 FAILED: Expected score > 70 and >= 3 reasoning entries.');
    }
  } catch (err: any) {
    console.error('  ❌ CASE 4 EXCEPTION:', err.message);
  }

  console.log('===============================================================');
  if (passedCases === totalCases) {
    console.log(`🎉 ALL ${passedCases}/${totalCases} S1 MIGRATION TEST CASES PASSED!`);
    console.log('✅ Stage 1 (Story Understanding) is fully migrated to Task Router.');
  } else {
    console.log(`⚠️ ${totalCases - passedCases}/${totalCases} TEST CASES FAILED.`);
  }
  console.log('===============================================================\n');

  return passedCases === totalCases;
}

runS1MigrationTest().then(passed => {
  if (!passed) process.exit(1);
  process.exit(0);
});
