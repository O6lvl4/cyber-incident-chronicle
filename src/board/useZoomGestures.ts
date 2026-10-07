import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent, type RefObject } from 'react';

/**
 * Zoom input for the board: pinch (touch), ⌘/Ctrl + wheel and double-click. While a gesture is in
 * flight the caller only stretches the tile layer with a CSS transform; on release it commits a
 * whole number of levels. Single-finger panning is native scrolling; a mouse drag scrolls too.
 */

export interface ZoomPreview {
  scale: number;
  /** Strip x (px from the plot's left edge) the stretch is anchored to. */
  focalX: number;
}

interface Params {
  scrollerRef: RefObject<HTMLDivElement | null>;
  labelW: number;
  onPreview: (p: ZoomPreview | null) => void;
  onCommit: (p: ZoomPreview) => void;
}

interface Pinch {
  focalX: number;
  dist: number;
  scale: number;
}

interface Drag {
  sx: number;
  sy: number;
  left: number;
  top: number;
}

const DRAG_PX = 4;
const SETTLE_MS = 150;

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function useZoomGestures({ scrollerRef, labelW, onPreview, onCommit }: Params) {
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<Pinch | null>(null);
  const drag = useRef<Drag | null>(null);
  const moved = useRef(false);
  const wheel = useRef<{ p: ZoomPreview | null; timer: number }>({ p: null, timer: 0 });
  const cb = useRef({ onPreview, onCommit, labelW });
  cb.current = { onPreview, onCommit, labelW };

  /** Strip x of a client x. */
  const stripX = (clientX: number) => {
    const el = scrollerRef.current;
    if (!el) return 0;
    return clientX - el.getBoundingClientRect().left - cb.current.labelW + el.scrollLeft;
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const w = wheel.current;
      const p = w.p ?? { scale: 1, focalX: stripX(e.clientX) };
      w.p = { ...p, scale: p.scale * Math.exp(-e.deltaY * 0.01) };
      cb.current.onPreview(w.p);
      window.clearTimeout(w.timer);
      w.timer = window.setTimeout(() => { const done = w.p; w.p = null; if (done) cb.current.onCommit(done); }, SETTLE_MS);
    };
    // Mobile Safari ignores touch-action for pinch: keep two-finger gestures away from the browser.
    const blockMulti = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
    const blockGesture = (e: Event) => e.preventDefault();
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', blockMulti, { passive: false });
    el.addEventListener('touchmove', blockMulti, { passive: false });
    el.addEventListener('gesturestart', blockGesture);
    el.addEventListener('gesturechange', blockGesture);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', blockMulti);
      el.removeEventListener('touchmove', blockMulti);
      el.removeEventListener('gesturestart', blockGesture);
      el.removeEventListener('gesturechange', blockGesture);
    };
  }, [scrollerRef]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      pinch.current = { focalX: stripX((pts[0].x + pts[1].x) / 2), dist: Math.max(dist(pts[0], pts[1]), 1), scale: 1 };
      return;
    }
    if (e.pointerType === 'touch') return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* already released */ }
    const el = scrollerRef.current;
    drag.current = { sx: e.clientX, sy: e.clientY, left: el?.scrollLeft ?? 0, top: el?.scrollTop ?? 0 };
    setDragging(true);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = pinch.current;
    const pts = [...pointers.current.values()];
    if (g && pts.length >= 2) {
      moved.current = true;
      g.scale = dist(pts[0], pts[1]) / g.dist;
      cb.current.onPreview({ scale: g.scale, focalX: g.focalX });
      return;
    }
    const d = drag.current;
    const el = scrollerRef.current;
    if (!d || !el) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) > DRAG_PX || Math.abs(dy) > DRAG_PX) moved.current = true;
    el.scrollLeft = d.left - dx;
    el.scrollTop = d.top - dy;
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    const g = pinch.current;
    if (g) {
      pinch.current = null;
      if (moved.current) cb.current.onCommit({ scale: g.scale, focalX: g.focalX });
      else cb.current.onPreview(null);
    }
    if (pointers.current.size === 0) { drag.current = null; setDragging(false); }
  };

  const onDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const x = stripX(e.clientX);
    if (x < 0) return;
    cb.current.onCommit({ scale: 2, focalX: x });
  };

  return { dragging, wasDrag: () => moved.current, onPointerDown, onPointerMove, onPointerUp, onDoubleClick };
}
