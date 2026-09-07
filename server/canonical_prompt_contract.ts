/**
 * DIKALASTORY CANONICAL PROMPT CONTRACT & MULTI-PROVIDER COMPILER
 * 
 * Intermediate Representation / Canonical Prompt Schema for SINEMA.
 * S1–S6 produce structured story, character, location, and shot data which is
 * compiled into this Canonical Shot Specification before being adapted by
 * provider-specific adapters (Banana Pro, Google Veo, Omni Flash, Seedance).
 */

import {
  Scene,
  Shot,
  ProjectFoundation,
  CharacterBible,
  LocationBible,
  ObjectBible,
  PromptTarget,
  ContextPackage,
  ContinuityState,
} from '../src/types';

// ============================================================================
// 1. CANONICAL PROMPT CONTRACT SCHEMA
// ============================================================================

export interface DikalaPromptContract {
  project: {
    project_id: string;
    episode_id?: string;
    scene_id: string;
    shot_id: string;
    sequence_id?: string;
  };

  narrative_intent: {
    story_role: string;
    narrative_purpose: string;
    emotional_goal: string;
    historical_context: string;
    temporal_context: string;
    geographic_context: string;
  };

  asset_lock: {
    characters: string[];
    character_ids: string[];
    locations: string[];
    location_ids: string[];
    props: string[];
    prop_ids: string[];
    costume_ids: string[];
    visual_style_id: string;
    master_frame_id: string;
  };

  visual: {
    composition: string;
    subject: string;
    appearance: string;
    wardrobe: string;
    environment: string;
    architecture: string;
    lighting: string;
    color_language: string;
    atmosphere: string;
    historical_accuracy: string;
    material_texture: string;
    depth: string;
  };

  action_motion: {
    primary_action: string;
    secondary_motion: string;
    character_motion: string;
    environmental_motion: string;
    prop_motion: string;
    motion_intensity: 'low' | 'medium' | 'high';
    temporal_progression: string;
  };

  camera: {
    shot_type: string;
    framing: string;
    camera_position: string;
    lens: string;
    focal_length: string;
    camera_height: string;
    camera_motion: string;
    camera_speed: string;
    focus: string;
    depth_of_field: string;
    stabilization: string;
  };

  audio: {
    dialogue: { speaker: string; line: string; delivery?: string } | null;
    speaker?: string;
    voice_direction?: string;
    ambient: string[];
    environmental_sfx: string[];
    action_sfx: string[];
    music: string | null;
    music_intensity?: string;
    silence: boolean;
    mixing_priority: string;
  };

  continuity: {
    previous_shot_state: string;
    next_shot_state: string;
    character_continuity: string;
    costume_continuity: string;
    prop_continuity: string;
    lighting_continuity: string;
    geography_continuity: string;
    screen_direction: string;
  };

  technical: {
    aspect_ratio: string;
    resolution: string;
    duration: number;
    fps: number;
    generation_mode: 'still' | 'video' | 'multimodal';
    seed?: number;
    reference_images: string[];
    image_strength?: number;
    motion_strength?: number;
  };

  weighting: {
    historical_priority: number;   // Level 0 (1.00)
    character_priority: number;    // Level 0 (1.00)
    costume_priority: number;      // Level 0 (0.95)
    location_priority: number;     // Level 0 (0.95)
    composition_priority: number;  // Level 1 (0.90)
    lighting_priority: number;     // Level 1 (0.85)
    props_priority: number;        // Level 1 (0.80)
    visual_priority: number;       // Level 2 (0.75)
    atmosphere_priority: number;   // Level 2 (0.70)
    motion_priority: number;       // Level 2 (0.65)
    camera_priority: number;       // Level 2 (0.65)
    audio_priority: number;        // Level 2 (0.60)
    style_priority: number;        // Level 3 (0.55)
  };

  negative: {
    prohibited_visuals: string[];
    prohibited_motion: string[];
    prohibited_camera: string[];
    prohibited_audio: string[];
    prohibited_anachronism: string[];
    prohibited_identity_changes: string[];
  };

