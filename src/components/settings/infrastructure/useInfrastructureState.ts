import { useState, useEffect, useCallback } from 'react';

export interface InfrastructureState {
  providers: any[];
  projects: any[];
  models: any[];
  routing: any;
  health: any;
  logs: any[];
  loading: boolean;
  isRefreshing: boolean;
  error: string | null;
  credentialsError: string | null;
}

const DEFAULT_MODELS = [
  {
    id: 'gemini-3.7-flash',
    providerId: 'google',
    displayName: 'Gemini 3.7 Flash',
    tier: 'flash',
    capabilities: ['text', 'vision', 'image', 'video'],
    enabled: true,
    contextWindow: 1048576,
  },
  {
    id: 'gemini-2.5-pro',
    providerId: 'google',
    displayName: 'Gemini 2.5 Pro',
    tier: 'pro',
    capabilities: ['text', 'vision', 'analysis'],
    enabled: true,
    contextWindow: 2097152,
  },
  {
    id: 'gemini-3.5-flash-lite',
    providerId: 'google',
    displayName: 'Gemini 3.5 Flash Lite',
    tier: 'lite',
    capabilities: ['text', 'fast'],
    enabled: true,
    contextWindow: 1048576,
  },
];

const DEFAULT_PROVIDERS = [
  {
    id: 'google',
    name: 'Google Generative AI',
    type: 'google-generative-ai',
    baseUrl: 'https://generativelanguage.googleapis.com',
    enabled: true,
    capabilities: { text: true, vision: true, image: true, video: true },
    credentials: 1,
  },
];

// Helper: fetch with strict timeout using AbortController
async function fetchWithTimeout(url: string, timeoutMs: number = 3500, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (err: any) {
    clearTimeout(id);
    throw err;
  }
}

// Global cached state and active subscribers for instant rendering & deduplication
let globalState: InfrastructureState = {
  providers: DEFAULT_PROVIDERS,
  projects: [],
  models: DEFAULT_MODELS,
  routing: {
    mode: 'AUTO (Quota-Aware Smart Router)',
    strategy: 'Weighted Health (40%) + Quota (30%) + Latency (20%) + Load Balance (10%)',
    intelligence: { healthy: 1, credentials: { total: 0, active: 0, healthy: 0 } },
  },
  health: {
    providers: { google: { status: 'live', availability: '99.9%' } },
    models: {},
    summary: { healthy: 1, credentials: { total: 0, active: 0, healthy: 0 } },
  },
  logs: [],
  loading: false, // Instant-render with initial fallback/cached data
  isRefreshing: false,
  error: null,
  credentialsError: null,
};

let hasInitiallyFetched = false;
let activeFetchPromise: Promise<void> | null = null;
const stateListeners = new Set<(state: InfrastructureState) => void>();

function notifyListeners() {
  stateListeners.forEach((listener) => {
    try {
      listener({ ...globalState });
    } catch {}
  });
}

