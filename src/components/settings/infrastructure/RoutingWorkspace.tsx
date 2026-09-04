import React, { useState } from 'react';
import { useInfrastructureState } from './useInfrastructureState';
import {
  Compass,
  Zap,
  ShieldCheck,
  RefreshCw,
  Cpu,
  Server,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sliders,
  Sparkles,
  Loader2,
} from 'lucide-react';

export const RoutingWorkspace: React.FC = () => {
  const { routing, providers, models, projects: credentials, loading, isRefreshing, refresh } =
    useInfrastructureState();

  const [selectedStrategy, setSelectedStrategy] = useState('auto');

  if (loading && Object.keys(routing).length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400 font-mono text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-indigo-400" /> Loading routing policies...
      </div>
    );
  }

  const intel = routing.intelligence || {};
  const activeModels = models.filter((m: any) => m.enabled !== false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-5 rounded-xl border border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white font-mono">Routing Policy & Quota Intelligence</h2>
            <span className="px-2 py-0.5 bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs rounded-full font-mono font-bold">
              Smart Quota Router
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-mono mt-1">
            Dynamic load balancing, health-weighted failover, and automatic credential circuit breakers across stages S1–S8.
          </p>
        </div>
        <div>
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

      {/* Mode & Strategy Card */}
      <div className="p-5 bg-zinc-900/80 rounded-xl border border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-indigo-400" />
            <span className="text-white font-mono font-bold text-sm">Active Execution Router</span>
          </div>
          <div className="text-zinc-300 font-mono text-xs font-medium">
            Mode: {routing.mode || 'AUTO (Quota-Aware Smart Router)'}
          </div>
          <div className="text-zinc-500 font-mono text-[11px]">
            Formula: {routing.strategy || 'Weighted Health (40%) + Quota (30%) + Latency (20%) + Priority (10%)'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs rounded-lg font-mono font-bold">
            HEALTH-WEIGHTED (ACTIVE)
          </span>
        </div>
      </div>

      {/* Intelligence Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
        <div className="p-4 bg-zinc-900/80 rounded-xl border border-white/5 space-y-1">
          <div className="text-zinc-500 text-[11px] uppercase font-bold">Active Routing Pool</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">
            {intel.healthy ?? credentials.filter((c: any) => c.status === 'active').length} / {credentials.length || 1}
          </div>
          <div className="text-zinc-500 text-[11px]">Keys ready for dispatch</div>
        </div>

        <div className="p-4 bg-zinc-900/80 rounded-xl border border-white/5 space-y-1">
          <div className="text-zinc-500 text-[11px] uppercase font-bold">Overall Success Rate</div>
          <div className="text-xl font-bold text-indigo-400 mt-1">
            {intel.successRate ?? 100}%
          </div>
          <div className="text-zinc-500 text-[11px]">Across all execution stages</div>
        </div>

        <div className="p-4 bg-zinc-900/80 rounded-xl border border-white/5 space-y-1">
          <div className="text-zinc-500 text-[11px] uppercase font-bold">Available Models</div>
          <div className="text-xl font-bold text-indigo-300 mt-1">
            {activeModels.length} / {models.length}
          </div>
          <div className="text-zinc-500 text-[11px]">Enabled in registry</div>
        </div>
      </div>

      {/* Stage Routing Pipeline Diagram */}
      <div className="bg-zinc-900/80 border border-white/5 rounded-xl p-5 space-y-4 font-mono">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-white uppercase">Execution Gateway Pipeline</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-zinc-950/80 rounded-lg border border-white/5 space-y-1">
            <div className="text-zinc-500 text-[10px] font-bold">STAGE 1: REQUEST</div>
            <div className="text-zinc-200 font-bold">S1–S8 Tasks</div>
            <p className="text-[11px] text-zinc-500">
              Script, character bible, storyboard, visual direction, sound design.
            </p>
          </div>

          <div className="p-3 bg-zinc-950/80 rounded-lg border border-white/5 space-y-1">
            <div className="text-zinc-500 text-[10px] font-bold">STAGE 2: MODEL SELECTION</div>
            <div className="text-indigo-300 font-bold">Active Catalog</div>
            <p className="text-[11px] text-zinc-500">
              Dispatches to non-deleted active models in the Model Registry.
            </p>
          </div>

          <div className="p-3 bg-zinc-950/80 rounded-lg border border-white/5 space-y-1">
            <div className="text-zinc-500 text-[10px] font-bold">STAGE 3: CREDENTIAL POOL</div>
            <div className="text-indigo-300 font-bold">Weighted Secret Vault</div>
            <p className="text-[11px] text-zinc-500">
              Picks highest-health credential with available quota and lowest latency.
            </p>
          </div>

          <div className="p-3 bg-zinc-950/80 rounded-lg border border-white/5 space-y-1">
            <div className="text-zinc-500 text-[10px] font-bold">STAGE 4: FAILOVER</div>
            <div className="text-emerald-400 font-bold">Automatic Circuit</div>
            <p className="text-[11px] text-zinc-500">
              Auto-cooldown on 429/500 errors, retries with fallback keys.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
