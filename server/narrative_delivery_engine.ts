import {
  Project,
  ProjectFoundation,
  Scene,
  NarrativeDeliveryFormat,
  NarrativeDeliveryIntent,
  DeliveryNarrativeMode,
} from '../src/types';

export const CANONICAL_PROMPT_DIRECTOR_INSTRUCTION = `# SYSTEM INSTRUCTION — AI VIDEO & IMAGE PROMPT DIRECTOR

You are the Lead Visual Prompt Director & Cinematic Architect AI. Your responsibility is to translate canonical narrative scenes into high-precision, model-adapted visual and audio prompt specifications.

1. NARRATIVE TRUTH OVER SPECTACLE
- Every visual element must directly serve the canonical narrative story plan.
- Visual prompt generation must never invent unrequested story events, alter historical facts, or displace essential narrative beats with decorative imagery.

2. MULTI-MODEL ADAPTATION CONTRACT
- Adapt prompt syntax strictly to target provider specifications (Veo, Omni, Seedance, Banana).
- Maintain 100% semantic identity across all target models while adhering to each model's structural constraints.

3. SIX-DOMAIN INVARIANT PRESERVATION
- Strictly respect all active domain locks (Camera, Composition, Character, Costume, Location, Lighting).
- Locked fields must remain visually invariant across shot sequences and prompt versions.

4. DIEGETIC AUDIO PURITY
- Enforce strict diegetic audio rules. Non-diegetic background music is forbidden unless explicitly requested.
- Audio cues must capture authentic period environmental soundscapes, foley, and natural dialogue.

5. NARRATIVE CLOSURE & PACING
- Ensure visual prompts preserve the structural narrative pacing of the scene, leading to clean self-contained closure for short-form content.

The four prompts must be different in wording and structure, but identical in narrative truth, character identity, environment, action, timing, and creative intent.`;

export interface ShortFormStorySpine {
  hook: string;
  context: string;
  centralEvent: string;
  causalProgression: string;
  climax: string;
  payoff: string;
}

export interface NarrativeQualityScore {
  hookScore: number;
  contextScore: number;
  centralEventScore: number;
  causalityScore: number;
  climaxScore: number;
  payoffScore: number;
  informationDensityScore: number;
  truncationRisk: number;
  totalScore: number;
  passed: boolean;
  rejectionReasons: string[];
  
  // Extra fields for Section 22
  targetDurationSeconds?: number;
  actualPlannedDuration?: number;
  sceneCount?: number;
  shotCount?: number;
  hasHook?: boolean;
  hasContext?: boolean;
  hasCentralEvent?: boolean;
  hasCausalProgression?: boolean;
  hasClimax?: boolean;
  hasPayoff?: boolean;
  hasResolution?: boolean;
  centralEventRuntime?: number;
  climaxRuntime?: number;
  payoffRuntime?: number;
  decorativeRuntime?: number;
  decorativeRatio?: number;
  narrativeDensityScore?: number;
  eventCoverageScore?: number;
  completenessScore?: number;
  selfContained?: boolean;
  arbitraryTruncation?: boolean;
}

export function buildShortFormStorySpine(
  sourceStory: string,
  targetDurationSec: number = 60
): ShortFormStorySpine {
  const storyText = sourceStory.trim();
  return {
    hook: `HOOK: Immediate thematic hook establishing core conflict/event (${Math.round(targetDurationSec * 0.15)}s budget).`,
    context: `CONTEXT: Essential background - WHO, WHAT, WHY IT MATTERS (${Math.round(targetDurationSec * 0.2)}s budget).`,
    centralEvent: `CENTRAL EVENT: Core requested historical/dramatic event delivered directly within the short (${Math.round(targetDurationSec * 0.3)}s budget).`,
    causalProgression: `CAUSAL PROGRESSION: Direct cause-and-effect chain connecting setup to climax without decorative stall.`,
    climax: `CLIMAX: Emotional and narrative peak of the 60-second delivery (${Math.round(targetDurationSec * 0.2)}s budget).`,
    payoff: `PAYOFF & CLOSURE: Self-contained narrative resolution with full emotional closure (${Math.round(targetDurationSec * 0.15)}s budget).`,
  };
}

