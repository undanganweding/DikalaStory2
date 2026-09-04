import { ModelCapability } from './capability_registry';
import { TaskIntentRecommendation } from './intelligence_router';
import { adaptiveOptimizer } from './adaptive_optimizer';
import { adaptiveMemoryService } from './adaptive_memory';
import { observabilityService } from './observability_service';

export interface DecisionFactor {
  factor: string;
  weight: number;
  score: number;
  explanation: string;
}

export interface RejectedCandidate {
  modelId: string;
  reason: string;
}

export interface DecisionExplanation {
  selectedModel: string;
  taskClass: string;
  confidence: number;
  factors: DecisionFactor[];
  rejectedCandidates: RejectedCandidate[];
  timestamp: number;
}

export interface CalibrationRecord {
  modelId: string;
  taskClass: string;
  totalDecisions: number;
  successfulDecisions: number;
  failedDecisions: number;
  reputationScore: number; // 0 - 100
  recentAccuracy: number; // 0 - 100
  driftDetected: boolean;
  lastUpdated: number;
}

class DecisionIntelligenceEngine {
  private calibrationStore: Map<string, CalibrationRecord> = new Map();

  private getCalibrationKey(modelId: string, taskClass: string): string {
    return `${modelId}:${taskClass}`;
  }

  public getCalibrationRecord(modelId: string, taskClass: string): CalibrationRecord {
    const key = this.getCalibrationKey(modelId, taskClass);
    const existing = this.calibrationStore.get(key);
    if (existing) return existing;

    const initial: CalibrationRecord = {
      modelId,
      taskClass,
      totalDecisions: 0,
      successfulDecisions: 0,
      failedDecisions: 0,
      reputationScore: 85, // baseline reputation
      recentAccuracy: 100,
      driftDetected: false,
      lastUpdated: Date.now(),
    };
    this.calibrationStore.set(key, initial);
    return initial;
  }

  public recordDecisionFeedback(
    modelId: string,
    taskClass: string,
    success: boolean,
    confidence: number = 80
  ): CalibrationRecord {
    const record = this.getCalibrationRecord(modelId, taskClass);
    record.totalDecisions += 1;
    record.lastUpdated = Date.now();

    if (success) {
      record.successfulDecisions += 1;
      // Test 1: Successful decision increases reputation (+ 3-5 points up to 100)
      const bonus = confidence > 70 ? 4 : 2;
      record.reputationScore = Math.min(100, record.reputationScore + bonus);
    } else {
      record.failedDecisions += 1;
      // Test 2: Failed high-confidence decision gets severe penalty
      const penalty = confidence >= 70 ? 25 : 10;
      record.reputationScore = Math.max(0, record.reputationScore - penalty);
    }

    // Calculate recent accuracy rate
    record.recentAccuracy = Math.round((record.successfulDecisions / record.totalDecisions) * 100);

    // Test 5: Drift detection logic (if failure rate > 30% after at least 3 decisions)
    if (record.totalDecisions >= 3 && record.failedDecisions / record.totalDecisions > 0.3) {
      record.driftDetected = true;
    } else {
      record.driftDetected = false;
    }

    this.calibrationStore.set(this.getCalibrationKey(modelId, taskClass), record);

    // Test 6: Record feedback to observability service
    observabilityService.recordTelemetry({
      traceId: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      spanId: `span_fb_${Date.now()}`,
      agentName: 'DecisionCalibrationEngine',
      taskType: taskClass,
      providerId: 'google',
      model: modelId,
      status: success ? 'success' : 'error',
      latencyMs: 0,
      decisionConfidence: confidence,
      decisionExplanation: `Feedback recorded for ${modelId} in ${taskClass}: success=${success}, reputation=${record.reputationScore}, drift=${record.driftDetected}`,
    });

    return record;
  }

  public getAccuracyScore(modelId: string, taskClass: string): number {
    const record = this.getCalibrationRecord(modelId, taskClass);
    // Drift penalty if drift detected
    if (record.driftDetected) {
      return Math.max(10, record.reputationScore - 30);
    }
    return record.reputationScore;
  }

