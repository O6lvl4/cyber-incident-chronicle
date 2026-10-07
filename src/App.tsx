import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DATA_END, DATA_START, EVENTS, INCIDENTS, LINKS, META, THREADS } from './data';
import { useAppState } from './hooks/useAppState';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { useDuckDB } from './hooks/useDuckDB';
import { themeFor } from './lib/palette';
import { writeUrl } from './lib/urlState';
import { filterIncidents } from './lib/incidents';
import { perf } from './lib/perf';
import Board, { type BoardApi } from './board/Board';
import Header from './components/Header';
import Drawer from './components/Drawer';
import DrawerContent from './components/DrawerContent';
import IncidentList from './components/IncidentList';
import Minimap from './components/Minimap';
import PerfHud from './components/PerfHud';
const THREAD_IDS = THREADS.map(t => t.id);
const DATASET = { threads: THREADS, events: EVENTS, links: LINKS, incidents: INCIDENTS };
export default function App() {
  const st = useAppState({ events: EVENTS, threadIds: THREAD_IDS });
  const board = useRef<BoardApi>(null);
  const eventsById = useMemo(() => new Map(EVENTS.map(e => [e.id, e])), []);
  const visible = useMemo(() => filterIncidents(INCIDENTS, st.activeIds, st.status, st.query), [st.activeIds, st.status, st.query]);
  const shownIds = useMemo(() => new Set(visible.map(item => item.id)), [visible]);
  const shownEvents = useMemo(() => EVENTS.filter(event => shownIds.has(event.incidentId)), [shownIds]);
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
    const event = EVENTS.find(ev => ev.incidentId === id && st.activeIds.includes(ev.threadId));
    if (event) selectAndCenter(event.id);
  }, [selectAndCenter, st.activeIds]);
  const selectedIncidentId = st.selectedId ? eventsById.get(st.selectedId)?.incidentId : undefined;
  useEffect(() => {
    if (selectedIncidentId && !shownIds.has(selectedIncidentId)) st.closeDrawer();
  }, [selectedIncidentId, shownIds, st.closeDrawer]);
  useKeyboardNav({ clearSelection: st.closeDrawer, resetView: () => board.current?.fitAll(),
    zoom: factor => board.current?.zoomBy(factor < 1 ? 1 : -1),
    step: delta => { const sorted = [...visible].reverse(); const index = sorted.findIndex(i => i.id === selectedIncidentId); const next = sorted[Math.max(0, Math.min(sorted.length - 1, index + delta))]; if (next) selectIncident(next.id); },
  });
  useEffect(() => {
    writeUrl({ level: st.view?.level, center: st.view ? (st.view.start + st.view.end) / 2 : undefined, sel: st.selectedId ?? undefined,
      lanes: st.activeIds, dark: st.dark, query: st.query, status: st.status });
  }, [st.view, st.selectedId, st.activeIds, st.dark, st.query, st.status]);
  const centerRange = useCallback((s: number, e: number) => board.current?.centerOn((s + e) / 2), []);
  return <div className={`app${st.dark ? ' dark' : ''}`}>
    <Header threads={THREADS} state={st} onFitAll={() => board.current?.fitAll()}/>
    <div className="summary-strip"><span><i className="live-dot"/>一次資料からたどる、企業のインシデント</span><span>資料確認 {META.lastVerifiedDate} · 選定事例</span></div>
    <div className="mobile-tabs" role="group" aria-label="表示切替"><button aria-pressed={st.mobileView === 'timeline'} onClick={() => st.setMobileView('timeline')}>タイムライン</button><button aria-pressed={st.mobileView === 'list'} onClick={() => st.setMobileView('list')}>事案一覧 ({visible.length})</button></div>
    <main className={`workspace mobile-${st.mobileView}`}>
      <IncidentList incidents={visible} total={INCIDENTS.length} selectedId={selectedIncidentId} onSelect={selectIncident} onReset={st.resetFilters}/>
      <section className="timeline-container" aria-label="影響別タイムライン">
        <div className="board-toolbar"><div><strong>収録した公表日のタイムライン</strong><span>同じ事案を、該当する影響のレーンに表示</span></div><div className="zoom-controls"><button className="n-btn" onClick={() => board.current?.zoomBy(-1)} aria-label="縮小">−</button><button className="n-btn" onClick={() => board.current?.zoomBy(1)} aria-label="拡大">＋</button><button className="n-btn" onClick={() => board.current?.fitAll()}>全期間</button></div></div>
        <Board threads={THREADS} events={shownEvents} links={LINKS} activeIds={st.activeIds} theme={theme}
          selectedId={st.selectedId} matches={st.matches} dataStart={DATA_START} dataEnd={DATA_END}
          initial={st.initial} onSelect={st.select} onIdle={st.setView} apiRef={board}/>
        {visible.length === 0 && <div className="board-empty"><p>表示する事案がありません</p><button className="n-btn" onClick={st.resetFilters}>絞り込みを解除</button></div>}
        <div className="timeline-caption"><span>横にスワイプ・ドラッグで移動 / ピンチで拡大縮小</span><span>色は影響の種類。深刻度の順位ではありません</span></div>
        <Minimap threads={THREADS} events={shownEvents} activeThreadIds={st.activeIds} dataStart={DATA_START} dataEnd={DATA_END}
          viewStart={st.view?.start ?? DATA_START} viewEnd={st.view?.end ?? DATA_END} dark={st.dark} onViewChange={centerRange}/>
      </section>
      <Drawer mode={st.drawerMode} onClose={st.closeDrawer}><DrawerContent state={st} db={db} eventsById={eventsById} onSelect={id => { st.resetFilters(); const event = eventsById.get(id) ?? EVENTS.find(item => item.incidentId === id); if (event) selectAndCenter(event.id); }}/></Drawer>
    </main>
    {perf.enabled && <PerfHud/>}
  </div>;
}
