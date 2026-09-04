import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  Minus,
  Maximize2,
  Minimize2,
  Film,
  Sparkles,
  Users,
  MapPin,
  Package,
  Command,
  Activity,
  Layers,
  Move,
} from 'lucide-react';
import { useWindowManager } from '../../context/WindowManagerContext';
import { FloatingWindowInstance } from '../../types/window';
import { SceneDetailWindow } from './window_views/SceneDetailWindow';
import { CharacterDetailWindow } from './window_views/CharacterDetailWindow';
import { LocationDetailWindow } from './window_views/LocationDetailWindow';
import { KeyboardShortcutsWindow } from './window_views/KeyboardShortcutsWindow';
import { AICopilotWindow } from './window_views/AICopilotWindow';
import { AIInfrastructureControlCenter } from '../settings/infrastructure/AIInfrastructureControlCenter';
import { CompactShotCockpit } from './CompactShotCockpit';
import {
  Project,
  Scene,
  Shot,
  CharacterBible,
  LocationBible,
  ObjectBible,
  VideoPrompt,
} from '../../types';

interface FloatingWindowManagerProps {
  project: Project | null;
  scenes: Scene[];
  shots: Record<string, Shot[]> | Shot[];
  characters: CharacterBible[];
  locations: LocationBible[];
  objects: ObjectBible[];
  videoPrompts?: Record<string, VideoPrompt[]> | VideoPrompt[];
  onSelectScene?: (sceneId: string) => void;
  onSelectShot?: (shotId: string) => void;
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
}

export const FloatingWindowManager: React.FC<FloatingWindowManagerProps> = ({
  project,
  scenes,
  shots,
  characters,
  locations,
  objects,
  videoPrompts,
  onSelectScene,
  onSelectShot,
  onRunShotPrompt,
  onSmartRegenerate,
  onUpdateShotImage,
  processingShotId,
  shotPromptError,
}) => {
  const {
    windows,
    activeWindowId,
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    focusWindow,
    updatePosition,
    updateSize,
  } = useWindowManager();

  const flatShots: Shot[] = Array.isArray(shots)
    ? shots
    : shots && typeof shots === 'object'
    ? Object.values(shots).flat().filter(Boolean)
    : [];

  const visibleWindows = windows.filter((w) => !w.isMinimized);

  if (visibleWindows.length === 0) return null;

  return (
    <div
      id="floating-window-viewport-container"
      className="fixed inset-0 pointer-events-none z-50 overflow-hidden select-none"
    >
      {visibleWindows.map((win) => (
        <DraggableFloatingWindow
          key={win.id}
          window={win}
          isActive={win.id === activeWindowId}
          onFocus={() => focusWindow(win.id)}
          onClose={() => closeWindow(win.id)}
          onMinimize={() => minimizeWindow(win.id)}
          onMaximize={() => maximizeWindow(win.id)}
          onPositionChange={(pos) => updatePosition(win.id, pos)}
          onSizeChange={(size) => updateSize(win.id, size)}
        >
          {renderWindowContent(
            win,
            project,
            scenes,
            flatShots,
            characters,
            locations,
            objects,
            videoPrompts,
            onSelectScene,
            onSelectShot,
            onRunShotPrompt,
            onSmartRegenerate,
            onUpdateShotImage,
            processingShotId,
            shotPromptError
          )}
        </DraggableFloatingWindow>
      ))}
    </div>
  );
};

interface DraggableFloatingWindowProps {
  window: FloatingWindowInstance;
  isActive: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onPositionChange: (pos: { x: number; y: number }) => void;
  onSizeChange: (size: { width: number; height: number }) => void;
  children: React.ReactNode;
}