  public calculateDecisionConfidence(
    selectedModelId: string,
    taskClass: string,
    winnerFinalScore: number,
    runnerUpFinalScore?: number
  ): number {
    const memoryRecord = adaptiveMemoryService.get(selectedModelId, taskClass);
    const sampleCount = memoryRecord ? memoryRecord.sampleCount : 0;

    // 1. Adaptive confidence from sample count (0 - 100)
    const adaptiveConfidence = Math.min(100, sampleCount * 5); // 20 samples = 100%

    // 2. Score Difference confidence: gap between winner and runner-up
    let scoreDiffConfidence = 80; // default when single candidate
    if (runnerUpFinalScore !== undefined) {
      const margin = Math.max(0, winnerFinalScore - runnerUpFinalScore);
      scoreDiffConfidence = Math.min(100, margin * 4 + 20); // gap of 20 = 100%
    }

    // 3. Sample Size confidence: 100% at 50+ samples
    const sampleSizeConfidence = Math.min(100, sampleCount * 2);

    // Formula: (adaptiveConfidence * 0.5) + (scoreDiffConfidence * 0.3) + (sampleSizeConfidence * 0.2)
    const confidence = Math.round(
      adaptiveConfidence * 0.5 +
      scoreDiffConfidence * 0.3 +
      sampleSizeConfidence * 0.2
    );

    return Math.max(1, Math.min(100, confidence));
  }

  public explainDecision(
    intent: TaskIntentRecommendation,
    allCandidates: ModelCapability[],
    eligibleCandidates: {
      candidate: ModelCapability;
      intentMatchScore: number;
      learningScore: number;
      adaptiveScore: number;
      finalScore: number;
    }[],
    selectedModelId: string
  ): DecisionExplanation {
    const winnerCandidate = eligibleCandidates.find(c => c.candidate.id === selectedModelId);
    const runnerUp = eligibleCandidates
      .filter(c => c.candidate.id !== selectedModelId)
      .sort((a, b) => b.finalScore - a.finalScore)[0];

    const taskClass = intent.taskClass || 'general_generation';

    if (!winnerCandidate) {
      return {
        selectedModel: selectedModelId,
        taskClass,
        confidence: 0,
        factors: [],
        rejectedCandidates: [],
        timestamp: Date.now(),
      };
    }

    const accuracyRecord = this.getCalibrationRecord(selectedModelId, taskClass);

    // Factors breakdown
    const factors: DecisionFactor[] = [
      {
        factor: 'Intent Match',
        weight: 40,
        score: winnerCandidate.intentMatchScore,
        explanation: `Matches required capabilities [${intent.requiredCapabilities.join(', ')}] and preferred tier '${intent.preferredTier}' for ${intent.complexity} complexity`,
      },
      {
        factor: 'Historical Memory',
        weight: 30,
        score: winnerCandidate.learningScore,
        explanation: `Historical EMA memory score for task class '${taskClass}' across past executions`,
      },
      {
        factor: 'Decision Calibration Accuracy',
        weight: 20,
        score: accuracyRecord.reputationScore,
        explanation: `Decision calibration reputation score for '${selectedModelId}' in task class '${taskClass}' (${accuracyRecord.recentAccuracy}% recent accuracy, drift: ${accuracyRecord.driftDetected})`,
      },
      {
        factor: 'Current Telemetry',
        weight: 10,
        score: winnerCandidate.adaptiveScore,
        explanation: `Recent real-time telemetry overall score for model '${selectedModelId}'`,
      },
    ];

    // Rejected candidates breakdown
    const rejectedCandidates: RejectedCandidate[] = [];

    for (const model of allCandidates) {
      if (model.id === selectedModelId) continue;

      // Check if rejected due to missing required capabilities
      const missingCap = intent.requiredCapabilities.find(
        req => !model.supportedCapabilities.includes(req)
      );

      if (missingCap) {
        rejectedCandidates.push({
          modelId: model.id,
          reason: `Missing required capability '${missingCap}'`,
        });
        continue;
      }

      // If eligible but received lower score
      const eligibleInfo = eligibleCandidates.find(c => c.candidate.id === model.id);
      if (eligibleInfo) {
        rejectedCandidates.push({
          modelId: model.id,
          reason: `Lower combined score (${eligibleInfo.finalScore}/100) compared to selected model (${winnerCandidate.finalScore}/100) for task class '${taskClass}'`,
        });
      } else {
        rejectedCandidates.push({
          modelId: model.id,
          reason: `Filtered out during capability or intent evaluation for task class '${taskClass}'`,
        });
      }
    }

    const confidence = this.calculateDecisionConfidence(
      selectedModelId,
      taskClass,
      winnerCandidate.finalScore,
      runnerUp ? runnerUp.finalScore : undefined
    );

    return {
      selectedModel: selectedModelId,
      taskClass,
      confidence,
      factors,
      rejectedCandidates,
      timestamp: Date.now(),
    };
  }

  public clearCalibrationStore(): void {
    this.calibrationStore.clear();
  }
}

export const decisionIntelligenceEngine = new DecisionIntelligenceEngine();
