import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import type { DuckDBHandle } from '../../hooks/useDuckDB';
import type { QueryResult } from '../../lib/duckdb';
import { PRESETS } from '../../lib/presets';

interface Props {
  db: DuckDBHandle;
  knownIds: Set<string>;
  onSelect: (id: string) => void;
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

function ResultTable({ result, knownIds, onSelect }: { result: QueryResult; knownIds: Set<string>; onSelect: (id: string) => void }) {
  const idCol = result.columns.indexOf('id');
  return (
    <div className="sql-result">
      <div className="sql-meta">{result.rows.length} 行 · {result.ms.toFixed(1)} ms</div>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr>{result.columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {result.rows.map((row, i) => {
              const id = idCol >= 0 ? String(row[idCol]) : '';
              const clickable = knownIds.has(id);
              return (
                <tr key={i} className={clickable ? 'clickable' : undefined}
                  onClick={clickable ? () => onSelect(id) : undefined}>
                  {row.map((v, j) => <td key={j}>{cell(v)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusLine({ db }: { db: DuckDBHandle }) {
  if (db.status === 'ready') return <span className="db-status ok">DuckDB-WASM ready · tables: incidents (事案), events (レーン表示), threads</span>;
  if (db.status === 'error') return <span className="db-status err">DuckDB の起動に失敗: {db.error}</span>;
  return <span className="db-status">DuckDB-WASM を起動中…</span>;
}

/** In-browser SQL over the timeline data, powered by DuckDB-WASM. */
export default function SqlConsole({ db, knownIds, onSelect }: Props) {
  const [sql, setSql] = useState(PRESETS[0].sql);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (text: string) => {
    setBusy(true);
    setError(null);
    try {
      setResult(await db.run(text));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, [db]);

  useEffect(() => {
    if (db.status === 'ready' && result === null && !error) void run(PRESETS[0].sql);
  }, [db.status, result, error, run]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void run(sql); }
  };

  return (
    <div className="panel-body sql-console">
      <div className="section-label">SQL · DuckDB-WASM</div>
      <StatusLine db={db} />
      <div className="preset-row">
        {PRESETS.map(p => (
          <button key={p.name} type="button" className="preset" disabled={busy || db.status !== 'ready'} onClick={() => { setSql(p.sql); void run(p.sql); }}>
            {p.name}
          </button>
        ))}
      </div>
      <textarea value={sql} onChange={e => setSql(e.target.value)} onKeyDown={onKeyDown} spellCheck={false} rows={7} aria-label="SQLクエリ" />
      <div className="sql-actions">
        <button type="button" className="n-btn active" disabled={busy || db.status !== 'ready'} onClick={() => void run(sql)}>
          実行 (⌘/Ctrl + Enter)
        </button>
        <span className="hint">id 列のある行はクリックでその出来事へ</span>
      </div>
      {error && <pre className="sql-error">{error}</pre>}
      {result && <ResultTable result={result} knownIds={knownIds} onSelect={onSelect} />}
    </div>
  );
}
