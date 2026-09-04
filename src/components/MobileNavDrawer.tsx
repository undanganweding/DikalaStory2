import React from 'react';
import {
  X,
  Film,
  Cpu,
  Layers,
  PlaySquare,
  Users,
  ShieldCheck,
  Download,
  Sliders,
  Sparkles,
  FolderOpen,
  Plus,
  Bell,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { StudioWorkspaceTab, Project } from '../types';

export interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject: Project | null;
  activeTab: StudioWorkspaceTab;
  mainMode: 'dashboard' | 'production' | 'studio';
  onSelectMainMode: (mode: 'dashboard' | 'production' | 'studio') => void;
  onNavigateTab: (tab: StudioWorkspaceTab) => void;
  onNewProject: () => void;
  onOpenProjectsModal: () => void;
  onOpenCommandPalette: () => void;
  onOpenNotificationCenter: () => void;
  onOpenDriveExport: () => void;
  unreadCount?: number;
  isGenerating?: boolean;
}

export const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({
  isOpen,
  onClose,
  currentProject,
  activeTab,
  mainMode,
  onSelectMainMode,
  onNavigateTab,
  onNewProject,
  onOpenProjectsModal,
  onOpenCommandPalette,
  onOpenNotificationCenter,
  onOpenDriveExport,
  unreadCount = 0,
  isGenerating = false,
}) => {
  if (!isOpen) return null;

  const studioTabs: { id: StudioWorkspaceTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Ringkasan Studio', icon: Film },
    { id: 'story', label: 'Story Architecture', icon: Layers },
    { id: 'scenes', label: 'Scene Studio & Storyboard', icon: Film },
    { id: 'shots', label: 'Shot Cockpit & Prompts', icon: PlaySquare },
    { id: 'bibles', label: 'Visual Asset Bibles', icon: Users },
    { id: 'continuity', label: 'Continuity Verification', icon: ShieldCheck },
    { id: 'pipeline', label: 'Pipeline Orchestrator', icon: Cpu },
    { id: 'prompts', label: 'Multi-Engine Prompts', icon: Sparkles },
    { id: 'export', label: 'Export & Google Drive', icon: Download },
    { id: 'settings', label: 'Studio Settings & Control', icon: Sliders },
  ];

  return (
    <div className="fixed inset-0 z-50 md:hidden flex">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer Body */}
      <div
        id="mobile-nav-drawer"
        className="relative w-4/5 max-w-xs bg-[#0F111D] border-r border-white/10 h-full flex flex-col justify-between shadow-2xl p-4 overflow-y-auto"
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 p-0.5 shadow-md">
                <div className="w-full h-full bg-[#181926] rounded-[10px] flex items-center justify-center">
                  <Film className="w-4 h-4 text-indigo-400" />
                </div>
              </div>
              <div>
                <span className="text-sm font-bold text-white block">Studio AI Mobile</span>
                <span className="text-[10px] font-mono text-zinc-400">Cinematic SaaS</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/5 text-zinc-400 hover:text-white"
              aria-label="Tutup Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onClose();
                onNewProject();
              }}
              className="min-h-[44px] p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Proyek Baru</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenProjectsModal();
              }}
              className="min-h-[44px] p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 font-bold text-xs flex items-center justify-center gap-1.5"
            >
              <FolderOpen className="w-4 h-4 text-indigo-400" />
              <span>Buka Proyek</span>
            </button>
          </div>

          {/* Search & Notif */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenCommandPalette();
              }}
              className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-400 flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-400" />
                <span>Search (⌘K)</span>
              </span>
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenNotificationCenter();
              }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-zinc-300 relative"
              aria-label="Notifikasi"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-500" />
              )}
            </button>
          </div>

          {/* Studio Navigation Workspace Links */}
          <div className="space-y-1 pt-2">
            <div className="px-2 py-1 text-[10px] font-mono uppercase text-zinc-400 font-bold tracking-wider">
              Workspace Mode
            </div>
            <div className="flex gap-1.5 mb-2">
              <button
                onClick={() => {
                  onSelectMainMode('dashboard');
                  onClose();
                }}
                className={`flex-1 min-h-[44px] py-2 rounded-xl text-xs font-bold transition flex items-center justify-center ${
                  mainMode === 'dashboard'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => {
                  onSelectMainMode('production');
                  onClose();
                }}
                className={`flex-1 min-h-[44px] py-2 rounded-xl text-xs font-bold transition flex items-center justify-center ${
                  mainMode === 'production'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                Produksi
              </button>
            </div>

            {currentProject && (
              <div className="space-y-1">
                <div className="px-2 py-1 text-[10px] font-mono uppercase text-zinc-400 font-bold tracking-wider">
                  Studio Modules ({currentProject.title})
                </div>
                {studioTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isSelected = mainMode === 'studio' && activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        onSelectMainMode('studio');
                        onNavigateTab(tab.id);
                        onClose();
                      }}
                      className={`w-full min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
                        isSelected
                          ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-bold'
                          : 'text-zinc-300 hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="truncate">{tab.label}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bottom footer in drawer */}
        <div className="pt-3 border-t border-white/10 text-[10px] font-mono text-zinc-400 flex items-center justify-between">
          <span>AI Director v5.5</span>
          <span>Mobile Ready</span>
        </div>
      </div>
    </div>
  );
};
