import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { groupPackages, packageKey, parsePackageKey } from '../src/lib/packageGroups.ts';
import { filterVulnerabilities } from '../src/lib/vulnerabilities.ts';
import { ADVISORY_PAGE_SIZE, paginate } from '../src/lib/pagination.ts';

const coordinate = (ecosystem, packageName) => ({ ecosystem, packageName });
const advisory = (id, affected, overrides = {}) => ({ id, aliases: [], title: `Advisory ${id}`,
  publishedAt: '2026-01-02T00:00:00Z', modifiedAt: '2026-01-02T00:00:00Z', withdrawnAt: null, affected,
  severity: { label: 'high' }, fixStatus: 'unknown', shard: '00', ...overrides });
const groupIds = group => group.advisories.map(item => item.id);

test('exact package identity separates ecosystems, casing, punctuation and unknown values', () => {
  const coordinates = [coordinate('npm', 'Widget'), coordinate('npm', 'widget'), coordinate('PyPI', 'widget'),
    coordinate('NPM', 'widget'), coordinate('unknown', 'widget'), coordinate('', 'widget'),
    coordinate('npm', 'widget-core'), coordinate('npm', 'widget_core'), coordinate('npm', 'widget.core')];
  const groups = groupPackages([advisory('A', coordinates)]);
  assert.equal(groups.length, coordinates.length);
  assert.equal(new Set(groups.map(group => group.key)).size, coordinates.length);
  for (const pkg of coordinates) assert.ok(groups.some(group => group.key === packageKey(pkg.ecosystem, pkg.packageName)));
});

test('tuple keys round-trip URL encoding of scoped npm, Maven and Go package names', () => {
  const coordinates = [coordinate('npm', '@Scope/widget'), coordinate('Maven', 'org.example:widget-core'),
    coordinate('Go', 'github.com/Owner/project/v2'), coordinate('npm', 'pkg+name#tag?x=y&z=%'),
    coordinate('custom', 'a,"quoted"/包'), coordinate('a:b', 'c'), coordinate('a', 'b:c')];
  const keys = coordinates.map(pkg => packageKey(pkg.ecosystem, pkg.packageName));
  assert.equal(new Set(keys).size, coordinates.length);
  for (const [index, pkg] of coordinates.entries()) {
    const params = new URLSearchParams({ package: keys[index] });
    assert.deepEqual(parsePackageKey(new URLSearchParams(params.toString()).get('package')), pkg);
    assert.equal(keys[index], JSON.stringify([pkg.ecosystem, pkg.packageName]));
  }
  for (const key of [undefined, '', 'null', '{}', '[]', '["npm"]', '["npm",1]', '["npm","a","b"]', 'npm:a']) {
    assert.equal(parsePackageKey(key), undefined);
  }
});

test('duplicate package entries and repeated advisory IDs count only once per package', () => {
  const npm = coordinate('npm', 'shared');
  const python = coordinate('PyPI', 'shared');
  const first = advisory('A', [npm, npm, python]);
  const second = advisory('B', [npm]);
  const groups = groupPackages([first, second, first]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groupIds(groups.find(group => group.ecosystem === 'npm')), ['A', 'B']);
  assert.deepEqual(groupIds(groups.find(group => group.ecosystem === 'PyPI')), ['A']);
  assert.equal(new Set(groups.flatMap(groupIds)).size, 2);
  assert.equal(groups.reduce((sum, group) => sum + group.advisories.length, 0), 3);
  assert.equal(groups.find(group => group.ecosystem === 'npm').severityCounts.high, 2);
  assert.equal(groups.find(group => group.ecosystem === 'PyPI').severityCounts.high, 1);
});

