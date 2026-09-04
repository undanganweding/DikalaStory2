import React, { useState, useEffect } from 'react';
import {
  Film,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Clapperboard,
  Clock,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  ArrowLeft,
  Settings,
  Download,
  Activity,
  Users,
  MapPin,
  Package,
  Sliders,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Eye,
  Video,
  FileText,
  ShieldAlert,
  Maximize2,
  Minimize2,
  Grid,
  List,
  Command,
  LayoutGrid,
  HelpCircle,
  Search,
} from 'lucide-react';
import {
  Project,
  ProjectFoundation,
  StoryArchitecture,
  Scene,
  Shot,
  CharacterBible,
  LocationBible,
  ObjectBible,
  VideoPrompt,
  StudioWorkspaceTab,
} from '../../types';
import { ContextualInspector } from './ContextualInspector';
import { FloatingWindowManager } from './FloatingWindowManager';
import { StudioStatusBar } from './StudioStatusBar';
import { ExplorerRail } from './ExplorerRail';
import { useWindowManager } from '../../context/WindowManagerContext';

interface UnifiedStudioLayoutProps {
  currentProject: Project | null;
  foundation: ProjectFoundation | null;
  storyArchitecture: StoryArchitecture | null;
  scenes: Scene[];
  shots: Record<string, Shot[]> | Shot[];
  characters: CharacterBible[];
  locations: LocationBible[];
  objects: ObjectBible[];
  videoPrompts?: Record<string, VideoPrompt[]> | VideoPrompt[];
  activeTab: StudioWorkspaceTab;
  onSelectTab: (tab: StudioWorkspaceTab) => void;
  selectedSceneId: string | null;
  onSelectScene: (sceneId: string | null) => void;
  selectedShotId: string | null;
  onSelectShot: (shotId: string | null) => void;
  onBackToProjects: () => void;
  onRetryPipeline?: () => void;
  onOpenExport?: () => void;
  isGenerating?: boolean;
  onRunShotPrompt?: (shotId: string, target: any) => void;
  onSmartRegenerate?: (
    shotId: string,
    target: any,
    lockState?: any,
    reason?: string,
    requireAi?: boolean
  ) => void;
  onUpdateShotImage?: (shotId: string, imageUrl: string | null) => void;
  processingShotId?: string | null;
  shotPromptError?: string;
  children: React.ReactNode;
}

