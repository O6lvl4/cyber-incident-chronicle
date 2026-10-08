#!/usr/bin/env node
/** Deterministic, fail-closed import from an immutable official repository tree. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ECOSYSTEMS = Object.freeze({ npm: 'npm', PyPI: 'pip', RubyGems: 'rubygems', Go: 'go', 'crates.io': 'rust', Maven: 'maven', NuGet: 'nuget' });
const REPOSITORY = 'https://github.com/github/advisory-database';
const REVIEWED_PATH = 'advisories/github-reviewed';
const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const unique = values => [...new Set(values)];
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const sorted = values => unique(values).sort(compare);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => structuredClone(value);
const unionObjects = values => [...new Map(values.map(value => [JSON.stringify(value), value])).values()];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const isText = value => typeof value === 'string' && value.trim().length > 0;
const isTimestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value));
const latest = values => values.reduce((a, b) => Date.parse(a) >= Date.parse(b) ? a : b);

/**
 * Display projection for alternating, already ordered ECOSYSTEM/SEMVER events.
 * GIT requires graph traversal, and limit applies to the entire range rather than
 * closing an interval. Refuse those semantics instead of displaying a guess.
 */
export function normalizeIntervals(rawRange, sourceUrl) {
  assert(['ECOSYSTEM', 'SEMVER'].includes(rawRange?.type), `Unsupported OSV range type: ${rawRange?.type}; GIT graph semantics are not supported`);
  assert(Array.isArray(rawRange.events) && rawRange.events.length > 0, 'OSV range has no events');
  assert(!rawRange.events.some(event => event && Object.hasOwn(event, 'limit')), 'Unsupported OSV limit semantics; limits constrain the whole range');
  assert(!(rawRange.events.some(event => event && Object.hasOwn(event, 'fixed')) && rawRange.events.some(event => event && Object.hasOwn(event, 'last_affected'))), 'OSV range cannot combine fixed and last_affected events');
  const result = [];
  let introduced = null;
  for (const event of rawRange.events) {
    const keys = event && typeof event === 'object' ? Object.keys(event) : [];
    assert(keys.length === 1 && ['introduced', 'fixed', 'last_affected'].includes(keys[0]), 'Invalid OSV event');
    const [key] = keys;
    assert(isText(event[key]), `Empty OSV ${key} event`);
    if (key === 'introduced') {
      assert(introduced === null, 'OSV introduced event without closing previous interval');
      introduced = event.introduced;
    } else {
      assert(introduced !== null, `OSV ${key} event without introduced event`);
      const lower = introduced === '0' ? '' : `>= ${introduced}, `;
      const upper = `${key === 'last_affected' ? '<=' : '<'} ${event[key]}`;
      result.push({ affected: `${lower}${upper}`, fixed: key === 'fixed' ? event.fixed : null, sourceUrl });
      introduced = null;
    }
  }
  if (introduced !== null) result.push({ affected: introduced === '0' ? '*' : `>= ${introduced}`, fixed: null, sourceUrl });
  return result;
}

