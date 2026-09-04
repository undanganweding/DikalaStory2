import React, { useState } from 'react';
import { FloatingWindowManager } from '../../studio/FloatingWindowManager';
import { ProvidersWorkspace } from './ProvidersWorkspace';
import { ProjectsWorkspace } from './ProjectsWorkspace';
import { ModelsWorkspace } from './ModelsWorkspace';
import { RoutingWorkspace } from './RoutingWorkspace';
import { HealthWorkspace } from './HealthWorkspace';
import { LogsWorkspace } from './LogsWorkspace';
import { Server, Key, BrainCircuit, GitBranch, Activity, Terminal } from 'lucide-react';

export const AIInfrastructureControlCenter: React.FC = () => {
  const [activeWorkspace, setActiveWorkspace] = useState<'providers' | 'projects' | 'models' | 'routing' | 'health' | 'logs'>('providers');

  const navItems = [
    { id: 'providers', label: 'Providers', icon: Server },
    { id: 'projects', label: 'Projects / Connections', icon: Key },
    { id: 'models', label: 'Models', icon: BrainCircuit },
    { id: 'routing', label: 'Routing', icon: GitBranch },
    { id: 'health', label: 'Health', icon: Activity },
    { id: 'logs', label: 'Logs', icon: Terminal },
  ] as const;

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
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-48 bg-[#0F131E] border-r border-white/5 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveWorkspace(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-mono font-bold transition ${
                activeWorkspace === item.id
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>
      {/* Workspace Content */}
      <div className="flex-1 bg-[#121624] p-6 overflow-y-auto">
        {renderWorkspace()}
      </div>
    </div>
  );
};