export const UnifiedStudioLayout: React.FC<UnifiedStudioLayoutProps> = ({
  currentProject,
  foundation,
  storyArchitecture,
  scenes,
  shots,
  characters,
  locations,
  objects,
  videoPrompts,
  activeTab,
  onSelectTab,
  selectedSceneId,
  onSelectScene,
  selectedShotId,
  onSelectShot,
  onBackToProjects,
  onRetryPipeline,
  onOpenExport,
  isGenerating = false,
  onRunShotPrompt,
  onSmartRegenerate,
  onUpdateShotImage,
  processingShotId,
  shotPromptError,
  children,
}) => {
  const { openWindow, closeTopWindow } = useWindowManager();
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState<'none' | 'explorer' | 'inspector'>('none');
  const [sceneSearch, setSceneSearch] = useState('');

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
        const closed = closeTopWindow();
        if (!closed && isFocusMode) {
          setIsFocusMode(false);
        }
      } else if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsFocusMode((prev) => !prev);
      } else if (e.key.toLowerCase() === 'i' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsInspectorOpen((prev) => !prev);
      } else if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        openWindow({
          id: 'keyboard-shortcuts-guide',
          type: 'keyboard_shortcuts',
          title: 'Keyboard Shortcuts Guide',
          subtitle: 'Perintah Cepat Workspace',
          icon: <Command className="w-4 h-4 text-indigo-400" />,
        });
      } else if (['1', '2', '3', '4', '5', '6', '7', '8'].includes(e.key) && !e.metaKey && !e.ctrlKey) {
        const tabMap: Record<string, StudioWorkspaceTab> = {
          '1': 'overview',
          '2': 'story',
          '3': 'scenes',
          '4': 'shots' as StudioWorkspaceTab,
          '5': 'bibles',
          '6': 'continuity',
          '7': 'pipeline',
          '8': 'export',
        };
        const mapped = tabMap[e.key];
        if (mapped) {
          e.preventDefault();
          onSelectTab(mapped);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeTopWindow, isFocusMode, onSelectTab, openWindow]);

  // Flatten shots safely
  const flatShots: Shot[] = React.useMemo(() => {
    return Array.isArray(shots)
      ? shots
      : shots && typeof shots === 'object'
      ? Object.values(shots).flat().filter(Boolean)
      : [];
  }, [shots]);

  // Derived contextual selections
  const activeScene = React.useMemo(
    () => scenes.find((s) => s.id === selectedSceneId) || scenes[0] || null,
    [scenes, selectedSceneId]
  );
  const activeShots = React.useMemo(() => {
    return activeScene && activeScene.id
      ? flatShots.filter((shot) => shot.scene_id === activeScene.id)
      : [];
  }, [activeScene, flatShots]);
  const activeShot = React.useMemo(
    () => flatShots.find((s) => s.id === selectedShotId) || activeShots[0] || null,
    [flatShots, selectedShotId, activeShots]
  );

  // Compute timing metrics deterministically from real state
  const totalScenesDuration = React.useMemo(
    () => scenes.reduce((acc, sc) => acc + (sc.duration_sec || 0), 0),
    [scenes]
  );
  const targetDuration = currentProject?.total_duration_target_sec || totalScenesDuration || 0;

  const filteredScenes = React.useMemo(() => {
    if (!sceneSearch.trim()) return scenes;
    const q = sceneSearch.toLowerCase();
    return scenes.filter(
      (sc) =>
        sc.title?.toLowerCase().includes(q) ||
        sc.location_name?.toLowerCase().includes(q) ||
        sc.event?.toLowerCase().includes(q) ||
        String(sc.scene_number).includes(q)
    );
  }, [scenes, sceneSearch]);

  return (
    <div
      id="unified-studio-cockpit"
      className="h-full w-full flex-1 flex flex-col bg-[#0A0B12] text-slate-200 overflow-hidden select-none"
    >
      {/* 1. STUDIO TOP BAR (Desktop Only, Hidden on mobile as TopBar handles it) */}
      {!isFocusMode && (
        <header
          id="studio-cockpit-header"
          className="hidden md:flex h-10 bg-[#0E0F1A] border-b border-[#1E2034] px-4 items-center justify-between shrink-0 z-20"
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBackToProjects}
              className="text-slate-500 hover:text-slate-200 transition"
              title="Kembali ke Proyek"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-slate-100 tracking-tight truncate max-w-sm">
              {currentProject?.title?.replace(/^#+\s*/g, '').replace(/#+/g, '—')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => openWindow({ id: 'search-palette', type: 'command_palette', title: 'Command Palette', subtitle: 'Search & Action', data: {} })}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#16182C] border border-[#232644] text-xs text-slate-400 hover:text-slate-100"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search (⌘K)</span>
            </button>
            <button
              onClick={() => setIsFocusMode(true)}
              className="p-2 rounded-md bg-[#16182C] text-slate-400 hover:text-white border border-[#232644]"
              title="Focus Mode (F)"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {/* 2. 3-COLUMN STUDIO BODY */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* EXPLORER RAIL (Desktop only >= 768px) */}
        {!isFocusMode && (
          <div className="hidden md:flex shrink-0">
            <ExplorerRail
              isExpanded={isExplorerOpen}
              onToggleExpand={() => setIsExplorerOpen(!isExplorerOpen)}
              activeTab={activeTab}
              onSelectTab={onSelectTab}
            />
          </div>
        )}
        
        {/* WORKSPACE */}
        <main
          id="studio-center-canvas"
          className="flex-1 flex flex-col min-w-0 bg-[#080911] overflow-hidden relative"
        >
          {/* Breadcrumb & Navigation Sub-Bar */}
          <div className="h-8 px-2.5 sm:px-3.5 bg-[#10111D] border-b border-[#1B1D30] flex items-center justify-between text-xs shrink-0 overflow-x-auto scrollbar-none gap-2 select-none">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 text-slate-400 font-mono text-[11px] whitespace-nowrap shrink-0">
              <span className="text-indigo-400 font-semibold">STUDIO</span>
              <span>/</span>
              <span className="text-slate-300 font-medium uppercase">{activeTab}</span>
              {activeScene && (
                <>
                  <span>/</span>
                  <button
                    onClick={() =>
                      openWindow({
                        id: `scene-${activeScene.id}`,
                        type: 'scene_detail',
                        title: `Adegan ${activeScene.scene_number}: ${activeScene.title || 'Scene Breakdown'}`,
                        subtitle: activeScene.location_name || 'Breakdown & Master Prompts',
                        data: activeScene,
                      })
                    }
                    className="text-cyan-400 hover:underline font-semibold flex items-center gap-0.5"
                    title="Buka Floating Window Adegan"
                  >
                    SC-{String(activeScene.scene_number).padStart(2, '0')}
                  </button>
                </>
              )}
              {activeShot && (
                <>
                  <span>/</span>
                  <button
                    onClick={() =>
                      openWindow({
                        id: `shot-${activeShot.id}`,
                        type: 'shot_detail',
                        title: `Shot ${activeShot.shot_number} • SC-${String(activeScene?.scene_number || 1).padStart(2, '0')}`,
                        subtitle: activeShot.visual_description || activeShot.character_action || 'Shot Cockpit',
                        data: { shot: activeShot, scene: activeScene, characters, locations },
                      })
                    }
                    className="text-amber-400 hover:underline font-semibold"
                    title="Buka Floating Cockpit Shot"
                  >
                    SH-{String(activeShot.shot_number).padStart(2, '0')}
                  </button>
                </>
              )}
            </div>

            {/* Quick Context Tab Pills (Tablet/Desktop) */}
            <div className="hidden sm:flex items-center gap-1 shrink-0">
              {['scenes', 'story', 'bibles', 'continuity', 'pipeline'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => onSelectTab(tab as StudioWorkspaceTab)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                    activeTab === tab
                      ? 'bg-[#1C1E34] text-indigo-300 border border-indigo-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Active Workspace Viewport Render */}
          <div className="flex-1 min-h-0 overflow-y-auto relative p-2.5 sm:p-4 pb-20 bg-[#080911] scrollbar-thin">
            {children}
          </div>
        </main>

        {/* INSPECTOR */}
        {!isFocusMode && (
          <aside
            id="studio-right-inspector"
            className={`shrink-0 bg-[#11121F] border-l border-[#1E2034] transition-all duration-200 ease-in-out flex flex-col z-10 ${
              isInspectorOpen ? 'w-72 xl:w-80' : 'w-0 hidden'
            }`}
          >
            {/* Inspector Header */}
            <div className="h-9 px-3 border-b border-[#1E2034] flex items-center justify-between text-xs shrink-0 bg-[#0E0F1A]">
              <div className="flex items-center gap-2 text-slate-300 font-semibold">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>Contextual Inspector</span>
              </div>
              <button
                onClick={() => {
                  setIsInspectorOpen(false);
                }}
                className="p-1 text-slate-500 hover:text-slate-300 transition"
                title="Tutup Panel Inspector (I)"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Inspector Contextual Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
              <ContextualInspector
                currentProject={currentProject}
                scene={activeScene}
                shot={activeShot}
                characters={characters}
                locations={locations}
                objects={objects}
                videoPrompts={videoPrompts}
                onSelectScene={onSelectScene}
                onSelectShot={onSelectShot}
              />
            </div>
          </aside>
        )}
      </div>

      {/* 3. STUDIO STATUS BAR */}
      <StudioStatusBar
        currentProject={currentProject}
        scenes={scenes}
        shots={shots}
        isFocusMode={isFocusMode}
        onToggleFocusMode={() => setIsFocusMode(!isFocusMode)}
        isGenerating={isGenerating}
      />
      
      {/* 4. FLOATING WINDOW MANAGER */}
      <FloatingWindowManager
        project={currentProject}
        scenes={scenes}
        shots={shots}
        characters={characters}
        locations={locations}
        objects={objects}
        videoPrompts={videoPrompts}
        onSelectScene={onSelectScene}
        onSelectShot={onSelectShot}
        onRunShotPrompt={onRunShotPrompt}
        onSmartRegenerate={onSmartRegenerate}
        onUpdateShotImage={onUpdateShotImage}
        processingShotId={processingShotId}
        shotPromptError={shotPromptError}
      />
    </div>
  );
};