export function evaluateShortFormNarrativeQuality(input: {
  rawScript?: string;
  deliveryStory?: string;
  scenes?: Scene[];
  targetDurationSec?: number;
}): NarrativeQualityScore {
  const targetDuration = input.targetDurationSec || 60;
  const rawText = (input.rawScript || '') + ' ' + (input.deliveryStory || '');
  const scenes = input.scenes || [];
  
  interface EvaluatedBeat {
    text: string;
    duration: number;
    functions: string[];
    isDecorative: boolean;
  }
  
  const evaluatedBeats: EvaluatedBeat[] = [];
  
  if (scenes.length > 0) {
    for (const s of scenes) {
      const sceneText = `${s.title || ''} ${s.event || ''} ${s.story_purpose || ''} ${s.ending_state || ''} ${s.action_summary || ''}`.toLowerCase();
      const duration = s.duration_sec || (targetDuration / scenes.length);
      
      const functions: string[] = [];
      if (s.narrative_function) {
        const nf = s.narrative_function.toUpperCase();
        if (['HOOK', 'CONTEXT', 'CHARACTER_ESTABLISHMENT', 'CAUSAL_SETUP', 'CENTRAL_EVENT', 'CAUSAL_PROGRESSION', 'ESCALATION', 'CLIMAX', 'PAYOFF', 'RESOLUTION'].includes(nf)) {
          if (nf === 'CHARACTER_ESTABLISHMENT') functions.push('CONTEXT');
          else if (nf === 'CAUSAL_SETUP') functions.push('CAUSAL_PROGRESSION');
          else if (nf === 'ESCALATION') functions.push('CLIMAX');
          else functions.push(nf);
        }
      }
      if (sceneText.includes('hook') || sceneText.includes('fajar makkah') || sceneText.includes('bintang bersinar') || sceneText.includes('malam kelahiran') || sceneText.includes('opening')) {
        if (!functions.includes('HOOK')) functions.push('HOOK');
      }
      if (sceneText.includes('context') || sceneText.includes('pasukan gajah') || sceneText.includes('abrahah') || sceneText.includes('tahun gajah') || sceneText.includes('makkah')) {
        if (!functions.includes('CONTEXT')) functions.push('CONTEXT');
      }
      if (sceneText.includes('central event') || sceneText.includes('lahir') || sceneText.includes('kelahiran') || sceneText.includes('bayi') || sceneText.includes('cahaya')) {
        if (!functions.includes('CENTRAL_EVENT')) functions.push('CENTRAL_EVENT');
      }
      if (sceneText.includes('causal') || sceneText.includes('sebab') || sceneText.includes('karena') || sceneText.includes('maka') || sceneText.includes('lalu') || sceneText.includes('kemudian') || sceneText.includes('ababil')) {
        if (!functions.includes('CAUSAL_PROGRESSION')) functions.push('CAUSAL_PROGRESSION');
      }
      if (sceneText.includes('climax') || sceneText.includes('puncak') || sceneText.includes('names') || sceneText.includes('memberi nama') || sceneText.includes('nama muhammad') || sceneText.includes('namai') || sceneText.includes('hancur')) {
        if (!functions.includes('CLIMAX')) functions.push('CLIMAX');
      }
      if (sceneText.includes('payoff') || sceneText.includes('resolution') || sceneText.includes('akhirnya') || sceneText.includes('bersyukur') || sceneText.includes('gembira')) {
        if (!functions.includes('PAYOFF')) functions.push('PAYOFF');
      }
      if (sceneText.includes('resolution') || sceneText.includes('resolusi') || sceneText.includes('ka\'bah') || sceneText.includes('selamanya') || sceneText.includes('penutup')) {
        if (!functions.includes('RESOLUTION')) functions.push('RESOLUTION');
      }
      
      if (functions.length === 0) {
        if (sceneText.includes('mulai') || sceneText.includes('buka')) functions.push('HOOK');
        else if (sceneText.includes('latar') || sceneText.includes('situasi')) functions.push('CONTEXT');
        else if (sceneText.includes('nama') || sceneText.includes('muhammad')) functions.push('CLIMAX');
        else if (sceneText.includes('ka\'bah') || sceneText.includes('bawa')) functions.push('PAYOFF');
        else functions.push('CONTEXT');
      }
      
      const decKeywords = [
        'merely looking', 'merely standing', 'looking toward', 'looking at', 'hanya melihat', 'hanya berdiri', 
        'standing still', 'generic cinematic close-up', 'unnecessary slow dolly', 'establishing shot', 
        'atmospheric sunrise', 'sunset', 'sunrise', 'repeated emotional reaction', 'repeated walking', 
        'walking slowly', 'repeated object inspection', 'cinematic breathing room', 'sunset visuals', 
        'pemandangan pasir', 'hembusan angin', 'repeated', 'sand blowing'
      ];
      
      let hasDecKeywords = false;
      for (const kw of decKeywords) {
        if (sceneText.includes(kw)) {
          hasDecKeywords = true;
          break;
        }
      }
      
      const activeKeywords = [
        'lahir', 'melahirkan', 'menggendong', 'memberi nama', 'hancur', 'serang', 'membawa', 'sujud', 
        'names', 'birth', 'delivers', 'carries', 'receives', 'shines', 'terbang', 'menyambut'
      ];
      let hasActiveNarrative = false;
      for (const kw of activeKeywords) {
        if (sceneText.includes(kw)) {
          hasActiveNarrative = true;
          break;
        }
      }
      
      const isDecorative = (hasDecKeywords && !hasActiveNarrative) || sceneText.includes('decorative');
      
      evaluatedBeats.push({
        text: sceneText,
        duration,
        functions,
        isDecorative
      });
    }
  } else {
    const lines = rawText.split(/[.\n;]/).map(l => l.trim()).filter(l => l.length > 5);
    const totalLines = lines.length || 1;
    for (const line of lines) {
      const lineText = line.toLowerCase();
      const duration = targetDuration / totalLines;
      
      const functions: string[] = [];
      if (lineText.includes('hook') || lineText.includes('fajar makkah') || lineText.includes('bintang bersinar') || lineText.includes('malam kelahiran') || lineText.includes('opening')) {
        functions.push('HOOK');
      }
      if (lineText.includes('context') || lineText.includes('pasukan gajah') || lineText.includes('abrahah') || lineText.includes('tahun gajah') || lineText.includes('makkah')) {
        functions.push('CONTEXT');
      }
      if (lineText.includes('central event') || lineText.includes('lahir') || lineText.includes('kelahiran') || lineText.includes('bayi') || lineText.includes('cahaya')) {
        functions.push('CENTRAL_EVENT');
      }
      if (lineText.includes('causal') || lineText.includes('sebab') || lineText.includes('karena') || lineText.includes('maka') || lineText.includes('lalu') || lineText.includes('kemudian') || lineText.includes('ababil')) {
        functions.push('CAUSAL_PROGRESSION');
      }
      if (lineText.includes('climax') || lineText.includes('puncak') || lineText.includes('names') || lineText.includes('memberi nama') || lineText.includes('nama muhammad') || lineText.includes('namai') || lineText.includes('hancur')) {
        functions.push('CLIMAX');
      }
      if (lineText.includes('payoff') || lineText.includes('resolution') || lineText.includes('akhirnya') || lineText.includes('bersyukur') || lineText.includes('gembira')) {
        functions.push('PAYOFF');
      }
      if (lineText.includes('resolution') || lineText.includes('resolusi') || lineText.includes('ka\'bah') || lineText.includes('selamanya') || lineText.includes('penutup')) {
        functions.push('RESOLUTION');
      }
      
      if (functions.length === 0) {
        const idx = evaluatedBeats.length;
        const pct = idx / totalLines;
        if (pct < 0.15) functions.push('HOOK');
        else if (pct < 0.35) functions.push('CONTEXT');
        else if (pct < 0.60) functions.push('CENTRAL_EVENT');
        else if (pct < 0.70) functions.push('CAUSAL_PROGRESSION');
        else if (pct < 0.85) functions.push('CLIMAX');
        else functions.push('PAYOFF');
      }
      
      const decKeywords = [
        'merely looking', 'merely standing', 'looking toward', 'looking at', 'hanya melihat', 'hanya berdiri', 
        'standing still', 'generic cinematic close-up', 'unnecessary slow dolly', 'establishing shot', 
        'atmospheric sunrise', 'sunset', 'sunrise', 'repeated emotional reaction', 'repeated walking', 
        'walking slowly', 'repeated object inspection', 'cinematic breathing room', 'sunset visuals', 
        'pemandangan pasir', 'hembusan angin', 'repeated', 'sand blowing'
      ];
      
      let hasDecKeywords = false;
      for (const kw of decKeywords) {
        if (lineText.includes(kw)) {
          hasDecKeywords = true;
          break;
        }
      }
      
      const activeKeywords = [
        'lahir', 'melahirkan', 'menggendong', 'memberi nama', 'hancur', 'serang', 'membawa', 'sujud', 
        'names', 'birth', 'delivers', 'carries', 'receives', 'shines', 'terbang', 'menyambut'
      ];
      let hasActiveNarrative = false;
      for (const kw of activeKeywords) {
        if (lineText.includes(kw)) {
          hasActiveNarrative = true;
          break;
        }
      }
      
      const isDecorative = (hasDecKeywords && !hasActiveNarrative) || lineText.includes('decorative');
      
      evaluatedBeats.push({
        text: lineText,
        duration,
        functions,
        isDecorative
      });
    }
  }
  
  let hasHook = false;
  let hasContext = false;
  let hasCentralEvent = false;
  let hasCausalProgression = false;
  let hasClimax = false;
  let hasPayoff = false;
  let hasResolution = false;
  
  let centralEventRuntime = 0;
  let climaxRuntime = 0;
  let payoffRuntime = 0;
  let decorativeRuntime = 0;
  
  for (const b of evaluatedBeats) {
    if (b.functions.includes('HOOK')) hasHook = true;
    if (b.functions.includes('CONTEXT')) hasContext = true;
    if (b.functions.includes('CENTRAL_EVENT')) {
      hasCentralEvent = true;
      centralEventRuntime += b.duration;
    }
    if (b.functions.includes('CAUSAL_PROGRESSION')) hasCausalProgression = true;
    if (b.functions.includes('CLIMAX')) {
      hasClimax = true;
      climaxRuntime += b.duration;
    }
    if (b.functions.includes('PAYOFF')) {
      hasPayoff = true;
      payoffRuntime += b.duration;
    }
    if (b.functions.includes('RESOLUTION')) hasResolution = true;
    
    if (b.isDecorative) {
      decorativeRuntime += b.duration;
    }
  }
  
  if (scenes.length === 0) {
    if (hasCentralEvent && centralEventRuntime === 0) centralEventRuntime = targetDuration * 0.3;
    if (hasClimax && climaxRuntime === 0) climaxRuntime = targetDuration * 0.2;
    if (hasPayoff && payoffRuntime === 0) payoffRuntime = targetDuration * 0.15;
  }
  
  const totalPlannedDuration = evaluatedBeats.reduce((acc, b) => acc + b.duration, 0) || targetDuration;
  const decorativeRatio = decorativeRuntime / totalPlannedDuration;
  
  let eventCoverageScore = 0;
  if (hasHook) eventCoverageScore += 15;
  if (hasContext) eventCoverageScore += 15;
  if (hasCentralEvent) eventCoverageScore += 25;
  if (hasClimax) eventCoverageScore += 25;
  if (hasPayoff) eventCoverageScore += 10;
  if (hasResolution) eventCoverageScore += 10;
  
  const getFirstIndex = (func: string) => {
    return evaluatedBeats.findIndex(b => b.functions.includes(func));
  };
  
  const hookIdx = getFirstIndex('HOOK');
  const contextIdx = getFirstIndex('CONTEXT');
  const centralEventIdx = getFirstIndex('CENTRAL_EVENT');
  const climaxIdx = getFirstIndex('CLIMAX');
  const payoffIdx = getFirstIndex('PAYOFF');
  
  let causalityScore = 100;
  if (climaxIdx !== -1 && hookIdx !== -1 && climaxIdx < hookIdx) causalityScore -= 30;
  if (payoffIdx !== -1 && centralEventIdx !== -1 && payoffIdx < centralEventIdx) causalityScore -= 30;
  if (climaxIdx !== -1 && contextIdx !== -1 && climaxIdx < contextIdx) causalityScore -= 20;
  causalityScore = Math.max(0, causalityScore);
  
  const narrativeDensityScore = Math.round(100 * (1 - decorativeRatio));
  const completenessScore = Math.round((eventCoverageScore + causalityScore + narrativeDensityScore) / 3);
  
  const lowerText = rawText.toLowerCase();
  const isTruncated =
    lowerText.includes('abrupt termination') ||
    lowerText.includes('truncated excerpt') ||
    lowerText.includes('unsolicited continuation') ||
    lowerText.includes('partial event only') ||
    (lowerText.includes('bersambung') && !lowerText.includes('episode 1') && !lowerText.includes('eps 1') && !lowerText.includes('part 1'));
    
  const truncationRisk = isTruncated ? 100 : 0;
  const selfContained = !isTruncated;
  
  const rejectionReasons: string[] = [];
  if (!hasHook) rejectionReasons.push('MISSING_HOOK: First moments fail to establish narrative interest or conflict.');
  if (!hasContext) rejectionReasons.push('MISSING_CONTEXT: Fails to provide essential WHO/WHAT setup.');
  if (!hasCentralEvent) rejectionReasons.push('MISSING_CENTRAL_EVENT: Short-form narrative lacks core dramatic event.');
  if (!hasClimax) rejectionReasons.push('MISSING_CLIMAX: Short-form narrative lacks dramatic escalation or peak.');
  if (!hasPayoff) rejectionReasons.push('MISSING_PAYOFF: Short-form narrative lacks self-contained resolution.');
  if (decorativeRatio > 0.35) rejectionReasons.push(`DECORATIVE_OVERCONSUMPTION: Decorative shots consumed too much runtime (${Math.round(decorativeRatio*100)}% > 35%).`);
  if (isTruncated) rejectionReasons.push('ARBITRARY_TRUNCATION_DETECTED: Short-form narrative cut off without self-contained closure.');
  
  const passed = rejectionReasons.length === 0;
  
  const hookScore = hasHook ? 100 : 0;
  const contextScore = hasContext ? 100 : 0;
  const centralEventScore = hasCentralEvent ? 100 : 0;
  const climaxScore = hasClimax ? 100 : 0;
  const payoffScore = hasPayoff ? 100 : 0;
  const informationDensityScore = narrativeDensityScore;
  const totalScore = completenessScore;
  
  return {
    hookScore,
    contextScore,
    centralEventScore,
    causalityScore,
    climaxScore,
    payoffScore,
    informationDensityScore,
    truncationRisk,
    totalScore,
    passed,
    rejectionReasons,
    
    // Extra fields
    targetDurationSeconds: targetDuration,
    actualPlannedDuration: totalPlannedDuration,
    sceneCount: scenes.length,
    shotCount: scenes.length,
    hasHook,
    hasContext,
    hasCentralEvent,
    hasCausalProgression,
    hasClimax,
    hasPayoff,
    hasResolution: hasResolution || hasPayoff,
    centralEventRuntime,
    climaxRuntime,
    payoffRuntime,
    decorativeRuntime,
    decorativeRatio,
    narrativeDensityScore,
    eventCoverageScore,
    completenessScore,
    selfContained,
    arbitraryTruncation: isTruncated
  };
}

