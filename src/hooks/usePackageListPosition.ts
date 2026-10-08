import { useCallback, useEffect, useRef, type FocusEvent } from 'react';
import type { VirtualRecordListHandle, VirtualRecordListPosition } from '../components/VirtualRecordList';

interface Position { anchor?: VirtualRecordListPosition; focusKey?: string }
const positions = new Map<string, Position>();

function remember(listKey: string, position: Position) {
  positions.delete(listKey);
  positions.set(listKey, position);
  if (positions.size > 80) positions.delete(positions.keys().next().value!);
}

/** An explicit new drill-in starts at the first advisory. History restores keep their anchor. */
export function resetPackageListPosition(listKey: string) {
  positions.delete(listKey);
}

/** Preserve the exact package coordinate, including for links without an opener DOM. */
export function rememberPackageReturn(listKey: string, focusKey: string) {
  remember(listKey, { ...positions.get(listKey), focusKey });
}

interface Options {
  active: boolean;
  restorePosition: boolean;
  hasSelection?: boolean;
  headingId: string;
  hasKey: (key: string) => boolean;
}

/** The anchor survives route remounts and width changes without depending on old pixels. */
export function usePackageListPosition(listKey: string, { active, restorePosition, hasSelection, headingId, hasKey }: Options) {
  const list = useRef<VirtualRecordListHandle>(null);
  const initial = useRef(restorePosition ? positions.get(listKey) : undefined);
  const focusRestored = useRef(false);
  const onPositionChange = useCallback((anchor: VirtualRecordListPosition) => {
    if (!active || !list.current?.element?.isConnected) return;
    remember(listKey, { ...positions.get(listKey), anchor });
  }, [listKey, active]);
  const onFocusCapture = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-virtual-key]');
    if (row?.dataset.virtualKey) remember(listKey, { ...positions.get(listKey), focusKey: row.dataset.virtualKey });
  }, [listKey]);
  useEffect(() => {
    if (hasSelection) { focusRestored.current = true; return; }
    if (!active || !restorePosition || focusRestored.current) return;
    const frame = requestAnimationFrame(() => {
      if (!list.current?.element?.isConnected) return;
      focusRestored.current = true;
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused !== document.body) return;
      const focusKey = initial.current?.focusKey;
      if (focusKey && hasKey(focusKey)) {
        const host = list.current.element;
        const row = [...host.querySelectorAll<HTMLElement>('[data-virtual-key]')].find(item => item.dataset.virtualKey === focusKey);
        const opener = row?.querySelector<HTMLElement>('button, a[href], [tabindex]');
        const bounds = host.getBoundingClientRect();
        const rowBounds = row?.getBoundingClientRect();
        // Keep an already visible opener at its saved offset, even if the row is
        // only partially visible. Direct links still bring an absent row in.
        if (opener && rowBounds && rowBounds.bottom > bounds.top && rowBounds.top < bounds.bottom) opener.focus({ preventScroll: true });
        else list.current.scrollToKey(focusKey, { align: 'auto', focus: true });
      } else document.getElementById(headingId)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [active, hasSelection, restorePosition, headingId, hasKey]);
  return { list, initialPosition: initial.current?.anchor, onPositionChange, onFocusCapture };
}