  provenance: {
    prompt_version: string;
    compiler_version: string;
    provider: string;
    model: string;
    source: {
      story: string;
      characters: string;
      locations: string;
      narrative: string;
      scene: string;
      shot: string;
    };
    locks: {
      character: boolean;
      location: boolean;
      costume: boolean;
      props: boolean;
      historical: boolean;
      camera: boolean;
    };
  };
}

// ============================================================================
// 2. NEGATIVE PROMPT DICTIONARIES
// ============================================================================

export const NEGATIVE_PROMPT_BANANA = `modern clothing, modern architecture, concrete buildings, asphalt roads, cars, motorcycles, electric poles, electric wires, plastic objects, modern furniture, modern glass, modern signage, modern typography, logos, watermarks, smartphones, watches, synthetic modern fabrics, fantasy armor, European medieval clothing, Arabian desert architecture in Javanese settings, East Asian architecture, modern Indonesian architecture, incorrect historical period, anachronistic objects, historical inaccuracies, extra fingers, missing fingers, deformed hands, extra limbs, duplicated people, duplicate objects, distorted face, asymmetrical eyes, unnatural anatomy, plastic skin, overprocessed skin, multiple compositions, split screen, collage, multiple moments, text, subtitle, caption, UI, border, frame, watermark.`;

export const NEGATIVE_PROMPT_VEO = `cuts, jump cuts, montage, multiple shots, scene transition, camera teleportation, camera orbit, dramatic zoom, unmotivated camera movement, shaky camera, time-lapse, slow-motion unless specified, character identity change, face morphing, age change, costume change, prop disappearance, prop duplication, modern objects, modern architecture, modern clothing, vehicles, electricity, plastic, concrete, fantasy environment, supernatural effects, magical particles, excessive fog, exaggerated acting, theatrical gestures, unnatural walking, rubber-like cloth, floating objects, extra people, duplicated people, deformed anatomy, modern dialogue, modern accents, modern sound effects, music unless explicitly requested, text, subtitles, captions, logos, watermarks.`;

export const NEGATIVE_PROMPT_OMNI = `cuts, camera jumps, rapid zoom, character face morphing, costume change, historical inaccuracy, modern objects, cars, plastic, concrete roads, extra limbs, distorted anatomy, text, watermark, split screen, cartoon style, 3d render, fantasy magic effects.`;

export const NEGATIVE_PROMPT_SEEDANCE = `scene transition, shot transition, montage, camera teleportation, camera repositioning, automatic zoom, orbit, whip pan, dramatic dolly, identity morphing, face change, body transformation, age transformation, costume transformation, prop disappearance, prop duplication, object teleportation, environment transformation, architecture transformation, weather transformation, unnatural physics, floating objects, rubber cloth, excessive motion, exaggerated wind, exaggerated dust, extra characters, duplicate characters, extra limbs, modern objects, modern clothing, modern buildings, cars, motorcycles, electric poles, plastic objects, fantasy elements, magical effects, text, subtitle, logo, watermark.`;

// ============================================================================
// 3. CANONICAL SPEC COMPILER (Builds intermediate representation from data)
// ============================================================================

