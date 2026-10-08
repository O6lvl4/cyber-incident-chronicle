import type { KeyboardEvent } from 'react';
export type DisplayView = 'list' | 'timeline';
interface Props {
  value: DisplayView;
  onChange: (view: DisplayView) => void;
  listId: string;
  timelineId: string;
  listLabel?: string;
  timelineLabel?: string;
}
export default function ViewTabs({ value, onChange, listId, timelineId, listLabel, timelineLabel }: Props) {
  const tabs = [{ value: 'list' as const, name: '一覧', panel: listId, note: listLabel }, { value: 'timeline' as const, name: 'タイムライン', panel: timelineId, note: timelineLabel }];
  const activate = (next: DisplayView) => {
    if (next !== value) onChange(next);
    const panel = next === 'list' ? listId : timelineId;
    requestAnimationFrame(() => document.getElementById(`${panel}-tab`)?.focus({ preventScroll: true }));
  };
  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const keys: Record<string, DisplayView> = { ArrowLeft: value === 'list' ? 'timeline' : 'list', ArrowRight: value === 'list' ? 'timeline' : 'list', Home: 'list', End: 'timeline' };
    const next = keys[event.key];
    if (!next) return;
    event.preventDefault(); event.stopPropagation(); activate(next);
  };
  return <div className="view-tabs" role="tablist" aria-label="表示切替">
    {tabs.map(tab => <button key={tab.value} id={`${tab.panel}-tab`} type="button" role="tab" aria-label={tab.name}
      aria-selected={value === tab.value} aria-controls={tab.panel} tabIndex={value === tab.value ? 0 : -1}
      onClick={() => activate(tab.value)} onKeyDown={onKey}>{tab.name}{tab.note && <span aria-hidden="true">{tab.note}</span>}</button>)}
  </div>;
}
