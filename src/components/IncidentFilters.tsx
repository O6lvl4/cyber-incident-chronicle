import { useState } from 'react';
import type { Thread } from '../types';
import type { AppState } from '../hooks/useAppState';
import { threadColor } from '../lib/palette';
import { STATUS_LABELS } from '../lib/incidents';
import ClassificationFilters from './ClassificationFilters';
interface Props { threads: Thread[]; state: AppState; resultCount: number; onShowResults: () => void }
export default function IncidentFilters({ threads, state, resultCount, onShowResults }: Props) {
  const [expanded, setExpanded] = useState(false);
  const secondaryActive = state.status !== 'all' || state.activeIds.length !== threads.length;
  return <>
    <button className="secondary-filter-toggle" aria-expanded={expanded} aria-controls="incident-impact-filters" onClick={() => setExpanded(value => !value)}>
      影響・確認状況{secondaryActive ? ' ●' : ''}
    </button>
    <div id="incident-impact-filters" className="impact-filters" data-expanded={expanded}>
      <span className="filter-label">影響で絞る</span>
      <div className="chips" aria-label="影響の種類">
        {threads.map(thread => <button key={thread.id} className="thread-chip" aria-pressed={state.activeIds.includes(thread.id)}
          onClick={() => state.toggleLane(thread.id)} style={{ '--chip-color': threadColor(thread, state.dark) } as React.CSSProperties}>
          <span className="dot" aria-hidden="true"/>{thread.name}</button>)}
      </div>
      <label className="status-filter"><span className="sr-only">情報流出の確認状況</span>
        <select value={state.status} onChange={event => state.setStatus(event.target.value)} aria-label="情報流出の確認状況">
          <option value="all">確認状況：すべて</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>
    <label className="search-wrap"><span className="sr-only">企業名・事案を検索</span>
      <input value={state.query} onChange={event => state.setQuery(event.target.value)} placeholder="企業名・キーワード" aria-label="企業名・事案を検索"/>
      <span className="search-icon" aria-hidden="true">⌕</span>
    </label>
    <ClassificationFilters secondaryActive={secondaryActive} state={state} resultCount={resultCount} onShowResults={onShowResults}/>
  </>;
}
