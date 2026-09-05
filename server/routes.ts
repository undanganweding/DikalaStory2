import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { aiInfrastructureRouter } from './routes/ai_infrastructure_routes';
import { db } from './db';
import {
  runOrchestratedPipeline,
  runPipelineForScene,
  runProjectInitialization,
  generateAllScenes,
  verifyProjectFoundation,
  stoppedProjects,
  isPipelineInFlight,
  isInitializationInFlight,
} from './orchestrator';
import {
  AVAILABLE_MODELS,
  DEFAULT_GEMINI_MODEL,
  resolveGeminiModel,
  checkGeminiOmniCapability,
} from './gemini';
import { runStage7MasterFrameAndImagePrompt } from './stages/stage7_master_frame';
import { runStage8VideoPrompt } from './stages/stage8_video_prompt';
import { assembleCombinedScenePrompt } from './stages/combined_scene_prompt';
import { testLLMConnection, fallbackAuditLogs } from './llm_provider';
import { executeTask } from './ai_infrastructure/task_executor';
import { credentialManager, maskApiKey } from './credential_manager';
import { runCredentialPoolRegressionTests } from './credential_pool_tests';
import { isSupabaseConfigured, getSupabaseConfig, resetSupabaseClientInstance } from './db/supabase_client';
import { testSupabaseConnection, syncLocalDataToSupabase } from './db/supabase_sync';
import {
  Project,
  Shot,
  PromptLanguage,
  PromptTarget,
  ReasoningConfig,
  SceneTone,
  NarrativeStyleConfig,
} from '../src/types';
import { buildGroundingContextPackage, validateGroundingContext, GROUNDING_VERSION } from './grounding_engine';
import {
  TONE_PRESET_NAMES,
  TONE_PRESET_DICTIONARY,
  DEFAULT_NARRATIVE_STYLE_CONFIG,
  recommendSceneTone,
  resolveSceneTone,
  validateNarrativeStyle,
} from './narrative_tone';
import {
  validateDurationCompatibility,
  convertTimelineForExtendedMode,
  runDurationArchitectureRegressionTests,
  resolveOutputDurationStrict,
  PROMPT_TARGET_SUPPORTED_DURATIONS,
} from './duration_engine';
import {
  runPromptEngineRegressionTests,
  serializeMasterSceneData,
  compileNegativePrompt,
  validateProductionPromptContract,
  adaptVeoVideoPrompt,
  adaptOmniVideoPrompt,
  adaptSeedanceVideoPrompt,
  adaptBananaMasterFrame,
  adaptBananaImagePrompt,
} from './cinematic_prompt_engine';
import { runPhase4RegressionSuite } from './phase4_0_tests';
import {
  generateProductionPlan,
  calculateProductionReadiness,
  evaluateSequenceMergeCandidates,
  calculateQuotaEstimates,
  routePlatformForShot,
  DEFAULT_PLATFORM_CAPABILITY_PROFILES,
  runProductionPlannerRegressionTests,
} from './production_planner';
import {
  indexAssetGraph,
  generateAssetImpactAnalysis,
  traverseAssetDependencies,
  runAssetGraphRegressionTests,
} from './scene_asset_integrity_engine';
import {
  UserQuotaProfile,
  PromptLockState,
  PromptVersion,
  PromptRegenerationReason,
  AICallBudget,
  GenerationPlan,
  ProductionReadinessScore,
} from '../src/types';
import {
  ACCEPTED_TARGET_INPUTS,
  parsePromptTargetFromRequest,
  parseOptionalRequestedDuration,
  sendPromptError,
} from './http_prompt_contract';
import {
  isStillPromptTarget,
  ALL_PROMPT_TARGETS,
  InvalidPromptTargetError,
  isLegacyPlatformName,
} from './stages/stage8_video_prompt';
import {
  buildResearchDossier,
  buildNarrativeBlueprint,
  generateFullStory,
  classifyStoryResearchRequirement,
} from './research_narrative_intelligence';
import { geminiProjectRouter } from './gemini_project_router';
import { modelRouter } from './model_router';
import { getProviderHealth } from './adaptive_router';

export const apiRouter = Router();

// Store active SSE clients by projectId
const sseClients: Record<string, Response[]> = {};

function broadcastSSE(projectId: string, data: any) {
  const clients = sseClients[projectId];
  if (!clients || clients.length === 0) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  const activeClients: Response[] = [];
  for (const client of clients) {
    try {
      if (client.writableEnded || client.destroyed) {
        continue;
      }
      client.write(payload);
      activeClients.push(client);
    } catch {
      // client disconnected cleanly ignored
    }
  }
  sseClients[projectId] = activeClients;
}

// Health check
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// AI Infrastructure Control Plane API routes mounted under /api/ai
apiRouter.use('/ai', aiInfrastructureRouter);

// Capability check for Gemini Omni
apiRouter.get('/capabilities/omni', async (req: Request, res: Response) => {
  try {
    const hasOmni = await checkGeminiOmniCapability();
    res.json({ hasOmni });
  } catch (err: any) {
    res.json({ hasOmni: false });
  }
});

