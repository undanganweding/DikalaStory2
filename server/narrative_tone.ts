import {
  Project,
  Scene,
  SceneTone,
  TonePresetName,
  PacingType,
  AtmosphereType,
  NarrativeStyleConfig,
  GlobalConstraints,
} from '../src/types';

export const DEFAULT_GLOBAL_CONSTRAINTS: GlobalConstraints = {
  religious_adab: 'strict',
  historical_fidelity: 'strict',
  dignity: 'strict',
  clarity: 'high',
  cinematic_quality: 'high',
};

export const TONE_PRESETS: Record<TonePresetName, SceneTone> = {
  SOLEMN: {
    intensity: 20,
    emotional_weight: 70,
    pacing: 'slow',
    atmosphere: 'solemn',
    dramatic_tension: 20,
    preset: 'SOLEMN',
    is_ai_recommended: false,
  },
  CONTEMPLATIVE: {
    intensity: 25,
    emotional_weight: 65,
    pacing: 'slow',
    atmosphere: 'contemplative',
    dramatic_tension: 25,
    preset: 'CONTEMPLATIVE',
    is_ai_recommended: false,
  },
  MYSTERIOUS: {
    intensity: 45,
    emotional_weight: 55,
    pacing: 'medium',
    atmosphere: 'mysterious',
    dramatic_tension: 60,
    preset: 'MYSTERIOUS',
    is_ai_recommended: false,
  },
  TENSE: {
    intensity: 70,
    emotional_weight: 55,
    pacing: 'fast',
    atmosphere: 'tense',
    dramatic_tension: 85,
    preset: 'TENSE',
    is_ai_recommended: false,
  },
  ACTION: {
    intensity: 90,
    emotional_weight: 65,
    pacing: 'fast',
    atmosphere: 'action',
    dramatic_tension: 95,
    preset: 'ACTION',
    is_ai_recommended: false,
  },
  TRAGIC: {
    intensity: 55,
    emotional_weight: 95,
    pacing: 'slow',
    atmosphere: 'tragic',
    dramatic_tension: 70,
    preset: 'TRAGIC',
    is_ai_recommended: false,
  },
  TRIUMPHANT: {
    intensity: 75,
    emotional_weight: 80,
    pacing: 'medium',
    atmosphere: 'triumphant',
    dramatic_tension: 70,
    preset: 'TRIUMPHANT',
    is_ai_recommended: false,
  },
  CUSTOM: {
    intensity: 50,
    emotional_weight: 50,
    pacing: 'medium',
    atmosphere: 'dramatic',
    dramatic_tension: 50,
    preset: 'CUSTOM',
    is_ai_recommended: false,
  },
};

export const TONE_PRESET_NAMES: TonePresetName[] = [
  'SOLEMN',
  'CONTEMPLATIVE',
  'MYSTERIOUS',
  'TENSE',
  'ACTION',
  'TRAGIC',
  'TRIUMPHANT',
  'CUSTOM',
];

export const TONE_PRESET_DICTIONARY = TONE_PRESETS;

export const DEFAULT_NARRATIVE_STYLE_CONFIG: NarrativeStyleConfig = {
  language: 'id-ID',
  narrative_mode: 'cinematic_sirah',
  global_constraints: DEFAULT_GLOBAL_CONSTRAINTS,
  default_scene_tone: {
    intensity: 50,
    emotional_weight: 50,
    pacing: 'medium',
    atmosphere: 'dramatic',
    dramatic_tension: 50,
  },
};

