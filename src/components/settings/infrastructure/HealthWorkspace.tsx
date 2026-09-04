import React, { useState } from 'react';
import { useInfrastructureState } from './useInfrastructureState';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  Cpu,
  Server,
  Key,
  Loader2,
  Clock,
  ShieldCheck,
  Play,
  XCircle,
} from 'lucide-react';

export const HealthWorkspace: React.FC = () => {
  const { health, providers, models, projects: credentials, loading, isRefreshing, refresh, runHealthCheckAll } =
    useInfrastructureState();

  const [isRunningCheck, setIsRunningCheck] = useState(false);
  const [checkResults, setCheckResults] = useState<any | null>(null);

  const handleRunFullCheck = async () => {
    try {
      setIsRunningCheck(true);
      const res = await runHealthCheckAll();
      setCheckResults(res);
    } catch (err: any) {
      alert(err.message || 'Health check failed');
    } finally {
      setIsRunningCheck(false);
    }
  };

  if (loading && Object.keys(health).length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400 font-mono text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-indigo-400" /> Loading health metrics...
      </div>
    );
  }

  const summary = health.summary || {};
  const healthyCount = summary.healthy ?? credentials.filter((c: any) => c.status === 'active').length;
  const cooldownCount = summary.cooldown ?? 0;
  const downCount = summary.down ?? 0;
  const successRate = summary.successRate ?? 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-5 rounded-xl border border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white font-mono">Infrastructure Health Monitoring</h2>
            <span
              className={`px-2 py-0.5 text-xs rounded-full font-mono font-bold border ${
                downCount === 0
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              }`}
            >
              {downCount === 0 ? 'All Systems Operational' : `${downCount} Degraded`}
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-mono mt-1">
            Real-time availability, latency, cooldown tracking, and automated failure circuit breakers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunFullCheck}
            disabled={isRunningCheck}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-lg transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            {isRunningCheck ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Run Health Check</span>
          </button>

          <button
            onClick={() => refresh()}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono rounded-lg transition border border-white/5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-zinc-900/80 rounded-xl border border-white/5 font-mono">
          <div className="text-zinc-500 text-[11px] uppercase font-bold">Healthy Keys</div>
          <div className="text-xl font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>{healthyCount} / {credentials.length || 1}</span>
          </div>
        </div>

        <div className="p-4 bg-zinc-900/80 rounded-xl border border-white/5 font-mono">
          <div className="text-zinc-500 text-[11px] uppercase font-bold">Success Rate</div>
          <div className="text-xl font-bold text-indigo-400 mt-1 flex items-center gap-1.5">
            <Zap className="w-4 h-4" />
            <span>{successRate}%</span>
          </div>
        </div>

        <div className="p-4 bg-zinc-900/80 rounded-xl border border-white/5 font-mono">
          <div className="text-zinc-500 text-[11px] uppercase font-bold">In Cooldown</div>
          <div className="text-xl font-bold text-amber-400 mt-1 flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>{cooldownCount}</span>
          </div>
        </div>

        <div className="p-4 bg-zinc-900/80 rounded-xl border border-white/5 font-mono">
          <div className="text-zinc-500 text-[11px] uppercase font-bold">Down / Offline</div>
          <div className="text-xl font-bold text-rose-400 mt-1 flex items-center gap-1.5">
            <XCircle className="w-4 h-4" />
            <span>{downCount}</span>
          </div>
        </div>
      </div>

      {/* Health Check Run Result Banner */}
      {checkResults && (
        <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-xl space-y-2 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-indigo-300 font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Comprehensive Health Check Complete ({checkResults.checkedCount} tested)
            </span>
            <span className="text-zinc-500 text-[10px]">
              {new Date(checkResults.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="grid gap-1.5 pt-1">
            {checkResults.results?.map((res: any) => (
              <div
                key={res.credentialId}
                className="flex items-center justify-between py-1 px-2 rounded bg-zinc-900/60 border border-white/5"
              >
                <span className="text-zinc-300 font-bold">{res.name} ({res.providerId})</span>
                <div className="flex items-center gap-2">
                  {res.success ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {res.latencyMs ? `${res.latencyMs}ms` : 'Healthy'}
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {res.error || 'Failed'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two Columns: Providers Health & Models Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
        {/* Providers Health */}
        <div className="bg-zinc-900/80 border border-white/5 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white uppercase">Providers Availability</h3>
            </div>
            <span className="text-xs text-zinc-500">{providers.length} registered</span>
          </div>

          <div className="space-y-2">
            {providers.map((p: any) => {
              const pInfo = health.providers?.[p.id || p.name] || { status: 'live', availability: '99.9%' };
              const isLive = pInfo.status === 'live' || p.enabled !== false;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950/60 border border-white/5 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="text-zinc-200 font-bold">{p.name}</div>
                    <div className="text-zinc-500 text-[10px] uppercase">
                      Protocol: {p.type === 'openai-compatible' ? 'OpenAI (/v1)' : 'Native Google'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 text-[11px]">{pInfo.availability || '99.9%'}</span>
                    <span
                      className={`px-2 py-0.5 text-[10px] rounded-full font-bold uppercase ${
                        isLive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-400 border border-white/5'
                      }`}
                    >
                      {isLive ? 'Live' : 'Disabled'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Models Health */}
        <div className="bg-zinc-900/80 border border-white/5 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white uppercase">Models Routing State</h3>
            </div>
            <span className="text-xs text-zinc-500">{models.length} registered</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {models.map((m: any) => {
              const isLive = m.enabled !== false;
              return (
                <div
                  key={`${m.providerId || 'google'}::${m.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950/60 border border-white/5 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="text-zinc-200 font-bold">{m.displayName || m.id}</div>
                    <div className="text-zinc-500 text-[10px] uppercase">
                      Provider: {m.providerId || 'google'} • Tier: {m.tier || 'flash'}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] rounded-full font-bold uppercase ${
                      isLive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-zinc-800 text-zinc-400 border border-white/5'
                    }`}
                  >
                    {isLive ? 'Available' : 'Disabled'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