export function buildCanonicalPromptContract(
  scene: Scene,
  shot: Shot,
  foundation: ProjectFoundation | null,
  characters: CharacterBible[],
  locations: LocationBible[],
  objects: ObjectBible[],
  target: PromptTarget,
  durationSec: number = 10,
  contextPackage?: ContextPackage | null,
  continuityState?: ContinuityState | null
): DikalaPromptContract {
  const sceneChars = characters.filter((c) =>
    (scene.character_names || []).some((cn) => cn.toLowerCase() === c.name.toLowerCase())
  );
  const activeChar = sceneChars[0] || characters[0] || null;
  const activeLoc = locations.find((l) => l.name.toLowerCase() === (scene.location_name || '').toLowerCase()) || locations[0] || null;

  const charNames = sceneChars.map((c) => c.name);
  const charIds = sceneChars.map((c) => c.id || c.name);
  const charCostumes = sceneChars
    .map((c) => {
      const clothes = Array.isArray(c.clothing) ? c.clothing.join(', ') : (c.clothing || c.costume || c.wardrobe || 'traditional period attire');
      return `${c.name}: ${clothes}`;
    })
    .join('; ');
  const charAppearances = sceneChars
    .map((c) => `${c.name}: ${c.physical_appearance || c.physical_description || 'natural period features'}, ${c.age || 'adult'}, ${c.gender || 'male'}`)
    .join('; ');

  const locName = activeLoc ? activeLoc.name : (scene.location_name || 'Set');
  const locArch = activeLoc ? `${activeLoc.architectural_style || activeLoc.architecture || 'traditional structures'}, ${activeLoc.material || 'timber and natural materials'}` : 'Traditional vernacular architecture';
  const locEnv = activeLoc ? `${activeLoc.environment || activeLoc.landscape || 'natural atmospheric setting'}, ${activeLoc.color_palette ? activeLoc.color_palette.join(', ') : 'earth tones'}` : 'Natural historical landscape';
  const locEra = foundation?.era || 'Historical period';

  const primaryAction = shot.character_action || shot.action || scene.event || scene.visual_action || 'Character observes surroundings';
  const cameraShotType = shot.shot_type || 'medium_wide';
  const cameraMovement = shot.camera_movement || 'locked static cinematic framing';
  const cameraLens = shot.camera_note || '35mm anamorphic prime, natural perspective';

  // Dialogue extraction
  let dialogueObj: { speaker: string; line: string; delivery?: string } | null = null;
  if (shot.dialogue && shot.dialogue.length > 0) {
    dialogueObj = {
      speaker: shot.dialogue[0].character_name,
      line: shot.dialogue[0].line,
      delivery: 'tenang dan reflektif',
    };
  } else if (scene.dialogue && scene.dialogue.length > 0) {
    dialogueObj = {
      speaker: scene.dialogue[0].character_name,
      line: scene.dialogue[0].line,
      delivery: scene.dialogue[0].delivery || 'tenang dan reflektif',
    };
  }

  return {
    project: {
      project_id: scene.project_id || 'proj-01',
      episode_id: 'EP-01',
      scene_id: scene.id,
      shot_id: shot.id,
      sequence_id: `SEQ-${scene.scene_number}`,
    },
    narrative_intent: {
      story_role: scene.narrative_function || 'Narrative Establishment',
      narrative_purpose: scene.story_purpose || 'Establish scene context',
      emotional_goal: scene.emotional_objective || 'Grounded, contemplative, authentic',
      historical_context: locEra,
      temporal_context: scene.time_of_day || 'Late afternoon',
      geographic_context: locName,
    },
    asset_lock: {
      characters: charNames,
      character_ids: charIds,
      locations: [locName],
      location_ids: activeLoc ? [activeLoc.id] : [],
      props: objects.map((o) => o.name),
      prop_ids: objects.map((o) => o.id),
      costume_ids: ['COST_CANONICAL_01'],
      visual_style_id: 'STYLE_DIKALA_CINEMATIC_01',
      master_frame_id: `MF-${scene.id}`,
    },
    visual: {
      composition: 'Single-frame cinematic composition. Medium-wide shot. Character positioned slightly off-center. Strong environmental storytelling with layered depth.',
      subject: charAppearances || 'Adult historical figure',
      appearance: charAppearances || 'Weathered, natural period look',
      wardrobe: charCostumes || 'Historically plausible natural-fiber clothing in muted earth tones',
      environment: locEnv,
      architecture: locArch,
      lighting: 'Warm directional late-afternoon sunlight entering from camera side, soft natural shadows, subtle atmospheric diffusion',
      color_language: 'Muted natural earth tones, warm golden sunlight, subtle filmic contrast',
      atmosphere: scene.time_of_day ? `${scene.time_of_day}, calm atmospheric haze` : 'Calm atmospheric haze',
      historical_accuracy: 'Historically grounded materials, authentic traditional craft, zero modern anachronisms',
      material_texture: 'Handcrafted timber, handwoven textiles, damp earth, porous bamboo',
      depth: 'Natural foreground framing, sharp middle ground subject, soft atmospheric perspective in distant background',
    },
    action_motion: {
      primary_action: primaryAction,
      secondary_motion: 'Clothing moves slightly in the warm afternoon breeze, subtle breathing posture',
      character_motion: 'Subtle, dignified, restrained physical movement',
      environmental_motion: 'Leaves move gently in the background, dust settles naturally along the path',
      prop_motion: 'Natural weight and inertia of carried travel accessories',
      motion_intensity: 'low',
      temporal_progression: 'Starts in stable posture, progresses through subtle action beat, concludes in stable composition',
    },
    camera: {
      shot_type: cameraShotType,
      framing: 'Medium-wide static cinematic framing',
      camera_position: 'Eye/chest height level',
      lens: cameraLens,
      focal_length: '35mm equivalent',
      camera_height: 'Approximately 1.4m chest height',
      camera_motion: cameraMovement,
      camera_speed: 'Static / slow locked tracking',
      focus: 'Subject remains in sharp optical focus',
      depth_of_field: 'Cinematic shallow-to-medium depth of field with soft falloff',
      stabilization: 'Locked-off tripod stabilization, zero handheld jitter',
    },
    audio: {
      dialogue: dialogueObj,
      speaker: dialogueObj?.speaker,
      voice_direction: dialogueObj ? `Quiet, natural, reflective delivery: "${dialogueObj.line}"` : undefined,
      ambient: ['Soft natural ambient wind through trees', 'Distant natural birds', 'Subtle environment presence'],
      environmental_sfx: ['Very subtle cloth movement', 'Soft footstep contact with natural earth', 'Faint movement of carried items'],
      action_sfx: ['Natural interaction sound'],
      music: null,
      silence: false,
      mixing_priority: 'Diegetic ambient environment dominant, character Foley subtle, zero modern sound effects or trailer whooshes',
    },
    continuity: {
      previous_shot_state: 'Consistent lighting and spatial geography from prior beat',
      next_shot_state: 'Prepares visual flow for subsequent narrative action',
      character_continuity: 'Preserve facial identity, skin tone, hairstyle, and body proportions',
      costume_continuity: 'Exact weave, drapery, and dirt/wear marks maintained',
      prop_continuity: 'Same accessories held in the same hand',
      lighting_continuity: 'Warm late-afternoon sun angle preserved',
      geography_continuity: 'Spatial relationship between character and background architecture locked',
      screen_direction: 'Consistent left-to-right eye line and spatial staging',
    },
    technical: {
      aspect_ratio: '16:9',
      resolution: '4K Cinema Standard',
      duration: durationSec,
      fps: 24,
      generation_mode: target.includes('banana') ? 'still' : target.includes('omni') ? 'multimodal' : 'video',
      reference_images: [],
      image_strength: 0.85,
      motion_strength: 0.45,
    },
    weighting: {
      historical_priority: 1.00,
      character_priority: 1.00,
      costume_priority: 0.95,
      location_priority: 0.95,
      composition_priority: 0.90,
      lighting_priority: 0.85,
      props_priority: 0.80,
      visual_priority: 0.75,
      atmosphere_priority: 0.70,
      motion_priority: 0.65,
      camera_priority: 0.65,
      audio_priority: 0.60,
      style_priority: 0.55,
    },
    negative: {
      prohibited_visuals: ['modern clothing', 'concrete', 'asphalt', 'plastic', 'electricity', 'fantasy armor'],
      prohibited_motion: ['unmotivated zoom', 'camera teleportation', 'shaky cam', 'rubber cloth'],
      prohibited_camera: ['rapid whip-pan', 'dynamic gimbal orbit', 'sudden reframing'],
      prohibited_audio: ['modern music', 'electronic whooshes', 'synthetic reverb', 'trailer impacts'],
      prohibited_anachronism: ['modern watches', 'sunglasses', 'synthetic textiles', 'printed typography'],
      prohibited_identity_changes: ['face morphing', 'age shift', 'hair change', 'costume swap'],
    },
    provenance: {
      prompt_version: 'dikala-v3.2',
      compiler_version: 'compiler-v1.8',
      provider: target,
      model: target === 'banana_master_frame' || target === 'banana_image' ? 'banana-pro-2' : target === 'veo' ? 'veo-3.1' : target === 'omni' ? 'omni-flash-1.1' : 'seedance-2.5',
      source: {
        story: 'S1 Story Understanding',
        characters: 'S2 Character Bible',
        locations: 'S3 Location Bible',
        narrative: 'S4 Narrative Beats',
        scene: `S5 Scene #${scene.scene_number}`,
        shot: `S6 Shot #${shot.shot_number || 1}`,
      },
      locks: {
        character: true,
        location: true,
        costume: true,
        props: true,
        historical: true,
        camera: true,
      },
    },
  };
}

