import React, { useState, useMemo } from 'react';
import { useInfrastructureState } from './useInfrastructureState';
import {
  Key,
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
  Activity,
  X,
  Loader2,
  ShieldCheck,
  Search,
  Filter,
  SlidersHorizontal,
} from 'lucide-react';

export const ProjectsWorkspace: React.FC = () => {
  const { projects: credentials, providers, loading, isRefreshing, error, credentialsError, refresh } = useInfrastructureState();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');

  // Add Credential Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [providerId, setProviderId] = useState('google');
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [priority, setPriority] = useState(1);
  const [weight, setWeight] = useState(10);
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Per-credential Testing state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; message?: string; latency?: number; error?: string; responseSample?: string }>
  >({});

  // Deleting state & Modal
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteCred, setConfirmDeleteCred] = useState<any | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Dynamic Provider Options
  const providerOptions = useMemo(() => {
    return providers.map((p) => ({
      id: p.id,
      name: p.name,
      desc:
        p.type === 'openai-compatible'
          ? `OpenAI-Compatible (${p.baseUrl || '/v1'})`
          : 'Google Generative AI / Gemini',
    }));
  }, [providers]);

  // Keep selected providerId valid
  React.useEffect(() => {
    if (providerOptions.length > 0 && !providerOptions.some((p) => p.id === providerId)) {
      setProviderId(providerOptions[0].id);
    }
  }, [providerOptions, providerId]);

  // Filtered credentials
  const filteredCredentials = useMemo(() => {
    return credentials.filter((c: any) => {
      const matchSearch =
        !searchQuery.trim() ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.providerId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.maskedKey || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchProv = providerFilter === 'all' || (c.providerId || 'google') === providerFilter;
      return matchSearch && matchProv;
    });
  }, [credentials, searchQuery, providerFilter]);

  const handleAddCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!name.trim() || !secret.trim()) {
      setAddError('Credential name and API Key secret are required.');
      return;
    }

    try {
      setSaving(true);
      setAddError(null);
      const res = await fetch('/api/ai/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          name: name.trim(),
          secret: secret.trim(),
          priority: Number(priority) || 1,
          weight: Number(weight) || 10,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      setName('');
      setSecret('');
      setPriority(1);
      setWeight(10);
      setShowAddModal(false);
      setActionSuccess('API Key successfully encrypted and added to Secret Vault.');
      await refresh();
    } catch (err: any) {
      setAddError(err.message || 'Failed to add credential');
    } finally {
      setSaving(false);
    }
  };

  const executeDeleteCredential = async (cred: any) => {
    try {
      setDeletingId(cred.id);
      setActionError(null);
      const res = await fetch(`/api/ai/credentials/${cred.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete credential');
      setConfirmDeleteCred(null);
      setActionSuccess(`Credential "${cred.name}" removed from vault.`);
      await refresh();
    } catch (err: any) {
      setActionError(err.message || 'Error deleting credential');
    } finally {
      setDeletingId(null);
    }
  };

  const handleTest = async (id: string) => {
    try {
      setTestingId(id);
      setTestResults(prev => ({ ...prev, [id]: { success: false, message: 'Testing connectivity...' } }));

      const res = await fetch(`/api/ai/credentials/${id}/test`, { method: 'POST' });
      const data = await res.json();

      setTestResults(prev => ({
        ...prev,
        [id]: {
          success: data.success,
          latency: data.latency,
          error: data.error,
          responseSample: data.responseSample,
          message: data.success ? `Connected (${data.latency}ms)` : data.error || 'Test failed',
        },
      }));
      await refresh();
    } catch (err: any) {
      setTestResults(prev => ({
        ...prev,
        [id]: { success: false, error: err.message, message: 'Connection test failed' },
      }));
    } finally {
      setTestingId(null);
    }
  };

  if (loading && credentials.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400 font-mono text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-indigo-400" /> Loading credential pool...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-5 rounded-xl border border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white font-mono">Projects / Credential Pool</h2>
            <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs rounded-full font-mono font-bold">
              {credentials.length} Vault Key{credentials.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-mono mt-1">
            Manage AI API keys, secret vault keys, weights, and quota routing pools securely.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (credentialsError) {
                setActionError('Writes are disabled while database connection is degraded.');
                return;
              }
              setAddError(null);
              setShowAddModal(true);
            }}
            disabled={!!credentialsError}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-mono font-bold rounded-lg transition ${
              credentialsError
                ? 'bg-zinc-800 text-zinc-500 border border-white/5 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
            }`}
          >
            <Plus className="w-4 h-4" />
            Add API Key
          </button>
          <button
            onClick={() => refresh()}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono rounded-lg transition border border-white/5 disabled:opacity-50"
            title="Refresh Pool"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      {credentials.length > 0 && (
        <div className="bg-zinc-900/60 p-4 rounded-xl border border-white/5 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by credential name, provider, or masked key..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-lg pl-9 pr-8 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-zinc-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono">
            <span className="text-zinc-500 text-[11px]">Provider:</span>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-zinc-900 text-zinc-200">All Providers</option>
              {providerOptions.map((p) => (
                <option key={p.id} value={p.id} className="bg-zinc-900 text-zinc-200">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Credential List Table / Cards */}
      {credentialsError ? (
        <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-4 text-left font-mono">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-rose-200 text-sm font-bold">Durable Storage Connection Degraded</h3>
              <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                The control plane cannot retrieve key configurations from the production Firestore database due to active quota limits or connectivity issues.
              </p>
              <div className="mt-3 bg-black/40 p-2.5 rounded border border-rose-500/20 text-[11px] text-rose-300 font-bold max-w-2xl select-all break-all whitespace-pre-wrap">
                Error Details: {credentialsError}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 pl-8">
            <button
              onClick={() => refresh()}
              disabled={isRefreshing}
              className="px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              Retry Connection
            </button>
            <span className="text-[11px] text-zinc-500">
              * Writes to credentials are disabled to protect data integrity. Previously cached states are kept if available.
            </span>
          </div>
        </div>
      ) : filteredCredentials.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/40 rounded-xl border border-dashed border-white/10 space-y-3">
          <Key className="w-10 h-10 text-zinc-600 mx-auto" />
          <div className="text-zinc-300 font-mono text-sm font-bold">No credentials match your filter</div>
          <p className="text-zinc-500 font-mono text-xs max-w-md mx-auto">
            {credentials.length === 0
              ? 'Add your first Gemini or third-party AI API key to enable quota routing and execution gateway fallback chains.'
              : 'Try clearing the search filter.'}
          </p>
          {credentials.length === 0 && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-lg transition inline-flex items-center gap-2 mt-2"
            >
              <Plus className="w-4 h-4" /> Add API Key Now
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCredentials.map((cred: any) => {
            const isTesting = testingId === cred.id;
            const isDeleting = deletingId === cred.id;
            const testInfo = testResults[cred.id];

            return (
              <div
                key={cred.id}
                className="bg-zinc-900/80 border border-white/5 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-indigo-500/30 transition text-xs font-mono"
              >
                {/* Left: Provider, Name, Key */}
                <div className="space-y-1.5 min-w-[280px]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <span>{cred.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-white/5 uppercase">
                          {cred.providerId || 'google'}
                        </span>
                      </div>
                      <div className="text-zinc-500 text-[11px] font-mono select-all">
                        Key: {cred.maskedKey || '••••••••••••••••'}
                      </div>
                    </div>
                  </div>

                  {/* Badges / Weights */}
                  <div className="flex items-center gap-3 text-[11px] text-zinc-400 pl-1 pt-1">
                    <span>Priority: <strong className="text-zinc-200">{cred.priority ?? 1}</strong></span>
                    <span>•</span>
                    <span>Weight: <strong className="text-zinc-200">{cred.weight ?? 10}</strong></span>
                    <span>•</span>
                    <span className={`font-bold uppercase ${
                      cred.status === 'active' ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {cred.status || 'active'}
                    </span>
                  </div>
                </div>

                {/* Middle: Live Health & Token Telemetry */}
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-zinc-500 text-[10px]">SUCCESS RATE</div>
                    <div className="text-emerald-400 font-bold mt-0.5">
                      {cred.successRate !== undefined ? `${cred.successRate}%` : '100%'}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-zinc-500 text-[10px]">TOKENS USED</div>
                    <div className="text-indigo-300 font-bold mt-0.5">
                      {(cred.totalTokens || 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  {/* Test Button */}
                  <button
                    onClick={() => handleTest(cred.id)}
                    disabled={isTesting}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-indigo-300 border border-indigo-500/30 rounded-lg transition text-xs font-mono flex items-center gap-1.5 disabled:opacity-50"
                    title="Test API Key Connectivity"
                  >
                    {isTesting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>{isTesting ? 'Testing...' : 'Test Key'}</span>
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => setConfirmDeleteCred(cred)}
                    disabled={isDeleting}
                    className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition border border-transparent hover:border-rose-500/20"
                    title="Remove from pool"
                  >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin text-rose-400" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>

                {/* Test status banner */}
                {testInfo && (
                  <div className={`w-full mt-2 p-2.5 rounded-lg text-xs font-mono flex items-center gap-2 ${
                    testInfo.success
                      ? 'bg-emerald-950/40 text-emerald-200 border border-emerald-500/30'
                      : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
                  }`}>
                    {testInfo.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>{testInfo.message}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteCred && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono">Remove API Key Credential?</h3>
            </div>

            <p className="text-xs text-zinc-300 font-mono leading-relaxed">
              Are you sure you want to remove credential{' '}
              <span className="text-white font-bold">{confirmDeleteCred.name}</span> ({confirmDeleteCred.maskedKey}) from the vault?
            </p>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteCred(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeDeleteCredential(confirmDeleteCred)}
                disabled={deletingId !== null}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold rounded-lg transition flex items-center gap-2 shadow-lg shadow-rose-600/20"
              >
                {deletingId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Remove Credential</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Credential Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <Key className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white font-mono">Add API Key to Vault</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCredential} className="space-y-4">
              {addError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs font-mono flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              {/* Provider Selection */}
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">Provider</label>
                <select
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                >
                  {providerOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name} — {opt.desc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Credential Name */}
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">Credential Name / Label</label>
                <input
                  type="text"
                  placeholder="e.g. Gemini Production Key, 9Router Gateway Key"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              {/* API Key Secret */}
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">API Key Secret (Plaintext)</label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    placeholder="Enter API key string (e.g. AIzaSy... or sk-...)"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg pl-3 pr-10 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] font-mono text-zinc-500 mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Key is encrypted with AES-256-GCM in Secret Vault before storage.
                </p>
              </div>

              {/* Priority and Weight */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1.5">Priority (1 = Highest)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1.5">Weight (Quota Ratio)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={weight}
                    onChange={(e) => setWeight(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim() || !secret.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Save to Vault</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
