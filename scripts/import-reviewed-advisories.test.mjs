import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importSnapshot, mergeWithCurated, normalizeAdvisory, normalizeAffected, normalizeIntervals } from './import-reviewed-advisories.mjs';

const sourceUrl = 'https://example.test/source';
const snapshotSha = 'c'.repeat(40);
const verifiedAt = '2026-10-08T02:30:55Z';
const context = { path: 'advisories/github-reviewed/2023/01/GHSA-2345-6789-cfgh/GHSA-2345-6789-cfgh.json', snapshotSha, verifiedAt };
const advisory = overrides => ({
  id: 'GHSA-2345-6789-cfgh', published: '2023-01-01T00:00:00Z', modified: '2023-02-01T00:00:00Z', aliases: ['CVE-2023-10000', 'RUSTSEC-2023-0001'], summary: 'Original upstream summary',
  affected: [{ package: { ecosystem: 'npm', name: 'example' }, ranges: [{ type: 'ECOSYSTEM', events: [{ introduced: '0' }, { fixed: '2.0.0' }] }] }],
  severity: [{ type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }],
  database_specific: { github_reviewed: true, severity: 'MODERATE' }, ...overrides,
});

test('ordered OSV intervals keep exact fixes, inclusive last_affected, and open ends', () => {
  const result = normalizeIntervals({ type: 'ECOSYSTEM', events: [{ introduced: '0' }, { fixed: '1.2' }, { introduced: '3.0' }, { fixed: '4.0' }, { introduced: '5.0' }] }, sourceUrl);
  assert.deepEqual(result, [
    { affected: '< 1.2', fixed: '1.2', sourceUrl },
    { affected: '>= 3.0, < 4.0', fixed: '4.0', sourceUrl },
    { affected: '>= 5.0', fixed: null, sourceUrl },
  ]);
  assert.deepEqual(normalizeIntervals({ type: 'ECOSYSTEM', events: [{ introduced: '2.0' }, { last_affected: '2.9' }] }, sourceUrl), [{ affected: '>= 2.0, <= 2.9', fixed: null, sourceUrl }]);
  assert.deepEqual(normalizeIntervals({ type: 'SEMVER', events: [{ introduced: '0' }] }, sourceUrl), [{ affected: '*', fixed: null, sourceUrl }]);
});

test('unsupported GIT and limit semantics, mixed endings, and malformed events fail closed', () => {
  const range = { type: 'GIT', repo: 'https://github.com/example/project', events: [{ introduced: 'abcd' }, { fixed: 'cdef' }] };
  assert.throws(() => normalizeIntervals(range, sourceUrl), /GIT graph semantics are not supported/);
  for (const events of [[{ introduced: '0' }, { limit: '2.0' }], [{ introduced: '0' }, { fixed: '1.0' }, { limit: '2.0' }], [{ introduced: '1.0' }, { limit: '*' }], [{ introduced: '0' }, { limit: '2.0' }, { limit: '3.0' }]]) assert.throws(() => normalizeIntervals({ type: 'SEMVER', events }, sourceUrl), /Unsupported OSV limit semantics/);
  assert.throws(() => normalizeIntervals({ type: 'ECOSYSTEM', events: [{ introduced: '0' }, { fixed: '1.0' }, { introduced: '2.0' }, { last_affected: '3.0' }] }, sourceUrl), /cannot combine fixed and last_affected/);
  for (const events of [[{ fixed: '2' }], [{ introduced: '0' }, { introduced: '2' }], [{ introduced: '0', fixed: '2' }], [{ mystery: '1' }], [null]]) assert.throws(() => normalizeIntervals({ type: 'ECOSYSTEM', events }, sourceUrl));
});

test('raw ranges, explicit versions, package URLs and extra ecosystems survive normalization', () => {
  const rawRange = { type: 'ECOSYSTEM', events: [{ introduced: '0' }, { last_affected: '1.0' }], database_specific: { source: 'original metadata' } };
  const affected = normalizeAffected([
    { package: { ecosystem: 'PyPI', name: 'example', purl: 'pkg:pypi/example' }, ranges: [rawRange] },
    { package: { ecosystem: 'PyPI', name: 'example' }, versions: ['1.5', '1.5', '2.0'] },
    { package: { ecosystem: 'Packagist', name: 'vendor/package' }, versions: ['3.0'] },
  ], sourceUrl);
  const pypi = affected.find(item => item.ecosystem === 'pip');
  assert.deepEqual(pypi.rawRanges, [rawRange]);
  assert.deepEqual(pypi.explicitVersions, ['1.5', '2.0']);
  assert.equal(pypi.packageUrl, 'pkg:pypi/example');
  assert.equal(pypi.ranges[0].fixed, null);
  assert.equal(affected.find(item => item.ecosystem === 'Packagist').packageName, 'vendor/package');
});

