import { useEffect, useRef, type ReactNode } from 'react';
import type { PackageGroup } from '../lib/packageGroups';
import { ADVISORY_PAGE_SIZE, paginate } from '../lib/pagination';
import Pagination from './Pagination';

interface Props {
  hidden?: boolean;
  groups: PackageGroup[];
  page: number;
  onPageChange: (page: number) => void;
  onSelect: (key: string) => void;
  uniqueAdvisoryCount: number;
  onReset: () => void;
  viewTabs?: ReactNode;
}

export default function PackageList({ hidden, groups, page, onPageChange, onSelect, uniqueAdvisoryCount, onReset, viewTabs }: Props) {
  const slice = paginate(groups, page, ADVISORY_PAGE_SIZE);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => { scroll.current?.scrollTo({ top: 0 }); }, [slice.page, groups]);
  return <aside hidden={hidden} id="vulnerability-list-panel" role="tabpanel" aria-labelledby="vulnerability-list-panel-tab" className="incident-list vulnerability-list package-list research-list research-packages" data-package-count={groups.length} data-advisory-count={uniqueAdvisoryCount} data-filtered={uniqueAdvisoryCount}>
    <div className="list-heading"><div><h2 id="package-results-heading" tabIndex={-1}>パッケージ</h2></div>
      <span className="count-badge">{groups.length.toLocaleString()}<small className="sr-only"> パッケージ</small></span>{viewTabs}</div>
    <p className="list-note package-count-note" role="status" aria-live="polite">アドバイザリ {uniqueAdvisoryCount.toLocaleString()}件（重複を除く） · 公表日順</p>
    <div className="incident-scroll package-scroll" data-package-scroll="packages" ref={scroll}>
      <div className="research-columns package-columns" aria-hidden="true"><span>エコシステム</span><span>パッケージ</span><span>最新公表日</span><span>件数</span><span/></div>
      {!groups.length && <div className="empty-state"><p>条件に合うパッケージがありません</p><button className="n-btn" onClick={onReset}>絞り込みを解除</button></div>}
      {slice.items.map(group => <button key={group.key} className="incident-card package-card" data-package-key={group.key} onClick={() => onSelect(group.key)}>
        <span className="incident-card-top"><span className="package-ecosystem">{group.ecosystem}</span></span>
        <strong className="package-name">{group.packageName}</strong>
        <span className="package-card-summary"><span className="package-latest"><span className="row-meta-label">最新公表 </span><time dateTime={group.latestPublishedAt}>{group.latestPublishedAt.slice(0, 10)}</time></span><span className="package-advisory-count"><span className="sr-only">アドバイザリ </span><b>{group.advisories.length.toLocaleString()}</b><span>件</span></span></span>
        <span className="package-card-action sr-only">このパッケージの脆弱性を見る</span>
        <span className="card-arrow" aria-hidden="true">→</span>
      </button>)}
      <p className="list-footer">同じアドバイザリが複数のパッケージに表示されるため、パッケージ別件数は合算できません</p>
    </div>
    <Pagination {...slice} total={groups.length} label="パッケージ一覧" onChange={onPageChange}/>
  </aside>;
}