async function performGlobalFetch(isSilent: boolean = false): Promise<void> {
  if (activeFetchPromise) {
    return activeFetchPromise;
  }

  globalState = {
    ...globalState,
    isRefreshing: isSilent,
    loading: !hasInitiallyFetched && globalState.projects.length === 0 && globalState.providers.length === 0,
  };
  notifyListeners();

  activeFetchPromise = (async () => {
    try {
      // Fetch all endpoints concurrently with strict 3.5s timeout per call
      const [providersResult, credentialsResult, intelligenceResult, modelsResult, logsResult] =
        await Promise.allSettled([
          fetchWithTimeout('/api/ai/providers', 3500).then(async (r) => (r.ok ? r.json() : null)),
          fetchWithTimeout('/api/ai/credentials', 3500).then(async (r) => {
            if (r.ok) return { data: await r.json(), error: null };
            const errBody = await r.json().catch(() => ({}));
            return { data: null, error: errBody.error || `HTTP ${r.status}` };
          }),
          fetchWithTimeout('/api/ai/intelligence', 3500).then(async (r) => (r.ok ? r.json() : null)),
          fetchWithTimeout('/api/ai/models', 3500).then(async (r) => (r.ok ? r.json() : null)),
          fetchWithTimeout('/api/ai/logs?limit=50', 3500).then(async (r) => (r.ok ? r.json() : null)),
        ]);

      const providersData = providersResult.status === 'fulfilled' ? providersResult.value : null;
      const credsOutcome =
        credentialsResult.status === 'fulfilled' ? credentialsResult.value : { data: null, error: 'Network timeout' };
      const intelligenceData =
        intelligenceResult.status === 'fulfilled' && intelligenceResult.value
          ? intelligenceResult.value
          : globalState.routing.intelligence || { healthy: 1 };
      const modelsData = modelsResult.status === 'fulfilled' ? modelsResult.value : null;
      const logsData = logsResult.status === 'fulfilled' ? logsResult.value : null;

      const resolvedProviders = Array.isArray(providersData)
        ? providersData
        : globalState.providers.length > 0
        ? globalState.providers
        : DEFAULT_PROVIDERS;

      const resolvedModels = Array.isArray(modelsData)
        ? modelsData
        : globalState.models.length > 0
        ? globalState.models
        : DEFAULT_MODELS;

      const resolvedCredentials =
        credsOutcome && Array.isArray(credsOutcome.data) ? credsOutcome.data : globalState.projects;

      const providerHealthMap: Record<string, any> = {};
      resolvedProviders.forEach((p: any) => {
        providerHealthMap[p.id || p.name] = {
          status: p.enabled !== false ? 'live' : 'disabled',
          availability: '99.9%',
        };
      });

      const modelHealthMap: Record<string, any> = {};
      resolvedModels.forEach((m: any) => {
        modelHealthMap[m.id] = { status: (intelligenceData.healthy ?? 1) > 0 ? 'healthy' : 'warning' };
      });

      globalState = {
        providers: resolvedProviders,
        projects: resolvedCredentials,
        models: resolvedModels,
        routing: {
          mode: 'AUTO (Quota-Aware Smart Router)',
          strategy: 'Weighted Health (40%) + Quota (30%) + Latency (20%) + Load Balance (10%)',
          intelligence: intelligenceData,
        },
        health: {
          providers: providerHealthMap,
          models: modelHealthMap,
          summary: intelligenceData,
        },
        logs: Array.isArray(logsData) ? logsData : globalState.logs,
        loading: false,
        isRefreshing: false,
        error: credsOutcome?.error || null,
        credentialsError: credsOutcome?.error || null,
      };
      hasInitiallyFetched = true;
    } catch (err: any) {
      globalState = {
        ...globalState,
        loading: false,
        isRefreshing: false,
        error: err.message || 'Background sync issue',
      };
    } finally {
      activeFetchPromise = null;
      notifyListeners();
    }
  })();

  return activeFetchPromise;
}

