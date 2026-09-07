import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Cpu,
  Key,
  RefreshCw,
  Zap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  ShieldCheck,
  Star,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';

export interface GeminiCredential {
  id: string;
  name: string;
  maskedKey: string;
  priority: number;
  weight: number;
  status: string;
  isPrimary: boolean;
  providerId?: string;
  providerName?: string;
}

export interface GeminiModelStatus {
  id: string;
  displayName: string;
  tier: 'flash' | 'pro';
  description: string;
  contextWindow: string;
  maxOutput: string;
  pricingTier: string;
  role: string;
  status: 'ready' | 'cooldown' | 'warning';
  isSuppressed: boolean;
  remainingCooldownSeconds: number;
  requestsToday: number;
  successRate: number;
  lastUsedAt: number | null;
  lastError: string | null;
}

export interface GeminiQuotaOverview {
  hasCredentials: boolean;
  credentials: GeminiCredential[];
  selectedCredential: {
    id: string;
    name: string;
    maskedKey: string;
    priority: number;
    status: string;
    providerId?: string;
    providerName?: string;
  } | null;
  provider?: {
    id: string;
    name: string;
    isCustom?: boolean;
  };
  metrics: {
    requestsToday: number;
    tokensToday: number;
    successRate: number;
    activeModelsCount: number;
    suppressedModelsCount: number;
  };
  models: GeminiModelStatus[];
  timestamp: number;
}

