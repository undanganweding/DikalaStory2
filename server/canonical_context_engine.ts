import {
  Project,
  ProjectFoundation,
  CharacterBible,
  LocationBible,
  ObjectBible,
  Scene,
  Shot,
  ContextPackage,
  ContinuityState,
  MasterImagePrompt,
} from '../src/types';

export function isReveredHolyFigure(nameOrRole: string): boolean {
  if (!nameOrRole) return false;
  const lower = nameOrRole.toLowerCase();
  return (
    lower.includes('sunan') ||
    lower.includes('wali') ||
    lower.includes('waliyullah') ||
    lower.includes('kyai') ||
    lower.includes('kiai') ||
    lower.includes('habib') ||
    lower.includes('ulama') ||
    lower.includes('syekh') ||
    lower.includes('sheikh') ||
    lower.includes('ustadz') ||
    lower.includes('ustad') ||
    lower.includes('nabi') ||
    lower.includes('rasul') ||
    lower.includes('prophet') ||
    lower.includes('imam') ||
    lower.includes('buya') ||
    lower.includes('gus')
  );
}

export function getReveredHolyFigureDefaultAttire(nameOrRole: string): { costumeList: string[]; wardrobeText: string; appearanceBonus: string } {
  const lower = nameOrRole.toLowerCase();

  // 1. Sunan Gunung Jati (Syarif Hidayatullah) / Cirebon Era
  if (lower.includes('gunung jati') || lower.includes('hidayatullah') || lower.includes('cirebon')) {
    const costumeList = [
      'Historically accurate early Islamic Javanese royal religious clothing from 1500s Cirebon Sultanate period',
      'Traditional white Javanese turban (iket/turban style) made from handwoven cotton cloth with carefully layered fabric folds, natural creases, and soft cotton fibers',
      'Long traditional white shawl (selendang) made from fine handwoven Javanese cotton, draped naturally over both shoulders and chest',
      'Loose long traditional robe (jubah) in light ivory and pale gray tones with wide flowing sleeves, handmade stitching, and rough woven texture (coastal Java Javanese-Islamic fusion)',
      'Dark traditional Javanese long inner shirt with subtle woven patterns',
      'Ancient Javanese jarik cloth around waist with authentic 16th century coastal batik motifs in dark earthy colors',
      'Simple traditional leather belt combined with small cloth sash, holding a historically accurate Javanese keris in antique wooden warangka sheath',
      'Aged teak wood walking staff held in right hand with visible natural wood grain',
      'String of traditional wooden tasbih prayer beads held in left hand',
      'Simple silver ring, small cloth pouch at waist, and traditional woven sandals made from natural fibers'
    ];
    return {
      costumeList,
      wardrobeText: costumeList.join(', '),
      appearanceBonus: 'Dignified 16th century Javanese spiritual leader, calm and wise expression, deep thoughtful eyes, gentle face with subtle wrinkles of wisdom, natural Southeast Asian facial features, realistic skin pores, neatly maintained short beard and mustache, peaceful humble posture'
    };
  }

  // 2. Sunan Ampel (Raden Rahmat)
  if (lower.includes('ampel') || lower.includes('raden rahmat')) {
    const costumeList = [
      'Historically accurate 15th-16th century Javanese Islamic scholar attire (Demak/Ampeldenta era)',
      'Pristine layered white handwoven cotton Sufi turban (iket/turban style) wrapped over structured headcap',
      'Long traditional white shawl (selendang) draped over shoulders and chest',
      'Noble flowing white and ivory Sufi Jubah outer robe of rough handwoven linen cloth',
      'Dark traditional Javanese inner shirt and ancient Jarik Batik sarong skirt wrapped around waist',
      'Aged teak wood walking staff in hand and dark wooden tasbih prayer beads',
      'Simple leather belt with antique Javanese keris tucked in waist, woven natural fiber sandals'
    ];
    return {
      costumeList,
      wardrobeText: costumeList.join(', '),
      appearanceBonus: 'Venerable, serene, deeply spiritual elder Javanese-Arab scholar countenance, well-groomed long white/grey honorable beard, wise luminous eyes, dignified aura of high spiritual authority and tawadhu\''
    };
  }

  // 3. Sunan Kalijaga (Raden Said)
  if (lower.includes('kalijaga') || lower.includes('raden said') || (lower.includes('jawa') && lower.includes('sunan'))) {
    const costumeList = [
      'Authentic Javanese noble Wali attire (Surjan Lurik Demak/Mataram or Baju Taqwa Wali in dark brown/black)',
      'Traditional Javanese Blangkon Jawi headgear with neat rear folds (Mondokan)',
      'Fine Jarik Batik motif Parang Barong or Sidomukti sarong skirt',
      'Woven stagen waist sash and antique Javanese keris in wooden warangka sheath tucked respectfully at the back',
      'Teak wood walking staff and dark wooden tasbih prayer beads'
    ];
    return {
      costumeList,
      wardrobeText: costumeList.join(', '),
      appearanceBonus: 'Sharp, highly charismatic Javanese noble features, neat moustache and trim beard, penetrating wise eyes, regal & approachable stature'
    };
  }

  // 4. Sunan Giri (Raden Paku / Prabu Satmata)
  if (lower.includes('giri') || lower.includes('raden paku') || lower.includes('prabu satmata')) {
    const costumeList = [
      'Regal 16th century ruler-scholar Turban (white and ivory handwoven cotton iket with subtle gold hem)',
      'Majestic deep green or ivory Jubah outer robe over Javanese woven inner shirt',
      'Long white selendang shawl draped over shoulders',
      'Fine Jarik Batik Parang or Kawung sarong skirt, woven golden stagen waist belt with antique keris',
      'Aged teak wood staff and dark wooden tasbih prayer beads'
    ];
    return {
      costumeList,
      wardrobeText: costumeList.join(', '),
      appearanceBonus: 'Stately noble scholar-king facial features, dignified dark trim beard, commanding charismatic gaze, regal posture of spiritual sovereignty'
    };
  }

  // 5. Default Wali / Kyai / Ulama / Waliyullah / Habib / Syekh / Sunan
  const costumeList = [
    'Historically accurate 16th century Javanese Islamic scholar religious clothing',
    'Traditional white Javanese turban (iket/turban style) made from handwoven cotton cloth with visible fabric folds and natural creases',
    'Long traditional white shawl (selendang) draped over both shoulders and chest',
    'Loose long traditional robe (jubah) in light ivory and pale gray tones with wide flowing sleeves (Javanese-Islamic coastal fusion)',
    'Dark traditional Javanese long inner shirt and ancient Jarik Batik cloth wrapped around waist with dark earthy coastal batik motifs',
    'Simple leather belt & sash holding an antique Javanese keris in wooden warangka sheath',
    'Aged teak wood walking staff held in right hand, dark wooden tasbih prayer beads in left hand',
    'Simple silver ring, small cloth pouch at waist, traditional woven natural fiber sandals'
  ];

  return {
    costumeList,
    wardrobeText: costumeList.join(', '),
    appearanceBonus: 'Dignified Javanese spiritual leader, calm and wise expression, deep thoughtful eyes, gentle face with subtle wrinkles showing age and wisdom, natural Southeast Asian facial features, realistic skin pores, neatly maintained short beard and mustache, peaceful humble posture'
  };
}

