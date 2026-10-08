import test from 'node:test';
import assert from 'node:assert/strict';
import { sortIncidents, sortPackages, sortAdvisories, INCIDENT_SORT_OPTIONS, PACKAGE_SORT_OPTIONS,
  ADVISORY_SORT_OPTIONS, normalizeIncidentSort, normalizePackageSort, normalizeAdvisorySort } from '../src/lib/browseSort.ts';
import { groupPackages, packageKey } from '../src/lib/packageGroups.ts';
import { filterVulnerabilities } from '../src/lib/vulnerabilities.ts';
import { VirtualListLayout } from '../src/lib/virtualList.ts';

const ids = items => items.map(item => item.id);
const keys = items => items.map(item => item.key);
const incident = (id, company, announcementDate = '2026-02-01') => ({ id, company, announcementDate });
const pkg = (ecosystem, packageName) => ({ ecosystem, packageName });
const advisory = (id, overrides = {}) => ({ id, aliases: [], title: id, publishedAt: '2026-02-01T00:00:00Z',
  withdrawnAt: null, severity: { label: 'high' }, affected: [pkg('npm', 'widget')],
  fixStatus: 'unknown', shard: '00', ...overrides });

test('incidents use public announcement dates, with both directions and exact ID ties', () => {
  const records = [incident('B', 'アルファ'), incident('A', 'ゼータ'),
    incident('new', 'ベータ', '2026-03-01'), incident('old', 'ガンマ', '2025-01-01')];
  records[2].occurredDate = '2020-01-01';
  records[3].occurredDate = '2026-04-01';
  assert.deepEqual(ids(sortIncidents(records)), ['new', 'A', 'B', 'old']);
  assert.deepEqual(ids(sortIncidents(records, 'published-asc')), ['old', 'A', 'B', 'new']);
  assert.deepEqual(ids(sortIncidents([...records].reverse())), ['new', 'A', 'B', 'old']);
});

test('company ordering uses Japanese names and deterministic ties in both directions', () => {
  const records = [incident('B', 'ア社'), incident('C', 'ウ社'), incident('A', 'ア社'), incident('D', 'イ社')];
  assert.deepEqual(ids(sortIncidents(records, 'company-asc')), ['A', 'B', 'D', 'C']);
  assert.deepEqual(ids(sortIncidents(records, 'company-desc')), ['C', 'D', 'A', 'B']);
  assert.deepEqual(ids(sortIncidents([...records].reverse(), 'company-desc')), ['C', 'D', 'A', 'B']);
});

test('all publication sorters compare instants, including offsets and differing precision', () => {
  const dates = ['2026-01-01T00:00:00.100000Z', '2026-01-01T09:00:00+09:00',
    '2026-01-01T00:00:00.100Z', '2025-12-31T22:00:00-03:00'];
  const records = dates.map((date, index) => advisory(['B', 'old', 'A', 'new'][index], { publishedAt: date,
    affected: [pkg('npm', ['b', 'old', 'a', 'new'][index])] }));
  const expected = ['new', 'A', 'B', 'old'];
  assert.deepEqual(ids(sortAdvisories(records)), expected);
  assert.deepEqual(ids(sortAdvisories(records, 'published-asc')), ['old', 'A', 'B', 'new']);
  assert.deepEqual(ids(sortIncidents(records.map(item => incident(item.id, item.id, item.publishedAt)))), expected);
  const groups = groupPackages(records);
  assert.deepEqual(sortPackages(groups).map(group => group.advisories[0].id), expected);
  assert.deepEqual(sortPackages(groups, 'latest-asc').map(group => group.advisories[0].id), ['old', 'A', 'B', 'new']);
});

test('package names sort both ways and ties retain exact package identity across ecosystems', () => {
  const groups = groupPackages([advisory('A', { affected: [pkg('npm', 'widget'), pkg('PyPI', 'widget'),
    pkg('npm', 'alpha'), pkg('npm', 'zebra')] })]);
  const ascending = [packageKey('npm', 'alpha'), packageKey('PyPI', 'widget'), packageKey('npm', 'widget'),
    packageKey('npm', 'zebra')];
  assert.deepEqual(keys(sortPackages(groups, 'name-asc')), ascending);
  const descending = [ascending[3], ascending[1], ascending[2], ascending[0]];
  assert.deepEqual(keys(sortPackages(groups, 'name-desc')), descending);
  assert.deepEqual(keys(sortPackages([...groups].reverse(), 'name-desc')), descending);
});

test('technical package names retain exact casing and punctuation in name order', () => {
  const groups = groupPackages([advisory('A', { affected: ['a', 'Z', '@scope/a', 'a-b', 'a_b', 'A']
    .map(name => pkg('npm', name)) })]);
  assert.deepEqual(sortPackages(groups, 'name-asc').map(group => group.packageName), ['@scope/a', 'A', 'Z', 'a', 'a-b', 'a_b']);
  assert.deepEqual(sortPackages(groups, 'name-desc').map(group => group.packageName), ['a_b', 'a-b', 'a', 'Z', 'A', '@scope/a']);
});

