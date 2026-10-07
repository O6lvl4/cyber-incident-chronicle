import { useEffect, useRef } from 'react';

export interface KeyboardActions {
  clearSelection: () => void;
  resetView: () => void;
  zoom: (factor: number) => void;
  step: (delta: -1 | 1) => void;
}

const ZOOM_IN = 0.78;
const ZOOM_OUT = 1.28;

function actionFor(key: string, a: KeyboardActions): (() => void) | null {
  const table: Record<string, () => void> = {
    Escape: a.clearSelection,
    '0': a.resetView,
    '+': () => a.zoom(ZOOM_IN),
    '=': () => a.zoom(ZOOM_IN),
    '-': () => a.zoom(ZOOM_OUT),
    ArrowLeft: () => a.step(-1),
    ArrowRight: () => a.step(1),
  };
  return table[key] ?? null;
}

/** Global keyboard shortcuts; ignored while typing in inputs. */
export function useKeyboardNav(actions: KeyboardActions) {
  const ref = useRef(actions);
  ref.current = actions;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const act = actionFor(e.key, ref.current);
      if (!act) return;
      e.preventDefault();
      act();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
