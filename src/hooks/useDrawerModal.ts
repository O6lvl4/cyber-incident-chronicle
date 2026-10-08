import { useLayoutEffect, useRef } from 'react';
import type { DrawerMode } from './useAppState';

const LOCKED_PROPERTIES = ['overflow-x', 'overflow-y', 'overscroll-behavior-x', 'overscroll-behavior-y'] as const;
interface ScrollLock { count: number; release: () => void }
const scrollLocks = new WeakMap<HTMLElement, ScrollLock>();

/** Keep the short-screen app at its current position, including across overlapping dialogs. */
function lockAppScroll(app: HTMLElement | null) {
  if (!app) return () => undefined;
  let lock = scrollLocks.get(app);
  if (!lock) {
    const properties = LOCKED_PROPERTIES.map(name => ({ name, value: app.style.getPropertyValue(name), priority: app.style.getPropertyPriority(name) }));
    const { scrollTop, scrollLeft } = app;
    LOCKED_PROPERTIES.forEach(name => app.style.setProperty(name, name.startsWith('overflow') ? 'hidden' : 'none'));
    lock = { count: 0, release: () => {
      properties.forEach(({ name, value, priority }) => {
        if (value) app.style.setProperty(name, value, priority);
        else app.style.removeProperty(name);
      });
      app.scrollTop = scrollTop;
      app.scrollLeft = scrollLeft;
    } };
    scrollLocks.set(app, lock);
  }
  lock.count += 1;
  const current = lock;
  return () => {
    current.count -= 1;
    if (current.count) return;
    current.release();
    scrollLocks.delete(app);
  };
}

export function useDrawerModal(mode: DrawerMode, onClose: () => void) {
  const open = mode !== 'none';
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const latest = useRef({ open, onClose });
  latest.current = { open, onClose };

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const active = document.activeElement;
    const opener = active instanceof HTMLElement && !element.contains(active) ? active : null;
    const releaseScroll = lockAppScroll(element.closest<HTMLElement>('.app'));
    if (!element.open) element.showModal();
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      if (element.open) element.close();
      releaseScroll();
      // A route change removes this shell. Never move focus into an old route,
      // or away from another control/modal that gained focus in the meantime.
      requestAnimationFrame(() => {
        if (!element.isConnected || element.open || !opener?.isConnected) return;
        const focused = document.activeElement;
        if (focused === document.body || focused === opener || focused === element || element.contains(focused)) opener.focus({ preventScroll: true });
      });
    };
  }, [open]);

  useLayoutEffect(() => {
    if (mode === 'none') return;
    if (content.current) content.current.scrollTop = 0;
    closeButton.current?.focus({ preventScroll: true });
  }, [mode]);

  const requestClose = () => { if (latest.current.open) latest.current.onClose(); };
  const finishClose = () => {
    // close() queues its event. Ignore cleanup events after StrictMode reopens
    // the dialog, and controlled closes that have already set mode to none.
    if (!dialog.current?.open && latest.current.open) latest.current.onClose();
  };
  return { dialog, closeButton, content, requestClose, finishClose };
}
