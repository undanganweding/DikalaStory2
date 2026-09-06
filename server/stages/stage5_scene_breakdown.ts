import { executeTask, safeParseJSON } from '../llm_provider';
import { Type } from '../gemini';
import { ContextPackage, NarrativeBeats, ReasoningConfig, Scene } from '../../src/types';
import { buildNarrativeVoiceInstruction, recommendSceneTone } from '../narrative_tone';

export interface Stage5SceneBreakdownInput {
  narrativeBeats: NarrativeBeats;
  totalDurationTargetSec: number;
  maxSceneDurationSec: number; // Effective ceiling (e.g. 30 if null/Auto)
  fixedSceneDurationSec?: number | null; // Fixed duration per scene if specified by user
  allowFinalSceneOverride?: boolean;
  contextPackage?: ContextPackage | null;
  language: 'id' | 'en';
  model?: string;
  reasoningConfig?: ReasoningConfig;
  feedbackPrompt?: string; // Corrective prompt on retry
  // Canonical asset rosters produced by S2 (Character Bible) and S3 (Location
  // Bible). S6 asset-integrity gate matches scene.character_names /
  // scene.location_name against these exact names, so S5 must not invent new
  // ones. When supplied, generated names are canonicalized against them.
  characterRoster?: string[];
  locationRoster?: string[];
}

export type DetectedScene = Omit<
  Scene,
  'id' | 'project_id' | 'version' | 'created_at' | 'updated_at'
>;

export interface Stage5ValidationResult {
  valid: boolean;
  totalCalculated: number;
  targetTotal: number;
  maxViolations: { scene_number: number; title: string; duration_sec: number }[];
  fixedViolations?: { scene_number: number; title: string; duration_sec: number; expected: number }[];
  errorMessage?: string;
  correctivePrompt?: string;
}

export interface SceneAssetNameViolation {
  scene_number: number;
  assetType: 'CHARACTER' | 'LOCATION';
  value: string;
}

export interface Stage5AssetNameValidationResult {
  valid: boolean;
  violations: SceneAssetNameViolation[];
  errorMessage?: string;
  correctivePrompt?: string;
}

// Generic honorifics / articles carry no identifying signal, so they are
// excluded from similarity scoring ("Sang Putri" must resolve to
// "Putri Nelayan", not tie with "Sang Nelayan").
const ASSET_NAME_STOPWORDS = new Set([
  'sang', 'si', 'the', 'a', 'an', 'of', 'dan', 'and', 'de', 'da', 'di', 'ke', 'pada',
]);

function normalizeAssetName(value: string | any): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Drops parenthetical qualifiers, e.g. "Danau Berkabut (Fajar)" -> "danau berkabut". */
function baseAssetName(value: string | any): string {
  if (typeof value !== 'string') return '';
  return normalizeAssetName(value.replace(/\([^)]*\)/g, ' '));
}

function assetNameTokens(value: string): string[] {
  return baseAssetName(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0 && !ASSET_NAME_STOPWORDS.has(token));
}

function assetNameSimilarity(candidate: string, target: string): number {
  const candidateTokens = new Set(assetNameTokens(candidate));
  const targetTokens = new Set(assetNameTokens(target));
  if (candidateTokens.size === 0 || targetTokens.size === 0) return 0;
  let intersection = 0;
  candidateTokens.forEach((token) => {
    if (targetTokens.has(token)) intersection++;
  });
  const union = new Set([...candidateTokens, ...targetTokens]).size;
  return intersection / union;
}

/**
 * Snap an LLM-generated asset name onto the canonical roster entry it refers to.
 * Returns null when the reference is ambiguous or genuinely absent, so the
 * caller can force an S5 regeneration instead of silently mapping a scene onto
 * the wrong asset.
 */
export function resolveCanonicalAssetName(candidate: string, roster: string[]): string | null {
  if (!candidate || !candidate.trim() || roster.length === 0) return null;
  const normalizedCandidate = baseAssetName(candidate);
  if (!normalizedCandidate) return null;

  const exact = roster.find((entry) => baseAssetName(entry) === normalizedCandidate);
  if (exact) return exact;

  // Qualifier-tolerant containment: "Danau Berkabut" -> "Danau Berkabut (Fajar)".
  const contained = roster.filter((entry) => {
    const normalizedEntry = baseAssetName(entry);
    return normalizedEntry.startsWith(`${normalizedCandidate} `) || normalizedCandidate.startsWith(`${normalizedEntry} `);
  });
  if (contained.length === 1) return contained[0];

  const scored = roster
    .map((entry) => ({ name: entry, score: assetNameSimilarity(candidate, entry) }))
    .sort((left, right) => right.score - left.score);
  const best = scored[0];
  const runnerUp = scored[1];
  if (best && best.score >= 0.5 && (!runnerUp || best.score > runnerUp.score)) {
    return best.name;
  }
  return null;
}

/**
 * Rewrites scene asset references to canonical Bible names in place of LLM
 * paraphrases. Names that cannot be resolved unambiguously are left untouched
 * and surfaced by validateSceneAssetNames().
 */
export function canonicalizeSceneAssetNames(
  scenes: DetectedScene[],
  characterRoster: string[],
  locationRoster: string[]
): DetectedScene[] {
  if (characterRoster.length === 0 && locationRoster.length === 0) return scenes;
  return scenes.map((scene) => {
    const canonicalLocation = scene.location_name
      ? resolveCanonicalAssetName(scene.location_name, locationRoster)
      : null;
    const canonicalCharacters = (scene.character_names || []).map(
      (name) => resolveCanonicalAssetName(name, characterRoster) || name
    );
    const dedupedCharacters = Array.from(new Set(canonicalCharacters));
    return {
      ...scene,
      location_name: canonicalLocation || scene.location_name,
      character_names: dedupedCharacters,
      ...(scene.characters_present
        ? { characters_present: Array.from(new Set(scene.characters_present.map((name) => resolveCanonicalAssetName(name, characterRoster) || name))) }
        : {}),
    };
  });
}

