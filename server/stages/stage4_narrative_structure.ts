import { executeTask, safeParseJSON } from '../llm_provider';
import { Type } from '../gemini';
import { CharacterBible, ContextPackage, LocationBible, NarrativeBeats, ProjectFoundation, ReasoningConfig } from '../../src/types';
import { buildNarrativeVoiceInstruction } from '../narrative_tone';
import { determineNarrativeStrategy } from '../narrative_strategy_engine';

export interface Stage4NarrativeStructureInput {
  rawScript: string;
  foundation: Omit<ProjectFoundation, 'id' | 'project_id' | 'updated_at'>;
  characters: CharacterBible[];
  locations: LocationBible[];
  contextPackage?: ContextPackage | null;
  language: 'id' | 'en';
  model?: string;
  reasoningConfig?: ReasoningConfig;
}

export async function runStage4NarrativeStructure(
  input: Stage4NarrativeStructureInput
): Promise<NarrativeBeats> {
  const isIndo = input.language === 'id';
  const narrativeDoctrine = buildNarrativeVoiceInstruction(null, input.language);

  // 1. Dynamic Genre-Aware Narrative Strategy Selection
  const strategy = determineNarrativeStrategy({
    rawScript: input.rawScript,
    foundation: input.foundation,
  });

  const baseInstruction = isIndo
    ? `Anda adalah Master Script Doctor & Narrative Structure Architect perfilman kelas dunia.
Tugas Anda: Mengadaptasi naskah secara holistik menjadi Peta Struktur Naratif Sinematik berdasarkan strategi dramaturgi yang spesifik untuk genre ini.

STRATEGI DRAMATIS TERPILIH:
- Dramatic Arc Archetype: ${strategy.dramatic_arc_type}
- Genre / Subgenre: ${strategy.genre} (${strategy.subgenre})
- Stakes: ${strategy.stakes}
- Pacing Curve: ${strategy.pacing.pacing_curve}
- Ending Strategy: ${strategy.ending_strategy}
- Fungsi Babak: ${strategy.act_functions.join(' -> ')}

PRINSIP KUNCI: "DRAMA FIRST, SHOW DON'T TELL":
1. JANGAN PERNAH membuat teks pasif seperti buku ensiklopedia atau narator ceramah.
2. Setiap babak harus memuat ketegangan visual konkret, aksi fisik, motif karakter, rintangan, dan konsekuensi.
3. Struktur Ending: Ikuti Ending Strategy (${strategy.ending_strategy}). JANGAN memaksakan cliffhanger jika bukan format serial / jika cerita menuntut resolusi, penyingkapan misteri, kejatuhan tragis, atau refleksi spiritual!
${strategy.is_historical_or_sacred ? '4. PENGUNCIAN ADAB & PENGGAMBARAN NABI ﷺ: Wajah Nabi Muhammad ﷺ TIDAK PERNAH digambarkan; jika bayi selalu terbedong rapi tanpa halo supernatural.' : ''}`
    : `You are a world-renowned Master Script Doctor & Narrative Structure Architect.
Your task: Synthesize the full script into a Cinematic Narrative Arc dynamically tailored to its genre dramaturgy.

SELECTED NARRATIVE STRATEGY:
- Dramatic Arc Archetype: ${strategy.dramatic_arc_type}
- Genre / Subgenre: ${strategy.genre} (${strategy.subgenre})
- Stakes: ${strategy.stakes}
- Pacing Curve: ${strategy.pacing.pacing_curve}
- Ending Strategy: ${strategy.ending_strategy}
- Act Functions: ${strategy.act_functions.join(' -> ')}

CORE PRINCIPLE: "DRAMA FIRST, SHOW DON'T TELL":
1. NEVER produce dry textbook summaries or passive encyclopedic voiceover lectures.
2. Every beat must feature tangible visual action, conflict, character agency, obstacles, and consequences.
3. Ending Strategy: Follow the chosen ending strategy (${strategy.ending_strategy}). Do NOT force cliffhangers unless serialized!
${strategy.is_historical_or_sacred ? '4. SACRED REVERENCE & PROPHET DEPICTION LOCK: The Prophet Muhammad ﷺ must NEVER be depicted with facial features; infants are swaddled with no magical halos.' : ''}`;

  const groundingContext = input.contextPackage ? JSON.stringify(input.contextPackage, null, 2) : 'No grounding context available.';
  const systemInstruction = `${baseInstruction}\n\n${narrativeDoctrine}\n\nGROUNDING CONTEXT:\n${groundingContext}`;

  const charSummary = input.characters
    .map((c) => `${c.name} (${c.gender}, ${c.age}): ${c.personality}`)
    .join('\n');

  const locSummary = input.locations
    .map((l) => `${l.name} (${l.era}, ${l.environment}): ${l.lighting_style}`)
    .join('\n');

  const prompt = `Susun Peta Struktur Naratif Sinematik 5-Babak sesuai kaidah dramaturgi genre ${strategy.genre} (${strategy.dramatic_arc_type}):

=== STORY FOUNDATION ===
Era: ${input.foundation.era}
Genre: ${input.foundation.genre}
Theme: ${input.foundation.theme}
Main Conflict: ${input.foundation.main_conflict}
Emotional Arc: ${input.foundation.emotional_arc}
Narrative Arc: ${input.foundation.narrative_arc}
Visual Tone: ${input.foundation.visual_tone}

=== DRAMATURGICAL STRATEGY ===
Arc Type: ${strategy.dramatic_arc_type}
Target Ending: ${strategy.ending_strategy}
Act Movement: ${strategy.act_functions.join(' -> ')}

=== DETECTED CHARACTERS ===
${charSummary || 'None explicitly identified'}

=== DETECTED LOCATIONS ===
${locSummary || 'None explicitly identified'}

=== RAW SCRIPT / STORYBOARD ===
${input.rawScript}
===============================`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      beginning: {
        type: Type.STRING,
        description: `Beginning (Act 1): ${strategy.act_functions[0] || 'Hook & Inciting Incident'}. Immediate dramatic hook, tangible physical stakes, without slow textbook exposition.`,
      },
      development: {
        type: Type.STRING,
        description: `Development (Act 2): ${strategy.act_functions[1] || 'Escalation'}. Deepening conflict, active obstacles, choices, and rising tension towards an unavoidable collision.`,
      },
      climax: {
        type: Type.STRING,
        description: `Climax (Act 3): ${strategy.act_functions[2] || 'Turning Point'}. Point of maximum dramatic tension, bold proclamation, critical decision, or peak revelation.`,
      },
      consequence: {
        type: Type.STRING,
        description: `Consequence (Act 4): ${strategy.act_functions[3] || 'Fallout & Payoff'}. Immediate emotional fallout, character realization, and shifts in relationships or stakes.`,
      },
      ending: {
        type: Type.STRING,
        description: `Ending (Act 5): ${strategy.ending_strategy}. Resonating conclusion matching the strategy (${strategy.ending_strategy}): closure, tragic aftermath, solved mystery, legacy, or serialized cliffhanger.`,
      },
    },
    required: ['beginning', 'development', 'climax', 'consequence', 'ending'],
  };

  const response = await executeTask({
    taskId: 'narrative_structure',
    stageCode: 'S4',
    prompt,
    systemInstruction,
    temperature: 0.3,
    responseSchema,
    maxOutputTokens: 4096,
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
    throw new Error('Stage 4 failed: LLM provider returned an empty response.');
  }

  const parsed = safeParseJSON(response.text) as NarrativeBeats;
  const normalized = normalizeNarrativeBeats(parsed);
  normalized.dramatic_arc_type = strategy.dramatic_arc_type;
  normalized.narrative_strategy = strategy;
  return normalized;
}