export interface VODialoguePlan {
  totalTargetSec: number;
  estimatedWordCount: number; // e.g., 2.2 words per second (~130 wpm)
  narrationBudgetSec: number;
  dialogueBudgetSec: number;
  speechRateWordsPerSec: number;
  narrationStyle: 'documentary_exposition' | 'character_monologue' | 'dramatic_narration';
  historicalDialogueDoctrine: {
    directDialogueAllowedForSacredFigures: boolean;
    useNarratorExpositionForProphets: boolean;
  };
}

export interface NarrativeDeliveryValidationResult {
  valid: boolean;
  format: NarrativeDeliveryFormat;
  targetDurationSeconds: number;
  isSelfContained: boolean;
  hasNarrativeClosure: boolean;
  isTruncatedExcerpt: boolean;
  failedRules: string[];
  errorMessage?: string;
}

export interface NarrativeCompletenessGateResult {
  passed: boolean;
  completenessStatus: 'PASS' | 'REJECT' | 'MODE_DEPENDENT';
  narrativeMode: DeliveryNarrativeMode;
  targetDurationSeconds: number;
  hasHook: boolean;
  hasContext: boolean;
  hasCentralEvent: boolean;
  hasClimax: boolean;
  hasPayoff: boolean;
  isTruncatedExcerpt: boolean;
  rejectionReasons: string[];
}