/**
 * Guards the S5 -> S6 contract: every scene asset reference must exist in the
 * Character/Location Bible. Unresolvable references are reported with a
 * corrective prompt so the existing S5 retry loop can regenerate against the
 * exact roster, instead of letting the S6 asset-integrity gate block every
 * scene at the end of the run.
 */
export function validateSceneAssetNames(
  scenes: DetectedScene[],
  characterRoster: (string | any)[],
  locationRoster: (string | any)[],
  language: 'id' | 'en' = 'id'
): Stage5AssetNameValidationResult {
  const normCharRoster: string[] = (characterRoster || []).map((c) => (typeof c === 'string' ? c : c?.name || ''));
  const normLocRoster: string[] = (locationRoster || []).map((l) => (typeof l === 'string' ? l : l?.name || ''));

  if (normCharRoster.length === 0 && normLocRoster.length === 0) {
    return { valid: true, violations: [] };
  }
  const isIndo = language === 'id';
  const violations: SceneAssetNameViolation[] = [];

  for (const scene of scenes) {
    if (normLocRoster.length > 0 && scene.location_name && !normLocRoster.some((entry) => baseAssetName(entry) === baseAssetName(scene.location_name))) {
      violations.push({ scene_number: scene.scene_number, assetType: 'LOCATION', value: scene.location_name });
    }
    if (normCharRoster.length > 0) {
      for (const name of scene.character_names || []) {
        if (!normCharRoster.some((entry) => baseAssetName(entry) === baseAssetName(name))) {
          violations.push({ scene_number: scene.scene_number, assetType: 'CHARACTER', value: name });
        }
      }
    }
  }

  if (violations.length === 0) {
    return { valid: true, violations: [] };
  }

  const summary = violations
    .map((violation) => `Scene #${violation.scene_number} ${violation.assetType} "${violation.value}"`)
    .join(', ');
  const errorMessage = isIndo
    ? `Referensi asset di luar Character/Location Bible: ${summary}.`
    : `Scene asset references outside the Character/Location Bible: ${summary}.`;
  const correctivePrompt = isIndo
    ? `WAJIB gunakan HANYA nama asset kanonik berikut, ditulis PERSIS sama. KARAKTER: ${normCharRoster.join(' | ') || '(tidak ada)'}. LOKASI: ${normLocRoster.join(' | ') || '(tidak ada)'}. Jangan membuat nama karakter atau lokasi baru, jangan menyingkat, jangan menambah gelar. Referensi bermasalah: ${summary}.`
    : `Use ONLY these canonical asset names, spelled EXACTLY. CHARACTERS: ${normCharRoster.join(' | ') || '(none)'}. LOCATIONS: ${normLocRoster.join(' | ') || '(none)'}. Do not invent, abbreviate, or re-title any character or location. Offending references: ${summary}.`;

  return { valid: false, violations, errorMessage, correctivePrompt };
}

export function validateSceneDurations(
  scenes: DetectedScene[],
  targetTotalSec: number,
  maxSceneSec: number = targetTotalSec,
  language: 'id' | 'en' = 'id',
  fixedSceneSec?: number | null,
  allowFinalOverride?: boolean
): Stage5ValidationResult {
  const isIndo = language === 'id';
  let totalCalculated = 0;
  const maxViolations: { scene_number: number; title: string; duration_sec: number }[] = [];
  const fixedViolations: { scene_number: number; title: string; duration_sec: number; expected: number }[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    totalCalculated += scene.duration_sec;
    const effectiveCeiling = fixedSceneSec || maxSceneSec;

    if (scene.duration_sec > effectiveCeiling || scene.duration_sec < 5) {
      maxViolations.push({
        scene_number: scene.scene_number,
        title: scene.title,
        duration_sec: scene.duration_sec,
      });
    }

    if (fixedSceneSec) {
      const isLastScene = i === scenes.length - 1;
      if (!isLastScene && scene.duration_sec !== fixedSceneSec) {
        fixedViolations.push({
          scene_number: scene.scene_number,
          title: scene.title,
          duration_sec: scene.duration_sec,
          expected: fixedSceneSec,
        });
      } else if (isLastScene && !allowFinalOverride && scene.duration_sec !== fixedSceneSec) {
        fixedViolations.push({
          scene_number: scene.scene_number,
          title: scene.title,
          duration_sec: scene.duration_sec,
          expected: fixedSceneSec,
        });
      }
    }
  }

  const diff = totalCalculated - targetTotalSec;
  const hasSumError = totalCalculated !== targetTotalSec;
  const hasMaxError = maxViolations.length > 0;
  const hasFixedError = fixedViolations.length > 0;

  if (!hasSumError && !hasMaxError && !hasFixedError) {
    return {
      valid: true,
      totalCalculated,
      targetTotal: targetTotalSec,
      maxViolations: [],
      fixedViolations: [],
    };
  }

  let errorDetails: string[] = [];
  let correctiveNotes: string[] = [];

  if (hasSumError) {
    if (isIndo) {
      errorDetails.push(
        `Total durasi yang Anda hasilkan adalah ${totalCalculated} detik, padahal target eksak adalah ${targetTotalSec} detik (selisih: ${
          diff > 0 ? `+${diff}` : `${diff}`
        } detik).`
      );
      correctiveNotes.push(
        `Pastikan jumlah sum(scene.duration_sec) TEPAT ${targetTotalSec} detik (toleransi 0 detik).`
      );
    } else {
      errorDetails.push(
        `Calculated total duration is ${totalCalculated}s, while strict target is ${targetTotalSec}s (variance: ${
          diff > 0 ? `+${diff}` : `${diff}`
        }s).`
      );
      correctiveNotes.push(
        `Ensure sum(scene.duration_sec) equals EXACTLY ${targetTotalSec}s (0s tolerance).`
      );
    }
  }

  if (hasFixedError && fixedSceneSec) {
    if (isIndo) {
      errorDetails.push(
        `User telah menetapkan Fixed Scene Duration = ${fixedSceneSec}s. Seluruh scene WAJIB menggunakan durasi ${fixedSceneSec}s.`
      );
      correctiveNotes.push(
        `Ubah setiap scene agar durasinya TEPAT ${fixedSceneSec} detik.`
      );
    } else {
      errorDetails.push(
        `Fixed Scene Duration is locked to ${fixedSceneSec}s. All scenes MUST have duration ${fixedSceneSec}s.`
      );
      correctiveNotes.push(
        `Set every scene duration to EXACTLY ${fixedSceneSec} seconds.`
      );
    }
  }

  if (hasMaxError) {
    const violationSummary = maxViolations
      .map((v) => `Scene #${v.scene_number} ("${v.title}") = ${v.duration_sec}s`)
      .join(', ');
    if (isIndo) {
      errorDetails.push(
        `Terdapat scene dengan durasi di luar batas valid (5 - ${fixedSceneSec || maxSceneSec}s): ${violationSummary}.`
      );
      correctiveNotes.push(
        `Pastikan durasi setiap scene berada pada rentang valid (5 - ${fixedSceneSec || maxSceneSec} detik).`
      );
    } else {
      errorDetails.push(
        `There are scenes outside valid duration bounds (5 - ${fixedSceneSec || maxSceneSec}s): ${violationSummary}.`
      );
      correctiveNotes.push(
        `Ensure every scene duration is within valid bounds (5 - ${fixedSceneSec || maxSceneSec} seconds).`
      );
    }
  }

  const errorMessage = errorDetails.join(' ');
  const correctivePrompt = correctiveNotes.join(' ');

  return {
    valid: false,
    totalCalculated,
    targetTotal: targetTotalSec,
    maxViolations,
    fixedViolations,
    errorMessage,
    correctivePrompt,
  };
}

