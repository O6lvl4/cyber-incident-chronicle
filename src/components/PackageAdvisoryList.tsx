import { useEffect, useRef, type ReactNode } from 'react';
import type { PackageGroup } from '../lib/packageGroups';
import type { VulnerabilitySummary } from '../lib/vulnerabilities';
import { SEVERITY_LABELS } from '../lib/vulnerabilities';
import { rememberPackageReturn, usePackageListPosition } from '../hooks/usePackageListPosition';
import VirtualRecordList from './VirtualRecordList';

interface Props {
  hidden?: boolean;
  group: PackageGroup;
  positionKey: string;
  initialIndex: number;
  restorePosition: boolean;
  onBack: () => void;
  onSelect: (id: string) => void;
  selectedId?: string;
  viewTabs?: ReactNode;
}
function AdvisoryCard({ item, selected, onSelect }: { item: VulnerabilitySummary; selected: boolean; onSelect: (id: string) => void }) {
  const cves = item.aliases.filter(alias => alias.startsWith('CVE-'));
  return <button className={`incident-card vulnerability-card${selected ? ' selected' : ''}`} data-advisory-id={item.id} aria-pressed={selected} onClick={() => onSelect(item.id)}>
    <span className="incident-card-top"><span><span className="sr-only">公表 </span><time dateTime={item.publishedAt}>{item.publishedAt.slice(0, 10)}</time></span></span>
    <strong className="package-advisory-title">{item.title}</strong>
    <span className="package-advisory-identifiers">{cves.length > 0 && <span className="advisory-id advisory-cves">{cves.join(' / ')}</span>}<span className="advisory-id">{item.id}</span></span>
    <span className="vulnerability-badges"><span className="status-badge" data-severity={item.severity.label}><span className={item.withdrawnAt ? undefined : 'sr-only'}>{item.withdrawnAt ? '過去の評価: ' : '深刻度: '}</span>{SEVERITY_LABELS[item.severity.label]}</span>
      {item.withdrawnAt && <span className="status-badge" data-lifecycle="withdrawn">撤回済み · <time dateTime={item.withdrawnAt}>{item.withdrawnAt.slice(0, 10)}</time></span>}</span>
    <span className="package-card-action sr-only">範囲・修正境界・出典を確認</span>
    <span className="card-arrow" aria-hidden="true">↗</span>
  </button>;
}

const advisoryItemKey = (item: VulnerabilitySummary) => item.id;

export default function PackageAdvisoryList({ hidden, group, positionKey, initialIndex, restorePosition, onBack, onSelect, selectedId, viewTabs }: Props) {
  const position = usePackageListPosition(positionKey, { active: !hidden, restorePosition, hasSelection: !!selectedId, headingId: 'package-advisory-heading', hasKey: key => group.advisories.some(item => item.id === key) });
  const previousSelection = useRef(selectedId);
  useEffect(() => {
    const previous = previousSelection.current;
    previousSelection.current = selectedId;
    if (hidden || selectedId || !previous) return;
    const frame = requestAnimationFrame(() => {
      const element = position.list.current?.element;
      if (!element?.isConnected) return;
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused !== document.body && !focused.closest('.drawer') && !element.contains(focused)) return;
      const opener = [...element.querySelectorAll<HTMLElement>('[data-advisory-id]')].find(row => row.dataset.advisoryId === previous);
      if (opener) opener.focus({ preventScroll: true });
      else if (group.advisories.some(item => item.id === previous)) position.list.current?.scrollToKey(previous, { align: 'auto', focus: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId, hidden, group.advisories, position.list]);
  const select = (id: string) => { rememberPackageReturn(positionKey, id); onSelect(id); };
  return <aside hidden={hidden} id="vulnerability-list-panel" role="tabpanel" aria-labelledby="vulnerability-list-panel-tab" className="incident-list vulnerability-list package-advisory-list research-list research-advisories" data-package-key={group.key} data-filtered={group.advisories.length}>
    <div className="package-back-row"><button className="n-btn package-back" onClick={onBack}><span aria-hidden="true">←</span> パッケージ一覧に戻る</button></div>
    <div className="list-heading"><div className="package-heading"><span className="eyebrow">{group.ecosystem}</span><h2 id="package-advisory-heading" tabIndex={-1}>{group.packageName}</h2></div>
      <span className="count-badge">{group.advisories.length.toLocaleString()}<small> 件</small></span>{viewTabs}</div>
    <p className="list-note">{group.advisories.length.toLocaleString()}件のアドバイザリ · 公表日の新しい順</p>
    <VirtualRecordList ref={position.list} items={group.advisories} getItemKey={advisoryItemKey} estimateHeight={112}
      className="incident-scroll package-scroll" data-package-scroll="advisories" ariaLabel="パッケージの脆弱性一覧"
      initialIndex={initialIndex} initialPosition={selectedId ? undefined : position.initialPosition} onPositionChange={position.onPositionChange} onFocusCapture={position.onFocusCapture}
      header={<div className="research-columns advisory-columns" aria-hidden="true"><span>公表日</span><span>脆弱性</span><span>CVE / アドバイザリ</span><span>深刻度</span><span/></div>}
      emptyState={<div className="empty-state"><p>このパッケージには、現在の絞り込み条件に合うアドバイザリがありません</p><button className="n-btn" onClick={onBack}>パッケージ一覧に戻る</button></div>}
      footer={<p className="list-footer">影響範囲・修正版・出典は各アドバイザリの詳細で確認できます。公開は実際の悪用や企業の被害を意味しません</p>}
      renderItem={item => <AdvisoryCard item={item} selected={selectedId === item.id} onSelect={select}/>}/>
  </aside>;
}