const DraggableFloatingWindow: React.FC<DraggableFloatingWindowProps> = ({
  window: win,
  isActive,
  onFocus,
  onClose,
  onMinimize,
  onMaximize,
  onPositionChange,
  onSizeChange,
  children,
}) => {
  const dragRef = useRef<{ isDragging: boolean; startX: number; startY: number; initPosX: number; initPosY: number }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    initPosX: 0,
    initPosY: 0,
  });

  const resizeRef = useRef<{ isResizing: boolean; startX: number; startY: number; initW: number; initH: number }>({
    isResizing: false,
    startX: 0,
    startY: 0,
    initW: 0,
    initH: 0,
  });

  // Dragging logic
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    onFocus();
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initPosX: win.position.x,
      initPosY: win.position.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragRef.current.isDragging && !win.isMaximized) {
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;
      const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;

      const newX = Math.max(10, Math.min(screenW - win.size.width - 10, dragRef.current.initPosX + deltaX));
      const newY = Math.max(30, Math.min(screenH - 60, dragRef.current.initPosY + deltaY));
      onPositionChange({ x: newX, y: newY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false;
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch (err) {}
    }
  };

  // Resizing logic
  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    onFocus();
    resizeRef.current = {
      isResizing: true,
      startX: e.clientX,
      startY: e.clientY,
      initW: win.size.width,
      initH: win.size.height,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (resizeRef.current.isResizing && !win.isMaximized) {
      const deltaX = e.clientX - resizeRef.current.startX;
      const deltaY = e.clientY - resizeRef.current.startY;
      const newW = Math.max(400, resizeRef.current.initW + deltaX);
      const newH = Math.max(300, resizeRef.current.initH + deltaY);
      onSizeChange({ width: newW, height: newH });
    }
  };

  const handleResizeEnd = (e: React.PointerEvent) => {
    if (resizeRef.current.isResizing) {
      resizeRef.current.isResizing = false;
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch (err) {}
    }
  };

  const getWindowIcon = () => {
    if (win.icon) return win.icon;
    switch (win.type) {
      case 'scene_detail':
        return <Film className="w-4 h-4 text-indigo-400" />;
      case 'shot_detail':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'character_detail':
        return <Users className="w-4 h-4 text-purple-400" />;
      case 'location_detail':
        return <MapPin className="w-4 h-4 text-emerald-400" />;
      case 'ai_copilot':
        return <Sparkles className="w-4 h-4 text-cyan-400" />;
      case 'keyboard_shortcuts':
        return <Command className="w-4 h-4 text-indigo-400" />;
      default:
        return <Layers className="w-4 h-4 text-slate-400" />;
    }
  };

  const style: React.CSSProperties = win.isMaximized
    ? {
        position: 'fixed',
        left: 12,
        top: 48,
        width: 'calc(100vw - 24px)',
        height: 'calc(100vh - 64px)',
        zIndex: win.zIndex,
      }
    : {
        position: 'fixed',
        left: `${win.position.x}px`,
        top: `${win.position.y}px`,
        width: `${win.size.width}px`,
        height: `${win.size.height}px`,
        zIndex: win.zIndex,
      };

  return (
    <div
      style={style}
      onClick={onFocus}
      className={`pointer-events-auto bg-[#10121F] rounded-2xl border transition-shadow duration-150 flex flex-col overflow-hidden shadow-2xl ${
        isActive
          ? 'border-[#3D436B] ring-1 ring-indigo-500/30 shadow-indigo-950/40'
          : 'border-[#22253D] opacity-95'
      }`}
    >
      {/* Window Titlebar */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`h-11 px-3.5 flex items-center justify-between cursor-grab active:cursor-grabbing border-b shrink-0 select-none ${
          isActive ? 'bg-[#17192C] border-[#292C48]' : 'bg-[#131424] border-[#1E2034]'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          {getWindowIcon()}
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-white truncate leading-none">{win.title}</h3>
            {win.subtitle && (
              <p className="text-[10px] text-slate-400 truncate mt-0.5">{win.subtitle}</p>
            )}
          </div>
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onMinimize}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#232644] transition"
            title="Minimize ke dock status bar"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onMaximize}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#232644] transition"
            title={win.isMaximized ? 'Restore ukuran' : 'Maximize window'}
          >
            {win.isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-rose-950/60 hover:text-rose-300 transition"
            title="Tutup window (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Window Body Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#0D0E19] text-slate-200">
        {children}
      </div>

      {/* Window Resizer Handle (Bottom-Right) */}
      {!win.isMaximized && (
        <div
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5 text-slate-600 hover:text-indigo-400 select-none"
          title="Drag untuk mengubah ukuran"
        >
          <svg className="w-2.5 h-2.5" viewBox="0 0 6 6" fill="currentColor">
            <circle cx="5" cy="5" r="0.75" />
            <circle cx="5" cy="2" r="0.75" />
            <circle cx="2" cy="5" r="0.75" />
          </svg>
        </div>
      )}
    </div>
  );
};

function renderWindowContent(
  win: FloatingWindowInstance,
  project: Project | null,
  scenes: Scene[],
  shots: Shot[],
  characters: CharacterBible[],
  locations: LocationBible[],
  objects: ObjectBible[],
  videoPrompts?: Record<string, VideoPrompt[]> | VideoPrompt[],
  onSelectScene?: (sceneId: string) => void,
  onSelectShot?: (shotId: string) => void,
  onRunShotPrompt?: (shotId: string, target: any) => void,
  onSmartRegenerate?: (
    shotId: string,
    target: any,
    lockState?: any,
    reason?: string,
    requireAi?: boolean
  ) => void,
  onUpdateShotImage?: (shotId: string, imageUrl: string | null) => void,
  processingShotId?: string | null,
  shotPromptError?: string
) {
  switch (win.type) {
    case 'scene_detail': {
      const sceneData: Scene = win.data || scenes.find((s) => s.id === win.id.replace('scene-', '')) || scenes[0];
      return (
        <SceneDetailWindow
          scene={sceneData}
          shots={shots}
          characters={characters}
          locations={locations}
          onSelectShot={onSelectShot}
        />
      );
    }
    case 'shot_detail': {
      const shotData: Shot = win.data?.shot || shots.find((s) => s.id === win.id.replace('shot-', '')) || shots[0];
      const sceneObj = scenes.find((s) => s.id === shotData?.scene_id) || scenes[0];
      const promptsArray: VideoPrompt[] = Array.isArray(videoPrompts)
        ? videoPrompts.filter((p) => p.shot_id === shotData?.id)
        : shotData?.id && videoPrompts && typeof videoPrompts === 'object' && videoPrompts[shotData.id]
        ? (videoPrompts as Record<string, VideoPrompt[]>)[shotData.id]
        : [];

      return (
        <CompactShotCockpit
          shot={shotData}
          sceneId={sceneObj?.id || ''}
          sceneNumber={sceneObj?.scene_number || 1}
          prompts={promptsArray}
          characters={characters}
          locations={locations}
          objects={objects}
          windowInstance={win}
          allShots={shots}
          onSelectShot={onSelectShot}
          onRunShotPrompt={onRunShotPrompt}
          onSmartRegenerate={onSmartRegenerate}
          onUpdateShotImage={onUpdateShotImage}
          processingShotId={processingShotId}
          shotPromptError={shotPromptError}
        />
      );
    }
    case 'character_detail': {
      const charData: CharacterBible =
        win.data || characters.find((c) => c.id === win.id.replace('char-', '')) || characters[0];
      return <CharacterDetailWindow character={charData} projectId={project?.id} />;
    }
    case 'location_detail': {
      const locData: LocationBible =
        win.data || locations.find((l) => l.id === win.id.replace('location-', '')) || locations[0];
      return <LocationDetailWindow location={locData} projectId={project?.id} />;
    }
    case 'keyboard_shortcuts':
      return <KeyboardShortcutsWindow />;
    case 'ai_copilot': {
      const activeScene = scenes[0] || null;
      const activeShot = shots[0] || null;
      return (
        <AICopilotWindow
          project={project}
          selectedScene={activeScene}
          selectedShot={activeShot}
          characters={characters}
          locations={locations}
          objects={objects}
        />
      );
    }
    case 'ai_infrastructure': {
      return <AIInfrastructureControlCenter />;
    }
    default:
      return (
        <div className="p-4 text-slate-300">
          <p>{win.data?.description || 'Konten detail entitas produksi.'}</p>
        </div>
      );
  }
}
