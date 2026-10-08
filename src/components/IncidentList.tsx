import type { ReactNode } from 'react';
import type { Incident } from '../types';
import { STATUS_LABELS, companyCount } from '../lib/incidents';
interface Props { hidden?: boolean; incidents: Incident[]; total: number; selectedId?: string; onSelect: (id: string) => void; onReset: () => void; viewTabs?: ReactNode }
export default function IncidentList({ hidden, incidents, total, selectedId, onSelect, onReset, viewTabs }: Props) {
  return <section id="incident-list-panel" role="tabpanel" aria-labelledby="incident-list-panel-tab" hidden={hidden} className="incident-list research-list research-incidents" aria-label="企業別の事案一覧">
    <div className="list-heading"><div><h2 id="incident-results-heading" tabIndex={-1}>事案一覧</h2></div>
      <span className="count-badge" aria-live="polite">{incidents.length}<small className={incidents.length === total ? 'sr-only' : undefined}> / {total}</small><span className="sr-only"> 事案</span></span>{viewTabs}</div>
    <p className="list-note">{companyCount(incidents)}社 · 収録した公表日の新しい順</p>
    <div className="incident-scroll">
      <div className="research-columns incident-columns" aria-hidden="true"><span>公表日</span><span>企業・組織</span><span>事案</span><span>公表状況</span><span/></div>
      {incidents.length === 0 && <div className="empty-state"><p>条件に合う事案がありません</p><button className="n-btn" onClick={onReset}>絞り込みを解除</button></div>}
      {incidents.map(item => <button key={item.id} className={`incident-card${selectedId === item.id ? ' selected' : ''}`} onClick={() => onSelect(item.id)} aria-pressed={selectedId === item.id}>
          <span className="incident-card-top"><time dateTime={item.announcementDate}>{item.announcementDate.replace(/-/g, '.')}</time></span>
          <strong>{item.company}</strong>
          <span className="incident-card-title">{item.title}</span>
          <span className="status-badge" data-status={item.disclosureStatus}>{STATUS_LABELS[item.disclosureStatus]}</span>
          <span className="card-arrow" aria-hidden="true">↗</span>
        </button>)}
      <p className="list-footer">一次資料に基づく選定事例です。企業の安全性を評価するものではありません</p>
    </div>
  </section>;
}
