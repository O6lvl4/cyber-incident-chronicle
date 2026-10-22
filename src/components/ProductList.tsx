import { useEffect, useRef } from 'react';
import type { ProductAdvisory } from '../productTypes';
import { SEVERITY_LABELS } from '../lib/vulnerabilities';
import { INCLUSION_LABELS, INCLUSION_ORDER, productFixLabel } from '../lib/products';
interface Props { hidden?: boolean; items: ProductAdvisory[]; total: number; selectedId?: string; onSelect: (id: string) => void; onReset: () => void }
export default function ProductList({ hidden, items, total, selectedId, onSelect, onReset }: Props) {
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => { scroll.current?.scrollTo({ top: 0 }); }, [items]);
  return <section id="product-list-panel" role="tabpanel" aria-labelledby="product-list-panel-tab" hidden={hidden} className="incident-list research-list research-products" aria-label="製品・ランタイムの注意喚起一覧" data-filtered={items.length}>
    <div className="list-heading"><div><h2 id="product-results-heading" tabIndex={-1}>製品・ランタイムの注意喚起</h2></div>
      <span className="count-badge" aria-live="polite">{items.length}<small className={items.length === total ? 'sr-only' : undefined}> / {total}</small><span className="sr-only"> 件</span></span>
    <p className="list-note">収録契機日は注意喚起・KEV追加・Critical公表・実悪用報告のいずれかが確認できた日。開発元の公表日はそれより前のことがあります</p></div>
    <div className="incident-scroll" ref={scroll}>
      <div className="research-columns product-columns" aria-hidden="true"><span>収録契機 / 開発元公表</span><span>製品 / 脆弱性</span><span>CVE / アドバイザリ</span><span>深刻度・収録理由</span><span>修正版</span><span/></div>
      {items.length === 0 && <div className="empty-state"><p>条件に合う注意喚起がありません</p><button className="n-btn" onClick={onReset}>絞り込みを解除</button></div>}
      {(hidden ? [] : items).map(item => <button key={item.id} data-product-id={item.id} data-product-key={item.productKey} className={`incident-card product-card${selectedId === item.id ? ' selected' : ''}`} onClick={() => onSelect(item.id)} aria-pressed={selectedId === item.id}>
        <span className="incident-card-top product-dates"><span><span className="date-mobile-label">収録契機 </span><time dateTime={item.listedDate}>{item.listedDate.replace(/-/g, '.')}</time></span>{item.publishedDate !== item.listedDate && <span className="product-published"><span className="date-mobile-label">開発元公表 </span><time dateTime={item.publishedDate}>{item.publishedDate.replace(/-/g, '.')}</time></span>}</span>
        <span className="incident-subject product-subject"><strong>{item.product}</strong><span className="incident-card-title">{item.title}</span></span>
        <span className="package-advisory-identifiers"><span className="advisory-id advisory-cves">{item.id}</span>{item.aliases.length > 0 && <span className="advisory-id">{item.aliases.join(' / ')}</span>}</span>
        <span className="vulnerability-badges product-badges"><span className="status-badge" data-severity={item.severity.label}><span className="sr-only">深刻度: </span>{SEVERITY_LABELS[item.severity.label]}</span>
          {INCLUSION_ORDER.filter(reason => item.inclusion.includes(reason)).map(reason => <span key={reason} className="status-badge" data-inclusion={reason}>{INCLUSION_LABELS[reason]}</span>)}</span>
        <span className="product-fix">{productFixLabel(item)}</span>
        <span className="card-arrow" aria-hidden="true">↗</span>
      </button>)}
      <p className="list-footer">収録基準を満たす記録だけの一覧で、製品の脆弱性すべてではありません。深刻度は公表元の評価で、利用中のバージョン・構成に対する診断ではありません。未収録は脆弱性がないことを意味しません</p>
    </div>
  </section>;
}