export function normalizeAffected(affected, sourceUrl) {
  const packages = new Map();
  for (const entry of affected) {
    const pkg = entry?.package;
    assert(isText(pkg?.ecosystem), 'Affected package has no ecosystem');
    assert(isText(pkg.name), 'Affected package has no name');
    const key = `${pkg.ecosystem}\0${pkg.name}`;
    const normalized = packages.get(key) ?? { ecosystem: ECOSYSTEMS[pkg.ecosystem] ?? pkg.ecosystem, packageName: pkg.name, ranges: [], rawRanges: [], explicitVersions: [] };
    if (pkg.purl) {
      assert(!normalized.packageUrl || normalized.packageUrl === pkg.purl, `Conflicting purls for ${key}`);
      normalized.packageUrl = pkg.purl;
    }
    assert(entry.ranges === undefined || Array.isArray(entry.ranges), 'OSV ranges must be an array');
    assert(entry.versions === undefined || Array.isArray(entry.versions), 'OSV versions must be an array');
    for (const range of entry.ranges ?? []) {
      normalized.ranges.push(...normalizeIntervals(range, sourceUrl));
      normalized.rawRanges.push(clone(range));
    }
    for (const version of entry.versions ?? []) {
      assert(isText(version), 'Invalid explicit affected version');
      normalized.explicitVersions.push(version);
      normalized.ranges.push({ affected: `= ${version}`, fixed: null, sourceUrl });
    }
    assert(normalized.ranges.length > 0, `No version evidence for ${key}`);
    packages.set(key, normalized);
  }
  return [...packages.values()].map(pkg => ({ ...pkg, ranges: unionObjects(pkg.ranges), rawRanges: unionObjects(pkg.rawRanges), explicitVersions: sorted(pkg.explicitVersions) })).sort((a, b) => compare(`${a.ecosystem}:${a.packageName}`, `${b.ecosystem}:${b.packageName}`));
}

