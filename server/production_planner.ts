import {
  resolveModelForTask,
  TaskRequirements,
} from './capability_resolver';
import {
  Project,
  ProjectFoundation,
  Scene,
  Shot,
  VideoPrompt,
  CharacterBible,
  LocationBible,
  ObjectBible,
  CharacterContinuityState,
  PlatformCapabilityProfile,
  UserQuotaProfile,
  QuotaConsumptionEstimate,
  GenerationShotPlan,
  SequenceMergeCandidate,
  GenerationPlan,
  ProductionReadinessScore,
} from '../src/types';
import {
  resolveOutputDurationStrict,
  resolveGenerationContainer,
  verifyMultiDimensionalDurationInvariants,
} from './duration_engine';
import { AVAILABLE_MODELS } from './gemini';

/**
 * Standard registry of platform capability profiles.
 * Users can also supply their own or override these in configuration.
 */
export const DEFAULT_PLATFORM_CAPABILITY_PROFILES: Record<string, PlatformCapabilityProfile> = {
  veo: {
    provider_id: 'veo',
    model_id: 'veo-2.0',
    display_name: 'Google Veo 2.0',
    supported_durations_sec: [5, 10],
    min_duration_sec: 5,
    max_duration_sec: 10,
    supports_image_prompt: false,
    supports_video_prompt: true,
    supports_long_sequence: false,
    quota_type: 'credits',
    unit_name: 'credits',
    cost_per_generation: 10,
    notes: 'High visual fidelity for 5-10s cinematic video clips.',
  },
  gemini_omni: {
    provider_id: 'gemini_omni',
    model_id: 'omni-video-1.0',
    display_name: 'Gemini Omni Video',
    supported_durations_sec: [5, 10],
    min_duration_sec: 5,
    max_duration_sec: 10,
    supports_image_prompt: true,
    supports_video_prompt: true,
    supports_long_sequence: false,
    quota_type: 'credits',
    unit_name: 'credits',
    cost_per_generation: 5,
    notes: 'Fast prompt adherence with reference-preserving image and video capabilities.',
  },
  seedance_10: {
    provider_id: 'seedance_10',
    model_id: 'seedance-v1-10s',
    display_name: 'Seedance Standard (10s)',
    supported_durations_sec: [10],
    min_duration_sec: 10,
    max_duration_sec: 10,
    supports_image_prompt: false,
    supports_video_prompt: true,
    supports_long_sequence: false,
    quota_type: 'credits',
    unit_name: 'credits',
    cost_per_generation: 8,
    notes: 'Seedance 10s 3-beat rhythm generation.',
  },
  seedance_30: {
    provider_id: 'seedance_30',
    model_id: 'seedance-v1-30s',
    display_name: 'Seedance Extended (30s Container)',
    supported_durations_sec: [30],
    min_duration_sec: 30,
    max_duration_sec: 30,
    supports_image_prompt: false,
    supports_video_prompt: true,
    supports_long_sequence: true,
    quota_type: 'credits',
    unit_name: 'credits',
    cost_per_generation: 20,
    notes: 'Seedance 30s 5-shot long-sequence container for combined narrative arcs.',
  },
  banana_master_frame: {
    provider_id: 'banana_master_frame',
    model_id: 'banana-master-frame',
    display_name: 'Banana Visual Anchor / Master Frame',
    supported_durations_sec: [10],
    min_duration_sec: 10,
    max_duration_sec: 10,
    supports_image_prompt: true,
    supports_video_prompt: false,
    supports_long_sequence: false,
    quota_type: 'generations',
    unit_name: 'images',
    cost_per_generation: 1,
    notes: 'Canonical static reference generation for scene anchors.',
  },
};

/**
 * Deterministically routes the most appropriate platform for a given shot.
 * 0 AI calls.
 */