/**
 * Structurally guarantees that the scene breakdown has at least minScenesRequired
 * scenes, subdividing longer scenes while strictly preserving canonical assets
 * and narrative continuity.
 */
export function ensureSufficientSceneCount(
  scenes: DetectedScene[],
  minScenesRequired: number,
  language: 'id' | 'en' = 'id'
): DetectedScene[] {
  if (scenes.length >= minScenesRequired) {
    return scenes;
  }

  const isIndo = language === 'id';
  const expanded: DetectedScene[] = [...scenes];

  while (expanded.length < minScenesRequired) {
    let maxIdx = 0;
    for (let i = 1; i < expanded.length; i++) {
      if ((expanded[i].duration_sec || 0) > (expanded[maxIdx].duration_sec || 0)) {
        maxIdx = i;
      }
    }
    const targetScene = expanded[maxIdx];
    const halfDur = Math.max(5, Math.floor((targetScene.duration_sec || 10) / 2));
    const remDur = Math.max(5, (targetScene.duration_sec || 10) - halfDur);

    const part1: DetectedScene = {
      ...targetScene,
      title: isIndo ? `${targetScene.title} (Bagian 1: Pengantar)` : `${targetScene.title} (Part 1: Setup)`,
      story_purpose: isIndo
        ? `${targetScene.story_purpose} - Fase inisiasi & ketegangan awal.`
        : `${targetScene.story_purpose} - Initial initiation and tension setup.`,
      narrative_function: targetScene.narrative_function?.toUpperCase().includes('CLIMAX')
        ? 'RISING_ACTION'
        : (targetScene.narrative_function || 'EXPOSITION'),
      duration_sec: halfDur,
    };

    const part2: DetectedScene = {
      ...targetScene,
      title: isIndo ? `${targetScene.title} (Bagian 2: Resolusi)` : `${targetScene.title} (Part 2: Escalation)`,
      story_purpose: isIndo
        ? `${targetScene.story_purpose} - Puncak eskalasi & konsekuensi dramatis.`
        : `${targetScene.story_purpose} - Peak escalation and dramatic payoff.`,
      narrative_function: targetScene.narrative_function || 'DEVELOPMENT',
      duration_sec: remDur,
    };

    expanded.splice(maxIdx, 1, part1, part2);
  }

  return expanded.map((sc, idx) => ({
    ...sc,
    scene_number: idx + 1,
  }));
}

/**
 * Deterministically allocates and normalizes scene durations to strictly satisfy:
 * 1. sum(scene.duration_sec) === targetTotalSec (0s variance)
 * 2. 5s <= scene.duration_sec <= effectiveCeiling (unless fixed duration specifies otherwise)
 * 3. Preserves relative narrative weights (climax/high tension beats receive more duration)
 * 4. Distinctly separates narrative duration from platform generation container limits.
 */