function normalizeCvss(severities, sourceUrl) {
  return unionObjects((severities ?? []).map(severity => {
    assert(['CVSS_V2', 'CVSS_V3', 'CVSS_V4'].includes(severity.type), `Unsupported severity type ${severity.type}`);
    assert(isText(severity.score), 'Missing OSV CVSS vector');
    const match = severity.score.match(/^CVSS:(2\.0|3\.0|3\.1|4\.0)\//);
    const version = match?.[1] ?? (severity.type === 'CVSS_V2' ? '2.0' : null);
    assert(version, `Unrecognized CVSS vector ${severity.score}`);
    assert((severity.type === 'CVSS_V2' && version === '2.0') || (severity.type === 'CVSS_V3' && version.startsWith('3.')) || (severity.type === 'CVSS_V4' && version === '4.0'), 'CVSS type/version mismatch');
    // OSV's score field is a vector; calculating a numeric base score would add an assessment.
    return { version, score: null, vector: severity.score, sourceUrl };
  }));
}

export function normalizeAdvisory(advisory, { path, snapshotSha, verifiedAt }) {
  assert(/^GHSA-[a-z0-9-]+$/.test(advisory.id), 'Expected an upstream GHSA identifier');
  for (const field of ['published', 'modified']) assert(isTimestamp(advisory[field]), `Invalid ${field}`);
  assert(!advisory.withdrawn || isTimestamp(advisory.withdrawn), 'Invalid withdrawal date');
  assert(isText(advisory.summary), 'Missing upstream summary');
  assert(Array.isArray(advisory.affected), 'Missing affected packages');
  assert(!advisory.aliases || (Array.isArray(advisory.aliases) && advisory.aliases.every(isText)), 'Invalid aliases');
  const sourceUrl = `https://raw.githubusercontent.com/github/advisory-database/${snapshotSha}/${path}`;
  const aliases = sorted(advisory.aliases ?? []).filter(id => id !== advisory.id);
  const upstreamLabel = advisory.database_specific?.severity?.toLowerCase() ?? 'unknown';
  const label = upstreamLabel === 'moderate' ? 'medium' : upstreamLabel;
  assert(['critical', 'high', 'medium', 'low', 'unknown'].includes(label), `Unsupported severity label ${label}`);
  const affected = normalizeAffected(advisory.affected, sourceUrl);
  assert(affected.length, 'No supported package');
  const metadata = { id: advisory.id, aliases, publishedAt: advisory.published, modifiedAt: advisory.modified, withdrawnAt: advisory.withdrawn ?? null, sourceUrl };
  return {
    kind: 'vulnerability', id: advisory.id, aliases,
    title: advisory.summary, summary: advisory.summary,
    publishedAt: advisory.published, dateSourceUrl: sourceUrl, modifiedAt: advisory.modified,
    withdrawnAt: advisory.withdrawn ?? null, lastVerifiedAt: verifiedAt,
    affected,
    severity: { label, sourceUrl: label === 'unknown' ? null : sourceUrl, cvss: normalizeCvss(advisory.severity, sourceUrl) },
    exploitation: { status: 'unknown', sourceUrl: null },
    kev: { status: 'unknown', checkedAt: null, sourceUrl: null },
    sources: [
      { type: 'advisoryDatabase', title: 'GitHub Advisory Database (pinned OSV JSON)', url: sourceUrl, publishedDate: advisory.published.slice(0, 10), publishedAt: advisory.published, modifiedAt: advisory.modified, withdrawnAt: advisory.withdrawn ?? null },
      { type: 'advisoryDatabase', title: advisory.summary, url: `https://github.com/advisories/${advisory.id}`, publishedDate: advisory.published.slice(0, 10) },
    ],
    caveats: [
      'GitHub-reviewed Advisory Databaseの固定スナップショットから収録。開発元の資料は個別に確認していない。',
      '公開・更新・撤回日と影響範囲はデータベースの記録。英語の概要は上流原文で、独自の翻訳・評価は行っていない。',
      '実悪用とCISA KEVは未確認。未確認は実悪用なし・KEV未掲載を意味しない。',
    ],
    verification: { level: 'database', sourceSnapshot: snapshotSha, checkedAt: verifiedAt },
    provenance: { advisories: [metadata] },
  };
}

function unionSources(records) {
  const sources = new Map();
  for (const record of records) for (const source of record.sources) if (!sources.has(source.url)) sources.set(source.url, source);
  return [...sources.values()];
}

function unionPackages(records) {
  const packages = new Map();
  for (const record of records) for (const pkg of record.affected) {
    const key = `${pkg.ecosystem}\0${pkg.packageName}`;
    if (!packages.has(key)) { packages.set(key, clone(pkg)); continue; }
    const previous = packages.get(key);
    previous.ranges = unionObjects([...previous.ranges, ...pkg.ranges]);
    if (previous.rawRanges || pkg.rawRanges) previous.rawRanges = unionObjects([...(previous.rawRanges ?? []), ...(pkg.rawRanges ?? [])]);
    if (previous.explicitVersions || pkg.explicitVersions) previous.explicitVersions = sorted([...(previous.explicitVersions ?? []), ...(pkg.explicitVersions ?? [])]);
    assert(!previous.packageUrl || !pkg.packageUrl || previous.packageUrl === pkg.packageUrl, `Conflicting package URLs for ${key}`);
    if (pkg.packageUrl) previous.packageUrl = pkg.packageUrl;
  }
  return [...packages.values()].sort((a, b) => compare(`${a.ecosystem}:${a.packageName}`, `${b.ecosystem}:${b.packageName}`));
}

function affectedFingerprint(affected) {
  return JSON.stringify(affected.map(pkg => ({ ecosystem: pkg.ecosystem, packageName: pkg.packageName, ranges: pkg.ranges.map(range => `${range.affected.replace(/\s+/g, ' ').trim()}|${range.fixed ?? ''}`).sort(compare) })).sort((a, b) => compare(`${a.ecosystem}:${a.packageName}`, `${b.ecosystem}:${b.packageName}`)));
}

function mergeDatabaseRecords(records) {
  const canonical = [...records].sort((a, b) => compare(a.id, b.id))[0];
  const mostRecent = [...records].sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt) || compare(a.id, b.id))[0];
  const firstPublished = [...records].sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt) || compare(a.id, b.id))[0];
  return {
    ...clone(mostRecent), id: canonical.id,
    aliases: sorted(records.flatMap(record => [record.id, ...record.aliases])).filter(id => id !== canonical.id),
    publishedAt: firstPublished.publishedAt, dateSourceUrl: firstPublished.dateSourceUrl,
    modifiedAt: latest(records.map(record => record.modifiedAt)),
    withdrawnAt: records.every(record => record.withdrawnAt) ? latest(records.map(record => record.withdrawnAt)) : null,
    lastVerifiedAt: latest(records.map(record => record.lastVerifiedAt)),
    affected: unionPackages(records),
    severity: { ...mostRecent.severity, cvss: unionObjects(records.flatMap(record => record.severity.cvss)) },
    sources: unionSources(records), caveats: sorted(records.flatMap(record => record.caveats)),
    provenance: { advisories: records.flatMap(record => record.provenance.advisories).sort((a, b) => compare(a.id, b.id)) },
  };
}

