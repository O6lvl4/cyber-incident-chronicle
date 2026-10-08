import IncidentTimeline from './components/IncidentTimeline';
import BrowseControls from './components/BrowseControls';
import { INCIDENT_SORT_OPTIONS, normalizeIncidentSort, sortIncidents, type IncidentSort } from './lib/browseSort';
import { matchesClassification } from './lib/classification';
import ClassificationSummary from './components/ClassificationSummary';
import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EVENTS, INCIDENTS, META, THREADS, DATASET } from './data';
import { useAppState } from './hooks/useAppState';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { useDuckDB } from './hooks/useDuckDB';
import { readUrl, type UrlState } from './lib/urlState';
import { createUrlNavigation } from './lib/urlNavigation';
import { filterIncidents } from './lib/incidents';
import { perf } from './lib/perf';
import type { BoardApi } from './board/Board';
import Header from './components/Header';
import Drawer from './components/Drawer';
import DrawerContent from './components/DrawerContent';
import IncidentList from './components/IncidentList';
import PerfHud from './components/PerfHud';
const VulnerabilityView = lazy(() => import('./components/VulnerabilityView'));
import CategoryNav, { type Category, type CategoryProps, type CategoryRouteProps } from './components/CategoryNav';
class AdvisoryLoadBoundary extends Component<CategoryProps & { children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="app"><CategoryNav category={this.props.category} onCategoryChange={this.props.onCategoryChange}/><p role="alert">脆弱性データを読み込めませんでした。接続を確認して再読み込みしてください。</p><button className="n-btn" onClick={() => location.reload()}>再読み込み</button></div>;
  }
}
const THREAD_IDS = THREADS.map(t => t.id);

