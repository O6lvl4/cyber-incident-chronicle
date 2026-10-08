import { useEffect } from 'react';

interface Position { top?: number; focusKey?: string }
const positions = new Map<string, Position>();

/** A direct package link has no opener DOM, but Back still has a useful focus target. */
export function rememberPackageReturn(listKey: string, focusKey: string) {
  const scroll = document.querySelector<HTMLElement>('[data-package-scroll="packages"]');
  positions.set(listKey, { top: scroll?.scrollTop ?? positions.get(listKey)?.top, focusKey });
}

/** Route remounts preserve the package page's scroll and the package that opened it. */
export function usePackageListPosition(listKey: string, active: boolean, hasSelection: boolean) {
  useEffect(() => {
    if (!active) return;
    const scroll = document.querySelector<HTMLElement>('[data-package-scroll="packages"]');
    if (!scroll) return;
    const position = positions.get(listKey);
    let restored = false;
    const frame = requestAnimationFrame(() => {
      restored = true;
      if (!position || !scroll.isConnected) return;
      if (position.top !== undefined) scroll.scrollTop = position.top;
      if (hasSelection || (document.activeElement instanceof HTMLElement && document.activeElement !== document.body)) return;
      const opener = [...scroll.querySelectorAll<HTMLElement>('[data-package-key]')].find(item => item.dataset.packageKey === position.focusKey);
      const target = opener ?? document.getElementById('package-results-heading');
      target?.focus({ preventScroll: true });
      if (position.top === undefined) opener?.scrollIntoView({ block: 'nearest' });
    });
    const remember = () => {
      // StrictMode's first cleanup runs before restoration and must not replace
      // an earlier route's saved offset with this new DOM node's initial zero.
      if (!restored) return;
      const focused = document.activeElement instanceof HTMLElement ? document.activeElement.closest<HTMLElement>('[data-package-key]') : null;
      positions.set(listKey, { top: scroll.scrollTop, focusKey: focused?.dataset.packageKey ?? positions.get(listKey)?.focusKey });
      if (positions.size > 40) positions.delete(positions.keys().next().value!);
    };
    scroll.addEventListener('scroll', remember);
    scroll.addEventListener('focusin', remember);
    return () => { cancelAnimationFrame(frame); remember(); scroll.removeEventListener('scroll', remember); scroll.removeEventListener('focusin', remember); };
  }, [listKey, active, hasSelection]);
}