test('package counts use only current filtered, unique per-package advisories', () => {
  const alpha = pkg('npm', 'alpha');
  const beta = pkg('npm', 'beta');
  const gamma = pkg('npm', 'gamma');
  const records = [advisory('A', { affected: [alpha, alpha, beta] }), advisory('B', { affected: [beta] }),
    advisory('C', { affected: [gamma] }), advisory('old', { publishedAt: '2025-01-01T00:00:00Z', affected: [alpha] }),
    advisory('withdrawn', { withdrawnAt: '2026-03-01T00:00:00Z', affected: [alpha] })];
  records.push(records[0]);
  const filtered = filterVulnerabilities(records, 'npm', '', { year: '2026', lifecycle: 'active' });
  const groups = groupPackages(filtered, 'npm');
  assert.deepEqual(sortPackages(groups, 'count-desc').map(group => [group.packageName, group.advisories.length]),
    [['beta', 2], ['alpha', 1], ['gamma', 1]]);
  assert.deepEqual(sortPackages(groups, 'count-asc').map(group => [group.packageName, group.advisories.length]),
    [['alpha', 1], ['gamma', 1], ['beta', 2]]);
  assert.deepEqual(keys(sortPackages([...groups].reverse(), 'count-asc')), keys(sortPackages(groups, 'count-asc')));
});

test('severity uses categorical labels, never invents scores, and always leaves unknown last', () => {
  const records = [advisory('unknown-b', { severity: { label: 'unknown', cvss: [{ score: 10 }] } }),
    advisory('low', { severity: { label: 'low', cvss: [{ score: null }] } }),
    advisory('high-b'), advisory('critical', { severity: { label: 'critical', cvss: [] } }),
    advisory('medium', { severity: { label: 'medium', cvss: [{ score: 0 }] } }),
    advisory('high-a'), advisory('unknown-a', { severity: { label: 'unknown' } })];
  assert.deepEqual(ids(sortAdvisories(records, 'severity-desc')),
    ['critical', 'high-a', 'high-b', 'medium', 'low', 'unknown-a', 'unknown-b']);
  const ascending = ['low', 'medium', 'high-a', 'high-b', 'critical', 'unknown-a', 'unknown-b'];
  assert.deepEqual(ids(sortAdvisories(records, 'severity-asc')), ascending);
  assert.deepEqual(ids(sortAdvisories([...records].reverse(), 'severity-asc')), ascending);
});

test('exact identifier ties are independent of locale collation and input order', () => {
  const records = ['a', 'é', 'Z', 'e\u0301', 'A'].map(id => advisory(id));
  const expected = ['A', 'Z', 'a', 'e\u0301', 'é'];
  for (const { value } of ADVISORY_SORT_OPTIONS) {
    assert.deepEqual(ids(sortAdvisories(records, value)), expected);
    assert.deepEqual(ids(sortAdvisories([...records].reverse(), value)), expected);
  }
});

test('sorters preserve frozen input arrays and record identities, including nested group order', () => {
  const records = [advisory('Z'), advisory('A')];
  const groups = groupPackages(records);
  const incidents = [incident('Z', 'イ社'), incident('A', 'ア社')];
  groups.forEach(group => Object.freeze(group.advisories));
  const cases = [[sortIncidents, INCIDENT_SORT_OPTIONS, incidents], [sortPackages, PACKAGE_SORT_OPTIONS, groups],
    [sortAdvisories, ADVISORY_SORT_OPTIONS, records]];
  for (const [sorter, options, input] of cases) {
    const snapshot = structuredClone(input);
    Object.freeze(input);
    input.forEach(Object.freeze);
    for (const { value } of options) {
      const result = sorter(input, value);
      assert.notEqual(result, input);
      assert.deepEqual(new Set(result), new Set(input));
      assert.ok(result.every(item => input.includes(item)));
      assert.deepEqual(input, snapshot);
    }
  }
});

test('the whole sorted corpus remains available to every virtual window without a record cap', () => {
  const records = Array.from({ length: 18659 }, (_, index) => advisory(`A-${String(index).padStart(5, '0')}`,
    { publishedAt: new Date(Date.UTC(2000, 0, 1) + index * 86400000).toISOString() }));
  const sorted = sortAdvisories(records);
  const layout = new VirtualListLayout(ids(sorted), 100);
  const first = layout.range(0, 500, 0);
  const last = layout.range(layout.total - 500, 500, 0);
  assert.equal(sorted[first.start].id, 'A-18658');
  assert.equal(sorted[last.end - 1].id, 'A-00000');
  assert.equal(sorted.length, records.length);
  assert.equal(new Set(ids(sorted)).size, records.length);
  assert.equal(layout.indexOf('A-00050'), 18608);
});

test('empty corpora are safe and invalid dates do not outrank known publication dates', () => {
  for (const sort of [sortIncidents, sortPackages, sortAdvisories]) assert.deepEqual(sort([]), []);
  const records = [advisory('unknown-b', { publishedAt: '' }), advisory('known'),
    advisory('unknown-a', { publishedAt: 'not a date' })];
  for (const order of ['published-desc', 'published-asc']) {
    assert.deepEqual(ids(sortAdvisories(records, order)), ['known', 'unknown-a', 'unknown-b']);
  }
});

test('URL sort normalization accepts only the matching corpus keys and uses its default', () => {
  const cases = [[normalizeIncidentSort, INCIDENT_SORT_OPTIONS, 'published-desc'],
    [normalizePackageSort, PACKAGE_SORT_OPTIONS, 'latest-desc'],
    [normalizeAdvisorySort, ADVISORY_SORT_OPTIONS, 'published-desc']];
  const allKeys = [...INCIDENT_SORT_OPTIONS, ...PACKAGE_SORT_OPTIONS, ...ADVISORY_SORT_OPTIONS].map(option => option.value);
  for (const [normalize, options, fallback] of cases) {
    const allowed = options.map(option => option.value);
    for (const value of allowed) assert.equal(normalize(value), value);
    for (const value of [undefined, '', 'unknown', 'PUBLISHED-DESC', ...allKeys.filter(key => !allowed.includes(key))]) {
      assert.equal(normalize(value), fallback);
    }
  }
});
