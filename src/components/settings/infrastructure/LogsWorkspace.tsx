import React, { useState, useMemo } from 'react';
import { useInfrastructureState } from './useInfrastructureState';
import {
  FileText,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
} from 'lucide-react';

export const LogsWorkspace: React.FC = () => {
  const { logs, loading, isRefreshing, refresh, clearLogs } = useInfrastructureState();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');

  // Clear Logs State & Modal
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Expanded log row ID
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log: any) => {
      const matchSearch =
        !searchQuery.trim() ||
        (log.modelId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.providerId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.stage || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.error || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.id || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchStage = stageFilter === 'all' || (log.stage || '').toLowerCase() === stageFilter.toLowerCase();

      const isSuccess = log.success !== false && !log.error;
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'success' && isSuccess) ||
        (statusFilter === 'error' && !isSuccess);

      return matchSearch && matchStage && matchStatus;
    });
  }, [logs, searchQuery, stageFilter, statusFilter]);

  // Unique stages
  const availableStages = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l: any) => l.stage && set.add(l.stage.toLowerCase()));
    return Array.from(set);
  }, [logs]);

  // Telemetry Aggregation
  const stats = useMemo(() => {
    let inputTokens = 0;
    let outputTokens = 0;
    let totalLatency = 0;
    let successCount = 0;
    let failCount = 0;

    filteredLogs.forEach((l: any) => {
      inputTokens += Number(l.inputTokens || l.promptTokens || 0);
      outputTokens += Number(l.outputTokens || l.completionTokens || 0);
      totalLatency += Number(l.latencyMs || l.latency || 0);
      if (l.success !== false && !l.error) {
        successCount++;
      } else {
        failCount++;
      }
    });

    const avgLatency = filteredLogs.length > 0 ? Math.round(totalLatency / filteredLogs.length) : 0;
    return {
      total: filteredLogs.length,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      avgLatency,
      successCount,
      failCount,
    };
  }, [filteredLogs]);

  const executeClearLogs = async () => {
    try {
      setIsClearing(true);
      setActionError(null);
      await clearLogs();
      setActionSuccess('Execution telemetry logs and usage records cleared successfully.');
      setShowClearModal(false);
    } catch (err: any) {
      setActionError(err.message || 'Failed to clear execution logs.');
    } finally {
      setIsClearing(false);
    }
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400 font-mono text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-indigo-400" /> Loading execution logs...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-5 rounded-xl border border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white font-mono">Execution Logs & Telemetry</h2>
            <span className="px-2 py-0.5 bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs rounded-full font-mono font-bold">
              {logs.length} Recorded Execution{logs.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-mono mt-1">
            Real-time stage dispatch logs, token usage telemetry, and latency metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowClearModal(true)}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-rose-900/40 text-zinc-300 hover:text-rose-300 text-xs font-mono rounded-lg transition border border-white/5 hover:border-rose-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Clear all logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Logs
          </button>

          <button
            onClick={() => refresh()}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono rounded-lg transition border border-white/5 disabled:opacity-50"
            title="Refresh logs"
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
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Summary Telemetry Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="p-4 bg-zinc-900/80 rounded-xl border border-white/5">
          <div className="text-zinc-500 text-[11px] uppercase font-bold">Total Dispatches</div>
          <div className="text-xl font-bold text-white mt-1">{stats.total}</div>
        </div>

        <div className="p-4 bg-zinc-900/80 rounded-xl border border-white/5">
          <div className="text-zinc-500 text-[11px] uppercase font-bold">Total Tokens</div>
          <div className="text-xl font-bold text-indigo-400 mt-1">{stats.totalTokens.toLocaleString()}</div>
        </div>

        <div className="p-4 bg-zinc-900/80 rounded-xl border border-white/5">
          <div className="text-zinc-500 text-[11px] uppercase font-bold">Avg Latency</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{stats.avgLatency} ms</div>
        </div>

        <div className="p-4 bg-zinc-900/80 rounded-xl border border-white/5">
          <div className="text-zinc-500 text-[11px] uppercase font-bold">Success / Fail</div>
          <div className="text-xl font-bold mt-1">
            <span className="text-emerald-400">{stats.successCount}</span>
            <span className="text-zinc-500"> / </span>
            <span className="text-rose-400">{stats.failCount}</span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-zinc-900/60 p-4 rounded-xl border border-white/5 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search logs by model ID, stage, provider, or error text..."
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

        <div className="flex flex-wrap items-center gap-2">
          {availableStages.length > 0 && (
            <div className="flex items-center gap-1.5 bg-zinc-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono">
              <span className="text-zinc-500 text-[11px]">Stage:</span>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-zinc-900 text-zinc-200">All Stages</option>
                {availableStages.map((s) => (
                  <option key={s} value={s} className="bg-zinc-900 text-zinc-200">
                    {s.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5 bg-zinc-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono">
            <span className="text-zinc-500 text-[11px]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-zinc-900 text-zinc-200">All</option>
              <option value="success" className="bg-zinc-900 text-zinc-200">Success</option>
              <option value="error" className="bg-zinc-900 text-zinc-200">Error</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table / Stream */}
      {filteredLogs.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/40 rounded-xl border border-dashed border-white/10 space-y-3 font-mono">
          <FileText className="w-10 h-10 text-zinc-600 mx-auto" />
          <div className="text-zinc-300 text-sm font-bold">No execution logs found</div>
          <p className="text-zinc-500 text-xs max-w-md mx-auto">
            {logs.length === 0
              ? 'Stage executions and AI Gateway dispatches will automatically stream logs and telemetry here.'
              : 'Try clearing the search query or adjusting your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2 font-mono text-xs">
          {filteredLogs.map((log: any, idx: number) => {
            const logId = log.id || `log-${idx}`;
            const isSuccess = log.success !== false && !log.error;
            const isExpanded = expandedLogId === logId;
            const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'Recent';

            return (
              <div
                key={logId}
                className="bg-zinc-900/80 border border-white/5 rounded-xl overflow-hidden hover:border-indigo-500/30 transition"
              >
                <div
                  onClick={() => setExpandedLogId(isExpanded ? null : logId)}
                  className="p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 text-[10px] rounded-full font-bold uppercase ${
                        isSuccess
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {isSuccess ? '200 OK' : 'ERROR'}
                    </span>

                    {log.stage && (
                      <span className="px-2 py-0.5 bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 text-[10px] rounded uppercase font-bold">
                        {log.stage}
                      </span>
                    )}

                    <div className="flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="text-white font-bold">{log.modelId || 'gemini-3.7-flash'}</span>
                      <span className="text-[10px] text-zinc-500">({log.providerId || 'google'})</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-zinc-400 text-[11px] w-full md:w-auto justify-between md:justify-end">
                    <span>
                      {(Number(log.inputTokens || 0) + Number(log.outputTokens || 0)).toLocaleString()} tokens
                    </span>
                    {log.latencyMs !== undefined && (
                      <span className="text-indigo-300">{log.latencyMs} ms</span>
                    )}
                    <span className="text-zinc-500">{dateStr}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-4 bg-zinc-950/80 border-t border-white/5 space-y-3 text-[11px] text-zinc-300">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <div className="text-zinc-500 text-[10px]">STAGE</div>
                        <div className="text-white font-bold">{log.stage || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-[10px]">INPUT TOKENS</div>
                        <div className="text-white font-bold">{log.inputTokens || 0}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-[10px]">OUTPUT TOKENS</div>
                        <div className="text-white font-bold">{log.outputTokens || 0}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-[10px]">CREDENTIAL ID</div>
                        <div className="text-zinc-400 select-all">{log.credentialId || 'vault-primary'}</div>
                      </div>
                    </div>

                    {log.error && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Error Message</span>
                        </div>
                        <div className="text-xs font-mono break-all">{log.error}</div>
                      </div>
                    )}

                    {log.promptSnippet && (
                      <div>
                        <div className="text-zinc-500 text-[10px] mb-1">PROMPT SNIPPET</div>
                        <pre className="p-2.5 bg-zinc-900 rounded border border-white/5 text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                          {log.promptSnippet}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Clear Logs Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 font-mono">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Clear Execution Telemetry Logs?</h3>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              This will permanently clear all recorded execution logs and token usage metrics. Active routing rules and model registrations will remain unchanged.
            </p>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeClearLogs}
                disabled={isClearing}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-2 shadow-lg shadow-rose-600/20"
              >
                {isClearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Clear All Logs</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
