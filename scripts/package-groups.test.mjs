import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { groupPackages, packageKey, parsePackageKey } from '../src/lib/packageGroups.ts';
import { filterVulnerabilities } from '../src/lib/vulnerabilities.ts';
import { ADVISORY_PAGE_SIZE, paginate } from '../src/lib/pagination.ts';

const coordinate = (ecosystem, packageName) => ({ ecosystem, packageName });
const advisory = (id, affected, overrides = {}) => ({ id, aliases: [], title: `Advisory ${id}`,
  publishedAt: '2026-01-02T00:00:00Z', withdrawnAt: null, affected,
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
    assert.match(source, /paginate\([^\n]+ADVISORY_PAGE_SIZE\)/);
  }
});
