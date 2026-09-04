import React from 'react';
import { Project, Scene, CharacterBible, LocationBible, ObjectBible, VideoPrompt } from '../../types';

export interface SceneProductionWorkspaceProps {
  project: Project;
  scene: Scene;
  characters: CharacterBible[];
  locations: LocationBible[];
  objects: ObjectBible[];
  videoPrompts: VideoPrompt[];
  onRegenerate: () => void;
  onRunPipeline: () => void;
}

export const SceneProductionWorkspace: React.FC<SceneProductionWorkspaceProps> = ({
  scene,
  characters,
  locations,
  objects,
  videoPrompts,
  onRegenerate,
  onRunPipeline,
}) => {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold text-white">SCENE PRODUCTION WORKSPACE</h2>
      <div className="bg-[#121424] border border-[#1F233B] p-4 rounded-xl">
        <h3 className="text-sm font-bold text-indigo-300">Scene: {scene.title}</h3>
        <p className="text-xs text-slate-400">Duration: {scene.duration_sec}s</p>
        {/* Consolidated tools will go here */}
      </div>
    </div>
  );
};
