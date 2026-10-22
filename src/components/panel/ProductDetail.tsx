import type { ProductAdvisory } from '../../productTypes';
import { SEVERITY_LABELS } from '../../lib/vulnerabilities';
import { INCLUSION_LABELS, INCLUSION_ORDER, productFixLabel } from '../../lib/products';
const KEV_LABELS = { listed: '掲載を確認', notListed: '確認時点で未掲載', unknown: '未照合' };
const CHECK_LABELS = { found: '注意喚起あり', notFound: '確認時点で該当なし', failed: '取得失敗（未確認）' };
const utc = (value: string) => `${value.replace('T', ' ').replace('Z', '')} UTC`;
function AffectedTable({ item }: { item: ProductAdvisory }) {
  return <>
    <h3>影響するバージョンと修正版</h3>
    <table className="version-table"><thead><tr><th scope="col">製品・系列</th><th scope="col">影響範囲（出典の表記）</th><th scope="col">対応する修正版</th></tr></thead>
      <tbody>{item.affected.map(range => <tr key={range.name}><td>{range.name}</td><td>{range.affected}{range.note && <><br/><span className="muted">{range.note}</span></>}</td><td>{range.fixed ?? '未公表・未確認'}<br/><a href={range.sourceUrl} target="_blank" rel="noopener noreferrer">根拠 ↗</a></td></tr>)}</tbody>
    </table>
    <p className="fine-print">修正版はこの脆弱性に対する修正境界で、他の脆弱性も含めた最新の安全版を保証しません。未確認は「修正が存在しない」の断定ではありません。利用環境に対する診断結果ではありません。</p>
  </>;
}
function Alerts({ item }: { item: ProductAdvisory }) {
  return <>
    <h3>公的機関の注意喚起</h3>
    {item.alerts.length ? <ul className="sources">{item.alerts.map(alert => <li key={alert.url}><a href={alert.url} target="_blank" rel="noopener noreferrer">{alert.issuer}：{alert.title} ↗</a><span>公表日 {alert.publishedDate}</span></li>)}</ul> : <p>収録時点で確認した注意喚起はありません。</p>}
    {item.alertChecks.length > 0 && <ul className="sources">{item.alertChecks.map(check => <li key={`${check.issuer}:${check.url}`}><a href={check.url} target="_blank" rel="noopener noreferrer">{check.issuer} の一覧を確認 ↗</a><span>{CHECK_LABELS[check.result]} ({utc(check.checkedAt)})</span></li>)}</ul>}
    <p className="fine-print">注意喚起がないことは、重要性が低いことや安全であることを意味しません。</p>
  </>;
}
export default function ProductDetail({ item }: { item: ProductAdvisory }) {
  return <article className="panel-body incident-detail vulnerability-detail product-detail">
    <span className="eyebrow">PRODUCT ADVISORY / 製品・ランタイムの注意喚起</span>
    <h2>{item.product}</h2>
    <p className="package-detail-context">開発元：{item.vendor}</p>
    <p className="detail-title">{item.title}</p>
    <div className="detail-tags"><span>{item.id}</span>{item.aliases.map(id => <span key={id}>{id}</span>)}</div>
    <div className="vulnerability-badges"><span className="status-badge">{productFixLabel(item)}</span><span className="status-badge" data-severity={item.severity.label}>公表元評価：{SEVERITY_LABELS[item.severity.label]}</span>{INCLUSION_ORDER.filter(reason => item.inclusion.includes(reason)).map(reason => <span key={reason} className="status-badge" data-inclusion={reason}>収録理由：{INCLUSION_LABELS[reason]}</span>)}</div>
    {item.withdrawnAt && <p className="withdrawn-note">この記録は撤回されています。履歴として表示し、現在の判断には使用しません。</p>}
    <p className="verification-note">開発元と公的機関の一次資料を確認した選定記録です。確認日時点の資料に基づき、利用環境に対する診断ではありません。</p>
    <p className="detail-summary">{item.summary}</p>
    <dl className="date-grid">
      <div><dt>収録契機日</dt><dd>{item.listedDate}<br/><span className="muted">{item.listedNote}</span></dd></div>
      <div><dt>開発元の公表日</dt><dd>{item.publishedDate}{item.publishedAt && <><br/><span className="muted">{utc(item.publishedAt)}</span></>}</dd></div>
      <div><dt>資料の最終更新</dt><dd>{utc(item.modifiedAt)}</dd></div>
      <div><dt>資料の最終確認</dt><dd>{utc(item.lastVerifiedAt)}</dd></div>
      <div><dt>撤回</dt><dd>{item.withdrawnAt ? utc(item.withdrawnAt) : '記載なし'}</dd></div>
    </dl>
    <p className="fine-print"><a href={item.dateSourceUrl} target="_blank" rel="noopener noreferrer">日付の出典 ↗</a>。{item.dateNote}</p>
    <AffectedTable item={item}/>
    <h3>公表元の評価</h3>
    <p>{SEVERITY_LABELS[item.severity.label]} {item.severity.sourceUrl && <a href={item.severity.sourceUrl} target="_blank" rel="noopener noreferrer">評価の出典 ↗</a>}</p>
    {item.severity.cvss.length ? <ul>{item.severity.cvss.map((score, index) => <li key={index}>CVSS {score.version}：{score.score ?? '数値未記載'}<br/>{score.vector && <span className="cvss-vector">{score.vector}<br/></span>}<a href={score.sourceUrl} target="_blank" rel="noopener noreferrer">出典 ↗</a></li>)}</ul> : <p className="fine-print">CVSSは未収録です。スコアを推計・再計算しません。</p>}
    <h3>悪用情報と CISA KEV</h3>
    <p>実際の悪用：{item.exploitation.status === 'reported' ? '出典に報告あり' : '未確認'} {item.exploitation.sourceUrl && <a href={item.exploitation.sourceUrl} target="_blank" rel="noopener noreferrer">根拠 ↗</a>}</p>
    <p>CISA KEV：{KEV_LABELS[item.kev.status]}{item.kev.addedDate && <> （追加日 {item.kev.addedDate}）</>} {item.kev.sourceUrl && <a href={item.kev.sourceUrl} target="_blank" rel="noopener noreferrer">照合先 ↗</a>}{item.kev.checkedAt && <span className="muted"> ({utc(item.kev.checkedAt)})</span>}</p>
    <p className="fine-print">脆弱性の公開、実際の悪用、企業の被害は別の事実です。未確認・KEV未掲載は、悪用がないことを意味しません。</p>
    <Alerts item={item}/>
    {item.mitigations.length > 0 && <><h3>開発元が示す緩和策（更新の代替ではない）</h3><ul>{item.mitigations.map(entry => <li key={entry.text}>{entry.text} <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">出典 ↗</a></li>)}</ul></>}
    <h3>解釈上の注意</h3><ul>{item.caveats.map(note => <li key={note}>{note}</li>)}</ul>
    <h3>開発元・公的機関の資料</h3>
    <ul className="sources">{item.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>{source.publishedDate && <span>公表 {source.publishedAt ? utc(source.publishedAt) : source.publishedDate}</span>}{source.modifiedAt && <span>更新 {utc(source.modifiedAt)}</span>}</li>)}</ul>
  </article>;
}