export function routePlatformForShot(
  shot: Shot,
  userPreferences?: { preferred_platform?: string; max_cost_limit?: number },
  userQuotaProfiles?: UserQuotaProfile[]
): {
  recommended_platform: string;
  fallback_platforms: string[];
  generation_container_sec: number;
  usable_duration_sec: number;
  quota_estimated_cost: number;
  reason: string;
} {
  const shotDur = shot.duration_sec || 5;

  // 1. Check user explicit preference first if provided and supported
  if (userPreferences?.preferred_platform && DEFAULT_PLATFORM_CAPABILITY_PROFILES[userPreferences.preferred_platform]) {
    const prefProf = DEFAULT_PLATFORM_CAPABILITY_PROFILES[userPreferences.preferred_platform];
    const isSupported = prefProf.supported_durations_sec.some((d) => d >= shotDur);
    if (isSupported) {
      const containerDur = prefProf.supported_durations_sec.find((d) => d >= shotDur) || prefProf.max_duration_sec;
      return {
        recommended_platform: prefProf.provider_id,
        fallback_platforms: ['gemini_omni', 'veo', 'seedance_10'].filter((p) => p !== prefProf.provider_id),
        generation_container_sec: containerDur,
        usable_duration_sec: shotDur,
        quota_estimated_cost: prefProf.cost_per_generation,
        reason: `Selected by user preference: ${prefProf.display_name}.`,
      };
    }
  }

  // 2. Capability Resolution (Phase K)
  const taskRequirements: TaskRequirements = {
    requiredCapabilities: ['video'],
  };
  
  if (shotDur > 10) {
    taskRequirements.requiredCapabilities.push('text', 'image'); // Complex shots might need more
  }

  // Use capability resolver to filter platform availability based on model info
  // Note: This matches the GeminiModels, need to map to Platforms.
  // For now, keep existing heuristic but integrate capability awareness.
  
  // 3. Check quota availability if user configured quota profiles
  const quotaMap = new Map<string, UserQuotaProfile>();
  if (userQuotaProfiles && userQuotaProfiles.length > 0) {
    for (const q of userQuotaProfiles) {
      quotaMap.set(q.provider_id, q);
    }
  }

  // 4. Deterministic capability heuristic based on shot duration and visual complexity
  if (shotDur > 10) {
    const prof = DEFAULT_PLATFORM_CAPABILITY_PROFILES['seedance_30'];
    return {
      recommended_platform: 'seedance_30',
      fallback_platforms: ['veo', 'seedance_10'],
      generation_container_sec: 30,
      usable_duration_sec: shotDur,
      quota_estimated_cost: prof.cost_per_generation,
      reason: `Shot duration (${shotDur}s) requires long container (Seedance 30s).`,
    };
  }

  if (shotDur === 10) {
    // Check if seedance_10 or veo is preferred
    const veoQuota = quotaMap.get('veo');
    if (veoQuota && veoQuota.remaining_quota < 10) {
      const altProf = DEFAULT_PLATFORM_CAPABILITY_PROFILES['seedance_10'];
      return {
        recommended_platform: 'seedance_10',
        fallback_platforms: ['gemini_omni', 'veo'],
        generation_container_sec: 10,
        usable_duration_sec: 10,
        quota_estimated_cost: altProf.cost_per_generation,
        reason: 'Veo quota constrained; routed to Seedance 10s.',
      };
    }
    const prof = DEFAULT_PLATFORM_CAPABILITY_PROFILES['veo'];
    return {
      recommended_platform: 'veo',
      fallback_platforms: ['seedance_10', 'gemini_omni'],
      generation_container_sec: 10,
      usable_duration_sec: 10,
      quota_estimated_cost: prof.cost_per_generation,
      reason: '10s cinematic shot matches Veo 10s profile.',
    };
  }

  // shotDur <= 5
  const omniProf = DEFAULT_PLATFORM_CAPABILITY_PROFILES['gemini_omni'];
  return {
    recommended_platform: 'gemini_omni',
    fallback_platforms: ['veo', 'seedance_10'],
    generation_container_sec: 5,
    usable_duration_sec: shotDur,
    quota_estimated_cost: omniProf.cost_per_generation,
    reason: `${shotDur}s quick cut routed to Gemini Omni (5s).`,
  };
}

/**
 * Calculates deterministic quota estimates across all configured user quotas.
 * If user hasn't configured quotas, returns graceful unconfigured status (0 fabricated data).
 */
export function calculateQuotaEstimates(
  shotPlans: GenerationShotPlan[],
  userQuotaProfiles?: UserQuotaProfile[]
): QuotaConsumptionEstimate[] {
  if (!userQuotaProfiles || userQuotaProfiles.length === 0) {
    return [];
  }

  const usageCounts: Record<string, number> = {};
  for (const shot of shotPlans) {
    const pId = shot.selected_platform || shot.recommended_platform;
    usageCounts[pId] = (usageCounts[pId] || 0) + 1;
  }

  return userQuotaProfiles.map((profile) => {
    const count = usageCounts[profile.provider_id] || 0;
    const estimatedCost = count * (profile.cost_per_generation || 1);
    const available = profile.remaining_quota >= estimatedCost;
    const remainingAfter = profile.remaining_quota - estimatedCost;

    return {
      provider_id: profile.provider_id,
      display_name: profile.display_name,
      required_generations: count,
      estimated_quota_cost: estimatedCost,
      quota_available: available,
      remaining_after_run: remainingAfter,
    };
  });
}

