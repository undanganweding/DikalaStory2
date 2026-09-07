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
  CheckSquare,
  Square,
  AlertOctagon,
  GripVertical,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
} from 'lucide-react';

export const ProjectsWorkspace: React.FC = () => {
  const { projects: credentials, providers, loading, isRefreshing, error, credentialsError, refresh } = useInfrastructureState();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');

  // Selection for bulk operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [confirmDeleteCred, setConfirmDeleteCred] = useState<any | null>(null);
  const [showDeleteSelectedModal, setShowDeleteSelectedModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
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

  // Drag and drop / reordering state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  // Filtered credentials (sorted strictly by unique priority ascending: 1, 2, 3...)
  const filteredCredentials = useMemo(() => {
    const list = credentials.filter((c: any) => {
      const matchSearch =
        !searchQuery.trim() ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.providerId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.maskedKey || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchProv = providerFilter === 'all' || (c.providerId || 'google') === providerFilter;
      return matchSearch && matchProv;
    });

    return [...list].sort((a: any, b: any) => {
      const pA = typeof a.priority === 'number' && !isNaN(a.priority) ? a.priority : 9999;
      const pB = typeof b.priority === 'number' && !isNaN(b.priority) ? b.priority : 9999;
      if (pA !== pB) return pA - pB;
      const wA = typeof a.weight === 'number' && !isNaN(a.weight) ? a.weight : 0;
      const wB = typeof b.weight === 'number' && !isNaN(b.weight) ? b.weight : 0;
      if (wA !== wB) return wB - wA;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }, [credentials, searchQuery, providerFilter]);

  const handleOpenAddModal = () => {
    if (credentialsError) {
      setActionError('Writes are disabled while database connection is degraded.');
      return;
    }
    setAddError(null);
    setPriority(credentials.length + 1);
    setShowAddModal(true);
  };

  // Persist reordered sequence to backend (Priority 1 = top item, Priority 2 = next, etc.)
  const saveReorder = async (reorderedList: any[]) => {
    try {
      setIsReordering(true);
      setActionError(null);
      const orderedIds = reorderedList.map((c: any) => c.id);
      const res = await fetch('/api/ai/credentials/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update priority sequence');
      }

      setActionSuccess(`Urutan prioritas API Key berhasil diperbarui (${reorderedList.length} key berurutan tanpa duplikat).`);
      await refresh();
    } catch (err: any) {
      setActionError(err.message || 'Gagal menyimpan urutan prioritas API Key');
      await refresh();
    } finally {
      setIsReordering(false);
    }
  };

  // Move item by swapping in visible list and adjusting global credentials
  const handleMoveItem = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= filteredCredentials.length || toIndex >= filteredCredentials.length) return;

    // Build the new global ordered list
    const currentList = [...credentials].sort((a: any, b: any) => {
      const pA = typeof a.priority === 'number' ? a.priority : 9999;
      const pB = typeof b.priority === 'number' ? b.priority : 9999;
      return pA - pB;
    });

    const itemToMove = filteredCredentials[fromIndex];
    const targetItem = filteredCredentials[toIndex];
    if (!itemToMove || !targetItem) return;

    const fullFromIndex = currentList.findIndex((c: any) => c.id === itemToMove.id);
    const fullTargetIndex = currentList.findIndex((c: any) => c.id === targetItem.id);
    if (fullFromIndex === -1 || fullTargetIndex === -1) return;

    const updated = [...currentList];
    const [removed] = updated.splice(fullFromIndex, 1);
    updated.splice(fullTargetIndex, 0, removed);

    await saveReorder(updated);
  };

  // HTML5 Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (index: number) => {
    if (dragOverIndex === index) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }
    const fromIdx = draggedIndex;
    setDraggedIndex(null);
    await handleMoveItem(fromIdx, targetIndex);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Handle Select All / Toggle Item
  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredCredentials.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCredentials.map((c: any) => c.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

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
      setSelectedIds(prev => prev.filter(id => id !== cred.id));
      setActionSuccess(`Credential "${cred.name}" removed from vault.`);
      await refresh();
    } catch (err: any) {
      setActionError(err.message || 'Error deleting credential');
    } finally {
      setDeletingId(null);
    }
  };

  const executeDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      setIsBulkDeleting(true);
      setActionError(null);
      const res = await fetch('/api/ai/credentials/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete selected credentials');
      }
      const data = await res.json();
      setShowDeleteSelectedModal(false);
      setActionSuccess(`Successfully deleted ${data.deletedCount ?? selectedIds.length} credential keys.`);
      setSelectedIds([]);
      await refresh();
    } catch (err: any) {
      setActionError(err.message || 'Error deleting selected credentials');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const executeDeleteAll = async () => {
    try {
      setIsBulkDeleting(true);
      setActionError(null);
      const res = await fetch('/api/ai/credentials/clear-all', { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete all credentials');
      }
      const data = await res.json();
      setShowDeleteAllModal(false);
      setActionSuccess(`All ${data.deletedCount ?? 'vault'} API key credentials have been completely wiped.`);
      setSelectedIds([]);
      await refresh();
    } catch (err: any) {
      setActionError(err.message || 'Error deleting all credentials');
    } finally {
      setIsBulkDeleting(false);
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
        <div className="flex flex-wrap items-center gap-2">
          {credentials.length > 0 && (
            <button
              onClick={() => setShowDeleteAllModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-600/15 hover:bg-rose-600/25 text-rose-300 hover:text-rose-200 border border-rose-500/30 text-xs font-mono font-bold rounded-lg transition"
              title="Delete all API keys in the vault"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              Delete All Keys
            </button>
          )}

          <button
            onClick={handleOpenAddModal}
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

      {/* Filter and Search Bar + Batch Selection Toolbar */}
      {credentials.length > 0 && (
        <div className="bg-zinc-900/60 p-4 rounded-xl border border-white/5 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
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

          {/* Bulk Selection Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-xs font-mono">
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleSelectAll}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition"
              >
                {selectedIds.length > 0 && selectedIds.length === filteredCredentials.length ? (
                  <CheckSquare className="w-4 h-4 text-indigo-400" />
                ) : (
                  <Square className="w-4 h-4 text-zinc-500" />
                )}
                <span>
                  {selectedIds.length > 0
                    ? `${selectedIds.length} Selected`
                    : 'Select All'}
                </span>
              </button>

              {selectedIds.length > 0 && (
                <button
                  onClick={() => setSelectedIds([])}
                  className="text-zinc-500 hover:text-zinc-300 underline text-[11px]"
                >
                  Deselect all
                </button>
              )}
            </div>

            {selectedIds.length > 0 && (
              <button
                onClick={() => setShowDeleteSelectedModal(true)}
                className="flex items-center gap-1.5 px-3 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg transition font-bold"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                Delete Selected ({selectedIds.length})
              </button>
            )}
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
                The control plane cannot retrieve key configurations from the production Supabase database due to active quota limits or connectivity issues.
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
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-lg transition inline-flex items-center gap-2 mt-2"
            >
              <Plus className="w-4 h-4" /> Add API Key Now
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Priority Reordering Notice Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-zinc-900/60 border border-indigo-500/20 rounded-xl px-4 py-2.5 text-xs font-mono text-zinc-300 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <ArrowUpDown className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white">Kelola Urutan Prioritas:</span>{' '}
                <span className="text-zinc-400">
                  Tarik kartu ke atas/bawah (<span className="text-indigo-300">drag & drop</span>) atau gunakan tombol panah (▲/▼). Posisi paling atas otomatis Prioritas 1, berikutnya Prioritas 2, dst. tanpa angka kembar.
                </span>
              </div>
            </div>
            {isReordering && (
              <div className="flex items-center gap-1.5 text-indigo-400 font-bold shrink-0 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/30">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menyimpan urutan...</span>
              </div>
            )}
          </div>

          {filteredCredentials.map((cred: any, idx: number) => {
            const isTesting = testingId === cred.id;
            const isDeleting = deletingId === cred.id;
            const isSelected = selectedIds.includes(cred.id);
            const testInfo = testResults[cred.id];

            return (
              <div
                key={cred.id}
                draggable={!isReordering}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragLeave={() => handleDragLeave(idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`bg-zinc-900/80 border rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-150 text-xs font-mono cursor-default select-none ${
                  draggedIndex === idx
                    ? 'opacity-40 border-dashed border-indigo-500 bg-indigo-950/20 scale-[0.99]'
                    : dragOverIndex === idx
                    ? 'border-indigo-400 ring-2 ring-indigo-500/40 bg-indigo-950/40 translate-y-0.5'
                    : isSelected
                    ? 'border-indigo-500/60 bg-indigo-950/20'
                    : 'border-white/5 hover:border-indigo-500/30'
                }`}
              >
                {/* Left: Drag Handle, Priority Badge, Checkbox, Key Details */}
                <div className="flex items-start gap-3 min-w-[280px]">
                  {/* Drag Handle & Move Up/Down Controls */}
                  <div className="flex items-center gap-1 shrink-0 mt-1">
                    <div
                      className="p-1.5 text-zinc-500 hover:text-indigo-300 hover:bg-white/5 rounded cursor-grab active:cursor-grabbing transition"
                      title="Tarik ke atas atau ke bawah untuk mengubah urutan prioritas"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveItem(idx, idx - 1);
                        }}
                        disabled={idx === 0 || isReordering}
                        className="p-0.5 text-zinc-500 hover:text-indigo-300 hover:bg-white/5 rounded disabled:opacity-20 disabled:hover:text-zinc-500 transition"
                        title="Pindah Prioritas ke Atas"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveItem(idx, idx + 1);
                        }}
                        disabled={idx === filteredCredentials.length - 1 || isReordering}
                        className="p-0.5 text-zinc-500 hover:text-indigo-300 hover:bg-white/5 rounded disabled:opacity-20 disabled:hover:text-zinc-500 transition"
                        title="Pindah Prioritas ke Bawah"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Priority Indicator Badge */}
                  <div className="shrink-0 mt-1.5">
                    {cred.priority === 1 ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm flex items-center gap-1">
                        <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                        #1 UTAMA
                      </span>
                    ) : cred.priority === 2 ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                        #2 SECONDARY
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-white/10 flex items-center gap-1">
                        #{cred.priority ?? (idx + 1)} BACKUP
                      </span>
                    )}
                  </div>

                  {/* Checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleSelect(cred.id);
                    }}
                    className="mt-2 text-zinc-500 hover:text-zinc-200 transition"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4 text-zinc-600" />
                    )}
                  </button>

                  <div className="space-y-1.5">
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
                      <span>Priority: <strong className="text-white font-bold">{cred.priority ?? (idx + 1)}</strong></span>
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

      {/* Delete Single Confirmation Modal */}
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

      {/* Bulk Delete Selected Modal */}
      {showDeleteSelectedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono">Delete Selected Credentials?</h3>
            </div>

            <p className="text-xs text-zinc-300 font-mono leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white">{selectedIds.length}</strong> selected API key credentials from the Secret Vault?
            </p>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteSelectedModal(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteSelected}
                disabled={isBulkDeleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold rounded-lg transition flex items-center gap-2 shadow-lg shadow-rose-600/20"
              >
                {isBulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete {selectedIds.length} Keys</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Keys Modal */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/30">
                <AlertOctagon className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-mono">Wipe All Vault API Keys?</h3>
                <span className="text-[11px] text-rose-400 font-mono font-bold">Destructive Action</span>
              </div>
            </div>

            <p className="text-xs text-zinc-300 font-mono leading-relaxed">
              This will permanently delete <strong>all {credentials.length} API keys</strong> across all AI providers in the Secret Vault. AI requests will fail until new keys are added.
            </p>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteAll}
                disabled={isBulkDeleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold rounded-lg transition flex items-center gap-2 shadow-lg shadow-rose-600/20"
              >
                {isBulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Wipe All Keys</span>
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

              {/* Priority & Weight */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1.5">Priority Order (1 = Utama)</label>
                  <input
                    type="number"
                    min="1"
                    max={Math.max(1, credentials.length + 1)}
                    value={priority}
                    onChange={(e) => setPriority(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">Otomatis diurutkan tanpa ada angka kembar.</p>
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