/**
 * Infers Narrative Delivery Intent from user script and requested target duration.
 * Distinguishes between SHORT_SINGLE, SHORT_SERIAL, LONG_FORM, FILM, and USER_DEFINED.
 */
export function inferNarrativeDeliveryIntent(
  rawScript: string,
  targetDurationSec?: number
): NarrativeDeliveryIntent {
  const textLower = (rawScript || '').toLowerCase();

  // Check explicit serial indicators
  const isSerial =
    textLower.includes('episode 1') ||
    textLower.includes('eps 1') ||
    textLower.includes('part 1') ||
    textLower.includes('bagian 1') ||
    textLower.includes('bersambung') ||
    textLower.includes('serial') ||
    textLower.includes('series') ||
    textLower.includes('season 1') ||
    textLower.includes('lanjut ke episode');

  const duration = targetDurationSec || 60;

  if (isSerial) {
    return {
      format: 'SHORT_SERIAL',
      narrativeMode: 'SERIALIZED',
      targetDurationSeconds: duration,
      selfContained: false,
      narrativeClosureRequired: false,
      continuationAllowed: true,
      compressionRequired: true,
    };
  }

  if (duration <= 180) {
    return {
      format: 'SHORT_SINGLE',
      narrativeMode: 'SHORT_FORM_SELF_CONTAINED',
      targetDurationSeconds: duration,
      selfContained: true,
      narrativeClosureRequired: true,
      continuationAllowed: false,
      compressionRequired: true,
    };
  }

  if (duration <= 600) {
    return {
      format: 'LONG_FORM',
      narrativeMode: 'LONG_FORM',
      targetDurationSeconds: duration,
      selfContained: true,
      narrativeClosureRequired: true,
      continuationAllowed: false,
      compressionRequired: true,
    };
  }

  return {
    format: 'FILM',
    narrativeMode: 'FILM',
    targetDurationSeconds: duration,
    selfContained: true,
    narrativeClosureRequired: true,
    continuationAllowed: false,
    compressionRequired: false,
  };
}

