import { execFileSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './data-status.mjs';
import { loadClassifications, validateClassifications } from './classification-status.mjs';
import { DEFAULT_CLASSIFICATION, getAttack, getEntities, matchesClassification, normalizeClassification, summarizeAttacks } from '../src/lib/classification.ts';
import { filterIncidents as baseFilter } from '../src/lib/incidents.ts';
import { readUrl, writeUrl } from '../src/lib/urlState.ts';
const { incidents } = loadData();
const data = loadClassifications();
const filterIncidents = (items, impacts, status, query, classification = DEFAULT_CLASSIFICATION) => baseFilter(items, impacts, status, query).filter(item => matchesClassification(item, classification));
const impacts = ['leak', 'outage', 'unauthorizedAccess'];
const filters = values => ({ ...DEFAULT_CLASSIFICATION, ...values });
test('generated record indexes are up to date', () => {
  execFileSync(process.execPath, ['scripts/classification-index.mjs', '--check'], { cwd: new URL('../', import.meta.url), stdio: 'pipe' });
});
test('every incident has validated, cited entity and attack classifications', () => {
  assert.deepEqual(validateClassifications(data, incidents), []);
  assert.equal(Object.keys(data.attacks).length, incidents.length);
});
test('classification validator rejects missing evidence, unsupported enums and dangling references', () => {
  const copy = structuredClone(data);
  const first = incidents[0].id;
  copy.attacks[first].attackKind = 'invented';
  copy.attacks[first].sourceUrls = [];
  copy.links[first] = ['missing-entity'];
  const errors = validateClassifications(copy, incidents).join(' ');
  for (const expected of ['invalid attackKind', 'HTTPS evidence', 'unknown entity']) assert.ok(errors.includes(expected));
});
test('default filters preserve every original record, sorting and deduplication', () => {
  const results = filterIncidents(incidents, impacts, 'all', '');
  assert.equal(results.length, incidents.length);
  assert.equal(new Set(results.map(item => item.id)).size, incidents.length);
});
test('industry and listing conditions match the same target entity, not a parent or another victim', () => {
  for (const industry of ['manufacturing', 'it', 'media', 'unknown']) {
    for (const listingStatus of ['listed', 'unlisted', 'unknown']) {
      const result = filterIncidents(incidents, impacts, 'all', '', filters({ industry, listingStatus }));
      const expected = incidents.filter(item => getEntities(item.id).some(entity => entity.industry === industry && entity.listingStatus === listingStatus));
      assert.deepEqual(new Set(result.map(item => item.id)), new Set(expected.map(item => item.id)));
    }
  }
  const subsidiaries = incidents.filter(item => getEntities(item.id).every(entity => entity.listingStatus !== 'listed') && getEntities(item.id).some(entity => entity.listedParent));
  for (const item of subsidiaries) assert.equal(matchesClassification(item, filters({ listingStatus: 'listed' })), false);
});
test('attack and vector confidence are independently filtered and unknown is explicit', () => {
  for (const item of incidents) {
    const attack = getAttack(item.id);
    assert.equal(matchesClassification(item, filters({ attackKind: attack.attackKind, initialAccess: attack.initialAccess })), true);
    assert.equal(matchesClassification(item, filters({ attackKind: attack.attackKind, confidence: attack.attackKindStatus })), true);
    assert.equal(matchesClassification(item, filters({ initialAccess: attack.initialAccess, confidence: attack.initialAccessStatus })), true);
    if (attack.attackKindStatus !== attack.initialAccessStatus) {
      assert.equal(matchesClassification(item, filters({ attackKind: attack.attackKind, initialAccess: attack.initialAccess, confidence: attack.attackKindStatus })), false);
    }
  }
  assert.ok(incidents.some(item => getAttack(item.id).attackKind === 'unknown'));
});
test('all existing search, impact and status filters combine with classification', () => {
  const results = filterIncidents(incidents, ['outage'], 'confirmed', '', filters({ attackKind: 'ransomware', confidence: 'confirmed' }));
  assert.ok(results.length > 0);
  assert.ok(results.every(item => item.impactTypes.includes('outage') && item.disclosureStatus === 'confirmed' && getAttack(item.id).attackKind === 'ransomware' && getAttack(item.id).attackKindStatus === 'confirmed'));
  assert.equal(filterIncidents(incidents, [], 'all', '', filters({ attackKind: 'ransomware' })).length, 0);
  assert.equal(filterIncidents(incidents, impacts, 'all', 'no-such-incident-zz', filters({ attackKind: 'ransomware' })).length, 0);
});
test('attack summary uses selected incident denominator and separates possible and unknown', () => {
  const summary = summarizeAttacks(incidents);
  assert.equal(summary.total, incidents.length);
  assert.equal(summary.confirmedRansomware, incidents.filter(item => getAttack(item.id).attackKind === 'ransomware' && getAttack(item.id).attackKindStatus === 'confirmed').length);
  assert.equal(summary.possibleRansomware, incidents.filter(item => getAttack(item.id).attackKind === 'ransomware' && getAttack(item.id).attackKindStatus === 'possible').length);
  assert.equal(summary.unknown, incidents.filter(item => getAttack(item.id).attackKind === 'unknown').length);
  assert.deepEqual(summarizeAttacks([]), { total: 0, confirmedRansomware: 0, possibleRansomware: 0, unknown: 0 });
});
test('share URL round-trips classification; malformed values safely reset', () => {
  globalThis.location = { hash: '' };
  globalThis.history = { replaceState: (_a, _b, value) => { location.hash = value; } };
  const classification = filters({ industry: 'manufacturing', manufacturingType: 'electronics', listingStatus: 'listed', attackKind: 'ransomware', initialAccess: 'unknown', confidence: 'confirmed' });
  writeUrl({ classification, query: 'カシオ', status: 'confirmed', dark: true });
  assert.deepEqual(normalizeClassification(readUrl().classification), classification);
  globalThis.location.hash = '#industry=__proto__&listingStatus=all&attackKind=invented&confidence=constructor';
  assert.deepEqual(normalizeClassification(readUrl().classification ?? {}), DEFAULT_CLASSIFICATION);
  writeUrl({ classification: DEFAULT_CLASSIFICATION });
  assert.equal(location.hash, '#');
});
