import { runStage4NarrativeStructure } from './stages/stage4_narrative_structure';
import { runStage5SceneBreakdownAttempt } from './stages/stage5_scene_breakdown';
import { CharacterBible, LocationBible, ProjectFoundation } from '../src/types';

async function testCinematicStorytellingRework() {
  console.log('=== TEST & PROVE: DIKALASTORY CINEMATIC STORYTELLING REWORK ===\n');

  const testScript = `Setelah kelahiran Nabi Muhammad ﷺ dan jamuan yang dilakukan Abdul Muttalib, cerita berlanjut pada saat Abdul Muttalib menerima kabar kelahiran, melihat cucunya, membawanya ke Ka'bah, kemudian memberi nama Muhammad, sebelum pencarian ibu susuan dimulai. Para pembesar Quraisy heran karena nama itu asing bagi mereka.`;

  const foundation: Omit<ProjectFoundation, 'id' | 'project_id' | 'updated_at'> = {
    era: 'Makkah Abad ke-6',
    theme: 'Kelahiran Yang Terpuji',
    genre: 'Sejarah Islam / Sinematik',
    timeline: 'Hari-hari awal kelahiran Nabi Muhammad ﷺ',
    main_characters: ['Abdul Muttalib', 'Aminah'],
    supporting_characters: ['Pembesar Quraisy', 'Halimah as-Sa\'diyah'],
    locations: ['Rumah Aminah', 'Pelataran Ka\'bah'],
    main_conflict: 'Pemberian nama Muhammad yang asing bagi tradisi Quraisy',
    emotional_arc: 'Dari haru dan takzim menjadi keheranan dan rasa ingin tahu',
    narrative_arc: 'Kabar kelahiran -> Melihat bayi -> Membawa ke Ka\'bah -> Pemberian nama -> Keheranan Quraisy -> Pencarian ibu susuan',
    visual_tone: 'Cinematic golden light Makkah kuno',
  };

  const characters = [
    {
      id: 'c1',
      name: 'Abdul Muttalib',
      gender: 'MALE',
      age: 70,
      personality: 'Wibawa, penuh kasih sayang, pemimpin terhormat Quraisy',
      physical_appearance: 'Pria tua berjanggut putih terawat, sorot mata teduh dan tegas',
      clothing: 'Jubah wol khas bangsawan Quraisy warna krem',
      role: 'PROTAGONIST',
      face_identity_locked: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c2',
      name: 'Aminah',
      gender: 'FEMALE',
      age: 20,
      personality: 'Lembut, anggun, tabah',
      physical_appearance: 'Wanita muda dengan raut wajah teduh bersahaja',
      clothing: 'Pakaian tertutup sopan warna tanah',
      role: 'SUPPORTING',
      face_identity_locked: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ] as unknown as CharacterBible[];

  const locations = [
    {
      id: 'l1',
      name: 'Rumah Aminah',
      era: 'Abad ke-6 M',
      environment: 'Interior rumah tanah liat tradisional Makkah kuno',
      lighting_style: 'Warm natural morning sunlight through fabric curtain',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'l2',
      name: 'Pelataran Ka\'bah',
      era: 'Abad ke-6 M',
      environment: 'Area terbuka berbatu sekitar Ka\'bah kuno',
      lighting_style: 'Terik matahari Makkah, bayangan tajam',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ] as unknown as LocationBible[];

  console.log('[1/2] Generating Stage 4 Narrative Structure with 6-Beat Cinematic Tone...');
  const s4Result = await runStage4NarrativeStructure({
    rawScript: testScript,
    foundation,
    characters,
    locations,
    language: 'id',
  });

  console.log('✓ Stage 4 Result:');
  console.log('  Beginning (Hook & Context):', s4Result.beginning.substring(0, 90) + '...');
  console.log('  Development (Escalation):', s4Result.development.substring(0, 90) + '...');
  console.log('  Climax (Turning Point):', s4Result.climax.substring(0, 90) + '...');
  console.log('  Consequence (Payoff 1):', s4Result.consequence.substring(0, 90) + '...');
  console.log('  Ending (Payoff 2 / Cliffhanger):', s4Result.ending.substring(0, 90) + '...');

  console.log('\n[2/2] Generating Stage 5 Scene Breakdown with Cinematic Contracts...');
  const scenes = await runStage5SceneBreakdownAttempt({
    narrativeBeats: s4Result,
    totalDurationTargetSec: 150,
    maxSceneDurationSec: 30,
    language: 'id',
    characterRoster: ['Abdul Muttalib', 'Aminah'],
    locationRoster: ['Rumah Aminah', 'Pelataran Ka\'bah'],
  });

  console.log(`✓ Stage 5 Generated ${scenes.length} Scenes (Total: ${scenes.reduce((acc, s) => acc + s.duration_sec, 0)}s):`);

  let passedAllChecks = true;

  scenes.forEach((sc, i) => {
    console.log(`\n------------------------------------------------------------`);
    console.log(`SCENE #${sc.scene_number} [${sc.scene_pattern || 'MISSING'}]: ${sc.title} (${sc.duration_sec}s)`);
    console.log(`- Narrative Function : ${sc.narrative_function}`);
    console.log(`- Visual Action (Show): ${sc.visual_action || 'MISSING'}`);
    console.log(`- Characters         : ${(sc.character_names || []).join(', ')}`);
    console.log(`- Dialogue Lines     : ${(sc.dialogue || []).length} lines`);
    (sc.dialogue || []).forEach((d: any) => {
      console.log(`    ↳ [${d.character_name}] "${d.line}" (Delivery: ${d.delivery || '-'}, Subtext: ${d.emotional_subtext || '-'})`);
    });
    console.log(`- Narrator VO        : ${sc.narrator_vo ? `"${sc.narrator_vo}"` : '(Minimal / None)'}`);
    console.log(`- Sound Design       : SFX=[${(sc.sound_design?.sfx || []).join(', ')}], BGM="${sc.sound_design?.bgm_mood || ''}"`);
    console.log(`- Historical Tier    : ${sc.historical_integrity?.tier || 'MISSING'} (${sc.historical_integrity?.basis || ''})`);
    console.log(`- Prophet Safeguard  : Present=${Boolean(sc.prophet_depiction_safeguard?.is_prophet_present)}, Rule="${sc.prophet_depiction_safeguard?.visual_rule || ''}"`);

    // Validations:
    if (!sc.scene_pattern) {
      console.error(`❌ Scene #${sc.scene_number} is missing scene_pattern`);
      passedAllChecks = false;
    }
    if (!sc.visual_action) {
      console.error(`❌ Scene #${sc.scene_number} is missing visual_action`);
      passedAllChecks = false;
    }
    if (sc.title.includes('(Bagian') || sc.title.includes('(Part') || sc.title.includes('(Lanjutan)')) {
      console.error(`❌ Scene #${sc.scene_number} has continuation tag in title`);
      passedAllChecks = false;
    }
  });

  console.log(`\n============================================================`);
  if (passedAllChecks) {
    console.log('🏆 PROVE SUCCESS: All cinematic storytelling contracts and quality gates PASSED.');
  } else {
    console.error('⚠️ Some quality checks failed.');
    process.exit(1);
  }
}

testCinematicStorytellingRework().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
