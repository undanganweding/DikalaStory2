import { db } from '../server/db';
import * as fs from 'fs';

async function main() {
  try {
    const projects = await db.listProjects();
    const result: any[] = [];
    for (const p of projects) {
      const scenes = await db.getScenes(p.id);
      const projInfo: any = {
        id: p.id,
        title: p.title,
        status: p.status,
        scenesCount: scenes.length,
        scenes: []
      };
      for (const sc of scenes) {
        const shots = await db.getShotsByScene(sc.id);
        projInfo.scenes.push({
          scene_number: sc.scene_number,
          title: sc.title,
          character_names: sc.character_names,
          location_name: sc.location_name,
          story_purpose: sc.story_purpose,
          event: sc.event,
          has_master_image_prompt: !!sc.master_image_prompt,
          master_image_prompt_sample: sc.master_image_prompt ? sc.master_image_prompt.slice(0, 120) : null,
          shots_count: shots.length,
          shots: shots.map(sh => ({
            shot_number: sh.shot_number,
            action: sh.action,
            visual_description: sh.visual_description,
            character_action: sh.character_action,
            event_detail: sh.event_detail,
            audio_narration: sh.audio_narration,
            sound_effects: sh.sound_effects,
            audio_note: (sh as any).audio_note,
            dialogue: sh.dialogue,
            has_master_image_prompt: !!sh.master_image_prompt,
            has_video_prompt: !!sh.video_prompt,
          }))
        });
      }
      result.push(projInfo);
    }
    fs.writeFileSync('db_audit_report.json', JSON.stringify(result, null, 2));
    console.log('AUDIT COMPLETED. Report saved to db_audit_report.json');
  } catch (err) {
    console.error('AUDIT ERROR:', err);
  }
}

main().then(() => process.exit(0));
