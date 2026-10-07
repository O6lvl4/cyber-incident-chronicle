import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { Link, Thread, TimelineEvent } from '../types';
import { AXIS_H, clampLevel, fitLevel, labelWidthFor, levelForScale, stripWidth, tAt, xAt } from '../engine/levels';
import { hitTest, rowsFor } from '../engine/hit';
import type { Theme } from '../engine/protocol';
import { colorLookup } from '../lib/palette';
import { useBoardEngine } from './useBoardEngine';
import { useZoomGestures, type ZoomPreview } from './useZoomGestures';
import LaneLabels from './LaneLabels';
import Overlay from './Overlay';

export interface ViewInfo {
  level: number;
  start: number;
  end: number;
}

export interface BoardApi {
  /** Scrolls so `t` sits in the middle of the plot, optionally switching level first. */
  centerOn: (t: number, level?: number) => void;
  /** Zooms by whole levels around the middle of the plot. */
  zoomBy: (delta: number) => void;
  fitAll: () => void;
}

interface Props {
  threads: Thread[];
  events: TimelineEvent[];
  links: Link[];
  activeIds: string[];
  theme: Theme;
  selectedId: string | null;
  matches: Set<string>;
  dataStart: number;
  dataEnd: number;
  initial: { level: number; center: number } | null;
  onSelect: (id: string | null) => void;
  onIdle: (v: ViewInfo) => void;
  apiRef: RefObject<BoardApi | null>;
}

const IDLE_MS = 150;
const EMPTY_ROWS = { rows: [], totalH: 0 };

function useWidth(ref: RefObject<HTMLDivElement | null>) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setW(el.clientWidth));
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
  return w;
}

/**
 * The programme guide itself: one native 2-D scroller whose content is a wide strip per zoom
 * level. The time axis sticks to the top, lane labels to the left, and the strip is filled with
 * tiles by the engine. React only renders the frame; scrolling never re-renders anything.
 */
