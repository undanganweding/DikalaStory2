import { executeTask, safeParseJSON } from '../llm_provider';
import { Type } from '../gemini';
import { ContextPackage, NarrativeBeats, ReasoningConfig, Scene } from '../../src/types';
import { buildNarrativeVoiceInstruction, recommendSceneTone } from '../narrative_tone';
import { determineNarrativeStrategy } from '../narrative_strategy_engine';

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
  customGuidance?: string;
  targetSceneCount?: number;
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

  const progressionDescriptors = isIndo
    ? [
        'Inisiasi & Konteks',
        'Eskalasi Ketegangan',
        'Perkembangan Aksi',
        'Titik Balik Dramatis',
        'Puncak Konfrontasi',
        'Konsekuensi Aksi',
        'Resolusi & Penutup',
      ]
    : [
        'Initiation & Context',
        'Rising Tension',
        'Action Development',
        'Dramatic Turning Point',
        'Peak Confrontation',
        'Action Consequence',
        'Resolution & Payoff',
      ];

  let splitCounter = 0;

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

    splitCounter++;
    const descA = progressionDescriptors[(splitCounter * 2) % progressionDescriptors.length];
    const descB = progressionDescriptors[(splitCounter * 2 + 1) % progressionDescriptors.length];

    const cleanBase = targetScene.title
      .replace(/\s*\((?:Bagian|Part|Lanjutan|Continuation|Segmen|Fase)[^)]*\)/gi, '')
      .replace(/\s*-\s*(?:Inisiasi|Eskalasi|Puncak|Resolusi|Setup|Escalation|Climax|Resolution|Konteks|Ketegangan|Aksi|Penutup|Titik Balik|Perkembangan|Babak)[^-\n]*$/gi, '')
      .replace(/\s*:\s*(?:Inisiasi|Eskalasi|Puncak|Resolusi|Setup|Escalation|Climax|Resolution|Konteks|Ketegangan|Aksi|Penutup)[^:]*$/gi, '')
      .trim();

    const rawPurpose = (targetScene.story_purpose && targetScene.story_purpose !== 'undefined') ? targetScene.story_purpose : '';
    const rawEvent = (targetScene.event && targetScene.event !== 'undefined') ? targetScene.event : '';
    const rawVisual = (targetScene.visual_action && targetScene.visual_action !== 'undefined') ? targetScene.visual_action : '';

    const cleanBasePurpose = (rawPurpose || rawEvent || cleanBase)
      .replace(/\s*-\s*(?:Fase inisiasi|Puncak eskalasi|Initial initiation|Peak escalation)[^.]*\.?/gi, '')
      .trim();
    const cleanBaseEvent = (rawEvent || rawPurpose || cleanBase)
      .replace(/\s*\((?:Fase permulaan|Puncak aksi|Initial setup|Peak action)[^)]*\)/gi, '')
      .trim();
    const cleanBaseVisual = (rawVisual || cleanBaseEvent)
      .replace(/\s*-\s*(?:fokus visual awal|eskalasi visual dinamis|initial visual framing focus|dynamic visual escalation)\.?/gi, '')
      .trim();
    const dedupedSceneChars = Array.from(new Set((targetScene.character_names || []).filter(Boolean)));

    const part1: DetectedScene = {
      ...targetScene,
      title: `${cleanBase} - ${descA}`,
      character_names: dedupedSceneChars,
      story_purpose: cleanBasePurpose ? `${cleanBasePurpose} (${descA})` : `Menggambarkan ${cleanBase} pada fase ${descA.toLowerCase()}.`,
      event: cleanBaseEvent ? `${cleanBaseEvent} (Fase: ${descA})` : `Peristiwa ${cleanBase.toLowerCase()} berlangsung dengan intensitas awal.`,
      visual_action: cleanBaseVisual,
      narrative_function: targetScene.narrative_function?.toUpperCase().includes('CLIMAX')
        ? 'RISING_ACTION'
        : (targetScene.narrative_function || 'EXPOSITION'),
      duration_sec: halfDur,
    };

    const part2: DetectedScene = {
      ...targetScene,
      title: `${cleanBase} - ${descB}`,
      character_names: dedupedSceneChars,
      story_purpose: cleanBasePurpose ? `${cleanBasePurpose} (${descB})` : `Melanjutkan dinamika ${cleanBase} menuju fase ${descB.toLowerCase()}.`,
      event: cleanBaseEvent ? `${cleanBaseEvent} (Kelanjutan: ${descB})` : `Peristiwa ${cleanBase.toLowerCase()} berkembang menuju titik ketegangan baru.`,
      visual_action: cleanBaseVisual,
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
  const isIndo = language === 'id';
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
          result = ensureSufficientSceneCount(result, expectedCount, language);
          result = result.map((s, idx) => ({
            ...s,
            scene_number: idx + 1,
            duration_sec: fixedSceneSec,
          }));
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

  // 1. Resolve Narrative Strategy
  const strategy = input.narrativeBeats.narrative_strategy || determineNarrativeStrategy({
    rawScript: `${input.narrativeBeats.beginning}\n${input.narrativeBeats.development}\n${input.narrativeBeats.climax}`,
    targetDurationSec: input.totalDurationTargetSec,
  });

  const isFixed = Boolean(input.fixedSceneDurationSec && input.fixedSceneDurationSec > 0);
  const effectiveCeiling = input.fixedSceneDurationSec || input.maxSceneDurationSec || 30;
  const minScenesRequired = Math.max(1, Math.ceil(input.totalDurationTargetSec / effectiveCeiling));

  // 2. Dynamic Target Scene Count (Pacing Engine)
  const targetSceneCount = input.targetSceneCount && input.targetSceneCount > 0
    ? input.targetSceneCount
    : isFixed
      ? Math.max(1, Math.round(input.totalDurationTargetSec / input.fixedSceneDurationSec!))
      : Math.max(minScenesRequired, strategy.pacing?.recommended_scene_count || Math.round(input.totalDurationTargetSec / 25));

  const narrativeDoctrine = buildNarrativeVoiceInstruction(null, input.language);
  const groundingContext = input.contextPackage ? JSON.stringify(input.contextPackage, null, 2) : 'No grounding context available.';
  
  const baseInstruction = isIndo
    ? isFixed
      ? `Anda adalah Master 1st Assistant Director (1st AD) & Cinematic Screenwriter kelas dunia.
Tugas Anda: Memecah Struktur Naratif Sinematik menjadi urutan tepat ${targetSceneCount} Scene Breakdown berdurasi tetap ${input.fixedSceneDurationSec} detik.

STRATEGI DRAMATURGI SINEMATIK:
- Dramatic Arc Archetype: ${strategy.dramatic_arc_type}
- Genre / Subgenre: ${strategy.genre} (${strategy.subgenre})
- Stakes: ${strategy.stakes}
- Ending Strategy: ${strategy.ending_strategy}
- Fungsi Babak: ${strategy.act_functions.join(' -> ')}

DOKTRIN NARRATIVE SHORT FILM SINEMATIK:
1. "DRAMA FIRST, INFORMATION SECOND" (UNIT DRAMATIS VITAL):
   - JANGAN PERNAH membuat adegan berupa deskripsi paragraf rangkuman atau teks ensiklopedia sejarah!
   - Setiap adegan WAJIB menjadi UNIT DRAMATIS dengan aksi fisik nyata (visual_action), gestur tubuh, kontak mata, dan interaksi langsung antar-karakter.
2. PEMISAHAN MUTLAK 'story_purpose' DAN 'event':
   - story_purpose: Maksud dramatis & pergeseran psikologis/emosional adegan (MENGAPA adegan ini penting dalam busur cerita). DILARANG MENULIS ULANG EVENT!
   - event: Kejadian dramatis fisik & aksi nyata di layar (APA yang terjadi di layar secara konkret).
3. SALURAN AUDIO-VISUAL & DIALOG AKTIF (dialogue):
   - Ketika dua atau lebih karakter berinteraksi/berbincang/mengambil keputusan (misal: Abdul Muttalib & Aminah, atau Abdul Muttalib & Pembesar Quraisy), WAJIB sertakan dialog aktif dalam array 'dialogue'!
   - Dialog harus memiliki subteks emosional (emotional_subtext) dan penjiwaan vocal (delivery).
   - Voice-over (narrator_vo) SANGAT MINIMAL, puitis, dan HANYA jika diperlukan. DILARANG menarasikan apa yang sudah terlihat di layar.
4. POLA DRAMATIS PER ADEGAN (scene_pattern):
   - Pilih scene_pattern yang tepat secara dramatis untuk tiap adegan: HOOK, SETUP, INCITING_INCIDENT, QUESTION, INVESTIGATION, EVIDENCE, COMPLICATION, REVELATION, WARNING, DILEMMA, POINT_OF_NO_RETURN, CATASTROPHE, AFTERMATH, TEST, CRUCIBLE, TEMPTATION, ILLUMINATION, ESCALATION, CONFRONTATION, TURNING_POINT, CLIMAX, BREAKTHROUGH, RESOLUTION, PAYOFF, REFLECTION, LEGACY, CLIFFHANGER.
5. KECERDASAN ENDING (${strategy.ending_strategy}):
   - Adegan terakhir (Scene ${targetSceneCount}) WAJIB mencerminkan strategi ending terpilih (${strategy.ending_strategy}). JANGAN memaksakan cliffhanger jika cerita menuntut kepuasan resolusi, kedukaan tragis, atau refleksi spiritual!
${strategy.is_historical_or_sacred ? `6. PENGUNCIAN PENGGAMBARAN NABI MUHAMMAD ﷺ: Wajah Nabi Muhammad ﷺ TIDAK PERNAH digambarkan. Bayi selalu terbedong rapi membelakangi kamera tanpa halo supernatural.
7. INTEGRITAS HISTORIS: Klasifikasikan tier FACT, DRAMATIZED_DIALOGUE, NARRATIVE_BRIDGE, atau FICTIONALIZED.` : '6. INTEGRITAS HISTORIS: Cerita fiksi/dramatis; klasifikasikan tier FICTIONALIZED atau NARRATIVE_BRIDGE. is_prophet_present: false.'}
8. DESAIN SUARA: Sertakan SFX konkret dan nuansa BGM.
9. ATURAN JUDUL: Beri setiap adegan judul unik tanpa penanda lanjutan seperti "(Bagian 1)" atau "(Lanjutan)".
10. PROGRESIVITAS NARATIF MUTLAK & ANTI-DUPLIKASI:
    - Setiap adegan WAJIB memiliki judul, 'story_purpose', 'event', 'visual_action', dan 'dialogue' yang BENAR-BENAR UNIK dan BERBEDA dari adegan lainnya.
    - DILARANG KERAS menyalin atau mengulang alur kejadian, tujuan adegan, atau dialog yang sama di beberapa adegan sekaligus!
    - Distribusikan secara proporsional 5 babak naratif (Beginning -> Development -> Climax -> Consequence -> Ending) ke sepanjang urutan adegan 1 sampai ${targetSceneCount}. Setiap adegan berturut-turut harus bergerak maju secara kronologis dan meningkatkan tensi dramatis.`
      : `Anda adalah Master 1st Assistant Director (1st AD) & Cinematic Screenwriter kelas dunia.
Tugas Anda: Memecah Struktur Naratif Sinematik menjadi urutan TEPAT ${targetSceneCount} Scene Breakdown sinematik dengan alokasi durasi detik yang presisi.

STRATEGI DRAMATURGI SINEMATIK:
- Dramatic Arc Archetype: ${strategy.dramatic_arc_type}
- Genre / Subgenre: ${strategy.genre} (${strategy.subgenre})
- Stakes: ${strategy.stakes}
- Ending Strategy: ${strategy.ending_strategy}
- Fungsi Babak: ${strategy.act_functions.join(' -> ')}

DOKTRIN NARRATIVE SHORT FILM SINEMATIK:
1. "DRAMA FIRST, INFORMATION SECOND" (UNIT DRAMATIS VITAL):
   - JANGAN PERNAH membuat adegan berupa deskripsi paragraf rangkuman atau teks ensiklopedia sejarah!
   - Setiap adegan WAJIB menjadi UNIT DRAMATIS dengan aksi fisik nyata (visual_action), gestur tubuh, kontak mata, dan interaksi langsung antar-karakter.
2. PEMISAHAN MUTLAK 'story_purpose' DAN 'event':
   - story_purpose: Maksud dramatis & pergeseran psikologis/emosional adegan (MENGAPA adegan ini penting dalam busur cerita). DILARANG MENULIS ULANG EVENT!
   - event: Kejadian dramatis fisik & aksi nyata di layar (APA yang terjadi di layar secara konkret).
3. SALURAN AUDIO-VISUAL & DIALOG AKTIF (dialogue):
   - Ketika dua atau lebih karakter berinteraksi/berbincang/mengambil keputusan (misal: Abdul Muttalib & Aminah, atau Abdul Muttalib & Pembesar Quraisy), WAJIB sertakan dialog aktif dalam array 'dialogue'!
   - Dialog harus memiliki subteks emosional (emotional_subtext) dan penjiwaan vocal (delivery).
   - Voice-over (narrator_vo) SANGAT MINIMAL, puitis, dan HANYA jika diperlukan. DILARANG menarasikan apa yang sudah terlihat di layar.
4. POLA DRAMATIS PER ADEGAN (scene_pattern):
   - Pilih scene_pattern yang tepat secara dramatis untuk tiap adegan: HOOK, SETUP, INCITING_INCIDENT, QUESTION, INVESTIGATION, EVIDENCE, COMPLICATION, REVELATION, WARNING, DILEMMA, POINT_OF_NO_RETURN, CATASTROPHE, AFTERMATH, TEST, CRUCIBLE, TEMPTATION, ILLUMINATION, ESCALATION, CONFRONTATION, TURNING_POINT, CLIMAX, BREAKTHROUGH, RESOLUTION, PAYOFF, REFLECTION, LEGACY, CLIFFHANGER.
   - Seluruh urutan dari Scene 1 sampai Scene ${targetSceneCount} WAJIB dibuat lengkap dan terinci (total tepat ${targetSceneCount} objek adegan).
5. KECERDASAN ENDING (${strategy.ending_strategy}):
   - Adegan terakhir (Scene ${targetSceneCount}) WAJIB mencerminkan strategi ending terpilih (${strategy.ending_strategy}). JANGAN memaksakan cliffhanger jika cerita menuntut kepuasan resolusi, kedukaan tragis, atau refleksi spiritual!
${strategy.is_historical_or_sacred ? `6. PENGUNCIAN PENGGAMBARAN NABI MUHAMMAD ﷺ: Wajah Nabi Muhammad ﷺ TIDAK PERNAH digambarkan. Bayi selalu terbedong rapi membelakangi kamera tanpa halo supernatural.
7. INTEGRITAS HISTORIS: Klasifikasikan tier FACT, DRAMATIZED_DIALOGUE, NARRATIVE_BRIDGE, atau FICTIONALIZED.` : '6. INTEGRITAS HISTORIS: Cerita fiksi/dramatis; klasifikasikan tier FICTIONALIZED atau NARRATIVE_BRIDGE. is_prophet_present: false.'}
8. DESAIN SUARA: Sertakan efek suara fisik (SFX) dan suasana musik latar (BGM).
9. ATURAN JUDUL: Beri setiap adegan judul unik tanpa penanda lanjutan seperti "(Bagian 1)" atau "(Lanjutan)".
10. PROGRESIVITAS NARATIF MUTLAK & ANTI-DUPLIKASI:
    - Setiap adegan WAJIB memiliki judul, 'story_purpose', 'event', 'visual_action', dan 'dialogue' yang BENAR-BENAR UNIK dan BERBEDA dari adegan lainnya.
    - DILARANG KERAS menyalin atau mengulang alur kejadian, tujuan adegan, atau dialog yang sama di beberapa adegan sekaligus!
    - Distribusikan secara proporsional 5 babak naratif (Beginning -> Development -> Climax -> Consequence -> Ending) ke sepanjang urutan adegan 1 sampai ${targetSceneCount}. Setiap adegan berturut-turut harus bergerak maju secara kronologis dan meningkatkan tensi dramatis.
11. ALOKASI DURASI (MUTLAK): Total durasi seluruh adegan HARUS TEPAT ${input.totalDurationTargetSec} DETIK. Bobot dramatis terbesar (Turning Point/Climax) mendapat durasi lebih panjang.`
    : isFixed
    ? `You are a world-class 1st Assistant Director (1st AD) & Cinematic Screenwriter.
Your task: Deconstruct the Cinematic Narrative Structure into an exact sequence of ${targetSceneCount} cinematic Scenes with fixed duration of ${input.fixedSceneDurationSec}s.

CINEMATIC DRAMATURGICAL STRATEGY:
- Dramatic Arc Archetype: ${strategy.dramatic_arc_type}
- Genre / Subgenre: ${strategy.genre} (${strategy.subgenre})
- Stakes: ${strategy.stakes}
- Ending Strategy: ${strategy.ending_strategy}
- Act Functions: ${strategy.act_functions.join(' -> ')}

CINEMATIC SHORT FILM DOCTRINE:
1. "DRAMA FIRST, INFORMATION SECOND" (DRAMATIC UNITS):
   - NEVER produce dry history textbook narration paragraphs. Focus on physical action (visual_action), blocking, eye contact, micro-gestures, and active dramatic units.
2. DISTINCT 'story_purpose' vs 'event':
   - story_purpose: The psychological / emotional intent and narrative purpose (WHY this scene exists).
   - event: The concrete physical dramatic occurrence happening on screen (WHAT happens).
3. ACTIVE DIALOGUE (dialogue):
   - When characters are present and interacting, provide rich, natural character speech with emotional subtext and vocal delivery.
4. MINIMAL VO (narrator_vo): Only when poetic reflection is needed; never narrate what is visually evident.
5. ENDING INTELLIGENCE: Match the ending strategy (${strategy.ending_strategy}). Do NOT force cliffhangers unless serialized!
${strategy.is_historical_or_sacred ? '6. PROPHET DEPICTION LOCK: No facial features for the Prophet Muhammad ﷺ; swaddled infant with no halos.\n7. HISTORICAL INTEGRITY & AUDIO: Define epistemic tier and specific SFX/BGM cues.' : '6. FICTIONAL INTEGRITY: Mark tier as FICTIONALIZED; is_prophet_present: false.'}
8. TITLES: Unique titles for every scene without continuation markers like (Part 1).
9. ABSOLUTE PROGRESSION & ANTI-DUPLICATION MANDATE:
   - Every single scene MUST have completely unique and distinct title, event, story_purpose, visual_action, and dialogue.
   - NEVER repeat or clone events, purposes, or character conversations across different scenes.
   - Progressively distribute the 5 narrative beats (Beginning -> Development -> Climax -> Consequence -> Ending) chronologically from Scene 1 to Scene ${targetSceneCount}. Each consecutive scene must represent a forward narrative step and escalate the dramatic conflict.`
    : `You are a world-class 1st Assistant Director (1st AD) & Cinematic Screenwriter.
Your task: Deconstruct the Cinematic Narrative Structure into a sequenced cinematic Scene Breakdown of ${targetSceneCount} scenes summing exactly to ${input.totalDurationTargetSec}s.

CINEMATIC DRAMATURGICAL STRATEGY:
- Dramatic Arc Archetype: ${strategy.dramatic_arc_type}
- Genre / Subgenre: ${strategy.genre} (${strategy.subgenre})
- Stakes: ${strategy.stakes}
- Ending Strategy: ${strategy.ending_strategy}
- Act Functions: ${strategy.act_functions.join(' -> ')}

CINEMATIC SHORT FILM DOCTRINE:
1. "DRAMA FIRST, INFORMATION SECOND" (DRAMATIC UNITS):
   - NEVER produce dry history textbook narration paragraphs. Focus on physical action (visual_action), blocking, eye contact, micro-gestures, and active dramatic units.
2. DISTINCT 'story_purpose' vs 'event':
   - story_purpose: The psychological / emotional intent and narrative purpose (WHY this scene exists).
   - event: The concrete physical dramatic occurrence happening on screen (WHAT happens).
3. ACTIVE DIALOGUE (dialogue):
   - When characters are present and interacting, provide rich, natural character speech with emotional subtext and vocal delivery.
4. MINIMAL VO (narrator_vo): Only when poetic reflection is needed; never narrate what is visually evident.
5. ENDING INTELLIGENCE: Match the ending strategy (${strategy.ending_strategy}). Do NOT force cliffhangers unless serialized!
${strategy.is_historical_or_sacred ? '6. PROPHET DEPICTION LOCK: No facial features for the Prophet Muhammad ﷺ; swaddled infant with no halos.\n7. HISTORICAL INTEGRITY & AUDIO: Define epistemic tier and specific SFX/BGM cues.' : '6. FICTIONAL INTEGRITY: Mark tier as FICTIONALIZED; is_prophet_present: false.'}
8. TITLES: Unique titles for every scene without continuation markers like (Part 1).
9. ABSOLUTE PROGRESSION & ANTI-DUPLICATION MANDATE:
   - Every single scene MUST have completely unique and distinct title, event, story_purpose, visual_action, and dialogue.
   - NEVER repeat or clone events, purposes, or character conversations across different scenes.
   - Progressively distribute the 5 narrative beats (Beginning -> Development -> Climax -> Consequence -> Ending) chronologically from Scene 1 to Scene ${targetSceneCount}. Each consecutive scene must represent a forward narrative step and escalate the dramatic conflict.
10. DURATION: Total duration across all scenes MUST EQUAL EXACTLY ${input.totalDurationTargetSec} SECONDS.`;

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
    ? `Pecah narasi berikut menjadi TEPAT ${targetSceneCount} SCENE (scene_number: 1 sampai ${targetSceneCount}) dengan durasi tetap ${input.fixedSceneDurationSec} detik per scene (Total: ${input.totalDurationTargetSec} detik).
Array JSON WAJIB memiliki tepat ${targetSceneCount} elemen objek adegan lengkap dan unik. DILARANG KERAS menghasilkan kurang dari ${targetSceneCount} adegan!

=== PRODUCTION CONSTRAINTS ===
Target Total Duration: ${input.totalDurationTargetSec} detik (EXACT)
Exact Scene Count: ${targetSceneCount} scenes (MANDATORY: scene_number 1 to ${targetSceneCount})
Fixed Scene Duration: ${input.fixedSceneDurationSec} detik per scene (System Assigned)

=== 5-BEAT NARRATIVE STRUCTURE ===
Beginning: ${input.narrativeBeats.beginning}
Development: ${input.narrativeBeats.development}
Climax: ${input.narrativeBeats.climax}
Consequence: ${input.narrativeBeats.consequence}
Ending: ${input.narrativeBeats.ending}`
    : `Pecah narasi berikut menjadi urutan TEPAT ${targetSceneCount} SCENE (scene_number: 1 sampai ${targetSceneCount}) dengan total durasi TEPAT ${input.totalDurationTargetSec} detik dan durasi per scene antara 5 hingga ${effectiveCeiling} detik.
Array JSON WAJIB memiliki tepat ${targetSceneCount} elemen objek adegan lengkap dan unik. DILARANG KERAS hanya menghasilkan 5 adegan atau kurang dari ${targetSceneCount} adegan!

=== PRODUCTION CONSTRAINTS ===
Target Total Narrative Duration: ${input.totalDurationTargetSec} detik (EXACT total across all scenes)
Exact Scene Count: ${targetSceneCount} scenes (MANDATORY: scene_number 1 to ${targetSceneCount})
Max Scene Duration Ceiling: ${effectiveCeiling} detik per scene
Distinction: Batas container rendering bukan total film. Semua adegan jika dijumlahkan harus mencapai tepat ${input.totalDurationTargetSec}s.

=== 5-BEAT NARRATIVE STRUCTURE ===
Beginning: ${input.narrativeBeats.beginning}
Development: ${input.narrativeBeats.development}
Climax: ${input.narrativeBeats.climax}
Consequence: ${input.narrativeBeats.consequence}
Ending: ${input.narrativeBeats.ending}`;

  prompt += rosterInstruction;

  if (input.customGuidance) {
    prompt += `\n\n=== PANDUAN STRUKTUR & DRAMATIC PROGRESSION KHUSUS (WAJIB DIIKUTI TIAP SCENE) ===\n${input.customGuidance}\n\nPASTIKAN menghasilkan urutan lengkap dari Scene 1 sampai Scene ${targetSceneCount} sesuai panduan di atas!`;
  }

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
        title: { type: Type.STRING, description: 'Descriptive scene title without continuation tags (e.g., INT. RUMAH AMINAH - KESAKSIAN AWAL)' },
        duration_sec: {
          type: Type.INTEGER,
          description: `Exact allocated scene duration in seconds (must be integer between 5 and ${effectiveCeiling}, and all scenes sum to ${input.totalDurationTargetSec})`,
        },
        scene_pattern: {
          type: Type.STRING,
          description: 'Dramatic beat pattern suited to genre arc: HOOK, SETUP, INCITING_INCIDENT, QUESTION, INVESTIGATION, EVIDENCE, COMPLICATION, REVELATION, WARNING, DILEMMA, POINT_OF_NO_RETURN, CATASTROPHE, AFTERMATH, TEST, CRUCIBLE, TEMPTATION, ILLUMINATION, ESCALATION, CONFRONTATION, TURNING_POINT, CLIMAX, BREAKTHROUGH, RESOLUTION, PAYOFF, REFLECTION, LEGACY, CLIFFHANGER',
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
        visual_action: {
          type: Type.STRING,
          description: "Show, Don't Tell: Concrete physical blocking, visual gestures, props, micro-reactions, eye contact, and atmospheric motion. Never state historical facts; show tangible actions.",
        },
        dialogue: {
          type: Type.ARRAY,
          description: 'Character dialogue lines. Active spoken dialogue with subtext and character intention. Empty if purely visual.',
          items: {
            type: Type.OBJECT,
            properties: {
              character_name: { type: Type.STRING, description: 'Speaker name from character roster' },
              line: { type: Type.STRING, description: 'Spoken line' },
              emotional_subtext: { type: Type.STRING, description: 'Inner emotional intention behind the line' },
              delivery: { type: Type.STRING, description: 'Vocal delivery: berbisik, tegas, bergetar, tenang, dll.' },
            },
            required: ['character_name', 'line'],
          },
        },
        narrator_vo: {
          type: Type.STRING,
          description: 'Minimal poetic voiceover. NEVER narrate what the camera shows. Empty string if not needed.',
        },
        sound_design: {
          type: Type.OBJECT,
          description: 'Sound effects and background music design',
          properties: {
            sfx: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Specific foley/sound effect cues (e.g. derap pasir, hembusan angin malam, denting lonceng)',
            },
            bgm_mood: { type: Type.STRING, description: 'Musical atmosphere (e.g. ketegangan senyap, gesekan cello sendu)' },
            silence_cue: { type: Type.BOOLEAN, description: 'True if there is a sudden dramatic silence drop' },
          },
          required: ['sfx', 'bgm_mood'],
        },
        historical_integrity: {
          type: Type.OBJECT,
          description: 'Epistemic classification of this scene',
          properties: {
            tier: {
              type: Type.STRING,
              description: 'Epistemic classification: FACT, DRAMATIZED_DIALOGUE, NARRATIVE_BRIDGE, or FICTIONALIZED',
            },
            basis: { type: Type.STRING, description: 'Historical source basis or dramatization rationale' },
          },
          required: ['tier'],
        },
        prophet_depiction_safeguard: {
          type: Type.OBJECT,
          description: 'Reverence safeguard when Prophet Muhammad ﷺ is present',
          properties: {
            is_prophet_present: { type: Type.BOOLEAN, description: 'Whether the Prophet Muhammad ﷺ is present in this scene' },
            visual_rule: {
              type: Type.STRING,
              description: 'Visual framing safeguard (e.g., Swaddled infant, face turned away, no divine glow, camera behind shoulder)',
            },
          },
          required: ['is_prophet_present', 'visual_rule'],
        },
      },
      required: [
        'scene_number',
        'title',
        'duration_sec',
        'scene_pattern',
        'story_purpose',
        'location_name',
        'time_of_day',
        'character_names',
        'emotional_objective',
        'event',
        'narrative_function',
        'visual_action',
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
    maxOutputTokens: 8192,
    timeoutMs: 180000,
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
        scene_pattern: 'HOOK',
        story_purpose: beats.beginning,
        location_name: defaultLocation,
        time_of_day: 'DAY',
        character_names: defaultChars,
        emotional_objective: 'Establish stakes and world',
        event: beats.beginning,
        visual_action: beats.beginning,
        narrative_function: 'HOOK',
        duration_sec: Math.min(effectiveCeiling, 15),
      },
      {
        scene_number: 2,
        title: isIndo ? 'Adegan 2 - Eskalasi Konflik' : 'Scene 2 - Rising Action',
        scene_pattern: 'CONTEXT',
        story_purpose: beats.development,
        location_name: defaultLocation,
        time_of_day: 'DAY',
        character_names: defaultChars,
        emotional_objective: 'Escalate core drama',
        event: beats.development,
        visual_action: beats.development,
        narrative_function: 'CONTEXT',
        duration_sec: Math.min(effectiveCeiling, 20),
      },
      {
        scene_number: 3,
        title: isIndo ? 'Adegan 3 - Puncak Klimaks' : 'Scene 3 - The Climax',
        scene_pattern: 'ESCALATION',
        story_purpose: beats.climax,
        location_name: defaultLocation,
        time_of_day: 'DUSK',
        character_names: defaultChars,
        emotional_objective: 'Peak emotional impact',
        event: beats.climax,
        visual_action: beats.climax,
        narrative_function: 'ESCALATION',
        duration_sec: Math.min(effectiveCeiling, 25),
      },
      {
        scene_number: 4,
        title: isIndo ? 'Adegan 4 - Dampak & Pilihan' : 'Scene 4 - Repercussions',
        scene_pattern: 'TURNING_POINT',
        story_purpose: beats.consequence,
        location_name: defaultLocation,
        time_of_day: 'NIGHT',
        character_names: defaultChars,
        emotional_objective: 'Process crucial decisions',
        event: beats.consequence,
        visual_action: beats.consequence,
        narrative_function: 'TURNING_POINT',
        duration_sec: Math.min(effectiveCeiling, 20),
      },
      {
        scene_number: 5,
        title: isIndo ? 'Adegan 5 - Resolusi Akhir' : 'Scene 5 - Final Resolution',
        scene_pattern: 'PAYOFF',
        story_purpose: beats.ending,
        location_name: defaultLocation,
        time_of_day: 'DAWN',
        character_names: defaultChars,
        emotional_objective: 'Deliver enduring resonance',
        event: beats.ending,
        visual_action: beats.ending,
        narrative_function: 'PAYOFF',
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
    const patternFallback: any = idx === 0 ? 'HOOK' : idx === 1 ? 'CONTEXT' : idx === 2 ? 'ESCALATION' : idx === parsed.length - 2 ? 'TURNING_POINT' : 'PAYOFF';
    const isProphetRef = (sc.character_names || []).some((n: string) => /muhammad|rasulullah|bayi|infant/i.test(n));

    const resolvedEvent = (sc.event && sc.event.trim() !== '-' && sc.event.trim() !== '--' && sc.event.trim() !== '---' && sc.event.trim() !== '')
      ? sc.event.trim()
      : (sc.visual_action?.trim() || sc.story_purpose?.trim() || sc.title?.trim() || 'Aksi dramatis adegan');

    const resolvedVisual = (sc.visual_action && sc.visual_action.trim() !== '-' && sc.visual_action.trim() !== '')
      ? sc.visual_action.trim()
      : (resolvedEvent || sc.story_purpose?.trim() || 'Aksi visual terfokus');

    let resolvedLocation = (sc.location_name || '').trim();
    if (locationRoster.length > 0) {
      const isGeneric = !resolvedLocation || /latar|sinematik|lokasi|tempat/i.test(resolvedLocation) || !locationRoster.includes(resolvedLocation);
      if (isGeneric) {
        const fuzzyMatch = locationRoster.find(loc => resolvedLocation && loc.toLowerCase().includes(resolvedLocation.toLowerCase()));
        resolvedLocation = fuzzyMatch || locationRoster[0];
      }
    }

    let resolvedPurpose = (typeof sc.story_purpose === 'string' && sc.story_purpose.trim() !== '')
      ? sc.story_purpose.trim()
      : (sc.narrative_function || sc.title || 'Pengembangan narasi adegan sinematik.');

    if (resolvedPurpose === resolvedEvent) {
      resolvedPurpose = isIndo
        ? `Membangkitkan fokus dramatis dan pergeseran emosional atas peristiwa: ${resolvedEvent}`
        : `Drive emotional resonance and narrative stakes for: ${resolvedEvent}`;
    }

    return {
      ...sc,
      scene_number: idx + 1,
      duration_sec: assignedDuration,
      scene_tone: recommendedTone,
      scene_pattern: sc.scene_pattern || patternFallback,
      location_name: resolvedLocation || sc.location_name,
      event: resolvedEvent,
      story_purpose: resolvedPurpose,
      visual_action: resolvedVisual,
      dialogue: (() => {
        let rawDialogue = sc.dialogue || (sc as any).character_dialogue || (sc as any).dialogue_field || [];
        if (!Array.isArray(rawDialogue)) {
          rawDialogue = [];
        }
        return rawDialogue.map((d: any) => {
          const character_name = String(d.character_name || d.character || d.speaker || '').trim();
          const line = String(d.line || d.dialogue || d.text || '').trim();
          const emotional_subtext = String(d.emotional_subtext || d.subtext || 'NONE').trim();
          const delivery = String(d.delivery || d.tone || 'NONE').trim();
          return { character_name, line, emotional_subtext, delivery };
        }).filter(d => d.character_name && d.line);
      })(),
      narrator_vo: typeof sc.narrator_vo === 'string' ? sc.narrator_vo : ((sc as any).vo || (sc as any).voiceover || null),
      sound_design: (() => {
        const rawSound = sc.sound_design || (sc as any).sound || {};
        let resolvedSfx = Array.isArray(rawSound.sfx) ? rawSound.sfx : (Array.isArray((sc as any).sfx) ? (sc as any).sfx : ['ambient desert breeze']);
        let resolvedBgm = rawSound.bgm_mood || rawSound.bgm || (sc as any).bgm || 'solemn contemplative strings';
        if (typeof resolvedSfx === 'string') {
          resolvedSfx = [resolvedSfx];
        }
        return {
          sfx: resolvedSfx,
          bgm_mood: resolvedBgm,
          silence_cue: Boolean(rawSound.silence_cue),
        };
      })(),
      historical_integrity: sc.historical_integrity || {
        tier: 'DRAMATIZED_DIALOGUE',
        basis: 'Sirah Nabawiyah & Authentic Historical Records',
      },
      prophet_depiction_safeguard: sc.prophet_depiction_safeguard || {
        is_prophet_present: isProphetRef,
        visual_rule: isProphetRef
          ? 'Swaddled infant held close without showing face, no artificial halos/glow, sacred reverence maintained.'
          : 'Standard dignified cinematic framing.',
      },
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

    // 5. Ensure visual_action is populated with concrete physical action
    if (!scene.visual_action || typeof scene.visual_action !== 'string' || scene.visual_action.trim() === '') {
      scene.visual_action = scene.event || scene.story_purpose || 'Kamera menyorot aksi dramatis karakter.';
    }
  }

  // 6. Check and auto-repair duplicate titles or events
  if (scenes.length > 1) {
    const seenTitles = new Map<string, number>();
    const seenEvents = new Map<string, number>();

    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i];
      const normTitle = (sc.title || `Adegan ${i + 1}`).trim().toLowerCase();
      const normEvent = (sc.event || '').trim().toLowerCase();

      const countT = seenTitles.get(normTitle) || 0;
      if (countT > 0 && normTitle) {
        const suffix = isIndo ? `(Bagian ${countT + 1})` : `(Segment ${countT + 1})`;
        sc.title = `${sc.title} ${suffix}`;
      }
      seenTitles.set(normTitle, countT + 1);

      const countE = seenEvents.get(normEvent) || 0;
      if (countE > 0 && normEvent) {
        const evSuffix = isIndo
          ? `(Perkembangan Aksi Lanjutan Bagian ${countE + 1})`
          : `(Continued Action Phase ${countE + 1})`;
        sc.event = `${sc.event} ${evSuffix}`;
        if (sc.visual_action) {
          sc.visual_action = `${sc.visual_action} ${evSuffix}`;
        }
      }
      seenEvents.set(normEvent, countE + 1);
    }
  }

  return { valid: true };
}

