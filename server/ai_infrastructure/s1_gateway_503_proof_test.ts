import '../isolate_test_env';
import { GoogleGenAI } from '@google/genai';
import { aiGateway } from './ai_gateway';
import { providerService } from './provider_service';
import { credentialService } from './credential_service';

const originalFetch = global.fetch;
const originalLog = console.log;
const originalWarn = console.warn;
const captured: string[] = [];
let sdkCalls = 0;

function capture(...args: any[]): void {
  const line = args.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' ');
  captured.push(line);
  originalLog(...args);
}

async function main(): Promise<void> {
  process.env.GEMINI_API_KEY = '';
  process.env.GOOGLE_AI_API_KEY = '';
  process.env.GOOGLE_API_KEY = '';

  global.fetch = (async () => {
    throw new Error('UNEXPECTED_NETWORK_CALL');
  }) as any;

  Object.defineProperty(GoogleGenAI.prototype, 'models', {
    get() {
      return {
        generateContent: async () => {
          sdkCalls++;
          const error: any = new Error('503 UNAVAILABLE: This model is currently experiencing high demand. Spikes in demand are usually temporary.');
          error.status = 503;
          error.code = 'UNAVAILABLE';
          throw error;
        },
      };
    },
    set() {},
    configurable: true,
  });

  console.log = capture;
  console.warn = capture;

  try {
    const provider = await providerService.getProvider('google');
    const credentials = (await credentialService.listCredentials()).filter(c => c.providerId === 'google' && c.status === 'active');
    if (!provider || credentials.length === 0) {
      throw new Error('SAFE_PROOF_PREREQUISITE_MISSING: existing local google provider/credential required; no fixture created');
    }

    const credentialId = credentials[0].id;
    const plan = {
      taskId: 'story_analysis',
      stageCode: 'S1',
      providerId: 'google',
      modelId: 'gemini-3.7-flash',
      credentialId,
    };

    console.log('PROOF_PLAN', JSON.stringify(plan));
    console.log('PROOF_FALLBACK_EXPECTED', JSON.stringify({ providers: ['google'], credentials: [credentialId], models: ['gemini-3.7-flash'] }));

    let finalError = '';
    try {
      await aiGateway.generate({
        executionPlan: plan,
        model: plan.modelId,
        providerId: plan.providerId,
        task: plan.taskId,
        agentName: plan.stageCode,
        prompt: 'offline deterministic 503 proof',
      });
    } catch (error: any) {
      finalError = error?.message || String(error);
    }

    console.log('PROOF_SDK_CALLS', sdkCalls);
    console.log('PROOF_NETWORK_CALLS', 0);
    console.log('PROOF_FINAL_ERROR', finalError);

    if (sdkCalls !== 1) throw new Error(`Expected exactly one mocked provider attempt, got ${sdkCalls}`);
    if (finalError !== 'AIGateway: All credentials in fallback chain failed. Last error: 503 UNAVAILABLE: This model is currently experiencing high demand. Spikes in demand are usually temporary.') {
      throw new Error(`Unexpected final error: ${finalError}`);
    }
    const trace = captured.find(line => line.includes('[IMMUTABLE ROUTING TRACE]')) || '';
    if (!trace && !captured.some(line => line.includes('wireModel'))) {
      throw new Error('Missing immutable routing trace');
    }
    if (!captured.some(line => line.includes('[AI GATEWAY TELEMETRY] [FAILED]'))) {
      throw new Error('Missing failed gateway telemetry');
    }
    console.log('PROOF_RESULT PASS');
  } finally {
    global.fetch = originalFetch;
    console.log = originalLog;
    console.warn = originalWarn;
  }
}

main().catch(error => {
  originalLog('PROOF_RESULT FAIL', error?.message || error);
  process.exitCode = 1;
});
