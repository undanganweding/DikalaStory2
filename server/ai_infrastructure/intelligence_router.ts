import { ModelCapability } from './capability_registry';
import { adaptiveOptimizer } from './adaptive_optimizer';
import { decisionIntelligenceEngine, DecisionExplanation } from './decision_intelligence';
import { taskRegistry } from './task_registry';

export interface TaskIntentRecommendation {
  taskClass: string;
  stageCode?: string;
  complexity: 'low' | 'medium' | 'high';
  requiredCapabilities: string[];
  preferredTier: 'flash' | 'pro' | 'ultra';
  minContextWindow?: number;
  outputFormat?: string;
  qualityPriority?: string;
}

/**
 * Classifies task requirements into abstract intent metadata.
 * Prioritizes the authoritative AI Task Registry before heuristic fallback.
 * Does NOT select or hardcode any concrete model_id.
 */
export function classifyTaskRequirements(task?: string): TaskIntentRecommendation {
  if (task) {
    const registeredTask = taskRegistry.getTask(task);
    if (registeredTask) {
      let complexity: 'low' | 'medium' | 'high' = 'medium';
      if (registeredTask.qualityPriority === 'critical') complexity = 'high';
      else if (registeredTask.qualityPriority === 'fast') complexity = 'low';

      return {
        taskClass: registeredTask.id,
        stageCode: registeredTask.stageCode,
        complexity,
        requiredCapabilities: [...registeredTask.requiredCapabilities],
        preferredTier: registeredTask.preferredTier === 'ultra' ? 'ultra' : registeredTask.preferredTier === 'pro' ? 'pro' : 'flash',
        minContextWindow: registeredTask.minContextWindow,
        outputFormat: registeredTask.outputFormatRequirement,
        qualityPriority: registeredTask.qualityPriority,
      };
    }
  }

  const normalizedTask = (task || '').toLowerCase().trim();

  if (
    normalizedTask.includes('reasoning') ||
    normalizedTask.includes('breakdown') ||
    normalizedTask.includes('analysis') ||
    normalizedTask.includes('stage')
  ) {
    return {
      taskClass: 'cinematic_reasoning',
      complexity: 'high',
      requiredCapabilities: ['text', 'reasoning'],
      preferredTier: 'pro',
    };
  }

  if (
    normalizedTask.includes('code') ||
    normalizedTask.includes('schema') ||
    normalizedTask.includes('json') ||
    normalizedTask.includes('structured')
  ) {
    return {
      taskClass: 'structured_generation',
      complexity: 'medium',
      requiredCapabilities: ['text', 'structured_output'],
      preferredTier: 'pro',
    };
  }

  if (
    normalizedTask.includes('creative') ||
    normalizedTask.includes('prompt') ||
    normalizedTask.includes('story') ||
    normalizedTask.includes('narrative')
  ) {
    return {
      taskClass: 'creative_generation',
      complexity: 'medium',
      requiredCapabilities: ['text', 'creative'],
      preferredTier: 'flash',
    };
  }

  return {
    taskClass: 'general_generation',
    complexity: 'low',
    requiredCapabilities: ['text'],
    preferredTier: 'flash',
  };
}

export interface RankedCandidateResult {
  modelId: string;
  adaptiveScore?: number;
  learningScore?: number;
  confidenceScore?: number;
  optimizationReason?: string;
  decisionExplanation?: DecisionExplanation;
}

/**
 * Ranks candidate models dynamically based on task intent recommendations,
 * capability matching, historical adaptive memory, and current telemetry scores.
 */
