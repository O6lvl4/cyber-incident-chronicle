import { useCallback, useMemo, useState } from 'react';
import type { TimelineEvent } from '../types';
import type { ViewInfo } from '../board/Board';
import { readUrl } from '../lib/urlState';
export type DrawerMode = 'none' | 'event' | 'sql' | 'about';
interface Params { events: TimelineEvent[]; threadIds: string[] }
export function useAppState({ events, threadIds }: Params) {
  const [url] = useState(readUrl);
  const [selectedId, setSelectedId] = useState<string | null>(events.some(e => e.id === url.sel) ? url.sel! : null);
  const [activeIds, setActiveIds] = useState<string[]>(() => url.lanes?.filter(id => threadIds.includes(id)) ?? threadIds);
  const [query, setQuery] = useState(url.query ?? '');
  const [status, setStatus] = useState(url.status ?? 'all');
  const [dark, setDark] = useState(() => url.dark ?? window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [sqlOpen, setSqlOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [view, setView] = useState<ViewInfo | null>(null);
  const [mobileView, setMobileView] = useState<'timeline' | 'list'>('timeline');
  const matches = useMemo(() => new Set<string>(), []);
  const select = useCallback((id: string | null) => { setSelectedId(id); setSqlOpen(false); setAboutOpen(false); }, []);
  const toggleLane = useCallback((id: string) => setActiveIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]), []);
  const toggleSql = useCallback(() => { setSqlOpen(o => !o); setSelectedId(null); setAboutOpen(false); }, []);
  const toggleAbout = useCallback(() => { setAboutOpen(o => !o); setSelectedId(null); setSqlOpen(false); }, []);
  const closeDrawer = useCallback(() => { setSelectedId(null); setSqlOpen(false); setAboutOpen(false); }, []);
  const resetFilters = useCallback(() => { setActiveIds(threadIds); setQuery(''); setStatus('all'); }, [threadIds]);
  const toggleDark = useCallback(() => setDark(d => !d), []);
  let drawerMode: DrawerMode = 'none';
  if (sqlOpen) drawerMode = 'sql'; else if (aboutOpen) drawerMode = 'about'; else if (selectedId) drawerMode = 'event';
  return { initial: url.level !== undefined && url.center !== undefined ? { level: url.level, center: url.center } : null,
    selectedId, select, activeIds, toggleLane, query, setQuery, status, setStatus, matches,
    dark, toggleDark, sqlOpen, toggleSql, aboutOpen, toggleAbout, drawerMode, closeDrawer, view, setView,
    mobileView, setMobileView, resetFilters };
}
export type AppState = ReturnType<typeof useAppState>;