// ============================================================================
// 4. PROVIDER ADAPTERS
// ============================================================================

/**
 * Adapter 1: Banana Pro (Master Frame / Still Image)
 * Visual composition engine: Single frame of truth, strict historical grounding,
 * few-shot behavioral reference, comprehensive negative prompts.
 */
export function compileBananaProPrompt(spec: DikalaPromptContract): string {
  const isProphetScene = spec.asset_lock.characters.some((c) => /muhammad|rasulullah/i.test(c));
  const prophetNote = isProphetScene
    ? '\nPROPHETIC REVERENCE CONSTRAINT: Subject depicted from rear silhouette only. Zero facial depiction. Majestic humble wibawa preserved.'
    : '';

  return `[BANANA PRO 2 — CINEMATIC MASTER FRAME]

ROLE / DIRECTIVE:
You are DikalaStory's Cinematic Master Frame Generator.
Generate one historically grounded cinematic still frame.
Preserve character identity locks, costume locks, location locks, and historical period constraints.
Generate exactly ONE coherent cinematic composition. Zero modern elements or anachronisms.

CONTEXT:
Story: DikalaStory Historical Narrative
Historical Period: ${spec.narrative_intent.historical_context}
Location: ${spec.narrative_intent.geographic_context}
Narrative Context: ${spec.narrative_intent.narrative_purpose}
Emotional Tone: ${spec.narrative_intent.emotional_goal}

POSITIVE PROMPT:
Create a cinematic historical master frame depicting:
${spec.visual.subject} in ${spec.narrative_intent.geographic_context}.

CHARACTER:
${spec.visual.appearance}${prophetNote}

COSTUME:
${spec.visual.wardrobe}

PROPS:
${spec.asset_lock.props.length > 0 ? spec.asset_lock.props.join(', ') : 'Authentic period accessories and handcrafted items'}

ENVIRONMENT:
${spec.visual.environment}. ${spec.visual.architecture}.

LIGHTING:
${spec.visual.lighting}

COMPOSITION:
${spec.visual.composition}

VISUAL STYLE:
Photorealistic cinematic historical drama. Natural skin texture, physically plausible cloth behavior, subtle filmic contrast, controlled highlights. ${spec.visual.color_language}.

WEIGHT PRIORITY:
Historical accuracy = 1.00
Character identity = 1.00
Costume continuity = 0.95
Location continuity = 0.95
Composition = 0.90
Lighting = 0.85
Props = 0.80
Visual style = 0.75

NEGATIVE PROMPT:
${NEGATIVE_PROMPT_BANANA}`.trim();
}

