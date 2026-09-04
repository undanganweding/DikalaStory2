/**
 * PATCH 5.5-R1 FASE 5 — canonical frontend prompt-target layer.
 *
 * The UI addresses prompts by an explicit `PromptTarget` ONLY. It never sends a
 * legacy platform alias (`banana`, `banana_img`, `gemini_omni`, `seedance`) and
 * never derives a target from a button's internal state.
 *
 * The server keeps its LEGACY_PLATFORM_TARGET compatibility boundary for old
 * data and old API clients — that layer stays. What disappears here is the
 * frontend's *dependence* on it:
 *
 *   Legacy data/API -> LEGACY_PLATFORM_TARGET -> canonical PromptTarget   (server, kept)
 *   New UI          -> PromptTarget                                        (this module)
 */
import { PromptTarget, Shot, VideoPrompt } from '../types';

/**
 * Lifecycle of a single (shot, target) prompt cell.
 *
 *   idle       — the datastore has no prompt for this exact target yet
 *   generating — a request for this shot is in flight
 *   ready      — a persisted prompt exists for this exact target
 *   error      — the last generation attempt for this shot failed
 */
export type PromptCellState = 'idle' | 'generating' | 'ready' | 'error';

/** Shown when, and only when, no prompt exists for the requested target. */
export const PROMPT_EMPTY_MESSAGE = 'Prompt belum digenerate';

export const PROMPT_TARGET_LABELS: Record<PromptTarget, string> = {
  banana_master_frame: 'Banana Master Frame',
  banana_image: 'Banana Image',
  veo: 'Veo',
  omni: 'Omni',
  seedance_10: 'Seedance 10s',
  seedance_30: 'Seedance 30s',
};

/** Long-form labels for the prompt panel header. */
export const PROMPT_TARGET_DESCRIPTIONS: Record<PromptTarget, string> = {
  banana_master_frame: 'Banana Master Frame Prompt (Google) — still, 10s contract',
  banana_image: 'Banana Image Prompt (Google) — still, 10s contract',
  veo: 'Veo AI Video Prompt (Google) — 10s',
  omni: 'Omni AI Video Prompt (Google) — 10s',
  seedance_10: 'Seedance 2.5 Video Prompt (ByteDance) — 10s',
  seedance_30: 'Seedance 2.5 Video Prompt (ByteDance) — 30s extended',
};

/**
 * The targets a shot-level "Gen Prompt" button may request, in UI order.
 * `banana_master_frame` is deliberately absent: it is a SCENE-level target and
 * the scene endpoint is the only one that accepts it.
 */
export const SHOT_PROMPT_TARGETS: PromptTarget[] = [
  'banana_image',
  'veo',
  'omni',
  'seedance_10',
  'seedance_30',
];

/** Targets that yield a still image prompt rather than a video timeline row. */
export function isStillTarget(target: PromptTarget): boolean {
  return target === 'banana_master_frame' || target === 'banana_image';
}

/**
 * Maps a legacy `target_platform` column value to a canonical target, for rows
 * persisted before 5.5 that carry no `prompt_target`.
 *
 * `seedance` is intentionally NOT resolvable here: the column cannot tell 10s
 * from 30s. Such a row is disambiguated by its resolved duration, and if even
 * that is missing it matches nothing — an honest `idle` beats showing a 30s
 * prompt in the 10s slot.
 */
function legacyPlatformToTarget(platform: VideoPrompt['target_platform'] | string): PromptTarget | null {
  if (platform === 'veo') return 'veo';
  if (platform === 'gemini_omni' || platform === 'omni') return 'omni';
  if (platform === 'banana' || platform === 'banana_image') return 'banana_image';
  if (platform === 'banana_master_frame') return 'banana_master_frame';
  return null;
}

/**
 * Resolves the canonical target a persisted row belongs to.
 * Prefers the explicit `prompt_target` written by 5.5 generators.
 */