// Test connection endpoint for reasoning model providers
apiRouter.post('/test-llm-connection', async (req: Request, res: Response) => {
  try {
    const { provider_type, provider_name, base_url, model_id, api_key, display_name } = req.body;
    if (!model_id) {
      return res.status(400).json({ success: false, message: 'Model ID wajib diisi.' });
    }
    const result = await testLLMConnection({
      provider_type: provider_type || 'google',
      provider_name: provider_name || 'Provider',
      base_url,
      model_id,
      api_key,
      display_name,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Gagal memproses pengujian koneksi.' });
  }
});

// ============================================================================
// PHASE 7B: MULTI-KEY CREDENTIAL POOL & PROVIDER ROUTER ENDPOINTS
// ============================================================================

// List all credentials with masked secrets
apiRouter.get('/credentials', (_req: Request, res: Response) => {
  try {
    const list = credentialManager.listCredentials();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Summary overview of credential pool health
apiRouter.get('/credentials/summary', (_req: Request, res: Response) => {
  try {
    const summary = credentialManager.getPoolSummary();
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add new credential
apiRouter.post('/credentials', (req: Request, res: Response) => {
  try {
    const { provider, label, apiKey, priority, weight, baseUrl, notes } = req.body;
    if (!apiKey || !provider) {
      return res.status(400).json({ error: 'Provider and API Key are required.' });
    }
    const created = credentialManager.addCredential({
      provider,
      label,
      apiKey,
      priority: priority !== undefined ? Number(priority) : 1,
      weight: weight !== undefined ? Number(weight) : 1,
      baseUrl,
      notes,
    });
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update credential
apiRouter.patch('/credentials/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { label, status, priority, weight, baseUrl, notes, apiKey } = req.body;
    const updated = credentialManager.updateCredential(id, {
      label,
      status,
      priority: priority !== undefined ? Number(priority) : undefined,
      weight: weight !== undefined ? Number(weight) : undefined,
      baseUrl,
      notes,
      apiKey,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete credential
apiRouter.delete('/credentials/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = credentialManager.deleteCredential(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Credential not found' });
    }
    res.json({ success: true, message: 'Credential deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Test existing credential
apiRouter.post('/credentials/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await credentialManager.testCredential({ credentialId: id });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Test raw credential before saving
apiRouter.post('/credentials/test-key', async (req: Request, res: Response) => {
  try {
    const { provider, apiKey, baseUrl } = req.body;
    const result = await credentialManager.testCredential({ provider, apiKey, baseUrl });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reset credential status to active
apiRouter.post('/credentials/:id/reset', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = credentialManager.updateCredential(id, { status: 'active' });
    res.json({ success: true, credential: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Run regression test suite for credential pool
apiRouter.get('/regression-tests/credentials', async (_req: Request, res: Response) => {
  try {
    const testResults = await runCredentialPoolRegressionTests();
    const passedCount = testResults.filter((t) => t.passed).length;
    res.json({
      success: passedCount === testResults.length,
      total: testResults.length,
      passed: passedCount,
      failed: testResults.length - passedCount,
      results: testResults,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Supabase Connection & Sync Endpoints
apiRouter.get('/supabase/status', (req: Request, res: Response) => {
  try {
    const config = getSupabaseConfig();
    const enabled = process.env.SUPABASE_ENABLED === 'true';
    const isPlaceholder = config?.url?.includes('your-project.supabase.co');
    res.json({
      configured: isSupabaseConfigured() && !isPlaceholder,
      enabled,
      url: config?.url ? config.url.replace(/:\/\/[^@]+@/, '://***@') : '',
      message: isSupabaseConfigured() && !isPlaceholder ? 'Supabase terkonfigurasi' : 'Supabase belum dikonfigurasi',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/supabase/config', (req: Request, res: Response) => {
  try {
    const { url, serviceRoleKey, enabled } = req.body;
    if (url !== undefined) process.env.SUPABASE_URL = url.trim();
    if (serviceRoleKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey.trim();
    if (enabled !== undefined) process.env.SUPABASE_ENABLED = enabled ? 'true' : 'false';
    resetSupabaseClientInstance();
    res.json({
      success: true,
      configured: isSupabaseConfigured(),
      enabled: process.env.SUPABASE_ENABLED === 'true',
      message: 'Konfigurasi Supabase berhasil disimpan.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/supabase/test', async (req: Request, res: Response) => {
  try {
    const { url, serviceRoleKey } = req.body || {};
    const result = await testSupabaseConnection({ url, serviceRoleKey });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/supabase/sync', async (req: Request, res: Response) => {
  try {
    const { url, serviceRoleKey } = req.body || {};
    const result = await syncLocalDataToSupabase({ url, serviceRoleKey });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/supabase/schema', (req: Request, res: Response) => {
  try {
    const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      res.json({ success: true, sql });
    } else {
      res.status(404).json({ success: false, message: 'File schema.sql tidak ditemukan' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// List available Google Gemini models with router status
apiRouter.get('/router/catalog', (req: Request, res: Response) => {
  try {
    const models = AVAILABLE_MODELS.map(m => ({
      ...m,
      health: getProviderHealth('google', m.id)
    }));
    res.json({
      models,
      defaultModel: DEFAULT_GEMINI_MODEL,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Capability Resolution
apiRouter.post('/router/resolve-model', (req: Request, res: Response) => {
  try {
    const { requiredCapabilities } = req.body;
    if (!requiredCapabilities) return res.status(400).json({ error: 'Missing requiredCapabilities' });
    
    const { AVAILABLE_MODELS } = require('./gemini');
    const { resolveModelForTask } = require('./capability_resolver');
    
    const resolved = resolveModelForTask(AVAILABLE_MODELS, { requiredCapabilities });
    res.json({ candidates: resolved });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get router decision logs

// Gemini Project Router Dashboard
apiRouter.get('/router/gemini-projects', async (req: Request, res: Response) => {
  try {
    const projects = await geminiProjectRouter.listProjectsAsync();
    const logs = geminiProjectRouter.getLogs();
    
    // MASK API KEYS before sending to client
    const safeProjects = projects.map(p => ({
      ...p,
      api_key: p.api_key ? maskApiKey(p.api_key) : ''
    }));

    res.json({ projects: safeProjects, logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/router/gemini-projects', async (req: Request, res: Response) => {
  try {
    const { project_id, api_key, priority, models_available, quota } = req.body;
    if (!project_id || !api_key) return res.status(400).json({ error: 'Missing project_id or api_key' });
    
    await geminiProjectRouter.addProject({
      project_id,
      api_key,
      provider: 'google_gemini',
      models_available: models_available || AVAILABLE_MODELS.map(m => m.id),
      quota: quota || { rpm: 15, tpm: 1000000, rpd: 1500 },
      usage: { rpm_used: 0, tokens_used: 0, requests_today: 0 },
      health: { status: 'healthy', error_rate: 0, success_rate: 100, latency: 500 },
      priority: priority || 1,
      enabled: true
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/router/gemini-projects/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    // Don't accidentally overwrite a real key with a masked key
    if (updates.api_key && updates.api_key.includes('••••')) {
       delete updates.api_key;
    }
    await geminiProjectRouter.updateProject(id, updates);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/router/gemini-projects/:id', async (req: Request, res: Response) => {
  try {
    await geminiProjectRouter.removeProject(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/router/gemini-projects/:id/test', async (req: Request, res: Response) => {
  try {
    const result = await geminiProjectRouter.testProject(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/router/logs', (req: Request, res: Response) => {
  res.json({ logs: modelRouter.getLogs() });
});

// List available Tone Presets & Definitions
apiRouter.get('/tone-presets', (_req: Request, res: Response) => {
  res.json({
    presets: TONE_PRESET_NAMES,
    dictionary: TONE_PRESET_DICTIONARY,
  });
});

// List all projects
apiRouter.get('/projects', async (req: Request, res: Response) => {
  try {
    const list = await db.listProjects();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Research Dossier for project
apiRouter.get('/projects/:id/research-dossier', async (req: Request, res: Response) => {
  try {
    const project = await db.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' });

    const foundation = await db.getProjectFoundation(req.params.id);
    const dossier = project.researchDossier || buildResearchDossier({
      projectId: project.id,
      subject: project.title,
      rawScript: project.raw_script || '',
      sources: project.sourceRegistry || project.contextPackage?.sources || [],
      claims: project.researchPackage?.claims || [],
      foundation,
    });

    if (!project.researchDossier) {
      await db.saveProject({ ...project, researchDossier: dossier });
    }

    res.json(dossier);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Narrative Blueprint for project
apiRouter.get('/projects/:id/narrative-blueprint', async (req: Request, res: Response) => {
  try {
    const project = await db.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' });

    const foundation = await db.getProjectFoundation(req.params.id);
    const dossier = project.researchDossier || buildResearchDossier({
      projectId: project.id,
      subject: project.title,
      rawScript: project.raw_script || '',
      sources: project.sourceRegistry || project.contextPackage?.sources || [],
      claims: project.researchPackage?.claims || [],
      foundation,
    });

    const blueprint = project.narrativeBlueprint || buildNarrativeBlueprint(dossier, project.raw_script || '');

    if (!project.narrativeBlueprint) {
      await db.saveProject({ ...project, narrativeBlueprint: blueprint, researchDossier: dossier });
    }

    res.json(blueprint);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Full Story for project
apiRouter.get('/projects/:id/full-story', async (req: Request, res: Response) => {
  try {
    const project = await db.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' });

    const foundation = await db.getProjectFoundation(req.params.id);
    const dossier = project.researchDossier || buildResearchDossier({
      projectId: project.id,
      subject: project.title,
      rawScript: project.raw_script || '',
      sources: project.sourceRegistry || project.contextPackage?.sources || [],
      claims: project.researchPackage?.claims || [],
      foundation,
    });

    const blueprint = project.narrativeBlueprint || buildNarrativeBlueprint(dossier, project.raw_script || '');
    const fullStory = project.fullStory || generateFullStory(dossier, blueprint);

    if (!project.fullStory) {
      await db.saveProject({
        ...project,
        researchDossier: dossier,
        narrativeBlueprint: blueprint,
        fullStory,
      });
    }

    res.json(fullStory);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create new project
apiRouter.post('/projects', async (req: Request, res: Response) => {
  try {
    const {
      title,
      raw_script,
      total_duration_target_sec,
      max_scene_shot_duration_sec,
      scene_duration_sec,
      allow_final_scene_override,
      prompt_language,
      ai_model,
      reasoning_config,
      image_model,
      video_model,
      include_seedance_format,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Judul project wajib diisi.' });
    }
    if (!raw_script || !raw_script.trim()) {
      return res.status(400).json({ error: 'Naskah/Storyboard mentah wajib diisi.' });
    }

    const durationTarget = Number(total_duration_target_sec) || 120; // default 2m = 120s
    let maxScene: number | null = null;
    const rawSceneDur = scene_duration_sec !== undefined ? scene_duration_sec : max_scene_shot_duration_sec;
    if (rawSceneDur !== null && rawSceneDur !== undefined && rawSceneDur !== 'auto') {
      maxScene = Math.min(30, Math.max(5, Number(rawSceneDur)));
    }

    const language: PromptLanguage = prompt_language === 'en' ? 'en' : 'id';
    
    const isAutoRouting = !ai_model || ai_model === 'auto' || reasoning_config?.execution_policy?.mode === 'auto' || reasoning_config?.model_id === 'auto';
    
    let effectiveReasoningConfig: ReasoningConfig | undefined = reasoning_config;
    let selectedModel = isAutoRouting ? 'auto' : (ai_model || 'auto');

    if (isAutoRouting) {
      effectiveReasoningConfig = {
        provider_type: 'google',
        provider_name: 'AI Director (Auto Routing)',
        model_id: 'auto',
        display_name: 'AI Director (Task Router S1-S8)',
        execution_policy: {
          mode: 'auto',
          quality: reasoning_config?.execution_policy?.quality || 'high',
          priority: reasoning_config?.execution_policy?.priority || 'quality',
        },
      };
    } else if (effectiveReasoningConfig) {
      if (effectiveReasoningConfig.provider_type === 'google') {
        selectedModel = resolveGeminiModel(effectiveReasoningConfig.model_id || ai_model);
        effectiveReasoningConfig.model_id = selectedModel;
      } else {
        selectedModel = effectiveReasoningConfig.model_id || 'qwen/qwen-2.5-72b-instruct:free';
      }
    } else if (ai_model) {
      selectedModel = resolveGeminiModel(ai_model);
      effectiveReasoningConfig = {
        provider_type: 'google',
        provider_name: 'Google Gemini',
        model_id: selectedModel,
        display_name: selectedModel,
        execution_policy: {
          mode: 'pin',
          pinnedModelId: selectedModel,
          pinnedProviderId: 'google',
        },
      };
    }

    const validatedVideoModels: ('veo' | 'gemini_omni')[] = Array.isArray(video_model) && video_model.length > 0
      ? video_model.filter((m: string) => m === 'veo' || m === 'gemini_omni')
      : ['veo'];

    const defaultModelPrefs = req.body.reasoning_model_preferences || {
      mode: 'fixed',
      primary_model: {
        provider: effectiveReasoningConfig?.provider_type || 'google',
        model_id: selectedModel,
        display_name: selectedModel,
      },
      fallback_policy: 'smart',
      fallback_pool: [
        { provider: 'google', model_id: 'gemini-3.8-flash', priority: 1, display_name: 'Gemini 3.8 Flash' },
        { provider: 'google', model_id: 'gemini-3.7-flash', priority: 2, display_name: 'Gemini 3.7 Flash' },
        { provider: 'google', model_id: 'gemini-3.1-pro-preview', priority: 3, display_name: 'Gemini 3.1 Pro Preview' },
      ],
      force_model: false,
    };

    const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const groundingContext = buildGroundingContextPackage(raw_script.trim());
    const newProject: Project = {
      id,
      title: title.trim(),
      raw_script: raw_script.trim(),
      total_duration_target_sec: durationTarget,
      max_scene_shot_duration_sec: maxScene,
      scene_duration_sec: maxScene,
      allow_final_scene_override: Boolean(allow_final_scene_override),
      prompt_language: language,
      ai_model: selectedModel,
      reasoning_config: effectiveReasoningConfig,
      reasoning_model_preferences: defaultModelPrefs,
      image_model: 'nano_banana_pro',
      video_model: validatedVideoModels,
      include_seedance_format: Boolean(include_seedance_format),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'draft',
      current_stage: 0,
      error_message: null,
      retry_count: 0,
      groundingVersion: GROUNDING_VERSION,
      contextPackage: groundingContext,
      sourceRegistry: groundingContext.sources,
      validationResult: validateGroundingContext(groundingContext),
      groundingStatus: groundingContext.groundingStatus,
    };

    const saved = await db.saveProject(newProject);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update project settings
apiRouter.patch('/projects/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const project = await db.getProject(id);
    if (!project) {
      return res.status(404).json({ error: 'Project tidak ditemukan.' });
    }

    const {
      ai_model,
      title,
      raw_script,
      total_duration_target_sec,
      max_scene_shot_duration_sec,
      prompt_language,
      video_model,
      include_seedance_format,
      reasoning_config,
      reasoning_model_preferences,
    } = req.body;

    let updatedReasoningConfig: ReasoningConfig | undefined = reasoning_config || project.reasoning_config;
    let resolvedModel = project.ai_model || 'auto';

    if (ai_model !== undefined) {
      if (!ai_model || ai_model === 'auto') {
        resolvedModel = 'auto';
        updatedReasoningConfig = {
          provider_type: 'google',
          provider_name: 'AI Director (Auto Routing)',
          model_id: 'auto',
          display_name: 'AI Director (Task Router S1-S8)',
          execution_policy: {
            mode: 'auto',
            quality: updatedReasoningConfig?.execution_policy?.quality || 'high',
            priority: updatedReasoningConfig?.execution_policy?.priority || 'quality',
          },
        };
      } else {
        resolvedModel = resolveGeminiModel(ai_model);
        updatedReasoningConfig = {
          ...(updatedReasoningConfig || { provider_type: 'google', provider_name: 'Google Gemini' }),
          model_id: resolvedModel,
          display_name: resolvedModel,
          execution_policy: {
            mode: 'pin',
            pinnedModelId: resolvedModel,
            pinnedProviderId: updatedReasoningConfig?.provider_type || 'google',
            priority: updatedReasoningConfig?.execution_policy?.priority || 'quality',
          },
        };
      }
    } else if (reasoning_config) {
      resolvedModel = reasoning_config.model_id || 'auto';
    }

    const updated: Project = {
      ...project,
      ...(title && { title: title.trim() }),
      ...(raw_script && { raw_script: raw_script.trim() }),
      ...(total_duration_target_sec && { total_duration_target_sec: Number(total_duration_target_sec) }),
      ...(max_scene_shot_duration_sec !== undefined && {
        max_scene_shot_duration_sec:
          max_scene_shot_duration_sec === null || max_scene_shot_duration_sec === 'auto'
            ? null
            : Math.min(30, Math.max(5, Number(max_scene_shot_duration_sec))),
      }),
      ...(prompt_language && { prompt_language: prompt_language === 'en' ? 'en' : 'id' }),
      ai_model: resolvedModel,
      reasoning_config: updatedReasoningConfig,
      ...(reasoning_model_preferences && { reasoning_model_preferences }),
      ...(video_model && { video_model }),
      ...(include_seedance_format !== undefined && { include_seedance_format: Boolean(include_seedance_format) }),
      updated_at: new Date().toISOString(),
    };

    const saved = await db.saveProject(updated);
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get fallback audit logs for project
apiRouter.get('/projects/:id/fallback-logs', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const logs = fallbackAuditLogs.filter(l => !l.entity_id || l.entity_id === id);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single project full data
apiRouter.get('/projects/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const [fullData, logs] = await Promise.all([
      db.getFullProjectData(id),
      db.getLogs(id),
    ]);
    if (!fullData) {
      return res.status(404).json({ error: 'Project tidak ditemukan.' });
    }
    res.json({ ...fullData, logs: logs || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete project
apiRouter.delete('/projects/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const success = await db.deleteProject(id);
    if (!success) {
      return res.status(404).json({ error: 'Project tidak ditemukan.' });
    }
    res.json({ success: true, message: 'Project berhasil dihapus.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Check Project Foundation Status (S1-S5)
apiRouter.get('/projects/:id/foundation-status', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const status = await verifyProjectFoundation(id);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Run Project Initialization (S1-S5 ONLY)
apiRouter.post('/projects/:id/initialize-foundation', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const project = await db.getProject(id);
    if (!project) {
      return res.status(404).json({ error: 'Project tidak ditemukan.' });
    }

    if (isInitializationInFlight(id) || isPipelineInFlight(id)) {
      return res.json({
        status: 'joined',
        message: 'Inisialisasi fondasi proyek sudah berjalan; bergabung ke proses yang aktif.',
        projectId: id,
        inFlight: true,
      });
    }

    res.json({
      status: 'started',
      message: 'Inisialisasi fondasi proyek (S1–S5) dimulai.',
      projectId: id,
    });

    runProjectInitialization(id, (stage, stageName, message, level) => {
      broadcastSSE(id, {
        type: 'progress',
        stage,
        stageName,
        message,
        level,
        timestamp: new Date().toISOString(),
      });
    }).then((result) => {
      broadcastSSE(id, {
        type: 'finished',
        success: result.success,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Generate All Scenes (S6-S8 ONLY with concurrency)
apiRouter.post('/projects/:id/generate-scenes', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const project = await db.getProject(id);
    if (!project) {
      return res.status(404).json({ error: 'Project tidak ditemukan.' });
    }

    const concurrency = Number(req.body.concurrency) || 2;
    const runContext = {
      runId: `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      projectId: id,
      startedAt: new Date().toISOString(),
      concurrency,
    };

    res.json({
      status: 'started',
      message: `Generasi seluruh scene (S6–S8) dimulai dengan konkurensi ${concurrency}.`,
      projectId: id,
      runId: runContext.runId,
    });

    generateAllScenes(id, concurrency, (stage, stageName, message, level) => {
      broadcastSSE(id, {
        type: 'progress',
        stage,
        stageName,
        message,
        level,
        timestamp: new Date().toISOString(),
        runId: runContext.runId,
      });
    }, runContext).then((result) => {
      broadcastSSE(id, {
        type: 'finished',
        success: result.success,
        readyScenes: result.readyScenes,
        totalScenes: result.totalScenes,
        runId: runContext.runId,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Project Telemetry
apiRouter.get('/projects/:id/telemetry', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const telemetry = await db.getTelemetry(id);
    res.json({ telemetry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger Orchestrated Pipeline Generation (Stages 1-8)
apiRouter.post('/projects/:id/generate', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const project = await db.getProject(id);
    if (!project) {
      return res.status(404).json({ error: 'Project tidak ditemukan.' });
    }

    if (isPipelineInFlight(id)) {
      return res.json({
        status: 'joined',
        message: 'Pipeline sudah berjalan; bergabung ke pipeline yang sedang aktif.',
        projectId: id,
        inFlight: true,
      });
    }

    const concurrency = Number(req.body.concurrency) || 2;
    const runContext = {
      runId: `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      projectId: id,
      startedAt: new Date().toISOString(),
      concurrency,
    };

    // Immediately persist processing state so client and SSE queries immediately see the active status
    const updatedProject = await db.saveProject({
      ...project,
      status: 'processing',
      current_stage: Math.max(1, project.current_stage || 1),
      error_message: null,
      active_run_id: runContext.runId,
      latest_run_id: runContext.runId,
    });

    res.json({
      status: 'started',
      message: 'Orchestrator pipeline dimulai.',
      projectId: id,
      runId: runContext.runId,
      project: updatedProject,
    });

    runOrchestratedPipeline({
      projectId: id,
      runContext,
      sceneConcurrency: concurrency,
      onProgress: (stage, stageName, message, level) => {
        broadcastSSE(id, {
          type: 'progress',
          stage,
          stageName,
          message,
          level,
          timestamp: new Date().toISOString(),
          runId: runContext.runId,
        });
      },
    }).then((result) => {
      broadcastSSE(id, {
        type: 'finished',
        success: result.success,
        error: result.error,
        runId: result.runId ?? runContext.runId,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Stop Orchestrated Pipeline
apiRouter.post('/projects/:id/stop', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const project = await db.getProject(id);
    if (!project) {
      return res.status(404).json({ error: 'Project tidak ditemukan.' });
    }

    stoppedProjects.add(id);

    // Update state to failed in DB to immediately release any visual lock in the UI
    await db.saveProject({
      ...project,
      status: 'failed',
      error_message: 'Pipeline dihentikan oleh pengguna.',
    });

    broadcastSSE(id, {
      type: 'progress',
      stage: project.current_stage || 1,
      stageName: 'Pipeline Orchestrator',
      message: '🛑 Menghentikan pipeline atas permintaan pengguna...',
      level: 'warn',
      timestamp: new Date().toISOString(),
    });

    broadcastSSE(id, {
      type: 'finished',
      success: false,
      error: 'Pipeline dihentikan oleh pengguna.',
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Pipeline dihentikan.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reset Project States to draft for clean re-run
apiRouter.post('/projects/:id/reset', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const project = await db.getProject(id);
    if (!project) {
      return res.status(404).json({ error: 'Project tidak ditemukan.' });
    }

    await db.resetProjectState(id);
    const updatedProject = await db.getProject(id);

    broadcastSSE(id, {
      type: 'progress',
      stage: 1,
      stageName: 'Pipeline Orchestrator',
      message: '🔄 Status proyek dan semua tahapan direset kembali ke awal (Draft).',
      level: 'info',
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Status proyek direset.',
      project: updatedProject,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Import Project Blueprint (JSON upload or Google Drive import)
apiRouter.post('/projects/import', async (req: Request, res: Response) => {
  try {
    const importData = req.body;
    if (!importData || (typeof importData !== 'object')) {
      return res.status(400).json({ error: 'Format data JSON tidak valid.' });
    }

    const sourceProject = importData.project || importData;
    if (!sourceProject.title && !sourceProject.raw_script) {
      return res.status(400).json({ error: 'Data proyek tidak memiliki judul atau naskah yang valid.' });
    }

    const newProjectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const importedProject: any = {
      ...sourceProject,
      id: newProjectId,
      title: sourceProject.title ? `${sourceProject.title} (Imported)` : 'Imported Project',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: sourceProject.status || 'ready',
    };

    await db.saveProject(importedProject);

    // Save Foundation if present
    if (importData.foundation || sourceProject.foundation) {
      const fData = importData.foundation || sourceProject.foundation;
      await db.saveProjectFoundation({
        ...fData,
        project_id: newProjectId,
      });
    }

    // Save Story Architecture if present
    if (importData.storyArchitecture || sourceProject.storyArchitecture) {
      const arch = importData.storyArchitecture || sourceProject.storyArchitecture;
      await db.saveStoryArchitecture({
        ...arch,
        project_id: newProjectId,
      });
    }

    // Save Characters if present
    const chars = importData.characters || sourceProject.characters;
    if (Array.isArray(chars) && chars.length > 0) {
      await db.saveAndMergeCharacters(newProjectId, chars);
    }

    // Save Locations if present
    const locs = importData.locations || sourceProject.locations;
    if (Array.isArray(locs) && locs.length > 0) {
      await db.saveAndMergeLocations(newProjectId, locs);
    }

    // Save Objects if present
    const objs = importData.objects || sourceProject.objects;
    if (Array.isArray(objs) && objs.length > 0) {
      await db.saveAndMergeObjects(newProjectId, objs);
    }

    // Save Scenes if present
    let savedScenes: any[] = [];
    const sourceScenes = Array.isArray(importData.scenes) ? importData.scenes : (Array.isArray(sourceProject.scenes) ? sourceProject.scenes : []);
    if (sourceScenes.length > 0) {
      savedScenes = await db.saveScenes(newProjectId, sourceScenes);
    }

    // Save Shots if present
    const sourceShots = importData.shots || sourceProject.shots;
    let savedShotsMap: Record<string, any[]> = {};
    if (sourceShots && typeof sourceShots === 'object') {
      if (Array.isArray(sourceShots)) {
        for (const shot of sourceShots) {
          const targetSceneId = shot.scene_id || (savedScenes[0]?.id || 'scene_1');
          await db.saveShots(targetSceneId, newProjectId, [shot]);
        }
      } else {
        for (const [key, shotList] of Object.entries(sourceShots)) {
          if (Array.isArray(shotList) && shotList.length > 0) {
            let matchingScene = savedScenes.find(s => s.id === key || String(s.scene_number) === key);
            const targetSceneId = matchingScene ? matchingScene.id! : (savedScenes[0]?.id || key);
            const saved = await db.saveShots(targetSceneId, newProjectId, shotList as any[]);
            savedShotsMap[targetSceneId] = saved;
          }
        }
      }
    }

    const finalProject = await db.getProject(newProjectId);

    res.json({
      success: true,
      message: 'Proyek cetak biru berhasil diimpor.',
      project: finalProject || importedProject,
      scenes: savedScenes,
      shots: savedShotsMap,
    });
  } catch (err: any) {
    console.error('Failed to import project:', err);
    res.status(500).json({ error: err.message || 'Gagal mengimpor proyek.' });
  }
});

// Single Scene Pipeline Generation (Stages 6, 7, 8)
apiRouter.post('/scenes/:id/run-pipeline', async (req: Request, res: Response) => {
  try {
    const sceneId = req.params.id;
    const scene = await db.getScene(sceneId);
    if (!scene) {
      return res.status(404).json({ error: 'Scene tidak ditemukan.' });
    }

    const result = await runPipelineForScene(sceneId);
    const updatedFullData = await db.getFullProjectData(scene.project_id);
    res.json({ success: result.success, error: result.error, project: updatedFullData });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// accepts both still target (banana_master_frame / banana_image) and video target (veo, omni, seedance)
apiRouter.post('/scenes/:id/regenerate-prompt', async (req: Request, res: Response) => {
  let promptTarget: PromptTarget;
  let requestedDuration: number | undefined;
  try {
    promptTarget = parsePromptTargetFromRequest(
      req.body?.target ?? req.body?.platform ?? 'banana_master_frame'
    );
    requestedDuration = parseOptionalRequestedDuration(
      req.body?.requestedDuration ?? req.body?.duration_sec
    );
  } catch (err: any) {
    return sendPromptError(res, err, 'Target prompt tidak valid.');
  }

  try {
    const sceneId = req.params.id;
    const scene = await db.getScene(sceneId);
    if (!scene) {
      return res.status(404).json({ success: false, error: 'Scene tidak ditemukan.', code: 'SCENE_NOT_FOUND' });
    }

    const projectId = scene.project_id;
    const project = await db.getProject(projectId);
    const foundation = await db.getProjectFoundation(projectId);
    const characters = await db.getCharacters(projectId);
    const locations = await db.getLocations(projectId);
    const objects = await db.getObjects(projectId);

    if (isStillPromptTarget(promptTarget)) {
      // Duration + contract gates live inside Stage 7 and throw before returning,
      // so nothing below this call runs for an invalid prompt.
      const stage7Result = await runStage7MasterFrameAndImagePrompt({
        scene,
        foundation,
        characters,
        locations,
        objects,
        language: project?.prompt_language || 'id',
        model: project?.ai_model === 'auto' ? undefined : project?.ai_model,
        reasoningConfig: project?.reasoning_config,
        requestedDuration,
      });

      // --- PERSIST only after both banana contracts validated ---
      const updatedScene = await db.updateScene(sceneId, {
        master_image_prompt: stage7Result.compiledPromptText,
        master_image_prompt_json: stage7Result.promptJson,
        image_gen_status: 'success',
        image_gen_error: null,
      });

      res.json({
        success: true,
        target: promptTarget,
        resolved_duration_sec: stage7Result.resolvedDurationSec,
        scene: updatedScene,
        compiledPromptText: stage7Result.compiledPromptText,
        masterFramePromptText: stage7Result.masterFramePromptText,
      });
    } else {
      // --- VIDEO TARGET PATH VIA VIRTUAL COMPATIBILITY SHOT ---
      const shot = await db.getOrCreateVirtualShotForScene(sceneId);
      const allSceneShots = await db.getShotsByScene(sceneId);
      const shotIndex = allSceneShots.findIndex((s) => s.id === shot.id);

      const stage8Result = await runStage8VideoPrompt({
        scene,
        shot,
        shotIndex: shotIndex >= 0 ? shotIndex : 0,
        totalShotsInScene: allSceneShots.length || 1,
        masterFrameImageUrl: scene.master_frame_image_url,
        foundation,
        characters,
        locations,
        videoModels: project?.video_model || ['veo'],
        includeSeedance: !!project?.include_seedance_format,
        language: project?.prompt_language || 'id',
        model: project?.ai_model,
        reasoningConfig: project?.reasoning_config,
        target: promptTarget,
        requestedDuration,
      });

      const existingPrompts = await db.getVideoPromptsByShot(shot.id!);
      const savedPrompts: any[] = [];
      const shotUpdates: Partial<Shot> = {};

      for (const newPrompt of stage8Result.prompts) {
        const existingMatch = existingPrompts.find((p) =>
          p.prompt_target
            ? p.prompt_target === newPrompt.prompt_target
            : p.target_platform === newPrompt.target_platform && p.target_platform !== 'seedance'
        );
        if (existingMatch) {
          const updated = await db.saveSingleVideoPrompt({
            ...existingMatch,
            ...newPrompt,
            id: existingMatch.id,
          });
          savedPrompts.push(updated);
        } else {
          const created = await db.saveSingleVideoPrompt({
            ...newPrompt,
            shot_id: shot.id!,
            scene_id: sceneId,
            project_id: projectId,
            version: 1,
          } as any);
          savedPrompts.push(created);
        }

        if (newPrompt.target_platform === 'seedance') {
          shotUpdates.seedance_prompt = newPrompt.timeline_json?.shot_breakdown || newPrompt.timeline_json?.prompt;
        } else if (newPrompt.target_platform === 'veo') {
          shotUpdates.video_prompt = newPrompt.timeline_json?.prompt;
        }
      }

      if (Object.keys(shotUpdates).length > 0) {
        await db.updateShot(shot.id!, shotUpdates);
      }

      const finalShot = await db.getShot(shot.id!);

      res.json({
        success: true,
        target: promptTarget,
        resolved_duration_sec: stage8Result.prompts[0]?.timeline_json?.resolved_duration_sec,
        shot: finalShot,
        scene,
        prompts: savedPrompts,
      });
    }
  } catch (err: any) {
    return sendPromptError(res, err, 'Gagal meregenerate video/still prompt untuk scene ini.');
  }
});

// PATCH 5.5-R1 FASE 4: discoverable prompt target contract.
apiRouter.get('/prompt-targets', (_req: Request, res: Response) => {
  res.json({
    targets: ALL_PROMPT_TARGETS,
    supportedDurations: PROMPT_TARGET_SUPPORTED_DURATIONS,
    acceptedInputs: ACCEPTED_TARGET_INPUTS,
  });
});

// Test Prompt Engine Regression Suite
apiRouter.get('/test-prompt-engine', (req: Request, res: Response) => {
  try {
    const results = runPromptEngineRegressionTests();
    const allPassed = results.every((r) => r.passed);
    res.json({
      success: allPassed,
      allPassed,
      totalTests: results.length,
      passedTests: results.filter((r) => r.passed).length,
      results,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Test Phase 4.0 Unified Contract Regression Suite
apiRouter.get('/test-phase4', (req: Request, res: Response) => {
  try {
    const summary = runPhase4RegressionSuite();
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Combined Prompt per Scene (derived assembly, not new Gemini call)
apiRouter.get('/scenes/:id/combined-prompt', async (req: Request, res: Response) => {
  try {
    const sceneId = req.params.id;
    const platform = (req.query.platform as 'veo' | 'gemini_omni' | 'seedance') || 'veo';
    const result = await assembleCombinedScenePrompt(sceneId, platform);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Scene (Consolidated: handles master_frame_image_url and all scene properties)
apiRouter.put('/scenes/:id', async (req: Request, res: Response) => {
  try {
    const sceneId = req.params.id;
    const existing = await db.getScene(sceneId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Scene tidak ditemukan.' });
    }
    const updated = await db.updateScene(sceneId, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Scene tidak ditemukan.' });
    }
    res.json({
      success: true,
      scene: updated,
      ...updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Scene-level Smart Regenerate (delegates to virtual shot)
apiRouter.post('/scenes/:id/smart-regenerate', async (req: Request, res: Response) => {
  const sceneId = req.params.id;
  try {
    const scene = await db.getScene(sceneId);
    if (!scene) {
      return res.status(404).json({ success: false, error: 'Scene tidak ditemukan.', code: 'SCENE_NOT_FOUND' });
    }

    const shot = await db.getOrCreateVirtualShotForScene(sceneId);
    const projectId = scene.project_id;
    const project = await db.getProject(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Proyek tidak ditemukan.', code: 'PROJECT_NOT_FOUND' });
    }

    // 1. Parse target & duration
    let promptTarget: PromptTarget;
    let requestedDuration: number | undefined;
    try {
      promptTarget = parsePromptTargetFromRequest(req.body?.target ?? req.body?.platform ?? shot.recommended_platform ?? 'veo');
      requestedDuration = parseOptionalRequestedDuration(
        req.body?.requestedDuration ?? req.body?.duration_sec ?? req.body?.requested_duration
      );
    } catch (err: any) {
      return sendPromptError(res, err, 'Target prompt tidak valid.');
    }

    const reason: PromptRegenerationReason | string = req.body?.reason || 'FULL';
    const requireAi = Boolean(req.body?.require_ai || req.body?.requireAi);
    const customInstructions = req.body?.custom_instructions || req.body?.customInstructions || '';

    // 2. Resolve lock state (merge shot.lock_state with incoming overrides)
    const inputLocks = req.body?.field_locks || req.body?.lock_state || {};
    const lockState: PromptLockState = {
      character_locked: inputLocks.character_locked !== undefined ? Boolean(inputLocks.character_locked) : (shot.lock_state?.character_locked ?? true),
      location_locked: inputLocks.location_locked !== undefined ? Boolean(inputLocks.location_locked) : (shot.lock_state?.location_locked ?? true),
      costume_locked: inputLocks.costume_locked !== undefined ? Boolean(inputLocks.costume_locked) : (shot.lock_state?.costume_locked ?? true),
      lighting_locked: inputLocks.lighting_locked !== undefined ? Boolean(inputLocks.lighting_locked) : (shot.lock_state?.lighting_locked ?? true),
      camera_locked: inputLocks.camera_locked !== undefined ? Boolean(inputLocks.camera_locked) : (shot.lock_state?.camera_locked ?? false),
      action_locked: inputLocks.action_locked !== undefined ? Boolean(inputLocks.action_locked) : (shot.lock_state?.action_locked ?? false),
      composition_locked: inputLocks.composition_locked !== undefined ? Boolean(inputLocks.composition_locked) : (shot.lock_state?.composition_locked ?? false),
    };

    const foundation = await db.getProjectFoundation(projectId);
    const characters = await db.getCharacters(projectId);
    const locations = await db.getLocations(projectId);
    const objects = await db.getObjects(projectId);
    const allSceneShots = await db.getShotsByScene(sceneId);

    const isStill = isStillPromptTarget(promptTarget);
    const effectiveDuration = requestedDuration !== undefined
      ? requestedDuration
      : (promptTarget === 'seedance_30'
          ? 30
          : promptTarget === 'seedance_10'
          ? 10
          : (shot.duration_sec && PROMPT_TARGET_SUPPORTED_DURATIONS[promptTarget]?.includes(shot.duration_sec)
              ? shot.duration_sec
              : 10));
    const resolvedDuration = resolveOutputDurationStrict(promptTarget, effectiveDuration);

    let generatedPromptText = '';
    let negativePromptText = '';
    let usedAi = false;

    // Build unified masterData for both deterministic and AI routes (Phase 3.7M)
    const masterData = serializeMasterSceneData(
      scene,
      allSceneShots.length > 0 ? allSceneShots : [shot],
      foundation,
      characters,
      locations,
      objects,
      (promptTarget === 'omni' ? 'gemini_omni' : promptTarget.startsWith('seedance') ? 'seedance' : promptTarget.startsWith('banana') ? 'banana' : 'veo') as any,
      'cinematic',
      project.title || 'Cinematic Production',
      resolvedDuration
    );

    // Apply the merged lockState explicitly to masterData.continuity
    masterData.continuity.character_lock = lockState.character_locked;
    masterData.continuity.location_lock = lockState.location_locked;
    masterData.continuity.clothing_lock = lockState.costume_locked;
    masterData.continuity.lighting_lock = lockState.lighting_locked;
    masterData.continuity.camera_lock = lockState.camera_locked;
    masterData.continuity.composition_lock = lockState.composition_locked;

    if (!requireAi) {
      // --- DETERMINISTIC REGENERATION PATH (0 AI CALLS) ---
      if (reason === 'CAMERA' && !lockState.camera_locked && customInstructions) {
        masterData.camera.movement = customInstructions;
      } else if (reason === 'LIGHTING' && !lockState.lighting_locked && customInstructions) {
        masterData.lighting.atmosphere = customInstructions;
      }

      // Adapt to target
      if (promptTarget === 'banana_master_frame') {
        generatedPromptText = adaptBananaMasterFrame(masterData);
      } else if (promptTarget === 'banana_image') {
        generatedPromptText = adaptBananaImagePrompt(masterData);
      } else if (promptTarget === 'veo') {
        const adapted = adaptVeoVideoPrompt(masterData, allSceneShots.length > 0 ? allSceneShots : [shot]);
        generatedPromptText = adapted.prompt;
      } else if (promptTarget === 'omni') {
        const adapted = adaptOmniVideoPrompt(masterData);
        generatedPromptText = adapted.prompt;
      } else if (promptTarget === 'seedance_10' || promptTarget === 'seedance_30') {
        const adapted = adaptSeedanceVideoPrompt(masterData);
        generatedPromptText = adapted.shot_breakdown;
      }

      negativePromptText = compileNegativePrompt(masterData);
    } else {
      // --- AI-REQUIRED REGENERATION PATH ---
      usedAi = true;
      const reasoningConfig = project.reasoning_config;

      const systemPrompt = `You are the SINEMA Production Prompt Engine.
You must regenerate a cinematic prompt for target: "${promptTarget}" (Duration: ${resolvedDuration}s).
STRICT IMMUTABLE FIELD LOCKS (DO NOT CHANGE THESE UNDER ANY CIRCUMSTANCES):
${lockState.character_locked ? '- CHARACTER: LOCKED. Character names, identities, appearance, and prophet restrictions MUST NOT BE CHANGED.' : '- Character: unlocked.'}
${lockState.location_locked ? '- LOCATION: LOCKED. Historical era, architecture, and environment MUST NOT BE CHANGED.' : '- Location: unlocked.'}
${lockState.costume_locked ? '- COSTUME: LOCKED. Attire and accessories MUST NOT BE CHANGED.' : '- Costume: unlocked.'}
${lockState.lighting_locked ? '- LIGHTING: LOCKED. Lighting scheme and color temperature MUST NOT BE CHANGED.' : '- Lighting: unlocked.'}
${lockState.camera_locked ? '- CAMERA: LOCKED. Camera angle, lens, focal length, depth of field, and camera movement MUST NOT BE CHANGED.' : '- Camera: unlocked.'}
${lockState.action_locked ? '- ACTION: LOCKED. Primary action beat MUST NOT BE CHANGED.' : '- Action: unlocked.'}
${lockState.composition_locked ? '- COMPOSITION: LOCKED. Layout grid, subject placement, visual balance, foreground layer, and spatial relationship MUST NOT BE CHANGED.' : '- Composition: unlocked.'}

Regeneration Reason: ${reason}
${customInstructions ? `Custom User Instructions: ${customInstructions}` : ''}
Scene: ${scene.scene_number}. ${scene.title}
Event: ${scene.event}
Shot #${shot.shot_number}: ${shot.character_action || shot.event_detail}

Format the prompt to match the strict ${promptTarget} schema. Do not use legacy @ tags or placeholders.`;

      const response = await executeTask({
        taskId: 'video_prompt_generation',
        stageCode: 'S8',
        systemInstruction: systemPrompt,
        prompt: `Generate the finalized prompt for ${promptTarget} adhering to all locked invariants.`,
        temperature: 0.2,
        reasoningConfig,
      });

      generatedPromptText = response.text?.trim() || '';
      negativePromptText = 'blurry, distorted, low quality, cartoon, cgi render, modern objects, text overlay';
    }

    // Validate prompt contract
    const contractValidation = validateProductionPromptContract(
      generatedPromptText,
      promptTarget,
      resolvedDuration,
      {
        sceneId: scene.id,
        shotId: shot.id,
        isProphetScene: scene.event?.toLowerCase().includes('rasulullah') || scene.character_names?.some((c) => c.toLowerCase().includes('rasulullah')),
        masterData,
      }
    );

    if (!contractValidation.valid) {
      return res.status(422).json({
        success: false,
        error: contractValidation.errorMessage || 'PROMPT_CONTRACT_VALIDATION_FAILED',
        code: 'PROMPT_CONTRACT_VALIDATION_FAILED',
        failedRules: contractValidation.failedRules,
      });
    }

    // 3. Non-destructive versioning
    const existingVersions: PromptVersion[] = shot.prompt_versions || [];
    const newVersionNumber = existingVersions.length + 1;
    const targetPlatformName = promptTarget.startsWith('seedance') ? 'seedance' : promptTarget === 'omni' ? 'gemini_omni' : 'veo';

    const newPromptVersion: PromptVersion = {
      version: newVersionNumber,
      prompt_type: isStill ? 'image' : 'video',
      target_platform: targetPlatformName,
      prompt_target: promptTarget,
      prompt_text: generatedPromptText,
      negative_prompt: negativePromptText,
      reason,
      lock_state: lockState,
      status: 'approved',
      created_at: new Date().toISOString(),
      created_by: usedAi ? 'gemini' : 'compiler',
    };

    const updatedVersions = [...existingVersions, newPromptVersion];
    const shotUpdates: Partial<Shot> = {
      lock_state: lockState,
      prompt_versions: updatedVersions,
      version: newVersionNumber,
    };

    let savedPrompts: any[] = [];
    if (isStill) {
      shotUpdates.master_image_prompt = generatedPromptText;
      await db.updateScene(sceneId, { master_image_prompt: generatedPromptText });
    } else {
      if (promptTarget.startsWith('seedance')) {
        shotUpdates.seedance_prompt = generatedPromptText;
      } else {
        shotUpdates.video_prompt = generatedPromptText;
      }

      const existingPrompts = await db.getVideoPromptsByShot(shot.id!);
      const existingMatch = existingPrompts.find((p) => p.prompt_target === promptTarget);
      if (existingMatch) {
        const updated = await db.saveSingleVideoPrompt({
          ...existingMatch,
          prompt_target: promptTarget,
          target_platform: targetPlatformName as any,
          timeline_json: {
            resolved_duration_sec: resolvedDuration,
            prompt: generatedPromptText,
            shot_breakdown: generatedPromptText,
          },
          negative_prompt: negativePromptText,
          version: newVersionNumber,
          id: existingMatch.id,
        });
        savedPrompts.push(updated);
      } else {
        const created = await db.saveSingleVideoPrompt({
          shot_id: shot.id!,
          scene_id: sceneId,
          project_id: projectId,
          prompt_target: promptTarget,
          target_platform: targetPlatformName as any,
          generation_type: 'prompt_target',
          timeline_json: {
            resolved_duration_sec: resolvedDuration,
            prompt: generatedPromptText,
            shot_breakdown: generatedPromptText,
          },
          negative_prompt: negativePromptText,
          version: newVersionNumber,
        } as any);
        savedPrompts.push(created);
      }
    }

    const updatedShot = await db.updateShot(shot.id!, shotUpdates);

    return res.json({
      success: true,
      target: promptTarget,
      deterministic: !usedAi,
      resolved_duration_sec: resolvedDuration,
      shot: updatedShot,
      scene,
      version: newPromptVersion,
      prompts: savedPrompts,
      lock_state: lockState,
    });
  } catch (err: any) {
    return sendPromptError(res, err, 'Gagal meregenerasi prompt secara cerdas.');
  }
});

// Update Shot (Consolidated: handles shot_image_url and all shot properties)
apiRouter.put('/shots/:id', async (req: Request, res: Response) => {
  try {
    const shotId = req.params.id;
    const existing = await db.getShot(shotId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Shot tidak ditemukan.' });
    }
    const updated = await db.updateShot(shotId, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Shot tidak ditemukan.' });
    }
    res.json({
      success: true,
      shot: updated,
      ...updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Video Prompt
apiRouter.put('/video-prompts/:id', async (req: Request, res: Response) => {
  try {
    const vpId = req.params.id;
    const updated = await db.saveSingleVideoPrompt({ ...req.body, id: vpId });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Regenerate / Retry Prompt for a single Shot & explicit PromptTarget
//
// PATCH 5.5-R1 FASE 4 — endpoint contract:
//   request -> parse target (400 INVALID_PROMPT_TARGET on anything unknown)
//           -> strict duration resolver (422 PROMPT_DURATION_CONTRACT_FAILED)
//           -> adapter -> validateProductionPromptContract
//              (422 PROMPT_CONTRACT_VALIDATION_FAILED)
//           -> ONLY THEN persist
// There is no fallback target and no duration coercion on this path.
apiRouter.post('/shots/:id/regenerate-prompt', async (req: Request, res: Response) => {
  // --- GATE 1: explicit target validation, before any generation or write ---
  let promptTarget: PromptTarget;
  let requestedDuration: number | undefined;
  try {
    // `target` is the 5.5 field; `platform` is the legacy field still sent by
    // the current UI and translated 1:1 (veo|gemini_omni|seedance, banana*).
    promptTarget = parsePromptTargetFromRequest(req.body?.target ?? req.body?.platform);
    requestedDuration = parseOptionalRequestedDuration(
      req.body?.requestedDuration ?? req.body?.duration_sec
    );
  } catch (err: any) {
    return sendPromptError(res, err, 'Target prompt tidak valid.');
  }

  try {
    const shotId = req.params.id;

    const shot = await db.getShot(shotId);
    if (!shot) {
      return res.status(404).json({ success: false, error: 'Shot tidak ditemukan.', code: 'SHOT_NOT_FOUND' });
    }

    const scene = await db.getScene(shot.scene_id);
    if (!scene) {
      return res.status(404).json({ success: false, error: 'Scene tidak ditemukan.', code: 'SCENE_NOT_FOUND' });
    }

    const projectId = shot.project_id;
    const [project, foundation, characters, locations, allSceneShots] = await Promise.all([
      db.getProject(projectId),
      db.getProjectFoundation(projectId),
      db.getCharacters(projectId),
      db.getLocations(projectId),
      db.getShotsByScene(shot.scene_id),
    ]);

    const shotIndex = allSceneShots.findIndex((s) => s.id === shotId);

    // --- GATE 2 + 3: strict duration + contract validation happen inside
    // Stage 8. Any failure throws BEFORE we reach the persistence block below,
    // so an invalid prompt can never be written. ---
    const stage8Result = await runStage8VideoPrompt({
      scene,
      shot,
      shotIndex: shotIndex >= 0 ? shotIndex : Math.max(0, shot.shot_number - 1),
      totalShotsInScene: allSceneShots.length || 1,
      masterFrameImageUrl: scene.master_frame_image_url,
      foundation,
      characters,
      locations,
      videoModels: project?.video_model || ['veo'],
      includeSeedance: !!project?.include_seedance_format,
      language: project?.prompt_language || 'id',
      model: project?.ai_model,
      reasoningConfig: project?.reasoning_config,
      target: promptTarget,
      requestedDuration,
    });

    // --- PERSIST (still targets): banana_* produce an image prompt, not a
    // VideoPrompt row, so they never pollute the video_prompts table. ---
    if (isStillPromptTarget(promptTarget)) {
      const still = stage8Result.stills.find((s) => s.target === promptTarget);
      if (!still) {
        // Defensive: Stage 8 must return a still for a still target.
        return res.status(500).json({
          success: false,
          error: `STILL_PROMPT_MISSING: Stage 8 tidak menghasilkan prompt untuk target "${promptTarget}".`,
          code: 'STILL_PROMPT_MISSING',
        });
      }

      const updatedShot = await db.updateShot(shotId, { master_image_prompt: still.prompt_text });
      return res.json({
        success: true,
        target: promptTarget,
        resolved_duration_sec: still.resolved_duration_sec,
        shot: updatedShot,
        master_image_prompt: still.prompt_text,
        stills: stage8Result.stills,
        prompts: await db.getVideoPromptsByShot(shotId),
      });
    }

    // --- PERSIST (video targets) ---
    //
    // FASE 5 FIX: the existing-row match MUST be keyed on the canonical
    // `prompt_target`, not on `target_platform`. Both `seedance_10` and
    // `seedance_30` map to the legacy column value `'seedance'`, so matching on
    // the column alone made the 30s prompt overwrite the 10s row (and vice
    // versa) — one shot could never hold both. `target_platform` remains the
    // legacy compatibility column; it is just no longer the identity key.
    const existingPrompts = await db.getVideoPromptsByShot(shotId);
    const savedPrompts: any[] = [];
    const shotUpdates: Partial<Shot> = {};

    for (const newPrompt of stage8Result.prompts) {
      const existingMatch = existingPrompts.find((p) =>
        p.prompt_target
          ? p.prompt_target === newPrompt.prompt_target
          : // Legacy row with no prompt_target: only claim it when the column is
            // unambiguous. `seedance` is ambiguous (10s vs 30s), so a legacy
            // seedance row is left alone and a new explicit row is created.
            p.target_platform === newPrompt.target_platform && p.target_platform !== 'seedance'
      );
      if (existingMatch) {
        const updated = await db.saveSingleVideoPrompt({
          ...existingMatch,
          ...newPrompt,
          id: existingMatch.id,
        });
        savedPrompts.push(updated);
      } else {
        const created = await db.saveSingleVideoPrompt({
          ...newPrompt,
          shot_id: shotId,
          scene_id: shot.scene_id,
          project_id: projectId,
          version: 1,
        } as any);
        savedPrompts.push(created);
      }

      if (newPrompt.target_platform === 'seedance') {
        shotUpdates.seedance_prompt = newPrompt.timeline_json?.shot_breakdown || newPrompt.timeline_json?.prompt;
      } else if (newPrompt.target_platform === 'veo') {
        shotUpdates.video_prompt = newPrompt.timeline_json?.prompt;
      }
    }

    if (Object.keys(shotUpdates).length > 0) {
      await db.updateShot(shotId, shotUpdates);
    }

    const finalShot = await db.getShot(shotId);

    res.json({
      success: true,
      target: promptTarget,
      resolved_duration_sec: stage8Result.prompts[0]?.timeline_json?.resolved_duration_sec,
      shot: finalShot,
      prompts: savedPrompts,
    });
  } catch (err: any) {
    // Class-based mapping: 400 invalid target, 422 duration/contract failure,
    // 500 otherwise. Always JSON. Nothing was persisted on these paths.
    return sendPromptError(res, err, 'Gagal meregenerate video prompt untuk shot ini.');
  }
});

// ===========================================================================
// PHASE 6: SMART REGENERATE ENDPOINT (Field Locks, Versioning, Contract Enforcement)
// ===========================================================================
apiRouter.post('/shots/:id/smart-regenerate', async (req: Request, res: Response) => {
  const shotId = req.params.id;
  try {
    const shot = await db.getShot(shotId);
    if (!shot) {
      return res.status(404).json({ success: false, error: 'Shot tidak ditemukan.', code: 'SHOT_NOT_FOUND' });
    }

    const scene = await db.getScene(shot.scene_id);
    if (!scene) {
      return res.status(404).json({ success: false, error: 'Scene tidak ditemukan.', code: 'SCENE_NOT_FOUND' });
    }

    const projectId = shot.project_id;
    const project = await db.getProject(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Proyek tidak ditemukan.', code: 'PROJECT_NOT_FOUND' });
    }

    // 1. Parse target & duration
    let promptTarget: PromptTarget;
    let requestedDuration: number | undefined;
    try {
      promptTarget = parsePromptTargetFromRequest(req.body?.target ?? req.body?.platform ?? shot.recommended_platform ?? 'veo');
      requestedDuration = parseOptionalRequestedDuration(
        req.body?.requestedDuration ?? req.body?.duration_sec ?? req.body?.requested_duration
      );
    } catch (err: any) {
      return sendPromptError(res, err, 'Target prompt tidak valid.');
    }

    const reason: PromptRegenerationReason | string = req.body?.reason || 'FULL';
    const requireAi = Boolean(req.body?.require_ai || req.body?.requireAi);
    const customInstructions = req.body?.custom_instructions || req.body?.customInstructions || '';

    // 2. Resolve lock state (merge shot.lock_state with incoming overrides)
    const inputLocks = req.body?.field_locks || req.body?.lock_state || {};
    const lockState: PromptLockState = {
      character_locked: inputLocks.character_locked !== undefined ? Boolean(inputLocks.character_locked) : (shot.lock_state?.character_locked ?? true),
      location_locked: inputLocks.location_locked !== undefined ? Boolean(inputLocks.location_locked) : (shot.lock_state?.location_locked ?? true),
      costume_locked: inputLocks.costume_locked !== undefined ? Boolean(inputLocks.costume_locked) : (shot.lock_state?.costume_locked ?? true),
      lighting_locked: inputLocks.lighting_locked !== undefined ? Boolean(inputLocks.lighting_locked) : (shot.lock_state?.lighting_locked ?? true),
      camera_locked: inputLocks.camera_locked !== undefined ? Boolean(inputLocks.camera_locked) : (shot.lock_state?.camera_locked ?? false),
      action_locked: inputLocks.action_locked !== undefined ? Boolean(inputLocks.action_locked) : (shot.lock_state?.action_locked ?? false),
      composition_locked: inputLocks.composition_locked !== undefined ? Boolean(inputLocks.composition_locked) : (shot.lock_state?.composition_locked ?? false),
    };

    const foundation = await db.getProjectFoundation(projectId);
    const characters = await db.getCharacters(projectId);
    const locations = await db.getLocations(projectId);
    const objects = await db.getObjects(projectId);
    const allSceneShots = await db.getShotsByScene(shot.scene_id);

    const isStill = isStillPromptTarget(promptTarget);
    const effectiveDuration = requestedDuration !== undefined
      ? requestedDuration
      : (shot.duration_sec && PROMPT_TARGET_SUPPORTED_DURATIONS[promptTarget]?.includes(shot.duration_sec)
          ? shot.duration_sec
          : (PROMPT_TARGET_SUPPORTED_DURATIONS[promptTarget]?.[0] ?? 10));
    const resolvedDuration = resolveOutputDurationStrict(promptTarget, effectiveDuration);

    let generatedPromptText = '';
    let negativePromptText = '';
    let usedAi = false;

    // Build unified masterData for both deterministic and AI routes (Phase 3.7M)
    const masterData = serializeMasterSceneData(
      scene,
      allSceneShots.length > 0 ? allSceneShots : [shot],
      foundation,
      characters,
      locations,
      objects,
      (promptTarget === 'omni' ? 'gemini_omni' : promptTarget.startsWith('seedance') ? 'seedance' : promptTarget.startsWith('banana') ? 'banana' : 'veo') as any,
      'cinematic',
      project.title || 'Cinematic Production',
      resolvedDuration
    );

    // Apply the merged lockState explicitly to masterData.continuity
    masterData.continuity.character_lock = lockState.character_locked;
    masterData.continuity.location_lock = lockState.location_locked;
    masterData.continuity.clothing_lock = lockState.costume_locked;
    masterData.continuity.lighting_lock = lockState.lighting_locked;
    masterData.continuity.camera_lock = lockState.camera_locked;
    masterData.continuity.composition_lock = lockState.composition_locked;

    if (!requireAi) {
      // --- DETERMINISTIC REGENERATION PATH (0 AI CALLS) ---
      // If user provided specific modification instruction for an unlocked dimension:
      if (reason === 'CAMERA' && !lockState.camera_locked && customInstructions) {
        masterData.camera.movement = customInstructions;
      } else if (reason === 'LIGHTING' && !lockState.lighting_locked && customInstructions) {
        masterData.lighting.atmosphere = customInstructions;
      }

      // Adapt to target
      if (promptTarget === 'banana_master_frame') {
        generatedPromptText = adaptBananaMasterFrame(masterData);
      } else if (promptTarget === 'banana_image') {
        generatedPromptText = adaptBananaImagePrompt(masterData);
      } else if (promptTarget === 'veo') {
        const adapted = adaptVeoVideoPrompt(masterData, allSceneShots);
        generatedPromptText = adapted.prompt;
      } else if (promptTarget === 'omni') {
        const adapted = adaptOmniVideoPrompt(masterData);
        generatedPromptText = adapted.prompt;
      } else if (promptTarget === 'seedance_10' || promptTarget === 'seedance_30') {
        const adapted = adaptSeedanceVideoPrompt(masterData);
        generatedPromptText = adapted.shot_breakdown;
      }

      negativePromptText = compileNegativePrompt(masterData);
    } else {
      // --- AI-REQUIRED REGENERATION PATH ---
      usedAi = true;
      const reasoningConfig = project.reasoning_config;

      const systemPrompt = `You are the SINEMA Production Prompt Engine.
You must regenerate a cinematic prompt for target: "${promptTarget}" (Duration: ${resolvedDuration}s).
STRICT IMMUTABLE FIELD LOCKS (DO NOT CHANGE THESE UNDER ANY CIRCUMSTANCES):
${lockState.character_locked ? '- CHARACTER: LOCKED. Character names, identities, appearance, and prophet restrictions MUST NOT BE CHANGED.' : '- Character: unlocked.'}
${lockState.location_locked ? '- LOCATION: LOCKED. Historical era, architecture, and environment MUST NOT BE CHANGED.' : '- Location: unlocked.'}
${lockState.costume_locked ? '- COSTUME: LOCKED. Attire and accessories MUST NOT BE CHANGED.' : '- Costume: unlocked.'}
${lockState.lighting_locked ? '- LIGHTING: LOCKED. Lighting scheme and color temperature MUST NOT BE CHANGED.' : '- Lighting: unlocked.'}
${lockState.camera_locked ? '- CAMERA: LOCKED. Camera angle, lens, focal length, depth of field, and camera movement MUST NOT BE CHANGED.' : '- Camera: unlocked.'}
${lockState.action_locked ? '- ACTION: LOCKED. Primary action beat MUST NOT BE CHANGED.' : '- Action: unlocked.'}
${lockState.composition_locked ? '- COMPOSITION: LOCKED. Layout grid, subject placement, visual balance, foreground layer, and spatial relationship MUST NOT BE CHANGED.' : '- Composition: unlocked.'}

Regeneration Reason: ${reason}
${customInstructions ? `Custom User Instructions: ${customInstructions}` : ''}
Scene: ${scene.scene_number}. ${scene.title}
Event: ${scene.event}
Shot #${shot.shot_number}: ${shot.character_action || shot.event_detail}

Format the prompt to match the strict ${promptTarget} schema. Do not use legacy @ tags or placeholders.`;

      const response = await executeTask({
        taskId: 'video_prompt_generation',
        stageCode: 'S8',
        systemInstruction: systemPrompt,
        prompt: `Generate the finalized prompt for ${promptTarget} adhering to all locked invariants.`,
        temperature: 0.2,
        reasoningConfig,
      });

      generatedPromptText = response.text?.trim() || '';
      negativePromptText = 'blurry, distorted, low quality, cartoon, cgi render, modern objects, text overlay';
    }

    // Validate prompt contract
    const contractValidation = validateProductionPromptContract(
      generatedPromptText,
      promptTarget,
      resolvedDuration,
      {
        sceneId: scene.id,
        shotId: shot.id,
        isProphetScene: scene.event?.toLowerCase().includes('rasulullah') || scene.character_names?.some((c) => c.toLowerCase().includes('rasulullah')),
        masterData,
      }
    );

    if (!contractValidation.valid) {
      return res.status(422).json({
        success: false,
        error: contractValidation.errorMessage || 'PROMPT_CONTRACT_VALIDATION_FAILED',
        code: 'PROMPT_CONTRACT_VALIDATION_FAILED',
        failedRules: contractValidation.failedRules,
      });
    }

    // 3. Non-destructive versioning
    const existingVersions: PromptVersion[] = shot.prompt_versions || [];
    const newVersionNumber = existingVersions.length + 1;
    const targetPlatformName = promptTarget.startsWith('seedance') ? 'seedance' : promptTarget === 'omni' ? 'gemini_omni' : 'veo';

    const newPromptVersion: PromptVersion = {
      version: newVersionNumber,
      prompt_type: isStill ? 'image' : 'video',
      target_platform: targetPlatformName,
      prompt_target: promptTarget,
      prompt_text: generatedPromptText,
      negative_prompt: negativePromptText,
      reason,
      lock_state: lockState,
      status: 'approved',
      created_at: new Date().toISOString(),
      created_by: usedAi ? 'gemini' : 'compiler',
    };

    const updatedVersions = [...existingVersions, newPromptVersion];
    const shotUpdates: Partial<Shot> = {
      lock_state: lockState,
      prompt_versions: updatedVersions,
      version: newVersionNumber,
    };

    let savedPrompts: any[] = [];
    if (isStill) {
      shotUpdates.master_image_prompt = generatedPromptText;
    } else {
      if (promptTarget.startsWith('seedance')) {
        shotUpdates.seedance_prompt = generatedPromptText;
      } else {
        shotUpdates.video_prompt = generatedPromptText;
      }

      const existingPrompts = await db.getVideoPromptsByShot(shotId);
      const existingMatch = existingPrompts.find((p) => p.prompt_target === promptTarget);
      if (existingMatch) {
        const updated = await db.saveSingleVideoPrompt({
          ...existingMatch,
          prompt_target: promptTarget,
          target_platform: targetPlatformName as any,
          timeline_json: {
            resolved_duration_sec: resolvedDuration,
            prompt: generatedPromptText,
            shot_breakdown: generatedPromptText,
          },
          negative_prompt: negativePromptText,
          version: newVersionNumber,
          id: existingMatch.id,
        });
        savedPrompts.push(updated);
      } else {
        const created = await db.saveSingleVideoPrompt({
          shot_id: shotId,
          scene_id: shot.scene_id,
          project_id: projectId,
          prompt_target: promptTarget,
          target_platform: targetPlatformName as any,
          generation_type: 'prompt_target',
          timeline_json: {
            resolved_duration_sec: resolvedDuration,
            prompt: generatedPromptText,
            shot_breakdown: generatedPromptText,
          },
          negative_prompt: negativePromptText,
          version: newVersionNumber,
        } as any);
        savedPrompts.push(created);
      }
    }

    const updatedShot = await db.updateShot(shotId, shotUpdates);

    return res.json({
      success: true,
      target: promptTarget,
      deterministic: !usedAi,
      resolved_duration_sec: resolvedDuration,
      shot: updatedShot,
      version: newPromptVersion,
      prompts: savedPrompts,
      lock_state: lockState,
    });
  } catch (err: any) {
    return sendPromptError(res, err, 'Gagal meregenerasi prompt secara cerdas.');
  }
});

// ===========================================================================
// PHASE 6: PRODUCTION PLANNING ENDPOINTS (Deterministic, 0 AI calls)
// ===========================================================================

// GET /projects/:id/production-plan
apiRouter.get('/projects/:id/production-plan', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id;
    const project = await db.getProject(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Proyek tidak ditemukan.' });
    }

    const foundation = await db.getProjectFoundation(projectId);
    const scenes = await db.getScenes(projectId);
    const characters = await db.getCharacters(projectId);
    const locations = await db.getLocations(projectId);
    const objects = await db.getObjects(projectId);
    const continuityStates = await db.getCharacterContinuityStates(projectId);
    const allShots = await db.getShotsByProject(projectId);

    const shotsMap: Record<string, Shot[]> = {};
    for (const scene of scenes) {
      shotsMap[scene.id] = allShots.filter((s) => s.scene_id === scene.id);
    }

    const allVideoPrompts = await db.getVideoPromptsByProject(projectId);
    const promptsMap: Record<string, any[]> = {};
    for (const shot of allShots) {
      if (shot.id) {
        promptsMap[shot.id] = allVideoPrompts.filter((v) => v.shot_id === shot.id);
      }
    }

    const userQuotaProfiles = project.quota_profiles || [];
    const productionMode = (project as any).production_mode || 'FLEXIBLE';

    const generationPlan = generateProductionPlan(
      project,
      scenes,
      shotsMap,
      promptsMap,
      continuityStates,
      userQuotaProfiles,
      productionMode
    );

    const readinessScore = calculateProductionReadiness(
      project,
      foundation,
      scenes,
      shotsMap,
      promptsMap,
      continuityStates,
      generationPlan
    );

    const estGeminiCalls = 5 + (scenes.length * 2) + allShots.length;
    const aiCallBudget: AICallBudget = {
      estimated_gemini_calls: estGeminiCalls,
      actual_gemini_calls: 0,
      estimated_retries: Math.ceil(scenes.length * 0.1),
      actual_retries: 0,
      input_tokens: 0,
      output_tokens: 0,
      cost_status: 'calculated',
      estimated_cost_usd: Number((estGeminiCalls * 0.002).toFixed(4)),
      stage_breakdown: {
        foundation: { calls: 5, retries: 0, tokens: 0 },
        scenes: { calls: scenes.length * 2, retries: 0, tokens: 0 },
        shots: { calls: allShots.length, retries: 0, tokens: 0 },
      },
    };

    res.json({
      success: true,
      generation_plan: generationPlan,
      production_readiness: readinessScore,
      recommended_platform_per_shot: generationPlan.individual_shots_plan.map((s) => ({
        shot_id: s.shot_id,
        scene_id: s.scene_id,
        recommended_platform: s.recommended_platform,
        generation_container_sec: s.generation_container_sec,
        usable_duration_sec: s.usable_duration_sec,
      })),
      quota_estimates: generationPlan.quota_estimates,
      sequence_merge_candidates: generationPlan.sequence_merge_candidates,
      readiness_score: readinessScore.total_score,
      readiness_rating: readinessScore.rating,
      warnings: readinessScore.warnings,
      blockers: readinessScore.blockers,
      ai_call_budget: aiCallBudget,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /projects/:id/sequence-candidates/evaluate
apiRouter.post('/projects/:id/sequence-candidates/evaluate', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id;
    const project = await db.getProject(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Proyek tidak ditemukan.' });
    }

    const scenes = await db.getScenes(projectId);
    const allShots = await db.getShotsByProject(projectId);
    const continuityStates = await db.getCharacterContinuityStates(projectId);

    const shotsMap: Record<string, Shot[]> = {};
    for (const scene of scenes) {
      shotsMap[scene.id] = allShots.filter((s) => s.scene_id === scene.id);
    }

    const candidates = evaluateSequenceMergeCandidates(scenes, shotsMap, continuityStates);

    res.json({
      success: true,
      candidates,
      total_candidates: candidates.length,
      evaluated_scenes_count: scenes.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /projects/:id/quota-profiles
apiRouter.post('/projects/:id/quota-profiles', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id;
    const project = await db.getProject(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Proyek tidak ditemukan.' });
    }

    const profilesPayload = req.body.quota_profiles || (Array.isArray(req.body) ? req.body : [req.body]);
    if (!Array.isArray(profilesPayload)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payload: quota_profiles must be an array of UserQuotaProfile objects.',
      });
    }

    const validatedProfiles: UserQuotaProfile[] = [];
    for (const p of profilesPayload) {
      if (!p.provider_id || typeof p.provider_id !== 'string') {
        return res.status(422).json({
          success: false,
          error: 'Validation failed: provider_id is required for each quota profile.',
        });
      }
      const daily = typeof p.daily_quota === 'number' && p.daily_quota >= 0 ? p.daily_quota : 100;
      const used = typeof p.used_quota === 'number' && p.used_quota >= 0 ? p.used_quota : 0;
      const cost = typeof p.cost_per_generation === 'number' && p.cost_per_generation > 0 ? p.cost_per_generation : 10;
      const remaining = Math.max(0, daily - used);
      const estGenerations = Math.floor(remaining / cost);

      validatedProfiles.push({
        provider_id: p.provider_id,
        display_name: p.display_name || p.provider_id.toUpperCase(),
        daily_quota: daily,
        used_quota: used,
        unit_name: p.unit_name || 'credits',
        cost_per_generation: cost,
        remaining_quota: remaining,
        estimated_usable_generations: estGenerations,
        reset_time: p.reset_time,
        notes: p.notes,
      });
    }

    const updated = await db.updateProject(projectId, (proj) => ({
      ...proj,
      quota_profiles: validatedProfiles,
    }));

    res.json({
      success: true,
      quota_profiles: validatedProfiles,
      project: updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===========================================================================
// PHASE 6: ASSET GRAPH & IMPACT ANALYSIS ENDPOINTS
// ===========================================================================

// GET /projects/:id/asset-graph
apiRouter.get('/projects/:id/asset-graph', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id;
    const project = await db.getProject(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Proyek tidak ditemukan.' });
    }

    const characters = await db.getCharacters(projectId);
    const locations = await db.getLocations(projectId);
    const objects = await db.getObjects(projectId);
    const scenes = await db.getScenes(projectId);
    const allShots = await db.getShotsByProject(projectId);

    const shotsMap: Record<string, Shot[]> = {};
    for (const scene of scenes) {
      shotsMap[scene.id] = allShots.filter((s) => s.scene_id === scene.id);
    }

    const graph = indexAssetGraph(characters, locations, objects, scenes, shotsMap);

    res.json({
      success: true,
      graph,
      nodes_count: Object.keys(graph.nodes).length,
      edges_count: graph.edges.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /projects/:id/asset-graph/impact/:assetId
apiRouter.get('/projects/:id/asset-graph/impact/:assetId', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id;
    const assetId = req.params.assetId;
    const project = await db.getProject(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Proyek tidak ditemukan.' });
    }

    const characters = await db.getCharacters(projectId);
    const locations = await db.getLocations(projectId);
    const objects = await db.getObjects(projectId);
    const scenes = await db.getScenes(projectId);
    const allShots = await db.getShotsByProject(projectId);
    const allVideoPrompts = await db.getVideoPromptsByProject(projectId);

    const shotsMap: Record<string, Shot[]> = {};
    for (const scene of scenes) {
      shotsMap[scene.id] = allShots.filter((s) => s.scene_id === scene.id);
    }

    const promptsMap: Record<string, any[]> = {};
    for (const shot of allShots) {
      if (shot.id) {
        promptsMap[shot.id] = allVideoPrompts.filter((v) => v.shot_id === shot.id);
      }
    }

    const graph = indexAssetGraph(characters, locations, objects, scenes, shotsMap);
    const impactAnalysis = generateAssetImpactAnalysis(graph, assetId, shotsMap, promptsMap);

    res.json({
      success: true,
      impact_analysis: impactAnalysis,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Regression test endpoints for Phase 6
apiRouter.get('/regression-tests/production-planner', (req: Request, res: Response) => {
  try {
    const results = runProductionPlannerRegressionTests();
    res.json({
      success: true,
      totalTests: results.length,
      passedTests: results.filter((r) => r.passed).length,
      results,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/regression-tests/asset-graph', (req: Request, res: Response) => {
  try {
    const results = runAssetGraphRegressionTests();
    res.json({
      success: true,
      totalTests: results.length,
      passedTests: results.filter((r) => r.passed).length,
      results,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Story Architecture Endpoints ---
apiRouter.get('/projects/:id/story-architecture', async (req: Request, res: Response) => {
  try {
    const arch = await db.getStoryArchitecture(req.params.id);
    if (!arch) {
      return res.status(404).json({ error: 'Story architecture tidak ditemukan.' });
    }
    res.json(arch);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/projects/:id/story-architecture', async (req: Request, res: Response) => {
  try {
    const saved = await db.saveStoryArchitecture({
      ...req.body,
      project_id: req.params.id,
    });
    res.json({ success: true, story_architecture: saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Continuity Engine Endpoints ---
apiRouter.get('/projects/:id/continuity-states', async (req: Request, res: Response) => {
  try {
    const states = await db.getCharacterContinuityStates(req.params.id);
    res.json(states);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/projects/:id/continuity-states', async (req: Request, res: Response) => {
  try {
    const saved = await db.saveCharacterContinuityStates(req.params.id, req.body.states || []);
    res.json({ success: true, states: saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/projects/:id/continuity-snapshot/:sceneNumber', async (req: Request, res: Response) => {
  try {
    const sceneNum = parseInt(req.params.sceneNumber, 10);
    const snap = await db.getContinuitySnapshot(req.params.id, sceneNum);
    res.json(snap || null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/projects/:id/costume-transition', async (req: Request, res: Response) => {
  try {
    const { character_name, transition } = req.body;
    if (!character_name || !transition) {
      return res.status(400).json({ error: 'character_name dan transition data wajib diisi.' });
    }
    const updatedStates = await db.recordApprovedCostumeTransition(req.params.id, character_name, transition);
    res.json({ success: true, states: updatedStates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/projects/:id/validate-duration', (req: Request, res: Response) => {
  try {
    const { projectDuration, timelineSceneDuration, model, durationMode, selectedExtendedDuration } = req.body;
    const validation = validateDurationCompatibility(
      projectDuration || 60,
      timelineSceneDuration || 10,
      model || 'veo',
      durationMode || 'match_scene',
      selectedExtendedDuration || 30
    );
    res.json(validation);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/projects/:id/convert-timeline', async (req: Request, res: Response) => {
  try {
    const { targetDuration } = req.body;
    const project = await db.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Proyek tidak ditemukan.' });
    }
    const scenes = await db.getScenes(req.params.id);
    const convertedScenes = convertTimelineForExtendedMode(scenes, targetDuration || 30);
    
    await db.saveScenes(req.params.id, convertedScenes);
    
    const updatedProj = {
      ...project,
      durationMode: 'extended' as const,
      selectedExtendedDuration: targetDuration || 30,
      timelineSceneDuration: targetDuration || 30,
      scene_duration_sec: targetDuration || 30,
    };
    await db.saveProject(updatedProj);

    res.json({ success: true, scenes: convertedScenes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/regression-tests/duration', (req: Request, res: Response) => {
  try {
    const results = runDurationArchitectureRegressionTests();
    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/regression-tests/prompt', (req: Request, res: Response) => {
  try {
    const results = runPromptEngineRegressionTests();
    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// SSE Live Stream for pipeline updates
apiRouter.get('/projects/:id/stream', async (req: Request, res: Response) => {
  const id = req.params.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  if (!sseClients[id]) {
    sseClients[id] = [];
  }
  sseClients[id].push(res);

  // Send current state
  const logs = await db.getLogs(id);
  const project = await db.getProject(id);
  res.write(`data: ${JSON.stringify({ type: 'init', project, logs })}\n\n`);

  const onClose = () => {
    sseClients[id] = (sseClients[id] || []).filter((c) => c !== res);
  };
  req.on('close', onClose);

  // Serverless-safe lifecycle. Vercel hard-caps a single function invocation at
  // 300s and requires the response to settle; a socket held open forever trips
  // that cap and yields "Task timed out after 300 seconds". We keep SSE for the
  // (short-lived) duration of an active pipeline run, then terminate cleanly.
  // A heartbeat detects dead/lost clients and prevents a stale socket from
  // pinning the invocation.
  let terminated = false;
  const terminate = () => {
    if (terminated) return;
    terminated = true;
    clearInterval(heartbeat);
    clearTimeout(watchdog);
    res.write(`data: ${JSON.stringify({ type: 'end', timestamp: new Date().toISOString() })}\n\n`);
    res.end();
    req.removeListener('close', onClose);
  };

  const heartbeat = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
    } catch {
      terminate();
    }
  }, 15000);

  // Safety cap: end the stream after a reasonable safety margin (15 minutes).
  // 60 seconds is too short for multi-scene generations and causes the front-end to disconnect and freeze.
  const watchdog = setTimeout(terminate, 15 * 60 * 1000);
});