function IncidentApp(props: CategoryRouteProps) {
  const st = useAppState({ events: EVENTS, threadIds: THREAD_IDS, initialUrl: props.initialUrl });
  const [sort, setSort] = useState<IncidentSort>(() => normalizeIncidentSort(props.initialUrl.sort));
  const board = useRef<BoardApi>(null);
  const eventsById = useMemo(() => new Map(EVENTS.map(e => [e.id, e])), []);
  const visible = useMemo(() => sortIncidents(filterIncidents(INCIDENTS, st.activeIds, st.status, st.query).filter(item => matchesClassification(item, st.classification)), sort), [st.activeIds, st.status, st.query, st.classification, sort]);
  const shownIds = useMemo(() => new Set(visible.map(item => item.id)), [visible]);
  const shownEvents = useMemo(() => EVENTS.filter(event => shownIds.has(event.incidentId ?? '')), [shownIds]);
  const [dbWanted, setDbWanted] = useState(false);
  useEffect(() => { if (st.sqlOpen) setDbWanted(true); }, [st.sqlOpen]);
  const db = useDuckDB(DATASET, dbWanted);
  const selectAndCenter = useCallback((id: string) => {
    st.select(id);
    const ev = eventsById.get(id);
    if (ev) board.current?.centerOn(Date.parse(ev.date));
  }, [st.select, eventsById]);
  const selectIncident = useCallback((id: string) => {
    if (eventsById.has(id)) selectAndCenter(id);
  }, [selectAndCenter, eventsById]);
  const selectedIncidentId = st.selectedId ? eventsById.get(st.selectedId)?.incidentId : undefined;
  useEffect(() => {
    if (selectedIncidentId && !shownIds.has(selectedIncidentId)) st.closeDrawer();
  }, [selectedIncidentId, shownIds, st.closeDrawer]);
  useKeyboardNav({ clearSelection: st.closeDrawer, resetView: () => board.current?.fitAll(),
    zoom: factor => board.current?.zoomBy(factor < 1 ? 1 : -1),
    step: delta => { if (st.displayView !== 'timeline') return; const sorted = sortIncidents(visible, 'published-asc'); const index = sorted.findIndex(i => i.id === selectedIncidentId); const next = sorted[Math.max(0, Math.min(sorted.length - 1, index + delta))]; if (next) selectIncident(next.id); },
  });
  useEffect(() => {
    props.onUrlChange({ level: st.view?.level ?? st.initial?.level, center: st.view ? (st.view.start + st.view.end) / 2 : st.initial?.center, sel: st.selectedId ?? undefined,
      lanes: st.activeIds, dark: st.dark, query: st.query, status: st.status, classification: st.classification, view: st.displayView, sort });
  }, [st.view, st.selectedId, st.activeIds, st.dark, st.query, st.status, st.classification, st.displayView, sort, props.onUrlChange]);
  const showResults = useCallback(() => {
    const id = st.displayView === 'timeline' ? 'incident-timeline-results' : 'incident-results-heading';
    requestAnimationFrame(() => {
      const target = document.getElementById(id);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'start' });
    });
  }, [st.displayView]);
  const changeView = (view: 'list' | 'timeline') => props.onNavigate({ ...readUrl(), view });
  return <div data-filtered={visible.length} data-total={INCIDENTS.length} className={`app incident-app${st.dark ? ' dark' : ''}`}>
    <Header {...props} viewControls={<BrowseControls view={st.displayView} onViewChange={changeView} listId="incident-list-panel" timelineId="incident-timeline-results" sortValue={sort} sortOptions={INCIDENT_SORT_OPTIONS} onSortChange={value => setSort(normalizeIncidentSort(value))}/>} threads={THREADS} state={st} resultCount={visible.length} onShowResults={showResults} onFitAll={() => board.current?.fitAll()}/>
    <div className="summary-strip"><span><i className="live-dot"/>一次資料からたどる、企業のインシデント</span><span>資料確認 {META.lastVerifiedDate} · 選定事例</span></div>
    <ClassificationSummary incidents={visible}/>
    <main className={`workspace view-${st.displayView}`}>
      <IncidentList hidden={st.displayView !== 'list'} incidents={visible} total={INCIDENTS.length} selectedId={selectedIncidentId} onSelect={selectIncident} onReset={st.resetFilters}/>
      <IncidentTimeline state={st} events={shownEvents} hasResults={visible.length > 0} board={board}/>
      <Drawer mode={st.drawerMode} onClose={st.closeDrawer}><DrawerContent state={st} db={db} eventsById={eventsById} onSelect={id => { st.resetFilters(); const event = eventsById.get(id) ?? EVENTS.find(item => item.incidentId === id); if (event) selectAndCenter(event.id); }}/></Drawer>
    </main>
    {perf.enabled && <PerfHud/>}
  </div>;
}

/** Category navigation gets history entries; filters continue to replace the current view. */
export default function App() {
  const [navigation] = useState(createUrlNavigation);
  const [route, setRoute] = useState(navigation.initial);
  const category = route.initialUrl.kind ?? 'incident';
  useEffect(() => {
    const restore = () => setRoute(navigation.restore());
    window.addEventListener('popstate', restore);
    window.addEventListener('hashchange', restore);
    return () => { window.removeEventListener('popstate', restore); window.removeEventListener('hashchange', restore); };
  }, [navigation]);
  const changeCategory = (nextCategory: Category) => {
    if (nextCategory === category) return;
    const p = new URLSearchParams();
    if (nextCategory === 'vulnerability') p.set('kind', nextCategory);
    const dark = readUrl().dark;
    if (dark !== undefined) p.set('theme', dark ? 'dark' : 'light');
    history.pushState(null, '', `#${p.toString()}`);
    setRoute(navigation.restore());
  };
  const onNavigate = (state: UrlState) => setRoute(navigation.navigate(state, route.revision));
  const props = { onNavigate, category, onCategoryChange: changeCategory, initialUrl: route.initialUrl, onUrlChange: route.onUrlChange };
  return category === 'vulnerability'
    ? <AdvisoryLoadBoundary key={route.revision} {...props}><Suspense fallback={<div className="app"><CategoryNav {...props}/><p role="status">ライブラリの全記録を読み込み中…</p></div>}><VulnerabilityView {...props}/></Suspense></AdvisoryLoadBoundary>
    : <IncidentApp key={route.revision} {...props}/>;
}
