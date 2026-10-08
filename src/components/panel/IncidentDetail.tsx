import { INCIDENTS_BY_ID, THREADS } from '../../data';
import type { TimelineEvent } from '../../types';
import { METHOD_STATUS, STATUS_LABELS } from '../../lib/incidents';
import ClassificationDetail from './ClassificationDetail';
function countStatus(status: string) {
  const labels: Record<string, string> = { confirmed: '確認済み', possible: '可能性あり', investigating: '調査中', maximum: '最大' };
  return labels[status] ?? status;
}
export default function IncidentDetail({ ev }: { ev: TimelineEvent }) {
  const item = INCIDENTS_BY_ID.get(ev.incidentId ?? '');
  if (!item) return null;
  return <article className="panel-body incident-detail">
    <span className="eyebrow">PUBLIC DISCLOSURE / 事案記録</span>
    <h2>{item.company}</h2><p className="detail-title">{item.title}</p>
    <span className="status-badge" data-status={item.disclosureStatus}>{STATUS_LABELS[item.disclosureStatus]}</span>
    {item.geography && <p className="method-note">対象地域・範囲：{item.geography}</p>}
    <p className="detail-summary">{item.summary}</p>
    <dl className="date-grid">
      <div><dt>収録した公表日</dt><dd>{item.announcementDate}</dd></div>
      <div><dt>{item.occurredDateLabel || '発生・検知日'}</dt><dd>{item.occurredDate ?? '未公表・不明'}</dd></div>
      <div><dt>収録した最終公表日</dt><dd>{item.updatedDate}</dd></div>
      <div><dt>資料の最終確認日</dt><dd>{item.lastVerifiedDate}</dd></div>
    </dl>
    <h3>公表された影響・可能性</h3>
    <div className="detail-tags">{item.impactTypes.map(type => <span key={type}>{THREADS.find(t => t.id === type)?.name}</span>)}</div>
    <p className="method-note">攻撃手法：{item.attackMethod.label}（{METHOD_STATUS[item.attackMethod.status]}）</p>
    <ClassificationDetail item={item}/>
    {item.affectedData.length > 0 && <><h3>対象情報</h3><ul>{item.affectedData.map(text => <li key={text}>{text}</li>)}</ul></>}
    {item.counts.length > 0 && <><h3>公表された規模</h3><ul>{item.counts.map((count, index) => <li key={index}><strong>{count.approximate ? '約' : ''}{count.value.toLocaleString('ja-JP')}{count.unit}</strong> {count.label} <span className="muted">({countStatus(count.status)})</span></li>)}</ul><p className="fine-print">人数・件数・メール数など、単位や対象の異なる値は合算しません</p></>}
    {item.caveats && item.caveats.length > 0 && <><h3>解釈上の注意</h3><ul>{item.caveats.map(note => <li key={note}>{note}</li>)}</ul></>}
    <h3>同じ事案の経過</h3>
    <ol className="updates">{item.timeline.map((update, index) => <li key={`${update.date}-${index}`}><time dateTime={update.date}>{update.date}</time><strong>{update.label}</strong><p>{update.summary}</p><a href={update.sourceUrl} target="_blank" rel="noopener noreferrer">この公表資料を読む ↗</a></li>)}</ol>
    <h3>一次資料</h3>
    <ul className="sources">{item.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a><span>公表日 {source.publishedDate}</span></li>)}</ul>
    <p className="fine-print">内容は確認日時点の公表資料に基づきます。「流出は確認されず」は、流出がなかったと断定するものではありません。</p>
  </article>;
}
