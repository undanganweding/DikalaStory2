
import { db } from './db';

async function auditProject(projectId: string) {
  const scenes = await db.getScenes(projectId);
  const shots = await db.getShotsByProject(projectId);
  const characters = await db.getCharacters(projectId);
  
  console.log(`Auditing Project: ${projectId}`);
  console.log(`Scenes: ${scenes?.length}`);
  console.log(`Shots: ${shots?.length}`);
  console.log(`Characters: ${characters?.length}`);

  for (const scene of scenes || []) {
      console.log(`Scene ${scene.scene_number}: ${scene.event}`);
      // Audit for character names, continuity
      const sceneShots = shots?.filter(s => s.scene_id === scene.id);
      console.log(`  Shots: ${sceneShots?.length}`);
      if (sceneShots && sceneShots.length > 0) {
          console.log(`  Visuals: ${sceneShots[0].video_prompt.slice(0, 50)}...`);
      }
  }
}

auditProject('e2e_full_1788214619633_o4lu09').catch(console.error);
