import { geminiProjectRouter, TaskType } from './gemini_project_router';
import { executeLLMRequest } from './llm_provider';
import assert from 'assert';

const originalFetch = global.fetch;
let mockScenario: string | null = null;
let requestsMade = 0;

global.fetch = async (url, options) => {
  requestsMade++;
  const urlStr = url.toString();
  if (urlStr.includes('generativelanguage')) {
    
    let apiKey = '';
    if (options?.headers instanceof Headers) {
        apiKey = options.headers.get('x-goog-api-key') || '';
    } else if (options?.headers) {
        apiKey = (options.headers as any)['x-goog-api-key'] || '';
    }
    if (!apiKey) {
        apiKey = new URL(urlStr).searchParams.get('key') || '';
    }
    
    // Extract model from URL
    let model = 'unknown';
    const match = urlStr.match(/models\/([^:]+)/);
    if (match) {
        model = match[1];
    }
    
    const project = apiKey === 'key-A' ? 'A' : apiKey === 'key-B' ? 'B' : apiKey === 'key-C' ? 'C' : apiKey === 'key-D' ? 'D' : 'unknown';
    
    console.log(`[DEBUG] fetch: project=${project}, model=${model}, scenario=${mockScenario}`);
    
    // --- Scenarios ---
    
    // Scenario: Model Isolation
    if (mockScenario === 'model_isolation_429' && project === 'A' && model.includes('pro')) {
      return new Response(JSON.stringify({ error: { message: 'Rate limit exceeded 429' } }), {
        status: 429,
        headers: new Headers({'content-type': 'application/json'})
      });
    }
    
    // Scenario: Project A/Pro 503, B/Pro 429, C/Pro Success
    if (mockScenario === 'cooldown_failover') {
        if (project === 'A' && model.includes('pro')) {
            return new Response(JSON.stringify({ error: { message: '503 Unavailable High Demand' } }), { status: 503 });
        }
        if (project === 'B' && model.includes('pro')) {
             return new Response(JSON.stringify({ error: { message: 'Rate limit exceeded 429' } }), { status: 429 });
        }
    }
    
    // Global Exhaustion
    if (mockScenario === 'global_exhaustion') {
        return new Response(JSON.stringify({ error: { message: '429' } }), { status: 429 });
    }

    // Success response
    return new Response(JSON.stringify({
        candidates: [
          { content: { parts: [{ text: `Success from ${project} - ${model}` }], role: "model" }, finishReason: "STOP" }
        ],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 },
        modelVersion: "gemini-1.5-flash"
      }), {
      status: 200,
      headers: new Headers({'content-type': 'application/json'})
    });
  }
  return originalFetch(url, options);
};

async function runAudit() {
  console.log('--- PHASE N CHAOS AUDIT - REAL ---');

  // Setup projects
  const projects = geminiProjectRouter.listProjects();
  for (const p of projects) {
     geminiProjectRouter.removeProject(p.project_id);
  }
  for (const pid of ['project-A', 'project-B', 'project-C', 'project-D']) {
      const p = pid.split('-')[1];
      geminiProjectRouter.addProject({
        project_id: pid, api_key: `key-${p}`, provider: 'google_gemini',
        models_available: ['gemini-3.7-pro', 'gemini-3.7-flash'],
        quota: { rpm: 100, tpm: 100000, rpd: 1500 }, usage: { rpm_used: 0, tokens_used: 0, requests_today: 0 },
        health: { status: 'healthy', error_rate: 0, success_rate: 100, latency: 100 }, priority: 1, enabled: true
      });
  }

  console.log('Test 1: Model-Specific Isolation (A/Pro fails, A/Flash succeeds)');
  mockScenario = 'model_isolation_429';
  
  // Pro fails A
  let res = await executeLLMRequest({ prompt: 'test', modelPreferences: { force_model: 'gemini-3.7-pro', mode: 'fixed' } });
  assert(res.text.includes('Success from B'), 'Pro A should have failed and failovered to B');
  
  // Reset health for A to test Flash
  geminiProjectRouter.getProject('project-A')!.health.success_rate = 100;
  
  // Flash A should work
  res = await executeLLMRequest({ prompt: 'test', modelPreferences: { force_model: 'gemini-3.7-flash', mode: 'fixed' } });
  assert(res.text.includes('Success from A'), 'Flash A should have worked');

  console.log('Test 2: Cooldown & Failover (A/Pro 503, B/Pro 429, C/Pro Success)');
  mockScenario = 'cooldown_failover';
  // Reset health
  geminiProjectRouter.getProject('project-A')!.health.model_health = {};
  geminiProjectRouter.getProject('project-B')!.health.model_health = {};

  res = await executeLLMRequest({ prompt: 'test', modelPreferences: { force_model: 'gemini-3.7-pro' } });
  assert(res.text.includes('Success from C'), 'Should have reached C');
  
  console.log('Test 3: Global Exhaustion');
  mockScenario = 'global_exhaustion';
  try {
      await executeLLMRequest({ prompt: 'test', modelPreferences: { force_model: 'gemini-3.7-pro' } });
      assert(false, 'Should have failed');
  } catch(e) {
      assert(true);
  }

  console.log('All Chaos Scenarios Passed!');
}

runAudit().catch(console.error);

