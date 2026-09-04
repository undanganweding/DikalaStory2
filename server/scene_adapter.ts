import { Scene } from '../src/types';

export const sceneToVirtualShotAdapter = (scene: Scene) => {
  return {
    shot_number: 1,
    start_time_sec: 0,
    end_time_sec: scene.duration_sec,
    duration_sec: scene.duration_sec,
    event_detail: scene.event || scene.action_summary || '',
    character_action: scene.action_summary || '',
    camera_note: scene.master_camera 
      ? `${scene.master_camera.framing || ''} ${scene.master_camera.angle || ''} ${scene.master_camera.movement || ''}`.trim()
      : 'Eye-level, medium shot, static',
    dialogue: scene.timeline.flatMap(t => t.dialogue || []),
    emotion: scene.scene_tone?.atmosphere || '',
    audio_note: scene.timeline.map(t => t.audio_note).join('; ') || 'Scene ambient audio',
  };
};
