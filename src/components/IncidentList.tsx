import type { Incident } from '../types';
import { STATUS_LABELS, companyCount } from '../lib/incidents';
interface Props { incidents: Incident[]; total: number; selectedId?: string; onSelect: (id: string) => void; onReset: () => void }
export default function IncidentList({ incidents, total, selectedId, onSelect, onReset }: Props) {
  return <section className="incident-list" aria-label="企業別の事案一覧">
    <div className="list-heading"><div><span className="eyebrow">INCIDENT INDEX</span><h2>公表された事案</h2></div>
      <span className="count-badge" aria-live="polite">{incidents.length}<small> / {total}</small></span></div>
    <p className="list-note">{companyCount(incidents)}社・{incidents.length}事案 / 収録した公表日の新しい順</p>
    <div className="incident-scroll">
      {incidents.length === 0 && <div className="empty-state"><p>条件に合う事案がありません</p><button className="n-btn" onClick={onReset}>絞り込みを解除</button></div>}
      {incidents.map(item => <button key={item.id} className={`incident-card${selectedId === item.id ? ' selected' : ''}`} onClick={() => onSelect(item.id)} aria-pressed={selectedId === item.id}>
          <span className="incident-card-top"><time dateTime={item.announcementDate}>{item.announcementDate.replace(/-/g, '.')}</time><span className="card-arrow" aria-hidden="true">↗</span></span>
          <strong>{item.company}</strong>
          <span className="incident-card-title">{item.title}</span>
          <span className="status-badge" data-status={item.disclosureStatus}>{STATUS_LABELS[item.disclosureStatus]}</span>
        </button>)}
    </div>
    <p className="list-footer">一次資料ベースの選定事例<br/>企業の安全性を評価するものではありません</p>
  </section>;
}
