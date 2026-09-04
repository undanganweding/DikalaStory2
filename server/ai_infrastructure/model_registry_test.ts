import { modelRegistryService } from './model_registry_service';

async function testModelRegistryApi() {
  console.log('Testing Model Registry Service & API Integration...');

  const models = await modelRegistryService.listModels();
  console.log('Registered Models Count:', models.length);

  // If empty, test seeding default models
  if (models.length === 0) {
    const testModels = [
      {
        id: 'gemini-3.7-flash',
        providerId: 'google',
        displayName: 'Gemini 3.7 Flash',
        tier: 'flash' as const,
        capabilities: ['text', 'vision', 'image', 'video'],
        enabled: true,
        contextWindow: 1048576,
      },
      {
        id: 'gemini-2.5-pro',
        providerId: 'google',
        displayName: 'Gemini 2.5 Pro',
        tier: 'pro' as const,
        capabilities: ['text', 'vision', 'analysis'],
        enabled: true,
        contextWindow: 2097152,
      },
      {
        id: 'gemini-3.5-flash-lite',
        providerId: 'google',
        displayName: 'Gemini 3.5 Flash Lite',
        tier: 'lite' as const,
        capabilities: ['text', 'fast'],
        enabled: true,
        contextWindow: 1048576,
      },
    ];

    for (const m of testModels) {
      await modelRegistryService.addModel(m);
    }
  }

  const updatedModels = await modelRegistryService.listModels();
  console.log('Models after verification:', updatedModels.map(m => ({
    id: m.id,
    displayName: m.displayName,
    providerId: m.providerId,
    tier: m.tier,
    capabilities: m.capabilities,
    contextWindow: m.contextWindow,
    enabled: m.enabled
  })));

  // Assertions
  if (updatedModels.length < 3) {
    throw new Error('Expected at least 3 models in registry');
  }

  for (const m of updatedModels) {
    if (!m.id || !m.providerId || !m.displayName || !m.tier) {
      throw new Error(`Model ${m.id} is missing required fields`);
    }
    // Security check: ensure no secret fields
    if ((m as any).secret || (m as any).apiKey || (m as any).encryptedSecret) {
      throw new Error(`Model ${m.id} contains secret fields!`);
    }
  }

  console.log('✅ Model Registry API & Schema Verification Tests Passed Successfully!');
}

testModelRegistryApi().catch(err => {
  console.error('❌ Model Registry API test failed:', err);
  process.exit(1);
});
