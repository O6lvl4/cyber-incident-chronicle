import type { ReactNode } from 'react';
import CategoryNav, { type CategoryProps } from './CategoryNav';
import type { Thread } from '../types';
import type { AppState } from '../hooks/useAppState';
import { META } from '../data';
import IncidentFilters from './IncidentFilters';
interface Props extends CategoryProps { filters?: ReactNode; resultCount?: number; onShowResults?: () => void; threads: Thread[]; state: AppState; onFitAll: () => void }
export default function Header({ threads, state, onFitAll, category, onCategoryChange, filters, resultCount = 0, onShowResults = onFitAll }: Props) {
  return <header className="app-header">
    <div className="header-top">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); onFitAll(); }} aria-label="Cyber Incident Chronicle 全期間表示">
        <span className="brand-symbol" aria-hidden="true">◈</span>
        <span><span className="brand-main">Cyber Incident</span><span className="brand-sub">CHRONICLE / セキュリティの記録</span></span>
      </a>
      <CategoryNav category={category} onCategoryChange={onCategoryChange}/>
      {category === 'incident' && <span className="brand-range">公表・更新 {META.windowStart.replace(/-/g, '.')} – {META.windowEnd.replace(/-/g, '.')}</span>}
      <div className="header-actions">
        <button className="n-btn quiet" onClick={state.toggleAbout} aria-expanded={state.aboutOpen}>掲載方針</button>
        <button className={`n-btn quiet${state.sqlOpen ? ' active' : ''}`} onClick={state.toggleSql} title="端末内でデータを照会">SQL</button>
        <button className="n-btn theme-toggle" onClick={state.toggleDark} aria-label="テーマ切替">{state.dark ? '☀' : '☾'}</button>
      </div>
    </div>
    <div className="header-filters">{filters ?? <IncidentFilters threads={threads} state={state} resultCount={resultCount} onShowResults={onShowResults}/>}</div>
  </header>;
}
