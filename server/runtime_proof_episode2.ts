import { runStage4NarrativeStructure } from './stages/stage4_narrative_structure';
import { runStage5SceneBreakdownAttempt } from './stages/stage5_scene_breakdown';
import { CharacterBible, LocationBible, ProjectFoundation } from '../src/types';

async function runEpisode2RuntimeProof() {
  console.log('================================================================');
  console.log('🎬 RUNTIME PROOF: EPISODE 2 — "Nama yang Belum Pernah Mereka Dengar"');
  console.log('================================================================\n');

  const rawScript = `Episode 2: Nama yang Belum Pernah Mereka Dengar
Premis: Setelah kelahiran Nabi Muhammad ﷺ, Abdul Muttalib menerima kabar kelahiran, melihat cucunya, membawanya menuju Ka'bah, kemudian memberi nama Muhammad sebelum pencarian ibu susuan dimulai. Para tetua Quraisy terperangah keheranan atas nama yang asing itu.`;

  const foundation: Omit<ProjectFoundation, 'id' | 'project_id' | 'updated_at'> = {
    era: 'Makkah Abad ke-6',
    theme: 'Kelahiran Yang Terpuji',
    genre: 'Sejarah Islam / Sinematik',
    timeline: 'Hari-hari awal kelahiran Nabi Muhammad ﷺ',
    main_characters: ['Abdul Muttalib', 'Aminah'],
    supporting_characters: ['Pembesar Quraisy', 'Halimah as-Sa\'diyah'],
    locations: ['Rumah Aminah', 'Lorong Kota Makkah', 'Pelataran Ka\'bah', 'Gerbang Kota Makkah'],
    main_conflict: 'Pemberian nama Muhammad yang asing bagi tradisi Quraisy dan penolakan awal tradisi',
    emotional_arc: 'Dari haru dan keterkejutan fajar, keagungan di Ka\'bah, keheranan dan perdebatan, hingga ketetapan takdir pengasuhan padang pasir',
    narrative_arc: 'Kabar kelahiran -> Melihat cucu -> Membawa ke Ka\'bah -> Pengumuman nama Muhammad -> Penjelasan makna -> Kontras kehidupan Makkah -> Pencarian ibu susuan -> Munculnya Halimah',
    visual_tone: 'Cinematic warm golden dawn to harsh midday sun, authentic pre-Islamic Hijaz realism',
  };

  const characters = [
    {
      id: 'c1',
      name: 'Abdul Muttalib',
      gender: 'MALE',
      age: 70,
      personality: 'Pemimpin kabilah berwibawa, penuh kasih, teguh memegang amanah ilahi',
      physical_appearance: 'Pria berjanggut putih terawat, tatapan mata teduh namun berwibawa',
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
      personality: 'Lembut, tabah, anggun dalam kesunyian duka yatim',
      physical_appearance: 'Wanita muda dengan wajah teduh dan tatapan penuh cinta',
      clothing: 'Pakaian bersahaja tertutup rapi warna bumi',
      role: 'SUPPORTING',
      face_identity_locked: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c3',
      name: 'Pembesar Quraisy',
      gender: 'MALE',
      age: 55,
      personality: 'Konservatif, curiga terhadap hal baru, terikat adat nenek moyang',
      physical_appearance: 'Para tetua Quraisy berwajah keras dengan jubah mewah',
      clothing: 'Jubah tenun berhias benang Yaman',
      role: 'ANTAGONIST',
      face_identity_locked: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c4',
      name: 'Halimah as-Sa\'diyah',
      gender: 'FEMALE',
      age: 28,
      personality: 'Sederhana, penyayang, tabah menghadapi kemarau',
      physical_appearance: 'Wanita Badui berparas lelah namun penuh ketulusan',
      clothing: 'Pakaian wanita pengembara Bani Sa\'ad yang kusam',
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
      environment: 'Interior rumah tanah liat bersahaja di perkampungan Makkah',
      lighting_style: 'Warm natural morning sunlight through fabric curtain',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'l2',
      name: 'Lorong Kota Makkah',
      era: 'Abad ke-6 M',
      environment: 'Lorong berbatu berdebu di antara rumah-rumah tanah liat',
      lighting_style: 'Cahaya pagi condong dengan bayangan tajam',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'l3',
      name: 'Pelataran Ka\'bah',
      era: 'Abad ke-6 M',
      environment: 'Area terbuka berbatu sekitar Ka\'bah kuno tempat para bangsawan Quraisy berkumpul',
      lighting_style: 'Terik matahari Makkah, kontras tinggi',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'l4',
      name: 'Gerbang Kota Makkah',
      era: 'Abad ke-6 M',
      environment: 'Pintu keluar kota berpasir tempat kafilah unta beristirahat',
      lighting_style: 'Cahaya senja kemerahan berdebu gurun',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ] as unknown as LocationBible[];

  console.log('[STAGE 4] Executing Narrative Structure Arc (6-Beat Cinematic Tone)...');
  const narrativeBeats = await runStage4NarrativeStructure({
    rawScript,
    foundation,
    characters,
    locations,
    language: 'id',
  });

  console.log('\n--- GENERATED STAGE 4 BEATS ---');
  console.log('Beginning   :', narrativeBeats.beginning);
  console.log('Development :', narrativeBeats.development);
  console.log('Climax      :', narrativeBeats.climax);
  console.log('Consequence :', narrativeBeats.consequence);
  console.log('Ending      :', narrativeBeats.ending);

  console.log('\n[STAGE 5] Executing Scene Breakdown (8 Scenes Target, ~160s Total)...');
  const customGuidance = `
TATA STRUKTUR SINEMATIK 8 ADEGAN:
- SCENE 1: HOOK (Aksi pembuka langsung dengan DIALOGUE lalu NARRATION minimal). Aksi tergesa menyambut kabar.
- SCENE 2: CONTEXT (NARRATION lalu DIALOGUE). Momen intim Abdul Muttalib pertama kali melihat cucunya di Rumah Aminah.
- SCENE 3: ESCALATION (NARRATION lalu DOA/DIALOGUE khidmat). Abdul Muttalib membawa bayi dalam dekapan melewati lorong menuju Ka'bah.
- SCENE 4: TURNING_POINT (DIALOGUE antar tetua -> DIALOGUE penamaan -> NARRATION). Pengumuman nama "Muhammad" di depan pembesar Quraisy yang memicu keheranan dan rasa ingin tahu.
- SCENE 5: TURNING_POINT/ESCALATION (DIALOGUE ketegasan -> NARRATION). Makna nama "Muhammad" (dipuji di langit dan bumi) yang membungkam keraguan.
- SCENE 6: CONTEXT/ESCALATION (NARRATION murni). Kontras: Kota Makkah terus berdenyut normal dalam kesibukan niaga, padahal sejarah besar telah dimulai.
- SCENE 7: ESCALATION (NARRATION lalu DIALOGUE). Pencarian ibu susuan, penolakan wanita Badui karena status anak yatim.
- SCENE 8: PAYOFF/CLIFFHANGER (NARRATION menuju CLIFFHANGER). Munculnya Halimah as-Sa'diyah dan unta kurusnya di gerbang kota, menatap takdir Episode 3.
`;

  const scenes = await runStage5SceneBreakdownAttempt({
    narrativeBeats,
    totalDurationTargetSec: 160,
    targetSceneCount: 8,
    maxSceneDurationSec: 25,
    language: 'id',
    characterRoster: characters.map(c => c.name),
    locationRoster: locations.map(l => l.name),
    customGuidance,
  });

  console.log(`\n================================================================`);
  console.log(`🎬 RUNTIME GENERATED: ${scenes.length} SCENES (Total: ${scenes.reduce((a, s) => a + s.duration_sec, 0)}s)`);
  console.log(`================================================================\n`);

  // Verification metrics
  let passHook = false;
  let passAlternation = true;
  let passCuriosityScene4 = false;
  let passCliffhangerScene8 = false;
  let passHistoricalClassification = true;
  let passProphetLock = true;
  let passDuration = true;
  let passContinuity = true;

  scenes.forEach((sc, idx) => {
    const num = sc.scene_number;
    console.log(`\n------------------------------------------------------------`);
    console.log(`SCENE #${num} [${sc.scene_pattern}]: ${sc.title} (${sc.duration_sec}s)`);
    console.log(`- Lokasi & Waktu    : ${sc.location_name} | ${sc.time_of_day}`);
    console.log(`- Tokoh             : ${(sc.character_names || []).join(', ')}`);
    console.log(`- Fungsi Naratif    : ${sc.narrative_function}`);
    console.log(`- Tujuan Emosional  : ${sc.emotional_objective}`);
    console.log(`- Aksi Visual (Show): ${sc.visual_action}`);

    const hasDialogue = Array.isArray(sc.dialogue) && sc.dialogue.length > 0;
    const hasVO = Boolean(sc.narrator_vo && sc.narrator_vo.trim());

    if (hasDialogue) {
      console.log(`- Dialog (${sc.dialogue.length} baris):`);
      sc.dialogue.forEach(d => {
        console.log(`    ↳ [${d.character_name}] "${d.line}" (Subteks: ${d.emotional_subtext || '-'}, Delivery: ${d.delivery || '-'})`);
      });
    } else {
      console.log(`- Dialog: Non-verbal / Visual murni`);
    }

    if (hasVO) {
      console.log(`- Voiceover Narator : "${sc.narrator_vo}"`);
    } else {
      console.log(`- Voiceover Narator : None`);
    }

    console.log(`- Tata Suara        : SFX=[${(sc.sound_design?.sfx || []).join(', ')}], BGM="${sc.sound_design?.bgm_mood || ''}"`);
    console.log(`- Status Historis   : Tier=${sc.historical_integrity?.tier || 'NONE'} (${sc.historical_integrity?.basis || ''})`);
    console.log(`- Prophet Safeguard : Present=${Boolean(sc.prophet_depiction_safeguard?.is_prophet_present)}, Rule="${sc.prophet_depiction_safeguard?.visual_rule || ''}"`);

    // Verification Checks
    if (num === 1) {
      if (hasDialogue || sc.visual_action.toLowerCase().includes('tergesa') || sc.scene_pattern === 'HOOK') {
        passHook = true;
      }
    }

    if (num === 4) {
      const mentionsMuhammad = JSON.stringify(sc).toLowerCase().includes('muhammad');
      if (mentionsMuhammad) {
        passCuriosityScene4 = true;
      }
    }

    if (num === 8) {
      if (sc.scene_pattern === 'CLIFFHANGER' || sc.scene_pattern === 'PAYOFF' || JSON.stringify(sc).toLowerCase().includes('halimah')) {
        passCliffhangerScene8 = true;
      }
    }

    if (!sc.historical_integrity?.tier || !['FACT', 'DRAMATIZED_DIALOGUE', 'NARRATIVE_BRIDGE', 'FICTIONALIZED'].includes(sc.historical_integrity.tier)) {
      passHistoricalClassification = false;
    }

    if (sc.prophet_depiction_safeguard?.is_prophet_present) {
      const rule = (sc.prophet_depiction_safeguard.visual_rule || '').toLowerCase();
      if (rule.includes('wajah') && !rule.includes('tidak') && !rule.includes('tanpa') && !rule.includes('terbedong') && !rule.includes('tutup')) {
        passProphetLock = false;
      }
    }

    // Asset verification
    if (!locations.some(l => l.name === sc.location_name)) {
      passContinuity = false;
    }
  });

  const totalCalc = scenes.reduce((a, s) => a + s.duration_sec, 0);
  if (totalCalc !== 160) {
    passDuration = false;
  }

  const fs = await import('fs');
  const path = await import('path');
  const targetPath = path.resolve(process.cwd(), 'server/episode2_result.json');
  fs.writeFileSync(targetPath, JSON.stringify({ narrativeBeats, scenes }, null, 2));
  console.log(`[SAVED FILE] Result saved to: ${targetPath}`);

  console.log(`\n================================================================`);
  console.log(`VERIFICATION SUMMARY:`);
  console.log(`1. Hook Scene 1 (Action/Dialogue first): ${passHook ? 'PASS' : 'FAIL'}`);
  console.log(`2. Curiosity Scene 4 (Name reveal):      ${passCuriosityScene4 ? 'PASS' : 'FAIL'}`);
  console.log(`3. Cliffhanger Scene 8 (Next episode):   ${passCliffhangerScene8 ? 'PASS' : 'FAIL'}`);
  console.log(`4. Historical Epistemic Tier:           ${passHistoricalClassification ? 'PASS' : 'FAIL'}`);
  console.log(`5. Prophet Depiction Reverence Lock:    ${passProphetLock ? 'PASS' : 'FAIL'}`);
  console.log(`6. Total Duration Precision (160s):     ${passDuration ? 'PASS' : 'FAIL'}`);
  console.log(`7. Asset & Continuity Integrity:        ${passContinuity ? 'PASS' : 'FAIL'}`);
  console.log(`================================================================\n`);

  return {
    scenes,
    passHook,
    passCuriosityScene4,
    passCliffhangerScene8,
    passHistoricalClassification,
    passProphetLock,
    passDuration,
    passContinuity,
  };
}

runEpisode2RuntimeProof().catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
