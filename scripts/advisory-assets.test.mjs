import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { buildBrowseAssets } from './prepare-advisory-assets.mjs';
import { loadVulnerabilities } from './vulnerability-status.mjs';
import { filterVulnerabilities, fixLabel } from '../src/lib/vulnerabilities.ts';

const records = loadVulnerabilities();
const coverage = JSON.parse(readFileSync(new URL('../src/data/vulnerability-coverage.json', import.meta.url), 'utf8'));
const sourceHash = coverage.artifacts.data.sha256;
const files = buildBrowseAssets(records, sourceHash);
const index = JSON.parse(files.get('index.json'));
const sha256 = value => createHash('sha256').update(value).digest('hex');

test('compact browse index retains every searchable identity, package, lifecycle, and status', () => {
  assert.equal(index.sourceSha256, sourceHash);
  assert.equal(index.records.length, records.length);
  const sourceById = new Map(records.map(item => [item.id, item]));
  for (const item of index.records) {
    const source = sourceById.get(item.id);
    assert.ok(source, item.id);
    assert.deepEqual(item.aliases, source.aliases);
    assert.equal(item.title, source.title);
    assert.equal(item.summary ?? item.title, source.summary);
    assert.equal(item.publishedAt, source.publishedAt);
    assert.equal(item.modifiedAt, source.modifiedAt);
    assert.equal(item.withdrawnAt, source.withdrawnAt);
    assert.deepEqual(item.affected, source.affected.map(({ ecosystem, packageName }) => ({ ecosystem, packageName })));
    assert.equal(fixLabel(item), fixLabel(source));
    assert.equal(item.severity.label, source.severity.label);
  }
  const oldest = [...records].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))[0];
  assert.ok(filterVulnerabilities(index.records, 'all', oldest.id).some(item => item.id === oldest.id));
});

test('stable bounded detail shards partition the full source without dropping or rewriting evidence', () => {
  const collected = new Map();
  for (const shard of Object.values(index.shards)) {
    const body = files.get(shard.file);
    assert.equal(sha256(body), shard.sha256);
    const items = JSON.parse(body);
    assert.equal(items.length, shard.records);
    assert.ok(Buffer.byteLength(body) <= 1024 * 1024, `${shard.file} exceeds the one-MiB detail budget`);
    for (const item of items) { assert.ok(!collected.has(item.id)); collected.set(item.id, item); }
  }
  assert.equal(collected.size, records.length);
  for (const item of records) assert.deepEqual(collected.get(item.id), item);
  assert.ok(Buffer.byteLength(files.get('index.json')) < 10 * 1024 * 1024, 'browse index stays below ten MiB raw');
  assert.ok(index.records.every(item => !('sources' in item) && !('provenance' in item)), 'heavy evidence is deferred to detail shards');
});