/** Connected aliases form one identity, including aliases outside the GHSA/CVE families. */
export function mergeWithCurated(imported, curated, { snapshotSha, verifiedAt }) {
  const entries = [...imported.map(record => ({ record, curated: false })), ...curated.map(record => ({ record, curated: true }))];
  const parents = entries.map((_, index) => index);
  const find = index => { while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index]; } return index; };
  const owner = new Map();
  entries.forEach(({ record }, index) => {
    for (const identity of [record.id, ...record.aliases]) {
      if (owner.has(identity)) parents[find(index)] = find(owner.get(identity));
      else owner.set(identity, index);
    }
  });
  const groups = new Map();
  entries.forEach((entry, index) => { const key = find(index); groups.set(key, [...(groups.get(key) ?? []), entry]); });
  const result = [];
  const stats = { importedRecords: 0, curatedOverlays: 0, curatedOutsideScope: 0, conflictedRecords: 0, newerDatabaseRecords: 0 };
  const advisoryRecordIds = new Map();
  for (const group of groups.values()) {
    const database = group.filter(entry => !entry.curated).map(entry => entry.record);
    const overlays = group.filter(entry => entry.curated).map(entry => entry.record).sort((a, b) => compare(a.id, b.id));
    let record;
    if (!database.length) {
      assert(overlays.length === 1, 'Curated-only records have duplicate identities');
      record = clone(overlays[0]);
      stats.curatedOutsideScope++;
    } else {
      record = mergeDatabaseRecords(database);
      stats.importedRecords++;
      if (overlays.length) {
        stats.curatedOverlays += overlays.length;
        const selected = overlays[0];
        const newerDatabase = Date.parse(record.modifiedAt) > Math.max(...overlays.map(item => Date.parse(item.lastVerifiedAt)));
        const conflicts = [];
        const curatorAffected = unionPackages(overlays);
        if (affectedFingerprint(curatorAffected) !== affectedFingerprint(record.affected)) conflicts.push({ field: 'affected', reason: 'Curated and database package coordinates or affected/fixed ranges differ; curated interpretation is displayed and database evidence is retained separately.', newerDatabase });
        if (record.severity.label !== selected.severity.label) conflicts.push({ field: 'severity', reason: 'Curated and database severity labels differ; the curated label is displayed.', newerDatabase });
        if (record.publishedAt !== selected.publishedAt || record.withdrawnAt !== selected.withdrawnAt) conflicts.push({ field: 'dates', reason: 'Database publication or withdrawal metadata differs from the curated record; current database dates are displayed.', newerDatabase });
        if (newerDatabase) conflicts.push({ field: 'content', reason: 'The database was updated after maintainer verification; curated text and interpretations have not been reverified against that update.', newerDatabase: true });
        const databaseAffected = clone(record.affected);
        const databaseCvss = record.severity.cvss.filter(value => !selected.severity.cvss.some(existing => existing.version === value.version && existing.vector === value.vector));
        const aliases = sorted([...record.aliases, record.id, ...overlays.flatMap(item => [item.id, ...item.aliases])]).filter(id => id !== selected.id);
        record = {
          ...record, id: selected.id, aliases, title: selected.title, summary: selected.summary,
          affected: curatorAffected,
          severity: { ...clone(selected.severity), cvss: [...clone(selected.severity.cvss), ...databaseCvss] },
          exploitation: clone(selected.exploitation), kev: clone(selected.kev),
          lastVerifiedAt: latest([verifiedAt, ...overlays.map(item => item.lastVerifiedAt)]),
          sources: unionSources([...overlays, record]),
          caveats: unique([...overlays.flatMap(item => item.caveats), ...(conflicts.length ? ['開発元を確認した編集内容を優先。固定スナップショットのDB記録と異なる項目は、原データと差分を別に保持している。'] : []), ...(newerDatabase ? ['編集内容の確認後にデータベースが更新されている。概要・影響範囲の再確認が必要。'] : [])]),
          verification: { level: 'mixed', sourceSnapshot: snapshotSha, checkedAt: verifiedAt },
          provenance: { ...record.provenance, curatedIds: overlays.map(item => item.id), databaseAffected, conflicts },
        };
        if (conflicts.length) stats.conflictedRecords++;
        if (newerDatabase) stats.newerDatabaseRecords++;
      }
      for (const item of database) advisoryRecordIds.set(item.id, record.id);
    }
    result.push(record);
  }
  return { records: result.sort((a, b) => compare(a.id, b.id)), stats, advisoryRecordIds };
}

