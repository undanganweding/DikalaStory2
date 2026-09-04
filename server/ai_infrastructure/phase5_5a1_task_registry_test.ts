import { taskRegistry, AI_TASKS, STAGE_TO_TASK_MAP } from './task_registry';
import { classifyTaskRequirements, rankCandidatesForIntent } from './intelligence_router';
import { capabilityRegistry } from './capability_registry';
import { AITaskId } from '../../src/types';

export async function runPhase5_5A1Test(): Promise<boolean> {
  console.log('===============================================================');
  console.log('🎬 RUNNING PHASE 5.5A.1 — AI TASK REGISTRY FOUNDATION TEST');
  console.log('===============================================================\n');

  let allPassed = true;

  // ---------------------------------------------------------------------------
  // TEST 1: S1-S8 Pipeline Task Completeness & Contract Attributes
  // ---------------------------------------------------------------------------
  console.log('👉 [TEST 1] S1-S8 Pipeline Task Completeness & Specification Audit');
  try {
    const requiredStages = [
      { stage: 'S1', expectedTaskId: 'story_analysis', minContext: 200000, tier: 'pro', format: 'json', quality: 'critical' },
      { stage: 'S2', expectedTaskId: 'character_analysis', minContext: 128000, tier: 'pro', format: 'json', quality: 'high' },
      { stage: 'S3', expectedTaskId: 'location_object_analysis', minContext: 128000, tier: 'pro', format: 'json', quality: 'high' },
      { stage: 'S4', expectedTaskId: 'narrative_structure', minContext: 128000, tier: 'pro', format: 'json', quality: 'critical' },
      { stage: 'S5', expectedTaskId: 'scene_breakdown', minContext: 128000, tier: 'pro', format: 'structured_schema', quality: 'critical' },
      { stage: 'S6', expectedTaskId: 'shot_breakdown', minContext: 64000, tier: 'flash', format: 'structured_schema', quality: 'high' },
      { stage: 'S7', expectedTaskId: 'master_frame_generation', minContext: 32000, tier: 'flash', format: 'json', quality: 'high' },
      { stage: 'S8', expectedTaskId: 'video_prompt_generation', minContext: 32000, tier: 'flash', format: 'json', quality: 'high' },
    ];

    for (const item of requiredStages) {
      const task = taskRegistry.getTaskForStage(item.stage);
      if (!task) {
        throw new Error(`Task for stage '${item.stage}' not found in Task Registry`);
      }

      if (task.id !== item.expectedTaskId) {
        throw new Error(`Stage ${item.stage} taskId mismatch. Expected ${item.expectedTaskId}, got ${task.id}`);
      }

      if (task.stageCode !== item.stage) {
        throw new Error(`Task ${task.id} stageCode mismatch. Expected ${item.stage}, got ${task.stageCode}`);
      }

      if (!Array.isArray(task.requiredCapabilities) || task.requiredCapabilities.length === 0) {
        throw new Error(`Task ${task.id} must define at least one required capability`);
      }

      if (task.preferredTier !== item.tier) {
        throw new Error(`Task ${task.id} preferredTier mismatch. Expected ${item.tier}, got ${task.preferredTier}`);
      }

      if (task.minContextWindow < item.minContext) {
        throw new Error(`Task ${task.id} minContextWindow (${task.minContextWindow}) is less than expected minimum (${item.minContext})`);
      }

      if (task.outputFormatRequirement !== item.format) {
        throw new Error(`Task ${task.id} outputFormatRequirement mismatch. Expected ${item.format}, got ${task.outputFormatRequirement}`);
      }

      if (task.qualityPriority !== item.quality) {
        throw new Error(`Task ${task.id} qualityPriority mismatch. Expected ${item.quality}, got ${task.qualityPriority}`);
      }

      console.log(`  ✓ Stage ${item.stage} (${task.id}): Tier=${task.preferredTier}, Context>=${task.minContextWindow}, Format=${task.outputFormatRequirement}, Caps=[${task.requiredCapabilities.join(', ')}]`);
    }

    console.log('  ✅ TEST 1 PASSED: All S1-S8 Pipeline Tasks fully defined with explicit requirements.\n');
  } catch (err: any) {
    console.error('  ❌ TEST 1 FAILED:', err.message);
    allPassed = false;
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Task Resolution & Heuristic Stage Aliases
  // ---------------------------------------------------------------------------
  console.log('👉 [TEST 2] Task Resolution & Stage Code Aliases');
  try {
    const s1ByTask = taskRegistry.getTask('story_analysis');
    const s1ByStage = taskRegistry.getTask('S1');
    const s1ByLowerStage = taskRegistry.getTask('s1');
    const s1ByAlias = taskRegistry.getTask('STAGE1');

    if (!s1ByTask || !s1ByStage || !s1ByLowerStage || !s1ByAlias) {
      throw new Error('Failed to resolve S1 task via task name or stage aliases');
    }

    if (s1ByTask.id !== s1ByStage.id || s1ByStage.id !== s1ByAlias.id) {
      throw new Error('Inconsistent task resolution between aliases');
    }

    const s5ByTask = taskRegistry.getTask('scene_breakdown');
    const s5ByStage = taskRegistry.getTask('S5');
    if (!s5ByTask || s5ByTask.id !== s5ByStage?.id) {
      throw new Error('Failed to resolve S5 task');
    }

    console.log(`  ✓ Successfully resolved task 'story_analysis' from 'S1', 's1', 'STAGE1', and 'story_analysis'`);
    console.log(`  ✓ Successfully resolved task 'scene_breakdown' from 'S5'`);
    console.log('  ✅ TEST 2 PASSED: Task Registry resolver handles taskId, stageCode, and legacy aliases seamlessly.\n');
  } catch (err: any) {
    console.error('  ❌ TEST 2 FAILED:', err.message);
    allPassed = false;
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Intelligence Router Integration
  // ---------------------------------------------------------------------------
  console.log('👉 [TEST 3] Intelligence Router Intent Classification Integration');
  try {
    const s1Intent = classifyTaskRequirements('S1');
    console.log('  1. S1 Intent:', s1Intent);
    if (
      s1Intent.taskClass !== 'story_analysis' ||
      s1Intent.preferredTier !== 'pro' ||
      !s1Intent.requiredCapabilities.includes('reasoning') ||
      s1Intent.minContextWindow !== 200000
    ) {
      throw new Error(`S1 Intent classification mismatch: ${JSON.stringify(s1Intent)}`);
    }

    const s6Intent = classifyTaskRequirements('shot_breakdown');
    console.log('  2. S6 Intent:', s6Intent);
    if (
      s6Intent.taskClass !== 'shot_breakdown' ||
      s6Intent.preferredTier !== 'flash' ||
      !s6Intent.requiredCapabilities.includes('fast') ||
      !s6Intent.requiredCapabilities.includes('structured_output')
    ) {
      throw new Error(`S6 Intent classification mismatch: ${JSON.stringify(s6Intent)}`);
    }

    console.log('  ✅ TEST 3 PASSED: Intelligence Router consumes Task Registry authority for intent synthesis.\n');
  } catch (err: any) {
    console.error('  ❌ TEST 3 FAILED:', err.message);
    allPassed = false;
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Model Eligibility & Capability Filtering against Task Requirements
  // ---------------------------------------------------------------------------
  console.log('👉 [TEST 4] Model Eligibility Verification Against Task Requirements');
  try {
    const s1Task = taskRegistry.getTask('S1')!;
    const s6Task = taskRegistry.getTask('S6')!;

    // Model A: Gemini Pro (has reasoning + 2M context + text)
    const modelPro = {
      id: 'gemini-2.5-pro',
      capabilities: ['text', 'reasoning', 'structured_output', 'vision', 'multimodal'],
      contextWindow: 2000000,
      tier: 'pro',
    };

    // Model B: Standard Flash (has text, fast, structured_output + 1M context)
    const modelFlash = {
      id: 'gemini-3.7-flash',
      capabilities: ['text', 'fast', 'structured_output', 'creative'],
      contextWindow: 1000000,
      tier: 'flash',
    };

    // Model C: Micro Model (has text, fast, but 32k context and no reasoning or structured output)
    const modelMicro = {
      id: 'micro-model-32k',
      capabilities: ['text', 'fast'],
      contextWindow: 32000,
      tier: 'lite',
    };

    // Evaluate for S1 (Story Analysis - Requires Reasoning + 200k context)
    const evalS1Pro = taskRegistry.isModelEligibleForTask(modelPro, s1Task);
    const evalS1Micro = taskRegistry.isModelEligibleForTask(modelMicro, s1Task);

    console.log('  1. Model Pro for S1:', evalS1Pro);
    console.log('  2. Model Micro for S1:', evalS1Micro);

    if (!evalS1Pro.eligible) {
      throw new Error(`Expected Gemini Pro to be eligible for S1: ${evalS1Pro.reasons.join(', ')}`);
    }
    if (evalS1Micro.eligible) {
      throw new Error('Expected Micro model to be ineligible for S1 (missing reasoning & small context)');
    }

    // Evaluate for S6 (Shot Breakdown - Requires Structured Output + Fast + 64k Context)
    const evalS6Flash = taskRegistry.isModelEligibleForTask(modelFlash, s6Task);
    const evalS6Micro = taskRegistry.isModelEligibleForTask(modelMicro, s6Task);
    console.log('  3. Model Flash for S6:', evalS6Flash);
    console.log('  4. Model Micro for S6:', evalS6Micro);

    if (!evalS6Flash.eligible) {
      throw new Error(`Expected Flash to be eligible for S6: ${evalS6Flash.reasons.join(', ')}`);
    }
    if (evalS6Micro.eligible) {
      throw new Error('Expected Micro model to be ineligible for S6 (missing structured_output & small context)');
    }

    console.log('  ✅ TEST 4 PASSED: Task Registry accurately filters eligible vs ineligible models based on capabilities and context window.\n');
  } catch (err: any) {
    console.error('  ❌ TEST 4 FAILED:', err.message);
    allPassed = false;
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Candidate Ranking with AMM Models
  // ---------------------------------------------------------------------------
  console.log('👉 [TEST 5] Candidate Ranking using Intent & AMM Models');
  try {
    const s1Intent = classifyTaskRequirements('S1');

    const candidates = [
      {
        id: 'gemini-3.7-flash',
        name: 'Gemini 3.7 Flash',
        providerId: 'google',
        supportedCapabilities: ['text', 'vision', 'fast', 'structured_output', 'creative'],
        tier: 'flash' as const,
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        providerId: 'google',
        supportedCapabilities: ['text', 'reasoning', 'vision', 'structured_output', 'creative'],
        tier: 'pro' as const,
      },
      {
        id: 'gemini-3.5-flash-lite',
        name: 'Gemini 3.5 Flash Lite',
        providerId: 'google',
        supportedCapabilities: ['text', 'fast'],
        tier: 'flash' as const,
      },
    ];

    const ranked = rankCandidatesForIntent(s1Intent, candidates);
    console.log('  Ranked Result for S1 Intent:', {
      modelId: ranked?.modelId,
      confidenceScore: ranked?.confidenceScore,
      optimizationReason: ranked?.optimizationReason,
    });

    if (!ranked || ranked.modelId !== 'gemini-2.5-pro') {
      throw new Error(`Expected 'gemini-2.5-pro' to be selected for S1 story_analysis, got '${ranked?.modelId}'`);
    }

    console.log('  ✅ TEST 5 PASSED: rankCandidatesForIntent authoritatively selects Pro reasoning model for S1 task.\n');
  } catch (err: any) {
    console.error('  ❌ TEST 5 FAILED:', err.message);
    allPassed = false;
  }

  console.log('===============================================================');
  if (allPassed) {
    console.log('🎉 ALL PHASE 5.5A.1 TESTS PASSED!');
    console.log('✅ AI Task Registry is now the authoritative catalog of pipeline execution requirements.');
  } else {
    console.log('⚠️ SOME TESTS FAILED — CHECK LOGS ABOVE.');
  }
  console.log('===============================================================\n');

  return allPassed;
}

runPhase5_5A1Test().then(passed => {
  if (!passed) process.exit(1);
});
