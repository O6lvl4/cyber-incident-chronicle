import { useEffect, useRef, type MouseEvent } from 'react';
import type { AppState } from '../hooks/useAppState';
import ClassificationFields from './ClassificationFields';

interface Props { state: AppState; resultCount: number; onClose: () => void; onShowResults: () => void }

function isBackdrop(event: MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false;
  const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
  return event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom;
}

export default function ClassificationDialog({ state, resultCount, onClose, onShowResults }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const showResults = useRef(false);
  const backdropPressed = useRef(false);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const finishClose = () => {
    if (dialog.current?.open) return;
    onClose();
    if (showResults.current) onShowResults();
  };
  return <dialog ref={dialog} id="classification-dialog" className="classification-dialog" aria-labelledby="classification-dialog-title"
    onClose={finishClose} onMouseDown={event => { backdropPressed.current = isBackdrop(event); }}
    onClick={event => { if (backdropPressed.current && isBackdrop(event)) dialog.current?.close(); }}>
    <div className="classification-dialog-header">
      <h2 id="classification-dialog-title">絞り込み</h2>
      <button type="button" className="classification-close" autoFocus onClick={() => dialog.current?.close()}>絞り込みを閉じる</button>
    </div>
    <div className="classification-filter-body"><ClassificationFields state={state}/></div>
    <div className="classification-dialog-footer">
      <button type="button" className="classification-show-results" onClick={() => { showResults.current = true; dialog.current?.close(); }}>
        <span aria-live="polite">{resultCount}件の結果を見る</span>
      </button>
    </div>
  </dialog>;
}