export function generateHolyFigureMasterPortraitPrompt(name: string, age?: string, customCostume?: string): { prompt: string; negative_prompt: string } {
  const ageStr = age || 'around 50-60';
  const nameClean = name || 'Sunan Gunung Jati';
  
  const prompt = `AI Control Prompt:
MASTERPIECE, SOLO CHARACTER, SINGLE SUBJECT, ONE HISTORICAL PERSON ONLY, CHARACTER FOCUS, FULL BODY HISTORICAL PORTRAIT

Ultra realistic historical portrait of a single Javanese Islamic scholar and Wali figure from the early 16th century, inspired by ${nameClean} during the Cirebon/Demak Sultanate era. One person only, the main character standing alone, no other humans.

The figure is an elderly yet dignified Javanese spiritual leader ${ageStr} years old, with a calm and wise expression, deep thoughtful eyes, gentle face, subtle wrinkles showing age and wisdom, natural Southeast Asian facial features, realistic skin pores, authentic human anatomy. He has a neatly maintained short beard and mustache, natural black hair partially covered by traditional headwear.

He wears historically accurate early Islamic Javanese royal religious clothing from the 1500s Cirebon Sultanate period.

His head is wrapped with a traditional white Javanese turban (iket/turban style), made from handwoven cotton cloth, carefully layered with visible fabric folds, natural creases, slightly uneven handmade texture. The turban looks aged naturally, not modern, with soft cotton fibers visible.

Around his shoulders is a long traditional white shawl (selendang) made from fine handwoven Javanese cotton, draped naturally over both shoulders and chest. The fabric has realistic weight, wrinkles, folds, and subtle shadows.

Underneath he wears a loose long traditional robe (jubah) in light ivory and pale gray tones, inspired by early Islamic scholars in Java. The robe has wide flowing sleeves, handmade stitching, rough woven texture, natural fabric imperfections, and historical simplicity. It is not Middle Eastern desert clothing but a fusion of Javanese and Islamic culture from coastal Java.

His inner clothing consists of a dark traditional Javanese long shirt with subtle woven patterns. Around his waist is a traditional ancient Javanese jarik cloth with authentic 16th century coastal batik motifs, dark earthy colors, handmade wax-resist patterns, wrapped naturally around the body.

At his waist he wears a simple traditional leather belt combined with a small cloth sash. A historically accurate Javanese keris is tucked into his waist, featuring an old wooden warangka sheath, aged carved wood texture, traditional Cirebon craftsmanship, and a simple antique appearance suitable for a spiritual leader, not a warrior.

In his right hand he holds an old wooden walking staff made from aged teak wood, with visible natural wood grain, scratches, and handmade craftsmanship. In his other hand he holds a string of traditional wooden tasbih prayer beads made from dark natural seeds or wood, each bead individually crafted.

Additional accessories:
- simple silver ring with traditional Javanese craftsmanship
- small cloth pouch attached to waist for personal items
- traditional woven sandals made from natural fibers
- no luxury jewelry, showing humility and spirituality

The character stands with a peaceful humble posture, representing a respected Islamic teacher, scholar, and spiritual leader of 16th century Java.

Environment:
An authentic 16th century Cirebon coastal Java setting, historically accurate to the era of Sunan Gunung Jati. Background shows an old wooden Javanese pendopo pavilion made from teak wood, traditional carved wooden pillars, ancient stone floor, tropical coastal vegetation, palm trees, old village atmosphere, soft morning mist, warm natural sunlight.

The architecture must resemble early Demak-Cirebon Sultanate period Java:
traditional wooden structures, carved teak details, clay roof tiles, natural earth textures, no modern buildings.

Lighting:
cinematic natural sunlight, soft golden hour lighting, realistic shadows, atmospheric depth, documentary historical photography style.

Camera:
full body portrait, 85mm DSLR lens, shallow depth of field, realistic perspective, ultra detailed skin texture, realistic fabric simulation, National Geographic historical documentary photography style.

8K resolution, photorealistic, hyper realistic, physically accurate materials, realistic human proportions.

historical reconstruction photography, authentic 1500s Java, Cirebon Sultanate era, museum quality realism`;

  const negative_prompt = `multiple people, crowd, group of people, other characters, background people, assistants, soldiers, followers, children, animals near character, duplicate character, two faces, extra body parts, extra hands,

modern clothing, modern turban, modern mosque, modern city, skyscraper, cars, electricity poles, modern houses, modern furniture, contemporary architecture, modern objects,

fantasy costume, Arabian desert clothing, Ottoman clothing, Middle Eastern warrior outfit, medieval European clothing, armor, fantasy robe,

incorrect historical period, futuristic elements, sci-fi, magical effects, glowing aura, fantasy atmosphere,

plastic skin, CGI, 3D render, cartoon, anime, illustration, painting style, artificial face, unrealistic beauty, fake beard,

incorrect accessories, modern jewelry, luxury gold accessories, modern weapons,

bright studio background, white photography studio, artificial background,

busy background, crowded scene, multiple subjects, portrait with other people,

modern Indonesia, modern village, modern mosque, urban environment,

wrong era, 21st century objects, technology, camera visible, microphone, vehicles,

low detail, blurry face, distorted anatomy, bad hands, unrealistic fabric, fake texture`;

  return { prompt, negative_prompt };
}