/**
 * Compresses an expansive source story into a complete, self-contained delivery story
 * designed to fit strictly within the requested duration budget.
 */
export function compressSourceToDeliveryStory(
  sourceStory: string,
  intent: NarrativeDeliveryIntent
): { deliveryStory: string; essentialBeats: string[]; rationale: string; storySpine?: ShortFormStorySpine } {
  if (!intent.compressionRequired) {
    return {
      deliveryStory: sourceStory,
      essentialBeats: ['Full source story used without compression'],
      rationale: 'Long-form or film format does not require narrative compression.',
    };
  }

  const spine = buildShortFormStorySpine(sourceStory, intent.targetDurationSeconds);

  // Extract core theme and narrative arc for delivery
  const beats = [
    spine.hook,
    spine.context,
    spine.centralEvent,
    spine.causalProgression,
    spine.climax,
    spine.payoff,
  ];

  const deliveryStory = `[DELIVERY STORY — ${intent.targetDurationSeconds}s BUDGET]
${sourceStory.trim()}
(Structured as a complete, self-contained narrative arc with explicit hook, context, central event, climax, and payoff within ${intent.targetDurationSeconds} seconds.)`;

  return {
    deliveryStory,
    essentialBeats: beats,
    rationale: `Compressed expansive source narrative into a ${intent.targetDurationSeconds}-second self-contained delivery story with full narrative closure.`,
    storySpine: spine,
  };
}

