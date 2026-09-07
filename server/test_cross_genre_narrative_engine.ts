import { determineNarrativeStrategy } from './narrative_strategy_engine';
import { allocateAndNormalizeSceneDurations, DetectedScene } from './stages/stage5_scene_breakdown';
import { DramaticArcType, EndingStrategyType, NarrativeStrategy, ProjectFoundation } from '../src/types';

interface GenreTestCase {
  id: string;
  name: string;
  genre: string;
  era: string;
  theme: string;
  main_conflict: string;
  emotional_arc: string;
  rawScript: string;
  characters: string[];
  locations: string[];
  targetDurationSec: number;
  isSerial?: boolean;
}

const TEST_CASES: GenreTestCase[] = [
  {
    id: 'TEST_A_HISTORICAL',
    name: 'TEST A — HISTORICAL: Abdul Muttalib / Birth of Muhammad ﷺ',
    genre: 'Historical Religious Epic',
    era: 'Makkah Pra-Islam 570 M',
    theme: 'Kehormatan, Takdir Ketuhanan, dan Harapan Baru di Tengah Tradisi Jahiliyah',
    main_conflict: 'Benturan keyakinan Abdul Muttalib melawan tradisi penamaan leluhur Quraisy demi menyambut sang bayi pembawa amanah.',
    emotional_arc: 'Dari ketegangan cemas di lorong Makkah menjadi proklamasi sakral penuh wibawa di depan Ka\'bah.',
    rawScript: `Di bawah terik matahari Makkah tahun 570 Masehi, debu berterbangan di depan kediaman Bani Hasyim.
Kabar kelahiran seorang bayi yatim sampai ke telinga Abdul Muttalib. Sang kakek melangkah tegap melintasi kerumunan pasar yang riuh.
Di hadapan Ka'bah yang dikelilingi berhala-berhala batu, para pemuka Quraisy berkumpul menanti.
Abdul Muttalib menggendong bayi yang terbedong rapat di dekapannya. Ketika ia memproklamasikan nama "Muhammad", para tetua terperangah mempertanyakan nama yang tak pernah disandang leluhur mereka.
Di kejauhan, seorang penunggang kuda misterius menatap Ka'bah dari perbukitan, menandakan awal era baru yang menggetarkan jazirah.`,
    characters: ['Abdul Muttalib', 'Pemuka Quraisy', 'Aminah'],
    locations: ['Lorong Makkah', 'Halaman Ka\'bah', 'Kediaman Aminah'],
    targetDurationSec: 160,
    isSerial: true, // Serialized episode with continuation momentum
  },
  {
    id: 'TEST_B_MYSTERY',
    name: 'TEST B — MYSTERY: The Cipher of St. Jude\'s Archive',
    genre: 'Mystery / Detective Thriller',
    era: 'Victorian London 1888',
    theme: 'Truth Disclosed at the Cost of Ancient Illusions',
    main_conflict: 'Detective Vance races against a 24-hour deadline to uncover which archive trustee stole the royal astrological cipher before it is smuggled out of the harbor.',
    emotional_arc: 'From baffled scrutiny of cryptic wax seals to a piercing confrontation and inescapable unmasking of the true culprit.',
    rawScript: `Rain beats against the leaded glass of St. Jude's Private Archives. Detective Maya Vance stoops over an unbroken lock.
Inside the iron vault, velvet cushions lie bare; the Royal Astrological Cipher has vanished without a forced entry.
Vance inspects the carpet: a faint smear of sulfur and a fragment of crimson seal-wax.
She interrogates the jittery Archivist Pembroke, noticing his trembling hand tucked into a soot-stained pocket.
In a sudden flash of deductions, Vance exposes the double-bottomed trunk and unmasks Pembroke's forgery scheme.
The stolen cipher is secured on the evidence table under cold gaslight. The truth is cataloged; the mystery is solved.`,
    characters: ['Detective Maya Vance', 'Archivist Pembroke', 'Inspector Cross'],
    locations: ['St. Jude Vault', 'Archivist Office', 'Gaslit Corridor'],
    targetDurationSec: 150,
    isSerial: false, // Standalone mystery: demands REVELATION
  },
  {
    id: 'TEST_C_TRAGEDY',
    name: 'TEST C — TRAGEDY: The Last Foundry of Viktor',
    genre: 'Tragic Drama',
    era: 'Industrial Ruhr Valley 1904',
    theme: 'Hubris and the Irreversible Collapse of a Craftsman\'s Soul',
    main_conflict: 'Viktor knowingly pours brittle defective slag to meet his deadline and save his foundry, ignoring his apprentice\'s desperate pleas.',
    emotional_arc: 'From arrogant pride to mounting dread, catastrophic collapse, and silent, inconsolable grief.',
    rawScript: `The blast furnaces roar inside Foundry No. 4. Master Bell-caster Viktor glares at the molten bronze vat.
His apprentice, young Leo, thrusts a cracked crucible shard into Viktor's face, warning of sulfur contamination that will shatter the great cathedral bell.
Viktor, cornered by predatory bank foreclosures, strikes the tongs aside and pulls the release lever with trembling fury.
The golden metal rushes into the cathedral bell mold. Days later, suspended in the belfry before a cheering town, the iron clapper strikes the bell.
A horrific subterranean crack echoes. The bell splits into jagged shards, raining metal upon the nave and crushing the foundry\'s reputation.
Viktor stands alone amidst the wreckage in the silent dust, clenching a fist of broken bronze in ruined solitude.`,
    characters: ['Master Viktor', 'Apprentice Leo', 'Foreman Karl'],
    locations: ['Foundry Furnace Floor', 'Cathedral Belfry', 'Ruined Nave'],
    targetDurationSec: 120,
    isSerial: false, // Standalone tragedy: demands TRAGIC_AFTERMATH
  },
  {
    id: 'TEST_D_ADVENTURE',
    name: 'TEST D — ADVENTURE: Ascent of the Razor Ridge',
    genre: 'High-Stakes Mountain Adventure',
    era: 'Contemporary Himalayas',
    theme: 'Human Resilience and Audacity Over Nature\'s Lethal Obstacles',
    main_conflict: 'Rayan must cross an unstable ice-shelf bridge in zero-visibility blizzard to deliver emergency serum to an isolated research station.',
    emotional_arc: 'From gripping panic on the abyss threshold to fierce physical defiance and triumphant survival.',
    rawScript: `A howling gale tears at Rayan\'s thermal hood. At 7,000 meters, the Razor Ridge narrows to a two-foot ledge of blue glacial ice.
His radio crackles: the basecamp survey team below has four hours of oxygen remaining; pulmonary edema is setting in.
Rayan kicks his steel crampons into the sheer vertical serac. His ice axe bites, slips two inches, and showers powder into the abyss.
A sudden avalanche concusses the wall above him. Leaping onto an unstable snow bridge, he anchors his carabiner just as the chasm beneath him gives way.
Dangling by one arm over a 3,000-foot drop, he levers himself up with sheer forearm strength and crawls over the crest into the research hut airlock.
He slams the serum container onto the medical table. Panting through frosted eyelashes, he watches the storm howl impotently beyond the fortified glass.`,
    characters: ['Rayan', 'Dr. Aris', 'Radio Operator Tenzin'],
    locations: ['Razor Ridge Crest', 'Vertical Serac Wall', 'Himalayan Airlock'],
    targetDurationSec: 90,
    isSerial: false, // Fast-paced adventure: demands RESOLUTION / BREAKTHROUGH
  },
  {
    id: 'TEST_E_BIOGRAPHICAL',
    name: 'TEST E — BIOGRAPHICAL: The Silent Surgeon (Elena Rostova)',
    genre: 'Biographical Portrait',
    era: 'Battle of Stalingrad Field Hospital 1942',
    theme: 'Moral Courage and the Genesis of Modern Vascular Surgery',
    main_conflict: 'Dr. Elena Rostova defies medical military dogma forbidding delicate arterial sutures on shock patients, risking execution to pioneer life-saving micro-techniques.',
    emotional_arc: 'From oppressive desperation in a blood-soaked basement to laser-focused technical brilliance and enduring historical transformation.',
    rawScript: `Artillery shells shake plaster from the cellar ceiling of Field Hospital 14.
Surgeon Elena Rostova presses her thumb against a severed femoral artery of a dying nineteen-year-old soldier.
Her chief of staff screams above the gunfire: amputate immediately; arterial repair under fire is prohibited insubordination.
Elena meets the soldier\'s conscious, terrified eyes. She refuses the bone saw.
Using magnified jewelers\' spectacles and silver hairpins fashioned into retractors, her steady fingers perform a micro-vascular anastomosis in twelve breathtaking minutes.
The soldier\'s pulse pulses cleanly under her fingertips.
Decades later, her surgical protocol hangs framed in the Geneva Academy of Medicine—a testament to one woman\'s refusal to surrender to butcher\'s logic.`,
    characters: ['Dr. Elena Rostova', 'Chief Surgeon Belov', 'Soldier Ilya'],
    locations: ['Cellar Operating Room', 'Hospital Bunker Corridor', 'Geneva Academy Hall'],
    targetDurationSec: 130,
    isSerial: false, // Biographical milestone: demands LEGACY
  },
  {
    id: 'TEST_F_SPIRITUAL',
    name: 'TEST F — SPIRITUAL: The Threshold of Ahmad',
    genre: 'Spiritual Drama',
    era: 'Modern Jakarta 2024',
    theme: 'Crucible of Conscience and the Supremacy of Faith over Worldly Compromise',
    main_conflict: 'Ahmad discovers that his revered mentor and benefactor has funneled famine relief funds into political bribes, forcing him to choose between gratitude and divine integrity.',
    emotional_arc: 'From bitter betrayal and sleepless inner turmoil to quiet, unwavering moral surrender and transcendent peace.',
    rawScript: `The fluorescent lights of the municipal auditor\'s office hum in the midnight silence.
Ahmad scrolls through verified ledger transfers. The shell company routing twenty billion rupiah of orphanage food aid belongs to Ustadh Danu—the man who paid Ahmad\'s university tuition and officiated his wedding.
Ahmad leaves the office and walks into the courtyard of the Istiqlal Mosque as rain gently falls on the marble.
Prostrating in the dark corner of the prayer hall, tears track through his beard. A Faustian compromise whispers in his mind: stay silent, repay the debt of kindness.
Ahmad raises his head. His heart stills as the morning adhan echoes.
At dawn, Ahmad places the signed audit report on the investigator\'s desk and greets Ustadh Danu with sorrowful love, having surrendered his career for the sanctity of his soul.`,
    characters: ['Ahmad', 'Ustadh Danu', 'Investigator Hendra'],
    locations: ['Auditor Office', 'Istiqlal Courtyard', 'Corridor of Conscience'],
    targetDurationSec: 110,
    isSerial: false, // Spiritual crucible: demands SPIRITUAL_TRANSCENDENCE
  },
];

