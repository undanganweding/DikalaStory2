import React, { useState } from 'react';
import {
  PlaySquare,
  Film,
  Sparkles,
  RefreshCw,
  Clock,
  Video,
  ChevronRight,
  ChevronLeft,
  Upload,
  Image as ImageIcon,
  Cpu,
  Layers,
} from 'lucide-react';
import { Scene, Shot, VideoPrompt, PromptTarget, CharacterBible, LocationBible, ObjectBible } from '../../types';
import { CompactShotCockpit } from '../studio/CompactShotCockpit';

interface ShotWorkspaceProps {
  scenes: Scene[];
  shots: Record<string, Shot[]>;
  videoPrompts: Record<string, VideoPrompt[]>;
  onRunShotPrompt: (shotId: string, target: PromptTarget) => void;
  onUpdateShotImage: (shotId: string, imageUrl: string | null) => void;
  processingShotId: string | null;
  shotPromptError?: Record<string, string>;
  characters?: CharacterBible[];
  locations?: LocationBible[];
  objects?: ObjectBible[];
}

export const ShotWorkspace: React.FC<ShotWorkspaceProps> = ({
  scenes,
  shots,
  videoPrompts,
  onRunShotPrompt,
  onUpdateShotImage,
  processingShotId,
  shotPromptError = {},
  characters = [],
  locations = [],
  objects = [],
}) => {
  const [activeSceneId, setActiveSceneId] = useState<string>(scenes.length > 0 ? scenes[0].id : '');
  const [activeShotIndex, setActiveShotIndex] = useState<number>(0);

  const currentScene = scenes.find((s) => s.id === activeSceneId) || scenes[0];
  const currentShots = currentScene ? shots[currentScene.id] || [] : [];
  const selectedShot = currentShots[activeShotIndex] || currentShots[0];

  const currentPrompts: VideoPrompt[] = selectedShot && selectedShot.id ? videoPrompts[selectedShot.id] || [] : [];

  if (scenes.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 max-w-lg mx-auto space-y-4">
        <PlaySquare className="w-12 h-12 mx-auto text-slate-600" />
        <h3 className="text-lg font-bold text-slate-300">Belum Ada Shot Tersedia</h3>
        <p className="text-xs text-slate-400">
          Subdivisi shot akan otomatis digenerate pada Stage 6 &amp; 8 produksi sinematik.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col lg:flex-row overflow-hidden bg-[#070810]">
      {/* 1. SCENE SELECTOR (Horizontal scroll on mobile, vertical sidebar on desktop) */}
      <div className="w-full lg:w-64 bg-[#0B0D18] border-b lg:border-b-0 lg:border-r border-[#1C1F33] flex flex-col shrink-0">
        <div className="px-3 py-2 sm:p-3.5 border-b border-[#1C1F33] bg-[#0E1020] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Film className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] sm:text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
              Daftar Adegan
            </span>
          </div>
          <span className="text-[9px] sm:text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
            {scenes.length} Scene
          </span>
        </div>

        {/* Mobile horizontal track / Desktop vertical list */}
        <div className="p-1.5 sm:p-2 flex flex-row lg:flex-col gap-1.5 overflow-x-auto lg:overflow-y-auto scrollbar-none">
          {scenes.map((sc) => {
            const isSelected = sc.id === currentScene?.id;
            const scShots = shots[sc.id] || [];
            return (
              <button
                key={sc.id}
                onClick={() => {
                  setActiveSceneId(sc.id);
                  setActiveShotIndex(0);
                }}
                className={`min-h-[40px] px-2.5 py-1.5 sm:p-2.5 rounded-xl text-left transition flex items-center justify-between gap-2 border shrink-0 whitespace-nowrap lg:whitespace-normal ${
                  isSelected
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-white shadow-md'
                    : 'hover:bg-[#141628] bg-[#0E1020]/60 text-slate-400 border-transparent'
                }`}
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                        isSelected ? 'bg-indigo-500 text-white' : 'bg-[#181B2E] text-slate-400'
                      }`}
                    >
                      SC-{String(sc.scene_number).padStart(2, '0')}
                    </span>
                    <span className="text-xs font-bold truncate text-slate-200 max-w-[120px] sm:max-w-none">
                      {sc.title || `Adegan ${sc.scene_number}`}
                    </span>
                  </div>
                  <div className="hidden sm:block text-[10px] text-slate-500 font-mono">
                    {scShots.length} shot • {sc.duration_sec}s
                  </div>
                </div>
                <ChevronRight
                  className={`hidden lg:block w-3.5 h-3.5 shrink-0 ${
                    isSelected ? 'text-indigo-400 opacity-100' : 'text-slate-600 opacity-0'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. MAIN COCKPIT: Single-Layer Zero-Scroll Shot Workspace */}
      <div className="flex-1 min-h-0 flex flex-col p-2 sm:p-4 overflow-y-auto justify-between space-y-2.5 sm:space-y-3">
        {currentScene && (
          <>
            {/* Top Bar: Scene Info & Horizontal Shot Strip */}
            <div className="bg-[#0E1020] border border-[#1E223A] p-2.5 sm:p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] font-mono uppercase text-indigo-400 font-bold">
                  <span>SC-{String(currentScene.scene_number).padStart(2, '0')}</span>
                  <span>•</span>
                  <span className="text-slate-300 truncate max-w-[140px] sm:max-w-none">{currentScene.location_name || 'Latar Sinematik'}</span>
                  <span>•</span>
                  <span className="text-amber-400 font-bold">{currentScene.duration_sec}s</span>
                </div>
                <h2 className="text-xs sm:text-base font-black text-white truncate mt-0.5">
                  {currentScene.title || `Adegan ${currentScene.scene_number}`}
                </h2>
              </div>

              {/* Shot Selector Tabs Strip: [S1] [S2] [S3] ... */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase mr-1 shrink-0">
                  Shot:
                </span>
                {currentShots.map((sh, idx) => {
                  const isSelected = activeShotIndex === idx;
                  return (
                    <button
                      key={sh.id || idx}
                      onClick={() => setActiveShotIndex(idx)}
                      className={`min-h-[36px] sm:min-h-[28px] px-2.5 sm:px-3 py-1 rounded-xl text-xs font-mono font-bold transition shrink-0 flex items-center gap-1.5 border select-none ${
                        isSelected
                          ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20'
                          : 'bg-[#15182C] text-slate-300 hover:text-white border-[#242846]'
                      }`}
                    >
                      <span>SH-{String(sh.shot_number || idx + 1).padStart(2, '0')}</span>
                      <span className={`text-[9px] ${isSelected ? 'text-black/70' : 'text-slate-500'}`}>
                        {sh.duration_sec}s
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Core Shot Cockpit */}
            <div className="flex-1 flex flex-col justify-center min-h-0">
              {selectedShot ? (
                <CompactShotCockpit
                  shot={selectedShot}
                  totalShots={currentShots.length}
                  shotIndex={activeShotIndex}
                  sceneId={currentScene.id}
                  sceneNumber={currentScene.scene_number}
                  prompts={currentPrompts}
                  isSelected={true}
                  onPrevShot={activeShotIndex > 0 ? () => setActiveShotIndex(activeShotIndex - 1) : undefined}
                  onNextShot={
                    activeShotIndex < currentShots.length - 1
                      ? () => setActiveShotIndex(activeShotIndex + 1)
                      : undefined
                  }
                  onRunShotPrompt={onRunShotPrompt}
                  onUpdateShotImage={onUpdateShotImage}
                  processingShotId={processingShotId}
                  shotPromptError={shotPromptError[selectedShot.id || '']}
                  characters={characters}
                  locations={locations}
                  objects={objects}
                />
              ) : (
                <div className="p-8 sm:p-12 text-center text-slate-500 bg-[#0E1020] rounded-2xl border border-[#1E223A] space-y-3">
                  <PlaySquare className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-xs">Belum ada shot pada adegan ini.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

