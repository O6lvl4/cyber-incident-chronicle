import { useCallback, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type HTMLAttributes, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { VirtualListLayout, virtualScrollOffset, type VirtualListAnchor, type VirtualScrollAlignment } from '../lib/virtualList';
import { allowsVirtualNavigation, initialVirtualAnchor, initialVirtualOffset, measureVirtualRows, virtualKeyboardTarget, virtualRenderedIndices } from '../lib/virtualListDom';
import '../virtual-record-list.css';

export interface VirtualRecordListPosition extends VirtualListAnchor { scrollTop: number }
export interface VirtualRecordListScrollOptions { align?: VirtualScrollAlignment; focus?: boolean }
export interface VirtualRecordListHandle {
  readonly element: HTMLDivElement | null;
  scrollToIndex: (index: number, options?: VirtualRecordListScrollOptions) => void;
  scrollToKey: (key: string, options?: VirtualRecordListScrollOptions) => void;
}

interface Props<T> extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  ref?: Ref<VirtualRecordListHandle>;
  items: readonly T[];
  getItemKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  ariaLabel: string;
  estimateHeight?: number;
  overscan?: number;
  header?: ReactNode;
  footer?: ReactNode;
  emptyState?: ReactNode;
  initialOffset?: number;
  initialIndex?: number;
  initialKey?: string;
  initialPosition?: Pick<VirtualListAnchor, 'key' | 'offset'>;
  onPositionChange?: (position: VirtualRecordListPosition) => void;
}

interface Navigation extends VirtualRecordListScrollOptions { key: string }

function MeasuredRow({ recordKey, index, total, top, onElement, children }: {
  recordKey: string; index: number; total: number; top: number;
  onElement: (key: string, element: HTMLDivElement | null) => void; children: ReactNode;
}) {
  const attach = useCallback((element: HTMLDivElement | null) => onElement(recordKey, element), [recordKey, onElement]);
  return <div ref={attach} role="listitem" aria-posinset={index + 1} aria-setsize={total}
    className="virtual-record-list-row" data-virtual-index={index} data-virtual-key={recordKey}
    style={{ transform: `translateY(${top}px)` }}>{children}</div>;
}

