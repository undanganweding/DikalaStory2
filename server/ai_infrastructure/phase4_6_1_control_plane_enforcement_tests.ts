import '../isolate_test_env';
import fs from 'fs';
import path from 'path';

/**
 * PHASE 4.6.1 — CONTROL PLANE ENFORCEMENT & BYPASS GUARD TEST SUITE
 * 
 * Verifies that:
 * 1. Provider SDK Import Guard: Detects unauthorized imports of provider SDKs (@google/genai, openai, anthropic, etc.) outside approved infrastructure boundaries.
 * 2. Direct Provider Execution Guard: Detects unauthorized direct execution patterns (new GoogleGenAI, generateContent, raw AI API fetch, direct driver calls).
 * 3. Production Authority Guard: Verifies production S1–S6, agentRuntime, and prompt regeneration route strictly through AI Gateway.
 * 4. Deterministic S7/S8 Guard: Verifies S7 and S8 remain 100% deterministic (0 LLM calls).
 * 5. Synthetic Reproduction: Verifies that unauthorized synthetic violations ARE REJECTED and legitimate controlled exceptions ARE NOT falsely rejected.
 */

export interface EnforcementViolation {
  file: string;
  rule: 'SDK_IMPORT_GUARD' | 'DIRECT_EXECUTION_GUARD' | 'AUTHORITY_GUARD' | 'DETERMINISTIC_STAGE_GUARD';
  message: string;
  line?: number;
  snippet?: string;
}

export interface InspectionContext {
  filePath: string;
  content: string;
}

// Approved Infrastructure Boundary Files (where provider SDKs/drivers may legitimately reside)
const APPROVED_INFRASTRUCTURE_FILES = new Set([
  'server/ai_infrastructure/ai_gateway.ts',
  'server/ai_infrastructure/provider_adapter_registry.ts',
  'server/ai_infrastructure/openai_compatible_driver.ts',
  'server/routes/ai_infrastructure_routes.ts', // Controlled Admin key testing & health simulation
  'server/gemini.ts',                           // Low-level helper getGeminiAI & Omni capability probe
  'server/llm_provider.ts',                     // Retained legacy bridge with executeLLMRequest -> Gateway
]);

// Helper to determine if a file is a test/mock/sandbox harness
export function isTestOrMockFile(filePath: string): boolean {
  const norm = filePath.replace(/\\/g, '/');
  const baseName = path.basename(norm);
  
  if (
    baseName.endsWith('_test.ts') ||
    baseName.endsWith('_tests.ts') ||
    baseName.startsWith('test_') ||
    baseName.includes('_proof.ts') ||
    baseName.includes('_audit.ts') ||
    baseName === 'isolate_test_env.ts' ||
    baseName === 'chaos_test.ts' ||
    baseName === 'router_stress_test.ts' ||
    baseName === 'credential_pool_tests.ts' ||
    baseName.startsWith('phase') ||
    norm.includes('/tests/') ||
    norm.includes('fixture')
  ) {
    return true;
  }
  return false;
}

// Helper to check if a file is in the server/stages/ directory
export function isStageFile(filePath: string): boolean {
  const norm = filePath.replace(/\\/g, '/');
  return norm.includes('server/stages/');
}

/**
 * CORE ENFORCEMENT SCANNER
 * Inspects a file's content and returns any violations based on Phase 4.6.1 rules.
 */