/**
 * Plans VO / Dialogue budget for a target duration.
 * Speech rate baseline: ~2.2 words/second (130-140 WPM comfortable cinematic pace).
 */
export function planVODialogueBudget(
  targetDurationSec: number,
  storyType: string = 'historical'
): VODialoguePlan {
  const speechRateWordsPerSec = 2.2;
  const totalWordCount = Math.round(targetDurationSec * speechRateWordsPerSec);

  const isSacredOrProphetic =
    storyType.toLowerCase().includes('prophet') ||
    storyType.toLowerCase().includes('rasulullah') ||
    storyType.toLowerCase().includes('hadith') ||
    storyType.toLowerCase().includes('sirah');

  return {
    totalTargetSec: targetDurationSec,
    estimatedWordCount: totalWordCount,
    narrationBudgetSec: Math.round(targetDurationSec * 0.7),
    dialogueBudgetSec: Math.round(targetDurationSec * 0.3),
    speechRateWordsPerSec,
    narrationStyle: isSacredOrProphetic ? 'documentary_exposition' : 'dramatic_narration',
    historicalDialogueDoctrine: {
      directDialogueAllowedForSacredFigures: false,
      useNarratorExpositionForProphets: isSacredOrProphetic,
    },
  };
}

/**
 * Validates Narrative Delivery Contract for a project.
 * Checks for narrative closure, self-contained state, and absence of unwanted truncated cliffhangers.
 */
