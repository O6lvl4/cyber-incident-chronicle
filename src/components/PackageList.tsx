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

const severityLabels = { critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', low: 'LOW', unknown: 'UNKNOWN' } as const;
const severityOrder = ['critical', 'high', 'medium', 'low', 'unknown'] as const;

const packageItemKey = (group: PackageGroup) => group.key;

export default function PackageList({ hidden, groups, positionKey, initialIndex, restorePosition, hasSelection, onSelect, uniqueAdvisoryCount, onReset, viewTabs }: Props) {
  const position = usePackageListPosition(positionKey, { active: !hidden, restorePosition, hasSelection, headingId: 'package-results-heading', hasKey: key => groups.some(group => group.key === key) });
  return <aside hidden={hidden} id="vulnerability-list-panel" role="tabpanel" aria-labelledby="vulnerability-list-panel-tab" className="incident-list vulnerability-list package-list research-list research-packages" data-package-count={groups.length} data-advisory-count={uniqueAdvisoryCount} data-filtered={uniqueAdvisoryCount}>
    <div className="list-heading"><div><h2 id="package-results-heading" tabIndex={-1}>パッケージ</h2></div>
      <span className="count-badge">{groups.length.toLocaleString()}<small className="sr-only"> パッケージ</small></span>{viewTabs}
    <p className="list-note package-count-note" role="status" aria-live="polite">アドバイザリ {uniqueAdvisoryCount.toLocaleString()}件（重複を除く） · 深刻度は絞り込み結果内の既知評価の最大</p></div>
    <VirtualRecordList ref={position.list} items={groups} getItemKey={packageItemKey} estimateHeight={100}
      className="incident-scroll package-scroll" data-package-scroll="packages" ariaLabel="パッケージ一覧"
      initialIndex={initialIndex} initialPosition={position.initialPosition} onPositionChange={position.onPositionChange} onFocusCapture={position.onFocusCapture}
      header={<div className="research-columns package-columns" aria-hidden="true"><span>エコシステム</span><span>パッケージ</span><span>最大深刻度（既知）</span><span>公表 / 更新</span><span>件数</span><span/></div>}
      emptyState={<div className="empty-state"><p>条件に合うパッケージがありません</p><button className="n-btn" onClick={onReset}>絞り込みを解除</button></div>}
      footer={<p className="list-footer">同じアドバイザリが複数のパッケージに表示されるため、パッケージ別件数は合算できません。深刻度は利用中バージョンの影響や実際の悪用を示すものではなく、詳細の影響範囲・修正版で確認してください</p>}
      renderItem={group => <button className="incident-card package-card" data-package-key={group.key} onClick={() => onSelect(group.key)}>
        <span className="incident-card-top"><span className="package-ecosystem">{group.ecosystem}</span></span>
        <span className="package-identity"><strong className="package-name">{group.packageName}</strong>
          <span className="package-severity-counts" aria-label="深刻度別の該当件数">{severityOrder.filter(level => group.severityCounts[level] > 0).map(level => <span key={level} data-severity-count={level}>{severityLabels[level]} <b>{group.severityCounts[level].toLocaleString()}</b></span>)}</span>
        </span>
        <span className="package-severity"><span className="status-badge" data-severity={group.highestSeverity}><span className="sr-only">確認できた最大深刻度: </span>{severityLabels[group.highestSeverity]}</span>{group.highestSeverity === 'unknown' && <small>評価未確認</small>}{group.withdrawnCount > 0 && <small className="package-withdrawn">撤回済み {group.withdrawnCount.toLocaleString()}件を含む</small>}</span>
        <span className="package-card-summary"><span className="package-dates"><span className="package-latest"><span className="row-meta-label">公表 </span><time dateTime={group.latestPublishedAt}>{group.latestPublishedAt.slice(0, 10)}</time></span><span className="package-updated"><span className="row-meta-label">更新 </span>{group.latestModifiedAt ? <time dateTime={group.latestModifiedAt}>{group.latestModifiedAt.slice(0, 10)}</time> : <span>未確認</span>}</span></span><span className="package-advisory-count"><span className="sr-only">アドバイザリ </span><b>{group.advisories.length.toLocaleString()}</b><span>件</span></span></span>
        <span className="package-card-action sr-only">このパッケージの脆弱性を見る</span>
        <span className="card-arrow" aria-hidden="true">→</span>
      </button>}/>
  </aside>;
}
