import {
  DramaticArcType,
  EndingStrategyType,
  NarrativeDeliveryIntent,
  NarrativeStrategy,
  ProjectFoundation,
} from '../src/types';

export interface StoryAnalysisInput {
  rawScript: string;
  foundation?: Partial<ProjectFoundation> | null;
  targetDurationSec?: number;
  deliveryIntent?: Partial<NarrativeDeliveryIntent> | null;
  isSerial?: boolean;
}

/**
 * Genre-Aware Narrative Strategy Engine
 * 
 * Determines dramaturgical staging, dramatic arc type, pacing, scene count,
 * communication channels, dialogue intelligence, and ending strategy based on
 * the actual story rather than hardcoding a single fixed template.
 */
export function determineNarrativeStrategy(input: StoryAnalysisInput): NarrativeStrategy {
  const script = input.rawScript || '';
  const foundation = input.foundation || {};
  const genreStr = (foundation.genre || '').toLowerCase();
  const themeStr = (foundation.theme || '').toLowerCase();
  const conflictStr = (foundation.main_conflict || '').toLowerCase();
  const scriptLower = script.toLowerCase();

  // 1. Detect Sacred / Historical Grounding
  const isIslamicSacred =
    /muhammad|rasulullah|abdul muttalib|aminah|ka'bah|makkah|quraisy|sirah|hadith|prophet|nabi/i.test(script) ||
    /muhammad|rasulullah|abdul muttalib|sirah|islam/i.test(genreStr) ||
    Boolean(foundation.is_historical_religious_biography);

  const isHistorical =
    isIslamicSacred ||
    /historical|sejarah|biografi|biography|period|kerajaan|perang dunia|revolution/i.test(genreStr) ||
    /historical|abad ke-|dynasty/i.test(foundation.era || '');

  // 2. Detect Genre & Dramatic Arc Archetype
  let dramaticArcType: DramaticArcType = 'CLASSIC_ARC';
  let primaryGenre = foundation.genre || 'Cinematic Drama';
  let subgenre = '';
  let storyType = 'Character-Driven Drama';
  let stakes: 'PERSONAL' | 'SURVIVAL' | 'MORAL' | 'SOCIETAL' | 'COSMIC' = 'PERSONAL';
  let pacingCurve: 'RAPID_ESCALATING' | 'SLOW_BURN_REVELATION' | 'MEASURED_DRAMATIC' | 'DESCENDING_SPIRAL' | 'DYNAMIC' = 'MEASURED_DRAMATIC';
  let dialogueDensity: 'HIGH' | 'BALANCED' | 'MINIMAL' | 'ACTION_DOMINANT' = 'BALANCED';
  let narrationStrategy: 'NONE' | 'MINIMAL_POETIC' | 'CHRONICLER_WITNESS' | 'INTERNAL_MONOLOGUE' = 'MINIMAL_POETIC';

  if (isIslamicSacred || (/sejarah|historical|sirah/i.test(genreStr) && /event|peristiwa/i.test(conflictStr + genreStr))) {
    dramaticArcType = 'HISTORICAL_EVENT';
    primaryGenre = isIslamicSacred ? 'Historical Religious Epic' : 'Historical Drama';
    subgenre = 'Sacred Sirah / Pivotal Chronicle';
    storyType = 'Historic Milestone & Communal Stakes';
    stakes = 'SOCIETAL';
    pacingCurve = 'MEASURED_DRAMATIC';
    dialogueDensity = 'BALANCED';
    narrationStrategy = 'CHRONICLER_WITNESS';
  } else if (/misteri|mystery|detective|investigation|whodunit|noir|crime/i.test(genreStr) || /misteri|pembunuhan|jejak|rahasia|konspirasi/i.test(scriptLower)) {
    dramaticArcType = 'MYSTERY';
    primaryGenre = 'Mystery / Thriller';
    subgenre = /noir/i.test(genreStr) ? 'Neo-Noir' : 'Investigative Enigma';
    storyType = 'Hidden Truth Unraveling';
    stakes = /nyawa|membunuh|selamat/i.test(conflictStr + scriptLower) ? 'SURVIVAL' : 'PERSONAL';
    pacingCurve = 'SLOW_BURN_REVELATION';
    dialogueDensity = 'HIGH';
    narrationStrategy = 'NONE';
  } else if (/tragedi|tragedy|tragic|tragis|kehilangan|downfall|kehancuran/i.test(genreStr) || /tragedi|tragedy|tragic|kematian|kehancuran|penyesalan|kehilangan|collapse|ruin/i.test(conflictStr + themeStr)) {
    dramaticArcType = 'TRAGEDY';
    primaryGenre = 'Tragic Drama';
    subgenre = 'Psychological Tragedy of Irreversible Loss';
    storyType = 'Fatal Flaw & Unavoidable Catastrophe';
    stakes = 'PERSONAL';
    pacingCurve = 'DESCENDING_SPIRAL';
    dialogueDensity = 'BALANCED';
    narrationStrategy = 'MINIMAL_POETIC';
  } else if (/petualangan|adventure|quest|ekspedisi|survival|action|penjelajahan/i.test(genreStr) || /monster|hutan terlarang|puncak|reruntuhan|pelarian/i.test(scriptLower)) {
    dramaticArcType = 'ADVENTURE';
    primaryGenre = 'High-Stakes Adventure';
    subgenre = 'Perilous Quest / Survival';
    storyType = 'Heroic Pursuit of Dangerous Objective';
    stakes = 'SURVIVAL';
    pacingCurve = 'RAPID_ESCALATING';
    dialogueDensity = 'ACTION_DOMINANT';
    narrationStrategy = 'NONE';
  } else if (/biografi|biographical|biopic|tokoh|transformasi hidup/i.test(genreStr) || /perjalanan hidup|titik balik hidup/i.test(themeStr)) {
    dramaticArcType = 'BIOGRAPHY';
    primaryGenre = 'Biographical Portrait';
    subgenre = 'Transformative Human Chronicle';
    storyType = 'Pivotal Life Crucible';
    stakes = 'MORAL';
    pacingCurve = 'MEASURED_DRAMATIC';
    dialogueDensity = 'BALANCED';
    narrationStrategy = 'CHRONICLER_WITNESS';
  } else if (/spiritual|iman|moral|nurani|taubat|batin|keimanan/i.test(genreStr) || /dilema moral|pergualatan batin|pengorbanan nurani/i.test(conflictStr + themeStr)) {
    dramaticArcType = 'SPIRITUAL_STRUGGLE';
    primaryGenre = 'Spiritual Drama';
    subgenre = 'Crucible of Conscience & Inner Faith';
    storyType = 'Inner Moral Struggle Against Temptation';
    stakes = 'MORAL';
    pacingCurve = 'MEASURED_DRAMATIC';
    dialogueDensity = 'BALANCED';
    narrationStrategy = 'INTERNAL_MONOLOGUE';
  }

  // 3. Format Mode & Ending Strategy Intelligence
  const isSerialized = Boolean(
    input.isSerial ||
    input.deliveryIntent?.continuationAllowed ||
    input.deliveryIntent?.format === 'SHORT_SERIAL' ||
    input.deliveryIntent?.narrativeMode === 'SERIALIZED' ||
    /episode\s*\d+|part\s*\d+|bersambung/i.test(script)
  );

  let endingStrategy: EndingStrategyType = 'RESOLUTION';
  if (isSerialized) {
    endingStrategy = 'CLIFFHANGER';
  } else {
    switch (dramaticArcType) {
      case 'TRAGEDY':
        endingStrategy = 'TRAGIC_AFTERMATH';
        break;
      case 'MYSTERY':
        endingStrategy = 'REVELATION';
        break;
      case 'ADVENTURE':
        endingStrategy = 'RESOLUTION';
        break;
      case 'BIOGRAPHY':
        endingStrategy = 'LEGACY';
        break;
      case 'SPIRITUAL_STRUGGLE':
        endingStrategy = 'SPIRITUAL_TRANSCENDENCE';
        break;
      case 'HISTORICAL_EVENT':
        endingStrategy = 'LEGACY';
        break;
      default:
        endingStrategy = 'RESOLUTION';
        break;
    }
  }

  // 4. Dynamic Pacing & Recommended Scene Count
  // Never locked to 8! Scaled dynamically to story duration and complexity.
  const targetDuration = input.targetDurationSec || 120;
  let recommendedSceneCount = 5;

  if (targetDuration <= 60) {
    recommendedSceneCount = 3;
  } else if (targetDuration <= 90) {
    recommendedSceneCount = 4;
  } else if (targetDuration <= 120) {
    recommendedSceneCount = 5;
  } else if (targetDuration <= 150) {
    recommendedSceneCount = dramaticArcType === 'ADVENTURE' ? 5 : 6;
  } else if (targetDuration <= 180) {
    recommendedSceneCount = dramaticArcType === 'HISTORICAL_EVENT' ? 8 : (dramaticArcType === 'MYSTERY' ? 6 : 7);
  } else if (targetDuration <= 240) {
    recommendedSceneCount = 8;
  } else {
    recommendedSceneCount = Math.min(12, Math.max(7, Math.round(targetDuration / 25)));
  }

  // 5. Arc-Specific Function Sequence
  const actFunctions = getActFunctionsForArc(dramaticArcType, endingStrategy);

  const protagonist = (foundation.main_characters && foundation.main_characters[0]) || 'Protagonist';
  const opposingForce = (foundation.main_characters && foundation.main_characters[1]) || 'Antagonist / Antagonistic Force';

  return {
    genre: primaryGenre,
    subgenre,
    story_type: storyType,
    narrative_goal: foundation.theme || `Resolve the ${dramaticArcType} dramatic arc`,
    protagonist,
    opposing_force: opposingForce,
    central_conflict: foundation.main_conflict || 'Dramatic confrontation and stakes',
    stakes,
    tone: foundation.visual_tone || 'Cinematic realism with high emotional contrast',
    dramatic_arc_type: dramaticArcType,
    source_type: isIslamicSacred ? 'HISTORICAL_RELIGIOUS' : (isHistorical ? 'HISTORICAL_RELIGIOUS' : 'FICTIONAL'),
    is_historical_or_sacred: isIslamicSacred,
    format_mode: isSerialized ? 'SERIALIZED' : 'STANDALONE',
    ending_strategy: endingStrategy,
    pacing: {
      recommended_scene_count: recommendedSceneCount,
      pacing_curve: pacingCurve,
      dialogue_density: dialogueDensity,
      narration_strategy: narrationStrategy,
    },
    act_functions: actFunctions,
    guidance_summary: `Arc: ${dramaticArcType} | Pacing: ${pacingCurve} (${recommendedSceneCount} scenes) | Ending: ${endingStrategy} | Audio Strategy: VO=${narrationStrategy}, Dialogue=${dialogueDensity}`,
  };
}

