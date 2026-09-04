import './isolate_test_env';
import http from 'http';
import { GoogleGenAI } from '@google/genai';

// Spy object for capturing Google GenAI SDK parameters
let lastGoogleCall: any = null;
let googleCallCount = 0;
let googleMockResponse = `{"status": "ok", "message": "google response"}`;

Object.defineProperty(GoogleGenAI.prototype, 'models', {
  get() {
    return {
      generateContent: async (args: any) => {
        googleCallCount++;
        lastGoogleCall = args;
        return {
          text: googleMockResponse,
        };
      }
    };
  },
  set(val) {
    // Ignore assignment inside GoogleGenAI constructor
  },
  configurable: true,
});

const MOCK_PORT = 4572;
const testProviderId = 'custom_routing_provider_44';

let customCallCount = 0;
let lastCustomRequestBody: any = null;
let lastCustomRequestHeaders: any = null;

let mockServerBehavior = {
  status: 200,
  responsePayload: {
    choices: [{ message: { content: "{\"custom_key\": \"custom_value\"}" } }],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
  },
  errorText: "Upstream Error"
};

const mockServer = http.createServer((req, res) => {
  if (req.url?.endsWith('/chat/completions') && req.method === 'POST') {
    customCallCount++;
    let body = '';
    lastCustomRequestHeaders = req.headers;
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        lastCustomRequestBody = JSON.parse(body);
      } catch (err) {
        lastCustomRequestBody = body;
      }
      res.writeHead(mockServerBehavior.status, { 'Content-Type': 'application/json' });
      if (mockServerBehavior.status === 200) {
        res.end(JSON.stringify(mockServerBehavior.responsePayload));
      } else {
        res.end(JSON.stringify({ error: { message: mockServerBehavior.errorText } }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPhase44Tests() {
  console.log('================================================================');
  console.log('    SINEMA PHASE 4.4 — CHOKE-POINT MIGRATION REGRESSION TESTS   ');
  console.log('================================================================');

  const { executeLLMRequest } = await import('./llm_provider');
  const { aiGateway } = await import('./ai_infrastructure/ai_gateway');
  const { quotaRouter } = await import('./ai_infrastructure/quota_router');
  const { credentialService } = await import('./ai_infrastructure/credential_service');
  const { providerService } = await import('./ai_infrastructure/provider_service');
  const { healthService } = await import('./ai_infrastructure/health_service');
  const { capabilityRegistry, AICapabilityError, modelsRegistry } = await import('./ai_infrastructure/capability_registry');

  await new Promise<void>((resolve) => {
    mockServer.listen(MOCK_PORT, '0.0.0.0', () => {
      console.log(`[Mock Server] Listening on http://localhost:${MOCK_PORT}/v1`);
      resolve();
    });
  });

  if (!process.env.AI_SECRET_MASTER_KEY) {
    process.env.AI_SECRET_MASTER_KEY = 'test-phase4.4-master-key-123';
  }

  // Ensure default providers (google) exist
  await providerService.initializeDefaults();

  // Set up Custom Provider
  let customProvider = await providerService.getProvider(testProviderId);
  if (!customProvider) {
    customProvider = await providerService.addProvider({
      id: testProviderId,
      name: 'Custom Routing Provider 44',
      type: 'openai-compatible',
      baseUrl: `http://localhost:${MOCK_PORT}/v1`,
      enabled: true,
    } as any);
  } else {
    await providerService.updateProvider(testProviderId, { enabled: true } as any);
  }

  // Add credentials for Custom Provider
  let customCred: any = null;
  const allCreds = await credentialService.listCredentials();
  const customCreds = allCreds.filter(c => c.providerId === testProviderId);
  if (customCreds.length === 0) {
    customCred = await credentialService.addCredential({
      providerId: testProviderId,
      name: 'Custom Key P1 Phase 4.4',
      status: 'active',
      secret: 'sk-custom-test-key-44',
      priority: 1,
    } as any);
  } else {
    customCred = customCreds[0];
    await credentialService.updateCredential(customCred.id, { status: 'active', priority: 1 });
  }

  // Ensure Google provider credentials exist
  const googleCreds = allCreds.filter(c => c.providerId === 'google');
  if (googleCreds.length === 0) {
    await credentialService.addCredential({
      providerId: 'google',
      name: 'Google Key Phase 4.4',
      status: 'active',
      secret: 'AIzaSy-Google-Test-Key-44',
      priority: 50,
    } as any);
  }

  // Register capabilities
  for (const mId of ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.1-pro-preview', 'ops-5']) {
    if (modelsRegistry[mId]) {
      modelsRegistry[mId].providers[testProviderId] = { supported: true, nativeModelName: mId };
    }
  }

  // Enable Google Provider
  let googleProvider = await providerService.getProvider('google');
  if (!googleProvider) {
    await providerService.addProvider({
      id: 'google',
      name: 'Google Gemini',
      type: 'gemini',
      enabled: true,
    } as any);
  } else {
    await providerService.updateProvider('google', { enabled: true } as any);
  }

  let passedTests = 0;
  const totalTests = 6;

  // --------------------------------------------------------------------------
  // TEST 1: Structured Output Forwarding (responseSchema) via executeLLMRequest()
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 1: Structured Output Forwarding via executeLLMRequest() ---');
  try {
    lastGoogleCall = null;
    googleMockResponse = JSON.stringify({ era: '1920s', theme: 'Jazz Age' });

    const schema1 = {
      type: 'OBJECT',
      properties: {
        era: { type: 'STRING' },
        theme: { type: 'STRING' },
      },
      required: ['era', 'theme'],
    };

    const res1 = await executeLLMRequest({
      stage: 'S1',
      prompt: 'Analyze story era and theme',
      systemInstruction: 'You are a story analyst',
      responseSchema: schema1,
      reasoningConfig: { provider_type: 'google', provider_name: 'google', model_id: 'gemini-3.7-flash' },
    });

    if (!lastGoogleCall) {
      throw new Error('TEST 1 FAILED: Google SDK generateContent was not called');
    }

    const config = lastGoogleCall.config;
    if (!config || config.responseMimeType !== 'application/json') {
      throw new Error(`TEST 1 FAILED: responseMimeType is not application/json. Got: ${config?.responseMimeType}`);
    }
    if (JSON.stringify(config.responseSchema) !== JSON.stringify(schema1)) {
      throw new Error(`TEST 1 FAILED: responseSchema mismatch in Google driver config`);
    }

    const parsed1 = JSON.parse(res1.text);
    if (parsed1.era !== '1920s' || parsed1.theme !== 'Jazz Age') {
      throw new Error(`TEST 1 FAILED: Returned payload corrupted. Got: ${res1.text}`);
    }

    console.log('✅ TEST 1 PASSED: responseSchema correctly forwarded through executeLLMRequest() -> AI Gateway -> Google Driver.');
    passedTests++;
  } catch (err: any) {
    console.error('❌ TEST 1 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Legacy Default Temperature (0.3) Preservation when Omitted
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Default Temperature (0.3) Preservation when Omitted ---');
  try {
    lastGoogleCall = null;
    const res2 = await executeLLMRequest({
      stage: 'S2',
      prompt: 'Detect characters in script',
      reasoningConfig: { provider_type: 'google', provider_name: 'google', model_id: 'gemini-3.7-flash' },
      // temperature intentionally omitted
    });

    if (!lastGoogleCall) {
      throw new Error('TEST 2 FAILED: Google SDK generateContent was not called');
    }

    if (lastGoogleCall.config?.temperature !== 0.3) {
      throw new Error(`TEST 2 FAILED: Temperature was not preserved as 0.3. Got: ${lastGoogleCall.config?.temperature}`);
    }

    console.log('✅ TEST 2 PASSED: Omitted temperature correctly defaulted to legacy 0.3 (Gateway 0.7 overridden).');
    passedTests++;
  } catch (err: any) {
    console.error('❌ TEST 2 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Custom P1 -> Google P2 Fallback Routing via Gateway
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Custom P1 -> Google P2 Fallback Routing via Gateway ---');
  try {
    mockServerBehavior.status = 200;
    mockServerBehavior.responsePayload = {
      choices: [{ message: { content: '{"status": "ok", "provider": "custom_p1"}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
    };

    customCallCount = 0;
    lastGoogleCall = null;

    // Call 1: Custom P1 active and healthy
    const res3a = await executeLLMRequest({
      stage: 'S3',
      prompt: 'Detect objects in location',
      reasoningConfig: { provider_type: testProviderId as any, provider_name: 'Custom', model_id: 'ops-5' },
    });

    if (customCallCount === 0) {
      throw new Error('TEST 3 FAILED: Custom Provider P1 was not called first when primary');
    }
    const parsed3a = JSON.parse(res3a.text);
    if (parsed3a.provider !== 'custom_p1') {
      throw new Error(`TEST 3 FAILED: Expected Custom P1 response, got: ${res3a.text}`);
    }

    // Call 2: Custom P1 fails (500), should failover to Google P2
    mockServerBehavior.status = 500;
    mockServerBehavior.errorText = 'Custom Provider Internal Server Error';
    googleMockResponse = JSON.stringify({ status: 'ok', provider: 'google_p2' });

    const res3b = await executeLLMRequest({
      stage: 'S3',
      prompt: 'Detect objects in location retry',
      reasoningConfig: { provider_type: testProviderId as any, provider_name: 'Custom', model_id: 'ops-5' },
    });

    const parsed3b = JSON.parse(res3b.text);
    if (parsed3b.provider !== 'google_p2') {
      throw new Error(`TEST 3 FAILED: Expected failover to Google P2, got: ${res3b.text}`);
    }

    console.log('✅ TEST 3 PASSED: Custom P1 -> Google P2 fallback routing executed deterministically through Gateway.');
    passedTests++;
  } catch (err: any) {
    console.error('❌ TEST 3 FAILED:', err.message);
  } finally {
    await quotaRouter.resetProviderState(testProviderId);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Credential Failover & 429 Cooldown via Gateway
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Credential Failover & 429 Cooldown via Gateway ---');
  try {
    mockServerBehavior.status = 429;
    mockServerBehavior.errorText = 'Rate limit exceeded (429)';
    googleMockResponse = JSON.stringify({ status: 'ok', source: 'google_failover_429' });

    const res4 = await executeLLMRequest({
      stage: 'S4',
      prompt: 'Narrative structure generation',
      reasoningConfig: { provider_type: testProviderId as any, provider_name: 'Custom', model_id: 'ops-5' },
    });

    const parsed4 = JSON.parse(res4.text);
    if (parsed4.source !== 'google_failover_429') {
      throw new Error(`TEST 4 FAILED: Did not receive Google failover response on 429. Got: ${res4.text}`);
    }

    // Verify cooldown state
    const health = await healthService.getHealth(customCred.id);
    if (!health || (!health.cooldownUntil && health.status !== 'degraded')) {
      throw new Error(`TEST 4 FAILED: Custom Provider credential state is not in cooldown. Got status: ${health?.status}`);
    }

    console.log('✅ TEST 4 PASSED: 429 Rate limit triggered cooldown and smooth provider failover.');
    passedTests++;
  } catch (err: any) {
    console.error('❌ TEST 4 FAILED:', err.message);
  } finally {
    if (customCred) {
      await healthService.resetHealth(customCred.id);
      await credentialService.updateCredential(customCred.id, { status: 'active' });
    }
  }

  // --------------------------------------------------------------------------
  // TEST 5: Capability Mismatch Isolation
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Capability Mismatch Isolation ---');
  try {
    let thrownError: any = null;
    try {
      await executeLLMRequest({
        stage: 'S5',
        prompt: 'Scene breakdown',
        model: 'unsupported-capability-model-99',
      });
    } catch (err) {
      thrownError = err;
    }

    if (!thrownError) {
      throw new Error('TEST 5 FAILED: Expected error for unsupported model, but call succeeded');
    }

    if (!(thrownError instanceof AICapabilityError) && !thrownError.message.includes('No capable AI provider') && !thrownError.message.includes('unsupported capability')) {
      throw new Error(`TEST 5 FAILED: Expected capability error, got: ${thrownError.message}`);
    }

    // Verify that health/circuit state of active providers was NOT polluted by capability mismatch
    const googleHealth = await healthService.getHealth('google');
    if (googleHealth && googleHealth.status === 'down') {
      throw new Error('TEST 5 FAILED: Capability error corrupted Google provider health state');
    }

    console.log('✅ TEST 5 PASSED: Capability mismatch correctly isolated without corrupting provider health or quota.');
    passedTests++;
  } catch (err: any) {
    console.error('❌ TEST 5 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: S2, S3, S5, S6 Stage Compatibility
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: S2, S3, S5, S6 Stage Compatibility ---');
  try {
    googleMockResponse = JSON.stringify({ status: 'ok', stage_completed: true });

    // Test S2
    const resS2 = await executeLLMRequest({
      stage: 'S2',
      prompt: 'Character detection prompt for Stage 2',
      reasoningConfig: { provider_type: 'google', provider_name: 'google', model_id: 'gemini-3.7-flash' },
      responseSchema: { type: 'OBJECT', properties: { characters: { type: 'ARRAY', items: { type: 'STRING' } } } },
    });
    const parsedS2 = JSON.parse(resS2.text);

    // Test S3
    const resS3 = await executeLLMRequest({
      stage: 'S3',
      prompt: 'Location and object detection for Stage 3',
      reasoningConfig: { provider_type: 'google', provider_name: 'google', model_id: 'gemini-3.7-flash' },
    });
    const parsedS3 = JSON.parse(resS3.text);

    // Test S5
    const resS5 = await executeLLMRequest({
      stage: 'S5',
      prompt: 'Scene breakdown prompt for Stage 5',
      reasoningConfig: { provider_type: 'google', provider_name: 'google', model_id: 'gemini-3.7-flash' },
    });
    const parsedS5 = JSON.parse(resS5.text);

    // Test S6
    const resS6 = await executeLLMRequest({
      stage: 'S6',
      prompt: 'Shot breakdown prompt for Stage 6',
      reasoningConfig: { provider_type: 'google', provider_name: 'google', model_id: 'gemini-3.7-flash' },
    });
    const parsedS6 = JSON.parse(resS6.text);

    if (!parsedS2.stage_completed || !parsedS3.stage_completed || !parsedS5.stage_completed || !parsedS6.stage_completed) {
      throw new Error('TEST 6 FAILED: One or more stages returned invalid or incomplete response');
    }

    console.log('✅ TEST 6 PASSED: S2, S3, S5, and S6 successfully executed through AI Gateway delegation.');
    passedTests++;
  } catch (err: any) {
    console.error('❌ TEST 6 FAILED:', err.message);
  }

  console.log('\n================================================================');
  console.log(`    PHASE 4.4 REGRESSION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED    `);
  console.log('================================================================');

  mockServer.close();

  if (passedTests !== totalTests) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase44Tests().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  mockServer.close();
  process.exit(1);
});
