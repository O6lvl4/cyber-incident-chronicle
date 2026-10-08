import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

test('failed full-corpus loading releases the worker and retries the complete SQL database', async () => {
  const source = readFileSync(new URL('../src/lib/duckdb.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  // Keep the production boot/cache/table logic; replace only the browser/WASM platform.
  const stubbed = compiled.replace(/async function loadBundles\(\) \{[\s\S]*?(?=async function boot\()/, 'async function loadBundles() { return globalThis.__duckdbRetryPlatform; }\n');
  const { getDb } = await import(`data:text/javascript;base64,${Buffer.from(stubbed).toString('base64')}`);
  const oldWorker = globalThis.Worker;
  let workers = 0, terminated = 0, fetches = 0;
  const registered = [], queries = [];
  globalThis.Worker = class { constructor() { workers++; } terminate() { terminated++; } };
  globalThis.__duckdbRetryPlatform = { bundles: {}, lib: {
    selectBundle: async () => ({ mainWorker: 'fixture', mainModule: 'fixture' }),
    VoidLogger: class {},
    AsyncDuckDB: class {
      constructor(_logger, worker) { this.worker = worker; }
      async instantiate() {}
      async terminate() { this.worker.terminate(); }
      async registerFileText(name) { registered.push(name); }
      async connect() { return { query: async sql => { queries.push(sql); }, close: async () => {} }; }
    },
  } };
  const data = { threads: [], events: [], incidents: [], links: [], loadVulnerabilities: async () => {
    fetches++;
    if (fetches === 1) throw new Error('Full advisory fetch failed');
    return [{ id: 'GHSA-fixture' }];
  } };
  try {
    const failed = getDb(data);
    assert.equal(getDb(data), failed, 'concurrent first requests share the same boot');
    await assert.rejects(failed, /Full advisory fetch failed/);
    assert.equal(terminated, 1, 'the failed boot leaves no WASM worker running');
    const retry = getDb(data);
    assert.notEqual(retry, failed);
    assert.equal(getDb(data), retry, 'concurrent retries share one replacement boot');
    const db = await retry;
    assert.equal(await getDb(data), db);
    assert.equal(workers, 2);
    assert.equal(fetches, 2);
    assert.deepEqual(registered, ['threads.json', 'events.json', 'incidents.json', 'vulnerabilities.json']);
    assert.ok(queries.some(sql => sql.startsWith('CREATE TABLE vulnerabilities')));
    assert.ok(queries.some(sql => sql.startsWith('CREATE TABLE incidents')));
  } finally {
    globalThis.Worker = oldWorker;
    delete globalThis.__duckdbRetryPlatform;
  }
});