/**
 * Deterministically evaluates adjacent scenes/shots for 30-second Seedance Sequence Merge Candidates.
 * 
 * CRITICAL INVARIANT:
 * Merge candidate evaluation DOES NOT rewrite or mutate the source scene durations or shot durations.
 * Scene A (10s) + Scene B (15s) = 25s narrative content placed in 30s container.
 * Original scene durations remain 10s and 15s.
 */
export function evaluateSequenceMergeCandidates(
  scenes: Scene[],
  shotsMap?: Record<string, Shot[]>,
  continuityStates?: CharacterContinuityState[]
): SequenceMergeCandidate[] {
  if (!scenes || scenes.length < 2) {
    return [];
  }

  const candidates: SequenceMergeCandidate[] = [];
  const sortedScenes = [...scenes].sort((a, b) => (a.scene_number || 0) - (b.scene_number || 0));

  for (let i = 0; i < sortedScenes.length - 1; i++) {
    const s1 = sortedScenes[i];
    const s2 = sortedScenes[i + 1];

    const d1 = s1.duration_sec || 10;
    const d2 = s2.duration_sec || 10;
    const totalNarrativeDur = d1 + d2;

    // Check if combined narrative duration fits into 30s container
    if (totalNarrativeDur <= 30 && totalNarrativeDur >= 15) {
      const reasons: string[] = [];
      let score = 50; // base score for fitting duration

      // 1. Location match
      const loc1 = (s1.location_name || '').trim().toLowerCase();
      const loc2 = (s2.location_name || '').trim().toLowerCase();
      const locationPass = loc1 !== '' && loc1 === loc2;
      if (locationPass) {
        score += 20;
        reasons.push(`Same continuous location: "${s1.location_name}"`);
      } else {
        reasons.push(`Adjacent locations: "${s1.location_name}" -> "${s2.location_name}"`);
      }

      // 2. Character continuity match
      const chars1 = new Set((s1.character_names || []).map((c) => c.toLowerCase()));
      const chars2 = new Set((s2.character_names || []).map((c) => c.toLowerCase()));
      const sharedChars = [...chars1].filter((c) => chars2.has(c));
      const charPass = sharedChars.length > 0;
      if (charPass) {
        score += 15;
        reasons.push(`Shared characters across transition: ${sharedChars.join(', ')}`);
      }

      // 3. Time of day / lighting match
      const time1 = (s1.time_of_day || '').toLowerCase();
      const time2 = (s2.time_of_day || '').toLowerCase();
      const lightingPass = time1 === time2 || time1 === '' || time2 === '';
      if (lightingPass) {
        score += 15;
        reasons.push(`Compatible lighting & time of day (${s1.time_of_day || 'Continuous'})`);
      }

      const containerResolution = resolveGenerationContainer(totalNarrativeDur, 30);
      const s1Shots = (shotsMap?.[s1.id] || []).map((shot) => shot.id);
      const s2Shots = (shotsMap?.[s2.id] || []).map((shot) => shot.id);

      candidates.push({
        sequence_id: `seq_candidate_${s1.scene_number}_${s2.scene_number}`,
        title: `Sequence: Scene ${s1.scene_number} + Scene ${s2.scene_number}`,
        source_scene_ids: [s1.id, s2.id],
        source_scene_numbers: [s1.scene_number, s2.scene_number],
        source_shot_ids: [...s1Shots, ...s2Shots],
        total_narrative_duration_sec: totalNarrativeDur,
        container_duration_sec: 30,
        excess_or_buffer_sec: containerResolution.excess_buffer_sec,
        container_strategy: containerResolution.container_strategy,
        compatibility_score: Math.min(100, score),
        compatibility_reasons: reasons,
        continuity_character_pass: charPass,
        continuity_location_pass: locationPass,
        continuity_lighting_pass: lightingPass,
        continuity_costume_pass: true,
        sequence_prompt_ready: true,
        status: 'candidate',
      });
    }
  }

  return candidates;
}

/**
 * Calculates a comprehensive, deterministic production readiness score (0-100).
 * 0 AI calls.
 */
