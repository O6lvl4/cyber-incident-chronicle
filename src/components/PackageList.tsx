import { useEffect, useRef } from 'react';
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
}

export default function PackageList({ hidden, groups, page, onPageChange, onSelect, uniqueAdvisoryCount, onReset }: Props) {
  const slice = paginate(groups, page, ADVISORY_PAGE_SIZE);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => { scroll.current?.scrollTo({ top: 0 }); }, [slice.page, groups]);
  return <aside hidden={hidden} id="vulnerability-list-panel" role="tabpanel" aria-labelledby="vulnerability-list-panel-tab" className="incident-list vulnerability-list package-list" data-package-count={groups.length} data-advisory-count={uniqueAdvisoryCount} data-filtered={uniqueAdvisoryCount}>
    <div className="list-heading"><div><span className="eyebrow">PACKAGE INDEX</span><h2 id="package-results-heading" tabIndex={-1}>パッケージから探す</h2></div>
      <span className="count-badge">{groups.length.toLocaleString()}<small> パッケージ</small></span></div>
    <p className="list-note package-count-note" role="status" aria-live="polite">条件に合うアドバイザリ {uniqueAdvisoryCount.toLocaleString()}件（重複を除く）<br/>最新の公表日順 · {ADVISORY_PAGE_SIZE}パッケージずつ<br/>複数のパッケージに同じアドバイザリを表示する場合があります</p>
    <div className="incident-scroll package-scroll" data-package-scroll="packages" ref={scroll}>
      {!groups.length && <div className="empty-state"><p>条件に合うパッケージがありません</p><button className="n-btn" onClick={onReset}>絞り込みを解除</button></div>}
      {slice.items.map(group => <button key={group.key} className="incident-card package-card" data-package-key={group.key} onClick={() => onSelect(group.key)}>
        <span className="incident-card-top"><span className="package-ecosystem">{group.ecosystem}</span><span className="card-arrow" aria-hidden="true">→</span></span>
        <strong className="package-name">{group.packageName}</strong>
        <span className="package-card-summary"><span>アドバイザリ <b>{group.advisories.length.toLocaleString()}</b>件</span><span>最新公表 <time dateTime={group.latestPublishedAt}>{group.latestPublishedAt.slice(0, 10)}</time></span></span>
        <span className="package-card-action">このパッケージの脆弱性を見る</span>
      </button>)}
    </div>
    <Pagination {...slice} total={groups.length} label="パッケージ一覧" onChange={onPageChange}/>
    <p className="list-footer">同じアドバイザリが複数のパッケージに表示されるため、パッケージ別件数は合算できません</p>
  </aside>;
}
