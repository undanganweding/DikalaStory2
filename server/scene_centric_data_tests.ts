import { Scene } from '../src/types';
import { db } from './db';
import { sceneToVirtualShotAdapter } from './scene_adapter';

async function testSceneCentricDataMapping() {
  console.log("Running Phase B: Scene-Centric Data Mapping Tests");
  
  const mockScene: Scene = {
    id: 'scene_1',
    project_id: 'proj_1',
    scene_number: 1,
    title: 'Test Scene',
    duration_sec: 30,
    story_purpose: 'Testing',
    location_name: 'Test Location',
    time_of_day: 'Day',
    character_names: ['Char1'],
    emotional_objective: 'None',
    event: 'Test event',
    narrative_function: 'Testing',
    version: 1,
    updated_at: new Date().toISOString(),
    timeline: [{
      start_sec: 0,
      end_sec: 30,
      action: 'Action',
      performance: 'Performance',
      camera: { framing: 'wide' },
      composition: { layout: 'centered' },
      audio_note: 'Sound'
    }],
    character_refs: ['char_1'],
    object_refs: [],
    location_ref: 'loc_1'
  };

  const virtualShot = sceneToVirtualShotAdapter(mockScene);
  
  if (virtualShot.duration_sec !== 30) {
    throw new Error(`Test Failed: Duration mismatch. Expected 30, got ${virtualShot.duration_sec}`);
  }
  
  if (virtualShot.event_detail !== 'Test event') {
    throw new Error(`Test Failed: Event detail mismatch.`);
  }

  console.log("Tests Passed: Scene mapping confirmed.");
}

testSceneCentricDataMapping().catch(e => {
  console.error(e);
  process.exit(1);
});
