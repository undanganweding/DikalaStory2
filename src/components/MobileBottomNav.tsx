import React from 'react';
import {
  Film,
  FolderKanban,
  Cpu,
  Users,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { StudioWorkspaceTab, Project } from '../types';

export interface MobileBottomNavProps {
  mainMode: 'dashboard' | 'production' | 'studio';
  activeTab: StudioWorkspaceTab;
  currentProject: Project | null;
  onSelectMainMode: (mode: 'dashboard' | 'production' | 'studio') => void;
  onNavigateTab: (tab: StudioWorkspaceTab) => void;
  onOpenProjectsModal: () => void;
  isGenerating?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  mainMode,
  activeTab,
  currentProject,
  onSelectMainMode,
  onNavigateTab,
  onOpenProjectsModal,
  isGenerating = false,
}) => {
  const navItems = [
    {
      id: 'studio',
      label: 'Studio',
      icon: Film,
      isActive: mainMode === 'studio' && activeTab !== 'assets' && activeTab !== 'settings',
      onClick: () => {
        if (!currentProject) {
          onOpenProjectsModal();
        } else {
          onSelectMainMode('studio');
          if (activeTab === 'settings' || activeTab === 'assets') {
            onNavigateTab('scenes');
          }
        }
      },
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: FolderKanban,
      isActive: mainMode === 'production',
      onClick: () => {
        onSelectMainMode('production');
      },
    },
    {
      id: 'production',
      label: 'Production',
      icon: Cpu,
      isActive: mainMode === 'dashboard' || (mainMode === 'studio' && activeTab === 'pipeline'),
      badge: isGenerating ? 'RUN' : undefined,
      onClick: () => {
        if (currentProject) {
          onSelectMainMode('studio');
          onNavigateTab('pipeline');
        } else {
          onSelectMainMode('dashboard');
        }
      },
    },
    {
      id: 'assets',
      label: 'Assets',
      icon: Users,
      isActive: mainMode === 'studio' && activeTab === 'assets',
      onClick: () => {
        if (!currentProject) {
          onOpenProjectsModal();
        } else {
          onSelectMainMode('studio');
          onNavigateTab('assets');
        }
      },
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Sliders,
      isActive: mainMode === 'studio' && activeTab === 'settings',
      onClick: () => {
        onSelectMainMode('studio');
        onNavigateTab('settings');
      },
    },
  ];

  return (
    <nav
      id="mobile-bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0F111D]/95 backdrop-blur-md border-t border-white/10 pb-[env(safe-area-inset-bottom,0px)] px-2 py-1 shadow-2xl"
      aria-label="Mobile Navigation"
    >
      <div className="flex items-center justify-around gap-1 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;
          return (
            <button
              key={item.id}
              id={`mobile-nav-${item.id}`}
              onClick={item.onClick}
              type="button"
              className={`flex-1 min-h-[48px] py-1 px-1.5 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all select-none relative ${
                active
                  ? 'text-indigo-400 font-bold bg-indigo-500/10'
                  : 'text-zinc-400 hover:text-zinc-200 active:bg-white/5'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${active ? 'scale-110' : ''}`} />
                {item.badge && (
                  <span className="absolute -top-1 -right-2.5 px-1 py-0.2 text-[8px] font-mono font-bold bg-indigo-500 text-white rounded-full animate-pulse leading-tight">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] tracking-tight leading-tight ${active ? 'text-indigo-300 font-bold' : 'text-zinc-400'}`}>
                {item.label}
              </span>
              {active && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 absolute bottom-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
