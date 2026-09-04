import React, { useState } from 'react';
import {
  Film,
  Layers,
  Sparkles,
  PlaySquare,
  Clock,
  BookOpen,
} from 'lucide-react';
import {
  Project,
  ProjectFoundation,
  StoryArchitecture,
  Scene,
  Shot,
  VideoPrompt,
  CharacterBible,
  LocationBible,
  ObjectBible,
  PromptTarget,
  PromptLockState,
} from '../../types';
import { StoryboardStoryFlow } from '../studio/StoryboardStoryFlow';
import { StoryboardSceneBreakdown } from '../studio/StoryboardSceneBreakdown';

export interface SceneWorkspaceProps {
  project?: Project | null;
  foundation?: ProjectFoundation | null;
  storyArchitecture?: StoryArchitecture | null;
  scenes: Scene[];
  shots: Record<string, Shot[]>;
  /** Keyed by SHOT id (see db.getProjectFullData -> promptsMap), not scene id. */
  videoPrompts?: Record<string, VideoPrompt[]>;
  characters?: CharacterBible[];
  locations?: LocationBible[];
  objects?: ObjectBible[];
  selectedSceneId?: string;
  onSelectScene?: (sceneId: string) => void;
  selectedShotId?: string;
  onSelectShot?: (shotId: string) => void;
  onRunScenePipeline: (sceneId: string) => void;
  onRegenerateScenePrompt: (sceneId: string) => void;
  onUpdateSceneImage: (sceneId: string, imageUrl: string | null) => void;
  onUpdateShotImage?: (shotId: string, imageUrl: string | null) => void;
  onRunShotPrompt?: (shotId: string, target: PromptTarget) => void;
  onSmartRegenerate?: (
    shotId: string,
    target: PromptTarget,
    lockState?: PromptLockState,
    reason?: string,
    requireAi?: boolean
  ) => void;
  processingSceneId: string | null;
  processingShotId?: string | null;
  shotPromptError?: Record<string, string>;
}

export const SceneWorkspace: React.FC<SceneWorkspaceProps> = ({
  project,
  foundation,
  storyArchitecture,
  scenes,
  shots,
  videoPrompts = {},
  characters = [],
  locations = [],
  objects = [],
  selectedSceneId,
  onSelectScene,
  selectedShotId,
  onSelectShot,
  onRunScenePipeline,
  onRegenerateScenePrompt,
  onUpdateSceneImage,
  onUpdateShotImage,
  onRunShotPrompt,
  onSmartRegenerate,
  processingSceneId,
  processingShotId,
  shotPromptError = {},
}) => {
  const [activeSceneId, setActiveSceneId] = useState<string>(
    selectedSceneId || (scenes.length > 0 ? scenes[0].id : '')
  );
  // Top-level Storyboard mode: 'story_flow' | 'scene_breakdown'
  const [storyboardMode, setStoryboardMode] = useState<'story_flow' | 'scene_breakdown'>('scene_breakdown');

  // Synchronize when selectedSceneId changes externally
  React.useEffect(() => {
    if (selectedSceneId) {
      setActiveSceneId(selectedSceneId);
    }
  }, [selectedSceneId]);

  // Aggregate project-level Storyboard metrics
  const totalDurationSec = scenes.reduce((sum, sc) => sum + (sc.duration_sec || 0), 0);
  const totalShotsCount = (Object.values(shots) as Shot[][]).reduce(
    (sum, scShots) => sum + (scShots?.length || 0),
    0
  );
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSelectSceneFromStoryFlow = (scId: string) => {
    setActiveSceneId(scId);
    if (onSelectScene) onSelectScene(scId);
  };

  const handleSwitchToSceneBreakdown = (scId?: string) => {
    if (scId) {
      setActiveSceneId(scId);
      if (onSelectScene) onSelectScene(scId);
    }
    setStoryboardMode('scene_breakdown');
  };

  const sanitizedTitle = (project?.title || 'Storyboard')
    .replace(/^#+\s*/g, '')
    .replace(/#+/g, '—')
    .trim();

  return (
    <div id="storyboard-workspace-container" className="w-full h-full flex flex-col overflow-hidden">
      {/* 1. COMPACT RESPONSIVE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#1E2034] px-3 sm:px-4 py-2.5 gap-2 shrink-0 bg-[#090B12]">
        <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-4 min-w-0">
          <h1 className="text-xs sm:text-sm font-black text-white tracking-tight truncate max-w-[200px] sm:max-w-xs md:max-w-md" title={sanitizedTitle}>
            {sanitizedTitle}
          </h1>
          <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-mono text-slate-400 shrink-0 bg-[#121422] px-2 py-0.5 rounded-md border border-[#1E2034]">
             <span className="text-indigo-300 font-bold">{scenes.length} SC</span>
             <span>•</span>
             <span className="text-amber-300 font-bold">{totalShotsCount} SH</span>
             <span>•</span>
             <span>{formatDuration(totalDurationSec)}</span>
          </div>
        </div>
        
        {/* Top-Level Mode Switcher */}
        <div className="flex items-center gap-1 bg-[#090A14] p-1 rounded-xl border border-[#1E2034] shrink-0 self-start sm:self-auto w-full sm:w-auto justify-stretch">
          <button
            onClick={() => setStoryboardMode('story_flow')}
            className={`flex-1 sm:flex-initial min-h-[36px] sm:min-h-[28px] px-3.5 py-1 rounded-lg text-[10px] font-mono font-bold transition select-none flex items-center justify-center gap-1.5 ${
              storyboardMode === 'story_flow'
                ? 'bg-[#1C1E34] text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3 h-3" />
            <span>STORY FLOW</span>
          </button>
          <button
            onClick={() => setStoryboardMode('scene_breakdown')}
            className={`flex-1 sm:flex-initial min-h-[36px] sm:min-h-[28px] px-3.5 py-1 rounded-lg text-[10px] font-mono font-bold transition select-none flex items-center justify-center gap-1.5 ${
              storyboardMode === 'scene_breakdown'
                ? 'bg-[#1C1E34] text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>BREAKDOWN</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN VIEWPORT */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-4">
        {storyboardMode === 'story_flow' && (
          <StoryboardStoryFlow
            project={project}
            foundation={foundation}
            storyArchitecture={storyArchitecture}
            scenes={scenes}
            shots={shots}
            selectedSceneId={activeSceneId}
            onSelectScene={handleSelectSceneFromStoryFlow}
            onSwitchToSceneBreakdown={handleSwitchToSceneBreakdown}
            videoPrompts={videoPrompts}
          />
        )}

        {storyboardMode === 'scene_breakdown' && (
          <StoryboardSceneBreakdown
            scenes={scenes}
            shots={shots}
            videoPrompts={videoPrompts}
            characters={characters}
            locations={locations}
            objects={objects}
            selectedSceneId={activeSceneId}
            onSelectScene={(scId) => {
              setActiveSceneId(scId);
              if (onSelectScene) onSelectScene(scId);
            }}
            selectedShotId={selectedShotId}
            onSelectShot={onSelectShot}
            onRunScenePipeline={onRunScenePipeline}
            onRegenerateScenePrompt={onRegenerateScenePrompt}
            onUpdateSceneImage={onUpdateSceneImage}
            onUpdateShotImage={onUpdateShotImage}
            onRunShotPrompt={onRunShotPrompt}
            onSmartRegenerate={onSmartRegenerate}
            processingSceneId={processingSceneId}
            processingShotId={processingShotId}
            shotPromptError={shotPromptError}
          />
        )}
      </div>
    </div>
  );
};

