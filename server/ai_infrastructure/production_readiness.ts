import { productionContextManager } from './production_context';
import { assetIntelligence } from './asset_intelligence';

export interface ReadinessReport {
  isReady: boolean;
  score: number;
  blockers: string[];
  warnings: string[];
  details: {
    charactersReady: boolean;
    locationsReady: boolean;
    promptsComplete: boolean;
    budgetValid: boolean;
  };
}

export const productionReadiness = {
  async evaluateReadiness(projectId: string, estimatedCostUsd: number = 0.05, maxBudgetUsd: number = 10.0): Promise<ReadinessReport> {
    const state = await productionContextManager.getOrCreateProductionState(projectId);
    const blockers: string[] = [];
    const warnings: string[] = [];

    // Check characters
    const characterIds = Object.keys(state.characterState);
    if (characterIds.length === 0) {
      blockers.push('Missing Character definitions in production state.');
    }

    // Check assets via asset intelligence
    const assets = await assetIntelligence.getProjectAssets(projectId);
    const missingMasterFrames = characterIds.filter(id => {
      const asset = assets.find(a => a.assetId === `asset_char_${id}` || a.assetId === id);
      return !asset || asset.status !== 'READY';
    });

    if (missingMasterFrames.length > 0) {
      blockers.push(`Characters missing master frame reference: [${missingMasterFrames.join(', ')}] ❌`);
    }

    // Check scenes & locations
    const sceneIds = Object.keys(state.sceneState);
    if (sceneIds.length === 0) {
      blockers.push('Missing Scene definitions in production state.');
    }

    // Check prompt completeness (shot states)
    const shotIds = Object.keys(state.shotState);
    let promptsComplete = true;
    if (shotIds.length === 0) {
      warnings.push('No specific shot plans registered; will rely on default scene prompts.');
    } else {
      for (const sId of shotIds) {
        const shot = state.shotState[sId];
        if (!shot.cameraAngle || !shot.lightingTone) {
          promptsComplete = false;
          blockers.push(`Shot '${sId}' has incomplete camera angle or lighting specs ❌`);
        }
      }
    }

    // Check budget
    const budgetValid = estimatedCostUsd <= maxBudgetUsd;
    if (!budgetValid) {
      blockers.push(`Estimated cost ($${estimatedCostUsd}) exceeds allowed budget ($${maxBudgetUsd}) ❌`);
    }

    const charactersReady = characterIds.length > 0 && missingMasterFrames.length === 0;
    const locationsReady = sceneIds.length > 0;
    const isReady = blockers.length === 0;

    let score = 100;
    score -= blockers.length * 25;
    score -= warnings.length * 10;
    score = Math.max(0, score);

    return {
      isReady,
      score,
      blockers,
      warnings,
      details: {
        charactersReady,
        locationsReady,
        promptsComplete,
        budgetValid,
      },
    };
  },
};
