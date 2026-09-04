import { executeTask, safeParseJSON } from '../llm_provider';
import { Type } from '../gemini';
import { ContextPackage, Scene, CharacterBible, LocationBible, ObjectBible, Shot, ReasoningConfig } from '../../src/types';
import {
  buildNarrativeVoiceInstruction,
  buildSceneToneInstruction,
  resolveSceneTone,
} from '../narrative_tone';

export interface Stage6ShotBreakdownInput {
  scene: Scene;
  characters: CharacterBible[];
  locations: LocationBible[];
  objects: ObjectBible[];
  contextPackage?: ContextPackage | null;
  language: 'id' | 'en';
  model?: string;
  reasoningConfig?: ReasoningConfig;
  feedbackPrompt?: string;
  onProgress?: (message: string) => void;
}

export function formatCompactContextPackage(pkg: ContextPackage | null | undefined): string {
  if (!pkg) return 'No grounding context available.';
  const summaryParts: string[] = [];
  if (pkg.researchSummary) {
    summaryParts.push(`Research Summary: ${pkg.researchSummary}`);
  }
  if (pkg.facts && pkg.facts.length > 0) {
    summaryParts.push(`Key Facts:\n` + pkg.facts.slice(0, 10).map((f: any) => `- ${typeof f === 'string' ? f : f.fact || f.statement || JSON.stringify(f)}`).join('\n'));
  }
  if (pkg.constraints && pkg.constraints.length > 0) {
    summaryParts.push(`Hard Constraints:\n` + pkg.constraints.slice(0, 10).map((c: any) => `- ${typeof c === 'string' ? c : c.message || c.code || c}`).join('\n'));
  }
  if (pkg.timeline && pkg.timeline.length > 0) {
    summaryParts.push(`Timeline Events:\n` + pkg.timeline.slice(0, 10).map((t: any) => `- [${t.timeMarker || t.phase || 'Event'}] ${t.event || t.description}`).join('\n'));
  }
  if (pkg.unknowns && pkg.unknowns.length > 0) {
    summaryParts.push(`Unknowns / Open Questions:\n` + pkg.unknowns.slice(0, 5).map((u: any) => `- ${u}`).join('\n'));
  }
  return summaryParts.length > 0 ? summaryParts.join('\n\n') : 'Grounding context active.';
}

export type DetectedShot = Omit<
  Shot,
  'id' | 'scene_id' | 'project_id' | 'version' | 'created_at' | 'updated_at'
>;

export function getMaxShotsForDuration(durationSec: number): number {
  return 1; // Scene-centric: exactly one virtual shot record per Scene representing complete production
}

export interface Stage6ValidationResult {
  valid: boolean;
  calculatedTotal: number;
  expectedDuration: number;
  maxAllowedShots: number;
  actualShotCount: number;
  errorMessage?: string;
  correctivePrompt?: string;
}

/**
 * Validates shot duration total strictly against parent scene duration
 */
export function validateShotDurationTotal(
  sceneOrShots: any,
  shotsOrDuration: any
): { valid: boolean; total: number; expected: number; error?: string } {
  let scene: { duration_sec: number };
  let shots: DetectedShot[];

  if (Array.isArray(sceneOrShots)) {
    shots = sceneOrShots;
    scene = typeof shotsOrDuration === 'number' ? { duration_sec: shotsOrDuration } : (shotsOrDuration || { duration_sec: 0 });
  } else {
    scene = sceneOrShots || { duration_sec: 0 };
    shots = Array.isArray(shotsOrDuration) ? shotsOrDuration : [];
  }

  if (!shots || shots.length === 0) {
    return { valid: false, total: 0, expected: scene.duration_sec, error: 'Daftar shot kosong' };
  }

  let total = 0;
  for (const shot of shots) {
    if (typeof shot.duration_sec !== 'number' || isNaN(shot.duration_sec) || shot.duration_sec <= 0) {
      return {
        valid: false,
        total,
        expected: scene.duration_sec,
        error: `Shot #${shot.shot_number} memiliki durasi tidak valid (${shot.duration_sec})`,
      };
    }
    total += shot.duration_sec;
  }

  const roundedTotal = Math.round(total * 10) / 10;
  const roundedExpected = Math.round(scene.duration_sec * 10) / 10;

  if (roundedTotal !== roundedExpected) {
    return {
      valid: false,
      total: roundedTotal,
      expected: roundedExpected,
      error: `Total durasi shot (${roundedTotal}s) tidak sama dengan durasi scene (${roundedExpected}s)`,
    };
  }

  return { valid: true, total: roundedTotal, expected: roundedExpected };
}