test('upstream aliases, dates, withdrawal, vectors and summary are retained without maintainer claims', () => {
  const raw = advisory({ withdrawn: '2023-03-01T00:00:00Z' });
  const result = normalizeAdvisory(raw, context);
  assert.equal(result.title, raw.summary);
  assert.equal(result.summary, raw.summary);
  assert.deepEqual(result.aliases, raw.aliases);
  assert.equal(result.withdrawnAt, raw.withdrawn);
  assert.equal(result.severity.label, 'medium');
  assert.equal(result.severity.cvss[0].score, null);
  assert.equal(result.severity.cvss[0].vector, raw.severity[0].score);
  assert.equal(result.verification.level, 'database');
  assert.ok(result.sources.every(source => source.type === 'advisoryDatabase'));
  assert.ok(result.dateSourceUrl.includes(`/${snapshotSha}/advisories/github-reviewed/`));
  assert.deepEqual(result.provenance.advisories[0], { id: raw.id, aliases: raw.aliases, publishedAt: raw.published, modifiedAt: raw.modified, withdrawnAt: raw.withdrawn, sourceUrl: result.dateSourceUrl });
});

test('alias graph joins transitively and retains every source with distinct dates and withdrawal', () => {
  const first = normalizeAdvisory(advisory({ withdrawn: '2023-04-01T00:00:00Z' }), context);
  const second = normalizeAdvisory(advisory({ id: 'GHSA-2345-6789-cfgj', aliases: ['RUSTSEC-2023-0001', 'PYSEC-2023-1'], published: '2023-01-02T00:00:00Z' }), { ...context, path: context.path.replaceAll('cfgh', 'cfgj') });
  const third = normalizeAdvisory(advisory({ id: 'GHSA-2345-6789-cfgm', aliases: ['PYSEC-2023-1'], published: '2023-01-03T00:00:00Z', withdrawn: '2023-05-01T00:00:00Z' }), { ...context, path: context.path.replaceAll('cfgh', 'cfgm') });
  const { records, advisoryRecordIds } = mergeWithCurated([third, second, first], [], context);
  assert.equal(records.length, 1);
  assert.equal(records[0].publishedAt, first.publishedAt);
  assert.equal(records[0].withdrawnAt, null);
  assert.equal(records[0].provenance.advisories.length, 3);
  assert.equal(advisoryRecordIds.size, 3);
  assert.ok(records[0].aliases.includes('PYSEC-2023-1'));
  second.withdrawnAt = '2023-06-01T00:00:00Z';
  assert.equal(mergeWithCurated([first, second, third], [], context).records[0].withdrawnAt, second.withdrawnAt);
});

test('curated corrections and primary evidence survive, while raw DB conflicts stay explicit', () => {
  const imported = normalizeAdvisory(advisory({ modified: '2026-10-07T00:00:00Z' }), context);
  const curated = structuredClone(imported);
  delete curated.verification;
  delete curated.provenance;
  curated.lastVerifiedAt = '2026-10-06T00:00:00Z';
  curated.title = '編集した日本語タイトル';
  curated.summary = '一次資料を確認した概要';
  curated.affected[0].packageName = 'Correct.Canonical.Package';
  curated.affected[0].ranges = [{ affected: '>= 1.0, < 1.9', fixed: '1.9', sourceUrl: 'https://maintainer.example/advisory' }, { affected: '>= 2.0, < 2.1', fixed: '2.1', sourceUrl: 'https://maintainer.example/advisory' }];
  curated.sources.push({ type: 'maintainer', title: 'Read original evidence', url: 'https://maintainer.example/advisory', publishedDate: null });
  curated.caveats = ['Preserve the carefully reviewed caveat'];
  curated.severity.cvss[0].score = 9.8;
  const original = JSON.stringify(curated);
  const { records, stats } = mergeWithCurated([imported], [curated], context);
  assert.equal(records.length, 1);
  const [result] = records;
  assert.equal(result.title, curated.title);
  assert.equal(result.summary, curated.summary);
  assert.deepEqual(result.affected, curated.affected);
  assert.equal(result.severity.cvss[0].score, 9.8);
  assert.ok(result.sources.some(source => source.type === 'maintainer'));
  assert.ok(result.caveats.includes(curated.caveats[0]));
  assert.deepEqual(result.provenance.databaseAffected, imported.affected);
  assert.equal(result.verification.level, 'mixed');
  assert.ok(result.provenance.conflicts.some(conflict => conflict.field === 'affected'));
  assert.ok(result.provenance.conflicts.some(conflict => conflict.field === 'content' && conflict.newerDatabase));
  assert.equal(stats.curatedOverlays, 1);
  assert.equal(stats.newerDatabaseRecords, 1);
  assert.equal(JSON.stringify(curated), original);
});

