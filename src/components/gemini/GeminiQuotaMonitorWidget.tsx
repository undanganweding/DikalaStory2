import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Key,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Zap,
  Clock,
  ChevronDown,
  Plus,
  Check,
  Activity,
  Layers,
  Cpu,
} from 'lucide-react';

export interface GeminiKeyQuotaInfo {
  id: string;
  masked_key: string;
  provider: 'google_gemini';
  priority: number;
  enabled: boolean;
  status: 'healthy' | 'warning' | 'rate_limited' | 'error' | 'exhausted' | 'blocked';
  quota_rpm: number;
  quota_rpd: number;
  quota_tpm: number;
  rpm_used: number;
  rpd_used: number;
  tokens_used: number;
  remaining_rpm: number;
  remaining_rpd: number;
  cooldown_seconds: number;
  latency_ms: number;
  success_rate: number;
  models_health?: Record<string, { status: string; cooldown_sec: number }>;
  is_selected: boolean;
}

export interface RealtimeQuotaResponse {
  summary: {
    total_keys: number;
    active_keys: number;
    rate_limited_keys: number;
    total_requests_today: number;
    total_tokens_today: number;
    selected_key_id: string;
  };
  keys: GeminiKeyQuotaInfo[];
  available_models: Array<{
    id: string;
    name: string;
    badge?: string;
    tier: string;
  }>;
}

interface GeminiQuotaMonitorWidgetProps {
  projectId?: string;
  compact?: boolean;
  onKeySelected?: (keyId: string) => void;
}

