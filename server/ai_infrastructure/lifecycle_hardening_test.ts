import { providerService } from './provider_service';
import { credentialService } from './credential_service';
import { modelRegistryService } from './model_registry_service';
import { usageService } from './usage_service';

async function runLifecycleHardeningVerification() {
  console.log('====================================================');
  console.log('PHASE 10D: PROVIDER & MODEL LIFECYCLE HARDENING TEST');
  console.log('====================================================\n');

  // Step 0: Initialize baseline & clean previous test artifacts
  await providerService.initializeDefaults();
  await modelRegistryService.initializeDefaults();

  try { await providerService.removeProvider('prov_test_a'); } catch {}
  try { await providerService.removeProvider('prov_test_b'); } catch {}

  const initialProviders = await providerService.listProviders();
  const initialModels = await modelRegistryService.listModels();
  console.log(`[INIT] Initial providers: ${initialProviders.length}, models: ${initialModels.length}`);

  // Test 1: Google Provider Deletion Protection
  console.log('\n[TEST 1] Protecting Default Google Provider from Deletion');
  try {
    await providerService.removeProvider('google');
    throw new Error('FAIL: Google provider deletion was allowed!');
  } catch (err: any) {
    if (err.message.includes('Cannot delete default native Google provider')) {
      console.log('✅ PASS: Google provider deletion correctly blocked.');
    } else {
      throw err;
    }
  }

  // Test 2: Provider Creation & Referential Integrity
  console.log('\n[TEST 2] Provider Creation & Referential Integrity');
  const providerA = await providerService.addProvider({
    id: 'prov_test_a',
    name: 'Provider Alpha',
    type: 'openai-compatible',
    baseUrl: 'https://api.alpha-test.com/v1',
    enabled: true,
    capabilities: { text: true, vision: false, image: false, video: false },
  });

  const providerB = await providerService.addProvider({
    id: 'prov_test_b',
    name: 'Provider Beta',
    type: 'openai-compatible',
    baseUrl: 'https://api.beta-test.com/v1',
    enabled: true,
    capabilities: { text: true, vision: false, image: false, video: false },
  });
  console.log(`✅ PASS: Created providers: ${providerA.id}, ${providerB.id}`);

  // Test 3: Credential Referential Integrity
  console.log('\n[TEST 3] Credential Referential Integrity (Nonexistent Provider)');
  try {
    await credentialService.addCredential({
      providerId: 'nonexistent_provider_xyz',
      name: 'Ghost Key',
      secret: 'sk-ghost-12345',
      status: 'active',
      priority: 1,
      weight: 10,
    });
    throw new Error('FAIL: Credential was added for nonexistent provider!');
  } catch (err: any) {
    if (err.message.includes('Cannot add credential for nonexistent provider')) {
      console.log('✅ PASS: Credential creation correctly blocked for invalid providerId.');
    } else {
      throw err;
    }
  }

  // Add valid credentials for providerA and providerB
  const credA = await credentialService.addCredential({
    providerId: providerA.id,
    name: 'Alpha Primary Key',
    secret: 'sk-alpha-secret-key-12345',
    status: 'active',
    priority: 1,
    weight: 10,
  });

  const credB = await credentialService.addCredential({
    providerId: providerB.id,
    name: 'Beta Primary Key',
    secret: 'sk-beta-secret-key-67890',
    status: 'active',
    priority: 1,
    weight: 10,
  });
  console.log(`✅ PASS: Added credentials for valid providers: ${credA.id} (masked: ${credA.maskedKey}), ${credB.id}`);

  // Test 4: Model Referential Integrity (Nonexistent Provider)
  console.log('\n[TEST 4] Model Referential Integrity (Nonexistent Provider)');
  try {
    await modelRegistryService.addModel({
      id: 'phantom-model',
      providerId: 'nonexistent_provider_xyz',
      displayName: 'Phantom Model',
      tier: 'flash',
      capabilities: ['text'],
      enabled: true,
    });
    throw new Error('FAIL: Model was added for nonexistent provider!');
  } catch (err: any) {
    if (err.message.includes('Cannot register model for nonexistent provider')) {
      console.log('✅ PASS: Model registration correctly blocked for invalid providerId.');
    } else {
      throw err;
    }
  }

  // Test 5: Model Namespace Scoping & Collision Prevention (Provider A + Model X vs Provider B + Model X)
  console.log('\n[TEST 5] Model Namespace Scoping: (providerId, modelId)');
  const modelA = await modelRegistryService.addModel({
    id: 'llama-3-8b-instruct',
    providerId: providerA.id,
    displayName: 'Alpha Llama 3 8B',
    tier: 'flash',
    capabilities: ['text'],
    enabled: true,
  });

  const modelB = await modelRegistryService.addModel({
    id: 'llama-3-8b-instruct',
    providerId: providerB.id,
    displayName: 'Beta Llama 3 8B',
    tier: 'pro',
    capabilities: ['text'],
    enabled: true,
  });

  // Verify both exist simultaneously without overwriting
  const fetchedModelA = await modelRegistryService.getModel('llama-3-8b-instruct', providerA.id);
  const fetchedModelB = await modelRegistryService.getModel('llama-3-8b-instruct', providerB.id);

  if (!fetchedModelA || !fetchedModelB) {
    throw new Error('FAIL: One of the identically named models was not found!');
  }
  if (fetchedModelA.displayName !== 'Alpha Llama 3 8B' || fetchedModelB.displayName !== 'Beta Llama 3 8B') {
    throw new Error(`FAIL: Models collided! A: ${fetchedModelA.displayName}, B: ${fetchedModelB.displayName}`);
  }
  if (fetchedModelA.tier !== 'flash' || fetchedModelB.tier !== 'pro') {
    throw new Error(`FAIL: Tier collision detected! A tier: ${fetchedModelA.tier}, B tier: ${fetchedModelB.tier}`);
  }
  console.log('✅ PASS: Provider A + Model X and Provider B + Model X remain completely independent.');

  // Test 6: Historical Usage Persistence
  console.log('\n[TEST 6] Usage & Historical Logs Persistence');
  await usageService.recordUsage({
    credentialId: credA.id,
    modelId: 'llama-3-8b-instruct',
    requestType: 'chat',
    stage: 'S1_FOUNDATION',
    promptTokens: 120,
    completionTokens: 80,
    totalTokens: 200,
    latencyMs: 350,
    success: true,
  });

  const usagesBefore = await usageService.listUsage();
  const initialUsageCount = usagesBefore.length;
  console.log(`[USAGE] Logged historical usage record (Total logs: ${initialUsageCount})`);

  // Test 7: Provider Deletion Safety & Detachment
  console.log('\n[TEST 7] Provider Deletion & Clean Detach of Active Config');
  const deletionResult = await providerService.removeProvider(providerA.id);
  console.log(`[DELETE] Provider A deletion result:`, deletionResult);

  if (!deletionResult.success) {
    throw new Error('FAIL: Provider A deletion failed!');
  }
  if (deletionResult.detachedCredentials !== 1 || deletionResult.detachedModels !== 1) {
    throw new Error(`FAIL: Expected 1 detached credential and 1 detached model, got ${deletionResult.detachedCredentials} creds and ${deletionResult.detachedModels} models`);
  }

  // Verify Provider A is gone
  const deletedProvider = await providerService.getProvider(providerA.id);
  if (deletedProvider !== null) {
    throw new Error('FAIL: Provider A still exists in provider registry!');
  }

  // Verify Provider A credentials and models are gone
  const credsAAfter = (await credentialService.listCredentials()).filter(c => c.providerId === providerA.id);
  if (credsAAfter.length !== 0) {
    throw new Error('FAIL: Orphaned credentials remained after provider deletion!');
  }

  const modelAAfter = await modelRegistryService.getModel('llama-3-8b-instruct', providerA.id);
  if (modelAAfter !== null) {
    throw new Error('FAIL: Orphaned model remained after provider deletion!');
  }

  // Verify Provider B and its model are completely unaffected
  const providerBStillExists = await providerService.getProvider(providerB.id);
  const modelBStillExists = await modelRegistryService.getModel('llama-3-8b-instruct', providerB.id);
  const credBStillExists = await credentialService.getCredential(credB.id);

  if (!providerBStillExists || !modelBStillExists || !credBStillExists) {
    throw new Error('FAIL: Provider B or its dependencies were unexpectedly affected!');
  }
  console.log('✅ PASS: Provider A detached cleanly; Provider B remains 100% intact.');

  // Verify historical usage records are strictly preserved
  const usagesAfter = await usageService.listUsage();
  if (usagesAfter.length !== initialUsageCount) {
    throw new Error(`FAIL: Usage logs count changed from ${initialUsageCount} to ${usagesAfter.length}! Historical logs were destroyed!`);
  }
  console.log('✅ PASS: Historical AI usage logs were preserved intact (Zero log loss).');

  // Clean up Provider B
  await providerService.removeProvider(providerB.id);
  console.log('✅ Cleaned up test provider B.');

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 10D LIFECYCLE HARDENING TESTS PASSED!');
  console.log('====================================================');
}

runLifecycleHardeningVerification().catch(err => {
  console.error('❌ LIFECYCLE TEST FAILED:', err);
  process.exit(1);
});
