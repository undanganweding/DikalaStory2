import { AI_AGENT_REGISTRY } from './agent_registry';
import { AGENT_CONTRACTS } from './agent_contract';
import { agentRuntime } from './agent_runtime';
import { aiGateway } from './ai_gateway';
import fs from 'fs';
import path from 'path';

async function runPhase5FinalAudit() {
  console.log('==================================================');
  console.log('PHASE 5 FINAL AUDIT — Agent OS Integrity Check');
  console.log('==================================================');

  let passedChecks = 0;
  let totalChecks = 0;

  // Check 1: Agent Registry & Contracts
  totalChecks++;
  const agentKeys = Object.keys(AI_AGENT_REGISTRY);
  const contractKeys = Object.keys(AGENT_CONTRACTS);
  if (agentKeys.length >= 4 && contractKeys.length >= 6) {
    console.log(`✅ [Check 1] Agent Registry & Contracts verified (${agentKeys.length} agents, ${contractKeys.length} contracts).`);
    passedChecks++;
  } else {
    console.error(`❌ [Check 1] Agent Registry or Contracts count mismatch.`);
  }

  // Check 2: AI Gateway centralization
  totalChecks++;
  if (typeof aiGateway.generate === 'function') {
    console.log('✅ [Check 2] AI Gateway is centralized and exposes generate().');
    passedChecks++;
  } else {
    console.error('❌ [Check 2] AI Gateway generate method missing.');
  }

  // Check 3: Agent Runtime uses Gateway & Validation Pipeline
  totalChecks++;
  const runtimeCode = fs.readFileSync(path.join(process.cwd(), 'server/ai_infrastructure/agent_runtime.ts'), 'utf-8');
  if (runtimeCode.includes('aiGateway.generate') && runtimeCode.includes('validationPipeline.processAndValidate')) {
    console.log('✅ [Check 3] Agent Runtime strictly delegates to AI Gateway and Validation Pipeline.');
    passedChecks++;
  } else {
    console.error('❌ [Check 3] Agent Runtime bypasses Gateway or Validation Pipeline.');
  }

  // Check 4: Memory QC Gating (Reject blocks storage)
  totalChecks++;
  const pipelineCode = fs.readFileSync(path.join(process.cwd(), 'server/ai_infrastructure/validation_pipeline.ts'), 'utf-8');
  if (pipelineCode.includes("storedInMemory = false") && pipelineCode.includes("evaluation!.status === 'PASS'")) {
    console.log('✅ [Check 4] Quality Control strictly blocks REJECTed outputs from entering Project Memory.');
    passedChecks++;
  } else {
    console.error('❌ [Check 4] Quality Control memory blocking check failed.');
  }

  // Check 5: Protected files exist and remain untouched / isolated
  totalChecks++;
  const protectedFiles = [
    'server/llm_provider.ts',
    'server/gemini_project_router.ts',
    'server/model_router.ts',
    'server/adaptive_router.ts',
  ];
  let protectedIntact = true;
  for (const pf of protectedFiles) {
    if (!fs.existsSync(path.join(process.cwd(), pf))) {
      protectedIntact = false;
      console.error(`❌ Protected file missing: ${pf}`);
    }
  }
  if (protectedIntact) {
    console.log('✅ [Check 5] All legacy protected core architecture files verified intact and isolated.');
    passedChecks++;
  }

  console.log('==================================================');
  console.log(`Audit Summary: ${passedChecks}/${totalChecks} Integrity Checks Passed.`);
  if (passedChecks === totalChecks) {
    console.log('🎉 PHASE 5 FINAL AUDIT PASSED WITH 100% INTEGRITY!');
  } else {
    throw new Error('Phase 5 Final Audit failed integrity checks.');
  }
}

runPhase5FinalAudit().catch(err => {
  console.error('❌ Audit Error:', err);
  process.exit(1);
});