export const GeminiRealtimeQuotaPanel: React.FC<{
  onRefreshParent?: () => void;
  compact?: boolean;
}> = ({ onRefreshParent, compact = false }) => {
  const [data, setData] = useState<GeminiQuotaOverview | null>(null);
  const [selectedCredId, setSelectedCredId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProbing, setIsProbing] = useState<Record<string, boolean>>({});
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isSettingPrimary, setIsSettingPrimary] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('gemini_quota_panel_expanded');
      return saved !== null ? JSON.parse(saved) : false; // Default compact as requested
    } catch {
      return false;
    }
  });
  const [isCardsExpanded, setIsCardsExpanded] = useState<boolean>(true);

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('gemini_quota_panel_expanded', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const fetchQuotaOverview = useCallback(async (credId?: string) => {
    try {
      setIsLoading(true);
      const targetId = credId !== undefined ? credId : selectedCredId;
      const url = targetId
        ? `/api/ai/gemini/quota-overview?credentialId=${encodeURIComponent(targetId)}`
        : '/api/ai/gemini/quota-overview';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: GeminiQuotaOverview = await res.json();
      setData(json);
      if (json.selectedCredential && (!selectedCredId || credId !== undefined)) {
        setSelectedCredId(json.selectedCredential.id);
      }
    } catch (err: any) {
      console.error('Gagal mengambil telemetry kuota Gemini:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCredId]);

  useEffect(() => {
    fetchQuotaOverview();
    const interval = setInterval(() => {
      // Periodic background silent sync every 15s
      fetch(selectedCredId ? `/api/ai/gemini/quota-overview?credentialId=${encodeURIComponent(selectedCredId)}` : '/api/ai/gemini/quota-overview')
        .then(r => r.json())
        .then(json => {
          setData(prev => {
            if (!prev) return json;
            return {
              ...json,
              // keep existing selected ID
            };
          });
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchQuotaOverview, selectedCredId]);

  // Local second-by-second countdown for remaining cooldowns
  useEffect(() => {
    const timer = setInterval(() => {
      setData(prev => {
        if (!prev) return null;
        let hasChanges = false;
        const updatedModels = prev.models.map(m => {
          if (m.remainingCooldownSeconds > 0) {
            hasChanges = true;
            const nextSec = m.remainingCooldownSeconds - 1;
            return {
              ...m,
              remainingCooldownSeconds: nextSec,
              isSuppressed: nextSec > 0,
              status: nextSec > 0 ? ('cooldown' as const) : ('ready' as const),
            };
          }
          return m;
        });
        if (!hasChanges) return prev;
        return {
          ...prev,
          models: updatedModels,
          metrics: {
            ...prev.metrics,
            suppressedModelsCount: updatedModels.filter(m => m.isSuppressed).length,
            activeModelsCount: updatedModels.filter(m => !m.isSuppressed).length,
          },
        };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCredentialChange = (newCredId: string) => {
    setSelectedCredId(newCredId);
    fetchQuotaOverview(newCredId);
  };

  const handleSetPrimary = async () => {
    if (!selectedCredId) return;
    try {
      setIsSettingPrimary(true);
      setActionMessage({ type: 'info', text: 'Memperbarui prioritas kredensial...' });
      const res = await fetch('/api/ai/gemini/set-primary-credential', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId: selectedCredId }),
      });
      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Gagal mengubah primary key');
      setActionMessage({ type: 'success', text: resJson.message });
      await fetchQuotaOverview(selectedCredId);
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setIsSettingPrimary(false);
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  const handleProbeModel = async (modelId: string) => {
    try {
      setIsProbing(prev => ({ ...prev, [modelId]: true }));
      setActionMessage({ type: 'info', text: `Menguji konektivitas & kuota ${modelId} ke Google upstream...` });
      const res = await fetch('/api/ai/gemini/probe-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentialId: selectedCredId,
          modelId,
        }),
      });
      const resJson = await res.json();
      if (resJson.success) {
        setActionMessage({
          type: 'success',
          text: `[${modelId}] ${resJson.message} (${resJson.latencyMs}ms)`,
        });
      } else {
        setActionMessage({
          type: 'error',
          text: `[${modelId}] ${resJson.message} (${resJson.latencyMs}ms)`,
        });
      }
      await fetchQuotaOverview(selectedCredId);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `Gagal probe model ${modelId}: ${err.message}` });
    } finally {
      setIsProbing(prev => ({ ...prev, [modelId]: false }));
      setTimeout(() => setActionMessage(null), 7000);
    }
  };

  const handleProbeAll = async () => {
    if (!data || data.models.length === 0) return;
    for (const m of data.models) {
      await handleProbeModel(m.id);
    }
  };

  const credentials = data?.credentials || [];
  const selectedCred = data?.selectedCredential;
  const metrics = data?.metrics || { requestsToday: 0, tokensToday: 0, successRate: 100, activeModelsCount: 0, suppressedModelsCount: 0 };
  const models = data?.models || [];
  const isCurrentPrimary = selectedCred?.priority === 1;

  const groupedCredentials = useMemo(() => {
    const groups: Record<string, GeminiCredential[]> = {};
    for (const cred of credentials) {
      const gName = cred.providerName || (cred.providerId === 'google' ? 'Google Gemini' : (cred.providerId || 'AI Provider'));
      if (!groups[gName]) {
        groups[gName] = [];
      }
      groups[gName].push(cred);
    }
    return groups;
  }, [credentials]);

  if (!data && isLoading) {
    return (
      <div className="bg-[#141624] border border-[#23253A] rounded-2xl p-5 flex items-center justify-center gap-3 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
        <span className="text-xs font-medium">Menghubungkan ke AI Quota Telemetry...</span>
      </div>
    );
  }

  if (!isExpanded) {
    return (
      <div className="bg-[#141624] border border-[#23253A] rounded-2xl shadow-md p-3 sm:px-4 sm:py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in duration-150">
        {/* Left Side: Summary Telemetry */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 shrink-0">
            <Cpu className="w-4 h-4" />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black text-white tracking-tight flex items-center gap-1.5">
              <span>Monitor Kuota AI</span>
              {selectedCred?.providerName && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium">
                  {selectedCred.providerName}
                </span>
              )}
            </span>

            {/* Model Ready Status Pill */}
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {metrics.activeModelsCount}/{models.length} Model Siap
            </span>

            {/* Active Key Info */}
            <span className="text-[11px] font-mono text-slate-400 bg-[#10121E] px-2 py-0.5 rounded-md border border-[#23253A]">
              Key: <strong className="text-slate-200">{selectedCred?.name || 'Primary'}</strong> ({selectedCred?.maskedKey || 'sk-...'})
            </span>

            {/* Total Stored Keys Pill */}
            <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
              {credentials.length} Key Tersimpan
            </span>

            {/* Daily Usage Summary */}
            <span className="hidden xl:inline-flex text-[11px] text-slate-400">
              • <strong className="text-indigo-300 ml-1 mr-0.5">{metrics.requestsToday}</strong> calls
              • <strong className="text-amber-300 ml-1 mr-0.5">{metrics.tokensToday.toLocaleString()}</strong> tokens
              • <strong className="text-emerald-400 ml-1 mr-0.5">{metrics.successRate}%</strong> success
            </span>
          </div>
        </div>

        {/* Right Side: Quick Action & Expand Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {credentials.length > 1 && (
            <select
              value={selectedCredId}
              onChange={(e) => handleCredentialChange(e.target.value)}
              className="bg-[#10121E] border border-[#2A2D46] text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-xl focus:outline-none cursor-pointer max-w-[260px] truncate"
            >
              {Object.entries(groupedCredentials).map(([provName, list]) => (
                <optgroup key={provName} label={`▼ ${provName} (${list.length} Key)`} className="bg-[#141624] text-indigo-300 font-bold">
                  {list.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#181A2C] text-slate-200 font-normal">
                      {c.name} ({c.maskedKey}) {c.priority === 1 ? '★ P1' : `[P${c.priority}]`}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}

          <button
            onClick={() => fetchQuotaOverview(selectedCredId)}
            disabled={isLoading}
            className="p-1.5 bg-[#181A2C] hover:bg-[#23253A] border border-[#2D304A] text-slate-300 hover:text-white rounded-xl text-xs transition cursor-pointer"
            title="Refresh Telemetri Kuota"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          <button
            onClick={handleProbeAll}
            disabled={isLoading || Object.values(isProbing).some(Boolean)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-2.5 py-1.5 rounded-xl text-xs shadow-sm transition cursor-pointer"
            title="Live Sync Kuota Semua Model"
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sync Kuota</span>
          </button>

          <button
            onClick={toggleExpanded}
            className="flex items-center gap-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/35 text-indigo-300 hover:text-indigo-200 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
            title="Buka panel rincian kuota dan status model lengkap"
          >
            <span>Detail Kuota</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#141624] border border-[#23253A] rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-200">
      {/* Top Header & Key Selector */}
      <div className="p-4 sm:p-5 border-b border-[#23253A] bg-[#181A2C] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                Monitor &amp; Kuota AI Real-Time
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                {selectedCred?.providerName || 'AI Provider'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                {credentials.length} Kredensial Tersimpan
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Pantau kuota upstream, token usage hari ini, dan beralih antar API key yang tersimpan secara real-time.
            </p>
          </div>
        </div>

        {/* API Key Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {credentials.length > 0 ? (
            <div className="flex items-center gap-2 bg-[#10121E] border border-[#2A2D46] px-3 py-1.5 rounded-xl">
              <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-mono uppercase text-slate-400 font-bold leading-none">
                  Pilih API Key ({credentials.length} Total):
                </span>
                <select
                  value={selectedCredId}
                  onChange={(e) => handleCredentialChange(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-2 pt-0.5 max-w-[280px]"
                >
                  {Object.entries(groupedCredentials).map(([provName, list]) => (
                    <optgroup key={provName} label={`▼ ${provName} (${list.length} Key)`} className="bg-[#141624] text-indigo-300 font-bold">
                      {list.map((c) => (
                        <option key={c.id} value={c.id} className="bg-[#181A2C] text-slate-200 font-normal">
                          {c.name} ({c.maskedKey}) {c.priority === 1 ? '★ Primary (P1)' : `(Priority ${c.priority})`}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Belum ada API Key terpasang</span>
            </div>
          )}

          {!isCurrentPrimary && selectedCred && (
            <button
              onClick={handleSetPrimary}
              disabled={isSettingPrimary}
              className="flex items-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
              title="Jadikan Kredensial ini sebagai Prioritas Utama (Priority 1) untuk dieksekusi pertama kali"
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              Set Utama
            </button>
          )}

          <button
            onClick={() => fetchQuotaOverview(selectedCredId)}
            disabled={isLoading}
            className="flex items-center gap-1.5 bg-[#23253A] hover:bg-[#2D304A] border border-[#343754] text-slate-200 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
            title="Muat Ulang Telemetri Kuota"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleProbeAll}
            disabled={isLoading || Object.values(isProbing).some(Boolean)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-md shadow-indigo-600/25 transition cursor-pointer"
            title="Lakukan tes ping langsung ke model untuk memastikan kuota aktif"
          >
            <Zap className="w-3.5 h-3.5" />
            Live Sync Kuota
          </button>

          {/* Collapse Button */}
          <button
            onClick={toggleExpanded}
            className="flex items-center gap-1.5 bg-[#23253A] hover:bg-[#2D304A] border border-[#343754] text-slate-200 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            title="Ciutkan panel monitor"
          >
            <ChevronUp className="w-3.5 h-3.5 text-indigo-400" />
            <span>Ciutkan</span>
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          className={`px-4 py-2.5 text-xs font-medium flex items-center gap-2 border-b ${
            actionMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : actionMessage.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
          }`}
        >
          {actionMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {actionMessage.type === 'error' && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          {actionMessage.type === 'info' && <Activity className="w-4 h-4 text-indigo-400 animate-pulse shrink-0" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-[#10121E] border-b border-[#23253A]">
        <div className="bg-[#181A2C] border border-[#23253A] rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">API Key Terpilih</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                isCurrentPrimary ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700/50 text-slate-300'
              }`}
            >
              {isCurrentPrimary ? 'Primary (Tier 1)' : `Tier ${selectedCred?.priority || 1}`}
            </span>
          </div>
          <div className="text-sm font-black text-white mt-1 truncate">
            {selectedCred?.name || 'Environment GEMINI_API_KEY'}
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
            Key: {selectedCred?.maskedKey || 'sk-...'}
          </div>
        </div>

        <div className="bg-[#181A2C] border border-[#23253A] rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Total Request Hari Ini</span>
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-lg font-black text-indigo-300 mt-1">
            {metrics.requestsToday} <span className="text-xs font-normal text-slate-400">calls</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Success Rate: <span className="text-emerald-400 font-bold">{metrics.successRate}%</span>
          </div>
        </div>

        <div className="bg-[#181A2C] border border-[#23253A] rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Token Terpakai</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-black text-amber-300 mt-1">
            {metrics.tokensToday.toLocaleString()} <span className="text-xs font-normal text-slate-400">tokens</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Dihitung dari prompt + completion
          </div>
        </div>

        <div className="bg-[#181A2C] border border-[#23253A] rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Status Model Pool</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-black text-emerald-400 mt-1">
            {metrics.activeModelsCount} Siap <span className="text-xs font-normal text-slate-400">/ {models.length}</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {metrics.suppressedModelsCount > 0 ? (
              <span className="text-amber-400 font-semibold">{metrics.suppressedModelsCount} model dalam cooldown</span>
            ) : (
              <span className="text-emerald-400">Semua model siap dieksekusi</span>
            )}
          </div>
        </div>
      </div>

      {/* Model Quota Cards Grid (Collapsible) */}
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setIsCardsExpanded(!isCardsExpanded)}
            className="text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white flex items-center gap-2 transition cursor-pointer"
          >
            <span>Daftar Model &amp; Status Kuota Upstream</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#23253A] text-indigo-300 border border-[#2D304A] flex items-center gap-1">
              {isCardsExpanded ? 'Tutup Daftar' : `Buka ${models.length} Model`}
              {isCardsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </span>
          </button>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Dikelola otomatis oleh Dynamic Quota Router &amp; Fallback Cascade
          </span>
        </div>

        {isCardsExpanded ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {models.map((m) => {
              const isModelProbing = isProbing[m.id];
              return (
                <div
                  key={m.id}
                  className={`rounded-xl p-4 border transition-all ${
                    m.isSuppressed
                      ? 'bg-[#181524] border-amber-500/30'
                      : m.status === 'warning'
                      ? 'bg-[#181524] border-rose-500/30'
                      : 'bg-[#141624] border-[#282B42] hover:border-indigo-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white tracking-tight">{m.displayName}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            m.tier === 'pro'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {m.tier.toUpperCase()} TIER
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{m.id}</div>
                    </div>

                    {/* Status Pill */}
                    <div>
                      {m.isSuppressed ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
                          Cooldown ({m.remainingCooldownSeconds}s)
                        </span>
                      ) : m.status === 'warning' ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          Exhausted
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Kuota Siap
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Role Description */}
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    {m.description}
                  </p>

                  {/* Engine Role & Capability Tags */}
                  <div className="mt-2.5 pt-2.5 border-t border-[#23253A] flex flex-col gap-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-slate-400">Fungsi Pipeline:</span>
                      <span className="text-slate-300 font-medium text-right truncate max-w-[240px]" title={m.role}>
                        {m.role}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400 font-mono text-[10px]">
                      <span>Kapasitas Quota:</span>
                      <span className="text-indigo-300">{m.pricingTier}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400 font-mono text-[10px]">
                      <span>Context Window:</span>
                      <span className="text-slate-300">{m.contextWindow}</span>
                    </div>
                  </div>

                  {/* Bottom Action / Live Test Probe */}
                  <div className="mt-3 pt-2.5 border-t border-[#23253A] flex items-center justify-between gap-2">
                    <div className="text-[10px] text-slate-400">
                      {m.requestsToday > 0 ? (
                        <span>
                          Panggilan hari ini: <strong className="text-white">{m.requestsToday}</strong> ({m.successRate}% sukses)
                        </span>
                      ) : (
                        <span className="text-slate-400">Belum dipanggil sesi ini</span>
                      )}
                    </div>

                    <button
                      onClick={() => handleProbeModel(m.id)}
                      disabled={isModelProbing}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#23253A] hover:bg-indigo-600/30 hover:border-indigo-500/40 border border-[#2D304A] text-[11px] font-semibold text-slate-200 hover:text-white transition cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isModelProbing ? 'animate-spin text-indigo-400' : ''}`} />
                      {isModelProbing ? 'Pinging...' : 'Uji Ping Kuota'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#10121E] border border-[#23253A] rounded-xl p-3">
            {models.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 px-2 py-1">
                <span className="text-xs font-bold text-slate-300 truncate">{m.displayName}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
