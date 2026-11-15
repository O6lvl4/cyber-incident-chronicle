import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeIncidentEntities } from '../src/lib/incidentEntityLinks.ts';
import { INCIDENT_ENTITIES } from '../src/data/incident-entities-index.ts';
import { loadClassifications } from './classification-status.mjs';

test('browser index includes exactly the mappings independently loaded from all JSON shards', () => {
  assert.deepEqual(INCIDENT_ENTITIES, loadClassifications().links);
});
test('merging preserves every entity and its order without modifying inputs', () => {
  const parts = [{ first: ['b', 'a'] }, { second: ['c'] }];
  const before = structuredClone(parts);
  assert.deepEqual(mergeIncidentEntities(parts), { first: ['b', 'a'], second: ['c'] });
  assert.deepEqual(parts, before);
});
test('duplicate incident IDs fail even when their values agree', () => {
  for (const entities of [['a'], ['b']]) {
    assert.throws(() => mergeIncidentEntities([{ incident: ['a'] }, { incident: entities }]), /Duplicate incident entity mapping: incident/);
  }
});