export function normalizeNarrativeBeats(beats: NarrativeBeats): NarrativeBeats {
  const cleanField = (text: string): string => {
    if (!text || typeof text !== 'string') return '';
    let cleaned = text.trim();
    // Remove duplicated parentheticals e.g. "(Bagian 1: Pengantar) (Bagian 1: Pengantar)" -> "(Bagian 1: Pengantar)"
    cleaned = cleaned.replace(/\s*\(([^)]+)\)\s*\(\1\)/g, ' ($1)');
    cleaned = cleaned.replace(/\s*\b(Bagian\s+\d+[:\s\w-]+)\b\s*\(\1\)/gi, ' $1');
    // De-duplicate repeated sentences
    const sentences = cleaned.split(/(?<=[.!?])\s+/);
    const uniqueSentences: string[] = [];
    for (const s of sentences) {
      const trimmedS = s.trim();
      if (trimmedS && !uniqueSentences.includes(trimmedS)) {
        uniqueSentences.push(trimmedS);
      }
    }
    return uniqueSentences.join(' ');
  };

  if (!beats) {
    return { beginning: '', development: '', climax: '', consequence: '', ending: '' };
  }

  return {
    beginning: cleanField(beats.beginning),
    development: cleanField(beats.development),
    climax: cleanField(beats.climax),
    consequence: cleanField(beats.consequence),
    ending: cleanField(beats.ending),
  };
}

