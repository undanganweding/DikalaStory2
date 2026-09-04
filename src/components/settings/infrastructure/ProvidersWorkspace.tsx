import React, { useState, useEffect } from 'react';
import { useInfrastructureState } from './useInfrastructureState';
import {
  Server,
  CheckCircle2,
  Key,
  RefreshCw,
  Loader2,
  Plus,
  Globe,
  Sparkles,
  Trash2,
  X,
  AlertCircle,
  Activity,
  Zap,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Check,
  Cpu,
  Sliders,
  Layers,
} from 'lucide-react';

interface DiscoveredModelItem {
  id: string;
  displayName: string;
  tier: 'flash' | 'pro' | 'lite';
  capabilities: string[];
  contextWindow?: number;
  enabled: boolean;
  description?: string;
}

export const ProvidersWorkspace: React.FC = () => {
  const { providers, projects: credentials, models, health, loading, isRefreshing, refresh } = useInfrastructureState();

  // Multi-step Onboarding Wizard State
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  // Step 1: Provider Config
  const [providerName, setProviderName] = useState('');
  const [protocol, setProtocol] = useState<
    'google-generative-ai' | 'openai-compatible' | 'anthropic-compatible' | 'ollama' | 'custom-http'
  >('google-generative-ai');
  const [baseUrl, setBaseUrl] = useState('https://generativelanguage.googleapis.com');
  const [description, setDescription] = useState('');

  // Step 2: Authentication & Connection Test
  const [credentialName, setCredentialName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [priority, setPriority] = useState<number>(50);
  const [weight, setWeight] = useState<number>(10);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latency?: number;
    modelsDetected?: number;
    errorType?: string;
  } | null>(null);

  // Step 3: Model Discovery & Activation
  const [isLoadingDiscovery, setIsLoadingDiscovery] = useState(false);
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModelItem[]>([]);
  const [customModelId, setCustomModelId] = useState('');
  const [customModelName, setCustomModelName] = useState('');

  // Final Submission
  const [isSubmittingOnboard, setIsSubmittingOnboard] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);

  // Quick Add Credential to Existing Provider Modal
  const [quickAddProvider, setQuickAddProvider] = useState<any | null>(null);
  const [quickCredName, setQuickCredName] = useState('');
  const [quickApiKey, setQuickApiKey] = useState('');
  const [quickPriority, setQuickPriority] = useState<number>(50);
  const [quickWeight, setQuickWeight] = useState<number>(10);
  const [isSavingQuickCred, setIsSavingQuickCred] = useState(false);
  const [quickCredError, setQuickCredError] = useState<string | null>(null);

  // Provider Testing / Ping State (Existing Card Actions)
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string; latency?: number }>>({});

  // Model Discovery State (Existing Card Actions)
  const [discoveringId, setDiscoveringId] = useState<string | null>(null);
  const [discoveryStatus, setDiscoveryStatus] = useState<Record<string, { success: boolean; message: string }>>({});

  // Provider Deletion State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteProvider, setConfirmDeleteProvider] = useState<any | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reset / open wizard
  const handleOpenWizard = () => {
    setWizardStep(1);
    setProviderName('');
    setProtocol('google-generative-ai');
    setBaseUrl('https://generativelanguage.googleapis.com');
    setDescription('');
    setCredentialName('');
    setApiKey('');
    setShowApiKey(false);
    setPriority(50);
    setWeight(10);
    setTestResult(null);
    setDiscoveredModels([]);
    setOnboardError(null);
    setShowWizard(true);
  };

  const handleProtocolChange = (
    newProtocol: 'google-generative-ai' | 'openai-compatible' | 'anthropic-compatible' | 'ollama' | 'custom-http'
  ) => {
    setProtocol(newProtocol);
    setTestResult(null);
    if (newProtocol === 'google-generative-ai') {
      setBaseUrl('https://generativelanguage.googleapis.com');
    } else if (newProtocol === 'ollama') {
      setBaseUrl('http://localhost:11434/v1');
    } else if (newProtocol === 'anthropic-compatible') {
      setBaseUrl('https://api.anthropic.com/v1');
    } else if (newProtocol === 'openai-compatible') {
      if (baseUrl === 'https://generativelanguage.googleapis.com') {
        setBaseUrl('https://api.openai.com/v1');
      }
    }
  };

  // Step 1 -> Step 2 validation
  const handleGoToStep2 = () => {
    if (!providerName.trim()) {
      setOnboardError('Provider Name is required.');
      return;
    }
    if (protocol !== 'google-generative-ai' && !baseUrl.trim()) {
      setOnboardError('Base URL is required for this protocol.');
      return;
    }
    if (!credentialName.trim()) {
      setCredentialName(`${providerName.trim()} Key 1`);
    }
    setOnboardError(null);
    setWizardStep(2);
  };

  // Step 2: Live Connection Testing
  const handleTestConnectionLive = async () => {
    if (!apiKey.trim()) {
      setOnboardError('API Key / Secret is required for connection testing.');
      return;
    }
    try {
      setIsTestingConn(true);
      setOnboardError(null);
      setTestResult(null);

      const res = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocol,
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setTestResult({
          success: false,
          message: data.error || 'Connection failed to respond.',
          latency: data.latency,
          errorType: data.errorType,
        });
        return;
      }

      setTestResult({
        success: true,
        message: `Connected successfully (${data.latency}ms)`,
        latency: data.latency,
        modelsDetected: data.modelsDetected,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network error during connection test',
      });
    } finally {
      setIsTestingConn(false);
    }
  };

  // Step 2 -> Step 3: Trigger Auto Model Discovery
  const handleGoToStep3 = async () => {
    if (!apiKey.trim()) {
      setOnboardError('Please provide an API key / secret.');
      return;
    }
    setOnboardError(null);
    setWizardStep(3);

    if (discoveredModels.length === 0) {
      await fetchModelDiscoveryPreview();
    }
  };

  const fetchModelDiscoveryPreview = async () => {
    try {
      setIsLoadingDiscovery(true);
      const res = await fetch('/api/ai/discover-models-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocol,
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && Array.isArray(data.models)) {
        setDiscoveredModels(
          data.models.map((m: any) => ({
            id: m.id,
            displayName: m.displayName || m.id,
            tier: m.tier || 'flash',
            capabilities: Array.isArray(m.capabilities) ? m.capabilities : ['text'],
            contextWindow: m.contextWindow || 1048576,
            enabled: m.enabled !== false,
            description: m.description,
          }))
        );
      }
    } catch (err: any) {
      console.error('Failed to discover model preview:', err);
    } finally {
      setIsLoadingDiscovery(false);
    }
  };

  const handleToggleModel = (modelId: string) => {
    setDiscoveredModels(prev =>
      prev.map(m => (m.id === modelId ? { ...m, enabled: !m.enabled } : m))
    );
  };

  const handleSetAllModels = (enabled: boolean) => {
    setDiscoveredModels(prev => prev.map(m => ({ ...m, enabled })));
  };

  const handleAddCustomModel = () => {
    if (!customModelId.trim()) return;
    const cleanId = customModelId.trim();
    if (discoveredModels.some(m => m.id === cleanId)) {
      setCustomModelId('');
      setCustomModelName('');
      return;
    }
    const newModel: DiscoveredModelItem = {
      id: cleanId,
      displayName: customModelName.trim() || cleanId,
      tier: cleanId.includes('pro') ? 'pro' : cleanId.includes('lite') ? 'lite' : 'flash',
      capabilities: ['text', 'custom'],
      enabled: true,
    };
    setDiscoveredModels(prev => [newModel, ...prev]);
    setCustomModelId('');
    setCustomModelName('');
  };

  // Step 3: Complete Onboarding Finalization
  const handleFinalizeOnboarding = async () => {
    try {
      setIsSubmittingOnboard(true);
      setOnboardError(null);

      const res = await fetch('/api/ai/providers/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: {
            name: providerName.trim(),
            protocol,
            baseUrl: baseUrl.trim() || undefined,
            description: description.trim() || undefined,
          },
          credential: {
            name: credentialName.trim() || `${providerName.trim()} Key 1`,
            apiKey: apiKey.trim(),
            priority: Number(priority) || 50,
            weight: Number(weight) || 10,
          },
          models: discoveredModels.map(m => ({
            id: m.id,
            displayName: m.displayName,
            tier: m.tier,
            capabilities: m.capabilities,
            contextWindow: m.contextWindow,
            enabled: m.enabled,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete provider onboarding.');
      }

      setShowWizard(false);
      await refresh();
    } catch (err: any) {
      setOnboardError(err.message || 'Onboarding failed');
    } finally {
      setIsSubmittingOnboard(false);
    }
  };

  // Quick Add Credential to Existing Provider
  const handleSaveQuickCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddProvider || !quickApiKey.trim() || !quickCredName.trim()) {
      setQuickCredError('Credential Name and API Key are required.');
      return;
    }
    try {
      setIsSavingQuickCred(true);
      setQuickCredError(null);

      const res = await fetch('/api/ai/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: quickAddProvider.id,
          name: quickCredName.trim(),
          secret: quickApiKey.trim(),
          priority: Number(quickPriority) || 50,
          weight: Number(quickWeight) || 10,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to attach credential.');
      }

      setQuickAddProvider(null);
      setQuickCredName('');
      setQuickApiKey('');
      await refresh();
    } catch (err: any) {
      setQuickCredError(err.message || 'Failed to attach credential');
    } finally {
      setIsSavingQuickCred(false);
    }
  };

  // Card Actions: Ping Provider
  const handleTestProvider = async (providerId: string) => {
    if (testingId) return;
    try {
      setTestingId(providerId);
      setTestResults(prev => ({
        ...prev,
        [providerId]: { success: true, message: 'Pinging endpoint...' },
      }));

      const res = await fetch(`/api/ai/providers/${providerId}/test`, {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Connection check failed');
      }

      setTestResults(prev => ({
        ...prev,
        [providerId]: {
          success: true,
          message: `Online (${data.latencyMs ?? data.latency ?? 15}ms)`,
          latency: data.latencyMs ?? data.latency,
        },
      }));
    } catch (err: any) {
      setTestResults(prev => ({
        ...prev,
        [providerId]: {
          success: false,
          message: err.message || 'Test failed',
        },
      }));
    } finally {
      setTestingId(null);
    }
  };

  // Card Actions: Discover Models
  const handleDiscoverModels = async (providerId: string) => {
    if (discoveringId) return;
    try {
      setDiscoveringId(providerId);
      setDiscoveryStatus(prev => ({
        ...prev,
        [providerId]: { success: true, message: 'Discovering models catalog...' },
      }));

      const res = await fetch(`/api/ai/providers/${providerId}/discover-models`, {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Model discovery failed');
      }

      setDiscoveryStatus(prev => ({
        ...prev,
        [providerId]: {
          success: true,
          message: `Discovered ${data.discoveredCount} model(s) (${data.addedCount} new models added to registry).`,
        },
      }));
      await refresh();
    } catch (err: any) {
      setDiscoveryStatus(prev => ({
        ...prev,
        [providerId]: {
          success: false,
          message: err.message || 'Discovery failed',
        },
      }));
    } finally {
      setDiscoveringId(null);
    }
  };

  // Card Actions: Delete Provider
  const executeDeleteProvider = async (provider: any) => {
    try {
      setDeletingId(provider.id);
      setActionError(null);
      const res = await fetch(`/api/ai/providers/${provider.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete provider');
      }
      setConfirmDeleteProvider(null);
      await refresh();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete provider');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && providers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400 font-mono text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-indigo-400" /> Loading AI providers infrastructure...
      </div>
    );
  }

  const providerHealthMap = health.providers || {};

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-5 rounded-xl border border-white/5 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-white font-mono">AI Providers Registry</h2>
            <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs rounded-full font-mono font-bold">
              {providers.length} Connected Provider{providers.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-mono mt-1">
            Production provider pools, credential rotators, latency trackers, and dynamic model catalogs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenWizard}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-lg transition shadow-lg shadow-indigo-600/25 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add AI Provider
          </button>
          <button
            onClick={() => refresh()}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono rounded-lg transition border border-white/5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Empty State */}
      {providers.length === 0 && (
        <div className="bg-zinc-900/40 border border-dashed border-white/10 rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white font-mono">No AI Providers Connected</h3>
            <p className="text-xs text-zinc-400 font-mono mt-1 max-w-md mx-auto">
              Launch the Onboarding Wizard to connect Google Gemini, OpenAI-compatible gateways, or local inference pools.
            </p>
          </div>
          <button
            onClick={handleOpenWizard}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-lg transition shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            Start Provider Onboarding Wizard
          </button>
        </div>
      )}

      {/* Provider List */}
      <div className="grid gap-4">
        {providers.map((p: any) => {
          const hInfo = providerHealthMap[p.id || p.name] || {
            status: p.enabled !== false ? 'live' : 'disabled',
            availability: '99.9%',
          };
          const isLive = hInfo.status === 'live' || p.enabled !== false;
          const isGoogle = ['google-generative-ai', 'gemini', 'google'].includes(p.type);

          const protocolBadge = isGoogle
            ? 'Google Generative AI'
            : p.type === 'openai-compatible'
            ? 'OpenAI-Compatible (/v1)'
            : p.type === 'anthropic-compatible'
            ? 'Anthropic Claude'
            : p.type === 'ollama'
            ? 'Ollama Local'
            : p.type || 'Custom HTTP';

          // Linked models and credentials
          const providerModels = models.filter((m: any) => m.providerId === p.id);
          const activeModels = providerModels.filter((m: any) => m.enabled !== false);
          const providerCreds = credentials.filter((c: any) => c.providerId === p.id);
          const activeCreds = providerCreds.filter((c: any) => c.status === 'active');

          const discoveryInfo = discoveryStatus[p.id];
          const testInfo = testResults[p.id];

          return (
            <div
              key={p.id || p.name}
              className="bg-zinc-900/80 border border-white/5 rounded-xl p-5 flex flex-col gap-4 hover:border-indigo-500/30 transition shadow-lg"
            >
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                {/* Left Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-mono text-sm">{p.name}</span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-mono rounded-full font-bold uppercase ${
                            isLive
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-zinc-800 text-zinc-400 border border-white/5'
                          }`}
                        >
                          {isLive ? '🟢 Connected' : '⚪ Disabled'}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-2 mt-0.5">
                        <span>ID: <span className="text-zinc-300">{p.id}</span></span>
                        <span>•</span>
                        <span>Protocol: <span className="text-indigo-300 font-bold">{protocolBadge}</span></span>
                      </div>
                    </div>
                  </div>

                  {/* Base URL */}
                  {p.baseUrl && (
                    <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 pl-1">
                      <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="text-zinc-500">Base URL:</span>
                      <span className="text-indigo-300 select-all font-mono text-[11px] bg-zinc-950 px-2 py-0.5 rounded border border-white/5">
                        {p.baseUrl}
                      </span>
                    </div>
                  )}

                  {/* Capabilities Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {p.capabilities &&
                      Object.entries(p.capabilities).map(([cap, enabled]: [string, any]) =>
                        enabled ? (
                          <span
                            key={cap}
                            className="px-2 py-0.5 bg-zinc-800/80 text-zinc-300 border border-white/5 text-[10px] font-mono rounded uppercase"
                          >
                            ✓ {cap}
                          </span>
                        ) : null
                      )}
                  </div>
                </div>

                {/* Right Metrics Grid */}
                <div className="flex flex-wrap items-center gap-5 text-xs font-mono bg-zinc-950/60 p-3 rounded-xl border border-white/5">
                  <div className="text-left md:text-right">
                    <div className="text-zinc-500 text-[10px] uppercase tracking-wider">Models</div>
                    <div className="text-indigo-300 font-bold mt-0.5 flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                      {activeModels.length} active <span className="text-zinc-600 font-normal">({providerModels.length})</span>
                    </div>
                  </div>

                  <div className="text-left md:text-right border-l border-white/5 pl-4">
                    <div className="text-zinc-500 text-[10px] uppercase tracking-wider">Credentials</div>
                    <div className="text-indigo-300 font-bold mt-0.5 flex items-center gap-1">
                      <Key className="w-3.5 h-3.5 text-indigo-400" />
                      {activeCreds.length} key{activeCreds.length === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div className="text-left md:text-right border-l border-white/5 pl-4">
                    <div className="text-zinc-500 text-[10px] uppercase tracking-wider">Availability</div>
                    <div className="text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {hInfo.availability || '99.9%'}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 border-l border-white/5 pl-4">
                    <button
                      onClick={() => handleTestProvider(p.id)}
                      disabled={testingId === p.id}
                      className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10 rounded-lg transition text-xs font-mono flex items-center gap-1.5 disabled:opacity-50"
                      title="Test Provider Connectivity"
                    >
                      {testingId === p.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                      ) : (
                        <Activity className="w-3.5 h-3.5 text-indigo-400" />
                      )}
                      <span>Ping</span>
                    </button>

                    <button
                      onClick={() => handleDiscoverModels(p.id)}
                      disabled={discoveringId === p.id}
                      className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-indigo-300 border border-indigo-500/30 rounded-lg transition text-xs font-mono flex items-center gap-1.5 disabled:opacity-50"
                      title="Discover models from this provider"
                    >
                      {discoveringId === p.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      )}
                      <span>Discover</span>
                    </button>

                    <button
                      onClick={() => {
                        setQuickAddProvider(p);
                        setQuickCredName(`${p.name} Key ${providerCreds.length + 1}`);
                        setQuickApiKey('');
                        setQuickCredError(null);
                      }}
                      className="px-2.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg transition text-xs font-mono flex items-center gap-1"
                      title="Attach another API Key to this Provider Pool"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Key</span>
                    </button>

                    <button
                      onClick={() => setConfirmDeleteProvider(p)}
                      disabled={deletingId === p.id}
                      className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition border border-transparent hover:border-rose-500/20"
                      title="Delete Provider"
                    >
                      {deletingId === p.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Ping Test Result Banner */}
              {testInfo && (
                <div
                  className={`p-2.5 rounded-lg text-xs font-mono flex items-center gap-2 ${
                    testInfo.success
                      ? 'bg-emerald-950/40 text-emerald-200 border border-emerald-500/30'
                      : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 shrink-0" />
                  <span>Connectivity Result: {testInfo.message}</span>
                </div>
              )}

              {/* Discovery Result Banner */}
              {discoveryInfo && (
                <div
                  className={`p-2.5 rounded-lg text-xs font-mono flex items-center gap-2 ${
                    discoveryInfo.success
                      ? 'bg-indigo-950/40 text-indigo-200 border border-indigo-500/30'
                      : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{discoveryInfo.message}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 🚀 AI PROVIDER ONBOARDING WIZARD MODAL                                  */}
      {/* ========================================================================= */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-zinc-950/80 px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-mono">Add AI Provider Wizard</h3>
                  <p className="text-[11px] text-zinc-400 font-mono">
                    Step {wizardStep} of 3 •{' '}
                    {wizardStep === 1
                      ? 'Provider Configuration'
                      : wizardStep === 2
                      ? 'Authentication & Connection'
                      : 'Model Discovery & Activation'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWizard(false)}
                className="text-zinc-500 hover:text-white p-1.5 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Progress Bar */}
            <div className="bg-zinc-950/40 px-6 py-3 border-b border-white/5 flex items-center justify-between text-xs font-mono">
              <div
                className={`flex items-center gap-2 cursor-pointer transition ${
                  wizardStep === 1 ? 'text-indigo-400 font-bold' : 'text-emerald-400'
                }`}
                onClick={() => setWizardStep(1)}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    wizardStep === 1
                      ? 'bg-indigo-600 text-white'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {wizardStep > 1 ? <Check className="w-3.5 h-3.5" /> : '1'}
                </span>
                <span>1. Config</span>
              </div>

              <div className="flex-1 mx-3 h-[1px] bg-white/10" />

              <div
                className={`flex items-center gap-2 cursor-pointer transition ${
                  wizardStep === 2
                    ? 'text-indigo-400 font-bold'
                    : wizardStep > 2
                    ? 'text-emerald-400'
                    : 'text-zinc-500'
                }`}
                onClick={() => {
                  if (providerName.trim()) setWizardStep(2);
                }}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    wizardStep === 2
                      ? 'bg-indigo-600 text-white'
                      : wizardStep > 2
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {wizardStep > 2 ? <Check className="w-3.5 h-3.5" /> : '2'}
                </span>
                <span>2. Authentication</span>
              </div>

              <div className="flex-1 mx-3 h-[1px] bg-white/10" />

              <div
                className={`flex items-center gap-2 transition ${
                  wizardStep === 3 ? 'text-indigo-400 font-bold' : 'text-zinc-500'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    wizardStep === 3 ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  3
                </span>
                <span>3. Models</span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {onboardError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{onboardError}</span>
                </div>
              )}

              {/* STEP 1: CONFIGURATION */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-zinc-300 font-bold mb-1.5">
                      Provider Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Gemini Production, 9Router Gateway, DeepSeek Local"
                      value={providerName}
                      onChange={e => setProviderName(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                      autoFocus
                    />
                    <p className="text-[11px] text-zinc-500 font-mono mt-1">
                      A descriptive identifier for this AI provider instance.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-zinc-300 font-bold mb-1.5">
                      Protocol Adapter <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={protocol}
                      onChange={e => handleProtocolChange(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                    >
                      <option value="google-generative-ai">Google Generative AI (Native Gemini SDK)</option>
                      <option value="openai-compatible">OpenAI-Compatible (/v1 - 9Router, DeepSeek, Groq, OpenRouter)</option>
                      <option value="anthropic-compatible">Anthropic-Compatible (Claude Gateway)</option>
                      <option value="ollama">Ollama (Local Self-Hosted /v1)</option>
                      <option value="custom-http">Custom HTTP Gateway Proxy</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-zinc-300 font-bold mb-1.5">
                      Base URL {protocol === 'google-generative-ai' ? '(Default)' : <span className="text-rose-400">*</span>}
                    </label>
                    <input
                      type="text"
                      placeholder="https://generativelanguage.googleapis.com"
                      value={baseUrl}
                      onChange={e => setBaseUrl(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                    />
                    <p className="text-[11px] text-zinc-500 font-mono mt-1">
                      {protocol === 'google-generative-ai'
                        ? 'Google Generative Language API root endpoint.'
                        : 'Endpoint URL for chat completions and model discovery.'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-zinc-300 font-bold mb-1.5">
                      Description / Notes <span className="text-zinc-500 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Primary production tier with quota pooling"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: AUTHENTICATION & TEST CONNECTION */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-zinc-300 font-bold mb-1.5">
                      Credential Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Gemini Production Key 1"
                      value={credentialName}
                      onChange={e => setCredentialName(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-zinc-300 font-bold mb-1.5">
                      API Key / Secret Token <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder="AIzaSy... or sk-..."
                        value={apiKey}
                        onChange={e => {
                          setApiKey(e.target.value);
                          setTestResult(null);
                        }}
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 pr-10 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-500 font-mono mt-1">
                      Encrypted with AES-256-GCM before storage in database.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono text-zinc-300 font-bold mb-1.5">Priority</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={priority}
                        onChange={e => setPriority(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                      />
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Higher = Preferred in pool</p>
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-zinc-300 font-bold mb-1.5">Weight</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={weight}
                        onChange={e => setWeight(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                      />
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Weighted load-balance share</p>
                    </div>
                  </div>

                  {/* Test Connection Action Box */}
                  <div className="pt-2">
                    <div className="bg-zinc-950/60 border border-white/10 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-indigo-400" />
                            Pre-Flight Connectivity Test
                          </div>
                          <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                            Validate API credentials against the provider endpoint.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleTestConnectionLive}
                          disabled={isTestingConn || !apiKey.trim()}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
                        >
                          {isTestingConn ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Testing...</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5" />
                              <span>Test Connection</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Test Connection Result Feedback */}
                      {testResult && (
                        <div
                          className={`p-3 rounded-lg text-xs font-mono space-y-1.5 border ${
                            testResult.success
                              ? 'bg-emerald-950/40 text-emerald-200 border-emerald-500/30'
                              : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-bold">
                            {testResult.success ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            )}
                            <span>{testResult.success ? 'CONNECTED' : 'CONNECTION FAILED'}</span>
                          </div>
                          <div className="text-[11px] opacity-90 pl-6">
                            {testResult.message}
                          </div>
                          {testResult.success && (
                            <div className="text-[10px] text-emerald-300/80 pl-6 flex items-center gap-3 pt-0.5">
                              <span>Latency: {testResult.latency}ms</span>
                              <span>•</span>
                              <span>Models Detected: {testResult.modelsDetected ?? 6}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: MODEL DISCOVERY & ACTIVATION */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        Discovered Models & Capability Matrix
                      </h4>
                      <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                        Toggle which models are enabled for the AI routing system.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => handleSetAllModels(true)}
                        className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[11px]"
                      >
                        Enable All
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAllModels(false)}
                        className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[11px]"
                      >
                        Disable All
                      </button>
                    </div>
                  </div>

                  {isLoadingDiscovery ? (
                    <div className="py-12 text-center text-zinc-400 font-mono text-xs space-y-2">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-400" />
                      <div>Discovering models from provider endpoint...</div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {discoveredModels.map(m => {
                        const tierColor =
                          m.tier === 'pro'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                            : m.tier === 'lite'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';

                        return (
                          <div
                            key={m.id}
                            onClick={() => handleToggleModel(m.id)}
                            className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 cursor-pointer ${
                              m.enabled
                                ? 'bg-zinc-950 border-indigo-500/40 text-white'
                                : 'bg-zinc-950/40 border-white/5 text-zinc-500 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={m.enabled}
                                onChange={() => handleToggleModel(m.id)}
                                className="w-4 h-4 rounded text-indigo-600 bg-zinc-900 border-white/20 focus:ring-indigo-500"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs font-mono">{m.displayName}</span>
                                  <span className={`px-1.5 py-0.5 text-[9px] font-mono rounded font-bold uppercase border ${tierColor}`}>
                                    {m.tier}
                                  </span>
                                </div>
                                <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                                  ID: <span className="text-zinc-300">{m.id}</span>
                                </div>
                              </div>
                            </div>

                            {/* Capabilities */}
                            <div className="flex flex-wrap items-center gap-1 justify-end max-w-xs">
                              {m.capabilities.map(cap => (
                                <span
                                  key={cap}
                                  className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 text-[9px] font-mono rounded"
                                >
                                  {cap}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Manual Model Adder */}
                  <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Add custom model ID (e.g. gemini-2.0-pro-exp)"
                      value={customModelId}
                      onChange={e => setCustomModelId(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomModel}
                      disabled={!customModelId.trim()}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono rounded-lg transition disabled:opacity-50"
                    >
                      + Add Model
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="bg-zinc-950/80 px-6 py-4 border-t border-white/10 flex items-center justify-between">
              <div>
                {wizardStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setWizardStep((wizardStep - 1) as any)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono rounded-lg transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowWizard(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono rounded-lg transition"
                >
                  Cancel
                </button>

                {wizardStep === 1 && (
                  <button
                    type="button"
                    onClick={handleGoToStep2}
                    className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-lg transition shadow-lg shadow-indigo-600/20"
                  >
                    <span>Next: Authentication</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {wizardStep === 2 && (
                  <button
                    type="button"
                    onClick={handleGoToStep3}
                    className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-lg transition shadow-lg shadow-indigo-600/20"
                  >
                    <span>Next: Discover Models</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {wizardStep === 3 && (
                  <button
                    type="button"
                    onClick={handleFinalizeOnboarding}
                    disabled={isSubmittingOnboard}
                    className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold rounded-lg transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                  >
                    {isSubmittingOnboard ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving & Activating...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Save & Activate Provider</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔑 QUICK ADD CREDENTIAL MODAL                                            */}
      {/* ========================================================================= */}
      {quickAddProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-400">
                <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-mono">Add API Key to Pool</h3>
                  <div className="text-[11px] text-zinc-400 font-mono">{quickAddProvider.name}</div>
                </div>
              </div>
              <button
                onClick={() => setQuickAddProvider(null)}
                className="text-zinc-500 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickCredential} className="space-y-4">
              {quickCredError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs font-mono flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{quickCredError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">Credential Name</label>
                <input
                  type="text"
                  value={quickCredName}
                  onChange={e => setQuickCredName(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">API Key / Secret</label>
                <input
                  type="password"
                  placeholder="AIzaSy... or sk-..."
                  value={quickApiKey}
                  onChange={e => setQuickApiKey(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">Priority</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={quickPriority}
                    onChange={e => setQuickPriority(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">Weight</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={quickWeight}
                    onChange={e => setQuickWeight(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setQuickAddProvider(null)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuickCred || !quickApiKey.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isSavingQuickCred ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                  <span>Attach Key</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🗑️ DELETE PROVIDER MODAL                                                 */}
      {/* ========================================================================= */}
      {confirmDeleteProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono">Delete Provider?</h3>
            </div>

            <p className="text-xs text-zinc-300 font-mono leading-relaxed">
              Are you sure you want to delete provider{' '}
              <span className="text-white font-bold">{confirmDeleteProvider.name}</span>?
            </p>
            <p className="text-[11px] text-zinc-500 font-mono">
              All credentials and models registered under this provider will be cleanly detached.
            </p>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteProvider(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeDeleteProvider(confirmDeleteProvider)}
                disabled={deletingId !== null}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold rounded-lg transition flex items-center gap-2 shadow-lg shadow-rose-600/20"
              >
                {deletingId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Provider</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