/**
 * Adapter 2: Google Veo 3 / 3.1 (Video Prompt)
 * Continuous cinematic shot: Initial State -> Action -> Camera -> Environment -> Audio -> Temporal Constraint -> End State.
 */
export function compileVeoPrompt(spec: DikalaPromptContract): string {
  const duration = spec.technical.duration || 10;
  const isProphetScene = spec.asset_lock.characters.some((c) => /muhammad|rasulullah/i.test(c));
  const prophetNote = isProphetScene
    ? 'Reverence safeguard: Back view/silhouette only. Face strictly obscured.'
    : '';

  const audioSection = spec.audio.dialogue
    ? `AUDIO
AMBIENT:
${spec.audio.ambient.join('\n')}

SFX:
${spec.audio.environmental_sfx.join('\n')}

DIALOGUE:
Speaker: ${spec.audio.dialogue.speaker}
Language: Indonesian
Delivery: ${spec.audio.dialogue.delivery || 'Quiet, natural, reflective, low intensity'}
Line: "${spec.audio.dialogue.line}"
Lip sync: Accurate, subtle natural mouth movement. Do not add extra dialogue.

MUSIC:
No music.

MIX:
${spec.audio.mixing_priority}`
    : `AUDIO
AMBIENT:
${spec.audio.ambient.join('\n')}

SFX:
${spec.audio.environmental_sfx.join('\n')}

DIALOGUE:
No dialogue.

MUSIC:
No music.

MIX:
${spec.audio.mixing_priority}`;

  return `[VEO 3.1 — CINEMATIC VIDEO DIRECTIVE (${duration}s)]

SYSTEM PROMPT:
You are DikalaStory's Cinematic Video Director.
Generate a single continuous cinematic shot (${duration} seconds).
The shot must preserve the supplied character, location, costume, props, visual style, and spatial relationships.
Single continuous moment in time. No montage, no cut, no camera teleportation.

CONTEXT:
Episode: DikalaStory Historical Production
Scene: ${spec.narrative_intent.narrative_purpose}
Historical Period: ${spec.narrative_intent.historical_context}
Location: ${spec.narrative_intent.geographic_context}
Time of Day: ${spec.narrative_intent.temporal_context}
Continuity: Preserves master frame anchor. Costumes and props remain identical throughout.

POSITIVE PROMPT:
A cinematic photorealistic historical drama shot.
${spec.visual.subject}.
${spec.visual.wardrobe}.
${spec.asset_lock.props.length > 0 ? `Carries: ${spec.asset_lock.props.join(', ')}.` : ''}
${prophetNote}

The environment contains ${spec.visual.architecture}, ${spec.visual.environment}.

${spec.action_motion.primary_action}.
${spec.action_motion.secondary_motion}.
${spec.action_motion.environmental_motion}.

CAMERA:
${spec.camera.framing}.
Camera positioned at ${spec.camera.camera_height}.
${spec.camera.lens}.
${spec.camera.camera_motion}.
The camera remains locked-off throughout the shot.

LIGHTING:
${spec.visual.lighting}.

MOTION:
Only subtle natural movement. ${spec.action_motion.character_motion}. ${spec.action_motion.environmental_motion}. Zero exaggerated gestures.

TEMPORAL BEHAVIOR:
- 0:00–0:03: The shot begins with character established in composition. Subtle breathing.
- 0:03–0:07: Character performs primary action: ${spec.action_motion.primary_action}.
- 0:07–0:${String(duration).padStart(2, '0')}: Action resolves into stable resting composition.
Maintain continuous spatial and temporal coherence.

${audioSection}

NEGATIVE PROMPT:
${NEGATIVE_PROMPT_VEO}`.trim();
}