export function containsCasualOrGenericAttire(attireStr: string): boolean {
  const lower = attireStr.toLowerCase();
  return (
    lower.includes('t-shirt') ||
    lower.includes('kaos') ||
    lower.includes('casual') ||
    lower.includes('pakaian sederhana') ||
    lower.includes('pakaian biasa') ||
    lower.includes('villager') ||
    lower.includes('peasant') ||
    (lower.includes('shirt') && !lower.includes('surjan') && !lower.includes('bisht')) ||
    lower.includes('limp') ||
    attireStr.trim().length < 15
  );
}

export interface ProjectContext {
  projectId: string;
  title: string;
  premise: string;
  historicalEra: string;
  geographicContext: string;
  culturalContext: string;
  globalVisualRules: string[];
}

export interface EraBible {
  period: string;
  approximateYears?: string;
  technologyLevel: string;
  architecture: string;
  clothing: string;
  transportation: string;
  weapons: string;
  materials: string;
  lighting: string;
  forbiddenModernElements: string[];
}

export interface CharacterBibleResolved {
  id: string;
  name: string;
  aliases: string[];
  age: string;
  gender: string;
  ethnicityOrCulturalAppearance: string;
  faceDescription: string;
  hair: string;
  body: string;
  wardrobe: string;
  costume: string[];
  accessories: string[];
  signatureProps: string[];
  continuityRules: string[];
  faceLocked: boolean;
  prophetRestrictions: boolean;
}

