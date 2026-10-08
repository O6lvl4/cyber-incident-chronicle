import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData, validateData } from './data-status.mjs';
import { companyCount, filterIncidents, projectEvents } from '../src/lib/incidents.ts';
import { readUrl, writeUrl } from '../src/lib/urlState.ts';
import { MAX_LEVEL } from '../src/engine/zoom.ts';
const data = loadData();
const impacts = ['leak', 'outage', 'unauthorizedAccess'];
test('all sourced records pass data quality checks', () => assert.deepEqual(validateData(data), []));
test('reject duplicate IDs, unknown status and uncited updates', () => {
  const copy = structuredClone(data); copy.incidents.push(copy.incidents[0]); copy.incidents[0].disclosureStatus = 'accused';
  copy.incidents[0].timeline[0].sourceUrl = 'https://example.com/unsupported';
  const errors = validateData(copy).join(' ');
  for (const problem of ['duplicate id', 'unknown disclosure', 'timeline source']) assert.match(errors, new RegExp(problem));
});
test('timeline shows one marker per incident, whatever its impacts', () => {
  const events = projectEvents(data.incidents);
  assert.equal(events.length, data.incidents.length);
  assert.ok(events.every(e => e.threadId === 'incidents'));
  assert.equal(new Set(events.map(e => e.id)).size, events.length);
  assert.equal(new Set(events.map(e => e.incidentId)).size, data.incidents.length);
  assert.equal(companyCount([...data.incidents, data.incidents[0]]), companyCount(data.incidents));
  assert.ok(events.every(e => e.weight === 2));
});
test('confirmation status is independent of impact and method', () => {
  const matches = filterIncidents(data.incidents, impacts, 'possible', '');
  assert.ok(matches.length > 0); assert.ok(matches.every(i => i.disclosureStatus === 'possible'));
  assert.ok(filterIncidents(data.incidents, ['outage'], 'all', '').every(i => i.impactTypes.includes('outage')));
});
test('search includes company, summary and method; no match and no lane return empty', () => {
  assert.ok(filterIncidents(data.incidents, impacts, 'all', 'アスクル').length === 1);
  assert.equal(filterIncidents(data.incidents, impacts, 'all', 'zzzz-no-match').length, 0);
  assert.equal(filterIncidents(data.incidents, [], 'all', '').length, 0);
});
test('all possible counts remain explicitly possible rather than confirmed', () => {
  assert.ok(data.incidents.some(i => i.counts.some(c => c.status === 'possible')));
  assert.ok(data.incidents.every(i => Array.isArray(i.caveats) && i.caveats.length > 0));
});
test('URL round-trip preserves empty lanes, query, status and theme', () => {
  globalThis.location = { hash: '' }; globalThis.history = { replaceState: (_a, _b, value) => { location.hash = value; } };
  writeUrl({ view: 'list', level: 6, center: Date.parse('2026-03-12'), lanes: [], query: 'アスクル', status: 'possible', dark: false });
  assert.deepEqual(readUrl(), { view: 'list', level: 6, center: Date.parse('2026-03-12'), sel: undefined, lanes: [], query: 'アスクル', status: 'possible', dark: false });
});
test('untrusted URL values are bounded or ignored', () => {
  globalThis.location = { hash: '#l=999&t=bad&status=accused' };
  assert.equal(readUrl().level, MAX_LEVEL); assert.equal(readUrl().center, undefined); assert.equal(readUrl().status, undefined);
});
