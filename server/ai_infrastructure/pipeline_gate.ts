import { productionReadiness, ReadinessReport } from './production_readiness';
import { generationValidator, GenerationParams } from './generation_validator';

export interface GateResult {
  allowed: boolean;
  reason: string;
  readinessReport: ReadinessReport;
  generationValidation?: { valid: boolean; errors: string[] };
}

export const pipelineGate = {
  async evaluateAndGate(projectId: string, genParams?: GenerationParams): Promise<GateResult> {
    const readinessReport = await productionReadiness.evaluateReadiness(projectId);

    if (!readinessReport.isReady) {
      return {
        allowed: false,
        reason: `Production Gate BLOCKED ❌: ${readinessReport.blockers.join(' | ')}`,
        readinessReport,
      };
    }

    if (genParams) {
      const genValidation = generationValidator.validateGenerationParams(genParams);
      if (!genValidation.valid) {
        return {
          allowed: false,
          reason: `Generation Parameter Gate BLOCKED ❌: ${genValidation.errors.join(' | ')}`,
          readinessReport,
          generationValidation: genValidation,
        };
      }
    }

    return {
      allowed: true,
      reason: 'Production Gate PASSED ✅: All pre-production assets and parameters are fully ready for generation.',
      readinessReport,
    };
  },
};
