import { useRef, useState } from 'react';
import type { AppState } from '../hooks/useAppState';
import ClassificationDialog from './ClassificationDialog';
import { CLASSIFICATION_FIELDS } from './ClassificationFields';

interface Props { state: AppState; resultCount: number; onShowResults: () => void }

export default function ClassificationFilters({ state, resultCount, onShowResults }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const selected = CLASSIFICATION_FIELDS.filter(field => state.classification[field.key] !== 'all');
  const close = () => {
    setIsOpen(false);
    opener.current?.focus({ preventScroll: true });
  };
  return <div className="classification-controls">
    <div className="classification-toolbar">
      <button ref={opener} type="button" className="classification-toggle" aria-label="絞り込み"
        aria-haspopup="dialog" aria-expanded={isOpen} aria-controls="classification-dialog" onClick={() => setIsOpen(true)}>
        絞り込み
        {selected.length > 0 && <span className="classification-filter-count">{selected.length}条件</span>}
      </button>
      <span className="classification-result-count">{resultCount}件</span>
      <button type="button" className="classification-reset" onClick={state.resetFilters} aria-label="すべての絞り込みを解除">すべての絞り込みを解除</button>
    </div>
    {selected.length > 0 && <div className="classification-chips" aria-label="選択中の分類条件">
      {selected.map(field => {
        const label = field.options[state.classification[field.key]];
        return <button type="button" key={field.key} className="classification-chip" aria-label={`${field.label}：${label}の条件を解除`}
          title={`${field.label}：${label}`} onClick={() => {
            state.setClassification(previous => ({ ...previous, [field.key]: 'all' }));
            opener.current?.focus({ preventScroll: true });
          }}>
          <span>{field.shortLabel}：{label}</span><span aria-hidden="true">×</span>
        </button>;
      })}
    </div>}
    {isOpen && <ClassificationDialog state={state} resultCount={resultCount} onClose={close} onShowResults={onShowResults}/>}
  </div>;
}
