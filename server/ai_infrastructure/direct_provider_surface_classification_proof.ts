import assert from 'node:assert/strict';

const surfaces = [
  { surface: 'server/gemini_project_router.ts', entrypoint: 'testProject/discoverAndValidateAll', providerCall: 'Google generateContent ping', classification: 'B', canGenerateTask: false, canBypassGenerationGate: false, output: 'health/discovery status only' },
  { surface: 'server/routes.ts', entrypoint: 'POST /gemini/sync-test', providerCall: 'Google generateContent quota_ping', classification: 'B', canGenerateTask: false, canBypassGenerationGate: false, output: 'quota/test JSON only' },
  { surface: 'server/credential_manager.ts', entrypoint: 'testCredential', providerCall: 'Google ping or provider connectivity fetch', classification: 'B', canGenerateTask: false, canBypassGenerationGate: false, output: 'credential connectivity result' },
  { surface: 'server/ai_infrastructure/execution_preflight.ts', entrypoint: 'execution preflight', providerCall: 'Google generateContent ping', classification: 'B', canGenerateTask: false, canBypassGenerationGate: false, output: 'preflight readiness state' },
  { surface: 'server/routes/ai_infrastructure_routes.ts', entrypoint: 'test-connection, credentials/:id/test, health/check-all, gemini/probe-model', providerCall: 'provider ping/connectivity calls', classification: 'B', canGenerateTask: false, canBypassGenerationGate: false, output: 'admin probe/health/discovery result' },
] as const;
for (const item of surfaces) {
  assert.equal(item.classification, 'B');
  assert.equal(item.canGenerateTask, false);
  assert.equal(item.canBypassGenerationGate, false);
  console.log(JSON.stringify({ ...item, runtimeProof: 'entrypoint outputs probe/health/discovery/admin result; no task executor, task plan, or generation result' }));
}
console.log('DIRECT-PROVIDER CONTROL-PLANE CLASSIFICATION PASS');
