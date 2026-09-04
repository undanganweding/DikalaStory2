import fs from 'fs';
import path from 'path';
import { getGeminiAI, AVAILABLE_MODELS, resolveGeminiModel } from './gemini';
import { setProviderHealth } from './adaptive_router';

export type TaskType = 'historical_research' | 'story_writing' | 'scene_generation' | 'json_output' | 'research' | 'narrative' | 'scene' | 'general' | 'image' | 'tts';

export interface GeminiProjectCredential {
  project_id: string;
  api_key: string;
  provider: 'google_gemini';
  models_available: string[];
  quota: {
    rpm: number;
    tpm: number;
    rpd: number;
  };
  usage: {
    rpm_used: number;
    tokens_used: number;
    requests_today: number;
  };
  health: {
    status: 'healthy' | 'warning' | 'rate_limited' | 'error' | 'exhausted' | 'blocked';
    error_rate: number;
    success_rate: number;
    latency: number;
    model_health?: Record<string, { status: 'healthy' | 'warning' | 'rate_limited' | 'error' | 'exhausted' | 'blocked'; cooldown_until?: string }>;
  };
  priority: number;
  enabled: boolean;
  cooldown_until?: string;
  isLegacy?: boolean;
}

export interface GeminiRequestLog {
  time: string;
  task: string;
  project_used: string;
  model: string;
  tokens: number;
  latency: number;
  status: 'success' | 'fail';
}

const DATA_DIR = process.env.VERCEL ? path.join('/tmp', 'data') : path.join(process.cwd(), 'data');
const PROJECT_CREDENTIALS_FILE = path.join(DATA_DIR, 'gemini_projects.json');
const ROUTER_LOGS_FILE = path.join(DATA_DIR, 'gemini_router_logs.json');

export class GeminiProjectRouter {
  private static instance: GeminiProjectRouter;
  private projects: Map<string, GeminiProjectCredential> = new Map();
  private logs: GeminiRequestLog[] = [];
  private tokenBudgets: Record<string, { used: number, max: number }> = {
    'research': { used: 0, max: 50000 },
    'scene': { used: 0, max: 20000 },
    'narrative': { used: 0, max: 10000 },
    'general': { used: 0, max: 50000 },
    'historical_research': { used: 0, max: 50000 },
    'story_writing': { used: 0, max: 20000 },
    'scene_generation': { used: 0, max: 20000 },
    'json_output': { used: 0, max: 10000 }
  };

  private requestQueue: Array<() => void> = [];
  private isProcessingQueue = false;

  private constructor() {
    this.ensureDataDir();
    this.syncProjects();
    this.loadLogs();
  }

