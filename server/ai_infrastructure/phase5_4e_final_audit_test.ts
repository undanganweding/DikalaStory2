import { capabilityRegistry, modelsRegistry } from './capability_registry';
import { modelRegistryService } from './model_registry_service';
import { providerService } from './provider_service';
import { credentialService } from './credential_service';
import { quotaRouter } from './quota_router';
import { aiGateway } from './ai_gateway';

export async function runPhase5_4EFinalAudit(): Promise<boolean> {
  console.log('===============================================================');
  console.log('🚀 RUNNING PHASE 5.4E FINAL ARCHITECTURAL AUDIT');
  console.log('===============================================================\n');

  let allPassed = true;

  // ---------------------------------------------------------------------------
  // CHECK 1 — Apakah model yang didiscover benar masuk AMM?
  // ---------------------------------------------------------------------------
  console.log('👉 [CHECK 1] AMM Capability Authority & Discovery Flow Validation');
  try {
    // 1. Raw discovered model from upstream provider (e.g. deepseek-r1 or custom reasoning model)
    const rawDiscovered = {
      id: 'custom-pro-reasoning-model',
      displayName: 'Custom Pro Reasoning Model',
      description: 'Advanced reasoning and structured analysis model',
      capabilities: ['reasoning'],
    };

    // 2. Classify through AMM Capability Classifier
    const classified = capabilityRegistry.classifyRawModelCapability(rawDiscovered, 'openai-compatible');
    console.log('  1. AMM Classifier Output:', {
      requiredCapability: classified.requiredCapability,
      supportedCapabilities: classified.supportedCapabilities,
      tier: classified.tier,
      contextWindow: classified.contextWindow,
    });

    if (
      classified.requiredCapability !== 'text' ||
      !classified.supportedCapabilities.includes('reasoning') ||
      !classified.supportedCapabilities.includes('structured_output') ||
      classified.tier !== 'pro'
    ) {
      throw new Error(`CHECK 1 FAILED: AMM Classifier did not assign correct capability matrix: ${JSON.stringify(classified)}`);
    }

    // 3. Register provider and save model via modelRegistryService (which enforces AMM)
    const testProv = await providerService.addProvider({
      id: 'test_amm_prov_' + Date.now(),
      name: 'Test AMM Provider',
      type: 'openai-compatible',
      baseUrl: 'https://api.test-amm.com/v1',
      enabled: true,
      capabilities: { text: true, vision: true, image: false, video: false },
    });

    const savedModel = await modelRegistryService.addModel({
      id: 'custom-pro-reasoning-model',
      providerId: testProv.id,
      displayName: 'Custom Pro Reasoning Model',
      tier: 'pro',
      capabilities: ['text', 'reasoning'],
      enabled: true,
    });

    // 4. Verify AMM has synchronized this model definition
    const ammModelDef = modelsRegistry['custom-pro-reasoning-model'];
    if (!ammModelDef || !ammModelDef.providers[testProv.id]?.supported) {
      throw new Error('CHECK 1 FAILED: Model definition was not registered in AMM modelsRegistry');
    }

    // 5. Verify AMM capability authority check
    const capCheck = capabilityRegistry.isProviderCapable(testProv.id, 'custom-pro-reasoning-model', testProv);
    if (!capCheck.capable) {
      throw new Error(`CHECK 1 FAILED: AMM rejected capable model: ${capCheck.reason}`);
    }

    console.log('  ✅ CHECK 1 PASSED: Model discovery strictly enforces AMM Capability Authority (Raw -> Classifier -> AMM -> Active Model)\n');
  } catch (err: any) {
    console.error('  ❌ CHECK 1 FAILED:', err.message);
    allPassed = false;
  }

  // ---------------------------------------------------------------------------
  // CHECK 2 — Credential Router sudah membaca key baru & multiple keys?
  // ---------------------------------------------------------------------------
  console.log('👉 [CHECK 2] Credential Router & Dynamic Key Selection Validation');
  try {
    const testProvId = 'test_rotation_prov_' + Date.now();
    const testProv = await providerService.addProvider({
      id: testProvId,
      name: 'Test Rotation Provider',
      type: 'google-generative-ai',
      enabled: true,
      capabilities: { text: true, vision: true, image: true, video: true },
    });

    // Add Gemini Key A (Priority 2 / Lower Priority)
    const keyA = await credentialService.addCredential({
      providerId: testProvId,
      name: 'Gemini Key A',
      secret: 'secret_key_a_' + Date.now(),
      priority: 2,
      weight: 10,
      status: 'active',
    });

    // Add Gemini Key B (Priority 1 / Higher Priority)
    const keyB = await credentialService.addCredential({
      providerId: testProvId,
      name: 'Gemini Key B',
      secret: 'secret_key_b_' + Date.now(),
      priority: 1,
      weight: 10,
      status: 'active',
    });

    // Verify Provider has 2 credentials attached
    const allCreds = await credentialService.listCredentials();
    const provCreds = allCreds.filter(c => c.providerId === testProvId);
    console.log(`  1. Provider Credential Pool Count: ${provCreds.length} (Key A + Key B)`);
    if (provCreds.length !== 2) {
      throw new Error(`Expected 2 credentials in pool, found ${provCreds.length}`);
    }

    // Score credentials through Quota Router
    const scored = await quotaRouter.scoreCredentials(testProvId);
    console.log('  2. Quota Router Scored Chain:', scored.map(s => ({
      name: s.credential.name,
      priority: s.credential.priority,
      score: s.score,
    })));

    // Ensure Gemini Key B (priority 1) ranks #1 ahead of Gemini Key A (priority 2)
    if (scored[0].credential.name !== 'Gemini Key B') {
      throw new Error(`Expected Gemini Key B to rank first, got ${scored[0].credential.name}`);
    }

    // Register test model for gateway execution
    await modelRegistryService.addModel({
      id: 'gemini-3.7-flash',
      providerId: testProvId,
      displayName: 'Gemini 3.7 Flash',
      tier: 'flash',
      capabilities: ['text', 'vision'],
      enabled: true,
    });

    // Execute through Gateway
    const res = await aiGateway.generate({
      prompt: 'Test prompt for rotation check',
      providerId: testProvId,
      model: 'gemini-3.7-flash',
    });

    console.log(`  3. AI Gateway Response selected credential ID: ${res.credentialId} (Selected: ${keyB.name})`);
    if (res.credentialId !== keyB.id) {
      throw new Error(`Expected selected credential to be Gemini Key B (${keyB.id}), got ${res.credentialId}`);
    }

    console.log('  ✅ CHECK 2 PASSED: Credential Router dynamically scores & routes to newly added prioritized key (Gemini Key B)\n');
  } catch (err: any) {
    console.error('  ❌ CHECK 2 FAILED:', err.message);
    allPassed = false;
  }

  // ---------------------------------------------------------------------------
  // CHECK 3 — Production Vercel & Google Provider Protocol Contract
  // ---------------------------------------------------------------------------
  console.log('👉 [CHECK 3] Production Vercel / Google Provider Onboarding Contract');
  try {
    const googleProvName = 'Google Generative AI Prod ' + Date.now().toString(36);
    const googleProvId = 'google_prod_' + Date.now().toString(36);

    const newGoogleProv = await providerService.addProvider({
      id: googleProvId,
      name: googleProvName,
      type: 'google-generative-ai',
      baseUrl: 'https://generativelanguage.googleapis.com',
      enabled: true,
      capabilities: { text: true, vision: true, image: true, video: true },
    });

    const googleCred = await credentialService.addCredential({
      providerId: googleProvId,
      name: `${googleProvName} Primary Key`,
      secret: 'AIzaSy' + Math.random().toString(36).substring(2, 15),
      status: 'active',
      priority: 1,
      weight: 10,
    });

    const registeredGoogleModel = await modelRegistryService.addModel({
      id: 'gemini-3.7-flash',
      providerId: googleProvId,
      displayName: 'Gemini 3.7 Flash',
      tier: 'flash',
      capabilities: ['text', 'vision'],
      enabled: true,
    });

    if (!newGoogleProv || !googleCred || !registeredGoogleModel) {
      throw new Error('Failed to create google provider / credential / model');
    }

    const fetchedProv = await providerService.getProvider(googleProvId);
    if (!fetchedProv || fetchedProv.name !== googleProvName) {
      throw new Error(`Google provider lookup failed. Expected "${googleProvName}"`);
    }

    console.log('  1. Created Google Provider:', fetchedProv.id, `(type: ${fetchedProv.type})`);
    console.log('  2. Attached Key:', googleCred.name, `(masked: ${googleCred.maskedKey})`);
    console.log('  3. Registered Model:', registeredGoogleModel.id);
    console.log('  ✅ CHECK 3 PASSED: Google Generative AI Provider onboards cleanly with zero "unknown provider google" errors\n');
  } catch (err: any) {
    console.error('  ❌ CHECK 3 FAILED:', err.message);
    allPassed = false;
  }

  console.log('===============================================================');
  if (allPassed) {
    console.log('🎉 ALL 3 AUDIT CHECKS PASSED — PHASE 5.4E READY TO BE LOCKED!');
  } else {
    console.log('⚠️ SOME AUDIT CHECKS FAILED — REVIEW LOGS ABOVE.');
  }
  console.log('===============================================================\n');

  return allPassed;
}

runPhase5_4EFinalAudit().then(passed => {
  if (!passed) process.exit(1);
});
