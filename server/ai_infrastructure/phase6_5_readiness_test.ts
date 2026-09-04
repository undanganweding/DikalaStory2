import { productionContextManager } from './production_context';
import { assetIntelligence } from './asset_intelligence';
import { productionReadiness } from './production_readiness';
import { generationValidator } from './generation_validator';
import { pipelineGate } from './pipeline_gate';

async function runPhase6_5Tests() {
  console.log('Running Phase 6.5 Production Readiness & Asset Intelligence Tests...');

  const projectId = 'proj_readiness_test_01';
  await productionContextManager.getOrCreateProductionState(projectId, 'The Makkah Epics');

  // 1. Test unready project (Missing character, missing scene)
  const initialReport = await productionReadiness.evaluateReadiness(projectId);
  console.log('Initial Readiness Report (Expected Blocked):', initialReport);
  if (initialReport.isReady) {
    throw new Error('Test Failed: Unready project evaluated as ready');
  }
  console.log('✅ 1. Unready project correctly blocked.');

  // 2. Add character and scene, but leave asset missing -> should still block on missing master frame
  await productionContextManager.updateProductionState(projectId, state => {
    state.characterState['char_prophet'] = {
      name: 'Prophet',
      age: 40,
      era: '6th Century',
      visualLock: 'lock_prophet_01',
      traits: ['Honest', 'Wise'],
    };
    state.sceneState['scene_01'] = {
      sceneNumber: 1,
      title: 'Makkah 570 CE',
      setting: 'Streets of Makkah',
      mood: 'Atmospheric',
      beats: ['Market bustle'],
    };
  });

  const reportMissingAsset = await productionReadiness.evaluateReadiness(projectId);
  if (reportMissingAsset.isReady) {
    throw new Error('Test Failed: Project missing master frame evaluated as ready');
  }
  console.log('✅ 2. Missing master frame asset correctly detected and blocked.');

  // 3. Register asset as READY
  await assetIntelligence.registerAsset({
    assetId: 'asset_char_char_prophet',
    projectId,
    name: 'Prophet Master Frame',
    type: 'MASTER_FRAME',
    status: 'READY',
    metadata: {},
  });

  const reportReady = await productionReadiness.evaluateReadiness(projectId);
  console.log('Ready Report:', reportReady);
  if (!reportReady.isReady) {
    throw new Error('Test Failed: Fully populated project reported not ready');
  }
  console.log('✅ 3. Fully populated project successfully evaluated as READY.');

  // 4. Test Generation Validator
  const invalidGen = generationValidator.validateGenerationParams({
    prompt: 'short',
    negativePrompt: 'blur',
    durationSec: 120, // out of bounds
    fps: 24,
    resolution: '8K', // invalid
  });
  if (invalidGen.valid) {
    throw new Error('Test Failed: Invalid generation params passed validation');
  }
  console.log('✅ 4. Generation validator correctly caught invalid parameters.');

  // 5. Test Pipeline Gate
  const gateResult = await pipelineGate.evaluateAndGate(projectId, {
    prompt: 'Cinematic wide shot of Makkah in 570 CE, golden hour lighting, masterpiece 8k',
    negativePrompt: 'modern buildings, cars',
    durationSec: 10,
    fps: 24,
    resolution: '1080p',
  });

  console.log('Pipeline Gate Result:', gateResult);
  if (!gateResult.allowed) {
    throw new Error('Test Failed: Pipeline gate blocked valid generation request');
  }
  console.log('✅ 5. Pipeline Gate successfully allowed ready generation.');

  console.log('🎉 All Phase 6.5 Production Readiness & Asset Intelligence tests passed successfully!');
}

runPhase6_5Tests().catch(err => {
  console.error('❌ Phase 6.5 Test Error:', err);
  process.exit(1);
});