test('highest severity and its complete breakdown use only source categorical labels', () => {
  const pkg = coordinate('npm', 'severity-mix');
  const records = ['unknown', 'low', 'medium', 'high', 'critical', 'high'].map((label, index) =>
    advisory(`A-${index}`, [pkg], { severity: { label, cvss: [{ score: label === 'unknown' ? 10 : 0 }] },
      exploitation: { status: 'reported' }, kev: { status: 'listed' } }));
  const group = groupPackages(records)[0];
  assert.equal(group.highestSeverity, 'critical');
  assert.deepEqual(group.severityCounts, { critical: 1, high: 2, medium: 1, low: 1, unknown: 1 });
  assert.equal(Object.values(group.severityCounts).reduce((sum, count) => sum + count, 0), group.advisories.length);
  for (const label of ['critical', 'high', 'medium', 'low', 'unknown']) {
    const selected = groupPackages(records.filter(item => item.severity.label === label))[0];
    assert.equal(selected.highestSeverity, label);
    assert.equal(selected.severityCounts[label], selected.advisories.length);
  }
  assert.equal('cvss' in group, false);
  assert.equal('exploitation' in group, false);
  assert.equal('kev' in group, false);
});

test('unknown-only packages remain unknown and do not borrow severity from another coordinate', () => {
  const groups = groupPackages([
    advisory('unknown-a', [coordinate('npm', 'Widget')], { severity: { label: 'unknown' } }),
    advisory('unknown-b', [coordinate('npm', 'Widget')], { severity: { label: 'unknown', cvss: [{ score: 10 }] } }),
    advisory('known', [coordinate('npm', 'widget'), coordinate('PyPI', 'Widget')], { severity: { label: 'critical' } }),
  ]);
  const unknown = groups.find(group => group.key === packageKey('npm', 'Widget'));
  assert.equal(unknown.highestSeverity, 'unknown');
  assert.deepEqual(unknown.severityCounts, { critical: 0, high: 0, medium: 0, low: 0, unknown: 2 });
  assert.ok(groups.filter(group => group !== unknown).every(group => group.highestSeverity === 'critical'));
});

test('duplicate advisory IDs keep one current source record rather than summing versions', () => {
  const pkg = coordinate('npm', 'updated');
  const older = advisory('A', [pkg, pkg], { severity: { label: 'critical' }, modifiedAt: '2026-01-03T00:00:00Z' });
  const newer = advisory('A', [pkg], { severity: { label: 'low' }, modifiedAt: '2026-02-01T00:00:00Z',
    withdrawnAt: '2026-02-01T00:00:00Z' });
  const group = groupPackages([older, newer, newer])[0];
  assert.deepEqual(group.advisories, [newer]);
  assert.equal(group.highestSeverity, 'low');
  assert.deepEqual(group.severityCounts, { critical: 0, high: 0, medium: 0, low: 1, unknown: 0 });
  assert.equal(group.latestModifiedAt, newer.modifiedAt);
  assert.equal(group.withdrawnCount, 1);
  assert.deepEqual(groupPackages([newer, older, newer])[0], group);
});

