import { CENTRAL_QUALITY_RULES } from './quality_rules';
import { AGENT_CONTRACTS } from './agent_contract';

export interface EvaluationResult {
  status: 'PASS' | 'WARNING' | 'REJECT';
  score: number;
  issues: string[];
  recommendations: string[];
  confidence: number;
}

export const evaluationEngine = {
  async evaluateAgentOutput(
    agentId: string,
    projectId: string,
    output: any,
    context?: any
  ): Promise<EvaluationResult> {
    const contract = AGENT_CONTRACTS[agentId];
    const issues: string[] = [];
    const recommendations: string[] = [];

    let parsedOutput = output;
    if (typeof output === 'string') {
      try {
        parsedOutput = JSON.parse(output);
      } catch {
        parsedOutput = { rawText: output };
      }
    }
    if (!parsedOutput || typeof parsedOutput !== 'object') {
      parsedOutput = { rawOutput: parsedOutput };
    }

    // 1. Contract Match Check (25%)
    let contractMatchScore = 100;
    if (contract) {
      const requiredFields = contract.inputSchema?.requiredFields || [];
      // Also check expected fields in output schema if applicable
      const expectedFields = contract.outputSchema?.expectedFields || [];
      
      let missingCount = 0;
      for (const field of expectedFields) {
        if (parsedOutput[field] === undefined && !parsedOutput.rawText) {
          missingCount++;
          issues.push(`Missing expected output field: '${field}'`);
        }
      }
      if (expectedFields.length > 0) {
        contractMatchScore = Math.max(0, 100 - (missingCount / expectedFields.length) * 100);
      }
    }

    // 2. Accuracy & Quality Rules (30%)
    let accuracyScore = 100;
    for (const rule of CENTRAL_QUALITY_RULES) {
      const res = rule.validationFunction(parsedOutput, context);
      if (!res.passed) {
        issues.push(`[${rule.category}] ${res.message || rule.description}`);
        if (rule.severity === 'CRITICAL' || rule.severity === 'ERROR') {
          accuracyScore -= 35;
        } else {
          accuracyScore -= 15;
        }
      }
    }
    accuracyScore = Math.max(0, accuracyScore);

    // 3. Consistency Check (25%)
    let consistencyScore = 100;
    if (context && context.conflictDetected) {
      consistencyScore = 40;
      issues.push('Memory consistency conflict detected.');
    }

    // 4. Confidence (20%)
    let confidence = parsedOutput.confidence !== undefined ? Number(parsedOutput.confidence) : 0.95;
    if (isNaN(confidence)) confidence = 0.90;
    const confidenceScore = confidence * 100;

    // Weighted Total Score Calculation
    // Accuracy 30%, Contract Match 25%, Consistency 25%, Confidence 20%
    const totalScore = Math.round(
      accuracyScore * 0.30 +
      contractMatchScore * 0.25 +
      consistencyScore * 0.25 +
      confidenceScore * 0.20
    );

    let status: 'PASS' | 'WARNING' | 'REJECT' = 'PASS';
    if (contractMatchScore === 0 || totalScore < 60 || issues.some(i => i.includes('Prohibited') || i.includes('conflict'))) {
      status = 'REJECT';
      recommendations.push('Review agent prompt instructions and ensure adherence to historical visual locks and required fields.');
    } else if (totalScore < 85 || issues.length > 0) {
      status = 'WARNING';
      recommendations.push('Proceed with warning; verify sources and check minor warnings.');
    } else {
      status = 'PASS';
    }

    return {
      status,
      score: totalScore,
      issues,
      recommendations,
      confidence: Math.round(confidence * 100) / 100,
    };
  },
};
