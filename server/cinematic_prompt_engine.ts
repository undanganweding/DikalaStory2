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
import {
  buildCanonicalProductionContext,
  resolveSceneContext,
  resolveShotContext,
  validatePromptAgainstContext,
  isReveredHolyFigure,
} from './canonical_context_engine';
import {
  serializeAudioPurityConstraintBlock,
  validateAudioPurityContract,
} from './audio_purity_engine';

export type { PromptTarget };

export type PromptDetailLevel = 'basic' | 'standard' | 'detailed' | 'cinematic' | 'maximum';
export type VideoModelTarget = 'veo' | 'gemini_omni' | 'seedance' | 'seedance_10' | 'seedance_30' | 'banana';

export interface MasterSceneData {
  project_title: string;
  episode?: string;
  scene_number: number;
  scene_title: string;
  scene_purpose: string;
  story_context: string;
  duration_sec: number;
  aspect_ratio: string;
  model_target: VideoModelTarget;
  detail_level: PromptDetailLevel;
  is_prophet_scene: boolean;

  characters: {
    name: string;
    identity: string;
    age: string;
    gender: string;
    appearance: string;
    face_locked: boolean;
    prophet_restrictions: boolean;
    costume: string[];
    costume_structure?: any;
    hair?: string;
    beard?: string;
    movement_style?: string;
    accessories: string[];
    pose_expression: string;
    action: string;
  }[];

  location: {
    place: string;
    era: string;
    architecture: string;
    geography: string;
    environment: string;
    background: string;
    foreground: string;
    props: string[];
  };

  time: {
    time_of_day: string;
    season: string;
    weather: string;
    atmosphere: string;
  };

  action: {
    primary: string;
    secondary: string;
    interaction: string;
    environmental_reaction: string;
  };

  camera: {
    shot_type: string;
    angle: string;
    position: string;
    lens: string;
    focal_length: string;
    movement: string;
    speed: string;
    framing: string;
    focus: string;
    depth_of_field: string;
  };

  lighting: {
    source: string;
    direction: string;
    intensity: string;
    color_temperature: string;
    shadows: string;
    atmosphere: string;
  };

  visual_style: {
    realism: string;
    cinematic_style: string;
    material_realism: string;
    color_grading: string;
    film_texture: string;
    contrast: string;
  };

  mood: {
    emotion: string;
    tension: string;
    atmosphere: string;
  };

  continuity: {
    character_lock: boolean;
    clothing_lock: boolean;
    location_lock: boolean;
    prop_lock: boolean;
    lighting_lock: boolean;
    style_lock: boolean;
    camera_lock?: boolean;
    composition_lock?: boolean;
  };

  composition?: {
    layout: string;
    subject_placement: string;
    visual_balance: string;
    foreground: string;
    background: string;
    spatial_relationship: string;
  };

  negative_prompt_modules: {
    anatomy: string[];
    identity: string[];
    clothing: string[];
    environment: string[];
    camera: string[];
    physics: string[];
    quality: string[];
    output: string[];
  };
  grounding_context?: string;
}

function parseLegacyCameraNote(note: string, field: 'lens' | 'angle' | 'focal_length' | 'movement' | 'depth_of_field' | 'framing'): string | null {
  if (!note) return null;
  const n = note.toLowerCase();
  if (field === 'lens') {
    if (n.includes('24mm')) return '24mm wide angle lens';
    if (n.includes('35mm')) return '35mm anamorphic prime lens';
    if (n.includes('50mm')) return '50mm standard prime lens';
    if (n.includes('85mm')) return '85mm portrait telephoto lens';
    if (n.includes('prime')) return 'anamorphic prime lens';
    if (n.includes('telephoto')) return 'telephoto lens';
    if (n.includes('wide')) return 'wide-angle cinema lens';
    return null;
  }
  if (field === 'angle') {
    if (n.includes('low-angle') || n.includes('low angle')) return 'low-angle perspective';
    if (n.includes('high-angle') || n.includes('high angle')) return 'high-angle perspective';
    if (n.includes('dutch-angle') || n.includes('dutch angle') || n.includes('canted')) return 'dutch-angle perspective';
    if (n.includes('birds-eye') || n.includes('birds eye') || n.includes('aerial')) return "bird's-eye aerial view";
    if (n.includes('eye-level') || n.includes('eye level') || n.includes('level')) return 'eye-level perspective';
    return null;
  }
  if (field === 'focal_length') {
    if (n.includes('24mm')) return '24mm focal length';
    if (n.includes('35mm')) return '35mm focal length';
    if (n.includes('50mm')) return '50mm focal length';
    if (n.includes('85mm')) return '85mm focal length';
    return null;
  }
  if (field === 'movement') {
    if (n.includes('push in') || n.includes('dolly in')) return 'subtle dolly push in';
    if (n.includes('pull out') || n.includes('dolly out')) return 'subtle dolly pull out';
    if (n.includes('tracking') || n.includes('track')) return 'smooth horizontal tracking shot';
    if (n.includes('panning') || n.includes('pan')) return 'slow cinematic camera pan';
    if (n.includes('tilting') || n.includes('tilt')) return 'slow dramatic camera tilt';
    if (n.includes('static') || n.includes('fixed')) return 'completely static locked tripod camera';
    return null;
  }
  if (field === 'depth_of_field') {
    if (n.includes('shallow') || n.includes('bokeh') || n.includes('f/1.8') || n.includes('f/2.8') || n.includes('blurry background')) return 'shallow depth of field with cinematic f/1.8 bokeh';
    if (n.includes('deep') || n.includes('sharp background') || n.includes('f/8')) return 'deep depth of field with fully sharp background elements';
    return null;
  }
  if (field === 'framing') {
    if (n.includes('wide') || n.includes('long shot') || n.includes('landscape')) return 'wide environment establishing framing';
    if (n.includes('medium') || n.includes('mid shot') || n.includes('waist')) return 'medium waist-up framing';
    if (n.includes('close-up') || n.includes('close up') || n.includes('detail')) return 'extreme detail close-up framing';
    return null;
  }
  return null;
}

function parseLegacyComposition(
  compField: 'layout' | 'subject_placement' | 'visual_balance' | 'foreground' | 'background' | 'spatial_relationship',
  shot: Shot,
  eventDetail: string,
  cameraNote: string
): string {
  const text = `${eventDetail} ${cameraNote} ${shot?.character_action || ''}`.toLowerCase();
  
  if (compField === 'layout') {
    if (text.includes('rule of thirds') || text.includes('thirds')) return 'rule-of-thirds layout';
    if (text.includes('center') || text.includes('symmetrical') || text.includes('symmetry')) return 'centered symmetrical composition';
    if (text.includes('negative space')) return 'minimalist layout utilizing extensive negative space';
    if (text.includes('golden ratio')) return 'golden spiral visual flow';
    return 'balanced classical cinematic composition';
  }
  if (compField === 'subject_placement') {
    if (text.includes('right third') || text.includes('right side')) return 'subject positioned in the right third of the frame';
    if (text.includes('left third') || text.includes('left side')) return 'subject positioned in the left third of the frame';
    if (text.includes('centered') || text.includes('middle')) return 'subject centered in the middle of the frame';
    if (text.includes('background') || text.includes('far away')) return 'subject deep in the background';
    if (text.includes('foreground') || text.includes('close to')) return 'subject prominently in the foreground';
    return 'subject in comfortable midground placement';
  }
  if (compField === 'visual_balance') {
    if (text.includes('asymmetric') || text.includes('unbalanced')) return 'dynamic asymmetrical balance';
    if (text.includes('symmetrical') || text.includes('centered')) return 'formal symmetrical balance';
    return 'harmonic organic visual balance';
  }
  if (compField === 'foreground') {
    if (text.includes('foreground object') || text.includes('obstructed') || text.includes('looking through')) {
      return 'foreground framed with partially out-of-focus environmental elements';
    }
    return 'clean open foreground leading viewer attention to subject';
  }
  if (compField === 'background') {
    return 'background filled with atmospheric period-appropriate context';
  }
  if (compField === 'spatial_relationship') {
    if (shot?.character_refs && shot.character_refs.length > 1) {
      return 'two subjects positioned in close proximity, emphasizing relational dynamic';
    }
    return 'single subject isolated, emphasizing environment scale';
  }
  return '';
}

/**
 * Semantic Scene Interpreter: Translates raw story event and entities into concrete visual & cinematic instructions.
 */
export function serializeMasterSceneData(
  scene: Scene,
  shots: Shot[],
  foundation: ProjectFoundation | null,
  characters: CharacterBible[],
  locations: LocationBible[],
  objects: ObjectBible[],
  target: VideoModelTarget = 'veo',
  detailLevel: PromptDetailLevel = 'cinematic',
  projectTitle: string = 'Cinematic Production',
  resolvedDuration?: number,
  contextPackage?: ContextPackage | null,
  continuityState?: ContinuityState | null
): MasterSceneData {
  // Build authoritative Canonical Production Context
  const canonicalContext = buildCanonicalProductionContext({
    project: {
      id: scene.project_id,
      title: projectTitle,
      raw_script: scene.event || scene.title,
      total_duration_target_sec: 0,
      max_scene_shot_duration_sec: null,
      prompt_language: 'id',
      image_model: 'nano_banana_pro',
      video_model: ['veo', 'gemini_omni'],
      include_seedance_format: true,
      created_at: '',
      updated_at: '',
      status: 'draft',
    },
    foundation,
    characters,
    locations,
    objects,
    contextPackage,
    continuityState,
  });

  const sceneContext = resolveSceneContext(canonicalContext, scene, shots);
  const duration = resolvedDuration || scene.duration_sec || 10;
  const visualTone = foundation?.visual_tone || 'Cinematic Panavision anamorphic, 35mm film grain';

  const eventText = (scene.event || scene.title || '').toLowerCase();
  const isProphetScene =
    eventText.includes('rasulullah') ||
    eventText.includes('muhammad') ||
    scene.character_names?.some((c) => c.toLowerCase().includes('rasulullah') || c.toLowerCase().includes('muhammad'));

  // Use resolved characters from canonical context
  const characterEntries = sceneContext.characters.map((c) => {
    return {
      name: c.name,
      identity: c.prophetRestrictions
        ? 'Prophetic character (Strict visual restrictions applied)'
        : `Locked face & identity for ${c.name} (${c.ethnicityOrCulturalAppearance})`,
      age: c.age || 'Adult',
      gender: c.gender || 'Unknown',
      appearance: c.faceDescription || (c as any).physical_appearance || 'Authentic period appearance',
      face_locked: c.faceLocked,
      prophet_restrictions: c.prophetRestrictions,
      costume: c.costume,
      costume_structure: (c as any).costume_structure || (c as any).costumeStructure,
      hair: c.hair,
      beard: (c as any).beard,
      movement_style: (c as any).movement_style,
      accessories: c.accessories,
      pose_expression: c.prophetRestrictions
        ? 'Composed, silent, purposeful movement, rear/side silhouette profile'
        : (scene.emotional_objective || 'Dignified, focused expression'),
      action: scene.event || 'Engaged in narrative action',
    };
  });

  if (characterEntries.length === 0 && isProphetScene) {
    characterEntries.push({
      name: 'Rasulullah ﷺ',
      identity: 'Prophetic figure',
      age: 'Mature',
      gender: 'Male',
      appearance: 'Dignified posture, traditional period robes',
      face_locked: false,
      prophet_restrictions: true,
      costume: ['Traditional modest historical outer garment, dark cloak'],
      costume_structure: undefined,
      hair: '',
      beard: '',
      movement_style: '',
      accessories: [],
      pose_expression: 'Quiet purposeful movement, seen from rear or profile silhouette',
      action: scene.event || 'Quietly exiting residence',
    });
  }

  const activeLoc = sceneContext.location;
  const locationEntry = {
    place: activeLoc.name || scene.location_name || 'Historical Setting',
    era: sceneContext.eraLock.period,
    architecture: activeLoc.architecture || 'Authentic period architectural construction',
    geography: activeLoc.terrain || activeLoc.environment || 'Authentic regional landscape',
    environment: activeLoc.environment || 'Authentic environment setting',
    background: `${activeLoc.architecture}, ${activeLoc.environment}`,
    foreground: 'Foreground framing with authentic period elements',
    props: activeLoc.props.length > 0 ? activeLoc.props : objects.map((o) => o.name),
  };

  const timeEntry = {
    time_of_day: scene.time_of_day || 'Day',
    season: 'Historical season',
    weather: 'Clear air, calm wind',
    atmosphere: scene.scene_tone?.atmosphere || 'Cinematic atmospheric tone',
  };

  const actionEntry = {
    primary: scene.event || 'Narrative event unfolding in historical setting',
    secondary: shots[0]?.action || 'Subtle period-appropriate movement',
    interaction: 'Interaction with environment and narrative elements',
    environmental_reaction: 'Subtle environmental reaction',
  };

  const activeShot = shots[0];
  const cameraNote = activeShot?.camera_note || '';
  const eventDetail = activeShot?.event_detail || scene.event || '';

  // Camera Fallback Hierarchy (Phase 3.7C)
  const cameraAngle = activeShot?.camera?.angle 
    || parseLegacyCameraNote(cameraNote, 'angle') 
    || 'eye-level perspective';

  const cameraLens = activeShot?.camera?.lens 
    || parseLegacyCameraNote(cameraNote, 'lens') 
    || '35mm anamorphic prime lens';

  const cameraFocalLength = activeShot?.camera?.focal_length 
    || parseLegacyCameraNote(cameraNote, 'focal_length') 
    || (cameraLens.includes('50mm') ? '50mm focal length' : cameraLens.includes('85mm') ? '85mm focal length' : cameraLens.includes('24mm') ? '24mm focal length' : '35mm focal length');

  const cameraMovement = activeShot?.camera?.movement 
    || activeShot?.camera_movement 
    || parseLegacyCameraNote(cameraNote, 'movement') 
    || 'Smooth camera movement';

  const cameraDepthOfField = activeShot?.camera?.depth_of_field 
    || parseLegacyCameraNote(cameraNote, 'depth_of_field') 
    || 'f/1.8 cinematic bokeh';

  const cameraFraming = activeShot?.camera?.framing 
    || activeShot?.shot_type 
    || parseLegacyCameraNote(cameraNote, 'framing') 
    || 'Subject in midground with surrounding historical environment';

  const cameraPosition = activeShot?.camera?.position || 'Cinematic camera positioning';
  const cameraSpeed = activeShot?.camera?.speed || 'Smooth, deliberate 24fps cinematic pacing';
  const cameraFocus = cameraDepthOfField.includes('shallow') || cameraDepthOfField.includes('f/1.8') || cameraDepthOfField.includes('bokeh')
    ? 'Shallow depth of field with sharp subject focus'
    : 'Deep focus with sharp subject and background elements';

  const cameraEntry = {
    shot_type: activeShot?.camera?.framing || activeShot?.shot_type || 'Medium Tracking Shot',
    angle: cameraAngle,
    position: cameraPosition,
    lens: cameraLens,
    focal_length: cameraFocalLength,
    movement: cameraMovement,
    speed: cameraSpeed,
    framing: cameraFraming,
    focus: cameraFocus,
    depth_of_field: cameraDepthOfField,
  };

  // Composition Fallback Hierarchy (Phase 3.7C)
  const compLayout = activeShot?.composition?.layout 
    || parseLegacyComposition('layout', activeShot, eventDetail, cameraNote);

  const compPlacement = activeShot?.composition?.subject_placement 
    || parseLegacyComposition('subject_placement', activeShot, eventDetail, cameraNote);

  const compBalance = activeShot?.composition?.visual_balance 
    || parseLegacyComposition('visual_balance', activeShot, eventDetail, cameraNote);

  const compForeground = activeShot?.composition?.foreground 
    || parseLegacyComposition('foreground', activeShot, eventDetail, cameraNote);

  const compBackground = activeShot?.composition?.background 
    || parseLegacyComposition('background', activeShot, eventDetail, cameraNote);

  const compSpatial = activeShot?.composition?.spatial_relationship 
    || parseLegacyComposition('spatial_relationship', activeShot, eventDetail, cameraNote);

  const compositionEntry = {
    layout: compLayout,
    subject_placement: compPlacement,
    visual_balance: compBalance,
    foreground: compForeground,
    background: compBackground,
    spatial_relationship: compSpatial,
  };

  const lightingEntry = {
    source: scene.lighting || activeLoc.lighting || 'Natural period lighting',
    direction: 'Side rim lighting and ambient environmental glow',
    intensity: 'High-contrast cinematic illumination',
    color_temperature: 'Authentic period color temperature',
    shadows: 'Deep rich shadows',
    atmosphere: 'Volumetric atmosphere',
  };

  const visualStyleEntry = {
    realism: 'Ultra-realistic historical film capture',
    cinematic_style: visualTone,
    material_realism: `Authentic period materials (${activeLoc.materials})`,
    color_grading: 'Period-appropriate color grading',
    film_texture: 'Organic 35mm film grain',
    contrast: 'High cinematic contrast',
  };

  const moodEntry = {
    emotion: scene.emotional_objective || 'Profound cinematic mood',
    tension: `${scene.scene_tone?.dramatic_tension || 75}/100 narrative tension`,
    atmosphere: scene.scene_tone?.atmosphere || 'Atmospheric cinematic suspense',
  };

  const continuityEntry = {
    character_lock: activeShot?.lock_state?.character_locked ?? true,
    clothing_lock: activeShot?.lock_state?.costume_locked ?? true,
    location_lock: activeShot?.lock_state?.location_locked ?? true,
    prop_lock: true,
    lighting_lock: activeShot?.lock_state?.lighting_locked ?? true,
    style_lock: true,
    camera_lock: activeShot?.lock_state?.camera_locked ?? false,
    composition_lock: activeShot?.lock_state?.composition_locked ?? false,
  };

  const hasHolyFigures = sceneContext.characters.some((c) => isReveredHolyFigure(c.name));

  const negativePromptModules = {
    anatomy: ['extra fingers', 'missing fingers', 'malformed hands', 'extra limbs', 'distorted anatomy'],
    identity: isProphetScene
      ? ['face visible', 'eyes visible', 'mouth visible', 'frontal face depiction', 'identifiable facial structure', 'facial features depicted']
      : hasHolyFigures
      ? ['face change', 'age change', 'character morphing', 'inconsistent appearance', 'undignified expression', 'disheveled appearance', 'casual villager look', 'peasant rags']
      : ['face change', 'age change', 'character morphing', 'inconsistent appearance'],
    clothing: [
      ...sceneContext.modernAnachronismGuard.filter((e) => e.includes('cloth') || e.includes('attire') || e.includes('suit') || e.includes('dress') || e.includes('t-shirt')),
      'modern clothing',
      'zippers',
      'synthetic neon textiles',
      'sunglasses',
      'wristwatches',
      ...(hasHolyFigures
        ? [
            't-shirt',
            'undershirt',
            'kaos',
            'casual clothing',
            'sloppy daily villager clothes',
            'limp cotton shirt',
            'shabby peasant wear',
            'modern fabric',
            'v-neck shirt',
            'cheap casual clothing',
            'modern sportswear',
          ]
        : []),
    ],
    environment: [
      ...sceneContext.modernAnachronismGuard.filter((e) => e.includes('build') || e.includes('road') || e.includes('car') || e.includes('vehicle') || e.includes('signage')),
      'modern buildings',
      'electricity poles',
      'asphalt roads',
      'automobiles',
      'modern objects',
    ],
    camera: ['random camera shake', 'excessive camera motion', 'sudden erratic zoom'],
    physics: ['floating objects', 'teleportation', 'sliding feet', 'impossible motion'],
    quality: ['plastic skin', 'CGI cartoon appearance', '3D render look', 'anime', 'blurry', 'low resolution'],
    output: ['watermark', 'logo', 'subtitles', 'text overlay', 'UI elements'],
  };

  return {
    project_title: projectTitle,
    scene_number: scene.scene_number,
    scene_title: scene.title,
    scene_purpose: scene.story_purpose || 'Advance dramatic narrative',
    story_context: `${scene.dramatic_purpose || scene.event}${contextPackage ? `\nGROUNDING CONSTRAINTS: ${contextPackage.constraints.join('; ')}` : ''}${continuityState ? `\nCONTINUITY STATE: ${JSON.stringify({ characters: continuityState.characters, scene: continuityState.scenes[continuityState.scenes.length - 1], visualState: continuityState.visualState, unresolvedIssues: continuityState.unresolvedIssues })}` : ''}`,
    duration_sec: duration,
    aspect_ratio: '16:9',
    model_target: target,
    detail_level: detailLevel,
    is_prophet_scene: isProphetScene,
    characters: characterEntries,
    location: locationEntry,
    time: timeEntry,
    action: actionEntry,
    camera: cameraEntry,
    composition: compositionEntry,
    lighting: lightingEntry,
    visual_style: visualStyleEntry,
    mood: moodEntry,
    continuity: continuityEntry,
    negative_prompt_modules: negativePromptModules,
  };
}