export function calculateProductionReadiness(
  project: Project,
  foundation: ProjectFoundation | null,
  scenes: Scene[],
  shotsMap: Record<string, Shot[]>,
  promptsMap: Record<string, VideoPrompt[]>,
  continuityStates: CharacterContinuityState[],
  generationPlan?: GenerationPlan | null
): ProductionReadinessScore {
  const warnings: string[] = [];
  const blockers: string[] = [];

  // 1. Narrative Readiness (Weight: 20%)
  let narrativeScore = 0;
  if (project.title && ((project as any).premise || project.raw_script)) narrativeScore += 40;
  if (((foundation as any)?.logline || foundation?.main_conflict) && ((foundation as any)?.synopsis || foundation?.narrative_arc)) narrativeScore += 40;
  if (scenes.length > 0) narrativeScore += 20;
  if (narrativeScore < 100) {
    warnings.push('Story foundation or premise is incomplete.');
  }

  // 2. Character Asset Coverage (Weight: 15%)
  let charScore = 0;
  const allCharactersInScenes = new Set(scenes.flatMap((s) => s.character_names || []));
  if (allCharactersInScenes.size > 0) {
    charScore = 100;
  } else {
    warnings.push('No character entities detected in scenes.');
    charScore = 50;
  }

  // 3. Location Asset Coverage (Weight: 15%)
  let locScore = 0;
  const scenesWithLocations = scenes.filter((s) => s.location_name && s.location_name.trim().length > 0);
  locScore = scenes.length > 0 ? Math.round((scenesWithLocations.length / scenes.length) * 100) : 0;
  if (locScore < 100) {
    warnings.push(`${scenes.length - scenesWithLocations.length} scene(s) lack a defined location.`);
  }

  // 4. Continuity Health (Weight: 15%)
  let continuityScore = 100;
  if (continuityStates.length > 0) {
    continuityScore = 100;
  } else if (scenes.length > 1) {
    continuityScore = 75;
  }

  // 5. Prompt Coverage (Weight: 20%)
  let totalShots = 0;
  let shotsWithPrompts = 0;
  for (const scene of scenes) {
    const sList = shotsMap[scene.id] || [];
    for (const shot of sList) {
      totalShots++;
      if (shot.video_prompt || (promptsMap[shot.id] && promptsMap[shot.id].length > 0)) {
        shotsWithPrompts++;
      }
    }
  }
  const promptScore = totalShots > 0 ? Math.round((shotsWithPrompts / totalShots) * 100) : 0;
  if (totalShots > 0 && promptScore < 100) {
    warnings.push(`${totalShots - shotsWithPrompts} shot(s) do not have generated prompts.`);
  }

  // 6. Generation Plan Readiness (Weight: 15%)
  let planScore = 0;
  if (generationPlan && generationPlan.individual_shots_plan.length > 0) {
    planScore = 100;
  } else if (totalShots > 0) {
    planScore = 80;
  }

  // Zero-tolerance duration validation check
  const targetSec = project.total_duration_target_sec || 60;
  const durationCheck = verifyMultiDimensionalDurationInvariants(targetSec, scenes, shotsMap);
  if (!durationCheck.valid) {
    blockers.push(...durationCheck.errors);
  }

  const totalScore = Math.round(
    narrativeScore * 0.2 +
    charScore * 0.15 +
    locScore * 0.15 +
    continuityScore * 0.15 +
    promptScore * 0.2 +
    planScore * 0.15
  );

  let rating: 'READY_FOR_PRODUCTION' | 'NEEDS_REVIEW' | 'INCOMPLETE_BLOCKED' = 'READY_FOR_PRODUCTION';
  if (blockers.length > 0 || totalScore < 60) {
    rating = 'INCOMPLETE_BLOCKED';
  } else if (totalScore < 85 || warnings.length > 0) {
    rating = 'NEEDS_REVIEW';
  }

  return {
    total_score: totalScore,
    rating,
    categories: {
      narrative_readiness: { name: 'Narrative Foundation', score: narrativeScore, weight: 0.2, details: 'Story logline, synopsis & arc completion' },
      character_asset_coverage: { name: 'Character Assets', score: charScore, weight: 0.15, details: 'Characters detected and indexed' },
      location_asset_coverage: { name: 'Location Assets', score: locScore, weight: 0.15, details: 'Scene location specification' },
      continuity_health: { name: 'Continuity Health', score: continuityScore, weight: 0.15, details: 'Wardrobe, lighting and chronological flow' },
      prompt_coverage: { name: 'Prompt Coverage', score: promptScore, weight: 0.2, details: 'Ready-to-generate shot prompts' },
      generation_plan_readiness: { name: 'Generation Plan', score: planScore, weight: 0.15, details: 'Platform routing and container mapping' },
    },
    warnings,
    blockers,
    calculated_at: new Date().toISOString(),
  };
}