export function useInfrastructureState() {
  const [state, setState] = useState<InfrastructureState>(() => ({ ...globalState }));

  useEffect(() => {
    stateListeners.add(setState);
    // Trigger background fetch if not already done or if data is stale
    performGlobalFetch(hasInitiallyFetched);

    return () => {
      stateListeners.delete(setState);
    };
  }, []);

  const refresh = useCallback(async () => {
    return performGlobalFetch(true);
  }, []);

  const deleteModel = useCallback(
    async (id: string, providerId?: string) => {
      const url = providerId
        ? `/api/ai/models/${encodeURIComponent(id)}?providerId=${encodeURIComponent(providerId)}`
        : `/api/ai/models/${encodeURIComponent(id)}`;
      const res = await fetchWithTimeout(url, 5000, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to delete model' }));
        throw new Error(err.error || 'Failed to delete model');
      }
      await performGlobalFetch(true);
    },
    []
  );

  const bulkDeleteModels = useCallback(
    async (models: Array<{ id: string; providerId?: string }>) => {
      const res = await fetchWithTimeout('/api/ai/models/bulk-delete', 5000, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ models }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to bulk delete models' }));
        throw new Error(err.error || 'Failed to bulk delete models');
      }
      await performGlobalFetch(true);
    },
    []
  );

  const toggleModelEnabled = useCallback(
    async (id: string, enabled: boolean, providerId?: string) => {
      const res = await fetchWithTimeout(`/api/ai/models/${encodeURIComponent(id)}`, 5000, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, providerId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to update model' }));
        throw new Error(err.error || 'Failed to update model');
      }
      await performGlobalFetch(true);
    },
    []
  );

  const addModel = useCallback(
    async (modelData: any) => {
      const res = await fetchWithTimeout('/api/ai/models', 5000, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modelData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to add model' }));
        throw new Error(err.error || 'Failed to add model');
      }
      await performGlobalFetch(true);
    },
    []
  );

  const resetDefaultModels = useCallback(async () => {
    const res = await fetchWithTimeout('/api/ai/models/reset-defaults', 5000, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to reset models' }));
      throw new Error(err.error || 'Failed to reset models');
    }
    await performGlobalFetch(true);
  }, []);

  const clearLogs = useCallback(async () => {
    const res = await fetchWithTimeout('/api/ai/logs', 5000, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to clear logs' }));
      throw new Error(err.error || 'Failed to clear logs');
    }
    await performGlobalFetch(true);
  }, []);

  const runHealthCheckAll = useCallback(async () => {
    const res = await fetchWithTimeout('/api/ai/health/check-all', 8000, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to run health check' }));
      throw new Error(err.error || 'Failed to run health check');
    }
    const data = await res.json();
    await performGlobalFetch(true);
    return data;
  }, []);

  const deleteCredential = useCallback(async (id: string) => {
    const res = await fetchWithTimeout(`/api/ai/credentials/${encodeURIComponent(id)}`, 5000, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete credential' }));
      throw new Error(err.error || 'Failed to delete credential');
    }
    await performGlobalFetch(true);
  }, []);

  const bulkDeleteCredentials = useCallback(async (ids: string[]) => {
    const res = await fetchWithTimeout('/api/ai/credentials/bulk-delete', 5000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to bulk delete credentials' }));
      throw new Error(err.error || 'Failed to bulk delete credentials');
    }
    await performGlobalFetch(true);
  }, []);

  const deleteAllCredentials = useCallback(async () => {
    const res = await fetchWithTimeout('/api/ai/credentials/clear-all', 5000, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete all credentials' }));
      throw new Error(err.error || 'Failed to delete all credentials');
    }
    await performGlobalFetch(true);
  }, []);

  const deleteProvider = useCallback(async (id: string) => {
    const res = await fetchWithTimeout(`/api/ai/providers/${encodeURIComponent(id)}`, 5000, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete provider' }));
      throw new Error(err.error || 'Failed to delete provider');
    }
    await performGlobalFetch(true);
  }, []);

  const bulkDeleteProviders = useCallback(async (ids: string[]) => {
    const res = await fetchWithTimeout('/api/ai/providers/bulk-delete', 5000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to bulk delete providers' }));
      throw new Error(err.error || 'Failed to bulk delete providers');
    }
    await performGlobalFetch(true);
  }, []);

  const deleteAllProviders = useCallback(async (keepDefaultGoogle = false) => {
    const res = await fetchWithTimeout('/api/ai/providers/clear-all', 5000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keepDefaultGoogle }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete all providers' }));
      throw new Error(err.error || 'Failed to delete all providers');
    }
    await performGlobalFetch(true);
  }, []);

  const deleteAllProjects = useCallback(async () => {
    const res = await fetchWithTimeout('/api/ai/projects/clear-all', 5000, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete all projects' }));
      throw new Error(err.error || 'Failed to delete all projects');
    }
    await performGlobalFetch(true);
  }, []);

  const wipeAllInfrastructure = useCallback(async (options?: {
    wipeProjects?: boolean;
    wipeProviders?: boolean;
    wipeCredentials?: boolean;
    wipeModels?: boolean;
    wipeLogs?: boolean;
  }) => {
    const res = await fetchWithTimeout('/api/ai/infrastructure/wipe-all', 8000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to wipe infrastructure' }));
      throw new Error(err.error || 'Failed to wipe infrastructure');
    }
    await performGlobalFetch(true);
  }, []);

  return {
    ...state,
    refresh,
    deleteModel,
    bulkDeleteModels,
    toggleModelEnabled,
    addModel,
    resetDefaultModels,
    clearLogs,
    runHealthCheckAll,
    deleteCredential,
    bulkDeleteCredentials,
    deleteAllCredentials,
    deleteProvider,
    bulkDeleteProviders,
    deleteAllProviders,
    deleteAllProjects,
    wipeAllInfrastructure,
  };
}
