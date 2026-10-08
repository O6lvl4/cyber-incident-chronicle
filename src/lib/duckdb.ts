import type { Vulnerability } from '../vulnerabilityTypes';
import type * as duckdb from '@duckdb/duckdb-wasm';
import type { Incident, Link, Thread, TimelineEvent } from '../types';

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  ms: number;
}

export interface Dataset {
  threads: Thread[];
  events: TimelineEvent[];
  links: Link[];
  incidents: Incident[];
  loadVulnerabilities: () => Promise<Vulnerability[]>;
}

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;

/** The DuckDB library and its bundles are loaded on demand so the first paint does not pay for them. */
async function loadBundles() {
  const [lib, mvpWasm, mvpWorker, ehWasm, ehWorker] = await Promise.all([
    import('@duckdb/duckdb-wasm'),
    import('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'),
    import('@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'),
    import('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'),
    import('@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'),
  ]);
  const bundles: duckdb.DuckDBBundles = {
    mvp: { mainModule: mvpWasm.default, mainWorker: mvpWorker.default },
    eh: { mainModule: ehWasm.default, mainWorker: ehWorker.default },
  };
  return { lib, bundles };
}

async function boot(data: Dataset): Promise<duckdb.AsyncDuckDB> {
  const { lib, bundles } = await loadBundles();
  const bundle = await lib.selectBundle(bundles);
  const worker = new Worker(bundle.mainWorker!);
  const db = new lib.AsyncDuckDB(new lib.VoidLogger(), worker);
  try {
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    await loadTables(db, data);
    return db;
  } catch (error) {
    await db.terminate().catch(() => worker.terminate());
    throw error;
  }
}

async function loadTables(db: duckdb.AsyncDuckDB, data: Dataset) {
  const tables: [string, unknown[]][] = [
    ['threads', data.threads],
    ['events', data.events],
    ['incidents', data.incidents],
    ['vulnerabilities', await data.loadVulnerabilities()],
  ];
  const conn = await db.connect();
  try {
    for (const [name, rows] of tables) {
      await db.registerFileText(`${name}.json`, JSON.stringify(rows));
      await conn.query(`CREATE TABLE ${name} AS SELECT * FROM read_json_auto('${name}.json')`);
    }
    await conn.query('ALTER TABLE events ALTER date TYPE DATE');
    await conn.query('ALTER TABLE incidents ALTER announcementDate TYPE DATE');
    await conn.query('CREATE TABLE links ("from" VARCHAR, "to" VARCHAR, why VARCHAR)');
  } finally {
    await conn.close();
  }
}

/** Boots DuckDB-WASM once and loads the incident and advisory datasets as separate tables. */
export function getDb(data: Dataset): Promise<duckdb.AsyncDuckDB> {
  dbPromise ??= boot(data).catch(error => { dbPromise = null; throw error; });
  return dbPromise;
}

function plain(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === 'bigint') return Number(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object' && 'toArray' in (v as object)) return (v as { toArray(): unknown[] }).toArray().map(plain);
  return v;
}

export async function runQuery(db: duckdb.AsyncDuckDB, sql: string): Promise<QueryResult> {
  const t0 = performance.now();
  const conn = await db.connect();
  try {
    const table = await conn.query(sql);
    const columns = table.schema.fields.map(f => f.name);
    const rows = table.toArray().map(r => columns.map(c => plain(r[c])));
    return { columns, rows, ms: performance.now() - t0 };
  } finally {
    await conn.close();
  }
}