const git = (source, ...args) => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
function parseOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    assert(['--source', '--snapshot', '--verified-at', '--from', '--through', '--root', '--check', '--verify-against'].includes(key), `Unknown option ${key}`);
    if (key === '--check') options.check = true;
    else { assert(argv[index + 1] && !argv[index + 1].startsWith('--'), `Missing value for ${key}`); options[key.slice(2)] = argv[++index]; }
  }
  return options;
}

export function importSnapshot(options) {
  const source = resolve(options.source ?? '');
  assert(options.source, '--source is required (official repository checkout)');
  const snapshotSha = options.snapshot;
  assert(/^[a-f0-9]{40}$/.test(snapshotSha ?? ''), '--snapshot must be a pinned 40-character commit SHA');
  assert(git(source, 'rev-parse', 'HEAD') === snapshotSha, 'Checkout HEAD differs from --snapshot');
  assert(git(source, 'status', '--porcelain', '--untracked-files=all', '--', REVIEWED_PATH) === '', 'Reviewed repository files are modified or untracked');
  const snapshotCommittedAt = git(source, 'show', '-s', '--format=%cI', snapshotSha);
  const verifiedAt = options['verified-at'];
  const publishedFrom = options.from ?? '2022-11-01T00:00:00Z';
  const publishedThrough = options.through ?? snapshotCommittedAt;
  for (const [key, value] of Object.entries({ verifiedAt, publishedFrom, publishedThrough })) assert(isTimestamp(value), `Invalid ${key}; use a UTC ISO timestamp`);
  assert(Date.parse(publishedFrom) <= Date.parse(publishedThrough), 'Invalid publication window');
  assert(Date.parse(snapshotCommittedAt) <= Date.parse(verifiedAt), 'Verification precedes the source snapshot');
  assert(Date.parse(publishedThrough) <= Date.parse(verifiedAt), 'Window ends after verification');
  const root = resolve(options.root ?? DEFAULT_ROOT);
  const paths = git(source, 'ls-tree', '-r', '--name-only', snapshotSha, '--', REVIEWED_PATH).split('\n').filter(path => path.endsWith('.json')).sort(compare);
  assert(paths.length > 0, 'Source tree contains no reviewed advisory JSON');
  const auditRows = [];
  const imported = [];
  const failures = [];
  const counts = { reviewedFiles: paths.length, eligibleAdvisories: 0, coveredEligibleAdvisories: 0, importedAdvisories: 0, importedRecords: 0, includedRecords: 0, duplicateAliasRecords: 0, curatedRecords: 0, curatedOverlays: 0, curatedOutsideScope: 0, withdrawnAdvisories: 0, excludedBeforeWindow: 0, excludedAfterWindow: 0, excludedUnsupportedEcosystem: 0, excludedUnsupportedAffectedPackages: 0, retainedAdditionalAffectedPackages: 0, failed: 0, conflictedRecords: 0, newerDatabaseRecords: 0, byEcosystem: Object.fromEntries(Object.values(ECOSYSTEMS).map(key => [key, 0])), byPublicationYear: {} };
  const allContent = createHash('sha256');
  const eligibleContent = createHash('sha256');
  for (const path of paths) {
    try {
      const bytes = readFileSync(resolve(source, path));
      const sha256 = hash(bytes);
      allContent.update(`${path}\0${sha256}\n`);
      const advisory = JSON.parse(bytes.toString('utf8'));
      assert(isTimestamp(advisory.published), 'Missing or invalid published timestamp');
      assert(Array.isArray(advisory.affected), 'Missing affected array');
      // Missing coordinates are source failures, never evidence that an advisory
      // belongs to an unsupported ecosystem (including otherwise excluded rows).
      for (const entry of advisory.affected) {
        assert(isText(entry?.package?.ecosystem), 'Affected package has no ecosystem');
        assert(isText(entry?.package?.name), 'Affected package has no name');
      }
      assert(advisory.database_specific?.github_reviewed === true, 'File in reviewed tree is not marked github_reviewed');
      const row = { path, sha256, id: advisory.id, publishedAt: advisory.published };
      if (Date.parse(advisory.published) < Date.parse(publishedFrom)) { row.status = 'before-window'; counts.excludedBeforeWindow++; }
      else if (Date.parse(advisory.published) > Date.parse(publishedThrough)) { row.status = 'after-window'; counts.excludedAfterWindow++; }
      else if (!advisory.affected.some(item => Object.hasOwn(ECOSYSTEMS, item?.package?.ecosystem))) { row.status = 'unsupported-ecosystem'; counts.excludedUnsupportedEcosystem++; }
      else {
        row.status = 'included';
        row.additionalAffectedPackages = advisory.affected.filter(item => !Object.hasOwn(ECOSYSTEMS, item?.package?.ecosystem)).map(item => clone(item.package));
        counts.retainedAdditionalAffectedPackages += row.additionalAffectedPackages.length;
        counts.eligibleAdvisories++;
        if (advisory.withdrawn) counts.withdrawnAdvisories++;
        for (const ecosystem of unique(advisory.affected.map(item => ECOSYSTEMS[item.package.ecosystem]).filter(Boolean))) counts.byEcosystem[ecosystem]++;
        const year = advisory.published.slice(0, 4);
        counts.byPublicationYear[year] = (counts.byPublicationYear[year] ?? 0) + 1;
        const normalized = normalizeAdvisory(advisory, { path, snapshotSha, verifiedAt });
        for (const field of ['publishedAt', 'modifiedAt', 'withdrawnAt']) if (normalized[field]) assert(Date.parse(normalized[field]) <= Date.parse(verifiedAt), `${field} occurs after verification`);
        imported.push(normalized);
        eligibleContent.update(`${path}\0${sha256}\n`);
      }
      auditRows.push(row);
    } catch (error) { failures.push({ path, error: error.message }); }
  }
  // Fail closed: never replace a successful data artifact with a partial import.
  if (failures.length) throw new Error(`Import refused: ${failures.length} source failures\n${JSON.stringify(failures, null, 2)}`);
  const curatedDirectory = resolve(root, 'src/data/vulnerabilities');
  const curated = readdirSync(curatedDirectory).filter(file => file.endsWith('.json')).sort(compare).map(file => {
    const record = JSON.parse(readFileSync(resolve(curatedDirectory, file), 'utf8'));
    assert(file === `${record.id}.json`, `Curated filename mismatch: ${file}`);
    return record;
  });
  const merged = mergeWithCurated(imported, curated, { snapshotSha, verifiedAt });
  Object.assign(counts, merged.stats, { importedAdvisories: imported.length, curatedRecords: curated.length, includedRecords: merged.records.length, coveredEligibleAdvisories: merged.advisoryRecordIds.size });
  counts.duplicateAliasRecords = imported.length - counts.importedRecords;
  assert(counts.coveredEligibleAdvisories === counts.eligibleAdvisories, 'Eligible advisory coverage gap');
  assert(counts.reviewedFiles === counts.eligibleAdvisories + counts.excludedBeforeWindow + counts.excludedAfterWindow + counts.excludedUnsupportedEcosystem, 'Source denominator does not reconcile');
  for (const row of auditRows) if (row.status === 'included') row.recordId = merged.advisoryRecordIds.get(row.id);
  const dataPath = 'src/data/vulnerability-imported.json';
  const auditPath = 'docs/data/vulnerability-import-audit.json';
  const coveragePath = 'src/data/vulnerability-coverage.json';
  const data = `[\n${merged.records.map(record => JSON.stringify(record)).join(',\n')}\n]\n`;
  const contentSha256 = allContent.digest('hex');
  const eligibleContentSha256 = eligibleContent.digest('hex');
  const curatedContentSha256 = hash(curated.map(record => JSON.stringify(record)).join('\n'));
  const audit = JSON.stringify({ schemaVersion: 1, snapshotSha, contentSha256, eligibleContentSha256, curatedContentSha256, hashAlgorithm: 'sha256(concat(sorted relativePath + NUL + sha256(original bytes) + LF))', records: auditRows }, null, 2) + '\n';
  const manifest = {
    schemaVersion: 1,
    source: { name: 'GitHub Advisory Database', repository: REPOSITORY, snapshotSha, snapshotCommittedAt, snapshotUrl: `${REPOSITORY}/commit/${snapshotSha}`, reviewedPath: REVIEWED_PATH, license: 'CC-BY-4.0', licenseUrl: `${REPOSITORY}/blob/${snapshotSha}/LICENSE.md` },
    window: { publishedFrom, publishedThrough }, verifiedAt, ecosystems: ECOSYSTEMS, counts, contentSha256, eligibleContentSha256, curatedContentSha256,
    artifacts: { data: { path: dataPath, sha256: hash(data) }, audit: { path: auditPath, sha256: hash(audit) } },
    reproduction: {
      prepareSource: ['git init advisory-database', `git -C advisory-database remote add origin ${REPOSITORY}.git`, 'git -C advisory-database sparse-checkout init --cone', 'git -C advisory-database sparse-checkout set advisories/github-reviewed', `git -C advisory-database fetch --depth=1 --filter=blob:none origin ${snapshotSha}`, `git -C advisory-database checkout --detach ${snapshotSha}`],
      command: `node scripts/import-reviewed-advisories.mjs --source ../advisory-database --snapshot ${snapshotSha} --verified-at ${verifiedAt} --from ${publishedFrom} --through ${publishedThrough}`,
    },
    failures,
  };
  const manifestContent = JSON.stringify(manifest, null, 2) + '\n';
  // CI may recreate disposable large assets, but must never rewrite its committed expectations.
  if (options['verify-against']) assert(readFileSync(resolve(root, options['verify-against']), 'utf8') === manifestContent, 'Generated coverage differs from committed manifest; refusing to replace expected hashes');
  const artifacts = [[dataPath, data], [auditPath, audit], ...(options['verify-against'] ? [] : [[coveragePath, manifestContent]])];
  for (const [path, content] of artifacts) {
    const destination = resolve(root, path);
    if (options.check) assert(readFileSync(destination, 'utf8') === content, `Generated artifact differs: ${path}`);
    else { mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, content); }
  }
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseOptions(process.argv.slice(2));
    const manifest = importSnapshot(options);
    console.log(JSON.stringify({ ok: true, check: Boolean(options.check), snapshot: manifest.source.snapshotSha, counts: manifest.counts, contentSha256: manifest.contentSha256 }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