/**
 * Adapter 3: Omni Flash 1.1 (Multimodal Reasoning & Generation)
 * Multimodal reasoning + generation prompt: Reference tokens, visual directive,
 * motion directive, camera directive, strict priority ordering.
 */
export function compileOmniPrompt(spec: DikalaPromptContract): string {
  const isProphetScene = spec.asset_lock.characters.some((c) => /muhammad|rasulullah/i.test(c));

  return `[OMNI FLASH 1.1 — MULTIMODAL CINEMATIC AGENT]

SYSTEM ROLE:
You are DikalaStory's Multimodal Cinematic Reasoning Agent.
You receive story context, character assets, location assets, visual references, continuity constraints, and shot specifications.
Synthesize these inputs into one coherent cinematic visual result.

PRIORITY ORDER:
1. Narrative correctness
2. Character identity & reverence lock
3. Historical accuracy
4. Spatial continuity
5. Required props & costumes
6. Composition
7. Lighting
8. Cinematic style

CONTEXT:
PROJECT: DikalaStory
SCENE: ${spec.project.scene_id}
SHOT: ${spec.project.shot_id}
STORY PURPOSE: ${spec.narrative_intent.narrative_purpose}
HISTORICAL PERIOD: ${spec.narrative_intent.historical_context}
LOCATION: ${spec.narrative_intent.geographic_context}
VISUAL REFERENCES: [CHARACTER_REF_01], [LOCATION_REF_01], [PROP_REF_01]

CONTINUITY:
Character appearance must match CHARACTER_REF_01.
Architecture must match LOCATION_REF_01.
${isProphetScene ? 'Prophetic reverence doctrine: Zero facial depiction, silhouette / rear framing only.' : ''}

VISUAL DIRECTIVE:
Create a cinematic photorealistic historical frame.
SUBJECT: ${spec.visual.subject}
CHARACTER: Preserve exact identity from reference assets.
WARDROBE: ${spec.visual.wardrobe}
PROPS: ${spec.asset_lock.props.join(', ') || 'Authentic period items'}
LOCATION: ${spec.narrative_intent.geographic_context}. ${spec.visual.architecture}.
LIGHT: ${spec.visual.lighting}
COMPOSITION: ${spec.visual.composition}
MOOD: ${spec.narrative_intent.emotional_goal}

MOTION:
Primary: ${spec.action_motion.primary_action}
Secondary: ${spec.action_motion.secondary_motion}
Environmental: ${spec.action_motion.environmental_motion}
Motion strength: Low. Physical realism: High.

CAMERA:
Shot: ${spec.camera.shot_type}
Lens: ${spec.camera.lens}
Height: ${spec.camera.camera_height}
Movement: ${spec.camera.camera_motion}
Focus: Character remains primary focus with natural environmental depth.

NEGATIVE PROMPT:
${NEGATIVE_PROMPT_OMNI}`.trim();
}

