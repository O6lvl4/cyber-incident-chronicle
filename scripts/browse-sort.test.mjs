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
const evidence = (precision, label, startDate) => ({ precision, label, ...(startDate ? { startDate } : {}),
  note: '公表資料の記載を維持', sourceUrl: 'https://example.com/disclosure', reviewedDate: '2026-02-01' });
const eventSorts = [['attack', 'attack'], ['damage', 'damageConfirmed']];
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

for (const [sortKey, field] of eventSorts) {
  const withEvent = (id, date) => ({ ...incident(id, id), eventDates: { [field]: date } });

  test(`${sortKey} dates use the specified evidence field and period/approximate start dates`, () => {
    const records = [
      withEvent('period', { ...evidence('period', '2024年1月〜2025年12月', '2024-01-10'), endDate: '2025-12-31' }),
      withEvent('day', evidence('day', '2024年2月1日', '2024-02-01')),
      withEvent('approximate', evidence('approximate', '2024年1月下旬頃', '2024-01-20')),
    ];
    const otherField = field === 'attack' ? 'damageConfirmed' : 'attack';
    records.forEach((item, index) => {
      item.announcementDate = `2026-0${3 - index}-01`;
      item.eventDates[otherField] = evidence('day', '別の日付', `2025-0${3 - index}-01`);
    });
    assert.deepEqual(ids(sortIncidents(records, `${sortKey}-asc`)), ['period', 'approximate', 'day']);
    assert.deepEqual(ids(sortIncidents(records, `${sortKey}-desc`)), ['day', 'approximate', 'period']);
  });

  test(`${sortKey} month/year evidence retains precision instead of inventing month or day values`, () => {
    const records = [
      withEvent('month-jp', evidence('month', '2023年2月（日不明）')),
      withEvent('year-jp', evidence('year', '2023年')),
      withEvent('day-feb', evidence('day', '2023年2月1日', '2023-02-01')),
      withEvent('month-iso', evidence('month', '2023-02')),
      withEvent('year-iso', evidence('year', '2023')),
      withEvent('month-jan', evidence('month', '2023年1月')),
      withEvent('day-jan', evidence('day', '2023年1月1日', '2023-01-01')),
      withEvent('older', evidence('day', '2022年12月31日', '2022-12-31')),
      withEvent('newer', evidence('year', '2024年')),
    ];
    const snapshot = structuredClone(records);
    records.forEach(item => { Object.freeze(item.eventDates[field]); Object.freeze(item.eventDates); Object.freeze(item); });
    Object.freeze(records);
    assert.deepEqual(ids(sortIncidents(records, `${sortKey}-asc`)),
      ['older', 'year-iso', 'year-jp', 'month-jan', 'day-jan', 'month-iso', 'month-jp', 'day-feb', 'newer']);
    assert.deepEqual(ids(sortIncidents(records, `${sortKey}-desc`)),
      ['newer', 'day-feb', 'month-iso', 'month-jp', 'day-jan', 'month-jan', 'year-iso', 'year-jp', 'older']);
    assert.deepEqual(records, snapshot);
    assert.ok(records.filter(item => ['month', 'year'].includes(item.eventDates[field].precision))
      .every(item => !Object.hasOwn(item.eventDates[field], 'startDate')));
    assert.ok(sortIncidents(records, `${sortKey}-asc`).every(item => records.includes(item)));
  });

  test(`${sortKey} missing, unknown, inapplicable and unparseable dates stay last without legacy fallbacks`, () => {
    const records = [
      withEvent('known-new', evidence('day', '2024年2月1日', '2024-02-01')),
      withEvent('known-old', evidence('day', '2024年1月1日', '2024-01-01')),
      incident('missing', 'ア社'),
      { ...incident('missing-field', 'ア社'), eventDates: {} },
      withEvent('unknown', evidence('unknown', '未公表', '2099-12-31')),
      withEvent('not-applicable', evidence('notApplicable', '該当なし', '1900-01-01')),
      withEvent('invalid-day', evidence('day', '日付不明', 'not-a-date')),
      withEvent('day-no-start', evidence('day', '2023年2月1日')),
      withEvent('period-no-start', evidence('period', '2023年2月〜3月')),
      withEvent('approximate-no-start', evidence('approximate', '2023年2月頃')),
      withEvent('invalid-month', evidence('month', '2023年13月')),
      withEvent('inexact-month', evidence('month', '2023年2月頃')),
      withEvent('invalid-year', evidence('year', '2023年頃')),
    ];
    records.forEach(item => {
      item.occurredDate = '1900-01-01';
      item.detectedDate = '2099-12-31';
    });
    const missing = records.filter(item => !item.id.startsWith('known-')).map(item => item.id).sort();
    for (const direction of ['asc', 'desc']) {
      const expected = [...(direction === 'asc' ? ['known-old', 'known-new'] : ['known-new', 'known-old']), ...missing];
      assert.deepEqual(ids(sortIncidents(records, `${sortKey}-${direction}`)), expected);
      assert.deepEqual(ids(sortIncidents([...records].reverse(), `${sortKey}-${direction}`)), expected);
    }
  });

  test(`${sortKey} equal known dates use exact ID ties in either direction and input order`, () => {
    const records = ['a', 'é', 'Z', 'e\u0301', 'A'].map(id => withEvent(id, evidence('day', '2023年2月1日', '2023-02-01')));
    const expected = ['A', 'Z', 'a', 'e\u0301', 'é'];
    for (const direction of ['asc', 'desc']) {
      assert.deepEqual(ids(sortIncidents(records, `${sortKey}-${direction}`)), expected);
      assert.deepEqual(ids(sortIncidents([...records].reverse(), `${sortKey}-${direction}`)), expected);
    }
  });
}

test('event-date options expose both directions without changing incident sort defaults', () => {
  const options = INCIDENT_SORT_OPTIONS.map(option => option.value);
  for (const key of ['attack-asc', 'attack-desc', 'damage-asc', 'damage-desc']) {
    assert.ok(options.includes(key), `${key} is available`);
    assert.equal(normalizeIncidentSort(key), key);
  }
  assert.equal(normalizeIncidentSort(), 'published-desc');
  assert.equal(normalizeIncidentSort('detected-desc'), 'published-desc');
  assert.equal(normalizeIncidentSort('occurred-asc'), 'published-desc');
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