export interface LocationBibleResolved {
  id: string;
  name: string;
  aliases: string[];
  period: string;
  architecture: string;
  materials: string;
  environment: string;
  vegetation: string;
  terrain: string;
  lighting: string;
  forbiddenElements: string[];
  props: string[];
}

export interface SceneContextResolved {
  sceneId: string;
  sceneNumber: number;
  title: string;
  narrativePurpose: string;
  emotionalObjective: string;
  characters: CharacterBibleResolved[];
  location: LocationBibleResolved;
  timeOfDay: string;
  atmosphere: string;
  event: string;
  visualDirection: string;
  continuityRules: string[];
  eraLock: EraBible;
  wardrobeLocks: string[];
  locationLock: LocationBibleResolved;
  modernAnachronismGuard: string[];
}

export interface ShotContextResolved {
  shotId: string;
  shotNumber: number;
  parentSceneId: string;
  parentSceneNumber: number;
  narrativePurpose: string;
  characters: CharacterBibleResolved[];
  location: LocationBibleResolved;
  action: string;
  camera: {
    shotType: string;
    angle: string;
    movement: string;
    lens: string;
    focus: string;
    framing: string;
  };
  composition: string;
  lighting: string;
  atmosphere: string;
  durationSec: number;
  continuity: string[];
  eraLock: EraBible;
  characterLocks: CharacterBibleResolved[];
  wardrobeLocks: string[];
  locationLock: LocationBibleResolved;
  propLocks: string[];
  exclusions: string[];
  dialogue?: { speaker: string; line: string }[];
  audioNote?: string;
  masterFrameRef?: string;
}

export interface CanonicalProductionContext {
  contextVersion: string;
  project: ProjectContext;
  era: EraBible;
  characters: CharacterBibleResolved[];
  locations: LocationBibleResolved[];
  objects: ObjectBible[];
  globalExclusions: string[];
  createdAt: string;
}

export interface PromptProvenanceMetadata {
  projectId: string;
  sceneId: string;
  shotId?: string;
  characterIds: string[];
  locationId?: string;
  contextVersion: string;
  promptVersion: string;
  generatedAt: string;
  provider: string;
  model: string;
}

export interface PromptValidationResult {
  valid: boolean;
  score: number; // 0 - 100
  missingHardConstraints: string[];
  detectedViolations: string[];
  restoredPrompt?: string;
}

/**
 * Modern Anachronism Guard Generator
 * Generates era-specific and culture-specific negative prompts to prevent temporal contamination.
 */
export function deriveModernAnachronismExclusions(
  eraText: string,
  cultureText: string = '',
  locationText: string = ''
): string[] {
  const combinedText = `${eraText} ${cultureText} ${locationText}`.toLowerCase();
  const exclusions: string[] = [];

  const isHistorical =
    combinedText.includes('century') ||
    combinedText.includes('1470') ||
    combinedText.includes('1480') ||
    combinedText.includes('15th') ||
    combinedText.includes('ancient') ||
    combinedText.includes('makkah') ||
    combinedText.includes('historical') ||
    combinedText.includes('pre-industrial') ||
    combinedText.includes('java') ||
    combinedText.includes('mataram') ||
    combinedText.includes('majapahit') ||
    combinedText.includes('demak') ||
    combinedText.includes('medieval') ||
    combinedText.includes('biblical') ||
    combinedText.includes('prophetic');

  if (isHistorical) {
    // Modern Architecture
    exclusions.push(
      'modern architecture',
      'concrete walls',
      'glass facade',
      'paved asphalt road',
      'electric streetlights',
      'power lines',
      'utility poles'
    );

    // Modern Clothing & Fashion
    exclusions.push(
      'modern clothing',
      'modern Indonesian young man outfit',
      'modern Javanese wedding attire',
      'synthetic polyester fabric',
      't-shirt',
      'jeans',
      'modern jacket',
      'zippers',
      'plastic buttons'
    );

    // Modern Tech & Transportation
    exclusions.push(
      'motor vehicles',
      'cars',
      'motorcycles',
      'wristwatches',
      'digital screens',
      'plastic containers',
      'synthetic accessories',
      'modern signage',
      'printed posters'
    );

    // Modern Javanese / Cultural Specifics
    if (combinedText.includes('java') || combinedText.includes('javanese') || combinedText.includes('indonesia')) {
      exclusions.push(
        'modern Javanese wedding costume',
        'modern bridal kebaya',
        'modern printed batik shirt',
        'modern city environment',
        'modern Indonesian streetwear'
      );
    }
  }

  return Array.from(new Set(exclusions));
}

