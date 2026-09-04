import './isolate_test_env';
import http from 'http';
import { GoogleGenAI } from '@google/genai';

// Spy object for capturing Google GenAI SDK parameters
let lastGoogleCall: any = null;

Object.defineProperty(GoogleGenAI.prototype, 'models', {
  get() {
    return {
      generateContent: async (args: any) => {
        lastGoogleCall = args;
        return {
          text: `{"mock_key": "mock_value"}`,
        };
      }
    };
  },
  set(val) {
    // Ignore assignment inside GoogleGenAI constructor
  },
  configurable: true,
});

const MOCK_PORT = 4571;
const testProviderId = 'custom_routing_provider_431a';

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

async function runTests() {
  console.log('================================================================');
  console.log('    SINEMA PHASE 4.3.1A — GATEWAY CONTRACT COMPLETION TESTS    ');
  console.log('================================================================');

  const { aiGateway } = await import('./ai_infrastructure/ai_gateway');
  const { quotaRouter } = await import('./ai_infrastructure/quota_router');
  const { credentialService } = await import('./ai_infrastructure/credential_service');
  const { providerService } = await import('./ai_infrastructure/provider_service');
  const { healthService } = await import('./ai_infrastructure/health_service');
  const { usageService } = await import('./ai_infrastructure/usage_service');
  const { capabilityRegistry, AICapabilityError, modelsRegistry } = await import('./ai_infrastructure/capability_registry');

  await new Promise<void>((resolve) => {
    mockServer.listen(MOCK_PORT, '0.0.0.0', () => {
      console.log(`[Mock Server] Listening on http://localhost:${MOCK_PORT}/v1`);
      resolve();
    });
  });

  if (!process.env.AI_SECRET_MASTER_KEY) {
    process.env.AI_SECRET_MASTER_KEY = 'test-phase4.3.1a-master-key-123';
  }

  // Set up provider & credentials
  let customProvider = await providerService.getProvider(testProviderId);
  if (!customProvider) {
    customProvider = await providerService.addProvider({
      id: testProviderId,
      name: 'Custom Routing Provider 431a',
      type: 'openai-compatible',
      baseUrl: `http://localhost:${MOCK_PORT}/v1`,
      enabled: true,
      capabilities: { text: true, vision: false, image: false, video: false },
    });
  } else {
    await providerService.updateProvider(testProviderId, {
      enabled: true,
      baseUrl: `http://localhost:${MOCK_PORT}/v1`,
      capabilities: { text: true, vision: false, image: false, video: false },
    });
  }

  // Add Google provider if missing
  let googleProvider = await providerService.getProvider('google');
  if (!googleProvider) {
    googleProvider = await providerService.addProvider({
      id: 'google',
      name: 'Google Gemini',
      type: 'gemini',
      enabled: true,
      capabilities: { text: true, vision: true, image: true, video: true },
    });
  } else {
    await providerService.updateProvider('google', {
      enabled: true,
      capabilities: { text: true, vision: true, image: true, video: true },
    });
  }

  // Ensure credentials exist and are healthy
  const ck1 = await credentialService.addCredential({
    providerId: testProviderId,
    name: 'Custom API Key 431a',
    encryptedSecret: 'super-secret-key-1',
    status: 'active',
    priority: 1,
    weight: 1,
  });
  const ck1Id = ck1.id;

  const gk1 = await credentialService.addCredential({
    providerId: 'google',
    name: 'Google API Key 431a',
    encryptedSecret: 'super-secret-key-2',
    status: 'active',
    priority: 1,
    weight: 1,
  });
  const gk1Id = gk1.id;

  // Reset metrics
  await healthService.recordSuccess(ck1Id);
  await healthService.recordSuccess(gk1Id);

  // -------------------------------------------------------------------------
  // TEST 1: Google Native Structured Output Integration
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 1: Google Native Structured Output Contract ---');
  lastGoogleCall = null;
  const mockSchema = {
    type: 'object',
    properties: {
      title: { type: 'string' }
    }
  };

  const res1 = await aiGateway.generate({
    model: 'gemini-3.7-flash',
    prompt: 'Create a story title',
    responseSchema: mockSchema,
    providerId: 'google'
  });

  console.log(`Google response generated: ${res1.text}`);
  console.log(`Last Google generateContent call has config:`, lastGoogleCall?.config);

  if (!lastGoogleCall) {
    throw new Error('TEST 1 FAILED: Google SDK generateContent was not called');
  }
  if (lastGoogleCall.config.responseMimeType !== 'application/json') {
    throw new Error(`TEST 1 FAILED: responseMimeType is not 'application/json' (got: ${lastGoogleCall.config.responseMimeType})`);
  }
  if (JSON.stringify(lastGoogleCall.config.responseSchema) !== JSON.stringify(mockSchema)) {
    throw new Error(`TEST 1 FAILED: responseSchema was not preserved`);
  }
  console.log('✅ TEST 1 PASSED.');

  // -------------------------------------------------------------------------
  // TEST 2: Custom Provider JSON Mode & Prompt Reinforcement
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Custom Provider JSON Mode & Prompt Reinforcement ---');
  lastCustomRequestBody = null;
  mockServerBehavior.status = 200;

  const res2 = await aiGateway.generate({
    model: 'ops-5',
    prompt: 'Return json payload',
    responseSchema: mockSchema,
    providerId: testProviderId
  });

  console.log(`Custom response: ${res2.text}`);
  console.log(`Last Custom payload JSON format:`, lastCustomRequestBody?.response_format);
  console.log(`Last Custom payload message 0:`, lastCustomRequestBody?.messages?.[0]);

  if (!lastCustomRequestBody) {
    throw new Error('TEST 2 FAILED: Custom HTTP mock server did not receive request');
  }
  if (lastCustomRequestBody.response_format?.type !== 'json_object') {
    throw new Error('TEST 2 FAILED: Custom payload response_format.type is not json_object');
  }
  const promptContent = lastCustomRequestBody.messages?.[0]?.content || '';
  if (!promptContent.includes('CRITICAL MANDATE: Output ONLY valid JSON')) {
    throw new Error('TEST 2 FAILED: Prompt does not carry the legacy instruction reinforcement');
  }
  console.log('✅ TEST 2 PASSED.');

  // -------------------------------------------------------------------------
  // TEST 3: Provider Priority (Custom P1 -> Google P2 Fallback)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Deterministic Custom P1 Preference ---');
  lastGoogleCall = null;
  lastCustomRequestBody = null;

  // We request model 'ops-5' which is supported by BOTH Custom (P1) and Google (P2)
  const res3 = await aiGateway.generate({
    model: 'ops-5',
    prompt: 'Priority test',
  });

  console.log(`Route resolved to provider: ${res3.providerId}`);
  if (res3.providerId !== testProviderId) {
    throw new Error(`TEST 3 FAILED: Preferred provider should be Custom '${testProviderId}', got '${res3.providerId}'`);
  }
  if (lastGoogleCall !== null) {
    throw new Error('TEST 3 FAILED: Google fallback was triggered even though Custom was eligible and capable!');
  }
  console.log('✅ TEST 3 PASSED.');

  // -------------------------------------------------------------------------
  // TEST 4: Capability Mismatch on Unknown Model (Does NOT corrupt health/cooldown)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Capability Mismatch State Isolation ---');
  const usageBefore = await usageService.listUsage(100);
  const customUsageCountBefore = usageBefore.filter(u => u.credentialId === ck1Id).length;

  let errorCaught = false;
  try {
    await aiGateway.generate({
      model: 'completely-unknown-nonexistent-model',
      prompt: 'Crash me please',
    });
  } catch (err: any) {
    errorCaught = true;
    console.log(`Expected error caught: "${err.message}"`);
    if (!(err instanceof AICapabilityError)) {
      throw new Error(`TEST 4 FAILED: Expected AICapabilityError but got ${typeof err}`);
    }
  }

  if (!errorCaught) {
    throw new Error('TEST 4 FAILED: Gateway allowed generate with completely unknown model');
  }

  // Verify health and quota are completely untouched
  const usageAfter = await usageService.listUsage(100);
  const customUsageCountAfter = usageAfter.filter(u => u.credentialId === ck1Id).length;
  const healthCustom = await healthService.getHealth(ck1Id);

  console.log(`Custom Key consecutiveFailures: ${healthCustom.consecutiveFailures} (Expected: 0)`);
  console.log(`Custom Key usages count unchanged: ${customUsageCountBefore === customUsageCountAfter} (Expected: true)`);

  if (healthCustom.consecutiveFailures !== 0 || customUsageCountBefore !== customUsageCountAfter) {
    throw new Error('TEST 4 FAILED: Health state or Quota was mutated/corrupted during a non-transient capability mismatch.');
  }
  console.log('✅ TEST 4 PASSED.');

  // -------------------------------------------------------------------------
  // TEST 5: Audited Production Model Routing
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Required Production Model Routing & Resolution ---');
  const requiredModels = [
    'gemini-3.1-pro-preview',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite'
  ];

  for (const modelId of requiredModels) {
    lastGoogleCall = null;
    const res = await aiGateway.generate({
      model: modelId,
      prompt: `Resolution test for ${modelId}`
    });
    console.log(`Model '${modelId}' resolved successfully to provider '${res.providerId}' (Native name: ${res.model})`);
    if (res.providerId !== 'google') {
      throw new Error(`TEST 5 FAILED: Model '${modelId}' should only route to 'google'`);
    }
    if (lastGoogleCall?.model !== modelId) {
      throw new Error(`TEST 5 FAILED: Model requested from SDK was not canonical ID (got: ${lastGoogleCall?.model})`);
    }
  }
  console.log('✅ TEST 5 PASSED.');

  // -------------------------------------------------------------------------
  // TEST 6: Runtime Failure HTTP 429 Cooldown
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: Cooldown Isolation on Custom Driver 429 ---');
  mockServerBehavior.status = 429;
  mockServerBehavior.errorText = "Too many requests";

  try {
    await aiGateway.generate({
      model: 'ops-5',
      prompt: 'trigger 429',
      providerId: testProviderId
    });
  } catch (err: any) {
    console.log(`Expected runtime error captured: "${err.message}"`);
  }

  const credentialObj = await credentialService.getCredential(ck1Id);
  const healthState = await healthService.getHealth(ck1Id);
  const isCooldownActive = Boolean(healthState.cooldownUntil && healthState.cooldownUntil > Date.now());

  console.log(`Custom Credential status after 429: ${credentialObj?.status} (Expected: rate_limited)`);
  console.log(`Custom Health consecutiveFailures: ${healthState.consecutiveFailures}`);
  console.log(`Custom Health status: ${healthState.status} (Expected: degraded)`);
  console.log(`Custom Health cooldownActive: ${isCooldownActive} (Expected: true)`);

  if (credentialObj?.status !== 'rate_limited' || healthState.status !== 'degraded' || !isCooldownActive) {
    throw new Error('TEST 6 FAILED: Cooldown state was not correctly isolated/registered for 429 error.');
  }
  console.log('✅ TEST 6 PASSED.');

  // Cleanup & Stop server
  await new Promise<void>((resolve) => {
    mockServer.close(() => {
      console.log('\n[Mock Server] Closed.');
      resolve();
    });
  });

  console.log('\n================================================================');
  console.log('    ALL CONTRACT COMPLETION TEST SCENARIOS PASSED (100%)       ');
  console.log('================================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n🛑 TEST RUNNER CRASHED:', err);
  mockServer.close();
  process.exit(1);
});