export function compileNegativePrompt(data: MasterSceneData): string {
  const isProphetScene = data.is_prophet_scene || 
    (data.story_context && (
      data.story_context.toLowerCase().includes('rasulullah') || 
      data.story_context.toLowerCase().includes('muhammad') || 
      data.story_context.toLowerCase().includes('prophetic')
    )) ||
    (data.scene_title && (
      data.scene_title.toLowerCase().includes('rasulullah') || 
      data.scene_title.toLowerCase().includes('muhammad')
    ));

  // Determine era based on location and story context
  const eraText = (data.location?.era || data.story_context || data.project_title || '').toLowerCase();
  const isJavanese = eraText.includes('java') || eraText.includes('jawa') || eraText.includes('sunan') || eraText.includes('wali') || eraText.includes('demak') || eraText.includes('mataram') || eraText.includes('majapahit') || eraText.includes('cirebon');
  const isMiddleEastern = eraText.includes('makkah') || eraText.includes('prophetic') || eraText.includes('arab') || eraText.includes('desert') || eraText.includes('tsur') || eraText.includes('hijrah');

  // Determine environmental context (indoors vs outdoors)
  const envText = `${data.location?.place || ''} ${data.location?.environment || ''} ${data.location?.architecture || ''}`.toLowerCase();
  const isIndoors = envText.includes('mosque') || envText.includes('masjid') || envText.includes('pendopo') || envText.includes('palace') || envText.includes('keraton') || envText.includes('room') || envText.includes('interior') || envText.includes('house') || envText.includes('home') || envText.includes('inside');
  const isOutdoorsNatural = envText.includes('forest') || envText.includes('jungle') || envText.includes('cave') || envText.includes('gua') || envText.includes('mountain') || envText.includes('river') || envText.includes('desert') || envText.includes('outdoor') || envText.includes('outside');

  // Determine spiritual / solemn tone
  const actionText = `${data.action?.primary || ''} ${data.action?.secondary || ''} ${data.mood?.emotion || ''} ${data.scene_purpose || ''}`.toLowerCase();
  const isSolemnSpiritual = actionText.includes('pray') || actionText.includes('sholat') || actionText.includes('dzikir') || actionText.includes('dhikr') || actionText.includes('meditate') || actionText.includes('sacred') || actionText.includes('solemn') || actionText.includes('study') || actionText.includes('read') || actionText.includes('worship') || actionText.includes('contemplate');

  const negativeModules: { [key: string]: string[] } = {
    anatomy: ['extra fingers', 'missing fingers', 'malformed hands', 'extra limbs', 'distorted anatomy', 'mutilated hands', 'two heads', 'fused fingers'],
    quality: ['plastic skin', 'CGI cartoon appearance', '3D render look', 'anime', 'blurry', 'low resolution', 'unrealistic proportions', 'video game graphic'],
    output: ['watermark', 'logo', 'subtitles', 'text overlay', 'UI elements', 'copyright notice', 'frame border'],
    camera: ['random camera shake', 'erratic motion', 'blurry autofocus', 'lens flare anachronism', 'extreme fisheye lens'],
    physics: ['floating objects', 'sliding feet', 'impossible gravity', 'clipping geometry'],
    audio: [
      'background music',
      'BGM',
      'soundtrack',
      'musical score',
      'orchestral score',
      'cinematic music',
      'emotional music',
      'trailer music',
      'non-diegetic audio',
      'cinematic whooshes',
      'transition sound effects',
      'artificial sound-design layers',
      'generated narrator voice',
      'music-like ambience',
    ],
  };

  // 1. Dynamic Identity Restrictions (Prophet vs. Holy vs. Normal)
  const hasHolyFigures = data.characters?.some((c) => {
    const nameLower = c.name?.toLowerCase() || '';
    return nameLower.includes('sunan') || nameLower.includes('wali') || nameLower.includes('kyai') || nameLower.includes('habib') || nameLower.includes('ulama') || nameLower.includes('syekh') || nameLower.includes('sheikh') || nameLower.includes('nabi') || nameLower.includes('rasul') || nameLower.includes('ustadz');
  });

  if (isProphetScene) {
    negativeModules.identity = [
      'face visible', 'eyes visible', 'mouth visible', 'frontal face depiction', 'identifiable facial structure', 
      'facial features depicted', 'front portrait', 'direct eye contact', 'unveiled face of prophet'
    ];
  } else if (hasHolyFigures) {
    negativeModules.identity = [
      'undignified facial expression', 'silly face', 'disheveled hair', 'casual daily look', 'shabby appearance',
      'angry scowling face', 'cartoon caricature facial proportions', 'inconsistent age depiction'
    ];
  } else {
    negativeModules.identity = ['inconsistent character appearance', 'distorted facial features', 'scrambled face'];
  }

  // 2. Dynamic Clothing & Anachronism Guard
  const clothingExclusions = [
    'modern clothing', 't-shirt', 'jeans', 'zippers', 'synthetic neon textiles', 'wristwatches', 'sunglasses', 
    'sneakers', 'plastic buttons', 'polyester jacket', 'modern sportswear', 'baseball caps'
  ];

  if (isJavanese) {
    clothingExclusions.push(
      'modern Javanese wedding costume', 'modern bridal kebaya', 'modern printed batik shirt', 
      'modern Indonesian streetwear', 'casual daily t-shirt clothing', 'middle-eastern modern robes with zippers'
    );
  }
  if (isMiddleEastern) {
    clothingExclusions.push(
      'medieval European clothing', 'Roman gladiator armor', 'modern suits', 'modern sunglasses', 't-shirt'
    );
  }
  negativeModules.clothing = clothingExclusions;

  // 3. Dynamic Environment Guard (Anachronism + Setting-Aware)
  const envExclusions = [
    'modern buildings', 'electricity poles', 'asphalt roads', 'automobiles', 'cars', 'motorcycles', 
    'paved highways', 'modern signage', 'traffic lights', 'power lines', 'utility poles', 'plastic garbage'
  ];

  if (isIndoors) {
    envExclusions.push(
      'air conditioning units', 'ceiling fans', 'electrical wiring', 'modern light bulbs', 'fluorescent tubes', 
      'fire extinguishers', 'synthetic carpets', 'plastic chairs', 'office furniture', 'whiteboards', 'modern door knobs'
    );
  }
  if (isOutdoorsNatural) {
    envExclusions.push(
      'paved concrete walkways', 'brick walls', 'modern fences', 'plastic water bottles', 'aluminum soda cans', 
      'trash cans', 'modern signs', 'iron railings', 'power lines'
    );
  }
  if (isJavanese) {
    envExclusions.push(
      'modern city skyscrapers', 'modern brick residential houses', 'metal guard rails', 'commercial signage'
    );
  }
  if (isMiddleEastern) {
    envExclusions.push(
      'Javanese wooden pendopo pavilion', 'thick green tropical forests', 'medieval gothic stone castles'
    );
  }
  negativeModules.environment = envExclusions;

  // 4. Dynamic Tone & Sacredness Guard
  if (isSolemnSpiritual) {
    negativeModules.tone = [
      'silly expressions', 'giggling or laughing faces', 'comical or absurd poses', 'dynamic martial arts gestures', 
      'aggressive body language', 'excessive screaming', 'chaotic background action', 'undignified sitting postures'
    ];
  }

  const all = Object.values(negativeModules).flat();
  return Array.from(new Set(all)).join(', ');
}

/**
 * Prompt Validator & Zero Placeholder Policy Enforcement
 */
export function validateAndRepairPrompt(promptText: string): string {
  const forbiddenPhrases = [
    'performing frame adegan sinematik',
    'pergerakan visual',
    'Aksi sinematik kunci',
    'deskripsi karakter',
    'deskripsi lokasi',
    'cinematic action',
    'visual movement',
    'scene action',
    'Stabilized tracking camera',
    'Visual sinematik detail',
  ];

  let cleaned = promptText;
  for (const phrase of forbiddenPhrases) {
    if (cleaned.toLowerCase().includes(phrase.toLowerCase())) {
      cleaned = cleaned.replace(new RegExp(phrase, 'gi'), 'executed historical narrative action');
    }
  }
  return cleaned;
}

/**
 * Authoritative serializer for Camera Lock constraints (Phase 3.7L)
 */
export function serializeLockedCamera(camera: any, isLocked: boolean): string {
  if (!isLocked || !camera) return '';
  return `\n[LOCKED CAMERA CONSTRAINT]: Camera settings are strictly locked to angle: ${camera.angle}, lens: ${camera.lens}, focal length: ${camera.focal_length}, movement: ${camera.movement}, depth of field: ${camera.depth_of_field}, framing: ${camera.framing}, position: ${camera.position}, speed: ${camera.speed}. Under no circumstances can these camera settings deviate.`;
}

/**
 * Authoritative serializer for Composition Lock constraints (Phase 3.7L)
 */
export function serializeLockedComposition(composition: any, isLocked: boolean): string {
  if (!isLocked || !composition) return '';
  return `\n[LOCKED COMPOSITION CONSTRAINT]: Spatial layout and environmental composition are strictly locked to layout: ${composition.layout}, subject placement: ${composition.subject_placement}, visual balance: ${composition.visual_balance}, foreground layer: ${composition.foreground}, background layer: ${composition.background}, spatial relationship: ${composition.spatial_relationship}. Under no circumstances can these composition dynamics deviate.`;
}

/**
 * Authoritative serializer for Character Lock constraints (Phase 3.8A)
 */
export function serializeLockedCharacter(characters: any[], isLocked: boolean, isProphetScene?: boolean): string {
  if (!isLocked || !characters || characters.length === 0) return '';
  const entries = characters
    .map((c) => {
      const charName = c.name || 'Subject';
      const age = c.age || 'Adult';
      const gender = c.gender || 'Unknown';
      const appearance = c.appearance || c.physical_appearance || c.faceDescription || 'Authentic period appearance';
      const isRestricted = Boolean(c.prophet_restrictions || isProphetScene);
      const faceLockedStr = isRestricted
        ? 'PROHIBITED (aniconism/silhouette only)'
        : (c.face_locked !== false ? 'TRUE' : 'FALSE');
      const prophetRestrStr = isRestricted ? 'TRUE' : 'FALSE';

      let baseStr = `name: ${charName}, age: ${age}, gender: ${gender}, appearance: ${appearance}, face identity locked: ${faceLockedStr}, prophet restrictions: ${prophetRestrStr}`;
      if (c.hair) baseStr += `, hair: ${c.hair}`;
      if (c.beard) baseStr += `, beard: ${c.beard}`;
      if (c.movement_style) baseStr += `, movement style: ${c.movement_style}`;
      if (c.accessories && Array.isArray(c.accessories) && c.accessories.length > 0) {
        baseStr += `, accessories: ${c.accessories.join(', ')}`;
      } else if (typeof c.accessories === 'string' && c.accessories.trim().length > 0) {
        baseStr += `, accessories: ${c.accessories.trim()}`;
      }
      return baseStr;
    })
    .join('; ');

  return `\n[LOCKED CHARACTER CONSTRAINT]: Character identity, physical appearance, and depiction rules are strictly locked to ${entries}. Under no circumstances can character identity or depiction rules deviate.`;
}

/**
 * Authoritative serializer for Costume Lock constraints (Phase 3.8A)
 */
export function serializeLockedCostume(characters: any[], isLocked: boolean): string {
  if (!isLocked || !characters || characters.length === 0) return '';
  const entries = characters
    .map((c) => {
      const charName = c.name || 'Subject';
      let attireStr = '';
      if (Array.isArray(c.costume) && c.costume.length > 0) {
        attireStr = c.costume.join(', ');
      } else if (c.wardrobe) {
        attireStr = c.wardrobe;
      } else if (Array.isArray(c.clothing) && c.clothing.length > 0) {
        attireStr = c.clothing.join(', ');
      } else if (typeof c.clothing === 'string' && c.clothing.trim()) {
        attireStr = c.clothing.trim();
      } else {
        attireStr = 'Period-appropriate authentic costume';
      }

      let baseStr = `name: ${charName}, attire: ${attireStr}`;
      if (c.costume_structure) {
        const cs = c.costume_structure;
        if (cs.garment_inner) baseStr += `, garment inner: ${cs.garment_inner}`;
        if (cs.garment_outer) baseStr += `, garment outer: ${cs.garment_outer}`;
        if (cs.headwear) baseStr += `, headwear: ${cs.headwear}`;
        if (cs.footwear) baseStr += `, footwear: ${cs.footwear}`;
        if (cs.textiles) {
          baseStr += `, textiles: ${Array.isArray(cs.textiles) ? cs.textiles.join(', ') : cs.textiles}`;
        }
        if (cs.palette) {
          baseStr += `, palette: ${Array.isArray(cs.palette) ? cs.palette.join(', ') : cs.palette}`;
        }
        if (cs.layering) baseStr += `, layering: ${cs.layering}`;
        if (cs.condition) baseStr += `, condition: ${cs.condition}`;
        if (cs.cultural_significance) baseStr += `, cultural significance: ${cs.cultural_significance}`;
      }
      return baseStr;
    })
    .join('; ');

  return `\n[LOCKED COSTUME CONSTRAINT]: Character wardrobe, garment textures, and period clothing items are strictly locked to ${entries}. Under no circumstances can costume specifications or textile weave deviate.`;
}

/**
 * Authoritative serializer for Location Lock constraints (Phase 3.9)
 */
export function serializeLockedLocation(location: any, isLocked: boolean): string {
  if (!isLocked || !location) return '';
  const place = location.place || location.name || 'Historical Setting';
  const era = location.era || location.historical_period || 'Historical Era';
  const architecture = location.architecture || location.architectural_style || 'Authentic period architecture';
  const geography = location.geography || location.terrain || location.landscape || 'Authentic regional geography';
  const environment = location.environment || 'Authentic period environment';
  const background = location.background || 'Period background';
  const foreground = location.foreground || 'Period foreground';

  let baseStr = `place: ${place}, era: ${era}, architecture: ${architecture}, geography: ${geography}, environment: ${environment}, background: ${background}, foreground: ${foreground}`;

  if (location.props) {
    if (Array.isArray(location.props) && location.props.length > 0) {
      baseStr += `, props: ${location.props.join(', ')}`;
    } else if (typeof location.props === 'string' && location.props.trim().length > 0) {
      baseStr += `, props: ${location.props.trim()}`;
    }
  }
  if (location.materials || location.material) {
    baseStr += `, materials: ${location.materials || location.material}`;
  }
  if (location.landmarks || location.recurring_landmarks) {
    const lms = location.landmarks || location.recurring_landmarks;
    baseStr += `, landmarks: ${Array.isArray(lms) ? lms.join(', ') : lms}`;
  }
  if (location.spatial_scale) {
    baseStr += `, spatial scale: ${location.spatial_scale}`;
  }
  if (location.condition) {
    baseStr += `, condition: ${location.condition}`;
  }
  if (location.cultural_details || location.cultural_significance) {
    baseStr += `, cultural details: ${location.cultural_details || location.cultural_significance}`;
  }

  return `\n[LOCKED LOCATION CONSTRAINT]: Environment, architectural geometry, and geographical setting are strictly locked to ${baseStr}. Under no circumstances can environmental parameters or historical location geometry deviate.`;
}

/**
 * Authoritative serializer for Lighting Lock constraints (Phase 3.9)
 */
export function serializeLockedLighting(lighting: any, isLocked: boolean, timeOfDay?: string): string {
  if (!isLocked || !lighting) return '';
  const source = lighting.source || 'Authentic period lighting';
  const direction = lighting.direction || 'Natural direction';
  const intensity = lighting.intensity || 'Natural intensity';
  const colorTemp = lighting.color_temperature || 'Authentic color temperature';
  const shadows = lighting.shadows || 'Natural shadows';
  const atmosphere = lighting.atmosphere || 'Atmospheric lighting';

  let baseStr = `source: ${source}, direction: ${direction}, intensity: ${intensity}, color temperature: ${colorTemp}, shadows: ${shadows}, atmosphere: ${atmosphere}`;

  const tod = lighting.time_of_day || timeOfDay;
  if (tod) {
    baseStr += `, time of day: ${tod}`;
  }
  if (lighting.ambient_illumination) {
    baseStr += `, ambient illumination: ${lighting.ambient_illumination}`;
  }
  if (lighting.practical_lights) {
    const pl = lighting.practical_lights;
    baseStr += `, practical lights: ${Array.isArray(pl) ? pl.join(', ') : pl}`;
  }
  if (lighting.contrast) {
    baseStr += `, contrast: ${lighting.contrast}`;
  }

  return `\n[LOCKED LIGHTING CONSTRAINT]: Lighting schema, key illumination sources, and shadow dynamics are strictly locked to ${baseStr}. Under no circumstances can lighting regime or atmospheric illumination deviate.`;
}

/**
 * Authoritative Unified Invariant Contract Serializer (Phase 4.0)
 * Unifies Camera, Composition, Character, Costume, Location, and Lighting invariant domains
 * into a single deterministic orchestration layer while delegating to authoritative serializers.
 */
export function serializeUnifiedInvariantContract(data: MasterSceneData): string {
  if (!data) return '';
  const cameraLockBlock = serializeLockedCamera(data.camera, !!data.continuity?.camera_lock);
  const compositionLockBlock = serializeLockedComposition(data.composition, !!data.continuity?.composition_lock);
  const charLockBlock = serializeLockedCharacter(data.characters, !!data.continuity?.character_lock, data.is_prophet_scene);
  const costumeLockBlock = serializeLockedCostume(data.characters, !!data.continuity?.clothing_lock);
  const locationLockBlock = serializeLockedLocation(data.location, !!data.continuity?.location_lock);
  const lightingLockBlock = serializeLockedLighting(data.lighting, !!data.continuity?.lighting_lock, data.time?.time_of_day);

  return `${cameraLockBlock}${compositionLockBlock}${charLockBlock}${costumeLockBlock}${locationLockBlock}${lightingLockBlock}`;
}

/**
 * Model Adapter 1: Banana Master Frame (Static Visual Blueprint)
 */
