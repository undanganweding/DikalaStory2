import { db } from './db';
import {
  Project,
  ProjectFoundation,
  CharacterBible,
  LocationBible,
  Scene,
  Shot,
  VideoPrompt,
} from '../src/types';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface SimulationOptions {
  projectId: string;
  onProgress?: (
    stage: number,
    stageName: string,
    message: string,
    level?: 'info' | 'success' | 'warn' | 'error'
  ) => void;
  runContext?: {
    runId: string;
    projectId: string;
    startedAt: string;
  };
}

/**
 * High-Fidelity Zero-Quota Pipeline Simulation Engine (Dry-Run Prototype Mode)
 * Executes Stages 1 to 8 deterministically with realistic Indonesian cinematic assets,
 * adhering strictly to all architectural constraints without calling the upstream Gemini API.
 */
export async function runPipelineSimulation({
  projectId,
  onProgress,
  runContext,
}: SimulationOptions): Promise<{ success: boolean; error?: string; runId?: string; totalScenes: number; readyScenes: number }> {
  const project = await db.getProject(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found.`);
  }

  const runId = runContext?.runId || `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const log = (
    stage: number,
    stageName: string,
    message: string,
    level: 'info' | 'success' | 'warn' | 'error' = 'info'
  ) => {
    try {
      db.addLog(projectId, {
        stage,
        stage_name: stageName,
        stage_code: `S${stage}` as any,
        message,
        level,
        run_id: runId,
      });
    } catch {}

    if (onProgress) {
      try {
        onProgress(stage, stageName, message, level);
      } catch {}
    }
  };

  log(1, 'Simulation Engine', `[SIMULASI 0-KUOTA] Memulai uji prototipe pipeline sinematik tanpa kuota API...`, 'info');

  // Mark project as processing in simulation mode
  await db.updateProject(projectId, (p) => ({
    ...p,
    status: 'processing',
    current_stage: 1,
    is_simulation: true,
    simulation_mode: true,
    active_run_id: runId,
    latest_run_id: runId,
  }));

  await delay(350);

  // ==========================================
  // STAGE 1: Story Understanding & Foundation
  // ==========================================
  log(1, 'Story Understanding Agent', `[S1] Menganalisis naskah & merumuskan fondasi visual sinematik...`, 'info');
  await delay(400);

  const title = project.title || 'Kisah Sinematik Nusantara';
  const promptText = project.raw_script || 'Kisah petualangan sinematik penuh misteri, ketegangan, dan keindahan visual.';

  const genre = promptText.toLowerCase().includes('horor') ? 'Horror Mystery'
    : promptText.toLowerCase().includes('cyberpunk') || promptText.toLowerCase().includes('sci-fi') ? 'Sci-Fi Cyberpunk'
    : promptText.toLowerCase().includes('laga') || promptText.toLowerCase().includes('aksi') ? 'Action Thriller'
    : promptText.toLowerCase().includes('sejarah') || promptText.toLowerCase().includes('kolosal') ? 'Historical Epic'
    : 'Cinematic Drama';

  const foundation: ProjectFoundation = {
    project_id: projectId,
    genre,
    era: 'Modern Era / Neo-Atmosphere',
    visual_tone: 'Moody, Cinematic, Atmospheric, High Dynamic Range, 35mm Arri Alexa, High Contrast Chiaroscuro Lighting',
    theme: 'Keberanian & Penyingkapan Misteri',
    timeline: 'Linier Real-time Intensitas Malam Hari',
    main_characters: ['Raden Arya', 'Kirana Maya'],
    supporting_characters: [],
    locations: ['Rooftop Menara Metropolitan Jakarta', 'Ruang Arsip Rahasia Bawah Tanah'],
    main_conflict: 'Mengamankan artefak silinder data kuno sebelum sistem keamanan kota mengunci seluruh perimeter.',
    emotional_arc: 'Dari ketidakpastian penuh ketegangan menuju keberanian & tekad mutlak.',
    narrative_arc: 'Eksposisi Rooftop -> Alarm Keamanan -> Pengejaran -> Aktivasi Terminal Kubah Bawah Tanah',
    act_1_world_setup: {
      description: 'Arya mengamati kota dari rooftop berkabut di malam hari.',
      visual_guide: 'Establishing wide shot dengan neon reflections',
      audio_guide: 'Desiran angin malam dan ambience kota',
    },
    act_2_human_element: {
      character_focus: 'Pertemuan rahasia dengan Kirana Maya dan penyerahan silinder data.',
      internal_feelings: 'Kehati-hatian dan tanggung jawab moral yang berat',
      early_education_struggle: 'Menjaga kerahasiaan misi dari pihak luar',
    },
    act_3_rising_conflict: {
      tension_type: 'Pengejaran fisik dan ancaman alarm',
      tempo_visual_note: 'Pencahayaan strobo alarm berkedip merah dan bayangan bergerak cepat',
      tempo_audio_note: 'Sirine bergaung memecah keheningan malam',
    },
    act_4_climax_breath: {
      silent_before_climax: 'Keheningan sesaat saat silinder dimasukkan ke soket terminal',
      climax_impact: 'Pancaran gelombang cahaya biru menyala menyelimuti kubah arsip',
      audio_contrast_guide: 'Resonansi frekuensi rendah yang menggetarkan ruangan',
    },
    act_5_legacy_meaning: {
      deeper_meaning: 'Kemenangan integritas dan kebenaran atas manipulasi data',
      message_for_posterity: 'Keberanian untuk bertindak demi kepentingan yang lebih besar',
    },
    updated_at: new Date().toISOString(),
  };

  await db.saveProjectFoundation(foundation);
  await db.updateProject(projectId, (p) => ({
    ...p,
    foundation_status: 'ready',
    current_stage: 2,
  }));

  log(1, 'Story Understanding Agent', `[S1] Fondasi proyek '${title}' (${genre}) berhasil dirumuskan secara presisi. (0 Kuota Digunakan)`, 'success');
  await delay(350);

  // ==========================================
  // STAGE 2: Character Detection & Bible
  // ==========================================
  log(2, 'Character Detection Agent', `[S2] Mengidentifikasi profil karakter utama & identitas visual...`, 'info');
  await delay(450);

  const char1Id = `char_${Date.now()}_1`;
  const char2Id = `char_${Date.now()}_2`;

  const char1: CharacterBible = {
    id: char1Id,
    project_id: projectId,
    name: 'Raden Arya',
    age: '32 tahun',
    gender: 'Pria',
    physical_appearance: 'Pria atletis, tatapan mata tajam penuh determinasi, rahang tegas berkarakter, rambut hitam sedikit berantakan basah oleh kabut malam.',
    physical_description: 'Pria atletis, tatapan mata tajam penuh determinasi, rahang tegas berkarakter, rambut hitam sedikit berantakan basah oleh kabut malam.',
    role: 'Protagonist / Protagonis Utama',
    face_identity_locked: true,
    identity_version: 1,
    hair: 'Rambut hitam pendek bertekstur, sedikit lembap',
    beard: 'Stubble tipis rapi',
    clothing: 'Jaket kulit hitam taktis berkerah tinggi, kaos dalam abu-abu gelap, celana kargo gelap',
    costume: 'Jaket kulit hitam taktis berkerah tinggi',
    wardrobe: 'Pakaian serba gelap bergaya modern-tactical',
    accessories: ['Sarung tangan kulit tanpa jari', 'Transceiver komunikator mikro di telinga'],
    personality: 'Intuitif, tenang di bawah tekanan, memiliki rasa keadilan yang kuat',
    voice_character: 'Bariton berat, tenang, berwibawa',
    movement_style: 'Langkah taktis efisien, sigap dan selalu waspada',
    master_portrait_prompt: 'Cinematic 8k portrait of Raden Arya, Indonesian male 32 years old, sharp determined eyes, wearing tactical black leather jacket, rim lighting, 85mm lens f/1.4, cinematic tone',
    version: 1,
    updated_at: new Date().toISOString(),
  };

  const char2: CharacterBible = {
    id: char2Id,
    project_id: projectId,
    name: 'Kirana Maya',
    age: '28 tahun',
    gender: 'Wanita',
    physical_appearance: 'Wanita berwajah anggun dengan sorot mata cerdas dan misterius, rambut hitam panjang dikuncir rapi ke belakang.',
    physical_description: 'Wanita berwajah anggun dengan sorot mata cerdas dan misterius, rambut hitam panjang dikuncir rapi ke belakang.',
    role: 'Deuteragonist / Tokoh Kunci',
    face_identity_locked: true,
    identity_version: 1,
    hair: 'Rambut hitam lurus dikuncir kuda rapi ke belakang',
    beard: 'None',
    clothing: 'Trench coat abu-abu gelap tahan air, kemeja hitam berkerah tajam',
    costume: 'Trench coat abu-abu gelap tahan air',
    wardrobe: 'Gaya formal taktis elegan',
    accessories: ['Anting perak minimalis geometris', 'Liontin silinder kaca mini di leher'],
    personality: 'Strategis, berpengetahuan luas, berhati-hati dan cermat',
    voice_character: 'Alto jernih, penuh intonasi presisi',
    movement_style: 'Gerakan anggun, cepat tanpa suara, efisien',
    master_portrait_prompt: 'Cinematic 8k portrait of Kirana Maya, Indonesian female 28 years old, enigmatic intelligent eyes, sleek ponytail, dark charcoal trenchcoat, subtle volumetric lighting, 85mm portrait lens',
    version: 1,
    updated_at: new Date().toISOString(),
  };

  await db.saveAndMergeCharacters(projectId, [char1, char2]);

  await db.updateProject(projectId, (p) => ({
    ...p,
    current_stage: 3,
  }));

  log(2, 'Character Detection Agent', `[S2] Terdeteksi 2 Karakter Sinematik: ${char1.name} & ${char2.name} dengan konsistensi visual 100%. (0 Kuota Digunakan)`, 'success');
  await delay(350);

  // ==========================================
  // STAGE 3: Location & Environment Detection
  // ==========================================
  log(3, 'Location & Object Agent', `[S3] Merancang master environment & atmosfer tata lokasi sinematik...`, 'info');
  await delay(450);

  const loc1Id = `loc_${Date.now()}_1`;
  const loc2Id = `loc_${Date.now()}_2`;

  const loc1: LocationBible = {
    id: loc1Id,
    project_id: projectId,
    name: 'Rooftop Menara Metropolitan Jakarta',
    era: 'Modern Era',
    architecture: 'Pencakar langit modern, helipad baja, pagar pembatas industrial',
    architectural_style: 'Neo-Metropolitan Industrial Rooftop',
    environment: 'Outdoor Urban Rooftop',
    landscape: 'Cityscape panorama kota malam dengan kabut tebal dan kilau lampu gedung tinggi',
    climate: 'Gerimis malam hari, lembap, berangin sejuk',
    culture: 'Metropolitan Urban',
    lighting_style: 'High Contrast Chiaroscuro, Neon Teal & Amber Reflections on wet floor',
    lighting_atmosphere: 'Pendaran neon kota memantul di aspal basah, rim light dramatis',
    description: 'Atap gedung pencakar langit berlantai basah pantulan lampu neon kota, berlatar langit malam berkabut gerimis dan cityscape dramatis.',
    color_palette: ['#0f172a', '#1e293b', '#06b6d4', '#f59e0b'],
    material: 'Aspal beton basah, baja galvanis, kaca reflektif',
    master_environment_prompt: 'Cinematic wide establishing shot of a wet metropolitan skyscraper rooftop in Jakarta at night, heavy volumetric fog, glowing amber and cyan neon reflections, Arri Alexa 24mm',
    version: 1,
    updated_at: new Date().toISOString(),
  };

  const loc2: LocationBible = {
    id: loc2Id,
    project_id: projectId,
    name: 'Ruang Arsip Rahasia Bawah Tanah',
    era: 'Modern Era',
    architecture: 'Kubah beton monumental neo-brutalis, barisan rak data titanium',
    architectural_style: 'Neo-Brutalist High-Tech Archive Vault',
    environment: 'Underground Vault / Interior',
    landscape: 'Kubah beton megah dengan pilar-pilar silindris tinggi dan kabel optik rapi',
    climate: 'Sejuk terkontrol dengan ventilasi udara presisi',
    culture: 'Secret Archive Facility',
    lighting_style: 'Overhead Soft Cyan Floodlight, Single Amber Spotlight at Central Terminal',
    lighting_atmosphere: 'Pencahayaan dramatis dari atas dengan partikel debu halus melayang di berkas cahaya',
    description: 'Ruang kubah beton megah berisi barisan rak data bercahaya biru redup, kabel optik menjuntai, dan partikel debu melayang dalam sinar lampu sorot tunggal.',
    color_palette: ['#090d16', '#1e293b', '#38bdf8', '#fbbf24'],
    material: 'Beton bertulang abu-abu, titanium hitam, marmer gelap',
    master_environment_prompt: 'Monumental brutalist concrete vault interior, glowing cyan data columns, central holographic terminal, dramatic overhead volumetric light shaft, 8k cinematic cinematography',
    version: 1,
    updated_at: new Date().toISOString(),
  };

  await db.saveAndMergeLocations(projectId, [loc1, loc2]);

  await db.updateProject(projectId, (p) => ({
    ...p,
    current_stage: 4,
  }));

  log(3, 'Location & Object Agent', `[S3] Terpetakan 2 Master Lokasi: '${loc1.name}' & '${loc2.name}'. (0 Kuota Digunakan)`, 'success');
  await delay(350);

  // ==========================================
  // STAGE 4: Narrative Architecture & Pacing
  // ==========================================
  log(4, 'Narrative Structure Agent', `[S4] Membangun arsitektur 3-Babak & kurva eskalasi dramatik...`, 'info');
  await delay(450);

  await db.updateProject(projectId, (p) => ({
    ...p,
    current_stage: 5,
  }));

  log(4, 'Narrative Structure Agent', `[S4] Struktur naratif 3-Babak selesai divalidasi dengan kurva tensi dinamis. (0 Kuota Digunakan)`, 'success');
  await delay(350);

  // ==========================================
  // STAGE 5: Scene Breakdown & Subdivision
  // ==========================================
  log(5, 'Scene Breakdown Agent', `[S5] Menguraikan naskah menjadi adegan sinematik terukur...`, 'info');
  await delay(500);

  const targetDuration = project.total_duration_target_sec || 60;
  const sceneCount = targetDuration <= 30 ? 4 : targetDuration <= 60 ? 6 : 8;
  const durationPerScene = Math.max(5, Math.round(targetDuration / sceneCount));

  const scenesList: Scene[] = [];

  const sceneBlueprints = [
    {
      title: 'Inisiasi & Pandangan Pertama',
      summary: 'Arya berdiri di tepi rooftop basah menatap cakrawala kota yang tenggelam dalam kabut malam. Angin mengibarkan jaketnya saat ia memegang transceiver.',
      locName: 'Rooftop Menara Metropolitan Jakarta',
      chars: ['Raden Arya'],
      visualGoal: 'Membangun rasa kesepian mendalam dan skala dunia yang megah.',
      emotionalBeat: 'Antisipasi tegang',
      timeOfDay: 'Malam Hari',
      storyPurpose: 'Pengenalan protagonis di dunia cerita',
      narrativeFunction: 'HOOK & WORLD SETUP',
    },
    {
      title: 'Pertemuan di Tengah Bayangan',
      summary: 'Maya muncul dari balik pintu darurat rooftop. Tatapan mata mereka bertemu di bawah pendaran cahaya neon biru.',
      locName: 'Rooftop Menara Metropolitan Jakarta',
      chars: ['Raden Arya', 'Kirana Maya'],
      visualGoal: 'Dua karakter berdiri berhadapan dengan kontras pencahayaan siluet yang tajam.',
      emotionalBeat: 'Kehati-hatian dan kepercayaan yang rapuh',
      timeOfDay: 'Malam Hari',
      storyPurpose: 'Pertemuan dua tokoh kunci',
      narrativeFunction: 'INCITING INCIDENT',
    },
    {
      title: 'Penyerahan Artefak Rahasia',
      summary: 'Maya menyerahkan sebuah silinder data bercahaya keemasan kepada Arya. Refleksi cahaya menyinari wajah kedua tokoh.',
      locName: 'Rooftop Menara Metropolitan Jakarta',
      chars: ['Raden Arya', 'Kirana Maya'],
      visualGoal: 'Fokus ekstrem pada pertukaran tangan dan cahaya pendaran artefak.',
      emotionalBeat: 'Momen penentuan nasib',
      timeOfDay: 'Malam Hari',
      storyPurpose: 'Perpindahan objek kunci pengubah alur cerita',
      narrativeFunction: 'TURNING POINT',
    },
    {
      title: 'Alarm & Peringatan Bahaya',
      summary: 'Lampu sorot keamanan tiba-tiba menyala di kejauhan menyapu rooftop. Suara sirine bergaung memecah keheningan.',
      locName: 'Rooftop Menara Metropolitan Jakarta',
      chars: ['Raden Arya', 'Kirana Maya'],
      visualGoal: 'Cahaya sorot tajam membelah kegelapan dengan partikel air hujan berkilau.',
      emotionalBeat: 'Tensi meningkat drastis',
      timeOfDay: 'Malam Hari',
      storyPurpose: 'Munculnya rintangan langsung yang memaksa pelarian',
      narrativeFunction: 'ESCALATION & THREAT',
    },
    {
      title: 'Pelarian Menuju Ruang Bawah Tanah',
      summary: 'Arya dan Maya menerobos lorong arsip bawah tanah berkubah beton. Langkah kaki mereka bergema di lantai marmer hitam.',
      locName: 'Ruang Arsip Rahasia Bawah Tanah',
      chars: ['Raden Arya', 'Kirana Maya'],
      visualGoal: 'Gerakan kamera tracking dinamis mengikuti ritme lari kedua karakter.',
      emotionalBeat: 'Urgensi dan determinasi tinggi',
      timeOfDay: 'Interior / Malam',
      storyPurpose: 'Perjalanan menuju titik pengamanan data',
      narrativeFunction: 'CRUCIBLE TRANSITION',
    },
    {
      title: 'Klimaks Aktivasi Sistem',
      summary: 'Arya memasang artefak silinder ke terminal pusat. Gelombang cahaya biru mengalir seketika menerangi seluruh ruangan berkubah.',
      locName: 'Ruang Arsip Rahasia Bawah Tanah',
      chars: ['Raden Arya', 'Kirana Maya'],
      visualGoal: 'Pancaran cahaya volumetrik megah menerangi seluruh kubah arsitektur.',
      emotionalBeat: 'Klimaks kepuasan & keajaiban visual',
      timeOfDay: 'Interior',
      storyPurpose: 'Titik balik puncak di mana misi terselesaikan',
      narrativeFunction: 'CLIMAX & PAYOFF',
    },
    {
      title: 'Konfrontasi Terakhir',
      summary: 'Bayangan musuh terlihat di ujung pintu masuk. Arya dan Maya bersiap dengan posisi taktis saling melindungi.',
      locName: 'Ruang Arsip Rahasia Bawah Tanah',
      chars: ['Raden Arya', 'Kirana Maya'],
      visualGoal: 'Komposisi simetris dengan rim light emas dramatis di kedua siluet tokoh.',
      emotionalBeat: 'Keberanian mutlak',
      timeOfDay: 'Interior',
      storyPurpose: 'Pertahanan posisi saat sistem menyelesaikan sinkronisasi',
      narrativeFunction: 'CONFRONTATION',
    },
    {
      title: 'Resolusi & Fajar Baru',
      summary: 'Sistem stabil. Sinar matahari pagi pertama menembus ventilasi kaca tinggi, menandai kemenangan babak awal mereka.',
      locName: 'Ruang Arsip Rahasia Bawah Tanah',
      chars: ['Raden Arya', 'Kirana Maya'],
      visualGoal: 'Cahaya fajar hangat (golden hour) membasuh ruangan beton dengan kedamaian.',
      emotionalBeat: 'Kelegaan penuh harapan',
      timeOfDay: 'Fajar (Dawn)',
      storyPurpose: 'Penutupan babak dengan harapan baru',
      narrativeFunction: 'RESOLUTION & LEGACY',
    },
  ];

  for (let idx = 0; idx < sceneCount; idx++) {
    const bp = sceneBlueprints[idx % sceneBlueprints.length];
    const sceneId = `scene_${Date.now()}_${idx + 1}`;
    const scene: Scene = {
      id: sceneId,
      project_id: projectId,
      scene_number: idx + 1,
      title: `Scene ${idx + 1}: ${bp.title}`,
      duration_sec: durationPerScene,
      story_purpose: bp.storyPurpose,
      location_name: bp.locName,
      time_of_day: bp.timeOfDay,
      character_names: bp.chars,
      emotional_objective: bp.emotionalBeat,
      event: bp.summary,
      narrative_function: bp.narrativeFunction,
      visual_action: bp.visualGoal,
      status: 'pending',
      pipeline_status: 'READY',
      version: 1,
      updated_at: new Date().toISOString(),
    };
    scenesList.push(scene);
  }

  await db.saveScenes(projectId, scenesList);

  await db.updateProject(projectId, (p) => ({
    ...p,
    current_stage: 6,
  }));

  log(5, 'Scene Breakdown Agent', `[S5] Berhasil menguraikan ${scenesList.length} adegan sinematik lengkap (Total Durasi: ${scenesList.length * durationPerScene}s). (0 Kuota Digunakan)`, 'success');
  await delay(400);

  // =========================================================================
  // STAGES 6 to 8: Shot Breakdown, Master Frame Prompt & Video Prompt Agent
  // =========================================================================
  log(6, 'Parallel Production Hub', `[S6–S8] Memulai pemrosesan paralel ${scenesList.length} adegan sinematik...`, 'info');

  for (let i = 0; i < scenesList.length; i++) {
    const sc = scenesList[i];
    const scNum = sc.scene_number;
    const sceneId = sc.id!;

    // --- STAGE 6: Shot Breakdown ---
    log(6, 'Shot Subdivision Agent', `Scene #${scNum}: Merumuskan breakdown 3 sudut shot (Wide, Medium, Close-Up)...`, 'info');
    await delay(200);

    const shot1Id = `shot_${sceneId}_1`;
    const shot2Id = `shot_${sceneId}_2`;
    const shot3Id = `shot_${sceneId}_3`;

    const shotDur1 = Math.max(2, Math.floor(sc.duration_sec / 3));
    const shotDur2 = Math.max(2, Math.floor(sc.duration_sec / 3));
    const shotDur3 = Math.max(2, sc.duration_sec - shotDur1 - shotDur2);

    const shot1: Shot = {
      id: shot1Id,
      scene_id: sceneId,
      project_id: projectId,
      shot_number: 1,
      start_time_sec: 0,
      end_time_sec: shotDur1,
      duration_sec: shotDur1,
      event_detail: `Wide establishing shot: ${sc.event}`,
      character_action: 'Arya berdiri tegak mengamati keadaan sekitar dengan mata waspada.',
      camera_note: 'Establishing Wide Angle 24mm, Eye Level, Slow Forward Push-in',
      dialogue: [],
      emotion: 'Antisipasi tegang',
      audio_note: 'Desiran angin malam dan deru samar kota di kejauhan',
      shot_type: 'ESTABLISHING_WIDE',
      camera_movement: 'Slow Forward Push-In',
      action: 'Berdiri di posisi strategis memantau situasi',
      sound_effects: 'Desiran angin malam, tetesan air hujan di aspal',
      version: 1,
      generation_status: 'prompt_ready',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const shot2: Shot = {
      id: shot2Id,
      scene_id: sceneId,
      project_id: projectId,
      shot_number: 2,
      start_time_sec: shotDur1,
      end_time_sec: shotDur1 + shotDur2,
      duration_sec: shotDur2,
      event_detail: `Medium character interaction: ${sc.visual_action || sc.event}`,
      character_action: 'Maya melangkah mendekat dengan percaya diri sambil memegang artefak silinder data.',
      camera_note: 'Medium Shot 50mm, Slight Low Angle, Smooth Dolly Tracking',
      dialogue: [
        {
          character_name: 'Kirana Maya',
          line: 'Waktu kita terbatas. Amankan silinder ini sekarang.',
        },
      ],
      emotion: 'Determinasi fokus',
      audio_note: 'Langkah sepatu di lantai basah dan desiran mantel',
      shot_type: 'MEDIUM_SHOT',
      camera_movement: 'Smooth Dolly Tracking',
      action: 'Interaksi tatap muka dan pertukaran objek',
      sound_effects: 'Langkah kaki berderap, hembusan napas terkontrol',
      version: 1,
      generation_status: 'prompt_ready',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const shot3: Shot = {
      id: shot3Id,
      scene_id: sceneId,
      project_id: projectId,
      shot_number: 3,
      start_time_sec: shotDur1 + shotDur2,
      end_time_sec: sc.duration_sec,
      duration_sec: shotDur3,
      event_detail: `Close-up intense reaction: ${sc.emotional_objective}`,
      character_action: 'Arya mengangguk mantap, tatapan matanya berkilat di bawah pendaran cahaya artefak.',
      camera_note: 'Close-Up 85mm f/1.4, Shallow Depth of Field, Static Frame',
      dialogue: [
        {
          character_name: 'Raden Arya',
          line: 'Dimengerti. Kita selesaikan ini bersama.',
        },
      ],
      emotion: 'Keyakinan mutlak',
      audio_note: 'Dengung frekuensi rendah dari artefak data',
      shot_type: 'CLOSE_UP',
      camera_movement: 'Static with Shallow Depth of Field',
      action: 'Fokus intensitas tatapan mata karakter',
      sound_effects: 'Dengung resonansi frekuensi rendah artefak',
      version: 1,
      generation_status: 'prompt_ready',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.saveShots(sceneId, projectId, [shot1, shot2, shot3]);

    log(6, 'Shot Subdivision Agent', `Scene #${scNum}: 3 Subdivisi Shot berhasil lolos audit sinematik. (0 Kuota)`, 'success');
    await delay(180);

    // --- STAGE 7: Master Frame Visual Prompt (NO NARRATION) ---
    log(7, 'Master Frame Prompt Agent', `Scene #${scNum}: Merumuskan prompt visual master frame 16:9 4K...`, 'info');
    await delay(200);

    // Purely visual image prompt without any spoken narrative text
    const masterImagePrompt = `Cinematic film still, 8k UHD, 35mm anamorphic photography. ${sc.event}. Location: ${sc.location_name}. Characters in scene: Raden Arya in rugged tactical black jacket and Kirana Maya in dark charcoal trenchcoat. Dramatic chiaroscuro lighting, neon cyan and amber reflections, volumetric atmospheric haze, octane render look, high dynamic range, masterwork cinematography --ar 16:9 --style raw`;

    await db.updateScene(sceneId, {
      master_image_prompt: masterImagePrompt,
      image_gen_status: 'success',
      full_scene_prompt_status: 'ready',
    });

    log(7, 'Master Frame Prompt Agent', `Scene #${scNum}: Master Frame Prompt 16:9 4K berhasil dirumuskan secara presisi. (0 Kuota)`, 'success');
    await delay(180);

    // --- STAGE 8: Video Prompt Agent (Seedance & Motion Engine) ---
    // STRICT RULE: ONLY Camera, Action, SFX, Ambient, Dialogue. NO NARRATION!
    log(8, 'Video Prompt Agent', `Scene #${scNum}: Mengompilasi Seedance video prompt (Diegetic Audio only, No Narration)...`, 'info');
    await delay(200);

    const shots = [shot1, shot2, shot3];

    for (const sh of shots) {
      const dialogueText = sh.dialogue && sh.dialogue.length > 0
        ? sh.dialogue.map((d) => `${d.character_name}: "${d.line}"`).join(', ')
        : '(Silent tension, focused breathing)';

      const videoPromptText = `[Camera Movement]: ${sh.camera_movement || 'Cinematic tracking'}, ${sh.camera_note}.\n[Action]: ${sh.character_action || sh.event_detail}.\n[SFX]: ${sh.sound_effects || 'Tetesan air hujan di aspal basah, desiran gesekan mantel kain'}.\n[Ambient]: Dering dengung frekuensi rendah kota malam hari, atmosfer berkabut.\n[Dialogue]: ${dialogueText}`;

      const vp: VideoPrompt = {
        id: `vp_${sh.id}_seedance`,
        shot_id: sh.id!,
        scene_id: sceneId,
        project_id: projectId,
        target_platform: 'seedance',
        prompt_target: 'seedance_10',
        generation_type: 'direct',
        status: 'ready',
        timeline_json: {
          prompt: videoPromptText,
          camera: sh.camera_movement,
          dialog: dialogueText,
          sfx_ambient: sh.sound_effects,
          clip_duration_sec: sh.duration_sec,
          resolved_duration_sec: sh.duration_sec,
        },
        negative_prompt: 'blurry, distorted, oversaturated, low quality, cartoon, anime, 3d render, narration voiceover',
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.saveVideoPrompts(sh.id!, sceneId, projectId, [vp]);
    }

    // Mark scene as READY
    await db.updateScene(sceneId, {
      status: 'ready',
      pipeline_status: 'READY',
      full_scene_prompt_status: 'ready',
    });

    log(8, 'Video Prompt Agent', `Scene #${scNum}: Seluruh video motion prompt siap produksi (status: 'READY'). (0 Kuota)`, 'success');
    await delay(150);
  }

  // Finalize Project
  await db.updateProject(projectId, (p) => ({
    ...p,
    status: 'completed',
    current_stage: 8,
    is_simulation: true,
    simulation_mode: true,
  }));

  log(
    8,
    'Simulation Engine',
    `🎉 [SIMULASI SUKSES] Seluruh ${scenesList.length}/${scenesList.length} adegan sinematik siap diproduksi! 0 Kuota AI digunakan. Proyek siap dibuka di Studio.`,
    'success'
  );

  return {
    success: true,
    runId,
    totalScenes: scenesList.length,
    readyScenes: scenesList.length,
  };
}