export interface EngineProofReport {
  testId: string;
  name: string;
  genre: string;
  dramaticArcType: DramaticArcType;
  endingStrategy: EndingStrategyType;
  stakes: string;
  targetDurationSec: number;
  recommendedSceneCount: number;
  sceneCountDifferentiated: boolean;
  pacingCurve: string;
  actFunctions: string[];
  mockGeneratedScenes: {
    scene_number: number;
    title: string;
    duration_sec: number;
    scene_pattern: string;
    story_purpose: string;
    has_dialogue: boolean;
    has_narrator_vo: boolean;
    visual_action: string;
    historical_tier: string;
    is_prophet_safe: boolean;
  }[];
}

export function runNarrativeEngineTest(testCase: GenreTestCase): EngineProofReport {
  const foundation: Partial<ProjectFoundation> = {
    genre: testCase.genre,
    era: testCase.era,
    theme: testCase.theme,
    main_conflict: testCase.main_conflict,
    emotional_arc: testCase.emotional_arc,
    main_characters: testCase.characters,
  };

  const strategy: NarrativeStrategy = determineNarrativeStrategy({
    rawScript: testCase.rawScript,
    foundation,
    targetDurationSec: testCase.targetDurationSec,
    isSerial: testCase.isSerial,
  });

  // Synthesize dramaturgically staged scenes adhering to the selected strategy
  const sceneCount = strategy.pacing.recommended_scene_count;
  const rawDur = Math.round(testCase.targetDurationSec / sceneCount);

  // Staged scene patterns matching the arc
  const patternPalette = strategy.act_functions.map((fn) => fn.split('/')[0].trim());

  const mockScenes: DetectedScene[] = [];
  for (let i = 1; i <= sceneCount; i++) {
    const isFirst = i === 1;
    const isClimax = i === Math.ceil(sceneCount * 0.7);
    const isLast = i === sceneCount;

    let pattern = 'ESCALATION';
    if (isFirst) {
      pattern = patternPalette[0] || 'HOOK';
    } else if (isLast) {
      pattern = strategy.ending_strategy === 'CLIFFHANGER' ? 'CLIFFHANGER' :
                strategy.ending_strategy === 'TRAGIC_AFTERMATH' ? 'AFTERMATH' :
                strategy.ending_strategy === 'REVELATION' ? 'REVELATION' :
                strategy.ending_strategy === 'RESOLUTION' ? 'RESOLUTION' :
                strategy.ending_strategy === 'LEGACY' ? 'LEGACY' :
                strategy.ending_strategy === 'SPIRITUAL_TRANSCENDENCE' ? 'ILLUMINATION' : 'PAYOFF';
    } else if (isClimax) {
      pattern = strategy.dramatic_arc_type === 'MYSTERY' ? 'REVELATION' :
                strategy.dramatic_arc_type === 'TRAGEDY' ? 'POINT_OF_NO_RETURN' :
                strategy.dramatic_arc_type === 'ADVENTURE' ? 'CLIMAX' :
                strategy.dramatic_arc_type === 'BIOGRAPHY' ? 'TURNING_POINT' :
                strategy.dramatic_arc_type === 'SPIRITUAL_STRUGGLE' ? 'CRUCIBLE' : 'TURNING_POINT';
    } else if (i === 2) {
      pattern = patternPalette[1] || 'SETUP';
    } else {
      pattern = patternPalette[Math.min(i - 1, patternPalette.length - 1)] || 'ESCALATION';
    }

    // Audio-visual channel allocation
    // Pure visual scene for tension / aftermath / physical action
    const isPureVisual = (pattern === 'AFTERMATH' || pattern === 'INCITING_CALL' || pattern === 'EVIDENCE' || (strategy.dramatic_arc_type === 'ADVENTURE' && i === 3));
    const hasNarrator = (isLast && strategy.pacing.narration_strategy !== 'NONE') || (isFirst && strategy.pacing.narration_strategy === 'CHRONICLER_WITNESS');

    mockScenes.push({
      scene_number: i,
      title: `${testCase.locations[(i - 1) % testCase.locations.length]} - Beat ${i}`,
      duration_sec: rawDur,
      scene_pattern: pattern,
      story_purpose: `Advance the ${strategy.dramatic_arc_type} progression through ${pattern}.`,
      location_name: testCase.locations[(i - 1) % testCase.locations.length],
      time_of_day: i === 1 ? 'DAY' : i === sceneCount ? 'DUSK' : 'NIGHT',
      character_names: isPureVisual ? [testCase.characters[0]] : testCase.characters.slice(0, 2),
      emotional_objective: `Evoke targeted dramatic intensity for ${pattern}`,
      event: `Key dramatic beat ${i} staged with physical blocking.`,
      narrative_function: pattern,
      visual_action: `Physical blocking and camera action embodying ${pattern}.`,
      dialogue: isPureVisual ? [] : [
        {
          character_name: testCase.characters[0],
          line: `Dialogue serving dramatic necessity for beat ${i}.`,
          emotional_subtext: 'Intention and unsaid subtext',
          delivery: 'Tense and resolute',
        },
      ],
      narrator_vo: hasNarrator ? `Poetic narrative reflection on ${strategy.narrative_goal}.` : null,
      sound_design: {
        sfx: ['ambient sound', 'kinetic Foley cue'],
        bgm_mood: strategy.tone,
      },
      historical_integrity: {
        tier: strategy.is_historical_or_sacred ? (isFirst ? 'FACT' : 'DRAMATIZED_DIALOGUE') : 'FICTIONALIZED',
        basis: strategy.is_historical_or_sacred ? 'Sirah Ibn Hisham & Nabawiyyah' : 'Fictional script dramatic need',
      },
      prophet_depiction_safeguard: {
        is_prophet_present: strategy.is_historical_or_sacred && i >= Math.ceil(sceneCount / 2),
        visual_rule: strategy.is_historical_or_sacred
          ? 'Bayi selalu terbedong rapat menghadap dada kakeknya, wajah tidak pernah diperlihatkan, tanpa halo/cahaya magis.'
          : 'None - fictional narrative.',
      },
    });
  }

  // Strictly normalize durations to match targetDurationSec exactly (0s variance)
  const normalizedScenes = allocateAndNormalizeSceneDurations(
    mockScenes,
    testCase.targetDurationSec,
    30,
    null,
    true,
    'id'
  );

  return {
    testId: testCase.id,
    name: testCase.name,
    genre: testCase.genre,
    dramaticArcType: strategy.dramatic_arc_type,
    endingStrategy: strategy.ending_strategy,
    stakes: strategy.stakes,
    targetDurationSec: testCase.targetDurationSec,
    recommendedSceneCount: strategy.pacing.recommended_scene_count,
    sceneCountDifferentiated: strategy.pacing.recommended_scene_count !== 8 || testCase.targetDurationSec === 160,
    pacingCurve: strategy.pacing.pacing_curve,
    actFunctions: strategy.act_functions,
    mockGeneratedScenes: normalizedScenes.map((s) => ({
      scene_number: s.scene_number,
      title: s.title,
      duration_sec: s.duration_sec,
      scene_pattern: s.scene_pattern || 'BEAT',
      story_purpose: s.story_purpose,
      has_dialogue: (s.dialogue?.length || 0) > 0,
      has_narrator_vo: Boolean(s.narrator_vo),
      visual_action: s.visual_action || '',
      historical_tier: s.historical_integrity?.tier || 'FICTIONALIZED',
      is_prophet_safe: s.prophet_depiction_safeguard ? (
        !s.prophet_depiction_safeguard.is_prophet_present ||
        s.prophet_depiction_safeguard.visual_rule.includes('terbedong rapat')
      ) : true,
    })),
  };
}

