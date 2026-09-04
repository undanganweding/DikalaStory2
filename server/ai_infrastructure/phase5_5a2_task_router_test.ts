import { taskRouter } from './task_router';
import { taskRegistry } from './task_registry';
import { db } from '../db';
import { secretVault } from '../security/secret_vault';
import { quotaRouter } from './quota_router';
import { credentialService } from './credential_service';
import { healthService } from './health_service';
import { providerService } from './provider_service';
import { modelRegistryService } from './model_registry_service';

export async function runPhase5_5A2Test(): Promise<boolean> {
  console.log('===============================================================');
  console.log('🎬 RUNNING PHASE 5.5A.2 — TASK ROUTER ENGINE COMPREHENSIVE TEST');
  console.log('===============================================================\n');

  let allPassed = true;

  // Setup Test Providers, Models & Keys
  const testProviderId = `prov_task_router_${Date.now()}`;
  const unhealthProviderId = `prov_unhealthy_${Date.now()}`;

  try {
    // 1. Create healthy test provider with custom OpenAI-compatible format
    await providerService.addProvider({
      id: testProviderId,
      name: 'Cinema Cloud AI Prods',
      type: 'openai-compatible',
      baseUrl: 'https://api.cinemacloud.ai/v1',
      enabled: true,
      capabilities: { text: true, vision: true, image: false, video: false },
    });

    // Add Credential 1 (Priority 2)
    const key1 = await credentialService.addCredential({
      providerId: testProviderId,
      name: 'Cinema Key A (Standard)',
      secret: 'sk-cinema-key-a-12345',
      status: 'active',
      weight: 50,
      priority: 2,
    });

    // Add Credential 2 (Priority 1 - should be chosen by credential router)
    const key2 = await credentialService.addCredential({
      providerId: testProviderId,
      name: 'Cinema Key B (High Priority)',
      secret: 'sk-cinema-key-b-67890',
      status: 'active',
      weight: 100,
      priority: 1,
    });

    // Register Models for this provider via modelRegistryService (ensures AMM sync)
    // Model 1: Cinema Deep Think (Pro reasoning model with 1M context)
    await modelRegistryService.addModel({
      id: 'cinema-deep-think-v2',
      providerId: testProviderId,
      displayName: 'Cinema Deep Think V2',
      tier: 'pro',
      capabilities: ['text', 'reasoning', 'structured_output', 'vision'],
      contextWindow: 1000000,
      enabled: true,
    });

    // Model 2: Cinema Fast Shot (Flash fast model with 128k context)
    await modelRegistryService.addModel({
      id: 'cinema-fast-shot-v1',
      providerId: testProviderId,
      displayName: 'Cinema Fast Shot V1',
      tier: 'flash',
      capabilities: ['text', 'fast', 'structured_output', 'creative'],
      contextWindow: 128000,
      enabled: true,
    });

    // Model 3: Cinema Disabled Model (Pro reasoning, but enabled=false)
    await modelRegistryService.addModel({
      id: 'cinema-disabled-pro',
      providerId: testProviderId,
      displayName: 'Cinema Disabled Pro',
      tier: 'pro',
      capabilities: ['text', 'reasoning', 'structured_output'],
      contextWindow: 1000000,
      enabled: false,
    });

    // 2. Create Unhealthy Provider
    await providerService.addProvider({
      id: unhealthProviderId,
      name: 'Failing Provider Cloud',
      type: 'openai-compatible',
      baseUrl: 'https://api.failing.ai/v1',
      enabled: true,
      capabilities: { text: true, vision: true, image: false, video: false },
    });

    await credentialService.addCredential({
      providerId: unhealthProviderId,
      name: 'Failing Key',
      secret: 'sk-failing-key',
      status: 'active',
      weight: 100,
      priority: 1,
    });

    await modelRegistryService.addModel({
      id: 'failing-ultra-pro',
      providerId: unhealthProviderId,
      displayName: 'Failing Ultra Pro',
      tier: 'ultra',
      capabilities: ['text', 'reasoning', 'structured_output'],
      contextWindow: 2000000,
      enabled: true,
    });

    // Mark unhealthy provider as unavailable in QuotaRouter
    await quotaRouter.recordProviderFailure(unhealthProviderId, 'unavailable', 'Connection timed out repeatedly');

    console.log('👉 [SETUP COMPLETE] Test Provider, Models, and Keys registered.\n');
  } catch (err: any) {
    console.error('Setup failed:', err.message);
    return false;
  }

  // ---------------------------------------------------------------------------
  // CASE 1: S1 chooses reasoning capable pro model with transparent score & reasons
  // ---------------------------------------------------------------------------
  console.log('👉 [CASE 1] S1 (story_analysis) Task Plan Resolution');
  try {
    const planS1 = await taskRouter.resolveTaskExecutionPlan({
      taskId: 'story_analysis',
      stageCode: 'S1',
      projectPolicy: { mode: 'auto', priority: 'quality' },
    });

    console.log('  Plan Result S1:', {
      taskId: planS1.taskId,
      modelId: planS1.modelId,
      providerId: planS1.providerId,
      credentialId: planS1.credentialId,
      score: planS1.score,
      reasonsCount: planS1.reasons.length,
    });

    if (planS1.score <= 0) {
      throw new Error(`Expected plan score > 0, got ${planS1.score}`);
    }

    if (!planS1.modelId.includes('pro') && !planS1.modelId.includes('deep-think') && !planS1.modelId.includes('gemini-2.5-pro')) {
      throw new Error(`Expected S1 to select a Pro reasoning model, got '${planS1.modelId}'`);
    }

    const hasReasoningReason = planS1.reasons.some(r => r.includes('reasoning') || r.includes('Capabilities'));
    if (!hasReasoningReason) {
      throw new Error('Expected reasons to contain capability explanation');
    }

    console.log('  ✅ CASE 1 PASSED: S1 resolved to Pro reasoning model with high transparent score and granular reasoning logs.\n');
  } catch (err: any) {
    console.error('  ❌ CASE 1 FAILED:', err.message);
    allPassed = false;
  }

  // ---------------------------------------------------------------------------
  // CASE 2: S6 chooses fast structured output model
  // ---------------------------------------------------------------------------
  console.log('👉 [CASE 2] S6 (shot_breakdown) Task Plan Resolution');
  try {
    const planS6 = await taskRouter.resolveTaskExecutionPlan({
      taskId: 'shot_breakdown',
      stageCode: 'S6',
      projectPolicy: { mode: 'auto', priority: 'speed' },
    });

    console.log('  Plan Result S6:', {
      taskId: planS6.taskId,
      modelId: planS6.modelId,
      providerId: planS6.providerId,
      score: planS6.score,
      tier: planS6.candidateEvaluation?.selectedModelTier,
    });

    if (!planS6.modelId.includes('flash') && !planS6.modelId.includes('fast-shot')) {
      throw new Error(`Expected S6 to select a Flash / Fast model, got '${planS6.modelId}'`);
    }

    console.log('  ✅ CASE 2 PASSED: S6 resolved to Fast/Flash model for high-throughput structured shot decomposition.\n');
  } catch (err: any) {
    console.error('  ❌ CASE 2 FAILED:', err.message);
    allPassed = false;
  }

  // ---------------------------------------------------------------------------
  // CASE 3: Disabled model is strictly ignored
  // ---------------------------------------------------------------------------
  console.log('👉 [CASE 3] Disabled Models Are Strictly Ignored');
  try {
    const plan = await taskRouter.resolveTaskExecutionPlan({
      taskId: 'story_analysis',
      projectPolicy: { mode: 'auto' },
    });

    if (plan.modelId === 'cinema-disabled-pro') {
      throw new Error("Disabled model 'cinema-disabled-pro' was selected!");
    }

    console.log(`  ✓ Successfully ignored disabled model 'cinema-disabled-pro', selected active model '${plan.modelId}'`);
    console.log('  ✅ CASE 3 PASSED: Disabled models in database are completely filtered out.\n');
  } catch (err: any) {
    console.error('  ❌ CASE 3 FAILED:', err.message);
    allPassed = false;
  }

  // ---------------------------------------------------------------------------
  // CASE 4: Unhealthy provider is strictly ignored
  // ---------------------------------------------------------------------------
  console.log('👉 [CASE 4] Unhealthy Providers Are Strictly Ignored');
  try {
    const plan = await taskRouter.resolveTaskExecutionPlan({
      taskId: 'story_analysis',
      projectPolicy: { mode: 'auto' },
    });

    if (plan.providerId === unhealthProviderId || plan.modelId === 'failing-ultra-pro') {
      throw new Error(`Unhealthy provider '${unhealthProviderId}' or model 'failing-ultra-pro' was selected!`);
    }

    console.log(`  ✓ Unhealthy provider '${unhealthProviderId}' was filtered out. Selected healthy provider '${plan.providerId}'`);
    console.log('  ✅ CASE 4 PASSED: Unhealthy providers and circuit-broken models are bypassed.\n');
  } catch (err: any) {
    console.error('  ❌ CASE 4 FAILED:', err.message);
    allPassed = false;
  }

  // ---------------------------------------------------------------------------
  // CASE 5: Credential Rotation & Score Integration Respected
  // ---------------------------------------------------------------------------
  console.log('👉 [CASE 5] Credential Rotation & Priority Integration');
  try {
    const plan = await taskRouter.resolveTaskExecutionPlan({
      taskId: 'story_analysis',
      projectPolicy: {
        mode: 'pin',
        pinnedModelId: 'cinema-deep-think-v2',
        pinnedProviderId: testProviderId,
      },
    });

    console.log('  Pinned Plan Credential:', {
      modelId: plan.modelId,
      providerId: plan.providerId,
      credentialId: plan.credentialId,
    });

    // Key B has priority 1, Key A has priority 2 for testProviderId -> Key B must be selected
    const credB = (await credentialService.listCredentials()).find(c => c.providerId === testProviderId && c.name?.includes('Key B'));
    if (credB && plan.credentialId !== credB.id) {
      throw new Error(`Expected highest priority Key B ('${credB.id}') to be selected for provider '${testProviderId}', got '${plan.credentialId}'`);
    }

    console.log(`  ✓ Credential router successfully prioritized Key B over Key A`);
    console.log('  ✅ CASE 5 PASSED: Credential router accurately selects highest scoring active credential.\n');
  } catch (err: any) {
    console.error('  ❌ CASE 5 FAILED:', err.message);
    allPassed = false;
  }

  console.log('===============================================================');
  if (allPassed) {
    console.log('🎉 ALL 5 TEST CASES PASSED!');
    console.log('✅ Task Router Engine is now fully operational with transparent scoring and full database/credential integration.');
  } else {
    console.log('⚠️ SOME TEST CASES FAILED.');
  }
  console.log('===============================================================\n');

  return allPassed;
}

runPhase5_5A2Test().then(passed => {
  if (!passed) process.exit(1);
});
