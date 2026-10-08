import ViewTabs, { type DisplayView } from './ViewTabs';
import '../browse-controls.css';

export interface BrowseSortOption {
  value: string;
  label: string;
  shortLabel?: string;
}

interface Props {
  view: DisplayView;
  onViewChange: (view: DisplayView) => void;
  listId: string;
  timelineId: string;
  sortValue: string;
  sortOptions: readonly BrowseSortOption[];
  onSortChange: (value: string) => void;
}

export default function BrowseControls({ view, onViewChange, listId, timelineId, sortValue, sortOptions, onSortChange }: Props) {
  const timeline = view === 'timeline';
  const description = timeline ? 'タイムラインは公表日順' : sortOptions.find(option => option.value === sortValue)?.label;
  return <div className="browse-controls">
    <ViewTabs value={view} onChange={onViewChange} listId={listId} timelineId={timelineId}/>
    <select className="browse-sort" aria-label="一覧の並び順" aria-description={description} disabled={timeline} title={description}
      value={timeline ? 'timeline-date' : sortValue} onChange={event => onSortChange(event.target.value)}>
      {timeline
        ? <option value="timeline-date">公表日順（固定）</option>
        : sortOptions.map(option => <option key={option.value} value={option.value}>{option.shortLabel ?? option.label}</option>)}
    </select>
  </div>;
}