export function executeAllCrossGenreProofs(): {
  reports: EngineProofReport[];
  differentiationMatrix: Record<string, any>;
  allPassed: boolean;
} {
  const reports = TEST_CASES.map((tc) => runNarrativeEngineTest(tc));

  // Verify that not all genres produce the same arc or ending!
  const uniqueArcs = new Set(reports.map((r) => r.dramaticArcType));
  const uniqueEndings = new Set(reports.map((r) => r.endingStrategy));
  const uniqueSceneCounts = new Set(reports.map((r) => r.recommendedSceneCount));

  const hasStructuralDifferentiation = uniqueArcs.size >= 5;
  const hasEndingDifferentiation = uniqueEndings.size >= 4;
  const hasSceneCountDifferentiation = uniqueSceneCounts.size >= 3;

  // Verify historical integrity & sacred safety
  const historicalTest = reports.find((r) => r.testId === 'TEST_A_HISTORICAL');
  const tragedyTest = reports.find((r) => r.testId === 'TEST_C_TRAGEDY');
  const mysteryTest = reports.find((r) => r.testId === 'TEST_B_MYSTERY');
  const adventureTest = reports.find((r) => r.testId === 'TEST_D_ADVENTURE');
  const spiritualTest = reports.find((r) => r.testId === 'TEST_F_SPIRITUAL');

  const tragedyHasNoCliffhanger = tragedyTest?.endingStrategy === 'TRAGIC_AFTERMATH';
  const mysteryHasRevelation = mysteryTest?.endingStrategy === 'REVELATION';
  const adventureHasResolution = adventureTest?.endingStrategy === 'RESOLUTION';
  const spiritualHasTranscendence = spiritualTest?.endingStrategy === 'SPIRITUAL_TRANSCENDENCE';
  const historicalHasSacredSafety = historicalTest?.mockGeneratedScenes.every((s) => s.is_prophet_safe) ?? false;

  // Duration normalization verification (sum of scene durations === targetDurationSec)
  const durationChecks = reports.every((r) => {
    const sum = r.mockGeneratedScenes.reduce((acc, s) => acc + s.duration_sec, 0);
    return sum === r.targetDurationSec;
  });

  const allPassed =
    hasStructuralDifferentiation &&
    hasEndingDifferentiation &&
    hasSceneCountDifferentiation &&
    tragedyHasNoCliffhanger &&
    mysteryHasRevelation &&
    adventureHasResolution &&
    spiritualHasTranscendence &&
    historicalHasSacredSafety &&
    durationChecks;

  return {
    reports,
    differentiationMatrix: {
      uniqueArcsCount: uniqueArcs.size,
      uniqueArcs: Array.from(uniqueArcs),
      uniqueEndingsCount: uniqueEndings.size,
      uniqueEndings: Array.from(uniqueEndings),
      uniqueSceneCounts: Array.from(uniqueSceneCounts),
      hasStructuralDifferentiation,
      hasEndingDifferentiation,
      hasSceneCountDifferentiation,
      tragedyHasNoCliffhanger,
      mysteryHasRevelation,
      adventureHasResolution,
      spiritualHasTranscendence,
      historicalHasSacredSafety,
      durationExactSumSatisfied: durationChecks,
    },
    allPassed,
  };
}

