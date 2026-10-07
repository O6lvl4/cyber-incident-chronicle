import { useCallback, useEffect, useRef, useState } from 'react';
import type { AsyncDuckDB } from '@duckdb/duckdb-wasm';
import { getDb, runQuery, type Dataset, type QueryResult } from '../lib/duckdb';

export type DbStatus = 'booting' | 'ready' | 'error';

export interface DuckDBHandle {
  status: DbStatus;
  error: string | null;
  run: (sql: string) => Promise<QueryResult>;
}

/** Boots DuckDB-WASM once `enabled` becomes true (the SQL console is opened) and exposes a query runner. */
export function useDuckDB(data: Dataset, enabled: boolean): DuckDBHandle {
  const [status, setStatus] = useState<DbStatus>('booting');
  const [error, setError] = useState<string | null>(null);
  const dbRef = useRef<AsyncDuckDB | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    getDb(data)
      .then(db => { if (alive) { dbRef.current = db; setStatus('ready'); } })
      .catch((e: unknown) => { if (alive) { setError(String(e)); setStatus('error'); } });
    return () => { alive = false; };
  }, [data, enabled]);

  const run = useCallback(async (sql: string) => {
    const db = dbRef.current;
    if (!db) throw new Error('DuckDB はまだ起動中です');
    return runQuery(db, sql);
  }, []);

  return { status, error, run };
}
