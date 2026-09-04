import React from 'react';
import {
  Shot,
  VideoPrompt,
  PromptTarget,
  PromptLockState,
  CharacterBible,
  LocationBible,
  ObjectBible,
} from '../../types';
import { CompactShotCockpit } from './CompactShotCockpit';

export interface PromptWorkbenchProps {
  shot: Shot;
  totalShots?: number;
  shotIndex?: number;
  sceneId: string;
  sceneNumber: number;
  prompts: VideoPrompt[];
  isSelected?: boolean;
  onSelect?: () => void;
  onPrevShot?: () => void;
  onNextShot?: () => void;
  onRunShotPrompt?: (shotId: string, target: PromptTarget) => void;
  onSmartRegenerate?: (
    shotId: string,
    target: PromptTarget,
    lockState?: PromptLockState,
    reason?: string,
    requireAi?: boolean
  ) => void;
  onUpdateShotImage?: (shotId: string, imageUrl: string | null) => void;
  processingShotId?: string | null;
  shotPromptError?: string;
  defaultExpanded?: boolean;
  characters?: CharacterBible[];
  locations?: LocationBible[];
  objects?: ObjectBible[];
}

/**
 * PromptWorkbench forwards directly to CompactShotCockpit to provide
 * the redesigned ultra-compact single-layer cockpit experience with
 * zero-scroll requirement, flying popups, 1-click copy, and local file upload.
 */
export const PromptWorkbench: React.FC<PromptWorkbenchProps> = (props) => {
  return <CompactShotCockpit {...props} />;
};
