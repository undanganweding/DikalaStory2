import React from 'react';
import { Shot, VideoPrompt, PromptTarget, PromptLockState, CharacterBible, LocationBible, ObjectBible } from '../../types';
import { CompactShotCockpit } from './CompactShotCockpit';

export interface DenseShotRowProps {
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
 * DenseShotRow wraps CompactShotCockpit to provide an ultra-compact, single-layer,
 * zero-scroll cockpit experience with 1-click copy, easy regeneration, and flying popups.
 */
export const DenseShotRow: React.FC<DenseShotRowProps> = (props) => {
  return <CompactShotCockpit {...props} />;
};

