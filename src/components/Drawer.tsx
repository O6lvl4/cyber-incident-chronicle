import { useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import type { DrawerMode } from '../hooks/useAppState';
import { useDrawerModal } from '../hooks/useDrawerModal';

interface Props { mode: DrawerMode; onClose: () => void; children: ReactNode; title?: string }
const TITLES: Record<DrawerMode, string> = { none: '', event: 'INCIDENT DETAIL / 事案の詳細', sql: 'SQL CONSOLE', about: '掲載方針・読み方' };

function isBackdrop(event: MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false;
  const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
  return event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom;
}

function cycleTabFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== 'Tab') return;
  const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]')]
    .filter(control => control.tabIndex >= 0 && !control.matches(':disabled') && !control.closest('[inert]') && control.getClientRects().length > 0);
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (!first || !last) return;
  const active = document.activeElement;
  const boundary = event.shiftKey ? first : last;
  if (active !== boundary && active !== event.currentTarget && event.currentTarget.contains(active)) return;
  event.preventDefault();
  (event.shiftKey ? last : first).focus();
}

export default function Drawer({ mode, onClose, children, title }: Props) {
  const open = mode !== 'none';
  const { dialog, closeButton, content, requestClose, finishClose } = useDrawerModal(mode, onClose);
  const backdropPressed = useRef(false);
  return <dialog ref={dialog} className={`drawer${open ? ' open' : ''}${mode === 'sql' ? ' wide' : ''}`}
    aria-label={title ?? (TITLES[mode] || '詳細')}
    onCancel={event => { event.preventDefault(); requestClose(); }} onClose={finishClose} onKeyDown={cycleTabFocus}
    onPointerDown={event => { backdropPressed.current = isBackdrop(event); }}
    onPointerCancel={() => { backdropPressed.current = false; }}
    onClick={event => { const dismiss = backdropPressed.current && isBackdrop(event); backdropPressed.current = false; if (dismiss) requestClose(); }}>
    <div className="drawer-head"><span className="drawer-title">{title ?? TITLES[mode]}</span><button ref={closeButton} type="button" className="drawer-close" onClick={requestClose} aria-label="閉じる">✕</button></div>
    <div ref={content} className="drawer-content">{children}</div>
  </dialog>;
}
