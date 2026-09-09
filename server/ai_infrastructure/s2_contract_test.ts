import assert from 'node:assert/strict';
import { safeParseJSON } from '../llm_provider';

const canonical = JSON.stringify({ characters: [{ name: 'Hasan Munadi' }] });
const topLevelArray = JSON.stringify([{ name: 'Hasan Munadi' }]);

function parseCanonical(raw: string) {
  const parsed = safeParseJSON<unknown>(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray((parsed as any).characters)) {
    throw new Error("S2 contract violation: expected object with 'characters' array");
  }
  return (parsed as any).characters;
}

assert.deepEqual(parseCanonical(canonical), [{ name: 'Hasan Munadi' }]);
assert.throws(() => parseCanonical(topLevelArray), /expected object with 'characters' array/);
console.log('canonical S2 schema = OBJECT');
console.log('characters field = ARRAY');
console.log('canonical object = ACCEPTED');
console.log('array-only response = REJECTED');
