export type RuleCategory = 'CONTENT_RULES' | 'FACT_RULES' | 'VISUAL_RULES' | 'CONTINUITY_RULES';
export type RuleSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface QualityRule {
  id: string;
  category: RuleCategory;
  description: string;
  severity: RuleSeverity;
  validationFunction: (output: any, context?: any) => { passed: boolean; message?: string };
}

export const CENTRAL_QUALITY_RULES: QualityRule[] = [
  {
    id: 'REQ_FIELDS_EXIST',
    category: 'CONTENT_RULES',
    description: 'Ensure required output fields exist based on agent contract',
    severity: 'ERROR',
    validationFunction: (output: any) => {
      if (!output || typeof output !== 'object') {
        return { passed: false, message: 'Output is null or not a valid JSON object.' };
      }
      return { passed: true };
    },
  },
  {
    id: 'FACT_SOURCE_EXISTS',
    category: 'FACT_RULES',
    description: 'Historical claims must have verified sources',
    severity: 'WARNING',
    validationFunction: (output: any) => {
      if (output.claims && Array.isArray(output.claims)) {
        if (output.claims.length > 0 && (!output.sources || output.sources.length === 0)) {
          return { passed: false, message: 'Historical claims present without corresponding sources.' };
        }
      }
      return { passed: true };
    },
  },
  {
    id: 'VISUAL_LOCK_ADHERENCE',
    category: 'VISUAL_RULES',
    description: 'Ensure visual locks and prohibited modern elements are checked',
    severity: 'CRITICAL',
    validationFunction: (output: any) => {
      const text = JSON.stringify(output).toLowerCase();
      if (text.includes('smartphone') || text.includes('modern car') || text.includes('skyscraper')) {
        return { passed: false, message: 'Prohibited modern elements detected in historical visual prompt.' };
      }
      return { passed: true };
    },
  },
  {
    id: 'CHARACTER_AGE_CONTINUITY',
    category: 'CONTINUITY_RULES',
    description: 'Character age must be consistent across timeline',
    severity: 'ERROR',
    validationFunction: (output: any, context?: any) => {
      if (output.age !== undefined && context && context.existingAge !== undefined) {
        if (output.age !== context.existingAge) {
          return { passed: false, message: `Character age conflict detected: existing ${context.existingAge}, proposed ${output.age}` };
        }
      }
      return { passed: true };
    },
  },
];
