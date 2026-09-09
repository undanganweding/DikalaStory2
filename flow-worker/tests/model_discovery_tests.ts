import { strict as assert } from 'node:assert';
import { extractVerifiedModels } from '../browser/model_discovery';

const valid = extractVerifiedModels([{ text: 'Veo 3', attributes: { 'data-model-id': 'veo-3' }, path: 'button' }]);
assert.deepEqual(valid.models, [{ id: 'veo-3', displayName: 'Veo 3', capabilities: ['MODEL_DISCOVERY'] }]);

const artifact = extractVerifiedModels([{ text: 'model!\n\nTry Om', attributes: {}, path: 'div' }]);
assert.deepEqual(artifact.models, []);

const empty = extractVerifiedModels([]);
assert.deepEqual(empty.models, []);
assert.deepEqual(extractVerifiedModels([{ text: 'Veo 3', attributes: { 'data-model-id': 'veo-3' }, path: 'button' }]), valid);

console.log('Model discovery tests passed');