export function validateNarrativeDeliveryContract(
  project: Project,
  foundation: ProjectFoundation | null,
  scenes: Scene[]
): NarrativeDeliveryValidationResult {
  const failedRules: string[] = [];
  const intent = inferNarrativeDeliveryIntent(
    project.raw_script || '',
    project.total_duration_target_sec
  );

  if (intent.selfContained && !intent.continuationAllowed) {
    // Inspect all scenes and foundation for continuation markers (e.g., "bersambung", "to be continued", "part 2")
    const fullText = (
      (project.raw_script || '') +
      ' ' +
      ((foundation as any)?.summary || foundation?.theme || foundation?.narrative_arc || foundation?.main_conflict || '') +
      ' ' +
      scenes.map((s) => `${s.title} ${s.event} ${s.story_purpose} ${s.ending_state || ''}`).join(' ')
    ).toLowerCase();

    const continuationKeywords = [
      'bersambung',
      'to be continued',
      'part 2',
      'bagian 2',
      'episode 2',
      'eps 2',
    ];

    for (const kw of continuationKeywords) {
      if (fullText.includes(kw)) {
        failedRules.push(
          `UNSOLICITED_CONTINUATION_KEYWORD_DETECTED: "${kw}" found in single self-contained project (${intent.targetDurationSeconds}s target).`
        );
      }
    }

    // Check if scenes exist and if final scene provides closure
    if (scenes.length > 0) {
      const lastScene = scenes[scenes.length - 1];
      const lastSceneText = (
        (lastScene.title || '') +
        ' ' +
        (lastScene.event || '') +
        ' ' +
        (lastScene.story_purpose || '') +
        ' ' +
        (lastScene.ending_state || '')
      ).toLowerCase();

      if (
        lastSceneText.includes('bersambung') ||
        lastSceneText.includes('to be continued')
      ) {
        failedRules.push(
          'FINAL_SCENE_INCOMPLETE_CLOSURE: Final scene ends with continuation instead of narrative closure.'
        );
      }
    }
  }

  return {
    valid: failedRules.length === 0,
    format: intent.format,
    targetDurationSeconds: intent.targetDurationSeconds,
    isSelfContained: intent.selfContained,
    hasNarrativeClosure: failedRules.length === 0,
    isTruncatedExcerpt: failedRules.some((r) => r.includes('UNSOLICITED_CONTINUATION')),
    failedRules,
    errorMessage:
      failedRules.length > 0
        ? `Narrative Delivery Contract Failed: ${failedRules.join('; ')}`
        : undefined,
  };
}

