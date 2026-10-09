import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildClassificationIndexes, prepareClassificationIndexes } from './classification-index.mjs';

const families = [
  ['entities', 'EntityClassification', 'ENTITIES'],
  ['attack-classifications', 'AttackClassification', 'ATTACKS'],
];

function fixture(t, count) {
  const directory = mkdtempSync(join(tmpdir(), 'classification-index-'));
  const root = pathToFileURL(`${directory}/`);
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(new URL('package.json', root), JSON.stringify({ type: 'module' }));
  for (const [folder] of families) {
    mkdirSync(new URL(`${folder}/`, root));
    for (let index = count - 1; index >= 0; index--) {
      const id = `record-${String(index).padStart(3, '0')}`;
      writeFileSync(new URL(`${folder}/${id}.json`, root), JSON.stringify({ id, nested: { folder } }));
    }
    writeFileSync(new URL(`${folder}/README.md`, root), 'Not a source record');
  }
  return root;
}

for (const count of [0, 1, 100, 101, 200, 201]) {
  test(`${count} records produce deterministic bounded parts and complete sorted barrel exports`, async t => {
    const root = fixture(t, count);
    const output = prepareClassificationIndexes({ root });
    assert.deepEqual(buildClassificationIndexes(root), output);
    assert.deepEqual(prepareClassificationIndexes({ root, check: true }), output);
    for (const [folder, type, exportName] of families) {
      const sourceFiles = readdirSync(new URL(`${folder}/`, root)).filter(name => name.endsWith('.json')).sort();
      const parts = [...output.keys()].filter(name => name.startsWith(`${folder}-index-part-`));
      assert.equal(parts.length, Math.ceil(count / 100));
      const collectedKeys = [];
      for (const [index, name] of parts.entries()) {
        const content = output.get(name);
        const keys = [...content.matchAll(/^  ("[^"]+"): record\d+,$/gm)].map(match => JSON.parse(match[1]));
        collectedKeys.push(...keys);
        assert.deepEqual(keys, sourceFiles.slice(index * 100, (index + 1) * 100).map(file => file.slice(0, -5)));
        assert.equal((content.match(/^import record/gm) ?? []).length, keys.length);
        for (const [recordIndex, key] of keys.entries()) {
          assert.ok(content.includes(`import record${recordIndex} from './${folder}/${key}.json' with { type: 'json' };`));
          assert.ok(content.includes(`  ${JSON.stringify(key)}: record${recordIndex},`));
        }
        assert.ok(content.split('\n').length <= 300, `${name} exceeds the unchanged line limit`);
      }
      assert.equal(new Set(collectedKeys).size, count, 'each record appears in exactly one part');
      assert.deepEqual(collectedKeys, sourceFiles.map(file => file.slice(0, -5)));
      const barrelName = `${folder}-index.ts`;
      const barrel = output.get(barrelName);
      assert.ok(barrel.includes(`export const ${exportName} = {`));
      assert.ok(barrel.includes(`} as Record<string, ${type}>;`));
      const records = (await import(new URL(barrelName, root).href))[exportName];
      assert.deepEqual(Object.keys(records), collectedKeys);
      for (const key of collectedKeys) {
        assert.deepEqual(records[key], JSON.parse(readFileSync(new URL(`${folder}/${key}.json`, root), 'utf8')));
      }
    }
  });
}

test('check rejects each missing or modified barrel and part without writing repairs', t => {
  const root = fixture(t, 101);
  const output = prepareClassificationIndexes({ root });
  for (const [name, content] of output) {
    const target = new URL(name, root);
    unlinkSync(target);
    assert.throws(() => prepareClassificationIndexes({ root, check: true }), /Missing or stale classification index/);
    assert.equal(existsSync(target), false);
    writeFileSync(target, '// Changed generated file\n');
    assert.throws(() => prepareClassificationIndexes({ root, check: true }), /Missing or stale classification index/);
    assert.equal(readFileSync(target, 'utf8'), '// Changed generated file\n');
    writeFileSync(target, content);
  }
  assert.doesNotThrow(() => prepareClassificationIndexes({ root, check: true }));
});

test('check detects obsolete parts; regeneration removes only obsolete generated parts', t => {
  const root = fixture(t, 101);
  prepareClassificationIndexes({ root });
  const unrelated = ['entities-index-notes.ts', 'incidents-index-part-1.ts'];
  for (const name of unrelated) writeFileSync(new URL(name, root), '// Keep this file\n');
  for (const [folder] of families) {
    const obsolete = new URL(`${folder}-index-part-old.ts`, root);
    writeFileSync(obsolete, '// Obsolete generated part\n');
    assert.throws(() => prepareClassificationIndexes({ root, check: true }), /Obsolete classification index parts/);
    assert.equal(existsSync(obsolete), true, 'check is read-only');
    prepareClassificationIndexes({ root });
    assert.equal(existsSync(obsolete), false);
    unlinkSync(new URL(`${folder}/record-100.json`, root));
    assert.throws(() => prepareClassificationIndexes({ root, check: true }), /Obsolete classification index parts/);
    prepareClassificationIndexes({ root });
    assert.equal(existsSync(new URL(`${folder}-index-part-2.ts`, root)), false);
  }
  for (const name of unrelated) assert.equal(readFileSync(new URL(name, root), 'utf8'), '// Keep this file\n');
  assert.doesNotThrow(() => prepareClassificationIndexes({ root, check: true }));
});

test('committed barrel exports contain every source record unchanged and in sorted order', async () => {
  const root = new URL('../src/data/', import.meta.url);
  for (const [folder, , exportName] of families) {
    const records = (await import(new URL(`${folder}-index.ts`, root).href))[exportName];
    const sourceFiles = readdirSync(new URL(`${folder}/`, root)).filter(name => name.endsWith('.json')).sort();
    assert.deepEqual(Object.keys(records), sourceFiles.map(name => name.slice(0, -5)));
    for (const name of sourceFiles) {
      assert.deepEqual(records[name.slice(0, -5)], JSON.parse(readFileSync(new URL(`${folder}/${name}`, root), 'utf8')));
    }
  }
});
