import type { ReactNode } from 'react';
import type { PackageGroup } from '../lib/packageGroups';
import { usePackageListPosition } from '../hooks/usePackageListPosition';
import VirtualRecordList from './VirtualRecordList';

interface Props {
  hidden?: boolean;
  groups: PackageGroup[];
  positionKey: string;
  initialIndex: number;
  restorePosition: boolean;
  hasSelection?: boolean;
  onSelect: (key: string) => void;
  uniqueAdvisoryCount: number;
  onReset: () => void;
  viewTabs?: ReactNode;
}

const packageItemKey = (group: PackageGroup) => group.key;

export default function PackageList({ hidden, groups, positionKey, initialIndex, restorePosition, hasSelection, onSelect, uniqueAdvisoryCount, onReset, viewTabs }: Props) {
  const position = usePackageListPosition(positionKey, { active: !hidden, restorePosition, hasSelection, headingId: 'package-results-heading', hasKey: key => groups.some(group => group.key === key) });
  return <aside hidden={hidden} id="vulnerability-list-panel" role="tabpanel" aria-labelledby="vulnerability-list-panel-tab" className="incident-list vulnerability-list package-list research-list research-packages" data-package-count={groups.length} data-advisory-count={uniqueAdvisoryCount} data-filtered={uniqueAdvisoryCount}>
    <div className="list-heading"><div><h2 id="package-results-heading" tabIndex={-1}>パッケージ</h2></div>
      <span className="count-badge">{groups.length.toLocaleString()}<small className="sr-only"> パッケージ</small></span>{viewTabs}
    <p className="list-note package-count-note" role="status" aria-live="polite">アドバイザリ {uniqueAdvisoryCount.toLocaleString()}件（重複を除く）</p></div>
    <VirtualRecordList ref={position.list} items={groups} getItemKey={packageItemKey} estimateHeight={86}
      className="incident-scroll package-scroll" data-package-scroll="packages" ariaLabel="パッケージ一覧"
      initialIndex={initialIndex} initialPosition={position.initialPosition} onPositionChange={position.onPositionChange} onFocusCapture={position.onFocusCapture}
      header={<div className="research-columns package-columns" aria-hidden="true"><span>エコシステム</span><span>パッケージ</span><span>最新公表日</span><span>件数</span><span/></div>}
      emptyState={<div className="empty-state"><p>条件に合うパッケージがありません</p><button className="n-btn" onClick={onReset}>絞り込みを解除</button></div>}
      footer={<p className="list-footer">同じアドバイザリが複数のパッケージに表示されるため、パッケージ別件数は合算できません</p>}
      renderItem={group => <button className="incident-card package-card" data-package-key={group.key} onClick={() => onSelect(group.key)}>
        <span className="incident-card-top"><span className="package-ecosystem">{group.ecosystem}</span></span>
        <strong className="package-name">{group.packageName}</strong>
        <span className="package-card-summary"><span className="package-latest"><span className="row-meta-label">最新公表 </span><time dateTime={group.latestPublishedAt}>{group.latestPublishedAt.slice(0, 10)}</time></span><span className="package-advisory-count"><span className="sr-only">アドバイザリ </span><b>{group.advisories.length.toLocaleString()}</b><span>件</span></span></span>
        <span className="package-card-action sr-only">このパッケージの脆弱性を見る</span>
        <span className="card-arrow" aria-hidden="true">→</span>
      </button>}/>
  </aside>;
}
