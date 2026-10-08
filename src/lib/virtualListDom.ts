import { VirtualListLayout, type VirtualListAnchor, type VirtualScrollAlignment } from './virtualList';

interface InitialPosition {
  initialPosition?: Pick<VirtualListAnchor, 'key' | 'offset'>;
  initialKey?: string;
  initialIndex?: number;
  initialOffset?: number;
}

export function initialVirtualOffset(layout: VirtualListLayout, options: InitialPosition) {
  const keyIndex = layout.indexOf(options.initialPosition?.key ?? options.initialKey ?? '');
  const requested = keyIndex < 0 ? options.initialIndex ?? 0 : keyIndex;
  const index = Math.max(0, Math.min(layout.keys.length - 1, requested));
  if (options.initialPosition && keyIndex >= 0) return layout.restore({ ...options.initialPosition, index });
  return options.initialOffset ?? layout.offset(index);
}

export function initialVirtualAnchor(layout: VirtualListLayout, position?: Pick<VirtualListAnchor, 'key' | 'offset'>) {
  if (!position) return undefined;
  const index = layout.indexOf(position.key);
  return index < 0 ? undefined : { ...position, index };
}

export function measureVirtualRows(layout: VirtualListLayout, rows: ReadonlyMap<string, HTMLDivElement>, measurements: Map<string, number>) {
  let changed = false;
  for (const [key, row] of rows) {
    const index = layout.indexOf(key);
    const height = row.getBoundingClientRect().height;
    if (index < 0 || !height) continue;
    measurements.set(key, height);
    changed = layout.setSize(index, height) || changed;
  }
  return changed;
}

export function virtualRenderedIndices(layout: VirtualListLayout, range: { start: number; end: number }, focusedKey: string | null) {
  const rendered = Array.from({ length: range.end - range.start }, (_, index) => range.start + index);
  const focusedIndex = focusedKey === null ? -1 : layout.indexOf(focusedKey);
  if (focusedIndex >= 0 && (focusedIndex < range.start || focusedIndex >= range.end)) rendered.push(focusedIndex);
  return rendered.sort((a, b) => a - b);
}

export function virtualKeyboardTarget(key: string, current: number, count: number): { index: number; align: VirtualScrollAlignment } | undefined {
  switch (key) {
    case 'ArrowDown': return { index: current + 1, align: 'auto' };
    case 'ArrowUp': return { index: current - 1, align: 'auto' };
    case 'Home': return { index: 0, align: 'start' };
    case 'End': return { index: count - 1, align: 'end' };
    default: return undefined;
  }
}

export function allowsVirtualNavigation(event: { defaultPrevented: boolean; altKey: boolean; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; target: EventTarget }) {
  if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return false;
  return !(event.target as HTMLElement).matches('input, textarea, select, [contenteditable="true"]');
}