test('summary severity, update date, and withdrawn count reflect all current upstream filters', () => {
  const pkg = coordinate('npm', 'filtered');
  const records = [
    advisory('old', [pkg], { publishedAt: '2025-12-01T00:00:00Z', modifiedAt: '2026-09-01T00:00:00Z',
      severity: { label: 'critical' } }),
    advisory('withdrawn', [pkg], { modifiedAt: '2026-08-01T00:00:00Z', withdrawnAt: '2026-08-01T00:00:00Z',
      severity: { label: 'critical' } }),
    advisory('selected', [pkg, coordinate('PyPI', 'filtered')], { aliases: ['CVE-2026-12345'],
      modifiedAt: '2026-03-01T00:00:00Z', severity: { label: 'medium' } }),
    advisory('other', [pkg], { modifiedAt: '2026-04-01T00:00:00Z', severity: { label: 'high' } }),
  ];
  const selected = groupPackages(filterVulnerabilities(records, 'npm', 'CVE-2026-12345',
    { lifecycle: 'active', year: '2026' }), 'npm');
  assert.equal(selected.length, 1);
  assert.equal(selected[0].key, packageKey('npm', 'filtered'));
  assert.equal(selected[0].highestSeverity, 'medium');
  assert.deepEqual(selected[0].severityCounts, { critical: 0, high: 0, medium: 1, low: 0, unknown: 0 });
  assert.equal(selected[0].latestModifiedAt, '2026-03-01T00:00:00Z');
  assert.equal(selected[0].withdrawnCount, 0);
  const active = groupPackages(filterVulnerabilities(records, 'npm', '', { lifecycle: 'active', year: '2026' }), 'npm')[0];
  assert.equal(active.highestSeverity, 'high');
  assert.equal(active.latestModifiedAt, '2026-04-01T00:00:00Z');
  assert.equal(active.withdrawnCount, 0);
  const history = groupPackages(filterVulnerabilities(records, 'npm', '', { year: '2026' }), 'npm')[0];
  assert.equal(history.highestSeverity, 'critical');
  assert.equal(history.latestModifiedAt, '2026-08-01T00:00:00Z');
  assert.equal(history.withdrawnCount, 1);
  const withdrawn = groupPackages(filterVulnerabilities(records, 'npm', '', { lifecycle: 'withdrawn' }), 'npm')[0];
  assert.deepEqual(groupIds(withdrawn), ['withdrawn']);
  assert.equal(withdrawn.withdrawnCount, withdrawn.advisories.length);
});

test('latest modification uses timestamp instants independently from publication ordering', () => {
  const records = [
    advisory('recently-published', [coordinate('npm', 'a')], { publishedAt: '2026-04-01T00:00:00Z',
      modifiedAt: '2026-04-01T00:00:00Z' }),
    advisory('recently-updated', [coordinate('npm', 'b')], { publishedAt: '2026-01-01T00:00:00Z',
      modifiedAt: '2026-04-02T00:00:00.100000Z' }),
    advisory('later-clock-earlier-instant', [coordinate('npm', 'b')], { publishedAt: '2026-02-01T00:00:00Z',
      modifiedAt: '2026-04-02T09:00:00+09:00' }),
  ];
  const groups = groupPackages(records);
  assert.deepEqual(groups.map(group => group.packageName), ['a', 'b']);
  assert.deepEqual(groupIds(groups[1]), ['later-clock-earlier-instant', 'recently-updated']);
  assert.equal(groups[1].latestPublishedAt, '2026-02-01T00:00:00Z');
  assert.equal(groups[1].latestModifiedAt, '2026-04-02T00:00:00.100000Z');
  assert.deepEqual(groupPackages([...records].reverse()), groups);
});

test('missing or invalid update evidence is not replaced with a publication date', () => {
  const pkg = coordinate('npm', 'update-unknown');
  const records = [advisory('missing', [pkg], { modifiedAt: undefined }),
    advisory('invalid', [pkg], { modifiedAt: 'not a date' })];
  assert.equal(groupPackages(records)[0].latestModifiedAt, '');
  const valid = advisory('valid', [pkg], { modifiedAt: '2026-03-01T00:00:00Z' });
  assert.equal(groupPackages([...records, valid])[0].latestModifiedAt, valid.modifiedAt);
});

test('ecosystem filtering removes unrelated package coordinates within matching advisories', () => {
  const records = [advisory('A', [coordinate('npm', 'same'), coordinate('PyPI', 'same')]),
    advisory('B', [coordinate('PyPI', 'python-only')])];
  const filtered = filterVulnerabilities(records, 'npm', '');
  const groups = groupPackages(filtered, 'npm');
  assert.deepEqual(groups.map(group => group.key), [packageKey('npm', 'same')]);
  assert.deepEqual(groupIds(groups[0]), ['A']);
  assert.deepEqual(groupPackages(records, 'NuGet'), []);
});

