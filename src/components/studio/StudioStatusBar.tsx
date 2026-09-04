import React from 'react';
import {
  Activity,
  Clock,
  Layers,
  Sparkles,
  Zap,
  Command,
  Maximize,
  HelpCircle,
  Film,
  Cpu,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { useWindowManager } from '../../context/WindowManagerContext';
import { Project, Scene, Shot } from '../../types';

interface StudioStatusBarProps {
  currentProject: Project | null;
  scenes: Scene[];
  shots: Record<string, Shot[]> | Shot[];
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  isGenerating?: boolean;
}

export const StudioStatusBar: React.FC<StudioStatusBarProps> = ({
  currentProject,
  scenes,
  shots,
  isFocusMode,
  onToggleFocusMode,
  isGenerating = false,
}) => {
  const { windows, restoreWindow, openWindow } = useWindowManager();

  const flatShots: Shot[] = Array.isArray(shots)
    ? shots
    : shots && typeof shots === 'object'
    ? Object.values(shots).flat().filter(Boolean)
    : [];

  const totalScenesDuration = scenes.reduce((acc, sc) => acc + (sc.duration_sec || 0), 0);
  const targetDuration = currentProject?.total_duration_target_sec || totalScenesDuration || 0;

  const minimizedWindows = windows.filter((w) => w.isMinimized);

  return (
    <footer
      id="studio-viewport-status-bar"
      className="h-8 bg-[#0D0E19] border-t border-[#1C1E32] px-3 flex items-center justify-between text-[11px] font-mono text-slate-400 shrink-0 z-30 select-none"
    >
      {/* Left: Project Runtime & Scene/Shot Counts */}
      <div className="flex items-center gap-3">
        {/* Status Pill */}
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isGenerating
                ? 'bg-amber-400 animate-ping'
                : currentProject?.status === 'completed'
                ? 'bg-emerald-400'
                : 'bg-indigo-400'
            }`}
          />
          <span className="font-bold text-slate-300">
            {isGenerating
              ? `RUNNING STAGE ${currentProject?.current_stage || 1}`
              : currentProject?.status === 'completed'
              ? 'PRODUCTION READY'
              : 'STUDIO DRAFT'}
          </span>
        </div>

        <span className="text-slate-700">|</span>

        {/* Runtime metric */}
        <div className="flex items-center gap-1.5 text-slate-300">
          <Clock className="w-3 h-3 text-cyan-400" />
          <span>
            {totalScenesDuration}s <span className="text-slate-500">/ {targetDuration}s</span>
          </span>
        </div>

        <span className="text-slate-700 hidden sm:inline">|</span>

        {/* Scene / Shot counts */}
        <div className="hidden sm:flex items-center gap-2 text-slate-300">
          <span>{scenes.length} Scenes</span>
          <span>•</span>
          <span>{flatShots.length} Shots</span>
        </div>
      </div>

      {/* Center: Minimized Floating Windows Dock */}
      {minimizedWindows.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-sm px-2">
          {minimizedWindows.map((win) => (
            <button
              key={win.id}
              onClick={() => restoreWindow(win.id)}
              className="px-2 py-0.5 rounded bg-[#181A2F] hover:bg-[#252848] text-indigo-300 border border-[#2A2E50] text-[10px] truncate max-w-[140px] transition flex items-center gap-1 shadow-sm"
              title={`Restore window: ${win.title}`}
            >
              <Sparkles className="w-2.5 h-2.5 text-amber-400 shrink-0" />
              <span className="truncate">{win.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Right: Quick Tools, AI Copilot, Focus Mode, Shortcuts */}
      <div className="flex items-center gap-2">
        {/* AI Copilot trigger */}
        <button
          onClick={() =>
            openWindow({
              id: 'ai-copilot-window',
              type: 'ai_copilot',
              title: 'AI Production Copilot',
              subtitle: 'Analisis Naskah & Generator Prompt',
              icon: <Sparkles className="w-4 h-4 text-amber-400" />,
            })
          }
          className="px-2 py-0.5 rounded bg-[#16182C] hover:bg-[#212440] text-amber-300 border border-[#2B2E4E] transition flex items-center gap-1 text-[10px] font-bold"
          title="Buka AI Copilot"
        >
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span className="hidden md:inline">AI Copilot</span>
        </button>

        {/* Focus Mode button */}
        <button
          onClick={onToggleFocusMode}
          className={`px-2 py-0.5 rounded border transition flex items-center gap-1 text-[10px] ${
            isFocusMode
              ? 'bg-indigo-600 text-white border-indigo-400 font-bold'
              : 'bg-[#16182C] text-slate-400 hover:text-white border-[#24273E]'
          }`}
          title="Toggle Focus Mode (Shortcut: F)"
        >
          <Maximize className="w-3 h-3" />
          <span className="hidden md:inline">Focus (F)</span>
        </button>

        {/* Keyboard Shortcuts (?) */}
        <button
          onClick={() =>
            openWindow({
              id: 'keyboard-shortcuts-guide',
              type: 'keyboard_shortcuts',
              title: 'Keyboard Shortcuts Guide',
              subtitle: 'Perintah Cepat Workspace',
              icon: <Command className="w-4 h-4 text-indigo-400" />,
            })
          }
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1C1E32] transition"
          title="Keyboard Shortcuts (?)"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>
    </footer>
  );
};
