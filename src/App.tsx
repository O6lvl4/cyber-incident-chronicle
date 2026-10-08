import { matchesClassification } from './lib/classification';
import ClassificationSummary from './components/ClassificationSummary';
import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DATA_END, DATA_START, EVENTS, INCIDENTS, LANES, LINKS, META, THREADS, DATASET } from './data';
import { useAppState } from './hooks/useAppState';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { useDuckDB } from './hooks/useDuckDB';
import { themeFor } from './lib/palette';
import { readUrl, writeUrl } from './lib/urlState';
import { filterIncidents } from './lib/incidents';
import { perf } from './lib/perf';
import Board, { type BoardApi } from './board/Board';
import Header from './components/Header';
import Drawer from './components/Drawer';
import DrawerContent from './components/DrawerContent';
import IncidentList from './components/IncidentList';
import Minimap from './components/Minimap';
import PerfHud from './components/PerfHud';
const VulnerabilityView = lazy(() => import('./components/VulnerabilityView'));
import CategoryNav, { type Category, type CategoryProps } from './components/CategoryNav';
class AdvisoryLoadBoundary extends Component<CategoryProps & { children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="app"><CategoryNav category={this.props.category} onCategoryChange={this.props.onCategoryChange}/><p role="alert">脆弱性データを読み込めませんでした。接続を確認して再読み込みしてください。</p><button className="n-btn" onClick={() => location.reload()}>再読み込み</button></div>;
  }
}
const THREAD_IDS = THREADS.map(t => t.id);
const LANE_IDS = LANES.map(t => t.id);