export function validateShotBreakdown(
  shots: DetectedShot[],
  sceneDurationSec: number,
  language: 'id' | 'en' = 'id'
): Stage6ValidationResult {
  const isIndo = language === 'id';
  const maxAllowedShots = getMaxShotsForDuration(sceneDurationSec);
  let calculatedTotal = 0;
  const violations: string[] = [];

  if (!shots || shots.length === 0) {
    return {
      valid: false,
      calculatedTotal: 0,
      expectedDuration: sceneDurationSec,
      maxAllowedShots,
      actualShotCount: 0,
      errorMessage: isIndo ? 'Daftar shot kosong' : 'Shot list is empty',
      correctivePrompt: `The previous shot breakdown has an invalid total duration. Scene duration: ${sceneDurationSec} seconds. Generated shot total: 0 seconds. Correct ONLY the shot durations so that the total equals exactly ${sceneDurationSec} seconds. Do not change the scene narrative, characters, locations, or dramatic intent.`,
    };
  }

  // 1. Check max shot count
  if (shots.length > maxAllowedShots) {
    violations.push(
      isIndo
        ? `Jumlah shot (${shots.length}) melebihi batas maksimal untuk durasi scene ${sceneDurationSec}s (Maks: ${maxAllowedShots} shot).`
        : `Shot count (${shots.length}) exceeds hard cap for scene duration ${sceneDurationSec}s (Max: ${maxAllowedShots} shot(s)).`
    );
  }

  // 2. Check sum & continuous timeline
  let expectedStart = 0;
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    calculatedTotal += shot.duration_sec;

    if (shot.duration_sec <= 0) {
      violations.push(
        isIndo
          ? `Shot #${shot.shot_number} memiliki durasi tidak valid (${shot.duration_sec} detik).`
          : `Shot #${shot.shot_number} has invalid duration (${shot.duration_sec}s).`
      );
    }

    if (shot.start_time_sec !== expectedStart) {
      violations.push(
        isIndo
          ? `Shot #${shot.shot_number} memiliki start_time_sec (${shot.start_time_sec}s) yang tidak kontinu (diharapkan ${expectedStart}s).`
          : `Shot #${shot.shot_number} has non-continuous start time (${shot.start_time_sec}s, expected ${expectedStart}s).`
      );
    }

    if (shot.end_time_sec !== shot.start_time_sec + shot.duration_sec) {
      violations.push(
        isIndo
          ? `Shot #${shot.shot_number} memiliki end_time_sec (${shot.end_time_sec}s) yang tidak cocok dengan start (${shot.start_time_sec}s) + duration (${shot.duration_sec}s).`
          : `Shot #${shot.shot_number} end_time_sec (${shot.end_time_sec}s) does not match start + duration.`
      );
    }

    expectedStart = shot.end_time_sec;
  }

  if (expectedStart !== sceneDurationSec) {
    violations.push(
      isIndo
        ? `Timeline shot berakhir pada ${expectedStart}s, tidak pas dengan durasi scene induk ${sceneDurationSec}s.`
        : `Shot timeline ends at ${expectedStart}s, does not match parent scene duration ${sceneDurationSec}s.`
    );
  }

  const diff = calculatedTotal - sceneDurationSec;
  if (diff !== 0) {
    violations.push(
      isIndo
        ? `Total durasi seluruh shot adalah ${calculatedTotal} detik, tidak sama dengan durasi scene induk ${sceneDurationSec} detik (selisih: ${
            diff > 0 ? `+${diff}` : `${diff}`
          } detik).`
        : `Total shot duration is ${calculatedTotal}s, not equal to parent scene duration ${sceneDurationSec}s (variance: ${
            diff > 0 ? `+${diff}` : `${diff}`
          }s).`
    );
  }

  if (violations.length === 0) {
    return {
      valid: true,
      calculatedTotal,
      expectedDuration: sceneDurationSec,
      maxAllowedShots,
      actualShotCount: shots.length,
    };
  }

  const errorMessage = violations.join(' ');
  const correctivePrompt = `The previous shot breakdown has an invalid total duration. Scene duration: ${sceneDurationSec} seconds. Generated shot total: ${calculatedTotal} seconds. Correct ONLY the shot durations so that the total equals exactly ${sceneDurationSec} seconds. Do not change the scene narrative, characters, locations, or dramatic intent.`;

  return {
    valid: false,
    calculatedTotal,
    expectedDuration: sceneDurationSec,
    maxAllowedShots,
    actualShotCount: shots.length,
    errorMessage,
    correctivePrompt,
  };
}

