import { useEffect, useRef, type ReactNode } from 'react';
import type { DrawerMode } from '../hooks/useAppState';
interface Props { mode: DrawerMode; onClose: () => void; children: ReactNode; title?: string }
const TITLES: Record<DrawerMode, string> = { none: '', event: 'INCIDENT DETAIL / 事案の詳細', sql: 'SQL CONSOLE', about: '掲載方針・読み方' };
export default function Drawer({ mode, onClose, children, title }: Props) {
  const open = mode !== 'none';
  const ref = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [open]);
  return <>{open && <div className="drawer-backdrop" onClick={onClose} aria-hidden="true"/>}
    <aside ref={ref} className={`drawer${open ? ' open' : ''}${mode === 'sql' ? ' wide' : ''}`} role="dialog" aria-label={title ?? (TITLES[mode] || '詳細')} aria-hidden={!open} inert={!open}
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
      <div className="drawer-head"><span className="drawer-title">{title ?? TITLES[mode]}</span><button ref={close} className="drawer-close" onClick={onClose} aria-label="閉じる">✕</button></div>
      <div className="drawer-content">{children}</div>
    </aside></>;
}