export function allocateAndNormalizeSceneDurations(
  scenes: DetectedScene[],
  targetTotalSec: number,
  maxSceneSec: number,
  fixedSceneSec?: number | null,
  allowFinalOverride?: boolean,
  language: 'id' | 'en' = 'id'
): DetectedScene[] {
  if (scenes.length === 0) return scenes;

  const isFixed = Boolean(fixedSceneSec && fixedSceneSec > 0);
  const effectiveCeiling = fixedSceneSec || maxSceneSec || targetTotalSec;

  if (isFixed && fixedSceneSec) {
    let result = scenes.map((s, idx) => ({
      ...s,
      scene_number: idx + 1,
      duration_sec: fixedSceneSec,
    }));

    let currentTotal = result.reduce((sum, s) => sum + s.duration_sec, 0);
    const diff = targetTotalSec - currentTotal;

    if (diff !== 0) {
      if (allowFinalOverride && result.length > 0) {
        const finalDur = result[result.length - 1].duration_sec + diff;
        if (finalDur >= 5) {
          result[result.length - 1].duration_sec = finalDur;
        }
      } else {
        const expectedCount = Math.max(1, Math.round(targetTotalSec / fixedSceneSec));
        if (result.length > expectedCount) {
          result = result.slice(0, expectedCount);
        } else if (result.length < expectedCount) {
          while (result.length < expectedCount) {
            const last = result[result.length - 1];
            result.push({
              ...last,
              scene_number: result.length + 1,
              title: `${last.title} (Continuation)`,
              duration_sec: fixedSceneSec,
            });
          }
        }
        const newTotal = result.reduce((sum, s) => sum + s.duration_sec, 0);
        const rem = targetTotalSec - newTotal;
        if (rem !== 0 && result.length > 0) {
          result[result.length - 1].duration_sec += rem;
        }
      }
    }
    return result;
  }

  // AUTO / DYNAMIC ALLOCATION MODE
  const minScenes = Math.max(1, Math.ceil(targetTotalSec / effectiveCeiling));
  const preparedScenes = ensureSufficientSceneCount(scenes, minScenes, language);

  const n = preparedScenes.length;
  const minDur = Math.min(5, Math.floor(targetTotalSec / n));
  const maxDur = effectiveCeiling;

  // 1. Calculate relative narrative weights from model outputs and narrative functions
  const weights = preparedScenes.map((sc) => {
    let w = Math.max(1, Number(sc.duration_sec) || 10);
    const func = (sc.narrative_function || '').toUpperCase();
    if (func.includes('CLIMAX') || func.includes('CRISIS') || func.includes('PEAK')) {
      w *= 1.35;
    } else if (func.includes('DEVELOPMENT') || func.includes('ESCALATION') || func.includes('TURNING_POINT')) {
      w *= 1.15;
    } else if (func.includes('EXPOSITION') || func.includes('PROLOGUE') || func.includes('TRANSITION')) {
      w *= 0.85;
    }
    return w;
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // 2. Proportional initial allocation
  const allocated = weights.map((w) => {
    const rawAlloc = Math.round((w / totalWeight) * targetTotalSec);
    return Math.max(minDur, Math.min(maxDur, rawAlloc));
  });

  // 3. Exact zero-tolerance reconciliation
  let currentSum = allocated.reduce((sum, d) => sum + d, 0);
  let diff = targetTotalSec - currentSum;

  if (diff > 0) {
    const indicesByWeightDesc = weights
      .map((w, idx) => ({ w, idx }))
      .sort((a, b) => b.w - a.w)
      .map((item) => item.idx);

    let progress = true;
    while (diff > 0 && progress) {
      progress = false;
      for (const idx of indicesByWeightDesc) {
        if (diff <= 0) break;
        if (allocated[idx] < maxDur) {
          allocated[idx]++;
          diff--;
          progress = true;
        }
      }
    }
    if (diff > 0) {
      allocated[allocated.length - 1] += diff;
    }
  } else if (diff < 0) {
    const indicesByWeightAsc = weights
      .map((w, idx) => ({ w, idx }))
      .sort((a, b) => a.w - b.w)
      .map((item) => item.idx);

    let progress = true;
    while (diff < 0 && progress) {
      progress = false;
      for (const idx of indicesByWeightAsc) {
        if (diff >= 0) break;
        if (allocated[idx] > minDur) {
          allocated[idx]--;
          diff++;
          progress = true;
        }
      }
    }
    if (diff < 0) {
      allocated[0] += diff;
    }
  }

  return preparedScenes.map((sc, idx) => ({
    ...sc,
    scene_number: idx + 1,
    duration_sec: allocated[idx],
  }));
}

export async function runStage5SceneBreakdownAttempt(
  input: Stage5SceneBreakdownInput
): Promise<DetectedScene[]> {
  const isIndo = input.language === 'id';

  const isFixed = Boolean(input.fixedSceneDurationSec && input.fixedSceneDurationSec > 0);
  const effectiveCeiling = input.fixedSceneDurationSec || input.maxSceneDurationSec || 30;
  const minScenesRequired = Math.max(1, Math.ceil(input.totalDurationTargetSec / effectiveCeiling));

  const targetAvgSceneDuration = isFixed
    ? input.fixedSceneDurationSec!
    : Math.min(25, Math.max(12, Math.round(effectiveCeiling * 0.75)));

  const targetSceneCount = isFixed
    ? Math.max(1, Math.round(input.totalDurationTargetSec / input.fixedSceneDurationSec!))
    : Math.max(minScenesRequired, Math.round(input.totalDurationTargetSec / targetAvgSceneDuration));

  const narrativeDoctrine = buildNarrativeVoiceInstruction(null, input.language);
  const groundingContext = input.contextPackage ? JSON.stringify(input.contextPackage, null, 2) : 'No grounding context available.';
  const baseInstruction = isIndo
    ? isFixed
      ? `Anda adalah Master 1st Assistant Director (1st AD) & Cinematic Timeline Allocator kelas dunia.
Tugas Anda: Memecah cerita 5-Beat Narrative Structure menjadi urutan tepat ${targetSceneCount} Scene Breakdown sinematik.

ATURAN SISTEM FIXED SCENE DURATION (MUTLAK):
1. Sistem telah menetapkan durasi tetap (Fixed Scene Duration) sebesar ${input.fixedSceneDurationSec} detik per scene.
2. Setiap scene WAJIB menggunakan durasi tepat ${input.fixedSceneDurationSec} detik. JANGAN mengubah durasi scene.
3. Total target durasi: ${input.totalDurationTargetSec} detik (${targetSceneCount} scene x ${input.fixedSceneDurationSec}s).
4. Fokuskan seluruh kreativitas Anda pada: konten adegan, dramatic beat, tujuan naratif, aksi dramatis, lokasi, karakter, dan fungsi naratif.
5. scene_number harus berurutan 1, 2, 3, dst.`
      : `Anda adalah Master 1st Assistant Director (1st AD) & Cinematic Timeline Allocator kelas dunia.
Tugas Anda: Memecah cerita dari 5-Beat Narrative Structure menjadi urutan ${targetSceneCount} adegan sinematik (Scene Breakdown) yang presisi dengan alokasi durasi detik.

ATURAN ALOKASI DURASI & STRUKTUR NARATIF (MUTLAK):
1. TARGET TOTAL DURASI NARATIF PROYEK: TEPAT ${input.totalDurationTargetSec} DETIK. Jumlah durasi seluruh scene (sum of duration_sec) WAJIB TEPAT SAMA DENGAN ${input.totalDurationTargetSec} DETIK (toleransi 0 detik).
2. DISTINKSI CONTAINER VS DURASI NARATIF: Batas container platform (misal 30s) adalah batasan teknis klip per adegan, BUKAN total durasi film. Film ini berdurasi ${input.totalDurationTargetSec} detik dan membutuhkan urutan adegan yang lengkap (${targetSceneCount} scene, minimal ${minScenesRequired} scene).
3. BATAS DURASI PER SCENE: Setiap scene harus berdurasi antara 5 detik sampai maksimal ${effectiveCeiling} detik (<= ${effectiveCeiling}s per scene).
4. ALOKASI BOBOT DRAMATIS: Alokasikan durasi berdasarkan BOBOT NARATIF (Climax, Pivotal Choices, dan Emotional Highs WAJIB mendapatkan alokasi durasi lebih panjang dan dramatis dibanding scene transisi/eksposisi pendek). JANGAN membagi durasi secara rata.
5. scene_number harus berurutan 1, 2, 3, dst.`
    : isFixed
    ? `You are a world-class 1st Assistant Director (1st AD) & Cinematic Timeline Allocator.
Your task: Deconstruct the 5-Beat Narrative Structure into an exact sequence of ${targetSceneCount} cinematic Scenes.

FIXED SCENE DURATION SYSTEM CONSTRAINT (NON-NEGOTIABLE):
1. The system has assigned a fixed duration of ${input.fixedSceneDurationSec} seconds. Every scene MUST use exactly ${input.fixedSceneDurationSec} seconds. Do not change scene duration.
2. Target total duration: ${input.totalDurationTargetSec} seconds (${targetSceneCount} scenes x ${input.fixedSceneDurationSec}s).
3. Focus entirely on scene content, dramatic beat, narrative purpose, visual action, location, cast, and narrative function.
4. scene_number must be sequential 1, 2, 3...`
    : `You are a world-class 1st Assistant Director (1st AD) & Cinematic Timeline Allocator.
Your task: Deconstruct the 5-Beat Narrative Structure into a sequenced cinematic Scene Breakdown of ${targetSceneCount} scenes with exact second allocations.

STRICT NARRATIVE DURATION & STRUCTURE RULES:
1. TOTAL PROJECT NARRATIVE DURATION: EXACTLY ${input.totalDurationTargetSec} SECONDS. The sum of duration_sec across all scenes MUST EXACTLY EQUAL ${input.totalDurationTargetSec} SECONDS (0s tolerance).
2. CONTAINER VS NARRATIVE DISTINCTION: A platform generation container limit (e.g. 30s) is a technical clip constraint per scene, NOT the project duration. The project narrative spans ${input.totalDurationTargetSec} seconds across ${targetSceneCount} scenes (minimum ${minScenesRequired} scenes).
3. SCENE DURATION BOUNDS: Every scene duration must be between 5s and a maximum ceiling of ${effectiveCeiling}s (Max <= ${effectiveCeiling}s per scene).
4. ALLOCATE BY NARRATIVE WEIGHT: Climax, critical decisions, and heavy emotional beats MUST receive larger time allocations than quick expository or transition scenes. Do NOT distribute evenly.
5. scene_number must be sequential 1, 2, 3...`;

  const canonicalEventInstruction = isIndo
    ? `\n\nKONTRAK FIELD KANONIK (MUTLAK): SETIAP scene WAJIB memiliki field JSON canonical "event". Nilainya WAJIB berupa deskripsi bermakna dan tidak kosong tentang aksi atau peristiwa dramatis yang terjadi dalam scene tersebut. Field "dramatic_action", "narrative_goal", "narrative_beat", atau field serupa TIDAK BOLEH menggantikan "event". Jangan gunakan nilai placeholder seperti "-", "N/A", atau "none".`
    : `\n\nCANONICAL FIELD CONTRACT (NON-NEGOTIABLE): EVERY scene MUST contain the canonical JSON field "event". Its value MUST be a non-empty, meaningful description of the dramatic action or event occurring in that scene. "dramatic_action", "narrative_goal", "narrative_beat", or similar fields MUST NOT replace "event". Do not use placeholder values such as "-", "N/A", or "none".`;
  const canonicalStoryPurposeInstruction = isIndo
    ? `\n\nKONTRAK FIELD KANONIK (MUTLAK): SETIAP scene WAJIB memiliki field JSON canonical "story_purpose". Nilainya WAJIB berupa tujuan naratif yang bermakna, tidak kosong, dan spesifik untuk scene tersebut. Field "narrative_goal", "dramatic_action", "event", atau field lain TIDAK BOLEH menggantikan "story_purpose". Jangan gunakan nilai kosong, whitespace, atau placeholder.`
    : `\n\nCANONICAL FIELD CONTRACT (NON-NEGOTIABLE): EVERY scene MUST contain the canonical JSON field "story_purpose". Its value MUST be a meaningful, non-empty narrative purpose specific to that scene. "narrative_goal", "dramatic_action", "event", or other fields MUST NOT replace "story_purpose". Do not use empty, whitespace, or placeholder values.`;
  const systemInstruction = `${baseInstruction}${canonicalEventInstruction}${canonicalStoryPurposeInstruction}\n\n${narrativeDoctrine}\n\nGROUNDING CONTEXT:\n${groundingContext}`;

  // Canonical asset roster contract (S2/S3 -> S5 -> S6). The S6 asset integrity
  // gate resolves scene.character_names / scene.location_name against the
  // Character & Location Bible by name, so a paraphrased name blocks the scene.
  const characterRoster = input.characterRoster?.filter((name) => Boolean(name && name.trim())) || [];
  const locationRoster = input.locationRoster?.filter((name) => Boolean(name && name.trim())) || [];
  const rosterInstruction = (characterRoster.length > 0 || locationRoster.length > 0)
    ? (isIndo
      ? `\n\n=== ASSET KANONIK (WAJIB DIPAKAI PERSIS) ===
KARAKTER: ${characterRoster.join(' | ') || '(tidak ada)'}
LOKASI: ${locationRoster.join(' | ') || '(tidak ada)'}
ATURAN MUTLAK:
1. Field character_names WAJIB berisi HANYA nama dari daftar KARAKTER di atas, ditulis PERSIS sama (huruf per huruf).
2. Field location_name WAJIB berisi PERSIS satu nama dari daftar LOKASI di atas.
3. JANGAN membuat karakter/lokasi baru, jangan menyingkat, jangan menambah/menghapus gelar, jangan menerjemahkan.`
      : `\n\n=== CANONICAL ASSETS (MUST BE USED VERBATIM) ===
CHARACTERS: ${characterRoster.join(' | ') || '(none)'}
LOCATIONS: ${locationRoster.join(' | ') || '(none)'}
NON-NEGOTIABLE RULES:
1. character_names MUST contain ONLY names from the CHARACTERS list above, spelled EXACTLY.
2. location_name MUST be EXACTLY one entry from the LOCATIONS list above.
3. Do NOT invent new characters/locations, abbreviate, add or drop titles, or translate them.`)
    : '';

  let prompt = isFixed
    ? `Pecah narasi berikut menjadi tepat ${targetSceneCount} Scene dengan durasi tetap ${input.fixedSceneDurationSec} detik per scene (Total: ${input.totalDurationTargetSec} detik):

=== 5-BEAT NARRATIVE STRUCTURE ===
Beginning: ${input.narrativeBeats.beginning}
Development: ${input.narrativeBeats.development}
Climax: ${input.narrativeBeats.climax}
Consequence: ${input.narrativeBeats.consequence}
Ending: ${input.narrativeBeats.ending}

=== PRODUCTION CONSTRAINTS ===
Target Total Duration: ${input.totalDurationTargetSec} detik (EXACT)
Fixed Scene Duration: ${input.fixedSceneDurationSec} detik per scene (System Assigned)`
    : `Pecah narasi berikut menjadi urutan ${targetSceneCount} Scene (minimal ${minScenesRequired} scene) dengan total durasi TEPAT ${input.totalDurationTargetSec} detik dan durasi per scene antara 5 hingga ${effectiveCeiling} detik:

=== 5-BEAT NARRATIVE STRUCTURE ===
Beginning: ${input.narrativeBeats.beginning}
Development: ${input.narrativeBeats.development}
Climax: ${input.narrativeBeats.climax}
Consequence: ${input.narrativeBeats.consequence}
Ending: ${input.narrativeBeats.ending}

=== PRODUCTION CONSTRAINTS ===
Target Total Narrative Duration: ${input.totalDurationTargetSec} detik (EXACT total across all scenes)
Recommended Scene Count: ${targetSceneCount} scenes (minimum ${minScenesRequired} scenes)
Max Scene Duration Ceiling: ${effectiveCeiling} detik per scene
Distinction: Batas container rendering bukan total film. Semua adegan jika dijumlahkan harus mencapai tepat ${input.totalDurationTargetSec}s.`;

  prompt += rosterInstruction;

  if (input.feedbackPrompt) {
    prompt += isIndo
      ? `\n\n=== REVISI PENTING DARI VALIDASI SEBELUMNYA ===
${input.feedbackPrompt}
KONTRAK FIELD CANONICAL WAJIB DIPERBAIKI:
- SETIAP scene WAJIB memiliki field JSON canonical "event".
- "event" WAJIB berisi deskripsi aksi/peristiwa dramatis yang bermakna dan tidak kosong.
- "dramatic_action", "narrative_goal", dan "narrative_beat" TIDAK BOLEH menggantikan field "event".
- Jangan gunakan "-", "N/A", atau "none" sebagai nilai "event".
- SETIAP scene WAJIB memiliki "story_purpose" bermakna, tidak kosong, dan spesifik untuk scene tersebut.
- "narrative_goal", "dramatic_action", atau "event" TIDAK BOLEH menggantikan "story_purpose".
PANDUAN PERBAIKAN STRUKTUR & DURASI:
- Buat urutan ${targetSceneCount} adegan (minimal ${minScenesRequired} adegan).
- Pastikan setiap adegan berdurasi antara 5 detik sampai maksimal ${effectiveCeiling} detik.
- Total durasi dari seluruh adegan HARUS TEPAT ${input.totalDurationTargetSec} detik (toleransi 0 detik).
- JANGAN menggunakan batas container rendering (30s) sebagai batas total durasi film. Proyek ini berdurasi ${input.totalDurationTargetSec} detik!`
      : `\n\n=== CRITICAL REVISION FROM PREVIOUS VALIDATION ===
${input.feedbackPrompt}
MANDATORY CANONICAL FIELD REPAIR:
- EVERY scene MUST contain the canonical JSON field "event".
- "event" MUST contain a non-empty, meaningful description of the dramatic action or event.
- "dramatic_action", "narrative_goal", and "narrative_beat" MUST NOT replace "event".
- Do not use "-", "N/A", or "none" as the "event" value.
- EVERY scene MUST contain a meaningful, non-empty, scene-specific "story_purpose".
- "narrative_goal", "dramatic_action", or "event" MUST NOT replace "story_purpose".
CORRECTIVE STRUCTURAL & DURATION GUIDELINES:
- Generate a sequence of ${targetSceneCount} scenes (minimum ${minScenesRequired} scenes).
- Ensure each scene duration is between 5s and maximum ${effectiveCeiling}s.
- Total duration across all scenes MUST EQUAL EXACTLY ${input.totalDurationTargetSec} seconds (0s tolerance).
- Do NOT use single clip generation limits (e.g. 30s) as total narrative duration. This project requires ${input.totalDurationTargetSec}s!`;
  }

  const responseSchema = {
    type: Type.ARRAY,
    description: 'Array of scenes forming the complete film breakdown',
    items: {
      type: Type.OBJECT,
      properties: {
        scene_number: { type: Type.INTEGER, description: 'Sequential scene number (1, 2, 3...)' },
        title: { type: Type.STRING, description: 'Descriptive scene title (e.g., INT. ABANDONED LAB - THE AWAKENING)' },
        duration_sec: {
          type: Type.INTEGER,
          description: `Exact allocated scene duration in seconds (must be integer between 5 and ${effectiveCeiling}, and all scenes sum to ${input.totalDurationTargetSec})`,
        },
        story_purpose: { type: Type.STRING, description: 'Core narrative purpose of this specific scene' },
        location_name: {
          type: Type.STRING,
          description: locationRoster.length > 0
            ? `Associated set or location name. MUST be exactly one of: ${locationRoster.join(' | ')}`
            : 'Associated set or location name',
        },
        time_of_day: { type: Type.STRING, description: 'DAWN, DAY, DUSK, NIGHT, MIDNIGHT' },
        character_names: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: characterRoster.length > 0
            ? `Characters present in this scene. Each entry MUST be exactly one of: ${characterRoster.join(' | ')}`
            : 'Characters present in this scene',
        },
        emotional_objective: { type: Type.STRING, description: 'The emotional target beat felt by character and audience' },
        event: { type: Type.STRING, description: 'Key dramatic action or event taking place' },
        narrative_function: {
          type: Type.STRING,
          description: 'Narrative function (e.g., Inciting Incident, Escalation, Climax Beat 1, Resolution)',
        },
      },
      required: [
        'scene_number',
        'title',
        'duration_sec',
        'story_purpose',
        'location_name',
        'time_of_day',
        'character_names',
        'emotional_objective',
        'event',
        'narrative_function',
      ],
    },
  };

  const response = await executeTask({
    taskId: 'scene_breakdown',
    stageCode: 'S5',
    prompt,
    systemInstruction,
    temperature: 0.2,
    responseSchema,
    reasoningConfig: input.reasoningConfig,
    projectPolicy: {
      mode: input.model ? 'pin' : 'auto',
      quality: 'high',
      priority: 'quality',
      pinnedModelId: input.model,
      pinnedProviderId: input.reasoningConfig?.provider_name || input.reasoningConfig?.provider_type,
    },
  });

  if (!response.text) {
    throw new Error('Stage 5 failed: LLM provider returned an empty response.');
  }

  const parsedJson = safeParseJSON(response.text);
  let parsed: DetectedScene[] = Array.isArray(parsedJson)
    ? parsedJson
    : (parsedJson?.scenes && Array.isArray(parsedJson.scenes) ? parsedJson.scenes : []);

  // Graceful fallback if model produced an empty array
  if (parsed.length === 0) {
    const beats = input.narrativeBeats || {
      beginning: 'Beginning of the narrative arc',
      development: 'Rising tension and conflicts',
      climax: 'Peak confrontation and revelation',
      consequence: 'Immediate aftermath and choices',
      ending: 'Resolution and final closure',
    };
    const defaultLocation = locationRoster[0] || 'Main Set';
    const defaultChars = characterRoster.length > 0 ? [characterRoster[0]] : [];
    parsed = [
      {
        scene_number: 1,
        title: isIndo ? 'Adegan 1 - Titik Awal' : 'Scene 1 - The Opening',
        story_purpose: beats.beginning,
        location_name: defaultLocation,
        time_of_day: 'DAY',
        character_names: defaultChars,
        emotional_objective: 'Establish stakes and world',
        event: beats.beginning,
        narrative_function: 'EXPOSITION',
        duration_sec: Math.min(effectiveCeiling, 15),
      },
      {
        scene_number: 2,
        title: isIndo ? 'Adegan 2 - Eskalasi Konflik' : 'Scene 2 - Rising Action',
        story_purpose: beats.development,
        location_name: defaultLocation,
        time_of_day: 'DAY',
        character_names: defaultChars,
        emotional_objective: 'Escalate core drama',
        event: beats.development,
        narrative_function: 'DEVELOPMENT',
        duration_sec: Math.min(effectiveCeiling, 20),
      },
      {
        scene_number: 3,
        title: isIndo ? 'Adegan 3 - Puncak Klimaks' : 'Scene 3 - The Climax',
        story_purpose: beats.climax,
        location_name: defaultLocation,
        time_of_day: 'DUSK',
        character_names: defaultChars,
        emotional_objective: 'Peak emotional impact',
        event: beats.climax,
        narrative_function: 'CLIMAX',
        duration_sec: Math.min(effectiveCeiling, 25),
      },
      {
        scene_number: 4,
        title: isIndo ? 'Adegan 4 - Dampak & Pilihan' : 'Scene 4 - Repercussions',
        story_purpose: beats.consequence,
        location_name: defaultLocation,
        time_of_day: 'NIGHT',
        character_names: defaultChars,
        emotional_objective: 'Process crucial decisions',
        event: beats.consequence,
        narrative_function: 'CONSEQUENCE',
        duration_sec: Math.min(effectiveCeiling, 20),
      },
      {
        scene_number: 5,
        title: isIndo ? 'Adegan 5 - Resolusi Akhir' : 'Scene 5 - Final Resolution',
        story_purpose: beats.ending,
        location_name: defaultLocation,
        time_of_day: 'DAWN',
        character_names: defaultChars,
        emotional_objective: 'Deliver enduring resonance',
        event: beats.ending,
        narrative_function: 'RESOLUTION',
        duration_sec: Math.min(effectiveCeiling, 15),
      },
    ];
  }

  // System Assignment of Scene Durations & Recommended Scene Tone
  const sanitizedScenes: DetectedScene[] = parsed.map((sc, idx) => {
    let assignedDuration = Number(sc.duration_sec) || (isFixed ? input.fixedSceneDurationSec! : 10);
    if (isFixed && input.fixedSceneDurationSec) {
      assignedDuration = input.fixedSceneDurationSec;
    }
    const recommendedTone = sc.scene_tone || recommendSceneTone(sc);
    return {
      ...sc,
      scene_number: idx + 1,
      duration_sec: assignedDuration,
      scene_tone: recommendedTone,
    };
  });

  // Snap paraphrased asset references back to canonical Bible names so the S6
  // asset integrity gate can resolve them. Unresolvable references are left
  // as-is and reported by validateSceneAssetNames() for the S5 retry loop.
  const canonicalizedScenes = canonicalizeSceneAssetNames(sanitizedScenes, characterRoster, locationRoster);

  // DETERMINISTIC NARRATIVE DURATION ALLOCATION & NORMALIZATION
  // Guarantees sum(scene.duration_sec) === input.totalDurationTargetSec with 0s variance,
  // bounds each scene within [5s, effectiveCeiling], and preserves narrative dynamic weighting.
  const normalizedScenes = allocateAndNormalizeSceneDurations(
    canonicalizedScenes,
    input.totalDurationTargetSec,
    input.maxSceneDurationSec,
    input.fixedSceneDurationSec,
    input.allowFinalSceneOverride,
    input.language
  );

  return normalizedScenes;
}

export interface SemanticValidationResult {
  valid: boolean;
  errorMessage?: string;
  correctivePrompt?: string;
}

export function validateSceneSemanticPayload(
  scenes: DetectedScene[],
  language: 'id' | 'en' = 'id'
): SemanticValidationResult {
  const isIndo = language === 'id';
  if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
    return { 
      valid: false, 
      errorMessage: isIndo ? 'Daftar scene kosong' : 'Scene list is empty',
      correctivePrompt: 'Scene list is empty. Generate a complete sequence of cinematic scenes.'
    };
  }

  for (const scene of scenes) {
    // 1. Check for continuation markers in title: (Continuation), (Part X), (Bagian X), (Lanjutan)
    if (scene.title && (/\(continuation\)/i.test(scene.title) || /\(part\s*\d+\)/i.test(scene.title) || /\(bagian\s*\d+\)/i.test(scene.title) || /\(lanjutan\)/i.test(scene.title))) {
      return {
        valid: false,
        errorMessage: isIndo
          ? `Scene #${scene.scene_number} memiliki judul tidak valid yang mengandung penanda continuation: "${scene.title}"`
          : `Scene #${scene.scene_number} has invalid title containing continuation marker: "${scene.title}"`,
        correctivePrompt: `Scene #${scene.scene_number} ("${scene.title}") uses a forbidden continuation marker like (Continuation) or (Part). Give every scene a distinct, unique narrative title without continuation tags.`
      };
    }

    // 2. Check for empty, missing, dash, or placeholder event
    const trimmedEvent = typeof scene.event === 'string' ? scene.event.trim() : '';
    if (!trimmedEvent || trimmedEvent === '-' || trimmedEvent === '--' || trimmedEvent === '---' || trimmedEvent.toLowerCase() === 'n/a' || trimmedEvent.toLowerCase() === 'none') {
      return {
        valid: false,
        errorMessage: isIndo
          ? `Scene #${scene.scene_number} memiliki field 'event' kosong atau dash.`
          : `Scene #${scene.scene_number} has empty or dash 'event' field.`,
        correctivePrompt: `Scene #${scene.scene_number} has an empty, dash, or placeholder event. Provide a descriptive, meaningful dramatic action and event taking place for this scene.`
      };
    }

    // 3. Check for empty or missing story_purpose
    if (!scene.story_purpose || typeof scene.story_purpose !== 'string' || scene.story_purpose.trim() === '') {
      return {
        valid: false,
        errorMessage: isIndo
          ? `Scene #${scene.scene_number} memiliki 'story_purpose' kosong.`
          : `Scene #${scene.scene_number} has empty 'story_purpose'.`,
        correctivePrompt: `Scene #${scene.scene_number} has empty story_purpose. Provide the narrative purpose for this scene.`
      };
    }

    // 4. Check for empty character_names
    if (!scene.character_names || !Array.isArray(scene.character_names)) {
      return {
        valid: false,
        errorMessage: isIndo
          ? `Scene #${scene.scene_number} memiliki 'character_names' bukan array.`
          : `Scene #${scene.scene_number} has non-array 'character_names'.`,
        correctivePrompt: `Scene #${scene.scene_number} has invalid character_names. Provide an array of character names.`
      };
    }
  }

  return { valid: true };
}

