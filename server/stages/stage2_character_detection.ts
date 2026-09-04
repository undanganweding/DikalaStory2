import { executeTask, safeParseJSON } from '../llm_provider';
import { Type } from '../gemini';
import { CharacterBible, ContextPackage, ProjectFoundation, ReasoningConfig } from '../../src/types';

export interface Stage2CharacterDetectionInput {
  rawScript: string;
  foundation: Omit<ProjectFoundation, 'id' | 'project_id' | 'updated_at'>;
  contextPackage?: ContextPackage | null;
  language: 'id' | 'en';
  model?: string;
  reasoningConfig?: ReasoningConfig;
}

export type DetectedCharacter = Omit<
  CharacterBible,
  'id' | 'project_id' | 'version' | 'created_at' | 'updated_at'
>;

export async function runStage2CharacterDetection(
  input: Stage2CharacterDetectionInput
): Promise<DetectedCharacter[]> {
  const isIndo = input.language === 'id';

  const groundingContext = input.contextPackage ? JSON.stringify(input.contextPackage, null, 2) : 'No grounding context available.';
  const systemInstruction = isIndo
    ? `Anda adalah Casting Director & Character Bible Architect untuk produksi film sinematik.
Tugas Anda: Deteksi dan buat profil mendalam (Character Bible) untuk SEMUA karakter utama dan pendukung yang muncul atau teridentifikasi dalam naskah.
Penting: Berikan detail fisik, pakaian, aksesori, rambut, janggut, gaya suara, dan gaya gerak tubuh yang sangat spesifik dan konsisten untuk produksi film.

=== DOKTRIN KHUSUS TOKOH TERHORMAT (SUNAN, WALI, WALIYULLAH, KYAI, HABIB, ULAMA, SYEKH, NABI) ===
1. DILARANG KERAS memberikan pakaian santai/kaos oblong/pakaian desa murahan/kusam untuk tokoh-tokoh terhormat seperti Sunan, Wali, Waliyullah, Kyai, Habib, Ulama, Syekh, atau Nabi.
2. Untuk Tokoh Islam / Sufi / Wali / Kyai / Habib / Ulama / Syekh / Nabi:
   - Pakaian (clothing): Sorban/Imamah berlapis (putih, hijau, atau krem) yang terikat anggun di kepala dengan kain juntaian, Jubah/Abaya/Bisht/Gamis Sufi berkualitas tinggi, selendang bahu (Rida'), serta tunik dalam yang bersih.
   - Penampilan Fisik: Wajah kharismatik penuh wibawa suci, aura spiritual & tawadhu', mata bijaksana, jenggot rapi & terawat (honorable beard), memegang tasbih jika relevan.
3. Untuk Tokoh Wali Jawa / Sunan (contoh: Sunan Kalijaga atau Wali berbusana Jawa):
   - Pakaian (clothing): Busana Wali Jawa terhormat (Surjan Lurik Demak/Mataram atau Baju Taqwa Wali), Blangkon Jawi tradisional dengan lipatan rapi, kain Jarik Batik motif klasik, stagen pinggang.
   - Penampilan Fisik: Wibawa tinggi khas bangsawan Wali Jawa, kumis/jenggot rapi, tatapan tajam nan bijaksana, postur tegap nan tenang.
4. Jika karakter tidak memiliki janggut atau tidak relevan, tulis "None" atau "Tidak ada". face_identity_locked default adalah false.`
    : `You are a Hollywood Casting Director & Character Bible Architect for cinematic film productions.
Your task: Detect and generate comprehensive Character Bibles for ALL main and supporting characters in the script.
Provide ultra-specific physical, wardrobe, facial, vocal, and body language traits that maintain strict production continuity.

=== REVERED HOLY FIGURE DOCTRINE (SUNAN, WALI, WALIYULLAH, KYAI, HABIB, ULAMA, SHEIKH, PROPHET) ===
1. STRICTLY FORBIDDEN to assign casual t-shirts, limp undershirts, cheap peasant wear, or daily villager rags to revered figures like Sunan, Wali, Waliyullah, Kyai, Habib, Ulama, Sheikh, or Prophets.
2. For Islamic Sufi Saints / Wali / Kyai / Habib / Ulama / Sheikh / Prophets:
   - Wardrobe (clothing): Draped layered Islamic Sufi Turban (Imamah / Sorban in white, green, or cream cloth), noble outer Robe (Jubah / Abaya / Bisht / Gamis Sufi of fine textile), draped shoulder shawl (Rida'), and clean inner tunic.
   - Physical Traits: Dignified charismatic face, serene radiant aura of spiritual wisdom and tawadhu', well-groomed honorable beard, holding prayer beads (tasbih) when appropriate.
3. For Javanese Wali / Sunan (e.g., Sunan Kalijaga style):
   - Wardrobe (clothing): Authentic Javanese noble Wali costume (Surjan Lurik Demak/Mataram or Baju Taqwa), traditional Blangkon Jawi headgear, fine Jarik Batik sarong skirt, waist sash.
   - Physical Traits: Stately Javanese noble authority, neat moustache and trim beard, regal charismatic posture.
4. If beard is not applicable, write "None". face_identity_locked defaults to false.`;
  const groundedSystemInstruction = `${systemInstruction}\n\nGROUNDING CONTEXT:\n${groundingContext}`;

  const prompt = `Analisis naskah dan Story Understanding berikut untuk membangun Character Bible:

=== STORY FOUNDATION ===
Era: ${input.foundation.era}
Genre: ${input.foundation.genre}
Theme: ${input.foundation.theme}
Main Characters: ${input.foundation.main_characters.join(', ')}
Supporting Characters: ${input.foundation.supporting_characters.join(', ')}
Visual Tone: ${input.foundation.visual_tone}

=== RAW SCRIPT / STORYBOARD ===
${input.rawScript}
===============================`;

  const responseSchema = {
    type: Type.ARRAY,
    description: 'Array of detected characters with complete production bible profiles',
    items: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Full character name' },
        age: { type: Type.STRING, description: 'Apparent or stated age (e.g., 34 years old, Early 20s)' },
        gender: { type: Type.STRING, description: 'Gender identity / presentation' },
        physical_appearance: {
          type: Type.STRING,
          description: 'Detailed build, height, skin tone, facial features, distinctive marks/scars',
        },
        face_identity_locked: {
          type: Type.BOOLEAN,
          description: 'Whether actor facial consistency lock is enabled (default false)',
        },
        hair: {
          type: Type.STRING,
          description: 'Hair color, length, styling, texture (e.g., Jet black slicked pompadour, Messy silver curls)',
        },
        beard: {
          type: Type.STRING,
          description: 'Facial hair style or "None" / "Clean shaven"',
        },
        clothing: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Key wardrobe items, fabric texture, style, wear condition',
        },
        accessories: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Signature accessories (e.g., antique bronze watch, neon visor, tactical gloves)',
        },
        personality: {
          type: Type.STRING,
          description: 'Core psychological profile, temperament, and character motivations',
        },
        voice_character: {
          type: Type.STRING,
          description: 'Vocal timbre, cadence, pitch, accent, and speech rhythm',
        },
        movement_style: {
          type: Type.STRING,
          description: 'Body language, posture, gait, tempo of physical gestures',
        },
      },
      required: [
        'name',
        'age',
        'gender',
        'physical_appearance',
        'face_identity_locked',
        'hair',
        'beard',
        'clothing',
        'accessories',
        'personality',
        'voice_character',
        'movement_style',
      ],
    },
  };

  const response = await executeTask({
    taskId: 'character_analysis',
    stageCode: 'S2',
    prompt,
    systemInstruction: groundedSystemInstruction,
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
    throw new Error('Stage 2 failed: LLM provider returned an empty response.');
  }

  const parsed = safeParseJSON(response.text) as DetectedCharacter[];
  return parsed;
}