export function rankCandidatesForIntent(
  intent: TaskIntentRecommendation,
  candidatesInput: ModelCapability[] | Record<string, any>
): RankedCandidateResult | undefined {
  if (!candidatesInput) return undefined;

  let candidates: ModelCapability[];
  if (Array.isArray(candidatesInput)) {
    candidates = candidatesInput;
  } else if (typeof candidatesInput === 'object') {
    candidates = Object.values(candidatesInput).map((item: any) => ({
      id: item.id || item.name,
      name: item.name || item.id,
      providerId: item.providerId || 'google',
      supportedCapabilities: item.supportedCapabilities || (item.requiredCapability ? ['text', item.requiredCapability, 'reasoning', 'structured_output', 'creative'] : ['text', 'reasoning', 'structured_output', 'creative']),
      costPer1kInputTokens: item.costPer1kInputTokens || 0.001,
      costPer1kOutputTokens: item.costPer1kOutputTokens || 0.004,
      tier: item.tier || (item.id.includes('pro') ? 'pro' : 'flash'),
    }));
  } else {
    return undefined;
  }

  if (!candidates || candidates.length === 0) return undefined;

  // STEP 1: Capability Match (STRICT FIRST FILTER - prevents invalid models)
  const eligible = candidates.filter(candidate =>
    intent.requiredCapabilities.every(reqCap => candidate.supportedCapabilities.includes(reqCap))
  );

  if (eligible.length === 0) return undefined;

  // STEP 2: Calculate intent match, historical learning memory, calibration accuracy, and current telemetry scores
  const scored = eligible.map(candidate => {
    let intentMatchScore = 50;

    // Tier alignment score
    if (candidate.tier === intent.preferredTier) {
      intentMatchScore += 30;
    } else if (intent.preferredTier === 'pro' && candidate.tier === 'ultra') {
      intentMatchScore += 20;
    } else if (intent.preferredTier === 'flash' && candidate.tier === 'pro') {
      intentMatchScore += 10;
    }

    // Complexity alignment
    if (intent.complexity === 'high') {
      if (candidate.supportedCapabilities.includes('reasoning')) intentMatchScore += 20;
    } else if (intent.complexity === 'low') {
      const totalCost = (candidate.costPer1kInputTokens || 0.001) + (candidate.costPer1kOutputTokens || 0.004);
      intentMatchScore += Math.max(0, 20 - totalCost * 1000);
    } else {
      intentMatchScore += 10;
    }

    intentMatchScore = Math.min(100, intentMatchScore);

    // Get historical adaptive performance score from AdaptiveOptimizer
    const perfScore = adaptiveOptimizer.calculateModelScore(candidate.id, intent.taskClass);

    // Get decision calibration reputation score
    const accuracyScore = decisionIntelligenceEngine.getAccuracyScore(candidate.id, intent.taskClass);

    // Weighted Formula:
    // Intent Match: 40%
    // Historical Memory (learningScore): 30%
    // Calibration Accuracy (reputationScore): 20%
    // Current Telemetry (overallScore): 10%
    const finalScore = Math.round(
      intentMatchScore * 0.40 +
      perfScore.learningScore * 0.30 +
      accuracyScore * 0.20 +
      perfScore.overallScore * 0.10
    );

    return {
      candidate,
      intentMatchScore,
      learningScore: perfScore.learningScore,
      adaptiveScore: perfScore.overallScore,
      accuracyScore,
      confidenceScore: perfScore.confidenceScore,
      finalScore,
    };
  });

  // Sort descending by finalScore
  scored.sort((a, b) => b.finalScore - a.finalScore);
  const best = scored[0];

  if (!best) return undefined;

  const decisionExplanation = decisionIntelligenceEngine.explainDecision(
    intent,
    candidates,
    scored,
    best.candidate.id
  );

  return {
    modelId: best.candidate.id,
    adaptiveScore: best.adaptiveScore,
    learningScore: best.learningScore,
    confidenceScore: best.confidenceScore,
    optimizationReason: `Selected based on task intent match (40%), historical learning memory (${best.learningScore}/100, 30%), calibration accuracy (${best.accuracyScore}/100, 20%), and current telemetry (${best.adaptiveScore}/100, 10%)`,
    decisionExplanation,
  };
}