export function scanFileForEnforcementViolations(context: InspectionContext): EnforcementViolation[] {
  const violations: EnforcementViolation[] = [];
  const normPath = context.filePath.replace(/\\/g, '/');
  const baseName = path.basename(normPath);
  const lines = context.content.split('\n');

  const isTest = isTestOrMockFile(normPath);
  const isApprovedInfra = APPROVED_INFRASTRUCTURE_FILES.has(normPath);

  // If it's a test file or mock harness, skip production enforcement rules
  if (isTest) {
    return violations;
  }

  // --- RULE 1: Provider SDK Import Guard ---
  // Production code outside approved infrastructure files must NOT import AI provider SDKs directly.
  if (!isApprovedInfra) {
    const sdkImportRegex = /import\s+.*(?:from\s+['"](@google\/genai|openai|anthropic|@anthropic-ai\/sdk)['"]|require\(['"](@google\/genai|openai|anthropic|@anthropic-ai\/sdk)['"]\))/i;
    lines.forEach((line, idx) => {
      if (sdkImportRegex.test(line)) {
        violations.push({
          file: normPath,
          rule: 'SDK_IMPORT_GUARD',
          message: `Unauthorized AI Provider SDK import detected in production file: '${line.trim()}'`,
          line: idx + 1,
          snippet: line.trim(),
        });
      }
    });
  }

  // --- RULE 2: Direct Provider Execution Guard ---
  // Production code outside approved infrastructure files must NOT instantiate AI provider SDKs or call raw provider endpoints directly.
  if (!isApprovedInfra) {
    lines.forEach((line, idx) => {
      // 2a: Direct instantiation or generateContent
      if (/\bnew\s+GoogleGenAI\b/.test(line) || /\bnew\s+OpenAI\b/.test(line) || /\bnew\s+Anthropic\b/.test(line)) {
        violations.push({
          file: normPath,
          rule: 'DIRECT_EXECUTION_GUARD',
          message: `Direct AI Provider SDK instantiation detected: '${line.trim()}'`,
          line: idx + 1,
          snippet: line.trim(),
        });
      }

      // 2b: Raw AI Provider API fetch endpoints
      if (/\bfetch\s*\(/.test(line) && (line.includes('api.openai.com') || line.includes('generativelanguage.googleapis.com') || line.includes('api.anthropic.com') || line.includes('openrouter.ai'))) {
        violations.push({
          file: normPath,
          rule: 'DIRECT_EXECUTION_GUARD',
          message: `Direct raw AI provider HTTP API call detected: '${line.trim()}'`,
          line: idx + 1,
          snippet: line.trim(),
        });
      }

      // 2c: Direct driver calls bypassing Gateway (e.g. calling openaiCompatibleDriver directly from business logic)
      if (/\bopenaiCompatibleDriver\.(executeChatCompletion|generate)\b/.test(line) && !normPath.includes('ai_gateway.ts')) {
        violations.push({
          file: normPath,
          rule: 'DIRECT_EXECUTION_GUARD',
          message: `Direct Provider Driver execution bypassing AI Gateway detected: '${line.trim()}'`,
          line: idx + 1,
          snippet: line.trim(),
        });
      }
    });
  }

  // --- RULE 3: Production Authority Guard for LLM Stages (S1–S6, Agent Runtime) ---
  if (
    baseName === 'stage1_story_understanding.ts' ||
    baseName === 'stage2_character_detection.ts' ||
    baseName === 'stage3_location_object_detection.ts' ||
    baseName === 'stage4_narrative_structure.ts' ||
    baseName === 'stage5_scene_breakdown.ts' ||
    baseName === 'stage6_shot_breakdown.ts'
  ) {
    const hasLLMCall = context.content.includes('executeLLMRequest') ||
      context.content.includes('aiGateway.generate') ||
      context.content.includes('executeTask') ||
      context.content.includes('taskExecutor');
    if (!hasLLMCall) {
      violations.push({
        file: normPath,
        rule: 'AUTHORITY_GUARD',
        message: `Production LLM stage '${baseName}' does not call AI Gateway or executeLLMRequest bridge`,
      });
    }

    // Verify no bypass calls like executeSingleModelRequest or raw GoogleGenAI
    if (context.content.includes('executeSingleModelRequest') || context.content.includes('GoogleGenAI')) {
      violations.push({
        file: normPath,
        rule: 'AUTHORITY_GUARD',
        message: `Production LLM stage '${baseName}' contains legacy bypass execution calls`,
      });
    }
  }

  if (baseName === 'agent_runtime.ts') {
    const callsGateway = context.content.includes('aiGateway.generate');
    if (!callsGateway) {
      violations.push({
        file: normPath,
        rule: 'AUTHORITY_GUARD',
        message: `Agent Runtime does not route generation through aiGateway.generate`,
      });
    }
  }

  // --- RULE 4: Deterministic S7/S8 Guard ---
  if (baseName === 'stage7_master_frame.ts' || baseName === 'stage8_video_prompt.ts' || baseName === 'combined_scene_prompt.ts') {
    const hasLLMExecution =
      context.content.includes('executeLLMRequest') ||
      context.content.includes('aiGateway.generate') ||
      context.content.includes('getGeminiAI') ||
      context.content.includes('GoogleGenAI');

    if (hasLLMExecution) {
      violations.push({
        file: normPath,
        rule: 'DETERMINISTIC_STAGE_GUARD',
        message: `Deterministic prompt compilation stage '${baseName}' contains unexpected LLM execution calls!`,
      });
    }
  }

  return violations;
}

/**
 * SCANNER SUITE EXECUTION & REPRODUCE HARNESS
 */
export async function runEnforcementTestSuite(): Promise<{
  repoViolations: EnforcementViolation[];
  syntheticPass: boolean;
  allowedExceptionsPass: boolean;
  s7s8DeterministicPass: boolean;
}> {
  console.log('=== RUNNING PHASE 4.6.1 CONTROL PLANE ENFORCEMENT SUITE ===\n');

  // 1. Scan Repository Production Code
  console.log('1. Scanning entire server/ codebase for control plane violations...');
  const serverDir = path.join(process.cwd(), 'server');
  
  function getAllTsFiles(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
          results = results.concat(getAllTsFiles(fullPath));
        }
      } else if (file.endsWith('.ts')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  const allFiles = getAllTsFiles(serverDir);
  const repoViolations: EnforcementViolation[] = [];

  for (const absPath of allFiles) {
    const relPath = path.relative(process.cwd(), absPath).replace(/\\/g, '/');
    const content = fs.readFileSync(absPath, 'utf8');
    const fileViolations = scanFileForEnforcementViolations({ filePath: relPath, content });
    repoViolations.push(...fileViolations);
  }

  console.log(`Scanned ${allFiles.length} server files. Repository Violations Found: ${repoViolations.length}`);
  if (repoViolations.length > 0) {
    console.error('❌ Repository Violations:', JSON.stringify(repoViolations, null, 2));
  } else {
    console.log('✅ 0 Violations found in current production repository code.\n');
  }

  // 2. Synthetic Unauthorized Violation Test
  console.log('2. Running Synthetic Unauthorized Violation Proof...');
  const syntheticUnauthorizedCode = `
    import { GoogleGenAI } from '@google/genai';
    import { openaiCompatibleDriver } from '../ai_infrastructure/openai_compatible_driver';

    export async function myUnauthorizedNewFeature() {
      const ai = new GoogleGenAI({ apiKey: 'secret' });
      const res = await ai.models.generateContent({ model: 'gemini-3.7-flash', contents: 'hello' });
      await openaiCompatibleDriver.executeChatCompletion({ baseUrl: 'http://foo', apiKey: 'key', model: 'ops', messages: [] });
      return res;
    }
  `;

  const syntheticViolations = scanFileForEnforcementViolations({
    filePath: 'server/stages/stage9_unauthorized_new_stage.ts',
    content: syntheticUnauthorizedCode,
  });

  const syntheticPass = syntheticViolations.length >= 3 &&
    syntheticViolations.some(v => v.rule === 'SDK_IMPORT_GUARD') &&
    syntheticViolations.some(v => v.rule === 'DIRECT_EXECUTION_GUARD');

  if (syntheticPass) {
    console.log(`✅ Synthetic Violation Test PASSED: Successfully detected ${syntheticViolations.length} unauthorized violations in synthetic code.`);
  } else {
    console.error('❌ Synthetic Violation Test FAILED! Scanner failed to reject unauthorized code.', syntheticViolations);
  }

  // 3. Legitimate Allowed Exception Proof
  console.log('\n3. Running Legitimate Allowed Exception Proof...');
  const adminRoutesPath = 'server/routes/ai_infrastructure_routes.ts';
  const adminContent = fs.readFileSync(path.join(process.cwd(), adminRoutesPath), 'utf8');
  const adminViolations = scanFileForEnforcementViolations({
    filePath: adminRoutesPath,
    content: adminContent,
  });

  const geminiPath = 'server/gemini.ts';
  const geminiContent = fs.readFileSync(path.join(process.cwd(), geminiPath), 'utf8');
  const geminiViolations = scanFileForEnforcementViolations({
    filePath: geminiPath,
    content: geminiContent,
  });

  const allowedExceptionsPass = adminViolations.length === 0 && geminiViolations.length === 0;

  if (allowedExceptionsPass) {
    console.log('✅ Allowed Exception Test PASSED: Admin key test endpoint and Omni probe were NOT falsely rejected.');
  } else {
    console.error('❌ Allowed Exception Test FAILED! False positives detected on allowed infrastructure files.', {
      adminViolations,
      geminiViolations,
    });
  }

  // 4. S7/S8 Deterministic Stage Proof
  console.log('\n4. Verifying Stage 7 & Stage 8 Deterministic Behavior...');
  const s7Content = fs.readFileSync(path.join(process.cwd(), 'server/stages/stage7_master_frame.ts'), 'utf8');
  const s8Content = fs.readFileSync(path.join(process.cwd(), 'server/stages/stage8_video_prompt.ts'), 'utf8');

  const s7Violations = scanFileForEnforcementViolations({ filePath: 'server/stages/stage7_master_frame.ts', content: s7Content });
  const s8Violations = scanFileForEnforcementViolations({ filePath: 'server/stages/stage8_video_prompt.ts', content: s8Content });

  const s7s8DeterministicPass = s7Violations.length === 0 && s8Violations.length === 0;

  if (s7s8DeterministicPass) {
    console.log('✅ S7/S8 Deterministic Stage Test PASSED: Stage 7 and Stage 8 remain 100% deterministic (0 LLM calls).\n');
  } else {
    console.error('❌ S7/S8 Test FAILED!', { s7Violations, s8Violations });
  }

  const allPassed = repoViolations.length === 0 && syntheticPass && allowedExceptionsPass && s7s8DeterministicPass;

  if (!allPassed) {
    console.error('\n❌ PHASE 4.6.1 CONTROL PLANE ENFORCEMENT SUITE FAILED!');
    process.exit(1);
  } else {
    console.log('=====================================================');
    console.log('🎉 ALL PHASE 4.6.1 ENFORCEMENT PROOF TESTS PASSED!');
    console.log('=====================================================\n');
  }

  return {
    repoViolations,
    syntheticPass,
    allowedExceptionsPass,
    s7s8DeterministicPass,
  };
}

// Auto-run when executed directly via npx tsx
if (process.argv[1]?.includes('phase4_6_1_control_plane_enforcement_tests')) {
  runEnforcementTestSuite().catch((err) => {
    console.error('Fatal error during Phase 4.6.1 enforcement suite execution:', err);
    process.exit(1);
  });
}