test('advisory searches retain only matched issues while package searches ignore casing', () => {
  const records = [advisory('A', [coordinate('npm', '@Scope/Widget')], { aliases: ['CVE-2026-12345'], title: 'Archive extraction flaw' }),
    advisory('B', [coordinate('npm', '@Scope/Widget')], { title: 'Request parsing flaw' }),
    advisory('C', [coordinate('PyPI', '@scope/widget')], { title: 'Archive boundary error' })];
  const cveGroups = groupPackages(filterVulnerabilities(records, 'all', 'cve-2026-12345'));
  assert.deepEqual(cveGroups.map(groupIds), [['A']]);
  assert.deepEqual(groupPackages(filterVulnerabilities(records, 'all', 'parsing')).map(groupIds), [['B']]);
  const packageGroups = groupPackages(filterVulnerabilities(records, 'all', '@sCoPe/wIdGeT'));
  assert.equal(packageGroups.length, 2);
  assert.deepEqual(new Set(packageGroups.flatMap(groupIds)), new Set(['A', 'B', 'C']));
  assert.ok(packageGroups.some(group => group.packageName === '@Scope/Widget'));
  assert.ok(packageGroups.some(group => group.packageName === '@scope/widget'));
});

test('year and withdrawal filtering determine group membership and latest relevant date', () => {
  const pkg = coordinate('npm', 'lifecycle');
  const records = [advisory('old', [pkg], { publishedAt: '2025-01-01T00:00:00Z' }),
    advisory('withdrawn', [pkg], { withdrawnAt: '2026-01-03T00:00:00Z' })];
  const active = groupPackages(filterVulnerabilities(records, 'all', '', { lifecycle: 'active' }));
  assert.deepEqual(groupIds(active[0]), ['old']);
  assert.equal(active[0].latestPublishedAt, '2025-01-01T00:00:00Z');
  const withdrawn = groupPackages(filterVulnerabilities(records, 'all', '', { lifecycle: 'withdrawn' }));
  assert.deepEqual(groupIds(withdrawn[0]), ['withdrawn']);
  assert.deepEqual(groupPackages(filterVulnerabilities(records, 'all', '', { lifecycle: 'active', year: '2026' })), []);
});

test('ordering is stable: latest relevant date, exact ecosystem, exact package, then advisory ID', () => {
  const date = '2026-02-01T00:00:00Z';
  const records = [advisory('B', [coordinate('npm', 'Zebra'), coordinate('npm', 'alpha')]),
    advisory('C', [coordinate('Go', 'older')], { publishedAt: '2024-01-01T00:00:00Z' }),
    advisory('A', [coordinate('npm', 'Zebra')]),
    advisory('D', [coordinate('PyPI', 'newest')], { publishedAt: date })];
  const groups = groupPackages(records);
  assert.deepEqual(groups.map(group => group.packageName), ['newest', 'Zebra', 'alpha', 'older']);
  assert.deepEqual(groupIds(groups[1]), ['A', 'B']);
  assert.deepEqual(groupPackages([...records].reverse()), groups);
  assert.deepEqual(groupIds(groupPackages([records[0], { ...records[0], publishedAt: date }])[0]), ['B']);
  assert.equal(groupPackages([records[0], { ...records[0], publishedAt: date }])[0].latestPublishedAt, date);
});

test('grouping retains source references without mutating records or their package order', () => {
  const item = advisory('A', [coordinate('npm', 'z'), coordinate('npm', 'a')]);
  const before = structuredClone(item);
  const groups = groupPackages([item]);
  assert.deepEqual(item, before);
  assert.ok(groups.every(group => group.advisories[0] === item));
});

test('publication ordering compares instants when timestamp precision differs', () => {
  const records = [advisory('old', [coordinate('npm', 'same')], { publishedAt: '2026-01-02T00:00:00Z' }),
    advisory('new', [coordinate('npm', 'same'), coordinate('PyPI', 'newer')], { publishedAt: '2026-01-02T00:00:00.100Z' }),
    advisory('tie', [coordinate('Maven', 'equal')], { publishedAt: '2026-01-02T00:00:00.100000Z' })];
  const groups = groupPackages(records);
  assert.deepEqual(groups.map(group => group.ecosystem), ['Maven', 'PyPI', 'npm']);
  assert.deepEqual(groupIds(groups[2]), ['new', 'old']);
  assert.equal(groups[2].latestPublishedAt, '2026-01-02T00:00:00.100Z');
});