  public static getInstance(): GeminiProjectRouter {
    if (!GeminiProjectRouter.instance) {
      GeminiProjectRouter.instance = new GeminiProjectRouter();
    }
    return GeminiProjectRouter.instance;
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private syncProjects() {
    this.projects.clear();

    // Use dynamic import at runtime to avoid circular initialization
    import('./credential_manager').then(({ credentialManager }) => {
        const pool = credentialManager.listCredentials().filter((c: any) => c.provider === 'google' && c.status === 'active');
        
        for (const cred of pool) {
          const rawKey = credentialManager.getSecretKey(cred.id);
          if (rawKey) {
            this.projects.set(cred.id, {
              project_id: cred.id,
              api_key: rawKey,
              provider: 'google_gemini',
              models_available: AVAILABLE_MODELS.map(m => m.id),
              quota: { rpm: 100, tpm: 100000, rpd: 1500 },
              usage: { rpm_used: 0, tokens_used: 0, requests_today: 0 },
              health: { status: 'healthy', error_rate: 0, success_rate: 100, latency: 100 },
              priority: cred.priority,
              enabled: true
            });
          }
        }

        // 2. Fallback to legacy JSON if no projects loaded
        if (this.projects.size === 0 && fs.existsSync(PROJECT_CREDENTIALS_FILE)) {
          try {
            const raw = fs.readFileSync(PROJECT_CREDENTIALS_FILE, 'utf-8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((p: GeminiProjectCredential) => {
                p.isLegacy = true;
                this.projects.set(p.project_id, p);
              });
            }
          } catch (err) {
            console.error('[GeminiProjectRouter] Error loading legacy credentials:', err);
          }
        }
    }).catch(err => {
        console.error('Failed to load credentials:', err);
    });
  }

  private saveProjects() {
    try {
      const list = Array.from(this.projects.values());
      fs.writeFileSync(PROJECT_CREDENTIALS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('[GeminiProjectRouter] Error saving credentials:', err);
    }
  }

  private loadLogs() {
    if (!fs.existsSync(ROUTER_LOGS_FILE)) return;
    try {
      const raw = fs.readFileSync(ROUTER_LOGS_FILE, 'utf-8');
      this.logs = JSON.parse(raw);
    } catch (err) {
      console.error('[GeminiProjectRouter] Error loading logs:', err);
    }
  }

  private saveLogs() {
    try {
      // Keep only last 1000 logs
      if (this.logs.length > 1000) {
        this.logs = this.logs.slice(this.logs.length - 1000);
      }
      fs.writeFileSync(ROUTER_LOGS_FILE, JSON.stringify(this.logs, null, 2), 'utf-8');
    } catch (err) {
      console.error('[GeminiProjectRouter] Error saving logs:', err);
    }
  }

  public addProject(project: GeminiProjectCredential) {
    this.projects.set(project.project_id, project);
    this.saveProjects();
  }

  public updateProject(projectId: string, updates: Partial<GeminiProjectCredential>) {
    const existing = this.projects.get(projectId);
    if (existing) {
      this.projects.set(projectId, { ...existing, ...updates });
      this.saveProjects();
    } else {
      throw new Error(`Project ${projectId} not found`);
    }
  }

  public removeProject(projectId: string) {
    this.projects.delete(projectId);
    this.saveProjects();
  }

  public clearProjects() {
    this.projects.clear();
    this.saveProjects();
  }

  public async testProject(projectId: string) {
    const project = this.projects.get(projectId);
    if (!project) throw new Error('Project not found');
    try {
        const ai = getGeminiAI(project.api_key);
        const startTime = Date.now();
        await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: 'ping'
        });
        const latency = Date.now() - startTime;
        
        project.health.status = 'healthy';
        project.health.latency = latency;
        project.health.success_rate = Math.min(100, project.health.success_rate + 5);
        this.saveProjects();
        return { success: true, latency };
    } catch (err: any) {
        project.health.status = 'error';
        project.health.error_rate += 10;
        project.health.success_rate = Math.max(0, project.health.success_rate - 10);
        this.saveProjects();
        return { success: false, message: err.message };
    }
  }

  public getProject(projectId: string): GeminiProjectCredential | undefined {
    return this.projects.get(projectId);
  }

  public listProjects(): GeminiProjectCredential[] {
    return Array.from(this.projects.values());
  }

  // PROJECT DISCOVERY
  public async discoverAndValidateAll() {
    console.log('--- Gemini Credential Pool Discovery ---');
    for (const [id, project] of this.projects.entries()) {
      try {
        const ai = getGeminiAI(project.api_key);
        const startTime = Date.now();
        await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: 'ping'
        });
        const latency = Date.now() - startTime;
        
        project.health.status = 'healthy';
        project.health.latency = latency;
        project.health.success_rate = Math.min(100, project.health.success_rate + 5);
        
        console.log(`Project: ${project.project_id}`);
        console.log(`Status: ${project.health.status}`);
        console.log(`Available Models: ${project.models_available.join(', ')}`);
        console.log(`Latency: ${latency}ms`);
        console.log('---------------------------------');
      } catch (err: any) {
        project.health.status = 'error';
        project.health.error_rate += 10;
        project.health.success_rate = Math.max(0, project.health.success_rate - 10);
        console.log(`Project: ${project.project_id}`);
        console.log(`Status: ERROR (${err.message})`);
        console.log('---------------------------------');
      }
    }
    this.saveProjects();
  }

  // HEALTH SCORING SYSTEM
  private calculateHealthScore(project: GeminiProjectCredential, task: TaskType, modelId: string): number {
    const quotaAvailability = project.quota.rpm > 0 ? (1 - (project.usage.rpm_used / project.quota.rpm)) * 100 : 100;
    
    // Factor in model health
    let modelHealthScore = 100;
    if (project.health.model_health && project.health.model_health[modelId]) {
        const mh = project.health.model_health[modelId];
        if (mh.status === 'rate_limited') modelHealthScore = 20; // Penalize rate-limited model
        else if (mh.status === 'error' || mh.status === 'exhausted') modelHealthScore = 0;
    }
    
    const successRate = project.health.success_rate;
    const latencyScore = Math.max(0, 100 - (project.health.latency / 50)); 
    
    let compatibilityScore = 50;
    if (task === 'historical_research' || task === 'research') compatibilityScore = 100;
    else if (task === 'story_writing' || task === 'narrative') compatibilityScore = 90;
    else if (task === 'scene_generation' || task === 'scene') compatibilityScore = 85;
    else if (task === 'json_output') compatibilityScore = 95;

    return (quotaAvailability * 0.3) + (modelHealthScore * 0.3) + (successRate * 0.2) + (latencyScore * 0.1) + (compatibilityScore * 0.1);
  }

  // RATE LIMIT PROTECTION
  private checkRateLimits(project: GeminiProjectCredential) {
    if (project.quota.rpm > 0 && project.usage.rpm_used >= project.quota.rpm) {
      project.health.status = 'blocked';
    } else if (project.quota.rpd > 0 && project.usage.requests_today >= project.quota.rpd) {
      project.health.status = 'blocked';
    } else if (project.quota.rpm > 0 && (project.usage.rpm_used / project.quota.rpm) > 0.8) {
      project.health.status = 'warning';
    } else if (project.quota.rpd > 0 && (project.usage.requests_today / project.quota.rpd) > 0.8) {
      project.health.status = 'warning';
    } else if (project.health.status === 'warning') {
       project.health.status = 'healthy';
    }
  }

  public getBestProjects(task: TaskType, modelId: string): GeminiProjectCredential[] {
    const now = new Date();
    
    // Filter and sort candidate projects
    const resolvedModelId = resolveGeminiModel(modelId);
    const candidates = Array.from(this.projects.values()).filter(p => {
      if (!p.enabled) return false;
      if (p.models_available.length > 0) {
        const matches = p.models_available.includes(modelId) || 
                        p.models_available.includes(resolvedModelId) ||
                        p.models_available.includes('gemini-3.8-flash');
        if (!matches) return false;
      }
      
      // Check model-specific health
      if (p.health.model_health && (p.health.model_health[modelId] || p.health.model_health[resolvedModelId])) {
          const modelHealth = p.health.model_health[modelId] || p.health.model_health[resolvedModelId];
          if ((modelHealth.status === 'rate_limited' || modelHealth.status === 'exhausted' || modelHealth.status === 'error' || modelHealth.status === 'blocked') &&
              modelHealth.cooldown_until && new Date(modelHealth.cooldown_until) > now) {
              return false;
          }
      }

      // Check overall project health (only blocked or auth-error projects are filtered out)
      if (p.health.status === 'error' || p.health.status === 'blocked') {
        if (p.cooldown_until && new Date(p.cooldown_until) > now) {
          return false;
        }
      }
      
      this.checkRateLimits(p);
      if ((p.health.status as string) === 'blocked') return false;
      
      return true;
    });

    // Sort by Health Score based on task
    candidates.sort((a, b) => {
      const scoreA = this.calculateHealthScore(a, task, modelId);
      const scoreB = this.calculateHealthScore(b, task, modelId);
      return scoreB - scoreA; // Highest score first
    });

    // Deduplicate candidates by API Key identity so 1 API Key = 1 failover candidate
    const uniqueCandidates: GeminiProjectCredential[] = [];
    const seenKeys = new Set<string>();
    for (const p of candidates) {
      const keyIdentity = p.api_key ? p.api_key.trim() : p.project_id;
      if (!seenKeys.has(keyIdentity)) {
        seenKeys.add(keyIdentity);
        uniqueCandidates.push(p);
      }
    }

    if (uniqueCandidates.length === 0) {
        // Last resort: return all projects that were filtered out only due to cooldowns, 
        // prioritizing those with the earliest cooldown expiration, deduplicated by API key identity.
        const cooledDownCandidates: GeminiProjectCredential[] = [];
        const cooledSeenKeys = new Set<string>();
        
        const rawCooled = Array.from(this.projects.values()).filter(p => {
            if (!p.enabled) return false;
            if (p.models_available.length > 0 && !p.models_available.includes(modelId)) return false;
            
            // Allow if it was only filtered by cooldown
            return true;
        }).sort((a, b) => {
            const getCooldown = (p: GeminiProjectCredential) => {
                const mh = p.health.model_health?.[modelId];
                if (mh?.cooldown_until) return new Date(mh.cooldown_until).getTime();
                if (p.cooldown_until) return new Date(p.cooldown_until).getTime();
                return 0;
            };
            return getCooldown(a) - getCooldown(b);
        });

        for (const p of rawCooled) {
          const keyIdentity = p.api_key ? p.api_key.trim() : p.project_id;
          if (!cooledSeenKeys.has(keyIdentity)) {
            cooledSeenKeys.add(keyIdentity);
            cooledDownCandidates.push(p);
          }
        }
        
        console.log(`[DEBUG] getBestProjects: No healthy candidates, falling back to cooled down projects. candidates=${cooledDownCandidates.map(p => p.project_id).join(',')}`);
        return cooledDownCandidates;
    }

    console.log(`[DEBUG] getBestProjects: candidates=${uniqueCandidates.map(p => p.project_id).join(',')}`);
    return uniqueCandidates;
  }


  // QUEUE MANAGER
  public async queueRequest<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const task = this.requestQueue.shift();
      if (task) {
        await task();
        // Simple rate limiting (wait 100ms between requests)
        await new Promise(r => setTimeout(r, 100));
      }
    }
    
    this.isProcessingQueue = false;
  }

  public recordUsageAndLog(projectId: string, task: string, model: string, tokens: number, latency: number, status: 'success' | 'fail', err?: any) {
    const project = this.projects.get(projectId);
    
    // Logging
    this.logs.push({
      time: new Date().toISOString(),
      task,
      project_used: projectId,
      model,
      tokens,
      latency,
      status
    });
    this.saveLogs();

    if (!project) return;
    
    if (status === 'success') {
      project.usage.tokens_used += tokens;
      project.usage.requests_today += 1;
      project.usage.rpm_used += 1;
      
      // Token Budget
      const budgetCategory = Object.keys(this.tokenBudgets).find(k => task.includes(k)) || 'general';
      if (this.tokenBudgets[budgetCategory]) {
        this.tokenBudgets[budgetCategory].used += tokens;
      }
      
      project.health.success_rate = Math.min(100, project.health.success_rate + 1);
      
      // Update running latency average (simple EMA)
      project.health.latency = (project.health.latency * 0.8) + (latency * 0.2);
    } else {
      project.health.error_rate += 1;
      project.health.success_rate = Math.max(0, project.health.success_rate - 5);
      
      this.reportError(projectId, model, err);
    }
    
    this.checkRateLimits(project);
    this.saveProjects();
  }

  private reportError(projectId: string, modelId: string, error: any) {
    const project = this.projects.get(projectId);
    if (!project) return;
    
    // Initialize model_health if not present
    if (!project.health.model_health) {
        project.health.model_health = {};
    }
    
    const errMsg = error?.message?.toLowerCase() || '';

    // Extract retry delay from error message or details if provided by Google API
    let parsedDelayMs: number | null = null;
    const retryMatch = errMsg.match(/retry in ([\d\.]+)s/i) || errMsg.match(/retry after ([\d\.]+)s/i);
    if (retryMatch && retryMatch[1]) {
      const sec = parseFloat(retryMatch[1]);
      if (!isNaN(sec) && sec > 0) parsedDelayMs = Math.ceil(sec * 1000);
    } else if (error?.details && Array.isArray(error.details)) {
      const retryInfo = error.details.find((d: any) => d['@type']?.includes('RetryInfo') || d?.retryDelay);
      if (retryInfo?.retryDelay) {
        const sec = parseInt(String(retryInfo.retryDelay), 10);
        if (!isNaN(sec) && sec > 0) parsedDelayMs = sec * 1000;
      }
    }

    let status: 'healthy' | 'warning' | 'rate_limited' | 'error' | 'exhausted' | 'blocked' = 'error';
    let cooldownUntil: string | undefined;

    if (errMsg.includes('429') || errMsg.includes('rate limit') || errMsg.includes('quota') || errMsg.includes('resource_exhausted') || errMsg.includes('resource exhausted')) {
      status = 'rate_limited';
      const delayMs = parsedDelayMs ? Math.min(parsedDelayMs + 2000, 5 * 60 * 1000) : 60 * 1000;
      cooldownUntil = new Date(Date.now() + delayMs).toISOString();
      setProviderHealth('google', modelId, 'rate_limited', 'RATE_LIMITED', Date.now() + delayMs);
      // Keep overall project in warning rather than exhausted so other models remain usable
      project.health.status = 'warning';
    } else if (errMsg.includes('503') || errMsg.includes('unavailable') || errMsg.includes('high demand') || errMsg.includes('overloaded')) {
      status = 'rate_limited';
      const delayMs = parsedDelayMs ? Math.min(parsedDelayMs + 2000, 5 * 60 * 1000) : 5 * 60 * 1000;
      cooldownUntil = new Date(Date.now() + delayMs).toISOString();
      setProviderHealth('google', modelId, 'rate_limited', 'OVERLOADED', Date.now() + delayMs);
      project.health.status = 'warning';
    } else if (errMsg.includes('auth') || errMsg.includes('key') || errMsg.includes('unauthorized') || errMsg.includes('permission_denied') || errMsg.includes('401') || errMsg.includes('403')) {
      status = 'error';
      project.health.status = 'error';
      project.cooldown_until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    } else {
      if (project.health.error_rate > 5) {
        status = 'error';
        cooldownUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      }
    }
    
    project.health.model_health[modelId] = { status, cooldown_until: cooldownUntil };
  }

  public getLogs(): GeminiRequestLog[] {
    return this.logs;
  }
}

export const geminiProjectRouter = GeminiProjectRouter.getInstance();

// Trigger discovery at startup if needed (can be called from server initialization)
// geminiProjectRouter.discoverAndValidateAll();
