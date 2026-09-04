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

  return (
    <div id="storyboard-workspace-container" className="w-full h-full flex flex-col overflow-hidden">
      {/* 1. COMPACT HEADER */}
      <div className="flex items-center justify-between border-b border-[#1E2034] px-4 py-2 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-bold text-white tracking-tight">{project?.title || 'Storyboard'}</h1>
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
             <span>{scenes.length} Scenes</span>
             <span>•</span>
             <span>{totalShotsCount} Shots</span>
             <span>•</span>
             <span>{formatDuration(totalDurationSec)}</span>
          </div>
        </div>
        
        {/* Top-Level Mode Switcher */}
        <div className="flex items-center gap-1 bg-[#090A14] p-0.5 rounded-md border border-[#1E2034] shrink-0">
          <button
            onClick={() => setStoryboardMode('story_flow')}
            className={`px-3 py-1 rounded text-[10px] font-mono font-bold transition ${
              storyboardMode === 'story_flow'
                ? 'bg-[#1C1E34] text-indigo-300'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            STORY FLOW
          </button>
          <button
            onClick={() => setStoryboardMode('scene_breakdown')}
            className={`px-3 py-1 rounded text-[10px] font-mono font-bold transition ${
              storyboardMode === 'scene_breakdown'
                ? 'bg-[#1C1E34] text-indigo-300'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            BREAKDOWN
          </button>
        </div>
      </div>

      {/* 2. MAIN VIEWPORT */}
      <div className="flex-1 overflow-y-auto p-4">
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