test('50-card pagination visits every package and every advisory without an arbitrary corpus cap', () => {
  const records = Array.from({ length: 18659 }, (_, index) => advisory(`A-${index.toString().padStart(5, '0')}`,
    [coordinate('npm', `package-${index}`), coordinate('Go', 'common')]));
  const groups = groupPackages(records);
  assert.equal(groups.length, 18660);
  const visited = [];
  for (let page = 0; page < Math.ceil(groups.length / ADVISORY_PAGE_SIZE); page++) {
    const slice = paginate(groups, page, ADVISORY_PAGE_SIZE);
    assert.ok(slice.items.length <= 50);
    visited.push(...slice.items.map(group => group.key));
  }
  assert.deepEqual(visited, groups.map(group => group.key));
  const common = groups.find(group => group.packageName === 'common');
  assert.equal(common.advisories.length, records.length);
  assert.equal(paginate(common.advisories, 373, ADVISORY_PAGE_SIZE).items.length, 9);
  assert.equal(paginate(groups, 999999, ADVISORY_PAGE_SIZE).end, groups.length);
});

const corpusFile = new URL('../src/data/vulnerability-imported.json', import.meta.url);
test('the complete pinned corpus preserves all exact package/advisory relationships', { skip: !existsSync(corpusFile) }, () => {
  const records = JSON.parse(readFileSync(corpusFile, 'utf8'));
  const expected = new Map();
  for (const item of records) for (const pkg of item.affected) {
    const key = JSON.stringify([pkg.ecosystem, pkg.packageName]);
    if (!expected.has(key)) expected.set(key, new Set());
    expected.get(key).add(item.id);
  }
  const groups = groupPackages(records);
  assert.equal(groups.length, expected.size);
  assert.equal(new Set(groups.flatMap(groupIds)).size, records.length);
  for (const group of groups) {
    assert.deepEqual(new Set(groupIds(group)), expected.get(group.key));
    assert.equal(group.advisories.length, expected.get(group.key).size);
    for (const severity of ['critical', 'high', 'medium', 'low', 'unknown']) {
      assert.equal(group.severityCounts[severity], group.advisories.filter(item => item.severity.label === severity).length);
    }
    assert.equal(group.highestSeverity, ['critical', 'high', 'medium', 'low', 'unknown']
      .find(severity => group.severityCounts[severity] > 0));
    assert.equal(Date.parse(group.latestModifiedAt), group.advisories.reduce((latest, item) =>
      Math.max(latest, Date.parse(item.modifiedAt)), -Infinity));
    assert.equal(group.withdrawnCount, group.advisories.filter(item => item.withdrawnAt).length);
  }
  for (const ecosystem of ['npm', 'PyPI', 'Go', 'Maven', 'NuGet', 'RubyGems', 'crates.io']) {
    const selected = groupPackages(filterVulnerabilities(records, ecosystem, ''), ecosystem);
    assert.ok(selected.every(group => group.ecosystem === ecosystem));
    assert.equal(selected.length, groups.filter(group => group.ecosystem === ecosystem).length);
  }
});

test('package cards use compact summaries and never imply a package-level fix status', () => {
  for (const component of ['PackageList', 'PackageAdvisoryList']) {
    const source = readFileSync(new URL(`../src/components/${component}.tsx`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /loadVulnerability|loadFullVulnerabilities|fixLabel|fixStatus|vulnerability-index/);
    assert.match(source, /<VirtualRecordList/);
    assert.doesNotMatch(source, /<Pagination|paginate\(/);
  }
});
