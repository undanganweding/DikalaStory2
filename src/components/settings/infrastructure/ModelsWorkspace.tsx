import React, { useState, useMemo } from 'react';
import { useInfrastructureState } from './useInfrastructureState';
import {
  Cpu,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
  Sparkles,
  Trash2,
  Plus,
  Search,
  Filter,
  SlidersHorizontal,
  Layers,
  Power,
  PowerOff,
  RotateCcw,
  X,
  Shield,
  CheckSquare,
  Square,
  AlertTriangle,
} from 'lucide-react';

export const ModelsWorkspace: React.FC = () => {
  const {
    models,
    providers,
    health,
    loading,
    isRefreshing,
    refresh,
    deleteModel,
    bulkDeleteModels,
    toggleModelEnabled,
    addModel,
    resetDefaultModels,
  } = useInfrastructureState();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');

  // Multi-select / Bulk Delete State
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedModelKeys, setSelectedModelKeys] = useState<Set<string>>(new Set());

  // Action Loading & Confirmation States
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [confirmDeleteModel, setConfirmDeleteModel] = useState<any | null>(null);
  const [showConfirmBulkDelete, setShowConfirmBulkDelete] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Add Model Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newModelId, setNewModelId] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newProviderId, setNewProviderId] = useState('google');
  const [newTier, setNewTier] = useState<'flash' | 'pro' | 'lite' | 'custom'>('flash');
  const [newContextWindow, setNewContextWindow] = useState('1048576');
  const [newCapabilities, setNewCapabilities] = useState<Record<string, boolean>>({
    text: true,
    vision: false,
    image: false,
    video: false,
    analysis: false,
    fast: false,
  });
  const [isAdding, setIsAdding] = useState(false);
  const [addModalError, setAddModalError] = useState<string | null>(null);

  const modelHealth = health.models || {};

  // Filtered models
  const filteredModels = useMemo(() => {
    return models.filter((m: any) => {
      const matchSearch =
        !searchQuery.trim() ||
        (m.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.displayName || m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.providerId || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchProvider =
        selectedProvider === 'all' || (m.providerId || 'google') === selectedProvider;

      const matchTier =
        selectedTier === 'all' || (m.tier || '').toLowerCase() === selectedTier.toLowerCase();

      const isLive = m.enabled !== false;
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'enabled' && isLive) ||
        (statusFilter === 'disabled' && !isLive);

      return matchSearch && matchProvider && matchTier && matchStatus;
    });
  }, [models, searchQuery, selectedProvider, selectedTier, statusFilter]);

  // Unique list of providers from models + registered providers
  const availableProviders = useMemo(() => {
    const set = new Set<string>(['google']);
    providers.forEach(p => p.id && set.add(p.id));
    models.forEach(m => m.providerId && set.add(m.providerId));
    return Array.from(set);
  }, [providers, models]);

  // Unique tiers
  const availableTiers = useMemo(() => {
    const set = new Set<string>();
    models.forEach(m => m.tier && set.add(m.tier.toLowerCase()));
    return Array.from(set);
  }, [models]);

  const handleToggleSelectAll = () => {
    if (selectedModelKeys.size === filteredModels.length) {
      setSelectedModelKeys(new Set());
    } else {
      const allKeys = new Set(
        filteredModels.map((m: any) => `${m.providerId || 'google'}::${m.id}`)
      );
      setSelectedModelKeys(allKeys);
    }
  };

  const handleToggleSelect = (key: string) => {
    const next = new Set(selectedModelKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedModelKeys(next);
  };

  // Execute single model delete
  const executeDeleteModel = async (model: any) => {
    const key = `${model.providerId || 'google'}::${model.id}`;
    try {
      setDeletingKey(key);
      setActionError(null);
      setActionSuccess(null);
      await deleteModel(model.id, model.providerId);
      setActionSuccess(`Model "${model.displayName || model.id}" removed from registry.`);
      setConfirmDeleteModel(null);
      // Remove from selection if present
      const next = new Set(selectedModelKeys);
      next.delete(key);
      setSelectedModelKeys(next);
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete model.');
    } finally {
      setDeletingKey(null);
    }
  };

  // Execute bulk delete
  const executeBulkDelete = async () => {
    try {
      setIsBulkDeleting(true);
      setActionError(null);
      setActionSuccess(null);

      const toDelete: Array<{ id: string; providerId?: string }> = [];
      models.forEach((m: any) => {
        const key = `${m.providerId || 'google'}::${m.id}`;
        if (selectedModelKeys.has(key)) {
          toDelete.push({ id: m.id, providerId: m.providerId });
        }
      });

      await bulkDeleteModels(toDelete);
      setActionSuccess(`Successfully deleted ${toDelete.length} model(s) from catalog.`);
      setSelectedModelKeys(new Set());
      setShowConfirmBulkDelete(false);
      setBulkMode(false);
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete selected models.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Execute enable/disable toggle
  const handleToggleEnable = async (model: any) => {
    const key = `${model.providerId || 'google'}::${model.id}`;
    const nextState = model.enabled === false;
    try {
      setTogglingKey(key);
      setActionError(null);
      await toggleModelEnabled(model.id, nextState, model.providerId);
      setActionSuccess(
        `Model "${model.displayName || model.id}" is now ${nextState ? 'enabled' : 'disabled'}.`
      );
    } catch (err: any) {
      setActionError(err.message || 'Failed to toggle model state.');
    } finally {
      setTogglingKey(null);
    }
  };

  // Execute Reset Defaults
  const executeResetDefaults = async () => {
    try {
      setIsResetting(true);
      setActionError(null);
      await resetDefaultModels();
      setActionSuccess('Baseline Gemini models restored successfully.');
      setShowConfirmReset(false);
    } catch (err: any) {
      setActionError(err.message || 'Failed to restore default models.');
    } finally {
      setIsResetting(false);
    }
  };

  // Handle Add Model submit
  const handleAddModelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelId.trim()) {
      setAddModalError('Model ID is required.');
      return;
    }

    const caps = Object.entries(newCapabilities)
      .filter(([_, checked]) => checked)
      .map(([name]) => name);

    try {
      setIsAdding(true);
      setAddModalError(null);
      await addModel({
        id: newModelId.trim(),
        displayName: newDisplayName.trim() || newModelId.trim(),
        providerId: newProviderId,
        tier: newTier,
        capabilities: caps.length > 0 ? caps : ['text'],
        contextWindow: newContextWindow ? Number(newContextWindow) : undefined,
        enabled: true,
      });

      setShowAddModal(false);
      setNewModelId('');
      setNewDisplayName('');
      setNewContextWindow('1048576');
      setActionSuccess(`Model "${newDisplayName || newModelId}" registered successfully.`);
    } catch (err: any) {
      setAddModalError(err.message || 'Failed to register model.');
    } finally {
      setIsAdding(false);
    }
  };

  if (loading && models.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400 font-mono text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-indigo-400" /> Loading models catalog...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-5 rounded-xl border border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white font-mono">Model Registry & Catalog</h2>
            <span className="px-2 py-0.5 bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs rounded-full font-mono font-bold">
              {models.length} Registered Model{models.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-mono mt-1">
            Registered AI models for generation tasks. Remove unwanted models so only active, approved models are used.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setAddModalError(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-lg transition shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Model
          </button>

          <button
            onClick={() => {
              setBulkMode(!bulkMode);
              if (bulkMode) setSelectedModelKeys(new Set());
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono rounded-lg transition border ${
              bulkMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 font-bold'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/5'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            {bulkMode ? 'Cancel Selection' : 'Bulk Select'}
          </button>

          <button
            onClick={() => setShowConfirmReset(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono rounded-lg transition border border-white/5"
            title="Restore default Google Gemini baseline models"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restore Defaults
          </button>

          <button
            onClick={() => refresh()}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono rounded-lg transition border border-white/5 disabled:opacity-50"
            title="Refresh models catalog"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Action Notification Messages */}
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
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-zinc-900/60 p-4 rounded-xl border border-white/5 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by model ID, display name, or provider..."
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

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Provider Filter */}
          <div className="flex items-center gap-1.5 bg-zinc-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono">
            <span className="text-zinc-500 text-[11px]">Provider:</span>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-zinc-900 text-zinc-200">All Providers</option>
              {availableProviders.map((p) => (
                <option key={p} value={p} className="bg-zinc-900 text-zinc-200">
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Tier Filter */}
          {availableTiers.length > 0 && (
            <div className="flex items-center gap-1.5 bg-zinc-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono">
              <span className="text-zinc-500 text-[11px]">Tier:</span>
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-zinc-900 text-zinc-200">All Tiers</option>
                {availableTiers.map((t) => (
                  <option key={t} value={t} className="bg-zinc-900 text-zinc-200">
                    {t.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-zinc-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono">
            <span className="text-zinc-500 text-[11px]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-zinc-900 text-zinc-200">All</option>
              <option value="enabled" className="bg-zinc-900 text-zinc-200">Enabled</option>
              <option value="disabled" className="bg-zinc-900 text-zinc-200">Disabled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {bulkMode && (
        <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3 flex items-center justify-between gap-4 font-mono text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleSelectAll}
              className="flex items-center gap-1.5 text-indigo-300 hover:text-white px-2 py-1 rounded bg-indigo-900/50 border border-indigo-700/50"
            >
              {selectedModelKeys.size === filteredModels.length && filteredModels.length > 0 ? (
                <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
              ) : (
                <Square className="w-3.5 h-3.5 text-zinc-400" />
              )}
              <span>{selectedModelKeys.size === filteredModels.length ? 'Deselect All' : 'Select All Filtered'}</span>
            </button>
            <span className="text-zinc-300 font-bold">
              {selectedModelKeys.size} model{selectedModelKeys.size === 1 ? '' : 's'} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfirmBulkDelete(true)}
              disabled={selectedModelKeys.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected ({selectedModelKeys.size})
            </button>
          </div>
        </div>
      )}

      {/* Model Cards Grid */}
      {filteredModels.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/40 rounded-xl border border-dashed border-white/10 space-y-3">
          <Cpu className="w-10 h-10 text-zinc-600 mx-auto" />
          <div className="text-zinc-300 font-mono text-sm font-bold">No models match your current filters</div>
          <p className="text-zinc-500 font-mono text-xs max-w-md mx-auto">
            {models.length === 0
              ? 'No models are currently registered. You can add custom models or restore baseline defaults.'
              : 'Try clearing the search query or adjusting the provider / tier filters.'}
          </p>
          {models.length === 0 && (
            <button
              onClick={() => setShowConfirmReset(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-lg transition inline-flex items-center gap-2 mt-2"
            >
              <RotateCcw className="w-4 h-4" /> Restore Default Models
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredModels.map((m: any) => {
            const modelKey = `${m.providerId || 'google'}::${m.id}`;
            const isSelected = selectedModelKeys.has(modelKey);
            const hStatus = modelHealth[m.id]?.status || (m.enabled !== false ? 'healthy' : 'disabled');
            const isHealthy = hStatus === 'healthy';
            const isLive = m.enabled !== false;
            const isDeleting = deletingKey === modelKey;
            const isToggling = togglingKey === modelKey;

            // Parse capabilities
            const capabilitiesList: string[] = Array.isArray(m.capabilities)
              ? m.capabilities
              : Object.entries(m.capabilities || {})
                  .filter(([_, enabled]) => !!enabled)
                  .map(([key]) => key);

            return (
              <div
                key={modelKey}
                className={`bg-zinc-900/80 border rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition ${
                  isSelected
                    ? 'border-indigo-500/60 bg-indigo-950/20'
                    : isLive
                    ? 'border-white/5 hover:border-indigo-500/30'
                    : 'border-white/5 opacity-70 bg-zinc-950/40'
                }`}
              >
                {/* Left: Selection + Info */}
                <div className="flex items-start gap-3">
                  {bulkMode && (
                    <button
                      onClick={() => handleToggleSelect(modelKey)}
                      className="mt-1 text-zinc-400 hover:text-indigo-400 transition"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={`p-2 rounded-lg border ${
                        isLive ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'bg-zinc-800 text-zinc-500 border-white/5'
                      }`}>
                        <Cpu className="w-4 h-4" />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-mono text-sm">
                          {m.displayName || m.name || m.id}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500">({m.id})</span>
                      </div>

                      {/* Provider Badge */}
                      <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 font-mono text-[10px] rounded border border-white/5 uppercase font-medium">
                        {m.providerId || 'google'}
                      </span>

                      {/* Tier Badge */}
                      {m.tier && (
                        <span className="px-2 py-0.5 bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 font-mono text-[10px] rounded uppercase font-bold">
                          {m.tier}
                        </span>
                      )}

                      {/* Status Badge */}
                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono rounded-full font-bold uppercase ${
                          isLive && isHealthy
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : isLive
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-zinc-800 text-zinc-400 border border-white/5'
                        }`}
                      >
                        {isLive ? 'Active in Routing' : 'Disabled'}
                      </span>
                    </div>

                    {/* Capabilities Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pl-0.5">
                      {capabilitiesList.map((cap) => (
                        <span
                          key={cap}
                          className="px-2 py-0.5 bg-zinc-800/80 text-zinc-300 border border-white/5 text-[10px] font-mono rounded uppercase"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Metrics & Actions */}
                <div className="flex flex-wrap items-center gap-5 text-xs font-mono w-full md:w-auto justify-between md:justify-end pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                  {m.contextWindow && (
                    <div className="text-right">
                      <div className="text-zinc-500 text-[10px]">CONTEXT WINDOW</div>
                      <div className="text-indigo-300 font-bold mt-0.5">
                        {m.contextWindow >= 1000000
                          ? `${(m.contextWindow / 1000000).toFixed(m.contextWindow % 1000000 === 0 ? 0 : 1)}M tokens`
                          : `${m.contextWindow.toLocaleString()} tokens`}
                      </div>
                    </div>
                  )}

                  {/* Actions Group */}
                  <div className="flex items-center gap-2">
                    {/* Toggle Enable/Disable Button */}
                    <button
                      onClick={() => handleToggleEnable(m)}
                      disabled={isToggling}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition ${
                        isLive
                          ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/10'
                          : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/50'
                      }`}
                      title={isLive ? 'Disable model in routing' : 'Enable model for routing'}
                    >
                      {isToggling ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                      ) : isLive ? (
                        <>
                          <Power className="w-3.5 h-3.5 text-zinc-400" />
                          <span className="hidden sm:inline">Disable</span>
                        </>
                      ) : (
                        <>
                          <PowerOff className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Enable</span>
                        </>
                      )}
                    </button>

                    {/* Delete Model Button */}
                    <button
                      onClick={() => setConfirmDeleteModel(m)}
                      disabled={isDeleting}
                      className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition border border-transparent hover:border-rose-500/20"
                      title={`Delete model "${m.displayName || m.id}"`}
                    >
                      {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono">Delete Model from Catalog?</h3>
            </div>

            <p className="text-xs text-zinc-300 font-mono leading-relaxed">
              Are you sure you want to delete model{' '}
              <span className="text-white font-bold font-mono px-1.5 py-0.5 bg-zinc-800 rounded">
                {confirmDeleteModel.displayName || confirmDeleteModel.id}
              </span>{' '}
              (Provider: <span className="text-indigo-300 font-bold">{confirmDeleteModel.providerId || 'google'}</span>)?
            </p>
            <p className="text-[11px] text-zinc-500 font-mono">
              The AI Gateway will immediately stop dispatching generation tasks to this model. Only remaining models in this catalog will be used for execution.
            </p>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteModel(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeDeleteModel(confirmDeleteModel)}
                disabled={deletingKey !== null}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold rounded-lg transition flex items-center gap-2 shadow-lg shadow-rose-600/20"
              >
                {deletingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Model</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showConfirmBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono">
                Delete {selectedModelKeys.size} Selected Model{selectedModelKeys.size === 1 ? '' : 's'}?
              </h3>
            </div>

            <p className="text-xs text-zinc-300 font-mono leading-relaxed">
              This will permanently remove all <strong className="text-white">{selectedModelKeys.size}</strong> selected models from the catalog. Only un-deleted models will remain available for AI generation.
            </p>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmBulkDelete(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeBulkDelete}
                disabled={isBulkDeleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold rounded-lg transition flex items-center gap-2 shadow-lg shadow-rose-600/20"
              >
                {isBulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Selected</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Baseline Defaults Modal */}
      {showConfirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-indigo-400">
              <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono">Restore Baseline Gemini Models?</h3>
            </div>

            <p className="text-xs text-zinc-300 font-mono leading-relaxed">
              This will re-register the standard baseline Google Gemini models (Gemini 3.7 Flash, Gemini 2.5 Pro, and Gemini 3.5 Flash Lite) to ensure core platform tasks operate reliably.
            </p>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmReset(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeResetDefaults}
                disabled={isResetting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-lg transition flex items-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>Restore Baseline</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Model Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <Cpu className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white font-mono">Register Custom AI Model</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddModelSubmit} className="space-y-4">
              {addModalError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs font-mono flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{addModalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">Provider</label>
                <select
                  value={newProviderId}
                  onChange={(e) => setNewProviderId(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                >
                  {availableProviders.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">Model ID</label>
                <input
                  type="text"
                  placeholder="e.g. gpt-4o, deepseek-v3, llama3-70b"
                  value={newModelId}
                  onChange={(e) => setNewModelId(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. DeepSeek V3 (Chat)"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1.5">Tier</label>
                  <select
                    value={newTier}
                    onChange={(e) => setNewTier(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                  >
                    <option value="flash">Flash (Fast)</option>
                    <option value="pro">Pro (Reasoning)</option>
                    <option value="lite">Lite (Low cost)</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1.5">Context Window</label>
                  <input
                    type="number"
                    placeholder="1048576"
                    value={newContextWindow}
                    onChange={(e) => setNewContextWindow(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-2">Capabilities</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.keys(newCapabilities).map((cap) => (
                    <label key={cap} className="flex items-center gap-2 text-xs font-mono text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newCapabilities[cap]}
                        onChange={(e) =>
                          setNewCapabilities({ ...newCapabilities, [cap]: e.target.checked })
                        }
                        className="rounded border-zinc-700 text-indigo-600 focus:ring-0 bg-zinc-950"
                      />
                      <span className="capitalize">{cap}</span>
                    </label>
                  ))}
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
                  disabled={isAdding || !newModelId.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                >
                  {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Register Model</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
