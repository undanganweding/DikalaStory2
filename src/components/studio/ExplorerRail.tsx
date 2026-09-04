import React from 'react';
import {
  Clapperboard,
  Layers,
  Eye,
  MapPin,
  Package,
  Users,
  Film,
  Video,
  LayoutGrid,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Activity,
  Download,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { StudioWorkspaceTab } from '../../types';

interface ExplorerRailProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  activeTab: StudioWorkspaceTab;
  onSelectTab: (tab: StudioWorkspaceTab) => void;
}

const navCategories = [
  {
    name: 'PROJECT',
    items: [{ id: 'overview', label: 'Project Dashboard', icon: Clapperboard }],
  },
  {
    name: 'STORY',
    items: [
      { id: 'story', label: 'Story & Research', icon: Layers },
    ],
  },
  {
    name: 'ASSETS',
    items: [
      { id: 'assets', label: 'Asset Management', icon: Package },
    ],
  },
  {
    name: 'PRODUCTION',
    items: [
      { id: 'scenes', label: 'Scenes, Shots & Storyboard', icon: Film },
    ],
  },
  {
    name: 'INTELLIGENCE',
    items: [
      { id: 'continuity', label: 'Continuity & Validation', icon: CheckCircle2 },
      { id: 'prompts', label: 'Prompt Intelligence', icon: Sparkles },
    ],
  },
  {
    name: 'PIPELINE',
    items: [
      { id: 'export', label: 'Export & Import', icon: Download },
    ],
  },
];

export const ExplorerRail: React.FC<ExplorerRailProps> = ({ isExpanded, onToggleExpand, activeTab, onSelectTab }) => {
  return (
    <aside
      className={`shrink-0 bg-[#0E0F1A] border-r border-[#1E2034] transition-all duration-200 ease-in-out flex flex-col z-10 ${
        isExpanded ? 'w-56' : 'w-12'
      }`}
    >
      {/* Rail Header */}
      <div className="h-9 px-3 border-b border-[#1E2034] flex items-center justify-between shrink-0">
        {isExpanded && <span className="font-bold text-xs text-slate-100">SINEMA</span>}
        <button onClick={onToggleExpand} className="p-1 text-slate-500 hover:text-slate-300">
          {isExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav Items */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-4">
        {navCategories.map((category) => (
          <div key={category.name} className="space-y-1">
            {isExpanded && (
              <div className="px-2 text-[9px] font-bold text-slate-500 tracking-wider uppercase">
                {category.name}
              </div>
            )}
            {category.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id as StudioWorkspaceTab)}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs transition ${
                    isActive
                      ? 'bg-[#1C1E34] text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#16182C]'
                  }`}
                  title={isExpanded ? undefined : item.label}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                  {isExpanded && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      
      {/* Settings at bottom */}
      <div className="p-1.5 border-t border-[#1E2034]">
        <button
            onClick={() => onSelectTab('settings')}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs transition ${
                activeTab === 'settings'
                    ? 'bg-[#1C1E34] text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#16182C]'
            }`}
            title={isExpanded ? undefined : 'Settings'}
        >
            <Settings className="w-4 h-4" />
            {isExpanded && <span className="truncate">Settings</span>}
        </button>
      </div>
    </aside>
  );
};
