import { runStage4NarrativeStructure } from './stages/stage4_narrative_structure';
import { runStage5SceneBreakdownAttempt } from './stages/stage5_scene_breakdown';
import { CharacterBible, LocationBible, ProjectFoundation } from '../src/types';
import { quotaRouter } from './ai_infrastructure/quota_router';
import { healthService } from './ai_infrastructure/health_service';

export async function reproduceOldNarrativeOutput() {
  console.log('--- REPRODUCING EXISTING NARRATIVE OUTPUT ---');
  await quotaRouter.resetProviderState('apx_mtrho0fo');
  await healthService.resetHealth('cred_1788800558875_kzrek');
  
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

  let narrativeBeats: any;
  try {
    console.log('[REPRODUCE] Running Stage 4 (Narrative Structure)...');
    narrativeBeats = await runStage4NarrativeStructure({
      rawScript: testScript,
      foundation,
      characters,
      locations,
      language: 'id',
    });
  } catch (e: any) {
    console.warn('[REPRODUCE] Using captured S4 beats from baseline run:', e.message);
    narrativeBeats = {
      beginning: "Kabar kelahiran sang bayi mulia sampai kepada sang kakek, Abdul Muttalib, pemimpin terhormat kaum Quraisy. Diselimuti cahaya pagi yang hangat di kediaman Aminah, Abdul Muttalib menyambut cucu yatimnya dengan keharuan mendalam dan rasa takzim, menyaksikan tanda-tanda kemuliaan yang memancar tenang dari keturunan putranya, Abdullah.",
      development: "Didorong rasa syukur yang mendalam, Abdul Muttalib membawa sang bayi dalam dekapannya melintasi jalanan Makkah menuju pelataran Ka'bah. Di hadapan Baitullah dan disaksikan para pembesar kabilah, sang pemimpin memanjatkan doa tulus serta mempersembahkan sang cucu ke dalam perlindungan Ilahi di pusat peradaban Hijaz.",
      climax: "Dalam majelis pertemuan bersama para tetua dan bangsawan Quraisy, Abdul Muttalib mengumumkan nama bagi sang cucu: 'Muhammad'. Pengumuman ini memicu keterkejutan dan keheranan besar di kalangan Quraisy, mempertanyakan alasan pemilihan nama yang sama sekali asing dan tidak pernah disematkan kepada para leluhur mereka.",
      consequence: "Dengan kewibawaan penuh dan ketetapan hati yang teguh, Abdul Muttalib menjawab keheranan kaumnya bahwa ia menghendaki agar cucunya kelak menjadi pribadi yang dipuji oleh penduduk langit dan bumi. Penjelasan penuh hikmah tersebut membungkam keraguan Quraisy dan menanamkan rasa ingin tahu yang mendalam di seantero Makkah.",
      ending: "Sang bayi terpuji dipulangkan kembali ke dekapan kasih ibundanya, Aminah, dengan rasa damai yang memenuhi relung rumah tanah liat mereka. Suasana khidmat bertransisi menuju fase baru, saat para kafilah wanita pedalaman mulai bersiap memasuki Makkah untuk mencari anak susuan, menandai babak awal pengembaraan takdir sang pembawa risalah."
    };
  }

  console.log('\n[REPRODUCE] Stage 4 Narrative Beats:');
  console.log(JSON.stringify(narrativeBeats, null, 2));

  // Reset health service before S5 to guarantee APInex credential is ready
  await healthService.resetHealth('cred_1788800558875_kzrek');

  console.log('\n[REPRODUCE] Running Stage 5 (Scene Breakdown)...');
  try {
    const scenes = await runStage5SceneBreakdownAttempt({
      narrativeBeats,
      totalDurationTargetSec: 150,
      maxSceneDurationSec: 30,
      language: 'id',
      characterRoster: ['Abdul Muttalib', 'Aminah'],
      locationRoster: ['Rumah Aminah', 'Pelataran Ka\'bah'],
      model: 'free/gemini-3.8-flash',
    });

    console.log(`\n[REPRODUCE] Stage 5 produced ${scenes.length} scenes:`);
    scenes.forEach((sc) => {
      console.log(`\nScene ${sc.scene_number}: ${sc.title} (${sc.duration_sec}s)`);
      console.log(`- Purpose: ${sc.story_purpose}`);
      console.log(`- Event: ${sc.event}`);
      console.log(`- Narrative Function: ${sc.narrative_function}`);
      console.log(`- Characters: ${(sc.character_names || []).join(', ')}`);
      console.log(`- Dialogue Field: ${JSON.stringify((sc as any).dialogue || (sc as any).character_dialogue || 'NONE')}`);
      console.log(`- VO Field: ${JSON.stringify((sc as any).narrator_vo || (sc as any).vo || 'NONE')}`);
      console.log(`- SFX Field: ${JSON.stringify((sc as any).sfx || 'NONE')}`);
      console.log(`- BGM Field: ${JSON.stringify((sc as any).bgm || 'NONE')}`);
      console.log(`- Transition Purpose: ${JSON.stringify((sc as any).transition_purpose || 'NONE')}`);
      console.log(`- Scene Pattern: ${JSON.stringify((sc as any).scene_pattern || 'NONE')}`);
    });
  } catch (err: any) {
    console.error('[REPRODUCE ERROR MESSAGE]', err?.message);
    console.error('[REPRODUCE ERROR STACK]', err?.stack);
  }
}

if (process.argv[1]?.endsWith('reproduce_narrative_audit.ts')) {
  reproduceOldNarrativeOutput().catch(console.error);
}