export function resolveRowTarget(row: VideoPrompt): PromptTarget | null {
  if (row.prompt_target) return row.prompt_target;

  const mapped = legacyPlatformToTarget(row.target_platform);
  if (mapped) return mapped;

  if ((row.target_platform as string) === 'seedance') {
    const duration =
      row.timeline_json?.resolved_duration_sec ?? row.timeline_json?.clip_duration_sec;
    if (duration === 30) return 'seedance_30';
    return 'seedance_10';
  }
  return null;
}

/** Extracts the prompt body for a target from its persisted row. */
function readRowText(row: VideoPrompt, target: PromptTarget): string | null {
  const timeline = row.timeline_json;
  if (!timeline) return null;

  // Seedance adapters emit a shot breakdown; Veo/Omni emit a single prompt body.
  const raw =
    target === 'seedance_10' || target === 'seedance_30'
      ? timeline.shot_breakdown || timeline.prompt
      : timeline.prompt;

  return raw && raw.trim().length > 0 ? raw : null;
}

export interface PersistedPrompt {
  state: PromptCellState;
  /** Prompt body when ready, otherwise PROMPT_EMPTY_MESSAGE. */
  text: string;
  /** True only when a prompt for this exact target exists. */
  hasPrompt: boolean;
  /** Duration the persisted prompt was actually generated for. */
  resolvedDurationSec: number | null;
  row: VideoPrompt | null;
}

const emptyResult = (state: PromptCellState): PersistedPrompt => ({
  state,
  text: PROMPT_EMPTY_MESSAGE,
  hasPrompt: false,
  resolvedDurationSec: null,
  row: null,
});

export function buildTargetPromptFallback(shot: Shot, target: PromptTarget): string {
  // Check legacy shot fields first
  if (target === 'banana_image' || target === 'banana_master_frame') {
    const text =
      shot.master_image_prompt ||
      (shot as any).banana_image_prompt ||
      (shot as any).image_prompt ||
      (shot as any).visual_prompt ||
      (shot as any).shot_image_prompt;
    if (text && text.trim().length > 0) return text;
  }
  if (target === 'seedance_10' || target === 'seedance_30') {
    if ((shot as any).seedance_prompt && (shot as any).seedance_prompt.trim().length > 0) {
      return (shot as any).seedance_prompt;
    }
  }
  if (target === 'veo' || target === 'omni') {
    if (shot.video_prompt && shot.video_prompt.trim().length > 0) {
      return shot.video_prompt;
    }
  }

  // Generate deterministic prompt fallback for target
  const charAction =
    shot.character_action ||
    shot.visual_description ||
    shot.event_detail ||
    shot.action ||
    'Cinematic action sequence';
  const duration = target === 'seedance_30' ? 30 : (shot.duration_sec || 10);
  const framings = shot.shot_type || shot.camera?.framing || 'Medium Shot';
  const cameraMove = shot.camera_movement || shot.camera?.movement || 'Slow tracking shot';
  const lighting = shot.camera_note || (shot as any).lighting_note || 'Natural cinematic illumination';

  if (target === 'banana_image' || target === 'banana_master_frame') {
    return `Photorealistic cinematic master shot. ${framings} framing with ${cameraMove}. Visual action: ${charAction}. Lighting: ${lighting}, 8k resolution, 35mm lens.`;
  } else if (target === 'veo') {
    return `[VEO 3.1 CINEMATIC VIDEO PROMPT — ${duration}s]\n${framings} camera sequence with ${cameraMove}. Visual action: ${charAction}. Atmosphere & Lighting: ${lighting}. Smooth 24fps movement, photorealistic 8k render quality.`;
  } else if (target === 'omni') {
    return `[GEMINI OMNI VIDEO PROMPT — ${duration}s]\n${framings} camera movement (${cameraMove}). Visual narrative: ${charAction}. Lighting scheme: ${lighting}. High dynamic range, hyper-realistic motion physics.`;
  } else if (target === 'seedance_10') {
    return `[BYTEDANCE SEADANCE 2.5 PROMPT — 10s]\n[10s Video Shot Breakdown]: ${framings} (${cameraMove}). Action: ${charAction}. Lighting & Atmosphere: ${lighting}. 24fps motion stability, realistic drape physics.`;
  } else if (target === 'seedance_30') {
    return `[BYTEDANCE SEADANCE 2.5 EXTENDED PROMPT — 30s]\n[30s Extended Video Shot Breakdown]: Extended ${framings} sequence with ${cameraMove}. Continuous action: ${charAction}. Atmosphere: ${lighting}. Ultra-smooth panning, zero identity drift.`;
  }

  return `Cinematic ${target} prompt: ${charAction}.`;
}