export const GLOBAL_NARRATIVE_DOCTRINE_ID = `DOKTRIN SINEMATIK DIKALASTORY — SHORT FILM & DRAMATIC STORYTELLING:
1. FILOSOFI UTAMA: "DRAMA FIRST, INFORMATION SECOND" — JANGAN PERNAH MENJELASKAN APA YANG BISA DITAMPILKAN ATAU DIDRAMATISASI (SHOW, DON'T TELL).
   - Output BUKAN artikel ensiklopedia sejarah atau buku teks yang dibacakan narator.
   - Setiap episode HARUS terasa seperti mini cinematic short film dengan ketegangan visual, aksi langsung, dan konflik karakter nyata.
2. STRUKTUR DRAMATIS 6-BEAT SINEMATIK:
   - 0–3s: HOOK (Aksi mendadak, keheningan mencekam, atau dialog bertensi tinggi yang langsung menyentak penonton tanpa pengantar narator bertele-tele).
   - 3–30s: CONTEXT / PROBLEM (Pengenalan situasi melalui aksi visual dan taruhan dramatis langsung, bukan kuliah sejarah).
   - 30–70s: ESCALATION (Eskalasi ketegangan, perdebatan tajam, rintangan, atau penolakan).
   - 70–120s: TURNING POINT (Puncak klimaks, proklamasi penentu, pengungkapan kebenaran, titik tanpa kembali).
   - 120–160s: PAYOFF (Dampak emosional, reaksi komunitas/tokoh, keharuan mendalam).
   - Ending: SECOND PAYOFF / CLIFFHANGER (Resonansi abadi atau pemicu rasa penasaran untuk episode berikutnya).
3. PENGUNCIAN PENGGAMBARAN NABI MUHAMMAD ﷺ (PROPHET DEPICTION LOCK):
   - WAJIB MUTLAK: Wajah Nabi Muhammad ﷺ TIDAK BOLEH digambarkan atau ditampilkan secara visual (no recognizable facial features).
   - Saat bayi/anak-anak: Sosok bayi SELALU dalam balutan kain kafan/bedong (swaddled in cloth), wajah tidak terlihat/menghadap dada penggendong, TANPA cahaya supernatural/halo magis berlebihan.
   - Penghormatan dan adab suci (ta'dzim) dijaga sepanjang waktu.
4. KLASIFIKASI INTEGRITAS HISTORIS (EPISTEMIC TIERS):
   - FACT: Terpaku kuat pada catatan sejarah sahih dan sirah nabawiyah yang muktamad.
   - DRAMATIZED_DIALOGUE: Dialog antar karakter yang masuk akal, menghidupkan suasana dengan subteks emosional, tetapi selaras dengan jiwa sejarah.
   - NARRATIVE_BRIDGE: Jembatan sinematik yang menghubungkan peristiwa-peristiwa bersejarah.
   - FICTIONALIZED: Detail atmosferik, sensoris fisik (desir angin, debu gurun, derap langkah).
5. DIALOG AKTIF & VOICE-OVER MINIMAL:
   - Karakter berbicara dengan dialog yang dinamis, bertenaga, dan memiliki subteks emosional (bukan khotbah datar).
   - Voice-over (Narator) SANGAT MINIMAL, puitis, dan atmosferik. JANGAN menarasikan aksi fisik yang sedang dilihat penonton di layar.
6. AUDIO & SOUND DESIGN TERINTEGRASI:
   - Setiap adegan memiliki petunjuk efek suara spesifik (SFX) dan suasana musik latar (BGM) untuk membangun immersi penonton.`;

export const GLOBAL_NARRATIVE_DOCTRINE_EN = `DIKALASTORY CINEMATIC DOCTRINE — SHORT FILM & DRAMATIC STORYTELLING:
1. CORE PHILOSOPHY: "DRAMA FIRST, INFORMATION SECOND" — NEVER EXPLAIN WHAT CAN BE SHOWN OR DRAMATIZED (SHOW, DON'T TELL).
   - Output is NOT an encyclopedic history entry or a narrator reading a textbook.
   - Every episode MUST feel like a mini cinematic short film driven by visual tension, physical staging, and direct character conflict.
2. 6-BEAT CINEMATIC SHORT DRAMATIC ARC:
   - 0–3s: HOOK (Immediate action, sudden silence, or high-stakes dialogue arresting attention instantly with no slow narrator preamble).
   - 3–30s: CONTEXT / PROBLEM (World setup established through visual action and immediate stakes, not dry exposition).
   - 30–70s: ESCALATION (Rising tension, obstacles, sharp character disagreements, or building suspense).
   - 70–120s: TURNING POINT (Climactic decision, decisive proclamation, truth revelation, point of no return).
   - 120–160s: PAYOFF (Emotional aftermath, community reaction, profound resonance).
   - Ending: SECOND PAYOFF / CLIFFHANGER (Lingering resonance or unresolved tension teasing the next chapter).
3. PROPHET MUHAMMAD ﷺ DEPICTION LOCK:
   - ABSOLUTE MANDATE: The facial features of the Prophet Muhammad ﷺ MUST NEVER be depicted (no recognizable face).
   - As an infant: Always securely swaddled in cloth, face turned away or covered, with NO artificial halos or supernatural glowing light effects.
   - Sacred adab, profound dignity, and historical reverence maintained at all times.
4. EPISTEMIC INTEGRITY TIERS:
   - FACT: Strictly grounded in authentic historical records and sirah consensus.
   - DRAMATIZED_DIALOGUE: Plausible character dialogue conveying emotional subtext while honoring historical context.
   - NARRATIVE_BRIDGE: Cinematic transitions connecting documented milestones.
   - FICTIONALIZED: Sensory and atmospheric world details (wind, footsteps, desert dust).
5. ACTIVE DIALOGUE & MINIMAL VOICE-OVER:
   - Characters speak with active, authentic dialogue carrying tension and intention (not dry lectures).
   - Narrator voice-over is MINIMAL, poetic, and atmospheric. NEVER narrate what the audience can already see on screen.
6. INTEGRATED SOUND DESIGN:
   - Every scene features specific sound effects (SFX) and background music (BGM) cues to maximize immersion.`;

