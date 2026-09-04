import { executeTask, safeParseJSON } from '../llm_provider';
import { Type } from '../gemini';
import { ContextPackage, ProjectFoundation, ReasoningConfig } from '../../src/types';
import { buildNarrativeVoiceInstruction, validateNarrativeStyle } from '../narrative_tone';

export interface Stage1StoryUnderstandingInput {
  rawScript: string;
  contextPackage?: ContextPackage | null;
  language: 'id' | 'en';
  model?: string;
  reasoningConfig?: ReasoningConfig;
}

export type Stage1Output = Omit<ProjectFoundation, 'id' | 'project_id' | 'updated_at' | 'narrative_beats'>;

export async function runStage1StoryUnderstanding(
  input: Stage1StoryUnderstandingInput
): Promise<Stage1Output> {
  const isIndo = input.language === 'id';
  const narrativeDoctrine = buildNarrativeVoiceInstruction(null, input.language);

  const baseInstruction = isIndo
    ? `Anda adalah Lead Film Director & Story Analyst AI sinematik kelas dunia.
Tugas Anda adalah menganalisis naskah / storyboard mentah dan mengekstrak fondasi cerita sinematik yang komprehensif (Story Bible).
Jika cerita mengandung unsur sejarah, agama/kenabian, atau biografi, wajib lakukan riset/world-understanding secara mendalam:
1. Ekstrak fakta dasar (Kelahiran, Hidup di mana, Musuh/Lawan, Peristiwa penting, Akhir hidup).
2. Buat timeline garis waktu yang logis.
3. Definisikan Konteks Zaman: "Seperti apa dunia saat itu?" Sebutkan elemen modern yang dilarang keras (misal: mobil, smartphone) dan elemen kuno yang wajib ada (misal: benteng batu, kuda, pakaian tradisional zaman itu).
4. Klasifikasikan sumber/referensi ke dalam kategori FACT (fakta kuat), LEGEND (cerita populer), dan UNKNOWN (belum pasti) untuk menjaga kredibilitas kisah sejarah/agama.
5. Bangun Arsitektur Cerita 5 Babak (Act 1: World Setup, Act 2: Human element, Act 3: Rising conflict, Act 4: Climax with breath & silence, Act 5: Legacy/meaning).
6. Tentukan Mode Narasi: 'documentary', 'epic', atau 'emotional'.
7. Berikan jaminan perlindungan khusus jika berupa Kisah Islami (menghormati tokoh suci, tidak mengarang ucapan yang bertentangan dengan sirah).

Gunakan Bahasa Indonesia yang elegan, bermartabat, dan sinematik.`
    : `You are a world-class Cinematic Lead Film Director & Narrative Analyst AI.
Your task is to analyze raw scripts or storyboards and extract a comprehensive cinematic story foundation (Story Bible).
If the story contains historical, religious, or biographical motifs, you must perform deep world understanding research:
1. Extract basic facts (subject, birth, places lived, enemies, key events, end of life).
2. Create a logical timeline.
3. Define Era Context: Identify modern slop elements to forbid and period-accurate things to allow (e.g. stone fortresses, horses, old markets).
4. Classify sources into FACT, LEGEND, and UNKNOWN to separate historical data from popular folklore.
5. Create a 5-Act Architect (Act 1: World Setup, Act 2: Human element, Act 3: Rising conflict, Act 4: Climax with breath/silence contrast, Act 5: Legacy/meaning).
6. Determine the narrative mode ('documentary', 'epic', or 'emotional').
7. Apply special Islamic reverence safeguards if applicable (respecting sacred figures, forbidden dialogue safety).

Output in English/Indonesian as appropriate with high narrative dignity.`;

  const groundingContext = input.contextPackage ? JSON.stringify(input.contextPackage, null, 2) : 'No grounding context available.';
  const systemInstruction = `${baseInstruction}\n\n${narrativeDoctrine}\n\nGROUNDING CONTEXT:\n${groundingContext}`;

  const prompt = `Lakukan analisis mendalam (Story Understanding & Story Bible Generation) pada naskah/storyboard berikut:\n\n=== RAW SCRIPT / STORYBOARD ===\n${input.rawScript}\n===============================`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      era: {
        type: Type.STRING,
        description: 'The historical or futuristic era/period of the story (e.g., Cyberpunk 2088, Victorian 1890, Modern Urban 2026, Feudal Nusantara)',
      },
      theme: {
        type: Type.STRING,
        description: 'Core thematic motifs (e.g., Sacrifice vs Ambition, Man vs Artificial Consciousness, Redemption)',
      },
      genre: {
        type: Type.STRING,
        description: 'Cinematic genre (e.g., Neo-Noir Sci-Fi Thriller, Psychological Drama, Epic Historical Fantasy)',
      },
      timeline: {
        type: Type.STRING,
        description: 'Story timeline scope (e.g., 24 hours of intense chase, A single fateful rainy evening, Multi-year chronicle)',
      },
      main_characters: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'List of key protagonist/antagonist names',
      },
      supporting_characters: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'List of supporting character names or notable figures',
      },
      locations: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Key cinematic environments and sets mentioned or implied',
      },
      main_conflict: {
        type: Type.STRING,
        description: 'The central dramatic conflict driving the plot and tension',
      },
      emotional_arc: {
        type: Type.STRING,
        description: 'The trajectory of emotional resonance and psychological shifts throughout the piece',
      },
      narrative_arc: {
        type: Type.STRING,
        description: 'The dramatic narrative structure from inciting incident to climax and resolution',
      },
      visual_tone: {
        type: Type.STRING,
        description: 'Cinematic visual direction, mood, color palette atmosphere, and lighting aesthetics (e.g., Desaturated anamorphic tones, high-contrast chiaroscuro, neon rain reflections)',
      },
      is_historical_religious_biography: {
        type: Type.BOOLEAN,
        description: 'True if the story is about historical figures (e.g., Salahuddin, WWII), religion/prophets (e.g., Nabi Yusuf), or real biography.',
      },
      research_basic_facts: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          birth_info: { type: Type.STRING },
          places_lived: { type: Type.STRING },
          opponents_enemies: { type: Type.STRING },
          key_events: { type: Type.ARRAY, items: { type: Type.STRING } },
          end_of_life: { type: Type.STRING },
        },
      },
      research_timeline: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            time_marker: { type: Type.STRING },
            event_description: { type: Type.STRING },
          },
        },
      },
      research_era_context: {
        type: Type.OBJECT,
        properties: {
          century_era: { type: Type.STRING },
          forbidden_elements: { type: Type.ARRAY, items: { type: Type.STRING } },
          allowed_elements: { type: Type.ARRAY, items: { type: Type.STRING } },
          technology_weapons: { type: Type.STRING },
          clothing_costumes: { type: Type.STRING },
        },
      },
      research_sources: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            source_name: { type: Type.STRING },
            category: { type: Type.STRING, description: 'Must be FACT, LEGEND, or UNKNOWN' },
            description: { type: Type.STRING },
          },
        },
      },
      act_1_world_setup: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          visual_guide: { type: Type.STRING },
          audio_guide: { type: Type.STRING },
        },
      },
      act_2_human_element: {
        type: Type.OBJECT,
        properties: {
          character_focus: { type: Type.STRING },
          internal_feelings: { type: Type.STRING },
          early_education_struggle: { type: Type.STRING },
        },
      },
      act_3_rising_conflict: {
        type: Type.OBJECT,
        properties: {
          tension_type: { type: Type.STRING },
          tempo_visual_note: { type: Type.STRING },
          tempo_audio_note: { type: Type.STRING },
        },
      },
      act_4_climax_breath: {
        type: Type.OBJECT,
        properties: {
          silent_before_climax: { type: Type.STRING },
          climax_impact: { type: Type.STRING },
          audio_contrast_guide: { type: Type.STRING },
        },
      },
      act_5_legacy_meaning: {
        type: Type.OBJECT,
        properties: {
          deeper_meaning: { type: Type.STRING },
          message_for_posterity: { type: Type.STRING },
        },
      },
      narrative_style_mode: {
        type: Type.STRING,
        description: 'Must be documentary, epic, or emotional',
      },
      islamic_validation_safeguard: {
        type: Type.OBJECT,
        properties: {
          fact_validation_notes: { type: Type.STRING },
          reverence_protocol_applied: { type: Type.BOOLEAN },
          forbidden_dialogue_safeguards: { type: Type.STRING },
        },
      },
    },
    required: [
      'era',
      'theme',
      'genre',
      'timeline',
      'main_characters',
      'supporting_characters',
      'locations',
      'main_conflict',
      'emotional_arc',
      'narrative_arc',
      'visual_tone',
    ],
  };

  const response = await executeTask({
    taskId: 'story_analysis',
    stageCode: 'S1',
    prompt,
    systemInstruction,
    temperature: 0.3,
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
    throw new Error('Stage 1 failed: LLM provider returned an empty response.');
  }

  const parsed = safeParseJSON(response.text) as Partial<Stage1Output> | null;
  return {
    era: parsed?.era || 'Unknown Era',
    theme: parsed?.theme || 'General Theme',
    genre: parsed?.genre || 'Cinematic Drama',
    timeline: parsed?.timeline || 'Linear Timeline',
    main_characters: Array.isArray(parsed?.main_characters) ? parsed.main_characters : ['Protagonist'],
    supporting_characters: Array.isArray(parsed?.supporting_characters) ? parsed.supporting_characters : [],
    locations: Array.isArray(parsed?.locations) ? parsed.locations : ['Main Location'],
    main_conflict: parsed?.main_conflict || 'Dramatic conflict',
    emotional_arc: parsed?.emotional_arc || 'Transformation and growth',
    narrative_arc: parsed?.narrative_arc || 'Inciting incident, rising action, climax, resolution',
    visual_tone: parsed?.visual_tone || 'Cinematic panavision 35mm film grain',
    
    is_historical_religious_biography: parsed?.is_historical_religious_biography || false,
    research_basic_facts: parsed?.research_basic_facts,
    research_timeline: parsed?.research_timeline,
    research_era_context: parsed?.research_era_context,
    research_sources: parsed?.research_sources,
    
    act_1_world_setup: parsed?.act_1_world_setup,
    act_2_human_element: parsed?.act_2_human_element,
    act_3_rising_conflict: parsed?.act_3_rising_conflict,
    act_4_climax_breath: parsed?.act_4_climax_breath,
    act_5_legacy_meaning: parsed?.act_5_legacy_meaning,
    narrative_style_mode: parsed?.narrative_style_mode,
    islamic_validation_safeguard: parsed?.islamic_validation_safeguard,
  };
}