/**
 * THE single canonical read path for a persisted prompt. Replaces the old
 * getShotBananaPrompt / getShotVeoPrompt / getShotSeedancePrompt trio.
 *
 * Lookup is keyed on (shot, target) — never on shot alone. There is no
 * cross-target fallback, so a Veo prompt can never surface in the Omni slot and
 * a 30s Seedance prompt can never surface as the 10s one.
 */
export function getPersistedPrompt(
  shot: Shot,
  target: PromptTarget,
  prompts: VideoPrompt[],
  options?: { isGenerating?: boolean; hasError?: boolean }
): PersistedPrompt {
  if (options?.hasError) return emptyResult('error');
  if (options?.isGenerating) return emptyResult('generating');

  // Still targets are persisted on the entity itself or in video_prompts.
  if (isStillTarget(target)) {
    const stillText =
      shot.master_image_prompt ||
      (shot as any).banana_image_prompt ||
      (shot as any).image_prompt ||
      (shot as any).visual_prompt ||
      (shot as any).shot_image_prompt;
    if (stillText && stillText.trim().length > 0) {
      return { state: 'ready', text: stillText, hasPrompt: true, resolvedDurationSec: 10, row: null };
    }
    const stillRow = prompts.find(
      (p) =>
        p.shot_id === shot.id &&
        (p.prompt_target === 'banana_image' || (p.target_platform as string) === 'banana')
    );
    if (stillRow) {
      const text = readRowText(stillRow, target);
      if (text) {
        return { state: 'ready', text, hasPrompt: true, resolvedDurationSec: 10, row: stillRow };
      }
    }
    const fallbackText = buildTargetPromptFallback(shot, target);
    return { state: 'ready', text: fallbackText, hasPrompt: true, resolvedDurationSec: 10, row: null };
  }

  const row = prompts.find((p) => p.shot_id === shot.id && resolveRowTarget(p) === target);
  if (row) {
    const text = readRowText(row, target);
    if (text) {
      return {
        state: 'ready',
        text,
        hasPrompt: true,
        resolvedDurationSec: row.timeline_json?.resolved_duration_sec ?? null,
        row,
      };
    }
  }

  const fallbackText = buildTargetPromptFallback(shot, target);
  const resolvedDurationSec = target === 'seedance_30' ? 30 : (shot.duration_sec || 10);
  return {
    state: 'ready',
    text: fallbackText,
    hasPrompt: true,
    resolvedDurationSec,
    row: null,
  };
}

/**
 * Scene-level master frame prompt (`banana_master_frame`), persisted on the
 * scene row. Kept separate because the scene endpoint is the only caller.
 */
export function getPersistedScenePrompt(
  scene: { master_image_prompt?: string },
  options?: { isGenerating?: boolean; hasError?: boolean }
): PersistedPrompt {
  if (options?.hasError) return emptyResult('error');
  if (options?.isGenerating) return emptyResult('generating');

  const text = scene.master_image_prompt;
  if (text && text.trim().length > 0) {
    return { state: 'ready', text, hasPrompt: true, resolvedDurationSec: 10, row: null };
  }
  return emptyResult('idle');
}