function fixtureRepository() {
  const root = mkdtempSync(join(tmpdir(), 'reviewed-import-test-'));
  const source = join(root, 'advisory-database');
  mkdirSync(source);
  mkdirSync(join(root, 'src/data/vulnerabilities'), { recursive: true });
  const add = (id, data) => {
    const path = `advisories/github-reviewed/2023/01/${id}/${id}.json`;
    mkdirSync(join(source, path, '..'), { recursive: true });
    writeFileSync(join(source, path), JSON.stringify({ ...data, id }));
    return path;
  };
  const includedPath = add('GHSA-2345-6789-cfgh', advisory({ published: '2022-11-01T00:00:00Z' }));
  add('GHSA-2345-6789-cfgj', advisory({ published: '2022-10-31T23:59:59Z' }));
  add('GHSA-2345-6789-cfgm', advisory({ published: '2026-10-08T02:30:55Z' }));
  add('GHSA-2345-6789-cfgp', advisory({ published: '2026-10-08T02:30:56Z' }));
  add('GHSA-2345-6789-cfgq', advisory({ affected: [{ package: { ecosystem: 'Packagist', name: 'vendor/pkg' }, versions: ['1.0'] }] }));
  const git = (...args) => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_DATE: '2026-10-08T00:36:29Z', GIT_COMMITTER_DATE: '2026-10-08T00:36:29Z' } }).trim();
  git('init', '--quiet'); git('add', '.');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--quiet', '-m', 'Fixture data');
  return { root, source, snapshot: git('rev-parse', 'HEAD'), includedPath, git };
}

test('tree import covers every eligible advisory, explains exclusions and is byte reproducible', () => {
  const fixture = fixtureRepository();
  const options = { ...fixture, 'verified-at': verifiedAt, through: verifiedAt };
  const manifest = importSnapshot(options);
  assert.equal(manifest.counts.reviewedFiles, 5);
  assert.equal(manifest.counts.eligibleAdvisories, 2);
  assert.equal(manifest.counts.coveredEligibleAdvisories, 2);
  assert.equal(manifest.counts.excludedBeforeWindow, 1);
  assert.equal(manifest.counts.excludedAfterWindow, 1);
  assert.equal(manifest.counts.excludedUnsupportedEcosystem, 1);
  assert.equal(manifest.counts.failed, 0);
  const audit = JSON.parse(readFileSync(join(fixture.root, manifest.artifacts.audit.path), 'utf8'));
  assert.equal(audit.records.length, 5);
  assert.ok(audit.records.filter(row => row.status === 'included').every(row => row.recordId));
  assert.equal(importSnapshot({ ...options, check: true }).contentSha256, manifest.contentSha256);
  assert.equal(importSnapshot({ ...options, 'verify-against': 'src/data/vulnerability-coverage.json' }).contentSha256, manifest.contentSha256);
  const expectedPath = join(fixture.root, 'src/data/vulnerability-coverage.json');
  const expectedContent = readFileSync(expectedPath, 'utf8');
  writeFileSync(expectedPath, expectedContent.replace(manifest.contentSha256, '0'.repeat(64)));
  assert.throws(() => importSnapshot({ ...options, 'verify-against': 'src/data/vulnerability-coverage.json' }), /refusing to replace expected hashes/);
  assert.notEqual(readFileSync(expectedPath, 'utf8'), expectedContent);
  writeFileSync(expectedPath, expectedContent);
  const before = readFileSync(join(fixture.root, manifest.artifacts.data.path), 'utf8');
  writeFileSync(join(fixture.source, fixture.includedPath), '{invalid');
  assert.throws(() => importSnapshot(options), /modified or untracked/);
  assert.equal(readFileSync(join(fixture.root, manifest.artifacts.data.path), 'utf8'), before);
  fixture.git('add', '.');
  fixture.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--quiet', '-m', 'Malformed source');
  assert.throws(() => importSnapshot({ ...options, snapshot: fixture.git('rev-parse', 'HEAD') }), /Import refused: 1 source failures/);
  assert.equal(readFileSync(join(fixture.root, manifest.artifacts.data.path), 'utf8'), before);
});

test('malformed package coordinates fail before scope exclusions without replacing artifacts', () => {
  const fixture = fixtureRepository();
  const options = { ...fixture, 'verified-at': verifiedAt, through: verifiedAt };
  const manifest = importSnapshot(options);
  const artifactPaths = [manifest.artifacts.data.path, manifest.artifacts.audit.path, 'src/data/vulnerability-coverage.json'];
  const before = artifactPaths.map(path => readFileSync(join(fixture.root, path), 'utf8'));
  const sourcePath = join(fixture.source, fixture.includedPath);
  for (const [index, overrides] of [
    { affected: [{}] },
    { affected: [null] },
    { affected: [{ package: { ecosystem: 'Packagist' }, versions: ['1.0'] }] },
    { affected: [{ package: { ecosystem: ' ', name: 'example' }, versions: ['1.0'] }] },
    { published: '2022-10-31T23:59:59Z', affected: [{ package: { ecosystem: 'npm', name: '' } }] },
  ].entries()) {
    writeFileSync(sourcePath, JSON.stringify(advisory(overrides)));
    fixture.git('add', '.');
    fixture.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--quiet', '-m', `Malformed package coordinates ${index}`);
    assert.throws(() => importSnapshot({ ...options, snapshot: fixture.git('rev-parse', 'HEAD') }), /Import refused: 1 source failures[\s\S]*Affected package has no (ecosystem|name)/);
    assert.deepEqual(artifactPaths.map(path => readFileSync(join(fixture.root, path), 'utf8')), before);
  }
});