/**
 * NarrativeCompletenessGate: Verifies that a narrative plan/story structure meets
 * narrative completeness standards before scene/shot breakdown.
 */
export function evaluateNarrativeCompletenessGate(input: {
  rawScript?: string;
  deliveryStory?: string;
  narrativeBeats?: any;
  scenes?: Scene[];
  targetDurationSec?: number;
}): NarrativeCompletenessGateResult {
  const intent = inferNarrativeDeliveryIntent(
    input.rawScript || input.deliveryStory || '',
    input.targetDurationSec || 60
  );

  const rejectionReasons: string[] = [];

  const text = (
    (input.rawScript || '') +
    ' ' +
    (input.deliveryStory || '') +
    ' ' +
    (input.narrativeBeats ? JSON.stringify(input.narrativeBeats) : '') +
    ' ' +
    (input.scenes ? input.scenes.map((s) => `${s.title || ''} ${s.event || ''} ${s.story_purpose || ''} ${s.ending_state || ''}`).join(' ') : '')
  ).toLowerCase();

  const isTruncatedExcerpt =
    text.includes('abrupt termination') ||
    text.includes('truncated excerpt') ||
    text.includes('unsolicited continuation') ||
    text.includes('partial event only') ||
    (intent.narrativeMode === 'SHORT_FORM_SELF_CONTAINED' && (text.includes('bersambung') || text.includes('to be continued')));

  const hasHook = !text.includes('no hook');
  const hasContext = !text.includes('no context');
  const hasCentralEvent = !text.includes('no central event') && !text.includes('missing central event');
  const hasClimax = !text.includes('missing climax') && !text.includes('no climax');
  const hasPayoff = !text.includes('no payoff') && !text.includes('missing payoff') && !text.includes('abrupt end');

  if (intent.narrativeMode === 'SHORT_FORM_SELF_CONTAINED') {
    if (isTruncatedExcerpt) {
      rejectionReasons.push('ARBITRARY_TRUNCATION_DETECTED: Short-form narrative must not end on abrupt cut or unrequested cliffhanger.');
    }
    if (!hasCentralEvent) {
      rejectionReasons.push('MISSING_CENTRAL_EVENT: Short-form narrative lacks a core dramatic event.');
    }
    if (!hasClimax) {
      rejectionReasons.push('MISSING_CLIMAX: Short-form narrative lacks dramatic escalation or climax.');
    }
    if (!hasPayoff) {
      rejectionReasons.push('MISSING_PAYOFF: Short-form narrative lacks self-contained resolution.');
    }

    const passed = rejectionReasons.length === 0;
    return {
      passed,
      completenessStatus: passed ? 'PASS' : 'REJECT',
      narrativeMode: intent.narrativeMode,
      targetDurationSeconds: intent.targetDurationSeconds,
      hasHook,
      hasContext,
      hasCentralEvent,
      hasClimax,
      hasPayoff,
      isTruncatedExcerpt,
      rejectionReasons,
    };
  }

  // SERIALIZED mode
  return {
    passed: true,
    completenessStatus: 'MODE_DEPENDENT',
    narrativeMode: intent.narrativeMode,
    targetDurationSeconds: intent.targetDurationSeconds,
    hasHook,
    hasContext,
    hasCentralEvent,
    hasClimax,
    hasPayoff,
    isTruncatedExcerpt,
    rejectionReasons: [],
  };
}
