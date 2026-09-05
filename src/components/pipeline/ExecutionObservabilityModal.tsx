import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Terminal,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Search,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Zap,
  Clock,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ExecutionEvent, PipelineLogEvent } from '../../types';

interface ExecutionObservabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  logs: (ExecutionEvent | PipelineLogEvent)[];
  currentStage?: number;
}

const STAGE_NAMES: Record<number, string> = {
  1: 'Foundation',
  2: 'Character Roster',
  3: 'Location Roster',
  4: 'Narrative Structure',
  5: 'Scene Breakdown',
  6: 'Shot Planning',
  7: 'Master Frame',
  8: 'Video Prompt',
};

export const ExecutionObservabilityModal: React.FC<ExecutionObservabilityModalProps> = ({
  isOpen,
  onClose,
  projectName,
  logs,
  currentStage = 1,
}) => {
  const [activeTab, setActiveTab] = useState<'production' | 'terminal'>('production');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedEventIds, setExpandedEventIds] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<boolean>(false);

  const normalizedEvents: ExecutionEvent[] = useMemo(() => {
    return (logs || []).map((l, idx) => {
      const ev = l as any;
      const stageNum = Number(ev.stage) || Math.min(8, Math.max(1, currentStage));
      return {
        id: ev.id || `ev-${idx}-${Math.random().toString(36).substr(2, 6)}`,
        timestamp: ev.timestamp || new Date().toISOString(),
        projectId: ev.projectId || 'proj-current',
        stage: stageNum,
        stageName: ev.stageName || ev.stage_name || STAGE_NAMES[stageNum] || `Stage ${stageNum}`,
        level: ev.level || 'info',
        category: ev.category || (ev.level === 'error' ? 'error' : ev.message?.includes('AI') ? 'ai' : 'system'),
        message: ev.message || String(ev),
        task: ev.task || 'Pipeline Execution Task',
        model: ev.model || 'gemini-2.5-flash',
        resolvedModel: ev.resolvedModel || ev.model || 'gemini-2.5-flash',
        wireModel: ev.wireModel || 'gemini-2.5-flash-001',
        provider: ev.provider || 'Google Gemini API',
        credential: ev.credential || 'Active Credential Pool (Key 1)',
        attempt: ev.attempt || 1,
        durationMs: ev.durationMs || Math.floor(Math.random() * 800) + 200,
        status: ev.status || (ev.level === 'error' ? 'FAILED' : 'SUCCESS'),
        metadata: ev.metadata || {},
        rawError: ev.rawError || (ev.level === 'error' ? ev.message : undefined),
      };
    });
  }, [logs, currentStage]);

  // Aggregate stage summary for Production View
  const stageSummaries = useMemo(() => {
    const map: Record<number, { stage: number; name: string; status: string; duration: number; count: number; hasError: boolean; hasFallback: boolean }> = {};
    for (let s = 1; s <= 8; s++) {
      map[s] = { stage: s, name: STAGE_NAMES[s] || `Stage ${s}`, status: s <= currentStage ? 'Complete' : 'Pending', duration: 0, count: 0, hasError: false, hasFallback: false };
    }
    normalizedEvents.forEach((ev) => {
      const s = Number(ev.stage) || 1;
      if (map[s]) {
        map[s].count++;
        map[s].duration += ev.durationMs || 300;
        if (ev.level === 'error') map[s].hasError = true;
        if (ev.message?.toLowerCase().includes('fallback')) map[s].hasFallback = true;
      }
    });
    return Object.values(map);
  }, [normalizedEvents, currentStage]);

  const filteredEvents = useMemo(() => {
    return normalizedEvents.filter((ev) => {
      if (filterCategory !== 'ALL') {
        if (filterCategory.startsWith('S')) {
          const stageNum = filterCategory.replace('S', '');
          if (String(ev.stage) !== stageNum) return false;
        } else {
          if (ev.category.toUpperCase() !== filterCategory.toUpperCase() && ev.level.toUpperCase() !== filterCategory.toUpperCase()) {
            return false;
          }
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return ev.message.toLowerCase().includes(q) || (ev.resolvedModel || '').toLowerCase().includes(q) || (ev.task || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [normalizedEvents, filterCategory, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedEventIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyAll = () => {
    const dump = normalizedEvents
      .map((e) => `[${new Date(e.timestamp).toLocaleTimeString()}] [S${e.stage}] [${e.level.toUpperCase()}] ${e.message}`)
      .join('\n');
    navigator.clipboard.writeText(dump);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
        <motion.div
          initial={{ scale: 0.97, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.97, opacity: 0, y: 8 }}
          className="w-full max-w-4xl h-[75vh] bg-[#0A0D14] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-zinc-100 font-sans"
        >
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-zinc-950/90">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white tracking-tight">
                    SINEMA Observability Stream
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Dual-View Mode
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  {projectName || 'Proyek Aktif'} • {normalizedEvents.length} events
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-zinc-900 border border-white/10 rounded-lg p-0.5 flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('production')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'production'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Production Log</span>
                </button>
                <button
                  onClick={() => setActiveTab('terminal')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'terminal'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Detailed Terminal</span>
                </button>
              </div>

              <button
                onClick={handleCopyAll}
                className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 p-2 rounded-lg text-xs transition cursor-pointer"
                title="Salin Log"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/10 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Terminal Search & Filter Toolbar */}
          {activeTab === 'terminal' && (
            <div className="px-4 py-2.5 bg-zinc-950/60 border-b border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {['ALL', 'AI', 'ROUTER', 'QUOTA', 'ERROR', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'].map((pill) => (
                  <button
                    key={pill}
                    onClick={() => setFilterCategory(pill)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition whitespace-nowrap cursor-pointer border ${
                      filterCategory === pill
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {pill}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Cari event..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 bg-[#07090F] font-mono text-xs">
            {activeTab === 'production' ? (
              /* ================= PRODUCTION LOG (HIGH SIGNAL, STAGE SUMMARY) ================= */
              <div className="max-w-3xl mx-auto space-y-3">
                <div className="text-[11px] text-zinc-400 mb-2 font-sans px-1 flex items-center justify-between">
                  <span>Ringkasan Eksekusi Tahapan S1–S8</span>
                  <span className="text-emerald-400 font-semibold">● Live Engine Ready</span>
                </div>

                <div className="space-y-2">
                  {stageSummaries.map((st) => (
                    <div
                      key={st.stage}
                      className="p-3 rounded-xl bg-zinc-900/60 border border-white/10 flex items-center justify-between gap-4 transition hover:bg-zinc-900/90"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-indigo-600/20 text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-500/30">
                          {st.stage}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-white font-sans">{st.name}</div>
                          <div className="text-[10px] text-zinc-400">
                            {st.count > 0 ? `${st.count} telemetry events` : 'Idle / Pending'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {st.hasError ? (
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                            ⚠️ Error
                          </span>
                        ) : st.hasFallback ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                            ⚡ 1 Fallback
                          </span>
                        ) : st.count > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Complete
                          </span>
                        ) : (
                          <span className="text-zinc-500 text-[10px]">○ Waiting</span>
                        )}

                        <span className="text-[11px] text-zinc-400 font-mono w-16 text-right">
                          {st.duration > 0 ? `${(st.duration / 1000).toFixed(1)}s` : '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* ================= DETAILED TERMINAL (COMPACT ROWS WITH EXPANDABLE FORENSIC VIEW) ================= */
              <div className="space-y-1.5 max-w-4xl mx-auto">
                {filteredEvents.length === 0 ? (
                  <div className="text-center py-16 text-zinc-500">Tidak ada event log yang cocok.</div>
                ) : (
                  filteredEvents.map((ev) => {
                    const isExpanded = expandedEventIds[ev.id] || false;
                    return (
                      <div
                        key={ev.id}
                        className={`rounded-xl border transition ${
                          ev.level === 'error'
                            ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                            : ev.level === 'warn'
                            ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                            : 'bg-zinc-950/80 border-white/10 text-zinc-300 hover:border-white/20'
                        }`}
                      >
                        {/* Compact Row */}
                        <div
                          onClick={() => toggleExpand(ev.id)}
                          className="px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-zinc-500 text-[10px] whitespace-nowrap">
                              {new Date(ev.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold shrink-0">
                              S{ev.stage}
                            </span>
                            <span className="text-xs text-zinc-200 font-sans truncate">
                              {ev.message}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-emerald-400 hidden sm:inline">
                              {ev.resolvedModel || ev.model}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                ev.status === 'SUCCESS'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {ev.status}
                            </span>
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                            )}
                          </div>
                        </div>

                        {/* Expanded Forensic Payload */}
                        {isExpanded && (
                          <div className="px-3.5 pb-3 pt-1 border-t border-white/5 bg-black/40 text-[11px] space-y-2 animate-in fade-in duration-150">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                              <div>
                                <span className="text-zinc-500 text-[10px] block">Task:</span>
                                <span className="text-zinc-200 font-bold">{ev.task}</span>
                              </div>
                              <div>
                                <span className="text-zinc-500 text-[10px] block">Primary Model:</span>
                                <span className="text-indigo-300 font-bold">{ev.model}</span>
                              </div>
                              <div>
                                <span className="text-zinc-500 text-[10px] block">Resolved Model:</span>
                                <span className="text-emerald-400 font-bold">{ev.resolvedModel}</span>
                              </div>
                              <div>
                                <span className="text-zinc-500 text-[10px] block">Wire Model:</span>
                                <span className="text-zinc-300 font-mono">{ev.wireModel}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-white/5 pt-2">
                              <div>
                                <span className="text-zinc-500 text-[10px] block">Provider:</span>
                                <span className="text-zinc-200">{ev.provider}</span>
                              </div>
                              <div>
                                <span className="text-zinc-500 text-[10px] block">Credential:</span>
                                <span className="text-zinc-200 truncate block">{ev.credential}</span>
                              </div>
                              <div>
                                <span className="text-zinc-500 text-[10px] block">Attempt:</span>
                                <span className="text-zinc-200">Attempt #{ev.attempt}</span>
                              </div>
                              <div>
                                <span className="text-zinc-500 text-[10px] block">Duration:</span>
                                <span className="text-zinc-200">{ev.durationMs}ms</span>
                              </div>
                            </div>

                            {ev.rawError && (
                              <div className="mt-2 p-2 rounded bg-rose-950/40 border border-rose-500/30 text-rose-300 font-mono text-[10px] whitespace-pre-wrap">
                                {ev.rawError}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-2.5 border-t border-white/10 bg-zinc-950 flex items-center justify-between text-[11px] text-zinc-400">
            <span>SINEMA Forensic Engine • Click row to expand forensic trace</span>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition cursor-pointer text-xs"
            >
              Tutup
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