/**
 * Builds the authoritative Canonical Production Context from storyboard sources.
 */
export function buildCanonicalProductionContext(params: {
  project?: Project | null;
  foundation?: ProjectFoundation | null;
  characters?: CharacterBible[];
  locations?: LocationBible[];
  objects?: ObjectBible[];
  contextPackage?: ContextPackage | null;
  continuityState?: ContinuityState | null;
}): CanonicalProductionContext {
  const { project, foundation, characters = [], locations = [], objects = [], contextPackage } = params;

  const projectId = project?.id || foundation?.project_id || 'default_project';
  const title = project?.title || 'Cinematic Production';
  const rawScript = project?.raw_script || '';

  // 1. Resolve Era
  const eraText =
    foundation?.era ||
    contextPackage?.facts?.find((f) => f.description?.toLowerCase().includes('era'))?.description ||
    'Historical Ancient Era';

  const eraExclusions = deriveModernAnachronismExclusions(
    eraText,
    foundation?.genre || '',
    locations.map((l) => l.culture || l.name).join(' ')
  );

  const eraBible: EraBible = {
    period: eraText,
    approximateYears: eraText.match(/(\d{3,4}–\d{3,4}|\d{3,4}\s*-\s*\d{3,4}|\d+th-century)/i)?.[0] || 'Period Appropriate',
    technologyLevel: 'Pre-industrial traditional craftsmanship',
    architecture: locations[0]?.architecture || 'Period-appropriate historical architecture',
    clothing: characters[0]?.clothing?.[0] || 'Period-appropriate traditional clothing',
    transportation: 'Period-appropriate animals and traditional wooden conveyances',
    weapons: 'Period-appropriate traditional weaponry (e.g. keris, bow, spear)',
    materials: 'Natural timber, packed earth, organic hand-woven textiles, clay, stone',
    lighting: 'Natural sunlight, moonlight, oil lamps, fire torches',
    forbiddenModernElements: eraExclusions,
  };

  // 2. Resolve Character Bibles
  const resolvedCharacters: CharacterBibleResolved[] = characters.map((c) => {
    const isProphet =
      c.name.toLowerCase().includes('rasulullah') ||
      c.name.toLowerCase().includes('muhammad');

    const isHolyFigure = isReveredHolyFigure(c.name);

    let costumeList = Array.isArray(c.clothing) && c.clothing.length > 0
      ? c.clothing
      : Array.isArray(c.costume) && c.costume.length > 0
        ? c.costume
        : [c.costume || c.wardrobe || 'Authentic period clothing'];

    let wardrobeText = costumeList.join(', ');
    let appearance = c.physical_appearance || c.physical_description || 'Authentic regional features';

    if (isHolyFigure) {
      const holyDefaults = getReveredHolyFigureDefaultAttire(c.name);
      if (containsCasualOrGenericAttire(wardrobeText)) {
        costumeList = holyDefaults.costumeList;
        wardrobeText = holyDefaults.wardrobeText;
      } else if (!costumeList.some((item) => item.toLowerCase().includes('sorban') || item.toLowerCase().includes('imamah') || item.toLowerCase().includes('blangkon') || item.toLowerCase().includes('jubah') || item.toLowerCase().includes('surjan'))) {
        costumeList = [...costumeList, ...holyDefaults.costumeList];
        wardrobeText = costumeList.join(', ');
      }

      if (!appearance.toLowerCase().includes('wibawa') && !appearance.toLowerCase().includes('charismatic') && !appearance.toLowerCase().includes('dignified')) {
        appearance = `${appearance}; ${holyDefaults.appearanceBonus}`;
      }
    }

    const continuityRules = [
      `Strict character identity lock for ${c.name}`,
      `Preserve exact costume weave: ${wardrobeText}`,
    ];

    if (isHolyFigure) {
      continuityRules.push(
        `REVERED HOLY FIGURE DOCTRINE: MUST preserve majestic revered holy figure attire (Sorban/Imamah, Jubah, or Surjan Lurik & Blangkon). STRICTLY FORBIDDEN to depict in modern casual t-shirts, limp undershirts, or low-status villager clothes.`
      );
    }

    return {
      id: c.id || `char_${c.name.toLowerCase().replace(/\s+/g, '_')}`,
      name: c.name,
      aliases: [c.name, c.name.split(' ')[0]],
      age: c.age || 'Adult',
      gender: c.gender || 'Unknown',
      ethnicityOrCulturalAppearance: appearance,
      faceDescription: appearance,
      hair: c.hair || (isHolyFigure ? 'Draped under majestic turban/blangkon' : 'Period hair style'),
      body: c.movement_style || (isHolyFigure ? 'Stately, dignified posture of spiritual grace' : 'Proportional build'),
      wardrobe: wardrobeText,
      costume: costumeList,
      accessories: Array.isArray(c.accessories)
        ? c.accessories
        : (typeof c.accessories === 'string' && c.accessories.trim() ? [c.accessories.trim()] : []),
      signatureProps: Array.isArray(c.accessories)
        ? c.accessories
        : (typeof c.accessories === 'string' && c.accessories.trim() ? [c.accessories.trim()] : []),
      continuityRules,
      faceLocked: isProphet ? false : (c.face_identity_locked ?? true),
      prophetRestrictions: isProphet,
    };
  });

  // 3. Resolve Location Bibles
  const resolvedLocations: LocationBibleResolved[] = locations.map((l) => ({
    id: l.id || `loc_${l.name.toLowerCase().replace(/\s+/g, '_')}`,
    name: l.name,
    aliases: [l.name],
    period: l.era || eraText,
    architecture: l.architecture || l.architectural_style || 'Traditional period architecture',
    materials: l.material || 'Natural wood, stone, earth',
    environment: l.environment || 'Authentic historical setting',
    vegetation: l.landscape || 'Period-appropriate vegetation',
    terrain: l.landscape || 'Ground terrain',
    lighting: l.lighting_style || 'Natural period lighting',
    forbiddenElements: eraExclusions,
    props: l.color_palette || [],
  }));

  // Version hash computed deterministically
  const contextVersion = [
    projectId,
    eraText,
    resolvedCharacters.map((c) => `${c.name}:${c.wardrobe}`).join('|'),
    resolvedLocations.map((l) => `${l.name}:${l.architecture}`).join('|'),
  ].join('::');

  return {
    contextVersion,
    project: {
      projectId,
      title,
      premise: rawScript.slice(0, 200),
      historicalEra: eraText,
      geographicContext: locations[0]?.name || 'Historical Realm',
      culturalContext: locations[0]?.culture || 'Traditional Culture',
      globalVisualRules: [
        `Era Lock: ${eraText}`,
        'Strict historical costume, prop, and architectural consistency',
      ],
    },
    era: eraBible,
    characters: resolvedCharacters,
    locations: resolvedLocations,
    objects,
    globalExclusions: eraExclusions,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Resolves Scene Context from Canonical Production Context.
 */
export function resolveSceneContext(
  prodContext: CanonicalProductionContext,
  scene: Scene,
  shots: Shot[] = []
): SceneContextResolved {
  const sceneChars = prodContext.characters.filter((c) =>
    scene.character_names?.some(
      (name) =>
        c.name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(c.name.toLowerCase())
    ) ||
    scene.characters_present?.some(
      (name) =>
        c.name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(c.name.toLowerCase())
    ) ||
    (scene.event || '').toLowerCase().includes(c.name.toLowerCase())
  );

  // Fallback: if scene names exist but no exact match, use scene characters or main characters
  const activeCharacters = sceneChars.length > 0 ? sceneChars : prodContext.characters;

  const activeLoc =
    prodContext.locations.find(
      (l) =>
        l.name.toLowerCase().includes((scene.location_name || '').toLowerCase()) ||
        (scene.location_name || '').toLowerCase().includes(l.name.toLowerCase())
    ) ||
    prodContext.locations[0] || {
      id: 'loc_default',
      name: scene.location_name || 'Historical Setting',
      aliases: [scene.location_name || 'Setting'],
      period: prodContext.era.period,
      architecture: 'Traditional period architecture',
      materials: 'Natural wood, timber, packed earth',
      environment: 'Authentic historical environment',
      vegetation: 'Period vegetation',
      terrain: 'Ground',
      lighting: scene.lighting || 'Natural light',
      forbiddenElements: prodContext.era.forbiddenModernElements,
      props: [],
    };

  const wardrobeLocks = activeCharacters.map((c) => `${c.name}: ${c.wardrobe}`);
  const locationLockDesc = `${activeLoc.name} (${activeLoc.architecture}, ${activeLoc.materials})`;

  return {
    sceneId: scene.id || `scene_${scene.scene_number}`,
    sceneNumber: scene.scene_number,
    title: scene.title,
    narrativePurpose: scene.story_purpose || scene.dramatic_purpose || 'Advance narrative plot',
    emotionalObjective: scene.emotional_objective || 'Dignified cinematic tone',
    characters: activeCharacters,
    location: activeLoc,
    timeOfDay: scene.time_of_day || 'Day',
    atmosphere: scene.scene_tone?.atmosphere || 'Cinematic atmospheric tension',
    event: scene.event || scene.title,
    visualDirection: scene.action_summary || scene.event,
    continuityRules: [
      `Era Lock: ${prodContext.era.period}`,
      `Location Lock: ${locationLockDesc}`,
      ...wardrobeLocks,
    ],
    eraLock: prodContext.era,
    wardrobeLocks,
    locationLock: activeLoc,
    modernAnachronismGuard: prodContext.globalExclusions,
  };
}

/**
 * Resolves Shot Context from Scene Context and Canonical Production Context.
 */
export function resolveShotContext(
  prodContext: CanonicalProductionContext,
  sceneContext: SceneContextResolved,
  shot: Shot
): ShotContextResolved {
  const shotChars = sceneContext.characters.filter((c) =>
    (shot.event_detail || '').toLowerCase().includes(c.name.toLowerCase()) ||
    (shot.character_action || '').toLowerCase().includes(c.name.toLowerCase()) ||
    shot.character_refs?.includes(c.id) ||
    shot.dialogue?.some((d) => d.character_name.toLowerCase().includes(c.name.toLowerCase()))
  );

  const activeChars = shotChars.length > 0 ? shotChars : sceneContext.characters;

  const props = Array.from(
    new Set([
      ...activeChars.flatMap((c) => c.signatureProps),
      ...sceneContext.location.props,
    ])
  );

  return {
    shotId: shot.id || `shot_${shot.shot_number}`,
    shotNumber: shot.shot_number,
    parentSceneId: sceneContext.sceneId,
    parentSceneNumber: sceneContext.sceneNumber,
    narrativePurpose: sceneContext.narrativePurpose,
    characters: activeChars,
    location: sceneContext.location,
    action: shot.event_detail || shot.character_action || sceneContext.event,
    camera: {
      shotType: shot.shot_type || 'Medium Shot',
      angle: 'Eye level',
      movement: shot.camera_movement || shot.camera_note || 'Static camera',
      lens: '35mm prime lens',
      focus: 'Shallow depth of field',
      framing: 'Cinematic framing',
    },
    composition: 'Balanced 16:9 cinematic framing',
    lighting: sceneContext.location.lighting || 'Natural period lighting',
    atmosphere: sceneContext.atmosphere,
    durationSec: shot.duration_sec || 10,
    continuity: [
      `Era Lock: ${sceneContext.eraLock.period}`,
      ...sceneContext.wardrobeLocks,
      `Location: ${sceneContext.location.name}`,
    ],
    eraLock: sceneContext.eraLock,
    characterLocks: activeChars,
    wardrobeLocks: activeChars.map((c) => `${c.name}: ${c.wardrobe}`),
    locationLock: sceneContext.location,
    propLocks: props,
    exclusions: sceneContext.modernAnachronismGuard,
    dialogue: Array.isArray(shot.dialogue)
      ? shot.dialogue.map((d) => ({ speaker: (d as any).character_name || (d as any).speaker || 'Unknown', line: d.line || '' }))
      : [],
    audioNote: shot.audio_note || shot.audio_narration,
  };
}

/**
 * Validates whether a compiled prompt preserves all authoritative hard constraints from storyboard context.
 * Acts as the Continuity Validation Agent.
 */
export function validatePromptAgainstContext(
  promptText: string,
  context: SceneContextResolved | ShotContextResolved
): PromptValidationResult {
  const missingHardConstraints: string[] = [];
  const detectedViolations: string[] = [];
  const pLower = promptText.toLowerCase();

  // 1. ERA CHECK
  const eraText = context.eraLock.period.toLowerCase();
  const eraKeywords = eraText.split(/[\s,–-]+/).filter((w) => w.length > 3);
  const eraMatched = eraKeywords.some((kw) => pLower.includes(kw)) || pLower.includes('era') || pLower.includes('historical');

  if (!eraMatched) {
    missingHardConstraints.push(`ERA LOCK: ${context.eraLock.period}`);
  }

  // 2. CHARACTER & WARDROBE LOCK CHECK
  for (const char of context.characters) {
    const cNameLower = char.name.toLowerCase();
    if (!pLower.includes(cNameLower) && !char.prophetRestrictions) {
      missingHardConstraints.push(`CHARACTER IDENT: ${char.name}`);
    }

    // Check Wardrobe
    if (char.costume && char.costume.length > 0) {
      const wardrobeKeywords = char.costume.flatMap((item) =>
        item.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 3)
      );
      const wardrobeMatched = wardrobeKeywords.some((kw) => pLower.includes(kw));
      if (!wardrobeMatched) {
        missingHardConstraints.push(`WARDROBE LOCK for ${char.name}: ${char.wardrobe}`);
      }
    }
  }

  // 3. LOCATION CHECK
  const locNameLower = context.location.name.toLowerCase();
  const locKeywords = locNameLower.split(/[\s,]+/).filter((w) => w.length > 3);
  const locMatched = locKeywords.some((kw) => pLower.includes(kw)) || pLower.includes(context.location.architecture.toLowerCase());

  if (!locMatched) {
    missingHardConstraints.push(`LOCATION LOCK: ${context.location.name} (${context.location.architecture})`);
  }

  // 4. ANACHRONISM VIOLATION CHECK
  for (const forbidden of context.eraLock.forbiddenModernElements) {
    // Check if forbidden term appears in POSITIVE section of prompt (before NEGATIVE PROMPT)
    const positivePrompt = promptText.split(/NEGATIVE PROMPT:/i)[0] || promptText;
    if (positivePrompt.toLowerCase().includes(forbidden.toLowerCase())) {
      detectedViolations.push(`Anachronism in positive prompt: "${forbidden}"`);
    }
  }

  const valid = missingHardConstraints.length === 0 && detectedViolations.length === 0;
  const score = Math.max(0, 100 - (missingHardConstraints.length * 20 + detectedViolations.length * 25));

  let restoredPrompt = promptText;
  if (!valid) {
    // Restore missing hard constraints cleanly into the prompt
    const restorationBlock = `\n[CANONICAL CONTINUITY LOCK]\n` +
      `ERA: ${context.eraLock.period}\n` +
      `CHARACTERS: ${context.characters.map((c) => `${c.name} (${c.age}) wearing ${c.wardrobe}`).join('; ')}\n` +
      `LOCATION: ${context.location.name} — Architecture: ${context.location.architecture}\n`;

    restoredPrompt = promptText + restorationBlock;
  }

  return {
    valid,
    score,
    missingHardConstraints,
    detectedViolations,
    restoredPrompt,
  };
}

/**
 * Creates prompt provenance metadata.
 */
export function createPromptProvenance(
  context: CanonicalProductionContext,
  sceneId: string,
  shotId?: string,
  provider: string = 'google',
  model: string = 'banana_master_frame'
): PromptProvenanceMetadata {
  return {
    projectId: context.project.projectId,
    sceneId,
    shotId,
    characterIds: context.characters.map((c) => c.id),
    locationId: context.locations[0]?.id,
    contextVersion: context.contextVersion,
    promptVersion: '7D.1.0',
    generatedAt: new Date().toISOString(),
    provider,
    model,
  };
}

/**
 * Checks if a stored prompt's context version matches the current canonical context version.
 */
export function isPromptStale(
  storedProvenance: PromptProvenanceMetadata | null | undefined,
  currentContext: CanonicalProductionContext
): boolean {
  if (!storedProvenance) return true;
  return storedProvenance.contextVersion !== currentContext.contextVersion;
}