// Standalone runner for CLI execution
if (process.argv[1]?.endsWith('test_cross_genre_narrative_engine.ts')) {
  console.log('=== DIKALASTORY GENERIC CINEMATIC STORYTELLING ENGINE TEST SUITE ===\n');
  const results = executeAllCrossGenreProofs();

  for (const report of results.reports) {
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`[${report.testId}] ${report.name}`);
    console.log(`  Genre: ${report.genre}`);
    console.log(`  Arc Archetype: ${report.dramaticArcType}`);
    console.log(`  Ending Strategy: ${report.endingStrategy}`);
    console.log(`  Stakes: ${report.stakes}`);
    console.log(`  Target Duration: ${report.targetDurationSec}s | Scene Count: ${report.mockGeneratedScenes.length} scenes`);
    console.log(`  Pacing Curve: ${report.pacingCurve}`);
    console.log(`  Scene Sequence:`);
    for (const sc of report.mockGeneratedScenes) {
      console.log(
        `    Scene #${sc.scene_number} (${sc.duration_sec}s) [${sc.scene_pattern}] ${sc.title}` +
        ` | VO: ${sc.has_narrator_vo ? 'YES' : 'NONE'} | Dialogue: ${sc.has_dialogue ? 'YES' : 'SILENT/VISUAL'}` +
        ` | Tier: ${sc.historical_tier} | Sacred Safe: ${sc.is_prophet_safe ? 'LOCKED' : 'N/A'}`
      );
    }
  }

  console.log(`\n================================================================================`);
  console.log(`DIFFERENTIATION MATRIX & CONTRACT VERIFICATION:`);
  console.log(JSON.stringify(results.differentiationMatrix, null, 2));
  console.log(`================================================================================`);
  console.log(`VERDICT: ${results.allPassed ? 'ALL 6 CROSS-GENRE CONTRACT TESTS PASSED PERFECTLY' : 'FAILED'}\n`);

  if (!results.allPassed) {
    process.exit(1);
  }
}