export const GeminiQuotaMonitorWidget: React.FC<GeminiQuotaMonitorWidgetProps> = ({
  projectId,
  compact = false,
  onKeySelected,
}) => {
  const [data, setData] = useState<RealtimeQuotaResponse | null>(null);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [showAddKeyModal, setShowAddKeyModal] = useState<boolean>(false);
  const [newKeyName, setNewKeyName] = useState<string>('');
  const [newApiKey, setNewApiKey] = useState<string>('');
  const [newQuotaRpd, setNewQuotaRpd] = useState<number>(1500);
  const [syncFeedback, setSyncFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchQuotaData = async (activeId?: string) => {
    try {
      const url = activeId
        ? `/api/gemini/quota-realtime?selectedKeyId=${encodeURIComponent(activeId)}`
        : '/api/gemini/quota-realtime';
      const res = await fetch(url);
      if (res.ok) {
        const json: RealtimeQuotaResponse = await res.json();
        setData(json);
        if (!selectedKeyId || !json.keys.some((k) => k.id === selectedKeyId)) {
          setSelectedKeyId(json.summary.selected_key_id || json.keys[0]?.id || '');
        }
      }
    } catch (err) {
      console.warn('[GeminiQuotaWidget] Error fetching realtime quota:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotaData();
    const interval = setInterval(() => {
      fetchQuotaData(selectedKeyId);
    }, 6000);
    return () => clearInterval(interval);
  }, [selectedKeyId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectKey = async (keyId: string) => {
    setIsDropdownOpen(false);
    setSelectedKeyId(keyId);
    try {
      const res = await fetch('/api/gemini/select-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId, projectId }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.quota) setData(result.quota);
        if (onKeySelected) onKeySelected(keyId);
        setSyncFeedback({ success: true, message: `API Key ${keyId} aktif untuk proyek!` });
        setTimeout(() => setSyncFeedback(null), 3000);
      }
    } catch (err: any) {
      setSyncFeedback({ success: false, message: err.message || 'Gagal memilih API Key' });
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const handleLiveSync = async () => {
    if (!selectedKeyId) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/gemini/sync-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId: selectedKeyId }),
      });
      const json = await res.json();
      if (res.ok && json.test?.success) {
        if (json.quota) setData(json.quota);
        setSyncFeedback({
          success: true,
          message: `Sync Berhasil: Latensi ${json.test.latency}ms, status kuota real-time aktif!`,
        });
      } else {
        setSyncFeedback({
          success: false,
          message: json.test?.message || json.error || 'Sinkronisasi kuota gagal atau kena batas rate limit.',
        });
      }
    } catch (err: any) {
      setSyncFeedback({ success: false, message: err.message || 'Error koneksi API' });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 4500);
    }
  };

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApiKey.trim()) return;
    try {
      const res = await fetch('/api/gemini/add-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyName: newKeyName,
          apiKey: newApiKey,
          quotaRpd: newQuotaRpd,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.quota) setData(json.quota);
        setSelectedKeyId(json.keyId);
        setShowAddKeyModal(false);
        setNewKeyName('');
        setNewApiKey('');
        setSyncFeedback({ success: true, message: 'Google Gemini API Key baru berhasil ditambahkan!' });
        setTimeout(() => setSyncFeedback(null), 3000);
      }
    } catch (err: any) {
      setSyncFeedback({ success: false, message: err.message || 'Gagal menambahkan API Key' });
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const activeKey = data?.keys.find((k) => k.id === selectedKeyId) || data?.keys[0];

  const getStatusBadge = (status?: string, cooldownSec = 0) => {
    if (cooldownSec > 0 || status === 'rate_limited') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
          <Clock className="w-3 h-3 animate-spin" />
          <span>Batas Kuota ({cooldownSec}s)</span>
        </span>
      );
    }
    if (status === 'healthy') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          <Check className="w-3 h-3" />
          <span>Kuotanya Aktif & Sinkron</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
        <AlertTriangle className="w-3 h-3" />
        <span>Terkendala</span>
      </span>
    );
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 bg-zinc-900/90 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono">
        <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span className="text-zinc-300 font-bold truncate max-w-[120px]">
          {activeKey ? activeKey.id : 'Gemini Key'}
        </span>
        {activeKey && getStatusBadge(activeKey.status, activeKey.cooldown_seconds)}
        <button
          onClick={handleLiveSync}
          disabled={isSyncing}
          className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition cursor-pointer"
          title="Sinkronisasi Kuota Real-Time"
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-b from-zinc-950/90 to-zinc-900/90 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md relative overflow-hidden">
      {/* Background Accent Glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold text-white">
                Google Gemini Real-Time Quota & API Key
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
                Official Google Engine
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Info kapasitas kuota harian, RPM & status rate-limit tersinkronisasi langsung per API Key project.
            </p>
          </div>
        </div>

        {/* Sync & Refresh Button */}
        <div className="flex items-center gap-2">
          <button
            id="btn-gemini-sync-quota"
            onClick={handleLiveSync}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-mono font-bold text-xs shadow-md shadow-blue-600/20 transition cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Kuota'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast Banner */}
      {syncFeedback && (
        <div
          className={`mb-3 px-3 py-2 rounded-xl text-xs font-mono font-semibold flex items-center gap-2 border ${
            syncFeedback.success
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40'
              : 'bg-rose-950/40 text-rose-300 border-rose-500/40'
          }`}
        >
          {syncFeedback.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{syncFeedback.message}</span>
        </div>
      )}

      {/* Main Quota & Key Selector Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-4">
        {/* API Key Selector Dropdown */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-bold mb-1 block">
            API Key Google Terpilih:
          </span>

          <div className="relative" ref={dropdownRef}>
            <button
              id="dropdown-gemini-key-select"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-left flex items-center justify-between text-xs font-mono text-white transition cursor-pointer"
            >
              <div className="flex items-center gap-2 truncate">
                <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-bold truncate">{activeKey ? activeKey.id : 'Pilih Google API Key'}</span>
                {activeKey && <span className="text-zinc-500 text-[11px]">({activeKey.masked_key})</span>}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-1" />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-zinc-900 border border-white/15 rounded-xl shadow-2xl z-30 max-h-52 overflow-y-auto p-1 text-xs font-mono">
                {data?.keys.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => handleSelectKey(k.id)}
                    className={`w-full px-2.5 py-2 rounded-lg flex items-center justify-between text-left transition cursor-pointer mb-1 ${
                      k.id === selectedKeyId ? 'bg-blue-600/30 text-white border border-blue-500/40' : 'hover:bg-white/5 text-zinc-300'
                    }`}
                  >
                    <div className="flex flex-col truncate">
                      <span className="font-bold truncate">{k.id}</span>
                      <span className="text-[10px] text-zinc-500">{k.masked_key}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {k.status === 'healthy' ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                      )}
                      {k.id === selectedKeyId && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </div>
                  </button>
                ))}

                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setShowAddKeyModal(true);
                  }}
                  className="w-full px-2.5 py-2 mt-1 rounded-lg bg-white/5 hover:bg-white/10 text-blue-400 font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border-t border-white/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Tambah Google API Key Baru</span>
                </button>
              </div>
            )}
          </div>

          <div className="mt-2.5 flex items-center justify-between">
            {activeKey && getStatusBadge(activeKey.status, activeKey.cooldown_seconds)}
            <span className="text-[10px] font-mono text-zinc-400">
              Latensi: <strong className="text-zinc-200">{activeKey?.latency_ms || 120}ms</strong>
            </span>
          </div>
        </div>

        {/* Quota Gauge 1: Daily Requests (RPD) */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-bold">
              Kuota Harian (RPD)
            </span>
            <span className="text-xs font-mono font-bold text-amber-400">
              {activeKey ? `${activeKey.rpd_used} / ${activeKey.quota_rpd}` : '0 / 1500'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden my-2 border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-amber-400 rounded-full transition-all duration-500"
              style={{
                width: `${activeKey ? Math.min(100, Math.round((activeKey.rpd_used / activeKey.quota_rpd) * 100)) : 0}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
            <span>Sisa Kuota Hari Ini:</span>
            <strong className="text-emerald-400 font-extrabold">
              {activeKey ? activeKey.remaining_rpd : 1500} Request
            </strong>
          </div>
        </div>

        {/* Quota Gauge 2: Requests Per Minute (RPM) & Throughput */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-bold">
              Batas Menit (RPM)
            </span>
            <span className="text-xs font-mono font-bold text-blue-400">
              {activeKey ? `${activeKey.rpm_used} / ${activeKey.quota_rpm} RPM` : '0 / 15 RPM'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden my-2 border border-white/5">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{
                width: `${activeKey ? Math.min(100, Math.round((activeKey.rpm_used / activeKey.quota_rpm) * 100)) : 0}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
            <span>Tokens Hari Ini:</span>
            <strong className="text-zinc-200">
              {activeKey ? activeKey.tokens_used.toLocaleString() : '0'} Tokens
            </strong>
          </div>
        </div>
      </div>

      {/* Model Health Quick Grid */}
      {activeKey && (
        <div className="bg-zinc-950/60 border border-white/5 rounded-xl p-3">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-bold block mb-2">
            Status Ketersediaan Model Gemini:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-2.5-pro', 'gemini-2.5-flash'].map((mId) => {
              const mHealth = activeKey.models_health?.[mId];
              const isCooling = mHealth && mHealth.cooldown_sec > 0;
              return (
                <div
                  key={mId}
                  className="bg-black/40 border border-white/5 rounded-lg p-2 flex items-center justify-between text-[11px] font-mono"
                >
                  <span className="text-zinc-300 font-semibold truncate mr-1">
                    {mId.replace('gemini-', '')}
                  </span>
                  {isCooling ? (
                    <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">
                      {mHealth.cooldown_sec}s
                    </span>
                  ) : (
                    <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                      Tersedia ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add New Key Modal */}
      {showAddKeyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-white/15 rounded-2xl p-6 shadow-2xl">
            <h4 className="text-base font-extrabold text-white mb-1 flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-400" />
              <span>Tambah Google Gemini API Key</span>
            </h4>
            <p className="text-xs text-zinc-400 mb-4">
              Kunci API akan disimpan aman di server vault dan disinkronkan ke kuota real-time.
            </p>

            <form onSubmit={handleAddKey} className="space-y-3.5">
              <div>
                <label className="text-xs font-mono text-zinc-300 block mb-1">Nama / Label Project Slot:</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Contoh: gemini-project-utama"
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white font-mono focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-zinc-300 block mb-1">
                  Google Gemini API Key (AIzaSy...):
                </label>
                <input
                  type="password"
                  required
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder="Masukkan AIzaSy..."
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white font-mono focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-zinc-300 block mb-1">Batas Quota Harian (RPD):</label>
                <input
                  type="number"
                  value={newQuotaRpd}
                  onChange={(e) => setNewQuotaRpd(parseInt(e.target.value, 10) || 1500)}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white font-mono focus:border-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddKeyModal(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-xs shadow-lg shadow-blue-600/30 transition cursor-pointer"
                >
                  Simpan & Sinkronkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
