import React, { useState } from 'react';
import { FloatingWindowManager } from '../../studio/FloatingWindowManager';
import { ProvidersWorkspace } from './ProvidersWorkspace';
import { ProjectsWorkspace } from './ProjectsWorkspace';
import { ModelsWorkspace } from './ModelsWorkspace';
import { RoutingWorkspace } from './RoutingWorkspace';
import { HealthWorkspace } from './HealthWorkspace';
import { LogsWorkspace } from './LogsWorkspace';
import { useInfrastructureState } from './useInfrastructureState';
import { Server, Key, BrainCircuit, GitBranch, Activity, Terminal, Trash2, AlertOctagon, Loader2, CheckCircle2, X } from 'lucide-react';

export const AIInfrastructureControlCenter: React.FC = () => {
  const [activeWorkspace, setActiveWorkspace] = useState<'providers' | 'projects' | 'models' | 'routing' | 'health' | 'logs'>('providers');
  const { refresh } = useInfrastructureState();

  const [showWipeAllModal, setShowWipeAllModal] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [wipeStatus, setWipeStatus] = useState<string | null>(null);
  const [wipeError, setWipeError] = useState<string | null>(null);

  const navItems = [
    { id: 'providers', label: 'Providers', icon: Server },
    { id: 'projects', label: 'Projects / Connections', icon: Key },
    { id: 'models', label: 'Models', icon: BrainCircuit },
    { id: 'routing', label: 'Routing', icon: GitBranch },
    { id: 'health', label: 'Health', icon: Activity },
    { id: 'logs', label: 'Logs', icon: Terminal },
  ] as const;

  const handleWipeAll = async () => {
    try {
      setIsWiping(true);
      setWipeError(null);
      const res = await fetch('/api/ai/infrastructure/wipe-all', { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to wipe infrastructure');
      }
      const data = await res.json();
      setShowWipeAllModal(false);
      setWipeStatus(`Infrastructure wiped: ${data.deletedCredentials ?? 0} keys, ${data.deletedProviders ?? 0} providers, and all projects reset.`);
      await refresh();
    } catch (err: any) {
      setWipeError(err.message || 'Failed to wipe infrastructure');
    } finally {
      setIsWiping(false);
    }
  };

  const renderWorkspace = () => {
    switch (activeWorkspace) {
      case 'providers': return <ProvidersWorkspace />;
      case 'projects': return <ProjectsWorkspace />;
      case 'models': return <ModelsWorkspace />;
      case 'routing': return <RoutingWorkspace />;
      case 'health': return <HealthWorkspace />;
      case 'logs': return <LogsWorkspace />;
    }
  };

  return (
    <div className="flex h-full flex-col">
      {wipeStatus && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-4 py-2.5 text-xs font-mono text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{wipeStatus}</span>
          </div>
          <button onClick={() => setWipeStatus(null)} className="text-emerald-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-52 bg-[#0F131E] border-r border-white/5 p-4 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="px-2 py-1 mb-2 text-[10px] font-mono uppercase text-zinc-500 font-bold tracking-wider">
              Control Center
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveWorkspace(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono font-bold transition ${
                    activeWorkspace === item.id
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Master Reset / Wipe All in Danger Zone */}
          <div className="pt-4 border-t border-white/5 space-y-2">
            <div className="px-2 text-[10px] font-mono uppercase text-zinc-500 font-bold tracking-wider">
              Danger Zone
            </div>
            <button
              onClick={() => setShowWipeAllModal(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono font-bold text-rose-400 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition cursor-pointer"
              title="Delete all keys, AI providers, and projects/connections"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Wipe All Data</span>
            </button>
          </div>
        </div>

        {/* Workspace Content */}
        <div className="flex-1 bg-[#121624] p-6 overflow-y-auto">
          {renderWorkspace()}
        </div>
      </div>

      {/* Master Wipe All Modal */}
      {showWipeAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30">
                <AlertOctagon className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-mono">Master Infrastructure Wipe</h3>
                <span className="text-[11px] text-rose-400 font-mono font-bold">Wipe Keys, Providers & Connections</span>
              </div>
            </div>

            {wipeError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs font-mono">
                {wipeError}
              </div>
            )}

            <p className="text-xs text-zinc-300 font-mono leading-relaxed">
              This action will permanently wipe:
            </p>
            <ul className="text-xs text-zinc-400 font-mono list-disc list-inside space-y-1 pl-1">
              <li>All API keys & secret vault credentials</li>
              <li>All connected custom AI providers</li>
              <li>All registered projects and connection mappings</li>
            </ul>
            <p className="text-[11px] text-zinc-500 font-mono">
              Infrastructure will be cleanly reset to baseline Google Gemini defaults.
            </p>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowWipeAllModal(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWipeAll}
                disabled={isWiping}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold rounded-lg transition flex items-center gap-2 shadow-lg shadow-rose-600/20 cursor-pointer"
              >
                {isWiping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Confirm Wipe All</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
