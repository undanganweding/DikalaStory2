import { Scene, Shot } from '../types';
import { getDynamicNegativePrompt } from '../components/workspaces/AssetBibleWorkspace';

/**
 * Builds a continuous global video prompt for an entire scene, incorporating
 * all shot breakdowns, scene timing, dramatic purpose, audio purity constraints,
 * and negative prompts.
 */
export function buildGlobalSceneVideoPrompt(sc: Scene, scShots: Shot[]): string {
  const scNumStr = String(sc.scene_number || 1).padStart(2, '0');
  const totalDuration = scShots.reduce((acc, s) => acc + (s.duration_sec || 5), 0);
  const locName = sc.location_name || 'Historical Setting';
  const purpose = sc.story_purpose || sc.narrative_function || sc.event || 'Pengembangan narasi adegan sinematik.';

  let shotBreakdowns = scShots
    .map((sh, idx) => {
      const shotNumStr = String(sh.shot_number || idx + 1).padStart(2, '0');
      const durSec = sh.duration_sec || 5;
      const framing = sh.shot_type || sh.camera?.framing || 'Medium Shot';
      const cameraMove = sh.camera_movement || sh.camera?.movement || 'Static';
      const visual = sh.visual_description || sh.character_action || sh.event_detail || sh.action || 'Cinematic action';
      const voStr = sh.audio_narration ? `\n  Audio/Narration: "${sh.audio_narration}"` : '';
      const dialogueStr = sh.dialogue ? `\n  Dialogue: "${sh.dialogue}"` : '';

      return `• SHOT ${shotNumStr} [Duration: ${durSec}.0s | Framing: ${framing} | Camera: ${cameraMove}]\n  Visual Action: ${visual}${voStr}${dialogueStr}`;
    })
    .join('\n\n');

  if (!shotBreakdowns) {
    shotBreakdowns = `• SHOT 01 [Duration: ${totalDuration || 10}.0s | Framing: Master Shot | Camera: Panning]\n  Visual Action: ${sc.event || sc.narrative_function || 'Cinematic sequence'}`;
  }

  const textCtx = `${sc.title || ''} ${sc.event || ''} ${sc.location_name || ''}`;
  const sceneNeg = getDynamicNegativePrompt(textCtx, 'global video scene', 'character');

  return `[GLOBAL CINEMATIC VIDEO PROMPT - SCENE ${scNumStr}: ${(sc.title || 'ADEGAN').toUpperCase()}]
TOTAL SCENE DURATION: ${totalDuration || 10}.0s | SEQUENCE: ${scShots.length || 1} SHOTS | ENGINE: UNIVERSAL VIDEO (VEO/SEEDANCE/OMNI)
LOCATION & ENVIRONMENT: ${locName}
DRAMATIC PURPOSE: ${purpose}

CONTINUOUS SHOT TIMELINE SEQUENCE:
${shotBreakdowns}

[AUDIO PURITY CONSTRAINT]: Native/diegetic soundscapes, character speech, room acoustics, and environmental action SFX ONLY. Strictly NO background music, NO BGM, NO soundtrack.

[NEGATIVE PROMPT / PROMPT LARANGAN]
${sceneNeg}`;
}