/**
 * Adapter 4: Seedance (Motion-First Video)
 * Motion-first generation engine: Temporal action timeline (0-2s, 2-5s, 5-7s, 7-10s),
 * environmental motion, camera, continuity, ending state, motion negative prompt.
 */
export function compileSeedancePrompt(spec: DikalaPromptContract): string {
  const duration = spec.technical.duration || 10;
  const isProphetScene = spec.asset_lock.characters.some((c) => /muhammad|rasulullah/i.test(c));

  return `[SEEDANCE 2.5 — MOTION-FIRST CINEMATIC DIRECTIVE]

SYSTEM PROMPT:
You are DikalaStory's Cinematic Motion Director.
Generate one coherent continuous shot from the provided visual state (${duration} seconds).
Preserve character identity, costume, props, location, lighting, and composition.
Motion must evolve naturally over time.
The first frame and final frame must remain visually consistent.

START STATE:
${spec.visual.subject} stands in ${spec.narrative_intent.geographic_context}.
Costume: ${spec.visual.wardrobe}.
Props: ${spec.asset_lock.props.join(', ') || 'Period accessories'}.
Environment: ${spec.visual.architecture}, ${spec.visual.environment}.
${isProphetScene ? 'Reverence lock: Face obscured, dignified sacred presence.' : ''}

ACTION TIMELINE:
0–2 seconds:
The character stands established in position. Only subtle breathing and environmental movement occur.

2–5 seconds:
${spec.action_motion.primary_action}.

5–7 seconds:
${spec.action_motion.secondary_motion}. Subtle posture shift maintaining narrative weight.

7–${duration} seconds:
Character remains in stable resting position for a brief contemplative resolution.

CAMERA:
${spec.camera.framing}.
${spec.camera.camera_motion}.

ENVIRONMENTAL MOTION:
${spec.action_motion.environmental_motion}.

LIGHTING:
Consistent ${spec.visual.lighting} throughout the entire shot.

CONTINUITY:
Props remain in the same hands. Clothing does not change. Character identity does not change. The environment does not transform.

ENDING STATE:
Same location. Same character. Same costume. Same props. Same lighting. Same camera composition.

NEGATIVE PROMPT:
${NEGATIVE_PROMPT_SEEDANCE}`.trim();
}