export async function runStage6ShotBreakdownAttempt(
  input: Stage6ShotBreakdownInput
): Promise<DetectedShot[]> {
  const { scene, characters, locations, objects, language, feedbackPrompt, contextPackage } = input;
  const isIndo = language === 'id';

  const maxAllowedShots = getMaxShotsForDuration(scene.duration_sec);

  // Filter relevant characters & locations for this scene
  const relevantCharacters = characters.filter((c) =>
    scene.character_names.some((name) =>
      c.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(c.name.toLowerCase())
    )
  );
  const relevantLocation = locations.find((l) =>
    l.name.toLowerCase().includes(scene.location_name.toLowerCase()) ||
    scene.location_name.toLowerCase().includes(l.name.toLowerCase())
  );

  const narrativeDoctrine = buildNarrativeVoiceInstruction(null, language);
  const sceneTone = resolveSceneTone(scene);
  const sceneToneInstruction = buildSceneToneInstruction(scene, sceneTone, language);

  const baseInstruction = isIndo
    ? `Anda adalah Master Director & Cinematographer AI (Stage 6: Scene-Centric Production Agent).
Tugas Anda adalah menghasilkan SATU record produksi lengkap (Complete Scene Production) untuk seluruh Scene. Jangan pecah scene menjadi beberapa shot kamera independen.

BATASAN MUTLAK & ATURAN KERAS (NON-NEGOTIABLE HARD RULES):
1. Durasi Scene Induk: ${scene.duration_sec} DETIK.
2. JUMLAH RECORD PRODUKSI WAJIB TEPAT: 1 record dengan durasi penuh ${scene.duration_sec} detik.
3. KESEIMBANGAN WAKTU: duration_sec WAJIB TEPAT SAMA DENGAN ${scene.duration_sec} DETIK (toleransi 0).
4. Rentang waktu wajib dari start_time_sec = 0 sampai end_time_sec = ${scene.duration_sec}.
5. "event_detail" (Detail Kejadian): Tulis ringkasan kejadian spesifik visual untuk seluruh scene secara jelas dan kaya narasi. Field ini adalah SUMBER KEBENARAN TUNGGAL (Single Source of Truth) untuk pembuatan Image Prompt dan Video Prompt berikutnya!
6. "character_action": Aksi visual fisik karakter di dalam frame untuk seluruh adegan ini.
7. "camera_note": Jenis lensa, angle (low-angle, eye-level), framing (wide, medium, close-up), dan pergerakan kamera (dolly in, panning, static) untuk seluruh adegan ini.
8. "dialogue": Dialog karakter jika ada pada seluruh adegan ini (array of {character_name, line}), jika tidak ada berikan array kosong [].
9. "emotion": Nuansa emosional beat adegan ini.
10. "audio_note": Ambience lingkungan & efek suara spesifik untuk seluruh adegan ini.`
    : `You are a Master AI Director & Cinematographer (Stage 6: Scene-Centric Production Agent).
Your task is to generate EXACTLY ONE complete production record (Complete Scene Production) representing the entire Scene. Do not break the scene into multiple camera shots.

NON-NEGOTIABLE HARD RULES:
1. Parent Scene Duration: ${scene.duration_sec} SECONDS.
2. EXACT RECORD COUNT: Exactly 1 record representing the full duration of ${scene.duration_sec} seconds.
3. EXACT DURATION: duration_sec MUST EQUAL EXACTLY ${scene.duration_sec} SECONDS.
4. Time range must be start_time_sec = 0 to end_time_sec = ${scene.duration_sec}.
5. "event_detail": Write a vivid, precise, complete summary of what happens across this entire scene. This field is the Single Source of Truth for subsequent Image and Video Prompts!
6. "character_action": Specific physical action of characters in frame across this scene.
7. "camera_note": Framing, camera movement, angle, and lens note for this scene.
8. "dialogue": All dialogue spoken during this scene ({character_name, line}) or empty [].
9. "emotion": Emotional beat.
10. "audio_note": Specific ambient and foley sound effects for this scene.`;

  const groundingContext = formatCompactContextPackage(contextPackage);
  const systemInstruction = `${baseInstruction}\n\n${narrativeDoctrine}\n\n${sceneToneInstruction}\n\nGROUNDING CONTEXT:\n${groundingContext}`;

  const userPrompt = `
=== DETAIL SCENE INDUK ===
Scene #${scene.scene_number}: ${scene.title}
Durasi Wajib: ${scene.duration_sec} detik
Lokasi: ${scene.location_name} (${scene.time_of_day})
Karakter Terlibat: ${scene.character_names.join(', ') || 'None'}
Tujuan Naratif: ${scene.story_purpose}
Tujuan Emosional: ${scene.emotional_objective}
Peristiwa Scene: ${scene.event}
Scene Tone: Preset=${sceneTone.preset || 'CUSTOM'}, Atmosphere=${sceneTone.atmosphere}, Pacing=${sceneTone.pacing}, Intensity=${sceneTone.intensity}/100, Tension=${sceneTone.dramatic_tension}/100

=== BIBLE KARAKTER TERKAIT ===
${relevantCharacters.map((c) => `- ${c.name}: ${c.physical_appearance}, Pakaian: ${Array.isArray(c.clothing) ? c.clothing.join(', ') : (c.clothing || 'Standard')}, Wajah Terkunci: ${c.face_identity_locked}`).join('\n') || 'Tidak ada karakter spesifik'}

=== BIBLE LOKASI TERKAIT ===
${relevantLocation ? `Nama: ${relevantLocation.name}\nEra: ${relevantLocation.era}\nLingkungan: ${relevantLocation.environment}\nPencahayaan: ${relevantLocation.lighting_style}\nDetail Ruang: ${(relevantLocation as any).spatial_details || ''}` : 'Lokasi Umum'}

=== BIBLE OBJEK TERKAIT ===
${objects.map((o) => `- ${o.name} (${o.category}): ${o.description}`).join('\n') || 'None'}

${feedbackPrompt ? `\n=== INSTRUKSI KOREKSI / FEEDBACK DARI PERCOBAAN SEBELUMNYA ===\n${feedbackPrompt}\n` : ''}

Buat 1 record produksi lengkap untuk scene ini dengan durasi pas ${scene.duration_sec} detik.
Kembalikan format JSON sesuai schema.
`;

  const response = await executeTask({
    taskId: 'shot_breakdown',
    stageCode: 'S6',
    entityId: `Scene #${scene.scene_number}`,
    onProgress: input.onProgress,
    prompt: userPrompt,
    systemInstruction,
    temperature: 0.2,
    reasoningConfig: input.reasoningConfig,
    projectPolicy: {
      mode: input.model ? 'pin' : 'auto',
      quality: 'high',
      priority: 'speed',
      pinnedModelId: input.model,
      pinnedProviderId: input.reasoningConfig?.provider_name || input.reasoningConfig?.provider_type,
    },
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        shots: {
          type: Type.ARRAY,
          description: `Daftar shot yang membagi durasi scene ${scene.duration_sec}s secara tepat`,
          items: {
            type: Type.OBJECT,
            properties: {
              shot_number: { type: Type.INTEGER, description: 'Nomor shot urut mulai 1' },
              start_time_sec: { type: Type.NUMBER, description: 'Waktu mulai shot dalam scene (detik)' },
              end_time_sec: { type: Type.NUMBER, description: 'Waktu selesai shot dalam scene (detik)' },
              duration_sec: { type: Type.NUMBER, description: 'Durasi shot dalam detik' },
              event_detail: { type: Type.STRING, description: 'Ringkasan kejadian detail & visual untuk shot ini' },
              character_action: { type: Type.STRING, description: 'Aksi karakter pada shot ini' },
              camera_note: { type: Type.STRING, description: 'Pergerakan kamera, framing, lens & angle' },
              dialogue: {
                type: Type.ARRAY,
                description: 'Dialog pada shot ini, atau kosong jika hening/non-verbal',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    character_name: { type: Type.STRING },
                    line: { type: Type.STRING },
                  },
                  required: ['character_name', 'line'],
                },
              },
              emotion: { type: Type.STRING, description: 'Nuansa emosi' },
              audio_note: { type: Type.STRING, description: 'Catatan audio, SFX & ambience' },
            },
            required: [
              'shot_number',
              'start_time_sec',
              'end_time_sec',
              'duration_sec',
              'event_detail',
              'character_action',
              'camera_note',
              'dialogue',
              'emotion',
              'audio_note',
            ],
          },
        },
      },
      required: ['shots'],
    },
  });

  const rawText = response.text?.trim() || '{}';
  const parsed = safeParseJSON(rawText);
  if (!parsed.shots || !Array.isArray(parsed.shots)) {
    throw new Error('Format JSON response Gemini tidak mengandung array "shots" yang valid.');
  }

  // Normalize shot numbers and times if slight float rounding
  const rawShots = parsed.shots as DetectedShot[];
  const normalizedShots: DetectedShot[] = rawShots.map((s, idx) => ({
    shot_number: idx + 1,
    start_time_sec: Number(s.start_time_sec),
    end_time_sec: Number(s.end_time_sec),
    duration_sec: Math.round(Number(s.duration_sec) * 10) / 10,
    event_detail: s.event_detail || '',
    character_action: s.character_action || '',
    camera_note: s.camera_note || '',
    dialogue: Array.isArray(s.dialogue) ? s.dialogue : [],
    emotion: s.emotion || '',
    audio_note: s.audio_note || '',
  }));

  return normalizedShots;
}
