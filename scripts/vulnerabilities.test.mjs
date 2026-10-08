import test from 'node:test';
import assert from 'node:assert/strict';
import { loadVulnerabilities, validateVulnerabilities } from './vulnerability-status.mjs';
import { filterVulnerabilities, projectVulnerabilities, fixLabel } from '../src/lib/vulnerabilities.ts';
import { readUrl, writeUrl } from '../src/lib/urlState.ts';
const records = loadVulnerabilities();
test('all selected advisories pass provenance and lifecycle validation', () => {
  assert.ok(records.length >= 3);
  assert.deepEqual(validateVulnerabilities(records), []);
  assert.ok(records.every(item => item.kind === 'vulnerability' && !('company' in item) && !('impactTypes' in item)));
});
test('same CVE in different GHSAs is rejected, including transitive alias overlap', () => {
  const a = structuredClone(records[0]);
  const b = structuredClone(records[1]);
  b.aliases.push(a.id);
  assert.match(validateVulnerabilities([a, b]).join(' '), /duplicate identity\/alias/);
  b.aliases = [...a.aliases];
  assert.match(validateVulnerabilities([a, b]).join(' '), /duplicate identity\/alias/);
});
test('malformed data is rejected without silently inventing dates or fixes', () => {
  const item = structuredClone(records[0]);
  item.modifiedAt = 'invalid'; item.withdrawnAt = 'yesterday'; item.affected[0].ranges[0].fixed = undefined;
  item.sources[0].url = 'http://example.com'; item.severity.cvss[0].score = 11;
  const errors = validateVulnerabilities([item]).join(' ');
  for (const phrase of ['invalid modifiedAt', 'invalid withdrawnAt', 'invalid or uncited affected/fixed range', 'invalid source', 'invalid CVSS score']) assert.ok(errors.includes(phrase), phrase);
  assert.doesNotThrow(() => validateVulnerabilities([null, {}]));
});
test('nullable fix and withdrawn advisory remain explicit history', () => {
  const item = structuredClone(records[0]);
  for (const pkg of item.affected) for (const range of pkg.ranges) range.fixed = null;
  assert.equal(fixLabel(item), '修正版未確認');
  assert.deepEqual(validateVulnerabilities([item]), []);
  item.withdrawnAt = item.modifiedAt;
  assert.equal(fixLabel(item), '撤回済み');
  assert.deepEqual(validateVulnerabilities([item]), []);
  assert.equal(filterVulnerabilities([item], 'all', '').length, 1);
});
test('multi-package ranges remain paired and project to one non-incident marker', () => {
  const multi = records.find(item => item.id === 'GHSA-fx2h-pf6j-xcff');
  assert.ok(multi);
  assert.equal(multi.affected.flatMap(pkg => pkg.ranges).length, 4);
  const events = projectVulnerabilities(records);
  assert.equal(events.length, records.length);
  assert.ok(events.every(event => event.vulnerabilityId === event.id && event.incidentId === undefined && event.threadId === 'vulnerabilities' && event.weight === 2));
  assert.ok(events.every(event => event.date === records.find(item => item.id === event.id).publishedAt.slice(0, 10)));
});
test('search finds aliases and package names, with independent ecosystem filter', () => {
  const record = records[0];
  assert.equal(filterVulnerabilities(records, 'all', record.aliases[0]).length, 1);
  assert.ok(filterVulnerabilities(records, 'npm', 'vite').every(item => item.affected.some(pkg => pkg.ecosystem === 'npm')));
  assert.equal(filterVulnerabilities(records, 'pip', 'vite').length, 0);
  assert.equal(filterVulnerabilities(records, 'all', 'no-matching-advisory').length, 0);
});
test('severity, exploitation and KEV need their own provenance', () => {
  const item = structuredClone(records[0]);
  item.severity.sourceUrl = null; item.exploitation.status = 'reported'; item.kev.status = 'listed';
  const errors = validateVulnerabilities([item]).join(' ');
  for (const phrase of ['uncited severity', 'uncited exploitation', 'uncited KEV check']) assert.ok(errors.includes(phrase));
});
test('category URL round-trip preserves selection and ecosystem; invalid category is ignored', () => {
  globalThis.location = { hash: '' }; globalThis.history = { replaceState: (_a, _b, value) => { location.hash = value; } };
  writeUrl({ kind: 'vulnerability', ecosystem: 'npm', query: 'CVE-2026', sel: records[0].id, dark: true });
  const read = readUrl();
  assert.equal(read.kind, 'vulnerability'); assert.equal(read.ecosystem, 'npm'); assert.equal(read.sel, records[0].id); assert.equal(read.query, 'CVE-2026');
  location.hash = '#kind=unknown'; assert.equal(readUrl().kind, undefined);
});

test('reject nested null entries, uncited unknown severity and API placeholders safely', () => {
  const item = structuredClone(records[0]); item.sources.push(null); item.affected.push(null); item.affected[0].ranges.push(null);
  item.severity.label = 'unknown'; item.severity.sourceUrl = 'http://example.com'; item.severity.cvss = [{ version: '3.1', score: 0, vector: null, sourceUrl: item.sources[0].url }, null];
  const errors = validateVulnerabilities([item]).join(' ');
  for (const phrase of ['invalid source', 'invalid package', 'invalid affected range', 'unknown severity must have null source', 'placeholder', 'invalid CVSS']) assert.ok(errors.includes(phrase));
});
test('an advisory outside the declared window requires a coverage update', () => {
  const item = structuredClone(records[0]); item.publishedAt = '2020-01-01T00:00:00Z';
  assert.match(validateVulnerabilities([item]).join(' '), /outside vulnerability coverage window/);
});