/**
 * Recommends an optimal SceneTone based on the scene's semantic context.
 */
export function recommendSceneTone(scene: {
  title?: string;
  event?: string;
  story_purpose?: string;
  emotional_objective?: string;
  narrative_function?: string;
}): SceneTone {
  const combined = `${scene.title || ''} ${scene.event || ''} ${scene.story_purpose || ''} ${scene.emotional_objective || ''} ${scene.narrative_function || ''}`.toLowerCase();

  // 1. Battle / War / Action
  if (
    combined.includes('perang') ||
    combined.includes('battle') ||
    combined.includes('serangan') ||
    combined.includes('attack') ||
    combined.includes('tempur') ||
    combined.includes('pasukan') ||
    combined.includes('pedang') ||
    combined.includes('sword') ||
    combined.includes('benteng') ||
    combined.includes('pengepungan') ||
    combined.includes('badr') ||
    combined.includes('uhud') ||
    combined.includes('khandaq') ||
    combined.includes('hunain') ||
    combined.includes('mutah') ||
    combined.includes('tabuk') ||
    combined.includes('action')
  ) {
    return { ...TONE_PRESETS.ACTION, is_ai_recommended: true };
  }

  // 2. Tense / Threat / Hijrah / Ambush / Pursuit
  if (
    combined.includes('hijrah') ||
    combined.includes('pengejaran') ||
    combined.includes('ancaman') ||
    combined.includes('threat') ||
    combined.includes('konspirasi') ||
    combined.includes('pembunuhan') ||
    combined.includes('darun nadwah') ||
    combined.includes('jebakan') ||
    combined.includes('mencekam') ||
    combined.includes('tense') ||
    combined.includes('bahaya') ||
    combined.includes('pelarian') ||
    combined.includes('terkepung') ||
    combined.includes('intai')
  ) {
    return { ...TONE_PRESETS.TENSE, is_ai_recommended: true };
  }

  // 3. Loss / Grief / Demise / Martyrdom
  if (
    combined.includes('wafat') ||
    combined.includes('demise') ||
    combined.includes('meninggal') ||
    combined.includes('gugur') ||
    combined.includes('syahid') ||
    combined.includes('duka') ||
    combined.includes('grief') ||
    combined.includes('tangis') ||
    combined.includes('kehilangan') ||
    combined.includes('perpisahan') ||
    combined.includes('wada') ||
    combined.includes('tragis') ||
    combined.includes('khadijah') ||
    combined.includes('abu thalib') ||
    combined.includes('hamzah') ||
    combined.includes('tahun duka')
  ) {
    return { ...TONE_PRESETS.TRAGIC, is_ai_recommended: true };
  }

  // 4. Victory / Triumph / Fathul Makkah / Grand Treaty
  if (
    combined.includes('kemenangan') ||
    combined.includes('victory') ||
    combined.includes('triumph') ||
    combined.includes('fathul makkah') ||
    combined.includes('pembebasan') ||
    combined.includes('baiat') ||
    combined.includes('kejayaan') ||
    combined.includes('keberhasilan') ||
    combined.includes('hudaybiyah') ||
    combined.includes('megah')
  ) {
    return { ...TONE_PRESETS.TRIUMPHANT, is_ai_recommended: true };
  }

  // 5. Mystery / Revelation / Cave Hira / Vision
  if (
    combined.includes('wahyu') ||
    combined.includes('revelation') ||
    combined.includes('gua hira') ||
    combined.includes('hira') ||
    combined.includes('misteri') ||
    combined.includes('malaikat') ||
    combined.includes('jibril') ||
    combined.includes('isra') ||
    combined.includes('miraj') ||
    combined.includes('malam') ||
    combined.includes('tanda-tanda') ||
    combined.includes('penglihatan')
  ) {
    return { ...TONE_PRESETS.MYSTERIOUS, is_ai_recommended: true };
  }

  // 6. Birth / Childhood / Early Dawn / Serenity
  if (
    combined.includes('lahir') ||
    combined.includes('birth') ||
    combined.includes('maulid') ||
    combined.includes('fajar') ||
    combined.includes('damai') ||
    combined.includes('peace') ||
    combined.includes('madinah') ||
    combined.includes('piagam') ||
    combined.includes('persaudaraan') ||
    combined.includes('solemn') ||
    combined.includes('khidmat')
  ) {
    return { ...TONE_PRESETS.SOLEMN, is_ai_recommended: true };
  }

  // 7. Contemplative default for reflective dialogues / journey
  return { ...TONE_PRESETS.CONTEMPLATIVE, is_ai_recommended: true };
}

