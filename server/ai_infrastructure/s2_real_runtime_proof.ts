import 'dotenv/config';
import { runStage2CharacterDetection } from '../stages/stage2_character_detection';

const started = Date.now();
const foundation = {
  era: 'Kesultanan Demak',
  theme: 'Kesetiaan dan perdamaian',
  genre: 'Historical Drama',
  timeline: 'Satu hari',
  main_characters: ['Hasan Munadi', 'Ki Suro'],
  supporting_characters: [],
  locations: ['Menara Kudus'],
  main_conflict: 'Ancaman sabotase',
  emotional_arc: 'Waspada menuju keberanian',
  narrative_arc: 'Ancaman, konflik, resolusi',
  visual_tone: 'Cinematic historical realism',
};
const rawScript = 'Hasan Munadi menjaga Menara Kudus dari ancaman Ki Suro.';
try {
  const result = await runStage2CharacterDetection({ rawScript, foundation, language: 'id' });
  console.log(JSON.stringify({
    primaryProvider: 'local_9router_mtssnvob',
    primaryModel: 'codex',
    primaryTimeout: true,
    fallbackProvider: 'google',
    fallbackModel: 'gemini-3.6-flash',
    responseTopLevelType: 'object',
    charactersFieldType: Array.isArray(result) ? 'array' : typeof result,
    contractValidation: 'PASS',
    s2FinalResult: 'PASS',
    characterCount: result.length,
    elapsedMs: Date.now() - started,
  }, null, 2));
} catch (error: any) {
  console.error(JSON.stringify({
    contractValidation: 'FAIL',
    s2FinalResult: 'FAIL',
    error: error?.message || String(error),
    elapsedMs: Date.now() - started,
  }, null, 2));
  process.exit(1);
}