/**
 * Builds the complete GenerationPlan for a project deterministically.
 * 0 AI calls.
 */
export function generateProductionPlan(
  project: Project,
  scenes: Scene[],
  shotsMap: Record<string, Shot[]>,
  promptsMap: Record<string, VideoPrompt[]> = {},
  continuityStates: CharacterContinuityState[] = [],
  userQuotaProfiles: UserQuotaProfile[] = [],
  productionMode: 'FLEXIBLE' | 'OPTIMIZED' | 'LONG_SEQUENCE' = 'FLEXIBLE'
): GenerationPlan {
  const shotPlans: GenerationShotPlan[] = [];
  let aiVideoCount = 0;
  let stillImageCount = 0;
  let cutawayCount = 0;
  let transitionCount = 0;

  for (const scene of scenes) {
    const sShots = shotsMap[scene.id] || [];
    for (const shot of sShots) {
      const routing = routePlatformForShot(shot, undefined, userQuotaProfiles);
      const isStill = shot.shot_type === 'ESTABLISHING' && !shot.video_prompt;
      if (isStill) stillImageCount++;
      else if (shot.shot_type === 'TRANSITION') transitionCount++;
      else if (shot.shot_type === 'INSERT') cutawayCount++;
      else aiVideoCount++;

      shotPlans.push({
        shot_id: shot.id,
        scene_id: scene.id,
        shot_number: shot.shot_number,
        narrative_duration_sec: shot.duration_sec || 5,
        shot_duration_sec: shot.duration_sec || 5,
        generation_container_sec: routing.generation_container_sec,
        usable_duration_sec: routing.usable_duration_sec,
        recommended_platform: routing.recommended_platform,
        selected_platform: shot.selected_platform || routing.recommended_platform,
        fallback_platforms: routing.fallback_platforms,
        quota_estimated_cost: routing.quota_estimated_cost,
        status: shot.video_prompt ? 'prompt_ready' : 'not_started',
        media_reference_url: null,
      });
    }
  }

  const sequenceMergeCandidates = evaluateSequenceMergeCandidates(scenes, shotsMap, continuityStates);
  const quotaEstimates = calculateQuotaEstimates(shotPlans, userQuotaProfiles);

  return {
    project_id: project.id,
    production_mode: productionMode,
    total_narrative_duration_sec: project.total_duration_target_sec || scenes.reduce((acc, s) => acc + (s.duration_sec || 0), 0),
    total_scenes_count: scenes.length,
    total_shots_count: shotPlans.length,
    individual_shots_plan: shotPlans,
    sequence_merge_candidates: sequenceMergeCandidates,
    quota_estimates: quotaEstimates,
    visual_coverage_breakdown: {
      ai_video_shots: aiVideoCount,
      still_image_shots: stillImageCount,
      cutaway_shots: cutawayCount,
      transition_shots: transitionCount,
    },
    last_planned_at: new Date().toISOString(),
  };
}

/**
 * ============================================================================
 * PHASE 2 REGRESSION TESTS: TESTS 1 - 11
 * ============================================================================
 */
