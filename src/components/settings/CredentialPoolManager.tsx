import React, { useState, useEffect } from 'react';
import {
  Key,
  ShieldCheck,
  Plus,
  Trash2,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  Eye,
  EyeOff,
  Server,
  Layers,
  ArrowUpRight,
  Activity,
  Check,
  X,
  Sliders,
} from 'lucide-react';
import { ProviderCredential, ProviderCredentialSummary, ProviderType, CredentialStatus } from '../../types';

const PROVIDER_OPTIONS: { id: ProviderType; name: string; desc: string }[] = [
  { id: 'google', name: 'Google Gemini', desc: 'Gemini 3.7 Flash, 3.6 Flash, 3.1 Pro Preview' },
  { id: 'openai', name: 'OpenAI', desc: 'GPT-4o, GPT-4o-mini, o1/o3 reasoning' },
  { id: 'openrouter', name: 'OpenRouter', desc: 'Unified multi-provider API router' },
  { id: 'xai', name: 'xAI Grok', desc: 'Grok 2 / Grok 3 models' },
  { id: 'custom_openai', name: 'Custom OpenAI / Local', desc: 'vLLM, Ollama, LM Studio, or custom reverse proxies' },
  { id: 'kling', name: 'Kling Video API', desc: 'Cinematic video generation provider' },
  { id: 'runway', name: 'Runway Gen-3 API', desc: 'Runway Gen-3 Alpha video provider' },
];

