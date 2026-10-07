import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Thread, TimelineEvent } from '../types';
import type { LevelLayout } from '../engine/layout';
import type { Theme } from '../engine/protocol';
import { createTileSource, type TileSource } from '../engine/tileSource';
import { TileLayer, type Row } from '../engine/tileLayer';
import { AXIS_H, ppd, xAt } from '../engine/levels';
import { count } from '../lib/perf';

export interface Hosts {
  scroller: RefObject<HTMLDivElement | null>;
  axis: RefObject<HTMLDivElement | null>;
  body: RefObject<HTMLDivElement | null>;
  axisGhost: RefObject<HTMLDivElement | null>;
  bodyGhost: RefObject<HTMLDivElement | null>;
}

interface Params {
  hosts: Hosts;
  events: TimelineEvent[];
  threads: Thread[];
  theme: Theme;
  dpr: number;
  labelW: number;
}

interface Jump {
  focalT: number;
  focalVX: number;
}

const GHOST_MS = 700;

/**
 * Owns the tile source (worker) and the tile layer, keeps them in step with the level and lane
 * rows, and performs level switches: the outgoing tiles are kept as a stretched "ghost" until the
 * incoming level has covered the viewport, and the focal instant stays under the finger.
 */
export function useBoardEngine(p: Params) {
  const { hosts, events, threads, theme, dpr, labelW } = p;
  const [layouts, setLayouts] = useState<LevelLayout[] | null>(null);
  const sourceRef = useRef<TileSource | null>(null);
  const layerRef = useRef<TileLayer | null>(null);
  const jump = useRef<Jump | null>(null);
  const ghostTimer = useRef(0);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const axis = hosts.axis.current;
    const body = hosts.body.current;
    if (!axis || !body) return;
    const source = createTileSource({ events, threads, theme: themeRef.current, dpr });
    const layer = new TileLayer(source, { axis, body }, dpr);
    sourceRef.current = source;
    layerRef.current = layer;
    let disposed = false;
    setLayouts(null);
    source.layouts.then(next => { if (!disposed) setLayouts(next); });
    return () => { disposed = true; layer.dispose(); source.dispose(); layerRef.current = null; sourceRef.current = null; };
  }, [hosts.axis, hosts.body, events, threads, dpr]);

  useEffect(() => {
    sourceRef.current?.setTheme(theme);
    layerRef.current?.invalidate();
  }, [theme]);

  /** Re-evaluates which tiles the current scroll position needs. */
  const update = useCallback(() => {
    const el = hosts.scroller.current;
    const layer = layerRef.current;
    if (!el || !layer) return;
    layer.update({ x: el.scrollLeft, y: el.scrollTop, w: el.clientWidth - labelW, h: el.clientHeight - AXIS_H });
  }, [hosts.scroller, labelW]);

  const clearGhost = useCallback(() => {
    window.clearTimeout(ghostTimer.current);
    for (const host of [hosts.axisGhost.current, hosts.bodyGhost.current]) {
      if (!host) continue;
      host.replaceChildren();
      host.style.transform = '';
    }
  }, [hosts.axisGhost, hosts.bodyGhost]);

  /** Level or rows changed (call from a layout effect): apply the pending jump, re-place ghost tiles, refresh. */
  const applyRows = useCallback((level: number, rows: Row[]) => {
    const el = hosts.scroller.current;
    const layer = layerRef.current;
    if (!el || !layer) return;
    const j = jump.current;
    jump.current = null;
    if (j) el.scrollLeft = xAt(level, j.focalT) - j.focalVX;
    const ghost = hosts.bodyGhost.current;
    if (ghost) {
      for (const cv of [...ghost.children] as HTMLElement[]) {
        const row = rows.find(r => r.id === cv.dataset.row);
        if (row) cv.style.top = `${row.top}px`; else cv.remove();
      }
    }
    layer.setRows(level, rows);
    update();
  }, [hosts.scroller, hosts.bodyGhost, update]);

  /** Moves the mounted tiles into the ghost hosts, stretched from the old to the new scale. */
  const beginGhost = useCallback((fromLevel: number, toLevel: number) => {
    const layer = layerRef.current;
    const axisGhost = hosts.axisGhost.current;
    const bodyGhost = hosts.bodyGhost.current;
    if (!layer || !axisGhost || !bodyGhost) return;
    clearGhost();
    const r = ppd(toLevel) / ppd(fromLevel);
    for (const cv of layer.detachAll()) (cv.dataset.row === 'axis' ? axisGhost : bodyGhost).appendChild(cv);
    axisGhost.style.transform = `scaleX(${r})`;
    bodyGhost.style.transform = `scaleX(${r})`;
    layer.onSettled = () => { clearGhost(); layer.onSettled = null; };
    ghostTimer.current = window.setTimeout(clearGhost, GHOST_MS);
    count('levelSwitches');
  }, [hosts.axisGhost, hosts.bodyGhost, clearGhost]);

  /** Schedules the scroll position for after the next level render: keep `focalT` at `focalVX`. */
  const scheduleJump = useCallback((j: Jump) => { jump.current = j; }, []);

  return { layouts, update, applyRows, beginGhost, scheduleJump };
}