/** A continuous, measured list. Only the viewport, overscan, and a focused row mount. */
export default function VirtualRecordList<T>({
  ref, items, getItemKey, renderItem, ariaLabel, estimateHeight = 96, overscan = 600,
  header, footer, emptyState, initialOffset, initialIndex, initialKey, initialPosition,
  onPositionChange, className, onScroll, onKeyDown, onFocusCapture, ...attributes
}: Props<T>) {
  const instructionsId = useId();
  const element = useRef<HTMLDivElement>(null);
  const headerElement = useRef<HTMLDivElement>(null);
  const rows = useRef(new Map<string, HTMLDivElement>());
  const measurements = useRef(new Map<string, number>());
  const observer = useRef<ResizeObserver | null>(null);
  const keys = useMemo(() => items.map(getItemKey), [items, getItemKey]);
  const layout = useMemo(() => new VirtualListLayout(keys, estimateHeight, measurements.current), [keys, estimateHeight]);
  const previousLayout = useRef(layout);
  const initialTop = useRef(initialVirtualOffset(layout, { initialPosition, initialKey, initialIndex, initialOffset }));
  const initialAnchor = useRef(initialVirtualAnchor(layout, initialPosition));
  const [viewport, setViewport] = useState({ top: initialTop.current, height: 600, headerHeight: 0 });
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [, measureAgain] = useState(0);
  const initialized = useRef(false);
  const previousWidth = useRef(0);
  const pendingAnchor = useRef<VirtualListAnchor | undefined>(undefined);
  const navigation = useRef<Navigation | undefined>(undefined);
  const scrollFrame = useRef<number | undefined>(undefined);
  const positionCallback = useRef(onPositionChange);
  positionCallback.current = onPositionChange;

  const updateViewport = useCallback(() => {
    const host = element.current;
    if (!host || !host.clientHeight) return;
    const next = { top: host.scrollTop, height: host.clientHeight, headerHeight: headerElement.current?.offsetHeight ?? 0 };
    setViewport(previous => previous.top === next.top && previous.height === next.height && previous.headerHeight === next.headerHeight ? previous : next);
  }, []);

  const attachRow = useCallback((key: string, row: HTMLDivElement | null) => {
    const previous = rows.current.get(key);
    if (previous) observer.current?.unobserve(previous);
    if (row) {
      rows.current.set(key, row);
      observer.current?.observe(row);
    } else rows.current.delete(key);
  }, []);

  const scrollToIndex = useCallback((requested: number, options: VirtualRecordListScrollOptions = {}) => {
    if (!layout.keys.length || !Number.isFinite(requested)) return;
    const index = Math.max(0, Math.min(layout.keys.length - 1, Math.floor(requested)));
    navigation.current = { key: layout.keys[index], ...options };
    pendingAnchor.current = undefined;
    if (options.focus) setFocusedKey(layout.keys[index]);
    const top = virtualScrollOffset(layout, index, viewport.height - viewport.headerHeight, { current: element.current?.scrollTop ?? viewport.top, align: options.align });
    setViewport(previous => ({ ...previous, top }));
  }, [layout, viewport.height, viewport.headerHeight, viewport.top]);

  useImperativeHandle(ref, () => ({
    get element() { return element.current; },
    scrollToIndex,
    scrollToKey(key, options) { const index = layout.indexOf(key); if (index >= 0) scrollToIndex(index, options); },
  }), [layout, scrollToIndex]);

  function restoreLayout(host: HTMLDivElement) {
    if (previousLayout.current !== layout) {
      const anchor = previousLayout.current.anchor(host.scrollTop);
      pendingAnchor.current = anchor && layout.indexOf(anchor.key) >= 0 ? anchor : layout.anchor(0);
      previousLayout.current = layout;
    }
  }

  function restoreScroll(host: HTMLDivElement) {
    if (!initialized.current) {
      host.scrollTop = initialTop.current;
      initialized.current = true;
    }
    if (navigation.current) {
      const index = layout.indexOf(navigation.current.key);
      const height = host.clientHeight - (headerElement.current?.offsetHeight ?? 0);
      if (index >= 0) host.scrollTop = virtualScrollOffset(layout, index, height, { current: host.scrollTop, align: navigation.current.align });
    } else if (pendingAnchor.current) {
      host.scrollTop = layout.restore(pendingAnchor.current);
      pendingAnchor.current = undefined;
    }

  }

  function measureRows(host: HTMLDivElement) {
    let changed = false;
    if (previousWidth.current && previousWidth.current !== host.clientWidth) {
      measurements.current.clear();
      layout.resetMeasurements();
      changed = true;
    }
    previousWidth.current = host.clientWidth;
    return measureVirtualRows(layout, rows.current, measurements.current) || changed;
  }

  function finishNavigation(host: HTMLDivElement, anchor?: VirtualListAnchor) {
    const target = navigation.current;
    if (target?.focus) rows.current.get(target.key)?.querySelector<HTMLElement>('button, a[href], [tabindex]')?.focus({ preventScroll: true });
    navigation.current = undefined;
    pendingAnchor.current = undefined;
    initialAnchor.current = undefined;
    if (anchor) positionCallback.current?.({ ...anchor, scrollTop: host.scrollTop });
  }

  // Every commit measures newly mounted rows before paint. ResizeObserver also
  // covers font loading, wrapping, mobile layout changes, and a hidden tab opening.
  useLayoutEffect(() => {
    const host = element.current;
    if (!host || !host.clientWidth || !host.clientHeight) return;
    restoreLayout(host);
    restoreScroll(host);
    const anchor = initialAnchor.current ?? layout.anchor(host.scrollTop);
    if (measureRows(host)) {
      pendingAnchor.current = anchor;
      measureAgain(version => version + 1);
    } else {
      finishNavigation(host, layout.anchor(host.scrollTop));
    }
    updateViewport();
  });

  useLayoutEffect(() => {
    const measure = () => measureAgain(version => version + 1);
    observer.current = new ResizeObserver(measure);
    if (element.current) observer.current.observe(element.current);
    if (headerElement.current) observer.current.observe(headerElement.current);
    for (const row of rows.current.values()) observer.current.observe(row);
    return () => {
      observer.current?.disconnect();
      observer.current = null;
      if (scrollFrame.current !== undefined) cancelAnimationFrame(scrollFrame.current);
    };
  }, []);

  const range = layout.range(viewport.top, viewport.height - viewport.headerHeight, overscan);
  const rendered = virtualRenderedIndices(layout, range, focusedKey);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    if (!allowsVirtualNavigation(event)) return;
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>('[data-virtual-index]');
    if (!row || !element.current?.contains(row)) return;
    const current = Number(row.dataset.virtualIndex);
    const next = virtualKeyboardTarget(event.key, current, items.length);
    if (next === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    scrollToIndex(next.index, { focus: true, align: next.align });
  }

  return <div {...attributes} ref={element} className={`virtual-record-list${className ? ` ${className}` : ''}`}
    data-virtual-count={items.length} data-virtual-start={range.start} data-virtual-end={range.end}
    onScroll={event => {
      onScroll?.(event);
      if (scrollFrame.current !== undefined) cancelAnimationFrame(scrollFrame.current);
      scrollFrame.current = requestAnimationFrame(() => { scrollFrame.current = undefined; updateViewport(); });
    }} onKeyDown={handleKeyDown}
    onFocusCapture={event => {
      onFocusCapture?.(event);
      const row = (event.target as HTMLElement).closest<HTMLElement>('[data-virtual-key]');
      if (row) setFocusedKey(row.dataset.virtualKey ?? null);
    }}>
    {header && <div className="virtual-record-list-header" ref={headerElement}>{header}</div>}
    <p id={instructionsId} className="sr-only">上下の矢印キーで前後の行、Homeで最初、Endで最後の行へ移動できます。Tabで一覧の外へ進めます。</p>
    {!items.length && emptyState}
    <div className="virtual-record-list-items" role="list" aria-label={ariaLabel} aria-describedby={instructionsId} style={{ height: layout.total }}>
      {rendered.map(index => <MeasuredRow key={keys[index]} recordKey={keys[index]} index={index} total={items.length}
        top={layout.offset(index)} onElement={attachRow}>{renderItem(items[index], index)}</MeasuredRow>)}
    </div>
    {footer}
  </div>;
}