export default function Board(props: Props) {
  const { threads, events, links, activeIds, theme, selectedId, matches, dataStart, dataEnd, initial, onSelect, onIdle, apiRef } = props;
  const scroller = useRef<HTMLDivElement>(null);
  const axisHost = useRef<HTMLDivElement>(null);
  const bodyHost = useRef<HTMLDivElement>(null);
  const axisGhost = useRef<HTMLDivElement>(null);
  const bodyGhost = useRef<HTMLDivElement>(null);
  const hosts = useMemo(() => ({ scroller, axis: axisHost, body: bodyHost, axisGhost, bodyGhost }), []);
  const width = useWidth(scroller);
  const labelW = labelWidthFor(width || 1000);
  const dpr = useMemo(() => Math.min(window.devicePixelRatio || 1, (width || 1000) < 640 ? 1.5 : 2), [width]);
  const [level, setLevel] = useState(clampLevel(initial?.level ?? 3));
  const colorOf = useMemo(() => colorLookup(threads, theme.dark), [threads, theme.dark]);

  const { layouts, update, applyRows, beginGhost, scheduleJump } = useBoardEngine({ hosts, events, threads, theme, dpr, labelW });
  const layout = layouts?.[level];
  const { rows, totalH } = useMemo(() => (layout ? rowsFor(layout, threads, activeIds, colorOf) : EMPTY_ROWS), [layout, threads, activeIds, colorOf]);
  const stripW = stripWidth(level);
  const plotW = Math.max(width - labelW, 1);
  useLayoutEffect(() => { if (layout) applyRows(level, rows); }, [applyRows, layout, level, rows]);

  const zoomTo = useCallback((target: number, focalT: number, focalVX: number) => {
    const next = clampLevel(target);
    if (next === level) { if (scroller.current) scroller.current.scrollLeft = xAt(level, focalT) - focalVX; return; }
    beginGhost(level, next);
    scheduleJump({ focalT, focalVX });
    setLevel(next);
  }, [beginGhost, scheduleJump, level]);

  useImperativeHandle(apiRef, () => ({
    centerOn: (t, lvl) => zoomTo(lvl ?? level, t, plotW / 2),
    zoomBy: delta => {
      const el = scroller.current;
      const focalX = (el?.scrollLeft ?? 0) + plotW / 2;
      zoomTo(level + delta, tAt(level, focalX), plotW / 2);
    },
    fitAll: () => zoomTo(fitLevel(dataEnd - dataStart, plotW), (dataStart + dataEnd) / 2, plotW / 2),
  }), [zoomTo, level, plotW, dataStart, dataEnd]);

  // First layout: restore the shared view or fit the whole data range.
  const booted = useRef(false);
  useEffect(() => {
    if (!layout || booted.current || width === 0) return;
    booted.current = true;
    if (initial) zoomTo(initial.level, initial.center, plotW / 2);
    else apiRef.current?.fitAll();
  }, [layout, width, initial, zoomTo, plotW, apiRef]);

  // Scrolling: one tile refresh per frame, and an idle report for the app (URL, minimap, span).
  const raf = useRef(0);
  const idle = useRef(0);
  const report = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    onIdle({ level, start: tAt(level, el.scrollLeft), end: tAt(level, el.scrollLeft + plotW) });
  }, [onIdle, level, plotW]);
  const onScroll = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; update(); });
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(report, IDLE_MS);
  }, [update, report]);
  useEffect(() => { if (layout && width > 0) report(); }, [layout, width, level, report]);
  useEffect(() => () => { cancelAnimationFrame(raf.current); window.clearTimeout(idle.current); }, []);

  // Zoom gestures: stretch the tile hosts while in flight, commit whole levels on release.
  const preview = useCallback((p: ZoomPreview | null) => {
    for (const host of [axisHost.current, bodyHost.current]) {
      if (!host) continue;
      host.style.transformOrigin = p ? `${p.focalX}px 0` : '';
      host.style.transform = p ? `scaleX(${p.scale})` : '';
    }
  }, []);
  const commit = useCallback((p: ZoomPreview) => {
    preview(null);
    const next = levelForScale(level, p.scale);
    const el = scroller.current;
    if (next === level || !el) return;
    zoomTo(next, tAt(level, p.focalX), p.focalX - el.scrollLeft);
  }, [preview, zoomTo, level]);
  const zg = useZoomGestures({ scrollerRef: scroller, labelW, onPreview: preview, onCommit: commit });

  /** Strip-space point of a mouse event. */
  const stripPoint = (e: { clientX: number; clientY: number }) => {
    const el = scroller.current!;
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left - labelW + el.scrollLeft, y: e.clientY - r.top - AXIS_H + el.scrollTop };
  };
  const [overChip, setOverChip] = useState(false);
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    zg.onPointerMove(e);
    if (e.pointerType !== 'mouse' || zg.dragging || !layout) return;
    const hit = hitTest(layout, rows, stripPoint(e)) !== null;
    if (hit !== overChip) setOverChip(hit);
  };
  const onClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (zg.wasDrag() || !layout) return;
    const p = stripPoint(e);
    if (p.x < 0 || p.y < 0) return;
    const chip = hitTest(layout, rows, p);
    onSelect(chip && chip.id !== selectedId ? chip.id : null);
  };

  const cls = `board${zg.dragging ? ' dragging' : ''}${overChip ? ' over-chip' : ''}`;
  return (
    <div ref={scroller} className={cls} onScroll={onScroll}
      onPointerDown={zg.onPointerDown} onPointerMove={onPointerMove} onPointerUp={zg.onPointerUp} onPointerCancel={zg.onPointerUp}
      onDoubleClick={zg.onDoubleClick} onClick={onClick}>
      <div className="board-content" style={{ width: labelW + stripW, height: AXIS_H + totalH }}>
        <div className="axis-strip" style={{ height: AXIS_H }}>
          <div className="axis-corner" style={{ width: labelW }}>TIMELINE</div>
          <div ref={axisGhost} className="axis-ghost" style={{ left: labelW, width: stripW }} />
          <div ref={axisHost} className="axis-tiles" style={{ left: labelW, width: stripW }} />
        </div>
        <div className="body" style={{ height: totalH }}>
          <LaneLabels threads={threads} rows={rows} labelW={labelW} totalH={totalH} />
          <div className="lanes" style={{ left: labelW, width: stripW, height: totalH }}>
            {rows.filter(r => !r.axis).map((r, i) => (
              <div key={r.id} className="lane-stripe" style={{ top: r.top, height: r.height, background: i % 2 === 0 ? 'transparent' : `${r.color}10` }} />
            ))}
            <div ref={bodyGhost} className="tile-ghost" />
            <div ref={bodyHost} className="tile-host" />
            {layout && <Overlay layout={layout} rows={rows} links={links} selectedId={selectedId} matches={matches} theme={theme} />}
          </div>
        </div>
      </div>
    </div>
  );
}