export const CredentialPoolManager: React.FC = () => {
  const [summary, setSummary] = useState<ProviderCredentialSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  
  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProvider, setNewProvider] = useState<ProviderType>('google');
  const [newLabel, setNewLabel] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newPriority, setNewPriority] = useState(1);
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [showKeySecret, setShowKeySecret] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [savingKey, setSavingKey] = useState(false);

  // Per-key testing & action state
  const [activeTestingId, setActiveTestingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ id: string; text: string; success: boolean } | null>(null);

  // Regression tests
  const [runningSuite, setRunningSuite] = useState(false);
  const [suiteResults, setSuiteResults] = useState<{ testId: string; name: string; passed: boolean; details: string }[] | null>(null);

  useEffect(() => {
    fetchCredentials();
  }, []);

  const safeParseJson = async (res: Response) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Server Vercel mengembalikan respon error (${res.status}): ${text.slice(0, 120)}`);
    }
  };

  const fetchCredentials = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/credentials/summary');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await safeParseJson(res);
      setSummary(data);
    } catch (err) {
      console.error('Error loading credential pool:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestKeyBeforeSave = async () => {
    if (!newApiKey.trim()) {
      setTestResult({ success: false, message: 'Harap masukkan API Key terlebih dahulu.' });
      return;
    }
    try {
      setTestingKey(true);
      setTestResult(null);
      const res = await fetch('/api/credentials/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: newProvider,
          apiKey: newApiKey.trim(),
          baseUrl: newBaseUrl.trim() || undefined,
        }),
      });
      const data = await safeParseJson(res);
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || 'Gagal menguji koneksi.' });
    } finally {
      setTestingKey(false);
    }
  };

  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApiKey.trim()) return;

    try {
      setSavingKey(true);
      const res = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: newProvider,
          label: newLabel.trim() || undefined,
          apiKey: newApiKey.trim(),
          priority: Number(newPriority) || 1,
          baseUrl: newBaseUrl.trim() || undefined,
          notes: newNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await safeParseJson(res);
        throw new Error(err?.error || 'Gagal menyimpan credential.');
      }

      // Reset form
      setNewLabel('');
      setNewApiKey('');
      setNewBaseUrl('');
      setNewNotes('');
      setTestResult(null);
      setShowAddModal(false);
      fetchCredentials();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan key');
    } finally {
      setSavingKey(false);
    }
  };

  const handleTestExisting = async (credId: string) => {
    try {
      setActiveTestingId(credId);
      setActionMessage(null);
      const res = await fetch(`/api/credentials/${credId}/test`, { method: 'POST' });
      const data = await safeParseJson(res);
      setActionMessage({
        id: credId,
        text: data.message || (data.success ? 'Koneksi berhasil' : 'Koneksi gagal'),
        success: data.success,
      });
      fetchCredentials();
    } catch (err: any) {
      setActionMessage({
        id: credId,
        text: err?.message || 'Gagal melakukan tes koneksi.',
        success: false,
      });
    } finally {
      setActiveTestingId(null);
    }
  };

  const handleResetStatus = async (credId: string) => {
    try {
      const res = await fetch(`/api/credentials/${credId}/reset`, { method: 'POST' });
      if (res.ok) {
        setActionMessage({ id: credId, text: 'Status key berhasil di-reset ke ACTIVE', success: true });
        fetchCredentials();
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleToggleDisabled = async (cred: ProviderCredential) => {
    const nextStatus: CredentialStatus = cred.status === 'disabled' ? 'active' : 'disabled';
    try {
      const res = await fetch(`/api/credentials/${cred.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        fetchCredentials();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteKey = async (credId: string, label: string) => {
    if (!confirm(`Hapus API Key "${label}" dari Credential Pool?`)) return;
    try {
      const res = await fetch(`/api/credentials/${credId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchCredentials();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunRegressionSuite = async () => {
    try {
      setRunningSuite(true);
      setSuiteResults(null);
      const res = await fetch('/api/regression-tests/credentials');
      const data = await res.json();
      setSuiteResults(data.results || []);
    } catch (err: any) {
      alert(`Gagal menjalankan test suite: ${err.message}`);
    } finally {
      setRunningSuite(false);
    }
  };

  const credentials = summary?.credentials || [];
  const filteredCredentials =
    selectedProvider === 'all'
      ? credentials
      : credentials.filter((c) => c.provider.toLowerCase() === selectedProvider.toLowerCase());

  return (
    <div id="credential-pool-manager" className="space-y-6">
      {/* Header & Primary Stats */}
      <div className="bg-[#121624] border border-indigo-500/20 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-mono">Credential Pool &amp; Provider Router</h3>
                <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
                  Phase 7B
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Manajemen multi-key API terisolasi, failover otomatis 429, round-robin, dan proteksi server vault.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleRunRegressionSuite}
              disabled={runningSuite}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-200 bg-white/5 hover:bg-white/10 border border-white/10 transition disabled:opacity-50"
            >
              {runningSuite ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
              <span>Test Suite (8)</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah API Key</span>
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Total Keys in Pool</span>
            <div className="text-xl font-extrabold text-white font-mono">{summary?.totalCredentials ?? 0}</div>
            <div className="text-[10px] text-zinc-400">Tersimpan di vault server</div>
          </div>
          <div className="p-3.5 rounded-xl bg-black/40 border border-emerald-500/20 space-y-1">
            <span className="text-[10px] font-mono text-emerald-400 uppercase">Active (Healthy)</span>
            <div className="text-xl font-extrabold text-emerald-400 font-mono">{summary?.activeCredentials ?? 0}</div>
            <div className="text-[10px] text-zinc-400">Siap melayani request</div>
          </div>
          <div className="p-3.5 rounded-xl bg-black/40 border border-amber-500/20 space-y-1">
            <span className="text-[10px] font-mono text-amber-400 uppercase">Rate Limited</span>
            <div className="text-xl font-extrabold text-amber-400 font-mono">{summary?.rateLimitedCredentials ?? 0}</div>
            <div className="text-[10px] text-zinc-400">Dalam masa cooldown</div>
          </div>
          <div className="p-3.5 rounded-xl bg-black/40 border border-rose-500/20 space-y-1">
            <span className="text-[10px] font-mono text-rose-400 uppercase">Invalid / Auth Err</span>
            <div className="text-xl font-extrabold text-rose-400 font-mono">{summary?.invalidCredentials ?? 0}</div>
            <div className="text-[10px] text-zinc-400">Perlu update key</div>
          </div>
        </div>

        {/* Regression Suite Results Drawer (if executed) */}
        {suiteResults && (
          <div className="p-4 rounded-xl bg-black/60 border border-indigo-500/30 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-zinc-200 font-mono">
                  Phase 7B Credential Pool Test Results ({suiteResults.filter((r) => r.passed).length}/{suiteResults.length} Passed)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSuiteResults(null)}
                className="text-zinc-500 hover:text-zinc-300 text-xs"
              >
                Tutup
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {suiteResults.map((t) => (
                <div
                  key={t.testId}
                  className={`p-2.5 rounded-lg border flex items-start gap-2.5 ${
                    t.passed ? 'bg-emerald-950/20 border-emerald-500/30 text-zinc-300' : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                  }`}
                >
                  {t.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-bold font-mono text-[11px] flex items-center gap-1.5">
                      <span>{t.testId}: {t.name}</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-normal">{t.details}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Provider Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setSelectedProvider('all')}
          className={`px-3.5 py-1.5 rounded-xl font-mono text-xs transition shrink-0 ${
            selectedProvider === 'all'
              ? 'bg-indigo-600 text-white font-bold shadow'
              : 'bg-[#121624] text-zinc-400 hover:text-zinc-200 border border-white/5'
          }`}
        >
          Semua Provider ({credentials.length})
        </button>
        {PROVIDER_OPTIONS.map((po) => {
          const count = credentials.filter((c) => c.provider.toLowerCase() === po.id.toLowerCase()).length;
          return (
            <button
              key={po.id}
              type="button"
              onClick={() => setSelectedProvider(po.id)}
              className={`px-3.5 py-1.5 rounded-xl font-mono text-xs transition shrink-0 flex items-center gap-1.5 ${
                selectedProvider === po.id
                  ? 'bg-indigo-600 text-white font-bold shadow'
                  : 'bg-[#121624] text-zinc-400 hover:text-zinc-200 border border-white/5'
              }`}
            >
              <span>{po.name}</span>
              <span className="text-[10px] opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Credential Cards List */}
      <div className="space-y-3">
        {filteredCredentials.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#121624] border border-white/5 text-center space-y-3">
            <Key className="w-8 h-8 text-zinc-600 mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-zinc-300">Belum ada API Key untuk provider ini</h4>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Tambahkan API Key untuk mengaktifkan multi-key failover otomatis dan load balancing.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (selectedProvider !== 'all') setNewProvider(selectedProvider as ProviderType);
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah API Key Pertama</span>
            </button>
          </div>
        ) : (
          filteredCredentials.map((cred) => {
            const isTesting = activeTestingId === cred.id;
            const message = actionMessage?.id === cred.id ? actionMessage : null;

            return (
              <div
                key={cred.id}
                className={`p-5 rounded-2xl border transition space-y-4 ${
                  cred.status === 'active'
                    ? 'bg-[#121624] border-white/5 hover:border-indigo-500/30'
                    : cred.status === 'rate_limited'
                    ? 'bg-[#18151f] border-amber-500/30'
                    : cred.status === 'invalid'
                    ? 'bg-[#1a1216] border-rose-500/30'
                    : 'bg-[#10121b] border-white/5 opacity-60'
                }`}
              >
                {/* Header line */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl border ${
                        cred.status === 'active'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : cred.status === 'rate_limited'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          : cred.status === 'invalid'
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                      }`}
                    >
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{cred.label}</span>
                        {cred.isEnvFallback && (
                          <span className="text-[10px] font-mono bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">
                            .env Fallback
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                            cred.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : cred.status === 'rate_limited'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : cred.status === 'invalid'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}
                        >
                          {cred.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5 font-mono">
                        <span className="capitalize text-indigo-300">{cred.provider}</span>
                        <span>•</span>
                        <span className="bg-black/50 px-2 py-0.5 rounded border border-white/5 text-zinc-300">
                          {cred.maskedKey}
                        </span>
                        <span>•</span>
                        <span className="text-zinc-500">Priority: {cred.priority}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Buttons */}
                  <div className="flex items-center gap-2">
                    {cred.status !== 'active' && (
                      <button
                        type="button"
                        onClick={() => handleResetStatus(cred.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Reset to Active</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleTestExisting(cred.id)}
                      disabled={isTesting}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isTesting ? <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" /> : <Activity className="w-3 h-3 text-emerald-400" />}
                      <span>Test Live</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleDisabled(cred)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 bg-white/5 hover:bg-white/10 border border-white/5 transition"
                    >
                      {cred.status === 'disabled' ? 'Enable' : 'Disable'}
                    </button>
                    {!cred.isEnvFallback && (
                      <button
                        type="button"
                        onClick={() => handleDeleteKey(cred.id, cred.label)}
                        className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Status / Test feedback banner */}
                {message && (
                  <div
                    className={`p-2.5 rounded-xl text-xs font-mono border flex items-center justify-between ${
                      message.success
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <span>{message.text}</span>
                    <button
                      type="button"
                      onClick={() => setActionMessage(null)}
                      className="text-zinc-400 hover:text-zinc-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Error message detail if present */}
                {cred.lastErrorMessage && cred.status !== 'active' && (
                  <div className="p-2.5 rounded-xl bg-black/40 border border-rose-500/20 text-xs text-rose-300/90 font-mono space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase">Last Error Diagnostic:</span>
                    <p className="text-[11px] leading-relaxed">{cred.lastErrorMessage}</p>
                    {cred.cooldownUntil && (
                      <div className="text-[10px] text-amber-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Cooldown aktif sampai: {new Date(cred.cooldownUntil).toLocaleTimeString()}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Stats footer */}
                <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-zinc-500 pt-2 border-t border-white/5">
                  <div>
                    Requests: <span className="text-zinc-300 font-bold">{cred.totalRequests || 0}</span>
                  </div>
                  <div>
                    Success: <span className="text-emerald-400 font-bold">{cred.successCount || 0}</span>
                  </div>
                  <div>
                    Failures: <span className="text-rose-400 font-bold">{cred.failureCount || 0}</span>
                  </div>
                  <div>
                    429 Hits: <span className="text-amber-400 font-bold">{cred.rateLimitCount || 0}</span>
                  </div>
                  {cred.lastUsedAt && (
                    <div className="text-zinc-400">
                      Last used: {new Date(cred.lastUsedAt).toLocaleTimeString()}
                    </div>
                  )}
                  {cred.baseUrl && (
                    <div className="text-zinc-400 truncate max-w-xs">
                      Endpoint: {cred.baseUrl}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Credential Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#181926] border border-indigo-500/30 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white font-mono">Tambah API Key ke Pool</h4>
                  <p className="text-xs text-zinc-400">Kunci disimpan aman pada server vault dan ditransmisikan secara tersamar.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCredential} className="space-y-4">
              {/* Provider Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 font-mono">Provider AI</label>
                <select
                  value={newProvider}
                  onChange={(e) => setNewProvider(e.target.value as ProviderType)}
                  className="w-full bg-[#121420] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {PROVIDER_OPTIONS.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.name} — {po.desc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Key Label */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 font-mono">Nama / Label Key</label>
                <input
                  type="text"
                  placeholder="Contoh: Primary Gemini Key, Backup OpenAI Tier 2"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full bg-[#121420] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* API Key Secret */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 font-mono">API Key Secret</label>
                  <button
                    type="button"
                    onClick={() => setShowKeySecret(!showKeySecret)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    {showKeySecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showKeySecret ? 'Sembunyikan' : 'Tampilkan'}</span>
                  </button>
                </div>
                <input
                  type={showKeySecret ? 'text' : 'password'}
                  placeholder="AIzaSy... atau sk-..."
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  required
                  className="w-full bg-[#121420] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-zinc-500">
                  Kunci akan otomatis disamarkan (masked) saat disimpan dan tidak pernah dikembalikan dalam format plaintext ke klien.
                </p>
              </div>

              {/* Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 font-mono">Prioritas Routing</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(Number(e.target.value))}
                    className="w-full bg-[#121420] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value={1}>1 — Prioritas Utama (Primary)</option>
                    <option value={2}>2 — Sekunder (Secondary)</option>
                    <option value={3}>3 — Cadangan (Fallback)</option>
                    <option value={4}>4 — Darurat (Emergency)</option>
                  </select>
                </div>

                {/* Base URL (Optional) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 font-mono">Custom Base URL (Opsional)</label>
                  <input
                    type="text"
                    placeholder="https://api.openai.com/v1"
                    value={newBaseUrl}
                    onChange={(e) => setNewBaseUrl(e.target.value)}
                    className="w-full bg-[#121420] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Test Result Feedback */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl text-xs font-mono border flex items-start gap-2 ${
                    testResult.success
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <p className="font-bold">{testResult.success ? 'Koneksi Sukses' : 'Koneksi Gagal'}</p>
                    <p className="text-[11px] leading-relaxed">{testResult.message}</p>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleTestKeyBeforeSave}
                  disabled={testingKey || !newApiKey.trim()}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 transition flex items-center gap-2 disabled:opacity-40"
                >
                  {testingKey ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" /> : <Activity className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>Uji Koneksi Terlebih Dahulu</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingKey || !newApiKey.trim()}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition disabled:opacity-40"
                  >
                    {savingKey ? 'Menyimpan...' : 'Simpan Key'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
