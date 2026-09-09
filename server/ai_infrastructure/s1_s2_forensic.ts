import 'dotenv/config';
import fs from 'node:fs';
import { runStage1StoryUnderstanding } from '../stages/stage1_story_understanding';
import { runStage2CharacterDetection } from '../stages/stage2_character_detection';

const source = fs.readFileSync(new URL('./e2e_12scene_runtime_proof.ts', import.meta.url), 'utf8');
const screenplay = source.match(/const screenplay = `([\\s\\S]*?)`;/)?.[1];
if (!screenplay) throw new Error('Screenplay not found');

const started = Date.now();
console.log('FORENSIC_START', new Date().toISOString());
const s1 = await runStage1StoryUnderstanding({ rawScript: screenplay, language: 'id' });
console.log('S1_RETURNED_MS', Date.now() - started);
console.log('S1_SHAPE', JSON.stringify(s1, null, 2));
console.log('S1_REQUIRED_FIELDS', ['era','theme','genre','timeline','main_characters','supporting_characters','locations','main_conflict','emotional_arc','narrative_arc','visual_tone']);
console.log('S1_PRESENT_FIELDS', Object.keys(s1));
const s2Start = Date.now();
console.log('S2_START', new Date().toISOString());
const s2 = await runStage2CharacterDetection({ rawScript: screenplay, foundation: s1, language: 'id' });
console.log('S2_RETURNED_MS', Date.now() - s2Start);
console.log('S2_SHAPE', JSON.stringify(s2, null, 2));
console.log('FORENSIC_DONE_MS', Date.now() - started);