export function adaptBananaMasterFrame(data: MasterSceneData): string {
  const charDesc = data.characters
    .map((c) => {
      if (c.prophet_restrictions) {
        return `${c.name} [CHARACTER VISUAL LOCK: preserve silhouette, traditional period clothing, posture, and movement style. VISUAL RESTRICTION: Face must NEVER be visible or depicted. Rear view / back silhouette only, zero direct depiction of face].`;
      }
      if (isReveredHolyFigure(c.name)) {
        return `${c.name} (${c.age}) [REVERED HOLY FIGURE DOCTRINE: Dignified, highly sacred visual presentation. Wearing majestic noble attire: ${c.costume.join(', ')}, ${c.pose_expression}, wise serene countenance, radiant aura of spiritual tawadhu' and sacred wibawa, exact identity lock].`;
      }
      return `${c.name} (${c.age}), wearing ${c.costume.join(', ')}, ${c.pose_expression}, exact identity lock.`;
    })
    .join('; ');

  const charLockInfo = data.characters
    .map((c) => {
      if (c.prophet_restrictions) {
        return `${c.name}: Silhouette & posture lock only (face completely obscured; no facial identity lock).`;
      }
      if (isReveredHolyFigure(c.name)) {
        return `${c.name}: Revered Holy Figure lock (authentic Sorban/Imamah or Blangkon, noble Jubah/Surjan, sacred wibawa & posture lock; NO casual t-shirts/peasant wear).`;
      }
      return `${c.name}: Locked facial geometry, costume weave, and height ratio.`;
    })
    .join('; ');

  const safetyInfo = data.is_prophet_scene
    ? 'Prophetic character present: rear view / silhouette only, face completely obscured from view, zero direct depiction of face, sacred reverence preserved.'
    : 'Standard cinematic historical safety restrictions applied.';

  const compositionDetail = data.composition 
    ? `Layout: ${data.composition.layout}, Subject Placement: ${data.composition.subject_placement}, Balance: ${data.composition.visual_balance}, Foreground: ${data.composition.foreground}, Background: ${data.composition.background}, Spatial Relationship: ${data.composition.spatial_relationship}`
    : `${data.camera.framing}, ${data.camera.angle}`;

  const unifiedInvariantContract = serializeUnifiedInvariantContract(data);

  const prompt = `[BANANA MASTER FRAME BLUEPRINT]
PROJECT / SCENE: ${data.project_title} | SCENE #${data.scene_number}: ${data.scene_title}
SUBJECT: ${charDesc}
CHARACTER VISUAL LOCK: ${charLockInfo}
ACTION STATE: ${data.action.primary}
LOCATION: ${data.location.place}
ERA / HISTORICAL CONTEXT: ${data.location.era}
ARCHITECTURE / ENVIRONMENT: ${data.location.architecture}, ${data.location.environment}
COMPOSITION: ${compositionDetail}
CAMERA POSITION: ${data.camera.position}
LENS: ${data.camera.lens}
DEPTH OF FIELD: ${data.camera.depth_of_field}
LIGHTING: ${data.lighting.source}
SHADOW: ${data.lighting.shadows}
ATMOSPHERE: ${data.time.atmosphere}, ${data.lighting.atmosphere}
MOOD: ${data.mood.emotion} (Tension: ${data.mood.tension})
MATERIAL REALISM: ${data.visual_style.material_realism}
VISUAL STYLE: ${data.visual_style.cinematic_style}, ${data.visual_style.film_texture}
CONTINUITY: Strict historical costume, prop, and location consistency lock.${unifiedInvariantContract}
HISTORICAL ACCURACY: Verified period architecture, authentic woven textiles, and accurate historical props (${Array.isArray(data.location.props) ? data.location.props.join(', ') : (data.location.props || 'authentic props')}).
SAFETY RESTRICTIONS: ${safetyInfo}
NEGATIVE PROMPT: ${compileNegativePrompt(data)}`;

  return validateAndRepairPrompt(prompt);
}

/**
 * Model Adapter 2: Banana Image Prompt (Independently Optimized)
 */
export function adaptBananaImagePrompt(data: MasterSceneData): string {
  const charStr = data.characters
    .map((c) => {
      if (c.prophet_restrictions) {
        return `${c.name} seen from rear silhouette, wearing traditional modest period cloak, body posture locked, face completely obscured from view.`;
      }
      if (isReveredHolyFigure(c.name)) {
        return `${c.name} (Revered Holy Figure / Waliyullah) wearing majestic ${c.costume.join(', ')}, ${c.pose_expression}, serene radiant facial expression of spiritual wisdom and sacred wibawa`;
      }
      return `${c.name} wearing ${c.costume.join(', ')}, ${c.pose_expression}`;
    })
    .join('; ');

  const compositionDetail = data.composition 
    ? `${data.composition.layout}, subject positioned in ${data.composition.subject_placement}, ${data.composition.visual_balance}, foreground: ${data.composition.foreground}, background: ${data.composition.background}, spatial relationship: ${data.composition.spatial_relationship}`
    : `${data.camera.framing}, ${data.camera.angle}`;

  const unifiedInvariantContract = serializeUnifiedInvariantContract(data);

  const prompt = `[BANANA IMAGE GENERATION PROMPT]
SUBJECT: ${charStr}
POSE / ACTION STATE: ${data.action.primary} in ${data.location.place}
ENVIRONMENT: ${data.location.environment}, ${data.time.time_of_day}
ARCHITECTURE: ${data.location.architecture}
COMPOSITION: ${compositionDetail}
CAMERA: ${data.camera.framing || data.camera.shot_type}
LENS: ${data.camera.lens}, ${data.camera.focus}
LIGHTING: ${data.lighting.source}, ${data.lighting.color_temperature}
MATERIAL REALISM: ${data.visual_style.material_realism}
ATMOSPHERE: ${data.time.atmosphere}
COLOR / TONALITY: ${data.visual_style.color_grading}
VISUAL STYLE: ${data.visual_style.cinematic_style}, ${data.visual_style.film_texture}
MOOD: ${data.mood.emotion}
CONTINUITY: Strict apparel and architectural consistency across sequence.${unifiedInvariantContract}
NEGATIVE PROMPT: ${compileNegativePrompt(data)}`;

  return validateAndRepairPrompt(prompt);
}

/**
 * Model Adapter 3: Veo Adapter (Duration-aware)
 */
export function adaptVeoVideoPrompt(data: MasterSceneData, shots: Shot[]): { prompt: string; camera: string; negative_prompt: string } {
  const duration = data.duration_sec || 10;
  const charDesc =
    data.characters
      .map((c) => `${c.name} (${c.age}, ${c.gender}, wearing ${c.costume.join(', ')})`)
      .join('; ') || 'Subject';

  let timelineStr = '';
  if (duration === 10) {
    timelineStr = `
0:00–0:03
OPENING STATE: Establishing ${charDesc} in ${data.location.place} under ${data.time.time_of_day}. Subtle atmospheric wind and clothing movement.

0:03–0:07
PRIMARY ACTION: ${data.action.primary}. Smooth narrative movement past guarding figures without detection.

0:07–0:10
RESOLUTION / END STATE: Subject reaches final position in frame, camera settles into stable resting composition.`.trim();
  } else {
    const t1 = Math.round(duration * 0.3);
    const t2 = Math.round(duration * 0.7);
    timelineStr = `
0:00–0:${String(t1).padStart(2, '0')}
OPENING STATE: Establishing ${charDesc} in ${data.location.place}. Environmental setup.

0:${String(t1).padStart(2, '0')}–0:${String(t2).padStart(2, '0')}
PRIMARY ACTION: ${data.action.primary}.

0:${String(t2).padStart(2, '0')}–0:${String(duration).padStart(2, '0')}
RESOLUTION / END STATE: Resolution and final ending composition.`.trim();
  }

  const compositionStr = data.composition 
    ? `Layout: ${data.composition.layout}, Subject Placement: ${data.composition.subject_placement}, Balance: ${data.composition.visual_balance}, Foreground: ${data.composition.foreground}, Background: ${data.composition.background}, Spatial Relationship: ${data.composition.spatial_relationship}`
    : 'Balanced classical composition';

  const cameraStr = `
- Movement: ${data.camera.movement}, smooth 24fps panning/tracking.
- Lens & Focus: ${data.camera.lens}, ${data.camera.focus}.
- Framing: ${data.camera.framing}.
- Composition: ${compositionStr}.`.trim();

  const unifiedInvariantContract = serializeUnifiedInvariantContract(data);
  const audioPurityBlock = serializeAudioPurityConstraintBlock('veo');

  const promptText = `[VEO CINEMATIC VIDEO PROMPT — ${duration}s]
SCENE: #${data.scene_number} ${data.scene_title} (${data.project_title})
DURATION: ${duration}s
ERA LOCK: ${data.location.era}
REFERENCE / MASTER FRAME: Master frame visual anchor locked
VISUAL CONTINUITY: Strict apparel weave, period lighting, and spatial geography lock
${data.composition ? `COMPOSITION CONSTRAINTS: layout: ${data.composition.layout}, subject placement: ${data.composition.subject_placement}, visual balance: ${data.composition.visual_balance}, foreground layer: ${data.composition.foreground}, background layer: ${data.composition.background}, spatial relationship: ${data.composition.spatial_relationship}` : ''}

${timelineStr}

CAMERA MOTION: ${data.camera.movement}, smooth 24fps panning/tracking with ${data.camera.lens}.
SUBJECT MOTION: Deliberate, dignified physical movement reflecting historical weight.
ENVIRONMENT MOTION: Light ambient wind causing subtle cloth movement, drifting atmospheric particulate.
LIGHTING MOTION: Consistent chiaroscuro illumination with steady ${data.lighting.source}.
PHYSICS: Realistic gravity, natural fabric drape and weight dynamics.
CONTINUITY: Zero character morphing or costume drift across full ${duration}-second duration.

${audioPurityBlock}${unifiedInvariantContract}
NEGATIVE PROMPT: ${compileNegativePrompt(data)}`;

  return {
    prompt: validateAndRepairPrompt(promptText),
    camera: cameraStr,
    negative_prompt: compileNegativePrompt(data),
  };
}

/**
 * Model Adapter 4: Omni Adapter (Duration-aware reference-preserving)
 */
export function adaptOmniVideoPrompt(data: MasterSceneData): { prompt: string; camera: string; follow_up: string; negative_prompt: string } {
  const duration = data.duration_sec || 10;
  let actionSeq = '';
  if (duration === 10) {
    actionSeq = `
0:00–0:02.5
INITIAL STATE: Initial posture holding, exact reference frame alignment with subtle breathing motion.

0:02.5–0:05
ACTION INITIATION: Action initiation: ${data.action.primary}.

0:05–0:07.5
ACTION DEVELOPMENT: Peak narrative momentum and environmental interaction.

0:07.5–0:10
FINAL STATE: Smooth deceleration to stable final resting keyframe.`.trim();
  } else {
    const q1 = (duration * 0.25).toFixed(1);
    const q2 = (duration * 0.50).toFixed(1);
    const q3 = (duration * 0.75).toFixed(1);
    actionSeq = `
0:00–0:${q1}
INITIAL STATE: Initial posture holding.

0:${q1}–0:${q2}
ACTION INITIATION: Action initiation: ${data.action.primary}.

0:${q2}–0:${q3}
ACTION DEVELOPMENT: Peak narrative momentum.

0:${q3}–0:${duration}.0
FINAL STATE: Smooth deceleration to stable final resting keyframe.`.trim();
  }

  const compositionPreservation = data.composition 
    ? `COMPOSITION PRESERVATION: Strict lock on layout: ${data.composition.layout}, subject positioned in ${data.composition.subject_placement}, with balance: ${data.composition.visual_balance}, foreground layer: ${data.composition.foreground}, background layer: ${data.composition.background}, spatial relationship: ${data.composition.spatial_relationship}.`
    : 'COMPOSITION PRESERVATION: High fidelity preservation of master frame spatial composition.';

  const unifiedInvariantContract = serializeUnifiedInvariantContract(data);
  const audioPurityBlock = serializeAudioPurityConstraintBlock('omni');

  const promptText = `[OMNI VIDEO ENGINE PROMPT — ${duration}s]
TASK: Generate continuous ${duration}-second reference-preserving cinematic video.
DURATION: ${duration}s
ERA LOCK: ${data.location.era}
REFERENCE IMAGE: Master frame visual anchor locked.
REFERENCE FIDELITY: High fidelity preservation of master frame spatial composition.
CHARACTER PRESERVATION: Strict lock on subject silhouette, posture, and facial anonymity/identity.
WARDROBE PRESERVATION: Authentic historical textiles, consistent cloth weave and draping.
LOCATION PRESERVATION: Unwavering architectural geometry of ${data.location.architecture} in ${data.location.place}.
LIGHTING PRESERVATION: Consistent ${data.lighting.source} and tonal shadow distribution.
${compositionPreservation}

${actionSeq}

CAMERA PATH: ${data.camera.movement} with stable subject tracking.
SUBJECT MOVEMENT: Controlled, purposeful motion across the scene environment.
ENVIRONMENT MOVEMENT: Atmospheric night air circulation, subtle dust drifting.
PHYSICS: Natural weight dynamics, authentic cloth interaction with environmental surfaces.
CONTINUITY: Absolute identity, costume, and spatial continuity across all ${duration} seconds.

${audioPurityBlock}${unifiedInvariantContract}
NEGATIVE PROMPT: ${compileNegativePrompt(data)}`;

  return {
    prompt: validateAndRepairPrompt(promptText),
    camera: `Camera path: ${data.camera.movement}, 35mm lens, ${data.camera.focus}`,
    follow_up: `Ensure zero character morphing or costume drift across all ${duration} seconds.`,
    negative_prompt: compileNegativePrompt(data),
  };
}

/**
 * Model Adapter 5: Seedance Adapter (Duration-aware: 10s or 30s)
 */
export function adaptSeedanceVideoPrompt(data: MasterSceneData): { shot_breakdown: string; global_style: string; audio: string; do_not_change: string; negative_prompt: string } {
  const duration = data.duration_sec || 10;
  const isSeedance30 = data.model_target === 'seedance_30' || (data.model_target !== 'seedance_10' && duration > 15);
  const target: PromptTarget = isSeedance30 ? 'seedance_30' : 'seedance_10';
  const charDesc =
    data.characters
      .map((c) => `${c.name} (${c.age}, ${c.gender}, wearing ${c.costume.join(', ')})`)
      .join('; ') || 'Subject';
  let breakdown = '';

  const unifiedInvariantContract = serializeUnifiedInvariantContract(data);
  const audioPurityBlock = serializeAudioPurityConstraintBlock(target);

  const compositionLayoutStr = data.composition 
    ? `Layout: ${data.composition.layout}, Subject Placement: ${data.composition.subject_placement}, Balance: ${data.composition.visual_balance}, Foreground: ${data.composition.foreground}, Background: ${data.composition.background}, Spatial Relationship: ${data.composition.spatial_relationship}`
    : 'Balanced classical symmetry';

  if (!isSeedance30) {
    const t1 = (duration * 0.3).toFixed(1);
    const t2 = (duration * 0.7).toFixed(1);
    breakdown = `[SEEDANCE 2.5 CINEMATIC SEQUENCE]
SEEDANCE 2.5
DURATION: ${duration}s

SCENE: #${data.scene_number} ${data.scene_title} (${data.project_title})
CHARACTERS: ${charDesc}
LOCATION: ${data.location.place}
ERA: ${data.location.era}
EMOTIONAL ARC: ${data.mood.emotion} (Tension: ${data.mood.tension})
VISUAL ARC: Night chiaroscuro progression with volumetric lighting
COMPOSITION LAYOUT: ${compositionLayoutStr}

0:00–0:${t1}
OPENING / SETUP: Establish environment and character positioning in ${data.location.place}. Slow tracking shot.

0:${t1}–0:${t2}
MAIN ACTION: Core action unfolds. ${data.action.primary}. Character movement past guarding figures. Medium close-up framing.

0:${t2}–0:${duration}.0
RESOLUTION: Climactic conclusion and stable final resting composition. Cinematic narrative fade.

CAMERA MOVEMENT: ${data.camera.movement} with ${data.camera.lens}
SUBJECT PERFORMANCE: Restrained, dignified historical performance
ENVIRONMENT: ${data.location.architecture}, ${data.time.atmosphere}
LIGHTING: ${data.lighting.source}, ${data.lighting.shadows}
TRANSITIONS: Continuous single-take temporal progression without hard cuts
CONTINUITY: Lock face identity, costume weave, and location continuity across all frames

${audioPurityBlock}${unifiedInvariantContract}
NEGATIVE PROMPT: ${compileNegativePrompt(data)}`;
  } else {
    const t1 = (duration * 0.17).toFixed(1);
    const t2 = (duration * 0.40).toFixed(1);
    const t3 = (duration * 0.67).toFixed(1);
    const t4 = (duration * 0.87).toFixed(1);
    breakdown = `[SEEDANCE 2.5 CINEMATIC SEQUENCE]
SEEDANCE 2.5
DURATION: ${duration}s

SCENE: #${data.scene_number} ${data.scene_title} (${data.project_title})
CHARACTERS: ${charDesc}
LOCATION: ${data.location.place}
ERA: ${data.location.era}
EMOTIONAL ARC: ${data.mood.emotion} (Tension: ${data.mood.tension})
VISUAL ARC: Multi-shot dramatic sequence from atmospheric setup to climactic resolution
COMPOSITION LAYOUT: ${compositionLayoutStr}

SHOT 1 — 0:00–0:${t1}
OPENING: Establish nighttime environment, atmospheric particulate, character introduction in ${data.location.place}. Slow tracking shot.

SHOT 2 — 0:${t1}–0:${t2}
DEVELOPMENT: Action unfolds. ${data.action.primary}. Character movement past guarding figures. Medium tracking framing.

SHOT 3 — 0:${t2}–0:${t3}
ESCALATION: Dramatic tension heightens. Camera angle shifts to emphasize emotional stakes and surrounding figures.

SHOT 4 — 0:${t3}–0:${t4}
RESOLUTION / CLIMAX: Climactic action conclusion. Focal shift to character posture and environmental calm.

SHOT 5 — 0:${t4}–0:${duration}.0
ENDING: Final wide matching master frame resting composition. Cinematic fade to narrative atmosphere.

CAMERA EVOLUTION: Seamless progression from establishing wide tracking to intimate medium angle and wide resolution
CHARACTER CONTINUITY: Strict lock on character identity, cloak drape, and authentic period footwear
ENVIRONMENT CONTINUITY: Rigid architectural persistence of ${data.location.place} throughout ${duration} seconds
LIGHTING EVOLUTION: Subtle volumetric lighting shifts matching temporal progression from night to late night
PHYSICS: Full realistic simulation of wind, fabric inertia, and particulate interaction
TRANSITION LOGIC: Logical spatial bridging between internal sequence beats

${audioPurityBlock}${unifiedInvariantContract}
NEGATIVE PROMPT: ${compileNegativePrompt(data)}`;
  }

  return {
    shot_breakdown: validateAndRepairPrompt(breakdown),
    global_style: `${data.visual_style.cinematic_style}, 35mm film grain, 24fps epic grading`,
    audio: `Synchronized diegetic ambient soundscapes, room acoustics, character dialogue, and physical action sounds ONLY. Strictly NO music, NO BGM, NO score, NO non-diegetic audio.`,
    do_not_change: 'Strictly preserve costume color and weave, location architecture, and period lighting across all sequence shots.',
    negative_prompt: compileNegativePrompt(data),
  };
}

/**
 * Production Prompt Contract Validator (Gatekeeper before DB Persistence)
 */
export interface PromptContractValidationResult {
  valid: boolean;
  model: PromptTarget;
  duration: number;
  sceneId?: string;
  shotId?: string;
  failedRules: string[];
  errorMessage?: string;
  errorCode?: string;
}

export const PROMPT_CONTRACT_VALIDATION_FAILED = 'PROMPT_CONTRACT_VALIDATION_FAILED' as const;

/**
 * PATCH 5.5-R1 (Fase 4): structured contract failure.
 *
 * Thrown when a generated prompt fails validateProductionPromptContract(). It
 * carries the full validation result so API layers can answer 422 with the
 * exact failed rules instead of string-matching an error message. A prompt that
 * produces this error must NEVER reach the database.
 */
export class PromptContractValidationError extends Error {
  readonly code = PROMPT_CONTRACT_VALIDATION_FAILED;
  readonly model: PromptTarget;
  readonly duration: number;
  readonly failedRules: string[];
  readonly sceneId?: string;
  readonly shotId?: string;

  constructor(result: PromptContractValidationResult) {
    super(
      result.errorMessage ||
        `${PROMPT_CONTRACT_VALIDATION_FAILED}: prompt untuk target "${result.model}" gagal kontrak produksi ` +
          `(${result.failedRules.join('; ')}).`
    );
    this.name = 'PromptContractValidationError';
    this.model = result.model;
    this.duration = result.duration;
    this.failedRules = result.failedRules;
    this.sceneId = result.sceneId;
    this.shotId = result.shotId;
    // Preserve instanceof across the TS -> JS downlevel boundary.
    Object.setPrototypeOf(this, PromptContractValidationError.prototype);
  }

  toPayload(): {
    code: typeof PROMPT_CONTRACT_VALIDATION_FAILED;
    model: PromptTarget;
    duration: number;
    failedRules: string[];
    sceneId?: string;
    shotId?: string;
  } {
    return {
      code: this.code,
      model: this.model,
      duration: this.duration,
      failedRules: this.failedRules,
      sceneId: this.sceneId,
      shotId: this.shotId,
    };
  }
}

