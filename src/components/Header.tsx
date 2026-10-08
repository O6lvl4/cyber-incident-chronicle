import type { ReactNode } from 'react';
import CategoryNav, { type CategoryProps } from './CategoryNav';
import type { Thread } from '../types';
import type { AppState } from '../hooks/useAppState';
import { threadColor } from '../lib/palette';
import { META } from '../data';
import { STATUS_LABELS } from '../lib/incidents';
import ClassificationFilters from './ClassificationFilters';
interface Props extends CategoryProps { filters?: ReactNode; threads: Thread[]; state: AppState; onFitAll: () => void }
export default function Header({ threads, state, onFitAll, category, onCategoryChange, filters }: Props) {
  return <header className="app-header">
    <div className="header-top">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); onFitAll(); }} aria-label="Cyber Incident Chronicle 全期間表示">
        <span className="brand-symbol" aria-hidden="true">◈</span>
        <span><span className="brand-main">Cyber Incident</span><span className="brand-sub">CHRONICLE / セキュリティの記録</span></span>
      </a>
      {category === 'incident' && <span className="brand-range">公表・更新 {META.windowStart.replace(/-/g, '.')} – {META.windowEnd.replace(/-/g, '.')}</span>}
      <div className="header-actions">
        <button className="n-btn quiet" onClick={state.toggleAbout} aria-expanded={state.aboutOpen}>掲載方針</button>
        <button className={`n-btn quiet${state.sqlOpen ? ' active' : ''}`} onClick={state.toggleSql} title="端末内でデータを照会">SQL</button>
        <button className="n-btn theme-toggle" onClick={state.toggleDark} aria-label="テーマ切替">{state.dark ? '☀' : '☾'}</button>
      </div>
    </div>
    <CategoryNav category={category} onCategoryChange={onCategoryChange}/>
    <div className="header-filters">{filters ?? <>
      <span className="filter-label">影響で絞る</span>
      <div className="chips" aria-label="影響の種類">
        {threads.map(thread => <button key={thread.id} className="thread-chip" aria-pressed={state.activeIds.includes(thread.id)}
          onClick={() => state.toggleLane(thread.id)} style={{ '--chip-color': threadColor(thread, state.dark) } as React.CSSProperties}>
          <span className="dot" aria-hidden="true"/>{thread.name}</button>)}
      </div>
      <label className="status-filter"><span className="sr-only">情報流出の確認状況</span>
        <select value={state.status} onChange={e => state.setStatus(e.target.value)} aria-label="情報流出の確認状況">
          <option value="all">確認状況：すべて</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="search-wrap"><span className="sr-only">企業名・事案を検索</span>
        <input value={state.query} onChange={e => state.setQuery(e.target.value)} placeholder="企業名・キーワード" aria-label="企業名・事案を検索"/>
        <span className="search-icon" aria-hidden="true">⌕</span>
      </label>
      {category === 'incident' && <ClassificationFilters state={state}/>}
    </>}</div>
  </header>;
}