function IncidentApp(props: CategoryProps) {
  const st = useAppState({ events: EVENTS, threadIds: THREAD_IDS });
  const board = useRef<BoardApi>(null);
  const eventsById = useMemo(() => new Map(EVENTS.map(e => [e.id, e])), []);
  const visible = useMemo(() => filterIncidents(INCIDENTS, st.activeIds, st.status, st.query).filter(item => matchesClassification(item, st.classification)), [st.activeIds, st.status, st.query, st.classification]);
  const shownIds = useMemo(() => new Set(visible.map(item => item.id)), [visible]);
  const shownEvents = useMemo(() => EVENTS.filter(event => shownIds.has(event.incidentId ?? '')), [shownIds]);
  const theme = useMemo(() => themeFor(st.dark), [st.dark]);
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
    step: delta => { const sorted = [...visible].reverse(); const index = sorted.findIndex(i => i.id === selectedIncidentId); const next = sorted[Math.max(0, Math.min(sorted.length - 1, index + delta))]; if (next) selectIncident(next.id); },
  });
  useEffect(() => {
    writeUrl({ level: st.view?.level ?? st.initial?.level, center: st.view ? (st.view.start + st.view.end) / 2 : st.initial?.center, sel: st.selectedId ?? undefined,
      lanes: st.activeIds, dark: st.dark, query: st.query, status: st.status, classification: st.classification });
  }, [st.view, st.selectedId, st.activeIds, st.dark, st.query, st.status, st.classification]);
  const showResults = useCallback(() => {
    const id = window.matchMedia('(max-width: 640px)').matches && st.mobileView === 'timeline' ? 'incident-timeline-results' : 'incident-results-heading';
    requestAnimationFrame(() => {
      const target = document.getElementById(id);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'start' });
    });
  }, [st.mobileView]);
  const zoomed = !!st.view && (st.view.start > DATA_START || st.view.end < DATA_END);
  const centerRange = useCallback((s: number, e: number) => board.current?.centerOn((s + e) / 2), []);
  return <div className={`app incident-app${st.dark ? ' dark' : ''}`}>
    <Header {...props} threads={THREADS} state={st} resultCount={visible.length} onShowResults={showResults} onFitAll={() => board.current?.fitAll()}/>
    <div className="summary-strip"><span><i className="live-dot"/>一次資料からたどる、企業のインシデント</span><span>資料確認 {META.lastVerifiedDate} · 選定事例</span></div>
    <ClassificationSummary incidents={visible}/>
    <div className="mobile-tabs" role="group" aria-label="表示切替"><button aria-pressed={st.mobileView === 'timeline'} onClick={() => st.setMobileView('timeline')}>タイムライン</button><button aria-pressed={st.mobileView === 'list'} onClick={() => st.setMobileView('list')}>事案一覧 ({visible.length})</button></div>
    <main className={`workspace mobile-${st.mobileView}`}>
      <IncidentList incidents={visible} total={INCIDENTS.length} selectedId={selectedIncidentId} onSelect={selectIncident} onReset={st.resetFilters}/>
      <section id="incident-timeline-results" tabIndex={-1} className="timeline-container" aria-label="事案のタイムライン">
        <div className="board-toolbar"><div><strong>収録した公表日のタイムライン</strong><span>1事案を1つの点で表示。影響の種類は上の絞り込みで選択</span></div><div className="zoom-controls"><button className="n-btn" onClick={() => board.current?.zoomBy(-1)} aria-label="縮小">−</button><button className="n-btn" onClick={() => board.current?.zoomBy(1)} aria-label="拡大">＋</button><button className="n-btn" onClick={() => board.current?.fitAll()}>全期間</button></div></div>
        <Board threads={LANES} events={shownEvents} links={LINKS} activeIds={LANE_IDS} theme={theme}
          selectedId={st.selectedId} matches={st.matches} dataStart={DATA_START} dataEnd={DATA_END}
          initial={st.initial} onSelect={st.select} onIdle={st.setView} apiRef={board}/>
        {visible.length === 0 && <div className="board-empty"><p>表示する事案がありません</p><button className="n-btn" onClick={st.resetFilters}>絞り込みを解除</button></div>}
        <div className="timeline-caption"><span>{zoomed ? '横にスワイプ・ドラッグで移動 / ピンチ・−で縮小' : '全期間を表示中 / ＋・ピンチ・ダブルクリックで拡大'}</span><span>点の色や大きさは深刻度の順位ではありません</span></div>
        <Minimap threads={LANES} events={shownEvents} activeThreadIds={LANE_IDS} dataStart={DATA_START} dataEnd={DATA_END}
          viewStart={st.view?.start ?? DATA_START} viewEnd={st.view?.end ?? DATA_END} dark={st.dark} onViewChange={centerRange}/>
      </section>
      <Drawer mode={st.drawerMode} onClose={st.closeDrawer}><DrawerContent state={st} db={db} eventsById={eventsById} onSelect={id => { st.resetFilters(); const event = eventsById.get(id) ?? EVENTS.find(item => item.incidentId === id); if (event) selectAndCenter(event.id); }}/></Drawer>
    </main>
    {perf.enabled && <PerfHud/>}
  </div>;
}

/** Category navigation gets history entries; filters continue to replace the current view. */
export default function App() {
  const [route, setRoute] = useState(() => ({ category: readUrl().kind ?? 'incident', revision: 0 }));
  useEffect(() => {
    const restore = () => setRoute(previous => ({ category: readUrl().kind ?? 'incident', revision: previous.revision + 1 }));
    window.addEventListener('popstate', restore);
    return () => { window.removeEventListener('popstate', restore); };
  }, []);
  const changeCategory = (category: Category) => {
    if (category === route.category) return;
    const p = new URLSearchParams();
    if (category === 'vulnerability') p.set('kind', category);
    const dark = readUrl().dark;
    if (dark !== undefined) p.set('theme', dark ? 'dark' : 'light');
    history.pushState(null, '', `#${p.toString()}`);
    setRoute(previous => ({ category, revision: previous.revision + 1 }));
  };
  const props = { category: route.category, onCategoryChange: changeCategory };
  return route.category === 'vulnerability'
    ? <AdvisoryLoadBoundary key={route.revision} {...props}><Suspense fallback={<div className="app"><CategoryNav {...props}/><p role="status">ライブラリの全記録を読み込み中…</p></div>}><VulnerabilityView {...props}/></Suspense></AdvisoryLoadBoundary>
    : <IncidentApp key={route.revision} {...props}/>;
}