/**
 * Resolves a complete SceneTone for a given scene, respecting explicit values or AI recommendation.
 */
export function resolveSceneTone(scene: Scene): SceneTone {
  if (scene.scene_tone && typeof scene.scene_tone.intensity === 'number') {
    return scene.scene_tone;
  }
  return recommendSceneTone(scene);
}

/**
 * Builds the Global Narrative Voice instructions for prompt injection.
 */
export function buildNarrativeVoiceInstruction(
  project?: Project | null,
  language: 'id' | 'en' = 'id'
): string {
  const isIndo = (project?.prompt_language || language) === 'id';
  return isIndo ? GLOBAL_NARRATIVE_DOCTRINE_ID : GLOBAL_NARRATIVE_DOCTRINE_EN;
}

/**
 * Builds the Dynamic Scene Tone instructions for a specific scene.
 */
export function buildSceneToneInstruction(
  scene: Scene,
  customTone?: SceneTone,
  language: 'id' | 'en' = 'id'
): string {
  const tone = customTone || resolveSceneTone(scene);
  const isIndo = language === 'id';

  if (isIndo) {
    let toneGuidance = '';
    if (tone.pacing === 'fast' || tone.intensity >= 70) {
      toneGuidance = `Pacing CEPAT & Intensitas TINGGI (${tone.intensity}/100, Tension: ${tone.dramatic_tension}/100, Atmosfer: ${tone.atmosphere}).
- Tampilkan momentum dramatis yang bergejolak, keputusan cepat, pergerakan dinamis, dan ketegangan nyata.
- Pada adegan perang/aksi: gambarkan formasi barisan, deru langkah, benturan taktis, dan hembusan debu gurun dengan ketajaman sinematik tinggi.
- TETAP PATUHI ADAB: JANGAN gunakan gore berlebihan, glorifikasi kekerasan membabi buta, atau gaya bahasa pahlawan komik fiksi.`;
    } else if (tone.pacing === 'slow' || tone.emotional_weight >= 70) {
      toneGuidance = `Pacing LAMBAT & Bobot Emosional MENDALAM (${tone.emotional_weight}/100, Intensitas: ${tone.intensity}/100, Atmosfer: ${tone.atmosphere}).
- Berikan ruang jeda reflektif, suasana hening yang sarat makna, resonansi lingkungan, dan ekspresi batin yang terkendali.
- Pada adegan duka/wafat: hadirkan keheningan mendalam, tatapan penuh arti, dan rasa kehilangan yang terhormat tanpa jeritan histeris melodramatis.`;
    } else {
      toneGuidance = `Pacing SEDANG & Keseimbangan Dramatis (${tone.intensity}/100, Bobot Emosional: ${tone.emotional_weight}/100, Atmosfer: ${tone.atmosphere}).
- Hadirkan alur penceritaan yang mengalir alami, artikulasi dialog/peristiwa yang berwibawa, dan atmosfer lingkungan yang hidup.`;
    }

    return `=== DYNAMIC SCENE TONE INSTRUCTION ===
Parameter Tone Scene #${scene.scene_number} ("${scene.title}"):
- Intensity: ${tone.intensity}/100
- Emotional Weight: ${tone.emotional_weight}/100
- Dramatic Tension: ${tone.dramatic_tension}/100
- Pacing: ${tone.pacing.toUpperCase()}
- Atmosphere: ${tone.atmosphere.toUpperCase()}
- Preset Basis: ${tone.preset || 'CUSTOM'}

Pedoman Khusus Tone:
${toneGuidance}
======================================`;
  }

  let toneGuidanceEn = '';
  if (tone.pacing === 'fast' || tone.intensity >= 70) {
    toneGuidanceEn = `FAST Pacing & HIGH Intensity (${tone.intensity}/100, Tension: ${tone.dramatic_tension}/100, Atmosphere: ${tone.atmosphere}).
- Convey urgent dramatic momentum, decisive swift actions, dynamic blocking, and authentic tension.
- In battle/action scenes: detail tactical troop movements, charging ranks, and dust storms with sharp cinematic precision.
- STRICT ADAB ENFORCED: NO gratuitous gore, no violence glorification, and no cartoonish superhero tropes.`;
  } else if (tone.pacing === 'slow' || tone.emotional_weight >= 70) {
    toneGuidanceEn = `SLOW Pacing & DEEP Emotional Weight (${tone.emotional_weight}/100, Intensity: ${tone.intensity}/100, Atmosphere: ${tone.atmosphere}).
- Allow reflective pauses, quiet atmospheric resonance, and dignified emotional restraint.
- In scenes of grief/loss: emphasize profound silence, meaningful gazes, and noble solemnity without histrionic screaming.`;
  } else {
    toneGuidanceEn = `BALANCED Pacing & Dramatic Equilibrium (${tone.intensity}/100, Emotional Weight: ${tone.emotional_weight}/100, Atmosphere: ${tone.atmosphere}).
- Ensure smooth narrative progression, dignified historical weight, and rich environmental grounding.`;
  }

  return `=== DYNAMIC SCENE TONE INSTRUCTION ===
Scene Tone Parameters #${scene.scene_number} ("${scene.title}"):
- Intensity: ${tone.intensity}/100
- Emotional Weight: ${tone.emotional_weight}/100
- Dramatic Tension: ${tone.dramatic_tension}/100
- Pacing: ${tone.pacing.toUpperCase()}
- Atmosphere: ${tone.atmosphere.toUpperCase()}
- Preset: ${tone.preset || 'CUSTOM'}

Tone Guidance:
${toneGuidanceEn}
======================================`;
}

