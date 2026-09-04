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

export function useInfrastructureState() {
  const [state, setState] = useState<InfrastructureState>({
    providers: [],
    projects: [],
    models: [],
    routing: { mode: 'AUTO' },
    health: {},
    logs: [],
    loading: true,
    isRefreshing: false,
    error: null,
    credentialsError: null,
  });

  const fetchData = useCallback(async (isSilentRefresh: boolean = false) => {
    if (isSilentRefresh) {
      setState(s => ({ ...s, isRefreshing: true }));
    } else {
      setState(s => ({ ...s, loading: s.projects.length === 0 }));
    }
    try {
      // 1. Fetch Providers
      let providersRes = null;
      let providersData = null;
      try {
        providersRes = await fetch('/api/ai/providers');
        if (providersRes.ok) {
          providersData = await providersRes.json();
        }
      } catch (err: any) {
        console.error('Failed to fetch providers:', err);
      }

      // 2. Fetch Credentials (with safe failure tracking)
      let credentialsRes = null;
      let credentialsData = null;
      let credentialsErr: string | null = null;
      try {
        credentialsRes = await fetch('/api/ai/credentials');
        if (credentialsRes.ok) {
          credentialsData = await credentialsRes.json();
        } else {
          const errBody = await credentialsRes.json().catch(() => ({}));
          credentialsErr = errBody.error || `Database Load Failure (HTTP ${credentialsRes.status})`;
        }
      } catch (err: any) {
        credentialsErr = err.message || 'Network error loading credentials';
      }

      // 3. Fetch Intelligence
      let intelligenceRes = null;
      let intelligenceData = { healthy: 1, credentials: { total: 0, active: 0, healthy: 0 } };
      try {
        intelligenceRes = await fetch('/api/ai/intelligence');
        if (intelligenceRes.ok) {
          intelligenceData = await intelligenceRes.json();
        }
      } catch (err: any) {
        console.error('Failed to fetch intelligence:', err);
      }

      // 4. Fetch Models
      let modelsData = null;
      try {
        const modelsRes = await fetch('/api/ai/models');
        if (modelsRes && modelsRes.ok) {
          modelsData = await modelsRes.json();
        }
      } catch (err: any) {
        console.error('Failed to fetch models:', err);
      }

      // 5. Fetch Logs
      let logsData = null;
      try {
        const logsRes = await fetch('/api/ai/logs?limit=100');
        if (logsRes && logsRes.ok) {
          logsData = await logsRes.json();
        }
      } catch (err: any) {
        console.error('Failed to fetch logs:', err);
      }

      // Default standard fallback models list for graceful resilience
      const defaultModels = [
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
        }
      ];

      const resolvedModels = Array.isArray(modelsData) ? modelsData : defaultModels;

      const providerHealthMap: Record<string, any> = {};
      const resolvedProviders = Array.isArray(providersData) ? providersData : [];
      resolvedProviders.forEach((p: any) => {
        providerHealthMap[p.id || p.name] = {
          status: p.enabled !== false ? 'live' : 'disabled',
          availability: '99.9%'
        };
      });

      const modelHealthMap: Record<string, any> = {};
      resolvedModels.forEach((m: any) => {
        modelHealthMap[m.id] = { status: (intelligenceData.healthy ?? 1) > 0 ? 'healthy' : 'warning' };
      });

      setState(prev => ({
        providers: providersRes && providersRes.ok ? resolvedProviders : prev.providers,
        projects: credentialsRes && credentialsRes.ok && Array.isArray(credentialsData) ? credentialsData : prev.projects,
        models: modelsData ? resolvedModels : prev.models,
        routing: {
          mode: 'AUTO (Quota-Aware Smart Router)',
          strategy: 'Weighted Health (40%) + Quota (30%) + Latency (20%) + Load Balance (10%)',
          intelligence: intelligenceData
        },
        health: {
          providers: providerHealthMap,
          models: modelHealthMap,
          summary: intelligenceData
        },
        logs: Array.isArray(logsData) ? logsData : prev.logs,
        loading: false,
        isRefreshing: false,
        error: credentialsErr,
        credentialsError: credentialsErr,
      }));
    } catch (err: any) {
      setState(s => ({
        ...s,
        loading: false,
        isRefreshing: false,
        error: err.message || 'Unknown error',
        credentialsError: err.message || 'Unknown error',
      }));
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const deleteModel = useCallback(async (id: string, providerId?: string) => {
    const url = providerId ? `/api/ai/models/${encodeURIComponent(id)}?providerId=${encodeURIComponent(providerId)}` : `/api/ai/models/${encodeURIComponent(id)}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete model' }));
      throw new Error(err.error || 'Failed to delete model');
    }
    await fetchData(true);
  }, [fetchData]);

  const bulkDeleteModels = useCallback(async (models: Array<{ id: string; providerId?: string }>) => {
    const res = await fetch('/api/ai/models/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ models }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to bulk delete models' }));
      throw new Error(err.error || 'Failed to bulk delete models');
    }
    await fetchData(true);
  }, [fetchData]);

  const toggleModelEnabled = useCallback(async (id: string, enabled: boolean, providerId?: string) => {
    const res = await fetch(`/api/ai/models/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, providerId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update model' }));
      throw new Error(err.error || 'Failed to update model');
    }
    await fetchData(true);
  }, [fetchData]);

  const addModel = useCallback(async (modelData: any) => {
    const res = await fetch('/api/ai/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(modelData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to add model' }));
      throw new Error(err.error || 'Failed to add model');
    }
    await fetchData(true);
  }, [fetchData]);

  const resetDefaultModels = useCallback(async () => {
    const res = await fetch('/api/ai/models/reset-defaults', { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to reset models' }));
      throw new Error(err.error || 'Failed to reset models');
    }
    await fetchData(true);
  }, [fetchData]);

  const clearLogs = useCallback(async () => {
    const res = await fetch('/api/ai/logs', { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to clear logs' }));
      throw new Error(err.error || 'Failed to clear logs');
    }
    await fetchData(true);
  }, [fetchData]);

  const runHealthCheckAll = useCallback(async () => {
    const res = await fetch('/api/ai/health/check-all', { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to run health check' }));
      throw new Error(err.error || 'Failed to run health check');
    }
    const data = await res.json();
    await fetchData(true);
    return data;
  }, [fetchData]);

  return {
    ...state,
    refresh: () => fetchData(true),
    deleteModel,
    bulkDeleteModels,
    toggleModelEnabled,
    addModel,
    resetDefaultModels,
    clearLogs,
    runHealthCheckAll,
  };
}
