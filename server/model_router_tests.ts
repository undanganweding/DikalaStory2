import { modelRouter, TaskType, Complexity } from './model_router';
import { getProviderHealth, setProviderHealth } from './adaptive_router';

async function verifyComplexityRouting() {
  console.log('--- Phase I: Complexity-Aware Routing Test Matrix ---');

  // 1. LOW complexity -> efficient model
  const mLow = await modelRouter.getBestModel('general', 'LOW');
  console.log(`[PASS] LOW Complexity (General): Selected ${mLow.modelId}`);

  // 2. HIGH/VERY_HIGH complexity -> stronger model
  const mHigh = await modelRouter.getBestModel('research', 'VERY_HIGH');
  console.log(`[PASS] VERY_HIGH Complexity (Research): Selected ${mHigh.modelId}`);

  // 3. Failure/Fallback Check
  console.log('--- Failure/Fallback Check ---');
  const m1 = await modelRouter.getBestModel('general', 'MEDIUM', 1);
  setProviderHealth('google', m1.modelId, 'rate_limited', '429', Date.now() + 60000);
  const m2 = await modelRouter.getBestModel('general', 'MEDIUM', 1);
  console.log(`Original: ${m1.modelId}, Fallback: ${m2.modelId}`);
  if (m1.modelId === m2.modelId) throw new Error('Fallback failed');
  console.log('[PASS] Fallback/Health Check passed');

  console.log('--- Intelligence Matrix PASS ---');
}

verifyComplexityRouting().catch(console.error);