export interface NarrativeValidationResult {
  valid: boolean;
  violations: string[];
  correctivePrompt?: string;
}

// Prohibited terms that violate historical adab, dignity, or narrative authenticity
const BANNED_SLANG_OR_CASUAL_PATTERNS = [
  /\b(baper|alay|wkwk|kepo|guys|bro|sis|cuy|anjir|gila\s*sih|mantul|auto\s*menang|auto\s*viral|kocak|cinderella|ibu\s*peri|tongkat\s*sihir|superhero|superpower|villain)\b/i,
  /\b(pada\s*suatu\s*hari\s*di\s*negeri\s*dongeng|once\s*upon\s*a\s*time\s*in\s*a\s*magical\s*land)\b/i,
  /\b(bikin\s*shock|plot\s*twist\s*gila|kamu\s*tidak\s*akan\s*percaya|kejadian\s*mencengangkan)\b/i,
];

/**
 * Validates text output to ensure compliance with Global Narrative Voice & Adab.
 * Does NOT suppress valid high-intensity action language (e.g. medan perang, pedang, debu, kepungan).
 */
export function validateNarrativeStyle(
  output: string,
  language: 'id' | 'en' = 'id'
): NarrativeValidationResult {
  if (!output || typeof output !== 'string') {
    return { valid: true, violations: [] };
  }

  const violations: string[] = [];

  for (const pattern of BANNED_SLANG_OR_CASUAL_PATTERNS) {
    const match = output.match(pattern);
    if (match) {
      violations.push(`Terdeteksi istilah atau gaya bahasa tidak bermartabat/terlarang: "${match[0]}"`);
    }
  }

  if (violations.length > 0) {
    const isIndo = language === 'id';
    const correctivePrompt = isIndo
      ? `PERBAIKAN WAJIB ADAB & NARRATIVE VOICE:
Teks yang dihasilkan mengandung elemen gaya bahasa yang melanggar doktrin adab & martabat sirah:
${violations.map((v) => `- ${v}`).join('\n')}

Instruksi Perbaikan:
1. Ganti semua istilah slang/dongeng/superhero/sensasional dengan bahasa Indonesia formal, bermartabat, dan sinematik.
2. Pertahankan fakta sejarah dan bobot dramatis tanpa mengubah konteks adegan.
3. Tetap sesuaikan intensitas, pacing, dan atmosfer adegan.`
      : `MANDATORY NARRATIVE VOICE & ADAB CORRECTION:
The generated text violates sacred historical dignity and narrative voice principles:
${violations.map((v) => `- ${v}`).join('\n')}

Correction Guidelines:
1. Replace all slang, fairytale, superhero, or sensational tropes with dignified, cinematic prose.
2. Preserve authentic historical fidelity and emotional tone.`;

    return {
      valid: false,
      violations,
      correctivePrompt,
    };
  }

  return {
    valid: true,
    violations: [],
  };
}