function getActFunctionsForArc(arc: DramaticArcType, ending: EndingStrategyType): string[] {
  switch (arc) {
    case 'MYSTERY':
      return [
        'HOOK / ENIGMATIC_INCIDENT',
        'INVESTIGATION / QUESTION',
        'EVIDENCE / CLUE_DISCOVERY',
        'COMPLICATION / FALSE_LEAD',
        'REVELATION / UNMASKING',
        ending === 'CLIFFHANGER' ? 'CLIFFHANGER / UNRESOLVED_THREAD' : 'CONSEQUENCE / TRUTH_ESTABLISHED',
      ];
    case 'TRAGEDY':
      return [
        'HOOK / FOREBODING',
        'NORMALITY / FATAL_CHOICE',
        'WARNING / DILEMMA',
        'ESCALATION / IRREVERSIBLE_MISTAKE',
        'POINT_OF_NO_RETURN / CATASTROPHE',
        ending === 'CLIFFHANGER' ? 'CLIFFHANGER / FALLOUT' : 'TRAGIC_AFTERMATH / MOURNING',
      ];
    case 'ADVENTURE':
      return [
        'INCITING_CALL / IMMEDIATE_PERIL',
        'CROSSING_THRESHOLD / EXPEDITION',
        'PHYSICAL_OBSTACLE / COMPLICATION',
        'CRITICAL_CRISIS / TEST_OF_SURVIVAL',
        'BREAKTHROUGH / TRIUMPH',
        ending === 'CLIFFHANGER' ? 'CLIFFHANGER / NEXT_PERIL' : 'RESOLUTION / NEW_HORIZON',
      ];
    case 'BIOGRAPHY':
      return [
        'DEFINING_MOMENT / HOOK',
        'FORMATIVE_CONTEXT / STRUGGLE',
        'CRUCIBLE / TRANSFORMATION',
        'DECISIVE_BREAKTHROUGH',
        'HISTORIC_ACHIEVEMENT',
        ending === 'CLIFFHANGER' ? 'CLIFFHANGER / LOOMING_ERA' : 'ENDURING_LEGACY / REFLECTION',
      ];
    case 'SPIRITUAL_STRUGGLE':
      return [
        'HOOK / MORAL_DISCONTENT',
        'TEMPTATION / INNER_CONFLICT',
        'CRUCIBLE_TEST / TRIAL_OF_CONSCIENCE',
        'TURNING_POINT / SACRIFICE',
        'SPIRITUAL_ILLUMINATION',
        ending === 'CLIFFHANGER' ? 'CLIFFHANGER / SPIRITUAL_TEST' : 'TRANSCENDENT_PEACE / MORAL_PAYOFF',
      ];
    case 'HISTORICAL_EVENT':
      return [
        'IMMEDIATE_INCITING_EVENT / HOOK',
        'COMMUNAL_CONTEXT / HUMAN_STAKES',
        'ESCALATION / CONFLICT_OF_WILLS',
        'TURNING_POINT / PUBLIC_PROCLAMATION',
        'CONSEQUENCE / IMMEDIATE_SHIFT',
        ending === 'CLIFFHANGER' ? 'CLIFFHANGER / NEW_DESTINY_APPROACHING' : 'HISTORICAL_RESONANCE / LEGACY',
      ];
    case 'CLASSIC_ARC':
    default:
      return [
        'HOOK',
        'SETUP & INCITING_INCIDENT',
        'CONFLICT & ESCALATION',
        'TURNING_POINT / CLIMAX',
        'PAYOFF',
        ending === 'CLIFFHANGER' ? 'CLIFFHANGER' : 'RESOLUTION',
      ];
  }
}
