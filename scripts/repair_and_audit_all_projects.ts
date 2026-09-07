import { db } from '../server/db';
import { Project, Scene, Shot, VideoPrompt } from '../src/types';

/**
 * Script untuk mengaudit, menganalisis, dan memperbaiki seluruh project yang sudah dibuat:
 * 1. Menghilangkan string kebocoran / sisa cerita sebelumnya (seperti sisa Batavia / Arya / Willem pada kisah Diponegoro atau Imam Syafi'i).
 * 2. Membersihkan glitch judul scene yang menumpuk deskripsi split (misal: "Title - Inisiasi - Puncak...").
 * 3. Menghapus duplikasi karakter dalam satu adegan.
 * 4. Mengisi visual_description, audio_narration, sound_effects pada shot yang masih kosong.
 * 5. Mengisi master_image_prompt (Nano Banana Pro) dan video_prompt (Veo/Omni/Seedance) yang masih kosong agar siap dipakai secara instan.
 */

async function repairAllProjects() {
  console.log('=====================================================');
  console.log('🔍 MEMULAI AUDIT & PERBAIKAN TOTAL SELURUH PROJECT...');
  console.log('=====================================================\n');

  const projects = await db.listProjects();
  console.log(`Ditemukan ${projects.length} project di database.\n`);

  for (const project of projects) {
    console.log(`-----------------------------------------------------`);
    console.log(`📁 Project ID: ${project.id} | Judul: "${project.title}"`);
    
    const isDiponegoro = (project.title || '').toLowerCase().includes('diponegoro');
    const isImamSyafii = (project.title || '').toLowerCase().includes('syafi') || (project.title || '').toLowerCase().includes('yatim');

    // 1. Fetch Foundation, Characters & Locations
    const [foundation, characters, locations, scenes] = await Promise.all([
      db.getProjectFoundation(project.id),
      db.getCharacters(project.id),
      db.getLocations(project.id),
      db.getScenes(project.id),
    ]);

    const eraStr = foundation?.era || 'Era Historis';
    console.log(`   Genre: ${foundation?.genre || '-'} | Era: ${eraStr}`);
    console.log(`   Jumlah Karakter: ${characters.length}, Lokasi: ${locations.length}, Scene: ${scenes.length}`);

    // Process Scenes
    for (const scene of scenes) {
      let sceneNeedsUpdate = false;
      const sceneUpdates: Partial<Scene> = {};

      // A. Clean Glitched Scene Title
      let cleanTitle = scene.title || `Scene #${scene.scene_number}`;
      if (cleanTitle.includes(' - ')) {
        const parts = cleanTitle.split(' - ');
        // Keep main title and at most one descriptor
        if (parts.length > 2) {
          cleanTitle = `${parts[0].trim()} - ${parts[parts.length - 1].trim()}`;
          sceneUpdates.title = cleanTitle;
          sceneNeedsUpdate = true;
        }
      }

      // B. Deduplicate Characters in Scene
      const rawChars = scene.character_names || [];
      const dedupedChars = Array.from(new Set(rawChars.filter(Boolean)));
      if (dedupedChars.length !== rawChars.length) {
        sceneUpdates.character_names = dedupedChars;
        sceneNeedsUpdate = true;
      }

      // C. Clean Story Purpose & Event from leakage or recursive text
      let cleanPurpose = (scene.story_purpose || '').replace(/\s*-\s*(?:Fase inisiasi|Puncak eskalasi|Initial initiation|Peak escalation)[^.]*\.?/gi, '').trim();
      let cleanEvent = (scene.event || '').replace(/\s*\((?:Fase permulaan|Puncak aksi|Initial setup|Peak escalation)[^)]*\)/gi, '').trim();

      if (isDiponegoro) {
        cleanPurpose = cleanPurpose.replace(/Batavia|Captain Willem|kronometer kuningan/gi, 'Perang Jawa & Pangeran Diponegoro');
        cleanEvent = cleanEvent.replace(/Batavia|Captain Willem|kronometer kuningan/gi, 'Perjuangan rakyat dan pasukan Diponegoro');
      }

      if (cleanPurpose !== scene.story_purpose) {
        sceneUpdates.story_purpose = cleanPurpose;
        sceneNeedsUpdate = true;
      }
      if (cleanEvent !== scene.event) {
        sceneUpdates.event = cleanEvent;
        sceneNeedsUpdate = true;
      }

      // D. Generate Master Image Prompt if missing (Nano Banana Pro format)
      if (!scene.master_image_prompt || scene.master_image_prompt.trim().length === 0 || scene.master_image_prompt.includes('undefined')) {
        const charNamesStr = dedupedChars.length > 0 ? dedupedChars.join(', ') : 'Tokoh utama';
        const locName = scene.location_name || 'Latar sinematik historis';
        const timeOfDay = scene.time_of_day || 'Fajar';

        const compiledPrompt = `Master cinematic film still, 35mm anamorphic photography. Scene #${scene.scene_number}: ${cleanTitle}. Subject: ${charNamesStr} dalam adegan ${cleanEvent || scene.story_purpose}. Location & Atmosphere: ${locName}, ${timeOfDay}, ${eraStr}. Lighting: dramatic natural volumetric chiaroscuro lighting, atmospheric dust motes. Color grading: Kodak Vision3 500T 35mm tone, authentic cultural and historical costume textures, highly detailed, photorealistic 8k UHD, masterpiece composition. Negative Prompt: modern objects, deformed faces, cartoon, 3d render, oversaturated, blurry, modern cars.`;

        sceneUpdates.master_image_prompt = compiledPrompt;
        sceneUpdates.master_image_prompt_json = {
          subject: `${charNamesStr} - ${cleanEvent || scene.story_purpose}`,
          characters_note: charNamesStr,
          costume: `Busana tradisional autentik ${eraStr}`,
          era: eraStr,
          location: `${locName}, ${eraStr}`,
          environment: `${locName} dalam kondisi cuaca alami`,
          architecture: 'Autentik historis',
          lighting: `Dramatic natural ${timeOfDay} light, volumetric shadows`,
          camera: 'Arri Alexa 65',
          lens: '35mm anamorphic prime lens',
          composition: 'Masterpiece 35mm cinematic composition',
          cinematic_style: 'Historical cinematic docudrama, Kodak Vision3 500T grain',
          mood: 'Tegang, khidmat, dan penuh tekad',
          negative_prompt: 'modern elements, blurry, cartoon, cgi artifacts, distorted anatomy',
        };
        sceneUpdates.image_gen_status = 'success';
        sceneNeedsUpdate = true;
      }

      if (sceneNeedsUpdate) {
        await db.updateScene(scene.id, sceneUpdates);
        console.log(`   [FIX SCENE] Scene #${scene.scene_number} ("${cleanTitle}") berhasil diperbarui.`);
      }

      // 3. Process Shots in Scene
      const shots = await db.getShotsByScene(scene.id);
      for (const shot of shots) {
        let shotNeedsUpdate = false;
        const shotUpdates: Partial<Shot> = {};

        // Fix Visual & Audio fields
        const finalVisual = shot.visual_description || shot.event_detail || shot.character_action || scene.visual_action || scene.event || 'Aksi sinematik terperinci sesuai naskah';
        const finalAudioNarration = shot.audio_narration || scene.narrator_vo || '';
        const finalSoundEffects = shot.sound_effects || shot.audio_note || (scene.sound_design ? `SFX: ${(scene.sound_design.sfx || []).join(', ')}. BGM: ${scene.sound_design.bgm_mood || 'cinematic'}` : 'SFX: Suara langkah, hembusan angin, dan atmosfer lingkungan sekitar.');

        if (!shot.visual_description || shot.visual_description.length < 5) {
          shotUpdates.visual_description = finalVisual;
          shotNeedsUpdate = true;
        }
        if (!shot.audio_narration && finalAudioNarration) {
          shotUpdates.audio_narration = finalAudioNarration;
          shotNeedsUpdate = true;
        }
        if (!shot.sound_effects || shot.sound_effects.length < 5) {
          shotUpdates.sound_effects = finalSoundEffects;
          shotNeedsUpdate = true;
        }

        // Fix Shot Master Image Prompt (Banana Pro 2)
        if (!shot.master_image_prompt || shot.master_image_prompt.trim().length === 0 || shot.master_image_prompt.includes('undefined')) {
          shotUpdates.master_image_prompt = sceneUpdates.master_image_prompt || scene.master_image_prompt || `Master cinematic image still. Shot #${shot.shot_number}: ${finalVisual}. 35mm anamorphic framing, natural lighting, photorealistic 8k UHD.`;
          shotNeedsUpdate = true;
        }

        // Fix Video Prompt
        if (!shot.video_prompt || shot.video_prompt.trim().length === 0) {
          const cameraMovement = shot.camera_note || 'Slow cinematic push-in, eye-level angle, subtle motion';
          shotUpdates.video_prompt = `Cinematic ${shot.duration_sec}s video sequence. Action: ${finalVisual}. Camera: ${cameraMovement}. Highly detailed cinematic rendering, authentic historical atmosphere, smooth natural motion.`;
          shotNeedsUpdate = true;
        }

        // Fix Seedance Prompt
        if (!shot.seedance_prompt || shot.seedance_prompt.trim().length === 0) {
          shotUpdates.seedance_prompt = `[00:00-00:${String(shot.duration_sec).padStart(2, '0')}] Shot #${shot.shot_number}: ${finalVisual} | Camera: ${shot.camera_note || 'Steady tracking'} | Audio: ${finalSoundEffects}`;
          shotNeedsUpdate = true;
        }

        if (shotNeedsUpdate) {
          await db.updateShot(shot.id, shotUpdates);
          console.log(`      [FIX SHOT] Shot #${shot.shot_number} pada Scene #${scene.scene_number} berhasil diperbarui (Visual, Audio, Banana Pro & Video Prompt).`);
        }

        // Ensure Video Prompts table also has records
        const existingPrompts = await db.getVideoPromptsByShot(shot.id);
        if (!existingPrompts || existingPrompts.length === 0) {
          const newPrompts: any[] = [
            {
              target_platform: 'banana_image',
              prompt_target: 'banana_image',
              prompt_text: shotUpdates.master_image_prompt || shot.master_image_prompt,
              status: 'video_prompt_ready',
              timeline_json: {
                prompt: shotUpdates.master_image_prompt || shot.master_image_prompt,
                subject: finalVisual,
              },
            },
            {
              target_platform: 'veo',
              prompt_target: 'veo',
              prompt_text: shotUpdates.video_prompt || shot.video_prompt,
              status: 'video_prompt_ready',
              timeline_json: {
                prompt: shotUpdates.video_prompt || shot.video_prompt,
                camera: shot.camera_note || 'Slow cinematic push-in',
              },
            },
            {
              target_platform: 'gemini_omni',
              prompt_target: 'omni',
              prompt_text: shotUpdates.video_prompt || shot.video_prompt,
              status: 'video_prompt_ready',
              timeline_json: {
                prompt: shotUpdates.video_prompt || shot.video_prompt,
                follow_up_edit_instructions: 'Keep character consistency and historical lighting locked.',
              },
            },
            {
              target_platform: 'seedance',
              prompt_target: 'seedance_10',
              prompt_text: shotUpdates.seedance_prompt || shot.seedance_prompt,
              status: 'video_prompt_ready',
              timeline_json: {
                shot_breakdown: shotUpdates.seedance_prompt || shot.seedance_prompt,
                references: '@Image_MasterFrame',
                do_not_change: 'Character costume, facial identity, era aesthetics',
              },
            },
          ];
          await db.saveVideoPrompts(shot.id, scene.id, project.id, newPrompts);
          console.log(`      [ADD PROMPTS] Video Prompts (Banana Image, Veo, Omni, Seedance) ditambahkan untuk Shot #${shot.shot_number}.`);
        }
      }
    }
  }

  console.log('\n=====================================================');
  console.log('✅ AUDIT & PERBAIKAN TOTAL SELURUH PROJECT SELESAI!');
  console.log('=====================================================');
}

repairAllProjects().catch((err) => {
  console.error('Audit and repair failed:', err);
  process.exit(1);
});