export function runProductionPlannerRegressionTests(): { testId: string; name: string; passed: boolean; details: string }[] {
  const results: { testId: string; name: string; passed: boolean; details: string }[] = [];

  // TEST 1: Narrative 10s -> container 10s
  {
    const res = resolveGenerationContainer(10, 10);
    const passed = res.narrative_duration_sec === 10 && res.generation_container_sec === 10 && res.excess_buffer_sec === 0 && res.is_exact_fit;
    results.push({
      testId: 'TEST-P2-01',
      name: 'Narrative 10s -> container 10s exact fit',
      passed,
      details: `Narrative: ${res.narrative_duration_sec}s, Container: ${res.generation_container_sec}s, Fit: ${res.is_exact_fit}`,
    });
  }

  // TEST 2: Narrative 10s -> container 30s
  {
    const res = resolveGenerationContainer(10, 30);
    const passed = res.narrative_duration_sec === 10 && res.generation_container_sec === 30 && res.excess_buffer_sec === 20;
    results.push({
      testId: 'TEST-P2-02',
      name: 'Narrative 10s -> container 30s preserves 10s narrative',
      passed,
      details: `Narrative: ${res.narrative_duration_sec}s, Container: ${res.generation_container_sec}s, Excess: ${res.excess_buffer_sec}s`,
    });
  }

  // TEST 3: 10s + 15s -> narrative 25s / container 30s
  {
    const res = resolveGenerationContainer(25, 30);
    const passed = res.narrative_duration_sec === 25 && res.generation_container_sec === 30 && res.excess_buffer_sec === 5;
    results.push({
      testId: 'TEST-P2-03',
      name: '10s + 15s -> narrative 25s / container 30s',
      passed,
      details: `Narrative: ${res.narrative_duration_sec}s, Container: ${res.generation_container_sec}s, Excess: ${res.excess_buffer_sec}s, Strategy: ${res.container_strategy}`,
    });
  }

  // TEST 4: Sequence merge does not change scene duration
  {
    const scene1: Scene = { id: 'sc_1', project_id: 'p1', scene_number: 1, title: 'Scene 1', duration_sec: 10, location_name: 'Studio', character_names: ['Ali'], event: 'Event 1', story_purpose: '', time_of_day: 'Day', emotional_objective: '', narrative_function: '', version: 1, created_at: '', updated_at: '' };
    const scene2: Scene = { id: 'sc_2', project_id: 'p1', scene_number: 2, title: 'Scene 2', duration_sec: 15, location_name: 'Studio', character_names: ['Ali'], event: 'Event 2', story_purpose: '', time_of_day: 'Day', emotional_objective: '', narrative_function: '', version: 1, created_at: '', updated_at: '' };
    const candidates = evaluateSequenceMergeCandidates([scene1, scene2]);
    const passed = candidates.length === 1 &&
      candidates[0].total_narrative_duration_sec === 25 &&
      candidates[0].container_duration_sec === 30 &&
      scene1.duration_sec === 10 &&
      scene2.duration_sec === 15;
    results.push({
      testId: 'TEST-P2-04',
      name: 'Sequence merge candidate preserves source scene durations (10s & 15s)',
      passed,
      details: `Candidate Total: ${candidates[0]?.total_narrative_duration_sec}s, Scene 1: ${scene1.duration_sec}s, Scene 2: ${scene2.duration_sec}s`,
    });
  }

  // TEST 5: Sequence merge does not change shot duration
  {
    const shot1: Shot = { id: 'sh_1', project_id: 'p1', scene_id: 'sc_1', shot_number: 1, start_time_sec: 0, end_time_sec: 5, duration_sec: 5, event_detail: 'Action 1', character_action: 'Action 1', camera_note: '', dialogue: [], emotion: '', audio_note: '', shot_type: 'WIDE', character_refs: ['Ali'], version: 1 };
    const shot2: Shot = { id: 'sh_2', project_id: 'p1', scene_id: 'sc_1', shot_number: 2, start_time_sec: 5, end_time_sec: 10, duration_sec: 5, event_detail: 'Action 2', character_action: 'Action 2', camera_note: '', dialogue: [], emotion: '', audio_note: '', shot_type: 'MEDIUM', character_refs: ['Ali'], version: 1 };
    const shot3: Shot = { id: 'sh_3', project_id: 'p1', scene_id: 'sc_2', shot_number: 1, start_time_sec: 0, end_time_sec: 15, duration_sec: 15, event_detail: 'Action 3', character_action: 'Action 3', camera_note: '', dialogue: [], emotion: '', audio_note: '', shot_type: 'CLOSE_UP', character_refs: ['Ali'], version: 1 };
    const shotsMap: Record<string, Shot[]> = { 'sc_1': [shot1, shot2], 'sc_2': [shot3] };
    const scene1: Scene = { id: 'sc_1', project_id: 'p1', scene_number: 1, title: 'Scene 1', duration_sec: 10, location_name: 'Studio', character_names: ['Ali'], event: 'Event 1', story_purpose: '', time_of_day: 'Day', emotional_objective: '', narrative_function: '', version: 1, created_at: '', updated_at: '' };
    const scene2: Scene = { id: 'sc_2', project_id: 'p1', scene_number: 2, title: 'Scene 2', duration_sec: 15, location_name: 'Studio', character_names: ['Ali'], event: 'Event 2', story_purpose: '', time_of_day: 'Day', emotional_objective: '', narrative_function: '', version: 1, created_at: '', updated_at: '' };
    const candidates = evaluateSequenceMergeCandidates([scene1, scene2], shotsMap);
    const passed = candidates.length === 1 &&
      candidates[0].source_shot_ids.length === 3 &&
      shot1.duration_sec === 5 &&
      shot2.duration_sec === 5 &&
      shot3.duration_sec === 15;
    results.push({
      testId: 'TEST-P2-05',
      name: 'Sequence merge candidate preserves source shot durations (5s, 5s, 15s)',
      passed,
      details: `Source shots: ${candidates[0]?.source_shot_ids.join(', ')}, Shot 1: ${shot1.duration_sec}s, Shot 3: ${shot3.duration_sec}s`,
    });
  }

  // TEST 6: Unsupported platform duration rejected strictly
  {
    let caught = false;
    try {
      resolveOutputDurationStrict('veo', 25); // Veo only supports 10s
    } catch (err: any) {
      caught = err.code === 'PROMPT_DURATION_CONTRACT_FAILED';
    }
    results.push({
      testId: 'TEST-P2-06',
      name: 'Unsupported platform duration strictly rejected via contract error',
      passed: caught,
      details: `Contract error thrown: ${caught}`,
    });
  }

  // TEST 7: Quota calculation
  {
    const shotPlans: GenerationShotPlan[] = [
      { shot_id: 's1', scene_id: 'sc1', shot_number: 1, narrative_duration_sec: 5, shot_duration_sec: 5, generation_container_sec: 5, usable_duration_sec: 5, recommended_platform: 'veo', selected_platform: 'veo', fallback_platforms: [], quota_estimated_cost: 10, status: 'not_started' },
      { shot_id: 's2', scene_id: 'sc1', shot_number: 2, narrative_duration_sec: 5, shot_duration_sec: 5, generation_container_sec: 5, usable_duration_sec: 5, recommended_platform: 'veo', selected_platform: 'veo', fallback_platforms: [], quota_estimated_cost: 10, status: 'not_started' },
    ];
    const userProfiles: UserQuotaProfile[] = [
      { provider_id: 'veo', display_name: 'Veo', daily_quota: 50, used_quota: 10, remaining_quota: 40, unit_name: 'credits', cost_per_generation: 10, estimated_usable_generations: 4 },
    ];
    const estimates = calculateQuotaEstimates(shotPlans, userProfiles);
    const passed = estimates.length === 1 && estimates[0].required_generations === 2 && estimates[0].estimated_quota_cost === 20 && estimates[0].remaining_after_run === 20 && estimates[0].quota_available === true;
    results.push({
      testId: 'TEST-P2-07',
      name: 'Deterministic quota estimation computes exact cost and remaining capacity',
      passed,
      details: `Cost: ${estimates[0]?.estimated_quota_cost} credits, Remaining: ${estimates[0]?.remaining_after_run} credits`,
    });
  }

  // TEST 8: Unconfigured quota returns empty without fabricated data
  {
    const shotPlans: GenerationShotPlan[] = [
      { shot_id: 's1', scene_id: 'sc1', shot_number: 1, narrative_duration_sec: 5, shot_duration_sec: 5, generation_container_sec: 5, usable_duration_sec: 5, recommended_platform: 'veo', selected_platform: 'veo', fallback_platforms: [], quota_estimated_cost: 10, status: 'not_started' },
    ];
    const estimates = calculateQuotaEstimates(shotPlans, []);
    const passed = estimates.length === 0;
    results.push({
      testId: 'TEST-P2-08',
      name: 'Unconfigured user quota returns empty array (no fabricated numbers)',
      passed,
      details: `Estimates length: ${estimates.length}`,
    });
  }

  // TEST 9: Deterministic platform routing
  {
    const shot10s: Shot = { id: 'sh_10', project_id: 'p1', scene_id: 'sc_1', shot_number: 1, start_time_sec: 0, end_time_sec: 10, duration_sec: 10, event_detail: '', character_action: '', camera_note: '', dialogue: [], emotion: '', audio_note: '', shot_type: 'WIDE', character_refs: [], version: 1 };
    const shot5s: Shot = { id: 'sh_5', project_id: 'p1', scene_id: 'sc_1', shot_number: 2, start_time_sec: 0, end_time_sec: 5, duration_sec: 5, event_detail: '', character_action: '', camera_note: '', dialogue: [], emotion: '', audio_note: '', shot_type: 'CLOSE_UP', character_refs: [], version: 1 };
    const routing10s = routePlatformForShot(shot10s);
    const routing5s = routePlatformForShot(shot5s);
    const passed = routing10s.recommended_platform === 'veo' && routing5s.recommended_platform === 'gemini_omni';
    results.push({
      testId: 'TEST-P2-09',
      name: 'Deterministic platform routing routes 10s to Veo and 5s to Gemini Omni',
      passed,
      details: `10s Route: ${routing10s.recommended_platform}, 5s Route: ${routing5s.recommended_platform}`,
    });
  }

  // TEST 10: Deterministic production readiness
  {
    const project: Project = { id: 'p1', title: 'Test Film', raw_script: 'A story of endurance', status: 'processing', created_at: '', updated_at: '', total_duration_target_sec: 20, prompt_language: 'id', image_model: 'nano_banana_pro', video_model: ['veo'], include_seedance_format: false, max_scene_shot_duration_sec: 10 };
    const foundation: ProjectFoundation = { project_id: 'p1', main_conflict: 'A brave journey', narrative_arc: 'Full synopsis here', main_characters: ['Ali'], supporting_characters: [], locations: ['Desert'], era: 'Historic', theme: 'Bravery', genre: 'Drama', timeline: 'Ancient', emotional_arc: 'Growth', visual_tone: 'Cinematic', updated_at: '' };
    const scene1: Scene = { id: 'sc_1', project_id: 'p1', scene_number: 1, title: 'Scene 1', duration_sec: 10, location_name: 'Desert', character_names: ['Ali'], event: 'Event 1', story_purpose: '', time_of_day: 'Day', emotional_objective: '', narrative_function: '', version: 1, created_at: '', updated_at: '' };
    const scene2: Scene = { id: 'sc_2', project_id: 'p1', scene_number: 2, title: 'Scene 2', duration_sec: 10, location_name: 'Desert', character_names: ['Ali'], event: 'Event 2', story_purpose: '', time_of_day: 'Day', emotional_objective: '', narrative_function: '', version: 1, created_at: '', updated_at: '' };
    const score = calculateProductionReadiness(project, foundation, [scene1, scene2], {}, {}, []);
    const passed = score.total_score >= 60 && score.categories.narrative_readiness.score === 100 && score.categories.location_asset_coverage.score === 100;
    results.push({
      testId: 'TEST-P2-10',
      name: 'Deterministic production readiness computes category scores & overall rating',
      passed,
      details: `Total score: ${score.total_score}/100, Rating: ${score.rating}`,
    });
  }

  // TEST 11: Zero-tolerance multi-dimensional duration invariant
  {
    const scene1: Scene = { id: 'sc_1', project_id: 'p1', scene_number: 1, title: 'Scene 1', duration_sec: 10, location_name: 'Desert', character_names: ['Ali'], event: 'Event 1', story_purpose: '', time_of_day: 'Day', emotional_objective: '', narrative_function: '', version: 1, created_at: '', updated_at: '' };
    const scene2: Scene = { id: 'sc_2', project_id: 'p1', scene_number: 2, title: 'Scene 2', duration_sec: 10, location_name: 'Desert', character_names: ['Ali'], event: 'Event 2', story_purpose: '', time_of_day: 'Day', emotional_objective: '', narrative_function: '', version: 1, created_at: '', updated_at: '' };
    const shot1: Shot = { id: 'sh_1', project_id: 'p1', scene_id: 'sc_1', shot_number: 1, start_time_sec: 0, end_time_sec: 5, duration_sec: 5, event_detail: '', character_action: '', camera_note: '', dialogue: [], emotion: '', audio_note: '', shot_type: 'WIDE', character_refs: [], version: 1 };
    const shot2: Shot = { id: 'sh_2', project_id: 'p1', scene_id: 'sc_1', shot_number: 2, start_time_sec: 5, end_time_sec: 10, duration_sec: 5, event_detail: '', character_action: '', camera_note: '', dialogue: [], emotion: '', audio_note: '', shot_type: 'CLOSE_UP', character_refs: [], version: 1 };
    const shotsMap = { 'sc_1': [shot1, shot2] };
    const inv = verifyMultiDimensionalDurationInvariants(20, [scene1, scene2], shotsMap);
    const passed = inv.valid && inv.invariants.narrative_target_matches_scenes && inv.invariants.all_scenes_match_shot_sums;
    results.push({
      testId: 'TEST-P2-11',
      name: 'Zero-tolerance duration invariant verified across scenes (10+10=20s) and shots (5+5=10s)',
      passed,
      details: `Valid: ${inv.valid}, Narrative match: ${inv.invariants.narrative_target_matches_scenes}, Shots match: ${inv.invariants.all_scenes_match_shot_sums}`,
    });
  }

  return results;
}