export function isPromptContractValidationError(err: unknown): err is PromptContractValidationError {
  return err instanceof PromptContractValidationError;
}

/**
 * Runs the contract validator and throws PromptContractValidationError on
 * failure. This is the only form callers on the persistence path should use —
 * it makes "validated" and "persistable" the same condition.
 */
export function assertProductionPromptContract(
  promptText: string,
  model: PromptTarget,
  duration: number,
  context?: { sceneId?: string; shotId?: string; isProphetScene?: boolean; masterData?: MasterSceneData }
): PromptContractValidationResult {
  const result = validateProductionPromptContract(promptText, model, duration, context);
  if (!result.valid) {
    throw new PromptContractValidationError(result);
  }
  return result;
}

export function validateProductionPromptContract(
  promptText: string,
  model: PromptTarget,
  duration: number,
  context?: { sceneId?: string; shotId?: string; isProphetScene?: boolean; masterData?: MasterSceneData }
): PromptContractValidationResult {
  const failedRules: string[] = [];

  if (!promptText || typeof promptText !== 'string' || promptText.trim().length < 50) {
    failedRules.push('EMPTY_OR_INSUFFICIENT_PROMPT_LENGTH');
  }

  // 1. Legacy Marker Rejection
  const legacyMarkers = [
    '@Engine:',
    '@Global_Style:',
    '@Shot_Breakdown:',
    '@Camera_Direction:',
    '@Audio_Design:',
    '@Consistency_Lock:',
  ];
  for (const marker of legacyMarkers) {
    if (promptText.includes(marker)) {
      failedRules.push(`LEGACY_MARKER_DETECTED: ${marker}`);
    }
  }

  // 1b. Duplicate Lock Block Rejection (Spoofing / Injection Prevention)
  const lockBlockTags = [
    '\\[LOCKED CAMERA CONSTRAINT\\]',
    '\\[LOCKED COMPOSITION CONSTRAINT\\]',
    '\\[LOCKED CHARACTER CONSTRAINT\\]',
    '\\[LOCKED COSTUME CONSTRAINT\\]',
    '\\[LOCKED LOCATION CONSTRAINT\\]',
    '\\[LOCKED LIGHTING CONSTRAINT\\]',
  ];
  for (const tag of lockBlockTags) {
    const matches = promptText.match(new RegExp(tag, 'g'));
    if (matches && matches.length > 1) {
      failedRules.push(`DUPLICATE_LOCK_BLOCK_DETECTED: Multiple occurrences of ${tag.replace(/\\/g, '')}`);
    }
  }

  // 2. Placeholder Rejection
  const placeholders = [
    'Aksi sinematik kunci',
    'Visual sinematik detail',
    'Stabilized tracking camera',
    'Natural SFX',
    'pergerakan visual',
    'performing frame adegan sinematik',
  ];
  for (const ph of placeholders) {
    if (promptText.toLowerCase().includes(ph.toLowerCase())) {
      failedRules.push(`PLACEHOLDER_DETECTED: ${ph}`);
    }
  }

  // 3. Duration Checks
  if (duration <= 0) {
    failedRules.push(`DURATION_INVALID: expected positive duration, got ${duration}s`);
  }

  // 4. Model-Specific Structural Requirements
  if (model === 'banana_master_frame') {
    const requiredSections = [
      'PROJECT / SCENE',
      'SUBJECT',
      'CHARACTER VISUAL LOCK',
      'ACTION STATE',
      'LOCATION',
      'ERA / HISTORICAL CONTEXT',
      'ARCHITECTURE / ENVIRONMENT',
      'COMPOSITION',
      'CAMERA POSITION',
      'LENS',
      'DEPTH OF FIELD',
      'LIGHTING',
      'SHADOW',
      'ATMOSPHERE',
      'MOOD',
      'MATERIAL REALISM',
      'VISUAL STYLE',
      'CONTINUITY',
      'HISTORICAL ACCURACY',
      'SAFETY RESTRICTIONS',
      'NEGATIVE PROMPT',
    ];
    for (const sec of requiredSections) {
      if (!promptText.includes(sec)) {
        failedRules.push(`BANANA_MASTER_FRAME_MISSING_SECTION: ${sec}`);
      }
    }
    if (promptText.includes('0:00–0:03') || promptText.includes('0:00-0:03')) {
      failedRules.push('BANANA_MASTER_FRAME_FORBIDDEN_VIDEO_TIMELINE');
    }
  }

  if (model === 'banana_image') {
    const requiredSections = [
      'SUBJECT',
      'POSE / ACTION STATE',
      'ENVIRONMENT',
      'ARCHITECTURE',
      'COMPOSITION',
      'CAMERA',
      'LENS',
      'LIGHTING',
      'MATERIAL REALISM',
      'ATMOSPHERE',
      'COLOR / TONALITY',
      'VISUAL STYLE',
      'MOOD',
      'CONTINUITY',
      'NEGATIVE PROMPT',
    ];
    for (const sec of requiredSections) {
      if (!promptText.includes(sec)) {
        failedRules.push(`BANANA_IMAGE_MISSING_SECTION: ${sec}`);
      }
    }
    if (promptText.includes('0:00–0:03') || promptText.includes('0:00-0:03')) {
      failedRules.push('BANANA_IMAGE_FORBIDDEN_VIDEO_TIMELINE');
    }
  }

  if (model === 'veo') {
    const requiredSections = [
      'SCENE',
      `DURATION: ${duration}s`,
      'REFERENCE / MASTER FRAME',
      'VISUAL CONTINUITY',
      'OPENING STATE',
      'PRIMARY ACTION',
      'RESOLUTION / END STATE',
      'CAMERA MOTION',
      'SUBJECT MOTION',
      'ENVIRONMENT MOTION',
      'LIGHTING MOTION',
      'PHYSICS',
      'CONTINUITY',
      'NEGATIVE PROMPT',
    ];
    for (const sec of requiredSections) {
      if (!promptText.includes(sec)) {
        failedRules.push(`VEO_MISSING_SECTION: ${sec}`);
      }
    }
  }

  if (model === 'omni') {
    const requiredSections = [
      'TASK',
      `DURATION: ${duration}s`,
      'REFERENCE IMAGE',
      'REFERENCE FIDELITY',
      'CHARACTER PRESERVATION',
      'WARDROBE PRESERVATION',
      'LOCATION PRESERVATION',
      'LIGHTING PRESERVATION',
      'INITIAL STATE',
      'ACTION INITIATION',
      'ACTION DEVELOPMENT',
      'FINAL STATE',
      'CAMERA PATH',
      'SUBJECT MOVEMENT',
      'ENVIRONMENT MOVEMENT',
      'PHYSICS',
      'CONTINUITY',
      'NEGATIVE PROMPT',
    ];
    for (const sec of requiredSections) {
      if (!promptText.includes(sec)) {
        failedRules.push(`OMNI_MISSING_SECTION: ${sec}`);
      }
    }
  }

  if (model === 'seedance_10') {
    const requiredSections = [
      'SEEDANCE 2.5',
      `DURATION: ${duration}s`,
      'SCENE',
      'CHARACTERS',
      'LOCATION',
      'ERA',
      'EMOTIONAL ARC',
      'VISUAL ARC',
      'OPENING / SETUP',
      'MAIN ACTION',
      'RESOLUTION',
      'CAMERA MOVEMENT',
      'SUBJECT PERFORMANCE',
      'ENVIRONMENT',
      'LIGHTING',
      'TRANSITIONS',
      'CONTINUITY',
      'NEGATIVE PROMPT',
    ];
    for (const sec of requiredSections) {
      if (!promptText.includes(sec)) {
        failedRules.push(`SEEDANCE_10_MISSING_SECTION: ${sec}`);
      }
    }
  }

  if (model === 'seedance_30') {
    const requiredSections = [
      'SEEDANCE 2.5',
      `DURATION: ${duration}s`,
      'SCENE',
      'CHARACTERS',
      'LOCATION',
      'ERA',
      'EMOTIONAL ARC',
      'VISUAL ARC',
      'OPENING',
      'DEVELOPMENT',
      'ESCALATION',
      'RESOLUTION',
      'ENDING',
      'CAMERA EVOLUTION',
      'CHARACTER CONTINUITY',
      'ENVIRONMENT CONTINUITY',
      'LIGHTING EVOLUTION',
      'PHYSICS',
      'TRANSITION LOGIC',
      'NEGATIVE PROMPT',
    ];
    for (const sec of requiredSections) {
      if (!promptText.includes(sec)) {
        failedRules.push(`SEEDANCE_30_MISSING_SECTION: ${sec}`);
      }
    }
  }

  // 4b. Audio Purity Contract Validation
  const audioPurityCheck = validateAudioPurityContract(promptText, model);
  if (!audioPurityCheck.valid) {
    failedRules.push(...audioPurityCheck.failedRules);
  }

  // 5. Rasulullah ﷺ Safety Guardrails Check
  const lowerPrompt = promptText.toLowerCase();
  const isProphet = context?.isProphetScene || lowerPrompt.includes('rasulullah') || lowerPrompt.includes('muhammad');
  if (isProphet) {
    const positiveViolations = [
      'locked facial geometry',
      'exact facial identity',
      'face identity locked: true',
      'frontal face portrait',
      'visible eyes looking',
      'detailed facial expression on rasulullah',
      'photorealistic face of rasulullah',
    ];
    for (const v of positiveViolations) {
      if (lowerPrompt.includes(v)) {
        failedRules.push(`RASULULLAH_SAFETY_VIOLATION: ${v}`);
      }
    }
  }

  // 6. Semantic Contract Verification for Locked Invariants (Phase 3.7M & 3.7P)
  if (context?.masterData) {
    const md = context.masterData;

    // Camera Lock Validation — bounded strictly to authoritative [LOCKED CAMERA CONSTRAINT] block
    if (md.continuity?.camera_lock && md.camera) {
      const cameraBlockMatch = promptText.match(/\[LOCKED CAMERA CONSTRAINT\]:[\s\S]*?(?=(?:\r?\n\[|$))/);
      if (!cameraBlockMatch) {
        failedRules.push('SEMANTIC_CAMERA_LOCK_VIOLATION: Missing authoritative [LOCKED CAMERA CONSTRAINT] block');
      } else {
        const authoritativeCameraBlock = cameraBlockMatch[0];
        const expectedCameraFields = [
          `angle: ${md.camera.angle}`,
          `lens: ${md.camera.lens}`,
          `focal length: ${md.camera.focal_length}`,
          `movement: ${md.camera.movement}`,
          `depth of field: ${md.camera.depth_of_field}`,
          `framing: ${md.camera.framing}`,
          `position: ${md.camera.position}`,
          `speed: ${md.camera.speed}`,
        ];
        for (const field of expectedCameraFields) {
          if (!authoritativeCameraBlock.includes(field)) {
            failedRules.push(`SEMANTIC_CAMERA_LOCK_VIOLATION: Missing or mutated expected camera constraint "${field}" in authoritative block`);
          }
        }
      }
    }

    // Composition Lock Validation — bounded strictly to authoritative [LOCKED COMPOSITION CONSTRAINT] block
    if (md.continuity?.composition_lock && md.composition) {
      const compBlockMatch = promptText.match(/\[LOCKED COMPOSITION CONSTRAINT\]:[\s\S]*?(?=(?:\r?\n\[|$))/);
      if (!compBlockMatch) {
        failedRules.push('SEMANTIC_COMPOSITION_LOCK_VIOLATION: Missing authoritative [LOCKED COMPOSITION CONSTRAINT] block');
      } else {
        const authoritativeCompBlock = compBlockMatch[0];
        const expectedCompositionFields = [
          `layout: ${md.composition.layout}`,
          `subject placement: ${md.composition.subject_placement}`,
          `visual balance: ${md.composition.visual_balance}`,
          `foreground layer: ${md.composition.foreground}`,
          `background layer: ${md.composition.background}`,
          `spatial relationship: ${md.composition.spatial_relationship}`,
        ];
        for (const field of expectedCompositionFields) {
          if (!authoritativeCompBlock.includes(field)) {
            failedRules.push(`SEMANTIC_COMPOSITION_LOCK_VIOLATION: Missing or mutated expected composition constraint "${field}" in authoritative block`);
          }
        }
      }
    }

    // Character Lock Validation — bounded strictly to authoritative [LOCKED CHARACTER CONSTRAINT] block (Phase 3.8A)
    if (md.continuity?.character_lock && md.characters && md.characters.length > 0) {
      const charBlockMatch = promptText.match(/\[LOCKED CHARACTER CONSTRAINT\]:[\s\S]*?(?=(?:\r?\n\[|$))/);
      if (!charBlockMatch) {
        failedRules.push('SEMANTIC_CHARACTER_LOCK_VIOLATION: Missing authoritative [LOCKED CHARACTER CONSTRAINT] block');
      } else {
        const authoritativeCharBlock = charBlockMatch[0];
        for (const c of md.characters) {
          const isRestricted = Boolean(c.prophet_restrictions || md.is_prophet_scene);
          const faceLockedStr = isRestricted
            ? 'PROHIBITED (aniconism/silhouette only)'
            : (c.face_locked !== false ? 'TRUE' : 'FALSE');
          const prophetRestrStr = isRestricted ? 'TRUE' : 'FALSE';
          const appearanceStr = c.appearance || (c as any).physical_appearance || (c as any).faceDescription || 'Authentic period appearance';

          const expectedCharFields = [
            `name: ${c.name}`,
            `age: ${c.age}`,
            `gender: ${c.gender}`,
            `appearance: ${appearanceStr}`,
            `face identity locked: ${faceLockedStr}`,
            `prophet restrictions: ${prophetRestrStr}`,
          ];
          if ((c as any).hair) expectedCharFields.push(`hair: ${(c as any).hair}`);
          if ((c as any).beard) expectedCharFields.push(`beard: ${(c as any).beard}`);
          if ((c as any).movement_style) expectedCharFields.push(`movement style: ${(c as any).movement_style}`);
          if (c.accessories && Array.isArray(c.accessories) && c.accessories.length > 0) {
            expectedCharFields.push(`accessories: ${c.accessories.join(', ')}`);
          } else if (typeof (c as any).accessories === 'string' && (c as any).accessories.trim().length > 0) {
            expectedCharFields.push(`accessories: ${(c as any).accessories.trim()}`);
          }

          for (const field of expectedCharFields) {
            if (!authoritativeCharBlock.includes(field)) {
              failedRules.push(`SEMANTIC_CHARACTER_LOCK_VIOLATION: Missing or mutated expected character constraint "${field}" in authoritative block`);
            }
          }
        }
      }
    }

    // Costume Lock Validation — bounded strictly to authoritative [LOCKED COSTUME CONSTRAINT] block (Phase 3.8A)
    if (md.continuity?.clothing_lock && md.characters && md.characters.length > 0) {
      const costumeBlockMatch = promptText.match(/\[LOCKED COSTUME CONSTRAINT\]:[\s\S]*?(?=(?:\r?\n\[|$))/);
      if (!costumeBlockMatch) {
        failedRules.push('SEMANTIC_COSTUME_LOCK_VIOLATION: Missing authoritative [LOCKED COSTUME CONSTRAINT] block');
      } else {
        const authoritativeCostumeBlock = costumeBlockMatch[0];
        for (const c of md.characters) {
          let attireStr = '';
          if (Array.isArray(c.costume) && c.costume.length > 0) {
            attireStr = c.costume.join(', ');
          } else if ((c as any).wardrobe) {
            attireStr = (c as any).wardrobe;
          } else if (Array.isArray((c as any).clothing) && (c as any).clothing.length > 0) {
            attireStr = (c as any).clothing.join(', ');
          } else if (typeof (c as any).clothing === 'string' && (c as any).clothing.trim()) {
            attireStr = (c as any).clothing.trim();
          } else {
            attireStr = 'Period-appropriate authentic costume';
          }

          const expectedCostumeFields = [
            `name: ${c.name}`,
            `attire: ${attireStr}`,
          ];

          if ((c as any).costume_structure) {
            const cs = (c as any).costume_structure;
            if (cs.garment_inner) expectedCostumeFields.push(`garment inner: ${cs.garment_inner}`);
            if (cs.garment_outer) expectedCostumeFields.push(`garment outer: ${cs.garment_outer}`);
            if (cs.headwear) expectedCostumeFields.push(`headwear: ${cs.headwear}`);
            if (cs.footwear) expectedCostumeFields.push(`footwear: ${cs.footwear}`);
            if (cs.textiles) {
              expectedCostumeFields.push(`textiles: ${Array.isArray(cs.textiles) ? cs.textiles.join(', ') : cs.textiles}`);
            }
            if (cs.palette) {
              expectedCostumeFields.push(`palette: ${Array.isArray(cs.palette) ? cs.palette.join(', ') : cs.palette}`);
            }
            if (cs.layering) expectedCostumeFields.push(`layering: ${cs.layering}`);
            if (cs.condition) expectedCostumeFields.push(`condition: ${cs.condition}`);
            if (cs.cultural_significance) expectedCostumeFields.push(`cultural significance: ${cs.cultural_significance}`);
          }

          for (const field of expectedCostumeFields) {
            if (!authoritativeCostumeBlock.includes(field)) {
              failedRules.push(`SEMANTIC_COSTUME_LOCK_VIOLATION: Missing or mutated expected costume constraint "${field}" in authoritative block`);
            }
          }
        }
      }
    }

    // Location Lock Validation — bounded strictly to authoritative [LOCKED LOCATION CONSTRAINT] block (Phase 3.9)
    if (md.continuity?.location_lock && md.location) {
      const locBlockMatch = promptText.match(/\[LOCKED LOCATION CONSTRAINT\]:[\s\S]*?(?=(?:\r?\n\[|$))/);
      if (!locBlockMatch) {
        failedRules.push('SEMANTIC_LOCATION_LOCK_VIOLATION: Missing authoritative [LOCKED LOCATION CONSTRAINT] block');
      } else {
        const authoritativeLocBlock = locBlockMatch[0];
        const place = md.location.place || (md.location as any).name || 'Historical Setting';
        const era = md.location.era || (md.location as any).historical_period || 'Historical Era';
        const architecture = md.location.architecture || (md.location as any).architectural_style || 'Authentic period architecture';
        const geography = md.location.geography || (md.location as any).terrain || (md.location as any).landscape || 'Authentic regional geography';
        const environment = md.location.environment || 'Authentic period environment';
        const background = md.location.background || 'Period background';
        const foreground = md.location.foreground || 'Period foreground';

        const expectedLocFields = [
          `place: ${place}`,
          `era: ${era}`,
          `architecture: ${architecture}`,
          `geography: ${geography}`,
          `environment: ${environment}`,
          `background: ${background}`,
          `foreground: ${foreground}`,
        ];

        if (md.location.props) {
          if (Array.isArray(md.location.props) && md.location.props.length > 0) {
            expectedLocFields.push(`props: ${md.location.props.join(', ')}`);
          } else if (typeof (md.location as any).props === 'string' && (md.location as any).props.trim().length > 0) {
            expectedLocFields.push(`props: ${(md.location as any).props.trim()}`);
          }
        }
        if ((md.location as any).materials || (md.location as any).material) {
          expectedLocFields.push(`materials: ${(md.location as any).materials || (md.location as any).material}`);
        }
        if ((md.location as any).landmarks || (md.location as any).recurring_landmarks) {
          const lms = (md.location as any).landmarks || (md.location as any).recurring_landmarks;
          expectedLocFields.push(`landmarks: ${Array.isArray(lms) ? lms.join(', ') : lms}`);
        }
        if ((md.location as any).spatial_scale) {
          expectedLocFields.push(`spatial scale: ${(md.location as any).spatial_scale}`);
        }
        if ((md.location as any).condition) {
          expectedLocFields.push(`condition: ${(md.location as any).condition}`);
        }
        if ((md.location as any).cultural_details || (md.location as any).cultural_significance) {
          expectedLocFields.push(`cultural details: ${(md.location as any).cultural_details || (md.location as any).cultural_significance}`);
        }

        for (const field of expectedLocFields) {
          if (!authoritativeLocBlock.includes(field)) {
            failedRules.push(`SEMANTIC_LOCATION_LOCK_VIOLATION: Missing or mutated expected location constraint "${field}" in authoritative block`);
          }
        }
      }
    }

    // Lighting Lock Validation — bounded strictly to authoritative [LOCKED LIGHTING CONSTRAINT] block (Phase 3.9)
    if (md.continuity?.lighting_lock && md.lighting) {
      const lightingBlockMatch = promptText.match(/\[LOCKED LIGHTING CONSTRAINT\]:[\s\S]*?(?=(?:\r?\n\[|$))/);
      if (!lightingBlockMatch) {
        failedRules.push('SEMANTIC_LIGHTING_LOCK_VIOLATION: Missing authoritative [LOCKED LIGHTING CONSTRAINT] block');
      } else {
        const authoritativeLightingBlock = lightingBlockMatch[0];
        const source = md.lighting.source || 'Authentic period lighting';
        const direction = md.lighting.direction || 'Natural direction';
        const intensity = md.lighting.intensity || 'Natural intensity';
        const colorTemp = md.lighting.color_temperature || 'Authentic color temperature';
        const shadows = md.lighting.shadows || 'Natural shadows';
        const atmosphere = md.lighting.atmosphere || 'Atmospheric lighting';

        const expectedLightingFields = [
          `source: ${source}`,
          `direction: ${direction}`,
          `intensity: ${intensity}`,
          `color temperature: ${colorTemp}`,
          `shadows: ${shadows}`,
          `atmosphere: ${atmosphere}`,
        ];

        const tod = (md.lighting as any).time_of_day || md.time?.time_of_day;
        if (tod) {
          expectedLightingFields.push(`time of day: ${tod}`);
        }
        if ((md.lighting as any).ambient_illumination) {
          expectedLightingFields.push(`ambient illumination: ${(md.lighting as any).ambient_illumination}`);
        }
        if ((md.lighting as any).practical_lights) {
          const pl = (md.lighting as any).practical_lights;
          expectedLightingFields.push(`practical lights: ${Array.isArray(pl) ? pl.join(', ') : pl}`);
        }
        if ((md.lighting as any).contrast) {
          expectedLightingFields.push(`contrast: ${(md.lighting as any).contrast}`);
        }

        for (const field of expectedLightingFields) {
          if (!authoritativeLightingBlock.includes(field)) {
            failedRules.push(`SEMANTIC_LIGHTING_LOCK_VIOLATION: Missing or mutated expected lighting constraint "${field}" in authoritative block`);
          }
        }
      }
    }
  }

  const isValid = failedRules.length === 0;
  let primaryErrorCode: string | undefined = undefined;
  if (!isValid && failedRules.length > 0) {
    const firstRule = failedRules[0];
    const colonIdx = firstRule.indexOf(':');
    primaryErrorCode = colonIdx > -1 ? firstRule.substring(0, colonIdx).trim() : firstRule.trim();
  }

  return {
    valid: isValid,
    model,
    duration,
    sceneId: context?.sceneId,
    shotId: context?.shotId,
    failedRules,
    errorMessage: isValid ? undefined : `PROMPT_CONTRACT_VALIDATION_FAILED for ${model}: ${failedRules.join('; ')}`,
    errorCode: primaryErrorCode,
  };
}

/**
 * Top-Level Unified Production Prompt Contract Validator (Phase 4.0)
 * Evaluates semantic locks across all 6 invariant domains (Camera, Composition,
 * Character, Costume, Location, Lighting) and validates structural safety doctrines.
 */
export function validateUnifiedProductionPromptContract(
  promptText: string,
  model: PromptTarget,
  duration: number,
  options?: {
    masterData: MasterSceneData;
    sceneId?: string;
    shotId?: string;
    isProphetScene?: boolean;
  }
): PromptContractValidationResult {
  return validateProductionPromptContract(promptText, model, duration, options);
}

/**
 * Regression Test Suite for Prompt Generation Engine (Tests A–I)
 */
export function runPromptEngineRegressionTests(): { testId: string; name: string; passed: boolean; details: string }[] {
  const results = [];
  const mockScene: Scene = {
    id: 'test_scene_1',
    project_id: 'proj_1',
    scene_number: 1,
    title: 'Keluar Malam Hari',
    story_purpose: 'Menunjukkan mukjizat dan ketenangan',
    event: 'Rasulullah ﷺ keluar dari rumah melewati para pengepung pada malam hari.',
    duration_sec: 10,
    character_names: ['Rasulullah ﷺ'],
    location_name: 'Kediaman Makkah',
    time_of_day: 'Night',
    dramatic_purpose: 'Tension and escape',
    emotional_objective: 'Serenity amidst peril',
    narrative_function: 'Escape sequence',
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const masterData10 = serializeMasterSceneData(
    mockScene,
    [],
    null,
    [],
    [],
    [],
    'veo',
    'cinematic',
    'Sirah Nabawiyah',
    10
  );

  const masterData30 = serializeMasterSceneData(
    mockScene,
    [],
    null,
    [],
    [],
    [],
    'seedance',
    'cinematic',
    'Sirah Nabawiyah',
    30
  );

  // TEST A: Generate Scene -> Banana Master Frame
  const bananaMaster = adaptBananaMasterFrame(masterData10);
  const valA = validateProductionPromptContract(bananaMaster, 'banana_master_frame', 10, { isProphetScene: true, masterData: masterData10 });
  results.push({
    testId: 'TEST-A',
    name: 'Generate Scene -> Banana Master Frame Schema',
    passed: valA.valid && bananaMaster.includes('[BANANA MASTER FRAME BLUEPRINT]'),
    details: valA.valid ? 'Banana Master Frame conforms strictly to static specification.' : valA.errorMessage || '',
  });

  // TEST B: Generate Scene -> Banana Image
  const bananaImg = adaptBananaImagePrompt(masterData10);
  const valB = validateProductionPromptContract(bananaImg, 'banana_image', 10, { isProphetScene: true, masterData: masterData10 });
  results.push({
    testId: 'TEST-B',
    name: 'Generate Scene -> Banana Image Schema',
    passed: valB.valid && bananaImg.includes('[BANANA IMAGE GENERATION PROMPT]'),
    details: valB.valid ? 'Banana Image conforms strictly to image-generation contract without timeline.' : valB.errorMessage || '',
  });

  // TEST C: Generate Scene -> Veo 10s
  const veoRes = adaptVeoVideoPrompt(masterData10, []);
  const valC = validateProductionPromptContract(veoRes.prompt, 'veo', 10, { isProphetScene: true, masterData: masterData10 });
  results.push({
    testId: 'TEST-C',
    name: 'Generate Scene -> Veo 10s Schema',
    passed: valC.valid && veoRes.prompt.includes('DURATION: 10s'),
    details: valC.valid ? 'Veo 10s conforms strictly to 10-second temporal contract.' : valC.errorMessage || '',
  });

  // TEST D: Generate Scene -> Omni 10s
  const omniRes = adaptOmniVideoPrompt(masterData10);
  const valD = validateProductionPromptContract(omniRes.prompt, 'omni', 10, { isProphetScene: true, masterData: masterData10 });
  results.push({
    testId: 'TEST-D',
    name: 'Generate Scene -> Omni 10s Schema',
    passed: valD.valid && omniRes.prompt.includes('DURATION: 10s'),
    details: valD.valid ? 'Omni 10s conforms strictly to reference-preserving contract.' : valD.errorMessage || '',
  });

  // TEST E: Generate Scene -> Seedance 10s
  const seed10Res = adaptSeedanceVideoPrompt(masterData10);
  const valE = validateProductionPromptContract(seed10Res.shot_breakdown, 'seedance_10', 10, { isProphetScene: true, masterData: masterData10 });
  results.push({
    testId: 'TEST-E',
    name: 'Generate Scene -> Seedance 10s Schema',
    passed: valE.valid && seed10Res.shot_breakdown.includes('DURATION: 10s'),
    details: valE.valid ? 'Seedance 10s conforms strictly to 3-beat 10s breakdown.' : valE.errorMessage || '',
  });

  // TEST F: Generate Scene -> Seedance 30s
  const seed30Res = adaptSeedanceVideoPrompt(masterData30);
  const valF = validateProductionPromptContract(seed30Res.shot_breakdown, 'seedance_30', 30, { isProphetScene: true, masterData: masterData30 });
  results.push({
    testId: 'TEST-F',
    name: 'Generate Scene -> Seedance 30s Schema',
    passed: valF.valid && seed30Res.shot_breakdown.includes('DURATION: 30s') && seed30Res.shot_breakdown.includes('SHOT 5'),
    details: valF.valid ? 'Seedance 30s conforms strictly to 5-shot extended breakdown.' : valF.errorMessage || '',
  });

  // TEST G: Legacy Marker Injection Detection
  const legacyInjection = `${veoRes.prompt}\n@Engine: Seedance 2.5 (ByteDance)\n@Global_Style: Historical\n@Shot_Breakdown: Shot #1`;
  const valG = validateProductionPromptContract(legacyInjection, 'veo', 10);
  results.push({
    testId: 'TEST-G',
    name: 'Legacy Marker Rejection Gatekeeper',
    passed: !valG.valid && valG.failedRules.some((r) => r.includes('LEGACY_MARKER_DETECTED')),
    details: 'Contract validator successfully blocks legacy @Engine/@Global_Style tags.',
  });

  // TEST H: Placeholder Injection Detection
  const placeholderInjection = `${omniRes.prompt}\nAksi sinematik kunci with Stabilized tracking camera and Natural SFX`;
  const valH = validateProductionPromptContract(placeholderInjection, 'omni', 10);
  results.push({
    testId: 'TEST-H',
    name: 'Placeholder Rejection Gatekeeper',
    passed: !valH.valid && valH.failedRules.some((r) => r.includes('PLACEHOLDER_DETECTED')),
    details: 'Contract validator successfully blocks generic placeholder strings.',
  });

  // TEST I: UI / Production Stage Call Graph Consistency
  // Proves that adapters produce contract-compliant output through the unified engine
  const valI_Master = validateProductionPromptContract(bananaMaster, 'banana_master_frame', 10, { masterData: masterData10 });
  const valI_Seed30 = validateProductionPromptContract(seed30Res.shot_breakdown, 'seedance_30', 30, { masterData: masterData30 });
  results.push({
    testId: 'TEST-I',
    name: 'UI Production Call Graph Consistency',
    passed: valI_Master.valid && valI_Seed30.valid,
    details: 'Unified cinematic prompt engine drives both pipeline stages and UI regeneration endpoints.',
  });

  // TEST J: Cross-Provider Semantic Regression (Phase 3.7N)
  const testJMasterData10: MasterSceneData = JSON.parse(JSON.stringify(masterData10));
  testJMasterData10.camera = {
    shot_type: 'extreme close-up',
    angle: 'low-angle',
    position: 'Eye-level lock',
    lens: '135mm',
    focal_length: '135mm',
    movement: 'Slow Dolly Shot',
    speed: '24fps',
    framing: 'extreme close-up',
    focus: 'Shallow focus',
    depth_of_field: 'f/2.8 cinematic depth',
  };
  testJMasterData10.composition = {
    layout: 'negative-space-right',
    subject_placement: 'far-right',
    visual_balance: 'strong asymmetrical balance',
    foreground: 'dark foreground',
    background: 'wide environmental depth',
    spatial_relationship: 'Intimate Proximity',
  };
  testJMasterData10.continuity = {
    camera_lock: true,
    composition_lock: true,
    character_lock: false,
    clothing_lock: false,
    location_lock: false,
    lighting_lock: false,
    prop_lock: false,
    style_lock: false,
  };

  const testJMasterData30: MasterSceneData = JSON.parse(JSON.stringify(testJMasterData10));
  testJMasterData30.duration_sec = 30;

  const bananaMasterJ = adaptBananaMasterFrame(testJMasterData10);
  const bananaImgJ = adaptBananaImagePrompt(testJMasterData10);
  const veoResJ = adaptVeoVideoPrompt(testJMasterData10, []);
  const omniResJ = adaptOmniVideoPrompt(testJMasterData10);
  const seedanceResJ = adaptSeedanceVideoPrompt(testJMasterData30);

  const valJ_Master = validateProductionPromptContract(bananaMasterJ, 'banana_master_frame', 10, { masterData: testJMasterData10 });
  const valJ_Img = validateProductionPromptContract(bananaImgJ, 'banana_image', 10, { masterData: testJMasterData10 });
  const valJ_Veo = validateProductionPromptContract(veoResJ.prompt, 'veo', 10, { masterData: testJMasterData10 });
  const valJ_Omni = validateProductionPromptContract(omniResJ.prompt, 'omni', 10, { masterData: testJMasterData10 });
  const valJ_Seed = validateProductionPromptContract(seedanceResJ.shot_breakdown, 'seedance_30', 30, { masterData: testJMasterData30 });

  const testJPassed = valJ_Master.valid && valJ_Img.valid && valJ_Veo.valid && valJ_Omni.valid && valJ_Seed.valid;
  
  const testJDetails = testJPassed 
    ? 'All 5 providers (Banana Master, Banana Image, Veo, Omni, Seedance) successfully compiled and passed strict semantic lock enforcement for all 14 canonical fields.'
    : `Semantic enforcement failure. Errors: Master: ${valJ_Master.errorMessage || 'OK'}, Img: ${valJ_Img.errorMessage || 'OK'}, Veo: ${valJ_Veo.errorMessage || 'OK'}, Omni: ${valJ_Omni.errorMessage || 'OK'}, Seed: ${valJ_Seed.errorMessage || 'OK'}`;

  results.push({
    testId: 'TEST-J',
    name: 'Cross-Provider Semantic Lock Regression',
    passed: testJPassed,
    details: testJDetails,
  });

  // TEST K: Canonical Framing Precedence Over Legacy Shot Type (Phase 3.7P)
  const shotWithFramingAndShotType: Shot = {
    id: 'shot_prec_01',
    scene_id: 'test_scene_1',
    project_id: 'proj_1',
    shot_number: 1,
    start_time_sec: 0,
    end_time_sec: 10,
    duration_sec: 10,
    event_detail: 'Abdul Muthalib standing near Kaaba holding parchment scroll',
    character_action: 'Holding ancient parchment',
    camera_note: 'Static camera',
    dialogue: [],
    emotion: 'Reverence',
    audio_note: '',
    shot_type: 'WIDE_ESTABLISHING_SHOT',
    camera_movement: 'Static',
    camera: {
      framing: 'Tight Extreme Close-up on Calligraphy Parchment',
      lens: '85mm prime',
      angle: 'eye-level',
      position: 'Ground rig',
      focal_length: '85mm',
      movement: 'Locked Static',
      speed: '24fps',
      depth_of_field: 'f/1.8 cinematic bokeh',
    },
    version: 1,
  };

  const mdPrecedence = serializeMasterSceneData(
    mockScene,
    [shotWithFramingAndShotType],
    null,
    [],
    [],
    [],
    'banana',
    'cinematic',
    'Historical Project',
    10
  );

  const bananaImgPrecedence = adaptBananaImagePrompt(mdPrecedence);
  const bananaMasterPrecedence = adaptBananaMasterFrame(mdPrecedence);

  const kPassed = mdPrecedence.camera.framing === 'Tight Extreme Close-up on Calligraphy Parchment'
    && mdPrecedence.camera.shot_type === 'Tight Extreme Close-up on Calligraphy Parchment'
    && bananaImgPrecedence.includes('CAMERA: Tight Extreme Close-up on Calligraphy Parchment')
    && !bananaImgPrecedence.includes('CAMERA: WIDE_ESTABLISHING_SHOT');

  results.push({
    testId: 'TEST-K',
    name: 'Canonical Framing Precedence Over Legacy Shot Type',
    passed: kPassed,
    details: kPassed
      ? 'Canonical camera.framing reliably supersedes legacy shot_type in MasterSceneData and Banana Image prompt.'
      : `Precedence collision detected. Banana Image output: ${bananaImgPrecedence}`,
  });

  // TEST L: All Canonical Camera Fields Survive Across 5 Providers (Phase 3.7P)
  const testLMasterData: MasterSceneData = JSON.parse(JSON.stringify(masterData10));
  testLMasterData.camera = {
    shot_type: 'Dynamic Chiaroscuro Two-Shot',
    angle: 'steep-low-angle',
    position: 'Over-the-shoulder low rig',
    lens: '28mm anamorphic prime',
    focal_length: '28mm',
    movement: 'Complex Crane Pan',
    speed: 'Hyper-slow 60fps overcrank',
    framing: 'Dynamic Chiaroscuro Two-Shot',
    focus: 'Razor sharp focus',
    depth_of_field: 'f/1.4 razor shallow depth',
  };
  testLMasterData.continuity = {
    camera_lock: true,
    composition_lock: false,
    character_lock: false,
    clothing_lock: false,
    location_lock: false,
    lighting_lock: false,
    prop_lock: false,
    style_lock: false,
  };

  const bananaMasterL = adaptBananaMasterFrame(testLMasterData);
  const bananaImgL = adaptBananaImagePrompt(testLMasterData);
  const veoResL = adaptVeoVideoPrompt(testLMasterData, []);
  const omniResL = adaptOmniVideoPrompt(testLMasterData);
  const testLMasterData30 = JSON.parse(JSON.stringify(testLMasterData));
  testLMasterData30.duration_sec = 30;
  const seedanceResL = adaptSeedanceVideoPrompt(testLMasterData30);

  const valL_Master = validateProductionPromptContract(bananaMasterL, 'banana_master_frame', 10, { masterData: testLMasterData });
  const valL_Img = validateProductionPromptContract(bananaImgL, 'banana_image', 10, { masterData: testLMasterData });
  const valL_Veo = validateProductionPromptContract(veoResL.prompt, 'veo', 10, { masterData: testLMasterData });
  const valL_Omni = validateProductionPromptContract(omniResL.prompt, 'omni', 10, { masterData: testLMasterData });
  const valL_Seed = validateProductionPromptContract(seedanceResL.shot_breakdown, 'seedance_30', 30, { masterData: testLMasterData30 });

  const all8CameraFields = [
    'angle: steep-low-angle',
    'lens: 28mm anamorphic prime',
    'focal length: 28mm',
    'movement: Complex Crane Pan',
    'depth of field: f/1.4 razor shallow depth',
    'framing: Dynamic Chiaroscuro Two-Shot',
    'position: Over-the-shoulder low rig',
    'speed: Hyper-slow 60fps overcrank',
  ];

  const promptsL = [bananaMasterL, bananaImgL, veoResL.prompt, omniResL.prompt, seedanceResL.shot_breakdown];
  const allPromptsHaveAll8CameraFields = promptsL.every((p) => {
    const match = p.match(/\[LOCKED CAMERA CONSTRAINT\]:[\s\S]*?(?=(?:\r?\n\[|$))/);
    return match && all8CameraFields.every((f) => match[0].includes(f));
  });

  const testLPassed = valL_Master.valid && valL_Img.valid && valL_Veo.valid && valL_Omni.valid && valL_Seed.valid && allPromptsHaveAll8CameraFields;
  results.push({
    testId: 'TEST-L',
    name: 'Survival of All 8 Canonical Camera Fields',
    passed: testLPassed,
    details: testLPassed
      ? 'All 8 canonical camera fields survived faithfully across all 5 provider adapters and passed bounded validator.'
      : 'One or more canonical camera fields failed to survive in the authoritative constraint block.',
  });

  // TEST M: All Canonical Composition Fields Survive Across 5 Providers (Phase 3.7P)
  const testMMasterData: MasterSceneData = JSON.parse(JSON.stringify(masterData10));
  testMMasterData.composition = {
    layout: 'golden-spiral-diagonal',
    subject_placement: 'lower-third-cross',
    visual_balance: 'dramatic counterweight',
    foreground: 'antique bronze lantern in soft blur',
    background: 'towering stone archway with moonlight',
    spatial_relationship: 'Separated by wide chasm',
  };
  testMMasterData.continuity = {
    camera_lock: false,
    composition_lock: true,
    character_lock: false,
    clothing_lock: false,
    location_lock: false,
    lighting_lock: false,
    prop_lock: false,
    style_lock: false,
  };

  const bananaMasterM = adaptBananaMasterFrame(testMMasterData);
  const bananaImgM = adaptBananaImagePrompt(testMMasterData);
  const veoResM = adaptVeoVideoPrompt(testMMasterData, []);
  const omniResM = adaptOmniVideoPrompt(testMMasterData);
  const testMMasterData30 = JSON.parse(JSON.stringify(testMMasterData));
  testMMasterData30.duration_sec = 30;
  const seedanceResM = adaptSeedanceVideoPrompt(testMMasterData30);

  const valM_Master = validateProductionPromptContract(bananaMasterM, 'banana_master_frame', 10, { masterData: testMMasterData });
  const valM_Img = validateProductionPromptContract(bananaImgM, 'banana_image', 10, { masterData: testMMasterData });
  const valM_Veo = validateProductionPromptContract(veoResM.prompt, 'veo', 10, { masterData: testMMasterData });
  const valM_Omni = validateProductionPromptContract(omniResM.prompt, 'omni', 10, { masterData: testMMasterData });
  const valM_Seed = validateProductionPromptContract(seedanceResM.shot_breakdown, 'seedance_30', 30, { masterData: testMMasterData30 });

  const all6CompFields = [
    'layout: golden-spiral-diagonal',
    'subject placement: lower-third-cross',
    'visual balance: dramatic counterweight',
    'foreground layer: antique bronze lantern in soft blur',
    'background layer: towering stone archway with moonlight',
    'spatial relationship: Separated by wide chasm',
  ];

  const promptsM = [bananaMasterM, bananaImgM, veoResM.prompt, omniResM.prompt, seedanceResM.shot_breakdown];
  const allPromptsHaveAll6CompFields = promptsM.every((p) => {
    const match = p.match(/\[LOCKED COMPOSITION CONSTRAINT\]:[\s\S]*?(?=(?:\r?\n\[|$))/);
    return match && all6CompFields.every((f) => match[0].includes(f));
  });

  const testMPassed = valM_Master.valid && valM_Img.valid && valM_Veo.valid && valM_Omni.valid && valM_Seed.valid && allPromptsHaveAll6CompFields;
  results.push({
    testId: 'TEST-M',
    name: 'Survival of All 6 Canonical Composition Fields',
    passed: testMPassed,
    details: testMPassed
      ? 'All 6 canonical composition fields survived faithfully across all 5 provider adapters and passed bounded validator.'
      : 'One or more canonical composition fields failed to survive in the authoritative constraint block.',
  });

  // TEST N: Mutation of Any Authoritative Field Fails Validation (Phase 3.7P)
  const baseLockedPrompt = bananaMasterJ;
  const cameraFieldMutations = [
    { target: 'angle: low-angle', replacement: 'angle: high-angle-tampered' },
    { target: 'lens: 135mm', replacement: 'lens: 24mm-tampered' },
    { target: 'focal length: 135mm', replacement: 'focal length: 24mm-tampered' },
    { target: 'movement: Slow Dolly Shot', replacement: 'movement: Handheld Shaky-tampered' },
    { target: 'depth of field: f/2.8 cinematic depth', replacement: 'depth of field: flat-infinite-tampered' },
    { target: 'framing: extreme close-up', replacement: 'framing: wide-tampered' },
    { target: 'position: Eye-level lock', replacement: 'position: Aerial-drone-tampered' },
    { target: 'speed: 24fps', replacement: 'speed: 120fps-tampered' },
  ];
  const compFieldMutations = [
    { target: 'layout: negative-space-right', replacement: 'layout: centered-tampered' },
    { target: 'subject placement: far-right', replacement: 'subject placement: center-tampered' },
    { target: 'visual balance: strong asymmetrical balance', replacement: 'visual balance: static-tampered' },
    { target: 'foreground layer: dark foreground', replacement: 'foreground layer: bright-tampered' },
    { target: 'background layer: wide environmental depth', replacement: 'background layer: plain-tampered' },
    { target: 'spatial relationship: Intimate Proximity', replacement: 'spatial relationship: Distant-tampered' },
  ];

  let allCameraMutationsCaught = true;
  for (const m of cameraFieldMutations) {
    const mutated = baseLockedPrompt.replace(m.target, m.replacement);
    const val = validateProductionPromptContract(mutated, 'banana_master_frame', 10, { masterData: testJMasterData10 });
    if (val.valid || !val.failedRules.some((r) => r.includes('SEMANTIC_CAMERA_LOCK_VIOLATION'))) {
      allCameraMutationsCaught = false;
      break;
    }
  }

  let allCompMutationsCaught = true;
  for (const m of compFieldMutations) {
    const mutated = baseLockedPrompt.replace(m.target, m.replacement);
    const val = validateProductionPromptContract(mutated, 'banana_master_frame', 10, { masterData: testJMasterData10 });
    if (val.valid || !val.failedRules.some((r) => r.includes('SEMANTIC_COMPOSITION_LOCK_VIOLATION'))) {
      allCompMutationsCaught = false;
      break;
    }
  }

  const testNPassed = allCameraMutationsCaught && allCompMutationsCaught;
  results.push({
    testId: 'TEST-N',
    name: 'Mutation of Any Authoritative Field Fails Validation',
    passed: testNPassed,
    details: testNPassed
      ? 'Adversarial tampering of every single camera (8/8) and composition (6/6) constraint was strictly caught and rejected.'
      : 'Validator failed to reject one or more tampered authoritative constraints.',
  });

  // TEST O: Mutation of Only One Duplicate Occurrence & Boundary Gatekeeping (Phase 3.7P)
  // Attack 1: Duplicate valid lens in body text, but authoritative constraint block tampered
  const adversarialPrompt1 = baseLockedPrompt
    .replace('LENS: 135mm', 'LENS: 135mm') // duplicate in body
    .replace('lens: 135mm', 'lens: 50mm-tampered'); // mutated inside [LOCKED CAMERA CONSTRAINT]

  const valAdv1 = validateProductionPromptContract(adversarialPrompt1, 'banana_master_frame', 10, { masterData: testJMasterData10 });
  const attack1Blocked = !valAdv1.valid && valAdv1.failedRules.some((r) => r.includes('SEMANTIC_CAMERA_LOCK_VIOLATION'));

  // Attack 2: Valid authoritative block, but body occurrence modified (authoritative block remains unbroken)
  const adversarialPrompt2 = baseLockedPrompt.replace('LENS: 135mm', 'LENS: 70mm');
  const valAdv2 = validateProductionPromptContract(adversarialPrompt2, 'banana_master_frame', 10, { masterData: testJMasterData10 });
  const attack2Handled = valAdv2.valid; // Authoritative block has exact locked invariant

  // Attack 3: Authoritative block completely stripped while duplicate fields remain in body
  const strippedBlockPrompt = baseLockedPrompt.replace(/\[LOCKED CAMERA CONSTRAINT\]:[^\n\r]+/, '');
  const valAdv3 = validateProductionPromptContract(strippedBlockPrompt, 'banana_master_frame', 10, { masterData: testJMasterData10 });
  const attack3Blocked = !valAdv3.valid && valAdv3.failedRules.some((r) => r.includes('Missing authoritative [LOCKED CAMERA CONSTRAINT] block'));

  const testOPassed = attack1Blocked && attack2Handled && attack3Blocked;
  results.push({
    testId: 'TEST-O',
    name: 'Duplicate Occurrence Gatekeeping & Bounded Validation Scope',
    passed: testOPassed,
    details: testOPassed
      ? 'Validator strictly inspects authoritative constraint block; duplicate prompt occurrences outside block cannot produce false PASS.'
      : `Adversarial duplicate bypass failed. Attack1 blocked: ${attack1Blocked}, Attack2 handled: ${attack2Handled}, Attack3 blocked: ${attack3Blocked}`,
  });

  // TEST P: Distinct Locked vs Unlocked Behavior (Phase 3.7P)
  const unlockedMD: MasterSceneData = JSON.parse(JSON.stringify(testJMasterData10));
  unlockedMD.continuity = {
    camera_lock: false,
    composition_lock: false,
    character_lock: false,
    clothing_lock: false,
    location_lock: false,
    lighting_lock: false,
    prop_lock: false,
    style_lock: false,
  };

  const bananaMasterUnlocked = adaptBananaMasterFrame(unlockedMD);
  const valUnlocked = validateProductionPromptContract(bananaMasterUnlocked, 'banana_master_frame', 10, { masterData: unlockedMD });

  const hasNoConstraintHeaders = !bananaMasterUnlocked.includes('[LOCKED CAMERA CONSTRAINT]') && !bananaMasterUnlocked.includes('[LOCKED COMPOSITION CONSTRAINT]');
  const testPPassed = valUnlocked.valid && hasNoConstraintHeaders && valJ_Master.valid;

  results.push({
    testId: 'TEST-P',
    name: 'Distinct Locked vs Unlocked Constraint Behavior',
    passed: testPPassed,
    details: testPPassed
      ? 'Unlocked mode generates clean prompts without lock headers; locked mode strictly binds and validates authoritative constraint blocks.'
      : 'Unlocked and locked states failed to maintain distinct behavioral boundaries.',
  });

  // TEST Q: Legacy Fallback Integrity (Phase 3.7P)
  const legacyShot: Shot = {
    id: 'shot_legacy_01',
    scene_id: 'test_scene_1',
    project_id: 'proj_1',
    shot_number: 1,
    start_time_sec: 0,
    end_time_sec: 10,
    duration_sec: 10,
    event_detail: 'Historical character walking past ancient pillars',
    character_action: 'Walking slowly',
    camera_note: '50mm prime lens, f/1.8 shallow depth, slow push in',
    dialogue: [],
    emotion: 'Dignity',
    audio_note: '',
    shot_type: 'CLOSE_UP',
    camera_movement: 'Push-in',
    version: 1,
  };

  const mdLegacy = serializeMasterSceneData(
    mockScene,
    [legacyShot],
    null,
    [],
    [],
    [],
    'veo',
    'cinematic',
    'Historical Tale',
    10
  );

  const bananaMasterQ = adaptBananaMasterFrame(mdLegacy);
  const bananaImgQ = adaptBananaImagePrompt(mdLegacy);
  const veoResQ = adaptVeoVideoPrompt(mdLegacy, [legacyShot]);
  const omniResQ = adaptOmniVideoPrompt(mdLegacy);
  const seedanceResQ = adaptSeedanceVideoPrompt(mdLegacy);

  const valQ_Master = validateProductionPromptContract(bananaMasterQ, 'banana_master_frame', 10, { masterData: mdLegacy });
  const valQ_Img = validateProductionPromptContract(bananaImgQ, 'banana_image', 10, { masterData: mdLegacy });
  const valQ_Veo = validateProductionPromptContract(veoResQ.prompt, 'veo', 10, { masterData: mdLegacy });
  const valQ_Omni = validateProductionPromptContract(omniResQ.prompt, 'omni', 10, { masterData: mdLegacy });
  const valQ_Seed = validateProductionPromptContract(seedanceResQ.shot_breakdown, 'seedance_10', 10, { masterData: mdLegacy });

  const testQPassed = valQ_Master.valid && valQ_Img.valid && valQ_Veo.valid && valQ_Omni.valid && valQ_Seed.valid
    && mdLegacy.camera.lens.includes('50mm')
    && mdLegacy.camera.depth_of_field.includes('f/1.8');

  results.push({
    testId: 'TEST-Q',
    name: 'Legacy Fallback Parsing & Execution Integrity',
    passed: testQPassed,
    details: testQPassed
      ? 'Legacy shots without structured camera/composition objects gracefully parse camera notes and compile contract-compliant prompts.'
      : 'Legacy fallback parsing failed to resolve camera properties or generate valid prompts.',
  });

  // =========================================================================
  // PHASE 3.8A: CHARACTER & COSTUME INVARIANT REGRESSION TESTS (TEST-R TO TEST-AB)
  // =========================================================================

  // Test Setup Data for Phase 3.8A
  const mockCharR1 = {
    name: 'Abdul Muthalib',
    identity: 'Grandfather of the Prophet, Chieftain of Quraysh',
    age: '70s elder',
    gender: 'Male',
    appearance: 'Venerable patriarch, dignified noble stature, silver flowing beard',
    face_locked: true,
    prophet_restrictions: false,
    costume: ['Noble dark wool cloak with crimson trim', 'Woven linen thobe'],
    costume_structure: {
      garment_inner: 'Fine white linen tunic',
      garment_outer: 'Heavy wool bisht with gold thread trim',
      headwear: 'Traditional desert keffiyeh and braided agal',
      footwear: 'Handcrafted leather sandals',
      textiles: ['Handspun camel wool', 'Egyptian woven linen'],
      palette: ['Deep crimson', 'Desert sand', 'Charcoal grey'],
      layering: 'Triple-layer desert nobility',
      condition: 'Immaculate formal state',
      cultural_significance: 'Quraysh tribal chieftain authority attire',
    },
    hair: 'Flowing silver grey hair',
    beard: 'Full majestic silver beard',
    movement_style: 'Deliberate measured patriarchal gait',
    accessories: ['Carved onyx signet ring', 'Polished wooden walking staff'],
    pose_expression: 'Majestic posture with deep contemplative resolve',
    action: 'Standing resolute before the Kaaba sanctuary',
  };

  const testMasterDataR: MasterSceneData = {
    project_title: 'Sirah Nabawiyyah Historical Epic',
    scene_number: 1,
    scene_title: 'Vow at the Kaaba',
    scene_purpose: 'Establish historical tribal gravity and lineage continuity',
    story_context: 'Abdul Muthalib at the sacred sanctuary',
    duration_sec: 10,
    aspect_ratio: '16:9',
    model_target: 'veo',
    detail_level: 'cinematic',
    is_prophet_scene: false,
    characters: [mockCharR1],
    location: {
      place: 'Makkah Sanctuary Courtyard',
      era: '6th Century CE Pre-Islamic Hijaz',
      architecture: 'Ancient stone masonry and heavy wooden gates',
      geography: 'Desert valley surrounded by craggy arid hills',
      environment: 'Starlit nocturnal atmosphere with subtle desert breeze',
      background: 'Dark stone perimeter wall and torchlit sanctuary pillars',
      foreground: 'Worn flagstone courtyard in soft ambient shadow',
      props: ['Brazen bronze oil braziers', 'Ceremonial earthenware vessels'],
    },
    camera: {
      shot_type: 'Medium Close-Up Tracking',
      angle: 'eye-level',
      position: 'Ground dolly mount',
      lens: '50mm anamorphic prime',
      focal_length: '50mm',
      movement: 'Slow steady dolly in',
      speed: '24fps cinematic standard',
      framing: 'Medium close-up profile',
      focus: 'Sharp focus on eye line',
      depth_of_field: 'f/2.0 smooth bokeh',
    },
    composition: {
      layout: 'golden-ratio-left',
      subject_placement: 'left-third',
      visual_balance: 'dramatic asymmetric counterweight',
      foreground: 'Brazen brazier glowing warmly out of focus',
      background: 'Torchlit stone sanctuary arches',
      spatial_relationship: 'Solitary subject framed against majestic architecture',
    },
    lighting: {
      source: 'Flickering torchlight and starlight',
      direction: 'side-angle',
      intensity: 'medium chiaroscuro',
      color_temperature: '2800K warm amber with cool moonlight fill',
      shadows: 'Deep rich shadows across weathered stonework',
      atmosphere: 'Dramatic chiaroscuro shadow play',
    },
    mood: {
      emotion: 'Deep reverence and historic gravity',
      tension: 'High emotional gravitas',
      atmosphere: 'Sacred solemnity',
    },
    time: {
      time_of_day: 'Deep Night',
      season: 'Autumn',
      weather: 'Clear',
      atmosphere: 'Clear desert night air with subtle particulate',
    },
    action: {
      primary: 'Holding wooden staff while gazing at the horizon',
      secondary: 'Slow natural breathing and subtle garment flutter',
      interaction: 'Contemplating sacred space',
      environmental_reaction: 'Cloth fluttering in night breeze',
    },
    visual_style: {
      realism: 'Ultra Realistic',
      cinematic_style: 'Historical Realism',
      color_grading: 'Kodak 5219 warm tungsten contrast',
      film_texture: 'Organic 35mm fine grain',
      material_realism: 'Ultra-authentic woven wool fibers and weathered leather',
      contrast: 'High Chiaroscuro',
    },
    continuity: {
      character_lock: true,
      clothing_lock: true,
      location_lock: true,
      lighting_lock: true,
      camera_lock: true,
      composition_lock: true,
      prop_lock: true,
      style_lock: true,
    },
    negative_prompt_modules: {
      anatomy: [],
      identity: [],
      clothing: [],
      environment: [],
      camera: [],
      physics: [],
      quality: [],
      output: [],
    },
  };

  // TEST R: Canonical Character Lock Serialization
  const charBlockR = serializeLockedCharacter(testMasterDataR.characters, true, false);
  const charFieldsExpectedR = [
    'name: Abdul Muthalib',
    'age: 70s elder',
    'gender: Male',
    'appearance: Venerable patriarch, dignified noble stature, silver flowing beard',
    'face identity locked: TRUE',
    'prophet restrictions: FALSE',
    'hair: Flowing silver grey hair',
    'beard: Full majestic silver beard',
    'movement style: Deliberate measured patriarchal gait',
    'accessories: Carved onyx signet ring, Polished wooden walking staff',
  ];
  const testRPassed = charBlockR.startsWith('\n[LOCKED CHARACTER CONSTRAINT]:')
    && charFieldsExpectedR.every((f) => charBlockR.includes(f));

  results.push({
    testId: 'TEST-R',
    name: 'Canonical Character Lock Serialization',
    passed: testRPassed,
    details: testRPassed
      ? 'serializeLockedCharacter correctly emitted authoritative [LOCKED CHARACTER CONSTRAINT] with all 10 canonical character invariants.'
      : `Character lock serialization failed. Block: ${charBlockR}`,
  });

  // TEST S: Canonical Costume Lock Serialization
  const costumeBlockS = serializeLockedCostume(testMasterDataR.characters, true);
  const costumeFieldsExpectedS = [
    'name: Abdul Muthalib',
    'attire: Noble dark wool cloak with crimson trim, Woven linen thobe',
    'garment inner: Fine white linen tunic',
    'garment outer: Heavy wool bisht with gold thread trim',
    'headwear: Traditional desert keffiyeh and braided agal',
    'footwear: Handcrafted leather sandals',
    'textiles: Handspun camel wool, Egyptian woven linen',
    'palette: Deep crimson, Desert sand, Charcoal grey',
  ];
  const testSPassed = costumeBlockS.startsWith('\n[LOCKED COSTUME CONSTRAINT]:')
    && costumeFieldsExpectedS.every((f) => costumeBlockS.includes(f));

  results.push({
    testId: 'TEST-S',
    name: 'Canonical Costume Lock Serialization',
    passed: testSPassed,
    details: testSPassed
      ? 'serializeLockedCostume correctly emitted authoritative [LOCKED COSTUME CONSTRAINT] with all 8 canonical costume structure invariants.'
      : `Costume lock serialization failed. Block: ${costumeBlockS}`,
  });

  // TEST T: Character Field Mutation Rejection
  const baseLockedPromptR = adaptBananaMasterFrame(testMasterDataR);
  const charMutations = [
    { target: 'name: Abdul Muthalib', replacement: 'name: Mutated Warrior' },
    { target: 'age: 70s elder', replacement: 'age: 20s youth' },
    { target: 'gender: Male', replacement: 'gender: Female' },
    { target: 'hair: Flowing silver grey hair', replacement: 'hair: Short blonde spikes' },
    { target: 'beard: Full majestic silver beard', replacement: 'beard: Clean shaven' },
    { target: 'movement style: Deliberate measured patriarchal gait', replacement: 'movement style: Erratic running' },
    { target: 'face identity locked: TRUE', replacement: 'face identity locked: FALSE' },
  ];

  let allCharMutationsCaught = true;
  for (const m of charMutations) {
    const mutated = baseLockedPromptR.replace(m.target, m.replacement);
    const val = validateProductionPromptContract(mutated, 'banana_master_frame', 10, { masterData: testMasterDataR });
    if (val.valid || !val.failedRules.some((r) => r.includes('SEMANTIC_CHARACTER_LOCK_VIOLATION'))) {
      allCharMutationsCaught = false;
      break;
    }
  }

  results.push({
    testId: 'TEST-T',
    name: 'Character Field Mutation Rejection',
    passed: allCharMutationsCaught,
    details: allCharMutationsCaught
      ? 'Every single character invariant mutation in [LOCKED CHARACTER CONSTRAINT] was strictly detected and rejected.'
      : 'Validator failed to reject one or more character invariant mutations.',
  });

  // TEST U: Costume Field Mutation Rejection
  const costumeMutations = [
    { target: 'garment inner: Fine white linen tunic', replacement: 'garment inner: Modern synthetic polyester shirt' },
    { target: 'garment outer: Heavy wool bisht with gold thread trim', replacement: 'garment outer: Denim jacket' },
    { target: 'headwear: Traditional desert keffiyeh and braided agal', replacement: 'headwear: Baseball cap' },
    { target: 'footwear: Handcrafted leather sandals', replacement: 'footwear: Modern combat boots' },
    { target: 'palette: Deep crimson, Desert sand, Charcoal grey', replacement: 'palette: Neon green, Electric purple' },
  ];

  let allCostumeMutationsCaught = true;
  for (const m of costumeMutations) {
    const mutated = baseLockedPromptR.replace(m.target, m.replacement);
    const val = validateProductionPromptContract(mutated, 'banana_master_frame', 10, { masterData: testMasterDataR });
    if (val.valid || !val.failedRules.some((r) => r.includes('SEMANTIC_COSTUME_LOCK_VIOLATION'))) {
      allCostumeMutationsCaught = false;
      break;
    }
  }

  results.push({
    testId: 'TEST-U',
    name: 'Costume Field Mutation Rejection',
    passed: allCostumeMutationsCaught,
    details: allCostumeMutationsCaught
      ? 'Every single costume invariant mutation in [LOCKED COSTUME CONSTRAINT] was strictly detected and rejected.'
      : 'Validator failed to reject one or more costume invariant mutations.',
  });

  // TEST V: Character Lock Block Stripping Rejection
  const strippedCharPrompt = baseLockedPromptR.replace(/\[LOCKED CHARACTER CONSTRAINT\]:[^\n\r]+/, '');
  const valStrippedChar = validateProductionPromptContract(strippedCharPrompt, 'banana_master_frame', 10, { masterData: testMasterDataR });
  const testVPassed = !valStrippedChar.valid && valStrippedChar.failedRules.some((r) => r.includes('Missing authoritative [LOCKED CHARACTER CONSTRAINT] block'));

  results.push({
    testId: 'TEST-V',
    name: 'Character Lock Block Stripping Rejection',
    passed: testVPassed,
    details: testVPassed
      ? 'Complete stripping of [LOCKED CHARACTER CONSTRAINT] block when character_lock=true strictly triggers contract rejection.'
      : 'Validator failed to catch stripped character constraint block.',
  });

  // TEST W: Costume Lock Block Stripping Rejection
  const strippedCostumePrompt = baseLockedPromptR.replace(/\[LOCKED COSTUME CONSTRAINT\]:[^\n\r]+/, '');
  const valStrippedCostume = validateProductionPromptContract(strippedCostumePrompt, 'banana_master_frame', 10, { masterData: testMasterDataR });
  const testWPassed = !valStrippedCostume.valid && valStrippedCostume.failedRules.some((r) => r.includes('Missing authoritative [LOCKED COSTUME CONSTRAINT] block'));

  results.push({
    testId: 'TEST-W',
    name: 'Costume Lock Block Stripping Rejection',
    passed: testWPassed,
    details: testWPassed
      ? 'Complete stripping of [LOCKED COSTUME CONSTRAINT] block when clothing_lock=true strictly triggers contract rejection.'
      : 'Validator failed to catch stripped costume constraint block.',
  });

  // TEST X: Duplicate-Body Attack Rejection & Bounded Gatekeeping
  // Attack 1: Subject in body is intact, but authoritative block has mutated name
  const advCharPrompt1 = baseLockedPromptR
    .replace('name: Abdul Muthalib', 'name: Tampered Infiltrator');
  const valAdvChar1 = validateProductionPromptContract(advCharPrompt1, 'banana_master_frame', 10, { masterData: testMasterDataR });
  const adv1Caught = !valAdvChar1.valid && valAdvChar1.failedRules.some((r) => r.includes('SEMANTIC_CHARACTER_LOCK_VIOLATION'));

  // Attack 2: Authoritative block is intact, body text modified (allowed descriptive variation)
  const advCharPrompt2 = baseLockedPromptR.replace('SUBJECT: Abdul Muthalib', 'SUBJECT: The venerable tribal leader Abdul Muthalib');
  const valAdvChar2 = validateProductionPromptContract(advCharPrompt2, 'banana_master_frame', 10, { masterData: testMasterDataR });
  const adv2Passed = valAdvChar2.valid;

  const testXPassed = adv1Caught && adv2Passed;
  results.push({
    testId: 'TEST-X',
    name: 'Duplicate-Body Attack Rejection & Bounded Scope',
    passed: testXPassed,
    details: testXPassed
      ? 'Character & Costume verification is strictly bounded to the authoritative lock blocks, preventing body spoofing or false passes.'
      : 'Bounded validation scope failed for character/costume invariants.',
  });

  // TEST Y: Partial Character/Costume Lock Isolation
  const mdOffOff = JSON.parse(JSON.stringify(testMasterDataR));
  mdOffOff.continuity.character_lock = false;
  mdOffOff.continuity.clothing_lock = false;
  const promptOffOff = adaptBananaMasterFrame(mdOffOff);
  const valOffOff = validateProductionPromptContract(promptOffOff, 'banana_master_frame', 10, { masterData: mdOffOff });
  const offOffOk = valOffOff.valid && !promptOffOff.includes('[LOCKED CHARACTER CONSTRAINT]') && !promptOffOff.includes('[LOCKED COSTUME CONSTRAINT]');

  const mdOnCharOnly = JSON.parse(JSON.stringify(testMasterDataR));
  mdOnCharOnly.continuity.character_lock = true;
  mdOnCharOnly.continuity.clothing_lock = false;
  const promptOnCharOnly = adaptBananaMasterFrame(mdOnCharOnly);
  const valOnCharOnly = validateProductionPromptContract(promptOnCharOnly, 'banana_master_frame', 10, { masterData: mdOnCharOnly });
  const onCharOnlyOk = valOnCharOnly.valid && promptOnCharOnly.includes('[LOCKED CHARACTER CONSTRAINT]') && !promptOnCharOnly.includes('[LOCKED COSTUME CONSTRAINT]');

  const mdOnCostumeOnly = JSON.parse(JSON.stringify(testMasterDataR));
  mdOnCostumeOnly.continuity.character_lock = false;
  mdOnCostumeOnly.continuity.clothing_lock = true;
  const promptOnCostumeOnly = adaptBananaMasterFrame(mdOnCostumeOnly);
  const valOnCostumeOnly = validateProductionPromptContract(promptOnCostumeOnly, 'banana_master_frame', 10, { masterData: mdOnCostumeOnly });
  const onCostumeOnlyOk = valOnCostumeOnly.valid && !promptOnCostumeOnly.includes('[LOCKED CHARACTER CONSTRAINT]') && promptOnCostumeOnly.includes('[LOCKED COSTUME CONSTRAINT]');

  const mdOnBoth = JSON.parse(JSON.stringify(testMasterDataR));
  mdOnBoth.continuity.character_lock = true;
  mdOnBoth.continuity.clothing_lock = true;
  const promptOnBoth = adaptBananaMasterFrame(mdOnBoth);
  const valOnBoth = validateProductionPromptContract(promptOnBoth, 'banana_master_frame', 10, { masterData: mdOnBoth });
  const onBothOk = valOnBoth.valid && promptOnBoth.includes('[LOCKED CHARACTER CONSTRAINT]') && promptOnBoth.includes('[LOCKED COSTUME CONSTRAINT]');

  const testYPassed = offOffOk && onCharOnlyOk && onCostumeOnlyOk && onBothOk;
  results.push({
    testId: 'TEST-Y',
    name: 'Partial Character/Costume Lock Isolation Matrix',
    passed: testYPassed,
    details: testYPassed
      ? 'All 4 lock permutation states (OFF/OFF, ON/OFF, OFF/ON, ON/ON) verified distinct and fully isolated.'
      : `Lock isolation matrix failed: OffOff: ${offOffOk}, OnCharOnly: ${onCharOnlyOk}, OnCostumeOnly: ${onCostumeOnlyOk}, OnBoth: ${onBothOk}`,
  });

  // TEST Z: Cross-5-Provider Character & Costume Invariant Propagation
  const bananaMasterZ = adaptBananaMasterFrame(testMasterDataR);
  const bananaImgZ = adaptBananaImagePrompt(testMasterDataR);
  const veoResZ = adaptVeoVideoPrompt(testMasterDataR, []);
  const omniResZ = adaptOmniVideoPrompt(testMasterDataR);
  const testMasterDataR30 = JSON.parse(JSON.stringify(testMasterDataR));
  testMasterDataR30.duration_sec = 30;
  const seedanceResZ = adaptSeedanceVideoPrompt(testMasterDataR30);

  const valZ_Master = validateProductionPromptContract(bananaMasterZ, 'banana_master_frame', 10, { masterData: testMasterDataR });
  const valZ_Img = validateProductionPromptContract(bananaImgZ, 'banana_image', 10, { masterData: testMasterDataR });
  const valZ_Veo = validateProductionPromptContract(veoResZ.prompt, 'veo', 10, { masterData: testMasterDataR });
  const valZ_Omni = validateProductionPromptContract(omniResZ.prompt, 'omni', 10, { masterData: testMasterDataR });
  const valZ_Seed = validateProductionPromptContract(seedanceResZ.shot_breakdown, 'seedance_30', 30, { masterData: testMasterDataR30 });

  const allPromptsZ = [bananaMasterZ, bananaImgZ, veoResZ.prompt, omniResZ.prompt, seedanceResZ.shot_breakdown];
  const allPromptsHaveBothBlocks = allPromptsZ.every((p) =>
    p.includes('[LOCKED CHARACTER CONSTRAINT]') && p.includes('[LOCKED COSTUME CONSTRAINT]')
  );

  const testZPassed = valZ_Master.valid && valZ_Img.valid && valZ_Veo.valid && valZ_Omni.valid && valZ_Seed.valid && allPromptsHaveBothBlocks;
  results.push({
    testId: 'TEST-Z',
    name: 'Cross-5-Provider Character & Costume Propagation',
    passed: testZPassed,
    details: testZPassed
      ? 'All 5 providers faithfully serialized and validated [LOCKED CHARACTER CONSTRAINT] and [LOCKED COSTUME CONSTRAINT] blocks.'
      : 'One or more providers failed cross-provider character/costume invariant validation.',
  });

  // TEST AA: Revered Holy Figure Costume Doctrine Enforcement
  const holyCharMD: MasterSceneData = JSON.parse(JSON.stringify(testMasterDataR));
  holyCharMD.characters = [{
    name: 'Sunan Kalijaga',
    identity: 'Wali Songo spiritual luminary',
    age: 'Middle-aged sage',
    gender: 'Male',
    appearance: 'Wise serene countenance, sacred wibawa',
    face_locked: true,
    prophet_restrictions: false,
    costume: ['Black Surjan silk robe', 'Batik Parang Rusak cloth', 'Traditional Blangkon'],
    costume_structure: {
      garment_outer: 'Noble Surjan Lurik',
      headwear: 'Black Blangkon Yogyakarta',
      footwear: 'Leather Selop',
      textiles: ['Fine handwoven cotton', 'Gold leaf batik'],
      palette: ['Deep Black', 'Sogan Brown', 'Gold'],
    },
    accessories: ['Wooden prayer beads', 'Sacred keris in sandalwood scabbard'],
    pose_expression: 'Dignified spiritual presence',
    action: 'Walking quietly along the riverbank at sunset',
  }];

  const bananaMasterAA = adaptBananaMasterFrame(holyCharMD);
  const testAAPassed = isReveredHolyFigure('Sunan Kalijaga')
    && bananaMasterAA.includes('REVERED HOLY FIGURE DOCTRINE')
    && bananaMasterAA.includes('NO casual t-shirts/peasant wear')
    && bananaMasterAA.includes('[LOCKED COSTUME CONSTRAINT]')
    && bananaMasterAA.includes('Black Surjan silk robe');

  results.push({
    testId: 'TEST-AA',
    name: 'Revered Holy Figure Costume Doctrine Enforcement',
    passed: testAAPassed,
    details: testAAPassed
      ? 'Revered Holy Figure doctrine successfully enforced authentic majestic attire and barred casual clothing drift.'
      : 'Revered Holy Figure doctrine enforcement failed.',
  });

  // TEST AB: Prophetic Aniconism & Facial Restriction Safety Invariant
  const prophetMD: MasterSceneData = JSON.parse(JSON.stringify(testMasterDataR));
  prophetMD.is_prophet_scene = true;
  prophetMD.characters = [{
    name: 'Rasulullah ﷺ',
    identity: 'Prophetic character (Strict visual restrictions applied)',
    age: 'Mature',
    gender: 'Male',
    appearance: 'Dignified posture, traditional period robes',
    face_locked: false,
    prophet_restrictions: true,
    costume: ['Traditional modest historical outer garment, dark cloak'],
    accessories: [],
    pose_expression: 'Composed, silent, purposeful movement, rear/side silhouette profile',
    action: 'Quietly exiting residence',
  }];

  const prophetPrompt = adaptBananaMasterFrame(prophetMD);
  const valProphetValid = validateProductionPromptContract(prophetPrompt, 'banana_master_frame', 10, { masterData: prophetMD });
  
  // Adversarial injection of prohibited facial identity
  const prohibitedFacialPrompt = prophetPrompt.replace(
    'face identity locked: PROHIBITED (aniconism/silhouette only)',
    'face identity locked: TRUE'
  );
  const valProhibited = validateProductionPromptContract(prohibitedFacialPrompt, 'banana_master_frame', 10, { masterData: prophetMD });
  const prohibitedCaught = !valProhibited.valid && valProhibited.failedRules.some((r) => r.includes('RASULULLAH_SAFETY_VIOLATION'));

  const testABPassed = valProphetValid.valid
    && prophetPrompt.includes('face identity locked: PROHIBITED (aniconism/silhouette only)')
    && prophetPrompt.includes('prophet restrictions: TRUE')
    && prohibitedCaught;

  results.push({
    testId: 'TEST-AB',
    name: 'Prophetic Aniconism & Facial Restriction Safety Invariant',
    passed: testABPassed,
    details: testABPassed
      ? 'Prophetic aniconism guardrails strictly enforce silhouette-only depiction and successfully block all facial identity lock mutations.'
      : `Prophetic safety invariant failed. Valid: ${valProphetValid.valid}, Prohibited Caught: ${prohibitedCaught}`,
  });

  // =========================================================================
  // PHASE 3.9: LOCATION & LIGHTING INVARIANT REGRESSION TESTS (TEST-AC TO TEST-AP)
  // =========================================================================

  // TEST AC: Canonical Location Lock Serialization
  const locBlockAC = serializeLockedLocation(testMasterDataR.location, true);
  const locFieldsExpectedAC = [
    'place: Makkah Sanctuary Courtyard',
    'era: 6th Century CE Pre-Islamic Hijaz',
    'architecture: Ancient stone masonry and heavy wooden gates',
    'geography: Desert valley surrounded by craggy arid hills',
    'environment: Starlit nocturnal atmosphere with subtle desert breeze',
    'background: Dark stone perimeter wall and torchlit sanctuary pillars',
    'foreground: Worn flagstone courtyard in soft ambient shadow',
    'props: Brazen bronze oil braziers, Ceremonial earthenware vessels',
  ];
  const testACPassed = locBlockAC.startsWith('\n[LOCKED LOCATION CONSTRAINT]:')
    && locFieldsExpectedAC.every((f) => locBlockAC.includes(f))
    && !locBlockAC.includes('undefined')
    && !locBlockAC.includes('null')
    && !locBlockAC.includes('[object Object]');

  results.push({
    testId: 'TEST-AC',
    name: 'Canonical Location Lock Serialization',
    passed: testACPassed,
    details: testACPassed
      ? 'serializeLockedLocation correctly emitted authoritative [LOCKED LOCATION CONSTRAINT] with all 8 canonical location invariants.'
      : `Location lock serialization failed. Block: ${locBlockAC}`,
  });

  // TEST AD: Canonical Lighting Lock Serialization
  const lightingBlockAD = serializeLockedLighting(testMasterDataR.lighting, true, testMasterDataR.time.time_of_day);
  const lightingFieldsExpectedAD = [
    'source: Flickering torchlight and starlight',
    'direction: side-angle',
    'intensity: medium chiaroscuro',
    'color temperature: 2800K warm amber with cool moonlight fill',
    'shadows: Deep rich shadows across weathered stonework',
    'atmosphere: Dramatic chiaroscuro shadow play',
    'time of day: Deep Night',
  ];
  const testADPassed = lightingBlockAD.startsWith('\n[LOCKED LIGHTING CONSTRAINT]:')
    && lightingFieldsExpectedAD.every((f) => lightingBlockAD.includes(f))
    && !lightingBlockAD.includes('undefined')
    && !lightingBlockAD.includes('null')
    && !lightingBlockAD.includes('[object Object]');

  results.push({
    testId: 'TEST-AD',
    name: 'Canonical Lighting Lock Serialization',
    passed: testADPassed,
    details: testADPassed
      ? 'serializeLockedLighting correctly emitted authoritative [LOCKED LIGHTING CONSTRAINT] with all canonical lighting invariants.'
      : `Lighting lock serialization failed. Block: ${lightingBlockAD}`,
  });

  // TEST AE: Location Field Mutation Rejection
  const baseLockedPromptAC = adaptBananaMasterFrame(testMasterDataR);
  const locMutations = [
    { target: 'place: Makkah Sanctuary Courtyard', replacement: 'place: Modern Futuristic Metropolis' },
    { target: 'era: 6th Century CE Pre-Islamic Hijaz', replacement: 'era: 21st Century Cyberpunk' },
    { target: 'architecture: Ancient stone masonry and heavy wooden gates', replacement: 'architecture: Glass and steel skyscrapers' },
    { target: 'geography: Desert valley surrounded by craggy arid hills', replacement: 'geography: Tropical lush rainforest' },
    { target: 'environment: Starlit nocturnal atmosphere with subtle desert breeze', replacement: 'environment: Acid rain industrial smog' },
    { target: 'background: Dark stone perimeter wall and torchlit sanctuary pillars', replacement: 'background: Neon billboard skyline' },
    { target: 'foreground: Worn flagstone courtyard in soft ambient shadow', replacement: 'foreground: Asphalt highway with traffic' },
  ];

  let allLocMutationsCaught = true;
  for (const m of locMutations) {
    const mutated = baseLockedPromptAC.replace(m.target, m.replacement);
    const val = validateProductionPromptContract(mutated, 'banana_master_frame', 10, { masterData: testMasterDataR });
    if (val.valid || !val.failedRules.some((r) => r.includes('SEMANTIC_LOCATION_LOCK_VIOLATION'))) {
      allLocMutationsCaught = false;
      break;
    }
  }

  results.push({
    testId: 'TEST-AE',
    name: 'Location Field Mutation Rejection',
    passed: allLocMutationsCaught,
    details: allLocMutationsCaught
      ? 'Every single location invariant mutation in [LOCKED LOCATION CONSTRAINT] was strictly detected and rejected.'
      : 'Validator failed to reject one or more location invariant mutations.',
  });

  // TEST AF: Lighting Field Mutation Rejection
  const lightingMutations = [
    { target: 'source: Flickering torchlight and starlight', replacement: 'source: Fluorescent strobe lamps' },
    { target: 'direction: side-angle', replacement: 'direction: harsh flat overhead spotlight' },
    { target: 'intensity: medium chiaroscuro', replacement: 'intensity: washed out overexposed bright' },
    { target: 'color temperature: 2800K warm amber with cool moonlight fill', replacement: 'color temperature: 6500K harsh cool daylight' },
    { target: 'shadows: Deep rich shadows across weathered stonework', replacement: 'shadows: zero shadows flat diffuse' },
    { target: 'atmosphere: Dramatic chiaroscuro shadow play', replacement: 'atmosphere: cheerful midday sunshine' },
  ];

  let allLightingMutationsCaught = true;
  for (const m of lightingMutations) {
    const mutated = baseLockedPromptAC.replace(m.target, m.replacement);
    const val = validateProductionPromptContract(mutated, 'banana_master_frame', 10, { masterData: testMasterDataR });
    if (val.valid || !val.failedRules.some((r) => r.includes('SEMANTIC_LIGHTING_LOCK_VIOLATION'))) {
      allLightingMutationsCaught = false;
      break;
    }
  }

  results.push({
    testId: 'TEST-AF',
    name: 'Lighting Field Mutation Rejection',
    passed: allLightingMutationsCaught,
    details: allLightingMutationsCaught
      ? 'Every single lighting invariant mutation in [LOCKED LIGHTING CONSTRAINT] was strictly detected and rejected.'
      : 'Validator failed to reject one or more lighting invariant mutations.',
  });

  // TEST AG: Location Lock Block Stripping Rejection
  const strippedLocPrompt = baseLockedPromptAC.replace(/\[LOCKED LOCATION CONSTRAINT\]:[^\n\r]+/, '');
  const valStrippedLoc = validateProductionPromptContract(strippedLocPrompt, 'banana_master_frame', 10, { masterData: testMasterDataR });
  const testAGPassed = !valStrippedLoc.valid && valStrippedLoc.failedRules.some((r) => r.includes('Missing authoritative [LOCKED LOCATION CONSTRAINT] block'));

  results.push({
    testId: 'TEST-AG',
    name: 'Location Lock Block Stripping Rejection',
    passed: testAGPassed,
    details: testAGPassed
      ? 'Complete stripping of [LOCKED LOCATION CONSTRAINT] block when location_lock=true strictly triggers contract rejection.'
      : 'Validator failed to catch stripped location constraint block.',
  });

  // TEST AH: Lighting Lock Block Stripping Rejection
  const strippedLightingPrompt = baseLockedPromptAC.replace(/\[LOCKED LIGHTING CONSTRAINT\]:[^\n\r]+/, '');
  const valStrippedLighting = validateProductionPromptContract(strippedLightingPrompt, 'banana_master_frame', 10, { masterData: testMasterDataR });
  const testAHPassed = !valStrippedLighting.valid && valStrippedLighting.failedRules.some((r) => r.includes('Missing authoritative [LOCKED LIGHTING CONSTRAINT] block'));

  results.push({
    testId: 'TEST-AH',
    name: 'Lighting Lock Block Stripping Rejection',
    passed: testAHPassed,
    details: testAHPassed
      ? 'Complete stripping of [LOCKED LIGHTING CONSTRAINT] block when lighting_lock=true strictly triggers contract rejection.'
      : 'Validator failed to catch stripped lighting constraint block.',
  });

  // TEST AI: Duplicate-Body Location Attack Rejection & Bounded Scope
  // Attack 1: Mutated location in authoritative block
  const advLocPrompt1 = baseLockedPromptAC.replace('place: Makkah Sanctuary Courtyard', 'place: Unauthorized Modern City');
  const valAdvLoc1 = validateProductionPromptContract(advLocPrompt1, 'banana_master_frame', 10, { masterData: testMasterDataR });
  const advLoc1Caught = !valAdvLoc1.valid && valAdvLoc1.failedRules.some((r) => r.includes('SEMANTIC_LOCATION_LOCK_VIOLATION'));

  // Attack 2: Authoritative block intact, allowed variation in prompt body
  const advLocPrompt2 = baseLockedPromptAC.replace('LOCATION: Makkah Sanctuary Courtyard', 'LOCATION: The ancient Makkah Sanctuary Courtyard');
  const valAdvLoc2 = validateProductionPromptContract(advLocPrompt2, 'banana_master_frame', 10, { masterData: testMasterDataR });
  const advLoc2Passed = valAdvLoc2.valid;

  const testAIPassed = advLoc1Caught && advLoc2Passed;
  results.push({
    testId: 'TEST-AI',
    name: 'Duplicate-Body Location Attack Rejection & Bounded Scope',
    passed: testAIPassed,
    details: testAIPassed
      ? 'Location verification is strictly bounded to the authoritative lock block, preventing body spoofing or false passes.'
      : 'Bounded validation scope failed for location invariants.',
  });

  // TEST AJ: Duplicate-Body Lighting Attack Rejection & Bounded Scope
  // Attack 1: Mutated lighting in authoritative block
  const advLightingPrompt1 = baseLockedPromptAC.replace('source: Flickering torchlight and starlight', 'source: LED spotlight illumination');
  const valAdvLighting1 = validateProductionPromptContract(advLightingPrompt1, 'banana_master_frame', 10, { masterData: testMasterDataR });
  const advLighting1Caught = !valAdvLighting1.valid && valAdvLighting1.failedRules.some((r) => r.includes('SEMANTIC_LIGHTING_LOCK_VIOLATION'));

  // Attack 2: Authoritative block intact, allowed variation in prompt body
  const advLightingPrompt2 = baseLockedPromptAC.replace('LIGHTING: Flickering torchlight and starlight', 'LIGHTING: Flickering torches and gentle starlight');
  const valAdvLighting2 = validateProductionPromptContract(advLightingPrompt2, 'banana_master_frame', 10, { masterData: testMasterDataR });
  const advLighting2Passed = valAdvLighting2.valid;

  const testAJPassed = advLighting1Caught && advLighting2Passed;
  results.push({
    testId: 'TEST-AJ',
    name: 'Duplicate-Body Lighting Attack Rejection & Bounded Scope',
    passed: testAJPassed,
    details: testAJPassed
      ? 'Lighting verification is strictly bounded to the authoritative lock block, preventing body spoofing or false passes.'
      : 'Bounded validation scope failed for lighting invariants.',
  });

  // TEST AK: Partial Location/Lighting Lock Isolation Matrix
  const mdLocOffLightOff = JSON.parse(JSON.stringify(testMasterDataR));
  mdLocOffLightOff.continuity.location_lock = false;
  mdLocOffLightOff.continuity.lighting_lock = false;
  const promptLocOffLightOff = adaptBananaMasterFrame(mdLocOffLightOff);
  const valLocOffLightOff = validateProductionPromptContract(promptLocOffLightOff, 'banana_master_frame', 10, { masterData: mdLocOffLightOff });
  const locOffLightOffOk = valLocOffLightOff.valid
    && !promptLocOffLightOff.includes('[LOCKED LOCATION CONSTRAINT]')
    && !promptLocOffLightOff.includes('[LOCKED LIGHTING CONSTRAINT]')
    && promptLocOffLightOff.includes('[LOCKED CAMERA CONSTRAINT]')
    && promptLocOffLightOff.includes('[LOCKED CHARACTER CONSTRAINT]');

  const mdLocOnLightOff = JSON.parse(JSON.stringify(testMasterDataR));
  mdLocOnLightOff.continuity.location_lock = true;
  mdLocOnLightOff.continuity.lighting_lock = false;
  const promptLocOnLightOff = adaptBananaMasterFrame(mdLocOnLightOff);
  const valLocOnLightOff = validateProductionPromptContract(promptLocOnLightOff, 'banana_master_frame', 10, { masterData: mdLocOnLightOff });
  const locOnLightOffOk = valLocOnLightOff.valid
    && promptLocOnLightOff.includes('[LOCKED LOCATION CONSTRAINT]')
    && !promptLocOnLightOff.includes('[LOCKED LIGHTING CONSTRAINT]');

  const mdLocOffLightOn = JSON.parse(JSON.stringify(testMasterDataR));
  mdLocOffLightOn.continuity.location_lock = false;
  mdLocOffLightOn.continuity.lighting_lock = true;
  const promptLocOffLightOn = adaptBananaMasterFrame(mdLocOffLightOn);
  const valLocOffLightOn = validateProductionPromptContract(promptLocOffLightOn, 'banana_master_frame', 10, { masterData: mdLocOffLightOn });
  const locOffLightOnOk = valLocOffLightOn.valid
    && !promptLocOffLightOn.includes('[LOCKED LOCATION CONSTRAINT]')
    && promptLocOffLightOn.includes('[LOCKED LIGHTING CONSTRAINT]');

  const mdLocOnLightOn = JSON.parse(JSON.stringify(testMasterDataR));
  mdLocOnLightOn.continuity.location_lock = true;
  mdLocOnLightOn.continuity.lighting_lock = true;
  const promptLocOnLightOn = adaptBananaMasterFrame(mdLocOnLightOn);
  const valLocOnLightOn = validateProductionPromptContract(promptLocOnLightOn, 'banana_master_frame', 10, { masterData: mdLocOnLightOn });
  const locOnLightOnOk = valLocOnLightOn.valid
    && promptLocOnLightOn.includes('[LOCKED LOCATION CONSTRAINT]')
    && promptLocOnLightOn.includes('[LOCKED LIGHTING CONSTRAINT]');

  const testAKPassed = locOffLightOffOk && locOnLightOffOk && locOffLightOnOk && locOnLightOnOk;
  results.push({
    testId: 'TEST-AK',
    name: 'Partial Location/Lighting Lock Isolation Matrix',
    passed: testAKPassed,
    details: testAKPassed
      ? 'All 4 lock permutation states (OFF/OFF, ON/OFF, OFF/ON, ON/ON) verified distinct and fully isolated across Location & Lighting.'
      : `Lock isolation matrix failed: OffOff: ${locOffLightOffOk}, OnLocOnly: ${locOnLightOffOk}, OnLightOnly: ${locOffLightOnOk}, OnBoth: ${locOnLightOnOk}`,
  });

  // TEST AL: Cross-5-Provider Location & Lighting Propagation
  const bananaMasterAL = adaptBananaMasterFrame(testMasterDataR);
  const bananaImgAL = adaptBananaImagePrompt(testMasterDataR);
  const veoResAL = adaptVeoVideoPrompt(testMasterDataR, []);
  const omniResAL = adaptOmniVideoPrompt(testMasterDataR);
  const testMasterDataR30AL = JSON.parse(JSON.stringify(testMasterDataR));
  testMasterDataR30AL.duration_sec = 30;
  const seedanceResAL = adaptSeedanceVideoPrompt(testMasterDataR30AL);

  const valAL_Master = validateProductionPromptContract(bananaMasterAL, 'banana_master_frame', 10, { masterData: testMasterDataR });
  const valAL_Img = validateProductionPromptContract(bananaImgAL, 'banana_image', 10, { masterData: testMasterDataR });
  const valAL_Veo = validateProductionPromptContract(veoResAL.prompt, 'veo', 10, { masterData: testMasterDataR });
  const valAL_Omni = validateProductionPromptContract(omniResAL.prompt, 'omni', 10, { masterData: testMasterDataR });
  const valAL_Seed = validateProductionPromptContract(seedanceResAL.shot_breakdown, 'seedance_30', 30, { masterData: testMasterDataR30AL });

  const allPromptsAL = [bananaMasterAL, bananaImgAL, veoResAL.prompt, omniResAL.prompt, seedanceResAL.shot_breakdown];
  const allPromptsHaveBothBlocksAL = allPromptsAL.every((p) =>
    p.includes('[LOCKED LOCATION CONSTRAINT]') && p.includes('[LOCKED LIGHTING CONSTRAINT]')
  );

  const testALPassed = valAL_Master.valid && valAL_Img.valid && valAL_Veo.valid && valAL_Omni.valid && valAL_Seed.valid && allPromptsHaveBothBlocksAL;
  results.push({
    testId: 'TEST-AL',
    name: 'Cross-5-Provider Location & Lighting Propagation',
    passed: testALPassed,
    details: testALPassed
      ? 'All 5 providers faithfully serialized and validated [LOCKED LOCATION CONSTRAINT] and [LOCKED LIGHTING CONSTRAINT] blocks.'
      : 'One or more providers failed cross-provider location/lighting invariant validation.',
  });

  // TEST AM: Historical Location / Era Integrity Regression
  const histMD: MasterSceneData = JSON.parse(JSON.stringify(testMasterDataR));
  histMD.location.era = '6th Century CE Pre-Islamic Hijaz';
  histMD.location.architecture = 'Ancient stone masonry and heavy wooden gates';
  const histPrompt = adaptBananaMasterFrame(histMD);
  const valHistValid = validateProductionPromptContract(histPrompt, 'banana_master_frame', 10, { masterData: histMD });

  // Adversarial modern anachronism insertion in location lock block
  const anachronisticPrompt = histPrompt.replace(
    'era: 6th Century CE Pre-Islamic Hijaz',
    'era: Modern 21st Century'
  );
  const valAnachronism = validateProductionPromptContract(anachronisticPrompt, 'banana_master_frame', 10, { masterData: histMD });
  const anachronismCaught = !valAnachronism.valid && valAnachronism.failedRules.some((r) => r.includes('SEMANTIC_LOCATION_LOCK_VIOLATION'));

  const testAMPassed = valHistValid.valid && anachronismCaught;
  results.push({
    testId: 'TEST-AM',
    name: 'Historical Location / Era Integrity Regression',
    passed: testAMPassed,
    details: testAMPassed
      ? 'Historical location era integrity is strictly preserved in lock block and modern anachronisms are strictly caught.'
      : `Historical location regression failed. Valid: ${valHistValid.valid}, Anachronism caught: ${anachronismCaught}`,
  });

  // TEST AN: Lighting Continuity Mutation Regression
  const lightContMD: MasterSceneData = JSON.parse(JSON.stringify(testMasterDataR));
  lightContMD.lighting.color_temperature = '2800K warm amber with cool moonlight fill';
  lightContMD.lighting.source = 'Flickering torchlight and starlight';
  const lightContPrompt = adaptBananaMasterFrame(lightContMD);
  const valLightContValid = validateProductionPromptContract(lightContPrompt, 'banana_master_frame', 10, { masterData: lightContMD });

  // Mutation: changing lighting temperature to noon daylight
  const lightMutatedPrompt = lightContPrompt.replace(
    'color temperature: 2800K warm amber with cool moonlight fill',
    'color temperature: 5500K bright midday direct sun'
  );
  const valLightMutated = validateProductionPromptContract(lightMutatedPrompt, 'banana_master_frame', 10, { masterData: lightContMD });
  const lightMutCaught = !valLightMutated.valid && valLightMutated.failedRules.some((r) => r.includes('SEMANTIC_LIGHTING_LOCK_VIOLATION'));

  const testANPassed = valLightContValid.valid && lightMutCaught;
  results.push({
    testId: 'TEST-AN',
    name: 'Lighting Continuity Mutation Regression',
    passed: testANPassed,
    details: testANPassed
      ? 'Lighting continuity schema strictly catches color temperature and illumination mutations in lock block.'
      : `Lighting continuity regression failed. Valid: ${valLightContValid.valid}, Mut caught: ${lightMutCaught}`,
  });

  // TEST AO: Smart Regenerate Location/Lighting Lock Propagation
  const mockSceneAO: Scene = {
    id: 'scene_ao',
    project_id: 'proj_ao',
    scene_number: 2,
    title: 'Sanctuary Gathering',
    story_purpose: 'Establish setting and historical atmosphere',
    event: 'Gathering of tribal elders at twilight in the sanctuary courtyard.',
    duration_sec: 10,
    character_names: ['Abdul Muthalib'],
    location_name: 'Makkah Sanctuary Courtyard',
    time_of_day: 'Dusk',
    dramatic_purpose: 'Atmospheric depth',
    emotional_objective: 'Solemn anticipation',
    narrative_function: 'Setting establishment',
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockShotAO: Shot = {
    id: 'shot_ao_1',
    scene_id: 'scene_ao',
    project_id: 'proj_ao',
    shot_number: 1,
    start_time_sec: 0,
    end_time_sec: 10,
    character_action: 'Looking upon the courtyard',
    event_detail: 'Observing the sacred enclosure',
    duration_sec: 10,
    camera_movement: 'Slow tracking dolly',
    camera_note: 'Eye-level framing',
    dialogue: [],
    emotion: 'Solemn anticipation',
    audio_note: '',
    visual_description: 'Atmospheric twilight',
    version: 1,
    lock_state: {
      character_locked: true,
      costume_locked: true,
      location_locked: true,
      lighting_locked: true,
      camera_locked: true,
      composition_locked: true,
      action_locked: false,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const masterDataAO = serializeMasterSceneData(
    mockSceneAO,
    [mockShotAO],
    null,
    [mockCharR1 as any],
    [{
      id: 'loc_ao_1',
      project_id: 'proj_ao',
      name: 'Makkah Sanctuary Courtyard',
      era: '6th Century CE Pre-Islamic Hijaz',
      architecture_style: 'Ancient stone masonry and heavy wooden gates',
      geographical_context: 'Desert valley surrounded by craggy arid hills',
      environment: 'Starlit nocturnal atmosphere with subtle desert breeze',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any],
    [],
    'banana',
    'cinematic',
    'Sirah Nabawiyyah Historical Epic',
    10
  );

  const smartRegenPrompt = adaptBananaMasterFrame(masterDataAO);
  const valSmartRegen = validateProductionPromptContract(smartRegenPrompt, 'banana_master_frame', 10, { masterData: masterDataAO });
  const testAOPassed = valSmartRegen.valid
    && smartRegenPrompt.includes('[LOCKED LOCATION CONSTRAINT]')
    && smartRegenPrompt.includes('[LOCKED LIGHTING CONSTRAINT]')
    && smartRegenPrompt.includes('[LOCKED CHARACTER CONSTRAINT]')
    && smartRegenPrompt.includes('[LOCKED COSTUME CONSTRAINT]')
    && smartRegenPrompt.includes('[LOCKED CAMERA CONSTRAINT]')
    && smartRegenPrompt.includes('[LOCKED COMPOSITION CONSTRAINT]');

  results.push({
    testId: 'TEST-AO',
    name: 'Smart Regenerate Location/Lighting Lock Propagation',
    passed: testAOPassed,
    details: testAOPassed
      ? 'Deterministic regeneration engine seamlessly synthesized and validated full 6-lock invariant stack.'
      : `Smart regenerate lock propagation failed. Valid: ${valSmartRegen.valid}, Error: ${valSmartRegen.errorMessage}`,
  });

  // TEST AP: Legacy Location/Lighting Fallback Integrity
  const legacySceneAP: Scene = {
    id: 'scene_ap',
    project_id: 'proj_ap',
    scene_number: 3,
    title: 'Ancient Caravan Arrival',
    story_purpose: 'Narrative progression',
    event: 'Desert caravan arrives at the perimeter oasis.',
    duration_sec: 10,
    character_names: [],
    location_name: 'Desert Oasis',
    time_of_day: 'Midday',
    emotional_objective: 'Narrative arrival',
    narrative_function: 'Transition',
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const legacyMasterDataAP = serializeMasterSceneData(
    legacySceneAP,
    [],
    null,
    [],
    [],
    [],
    'banana',
    'cinematic',
    'Caravan Chronicles',
    10
  );

  const legacyPrompt = adaptBananaMasterFrame(legacyMasterDataAP);
  const valLegacy = validateProductionPromptContract(legacyPrompt, 'banana_master_frame', 10, { masterData: legacyMasterDataAP });
  const testAPPassed = valLegacy.valid
    && legacyPrompt.includes('[LOCKED LOCATION CONSTRAINT]')
    && legacyPrompt.includes('[LOCKED LIGHTING CONSTRAINT]');

  results.push({
    testId: 'TEST-AP',
    name: 'Legacy Location/Lighting Fallback Integrity',
    passed: testAPPassed,
    details: testAPPassed
      ? 'Legacy scenes without dedicated location bible or lighting objects gracefully synthesize default canonical locks.'
      : `Legacy fallback integrity failed. Valid: ${valLegacy.valid}, Error: ${valLegacy.errorMessage}`,
  });

  return results;
}
