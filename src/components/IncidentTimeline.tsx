import { useCallback, useMemo, type RefObject } from 'react';
import { DATA_END, DATA_START, LANES, LINKS } from '../data';
import type { TimelineEvent } from '../types';
import type { AppState } from '../hooks/useAppState';
import { themeFor } from '../lib/palette';
import Board, { type BoardApi } from '../board/Board';
import Minimap from './Minimap';
const LANE_IDS = LANES.map(lane => lane.id);
interface Props { state: AppState; events: TimelineEvent[]; hasResults: boolean; board: RefObject<BoardApi | null> }
function TimelineContents({ state, events, hasResults, board }: Props) {
  const theme = useMemo(() => themeFor(state.dark), [state.dark]);
  const zoomed = !!state.view && (state.view.start > DATA_START || state.view.end < DATA_END);
  const centerRange = useCallback((start: number, end: number) => board.current?.centerOn((start + end) / 2), [board]);
  return <>
    <div className="board-toolbar"><div><strong>収録した公表日のタイムライン</strong><span>1事案を1つの点で表示。影響の種類は上の絞り込みで選択</span></div><div className="zoom-controls"><button className="n-btn" onClick={() => board.current?.zoomBy(-1)} aria-label="縮小">−</button><button className="n-btn" onClick={() => board.current?.zoomBy(1)} aria-label="拡大">＋</button><button className="n-btn" onClick={() => board.current?.fitAll()}>全期間</button></div></div>
    <Board threads={LANES} events={events} links={LINKS} activeIds={LANE_IDS} theme={theme}
      selectedId={state.selectedId} matches={state.matches} dataStart={DATA_START} dataEnd={DATA_END}
      initial={state.initial} onSelect={state.select} onIdle={state.setView} apiRef={board}/>
    {!hasResults && <div className="board-empty"><p>表示する事案がありません</p><button className="n-btn" onClick={state.resetFilters}>絞り込みを解除</button></div>}
    <div className="timeline-caption"><span>{zoomed ? '横にスワイプ・ドラッグで移動 / ピンチ・−で縮小' : '全期間を表示中 / ＋・ピンチ・ダブルクリックで拡大'}</span><span>点の色や大きさは深刻度の順位ではありません</span></div>
    <Minimap threads={LANES} events={events} activeThreadIds={LANE_IDS} dataStart={DATA_START} dataEnd={DATA_END}
      viewStart={state.view?.start ?? DATA_START} viewEnd={state.view?.end ?? DATA_END} dark={state.dark} onViewChange={centerRange}/>
  </>;
}
export default function IncidentTimeline(props: Props) {
  const active = props.state.displayView === 'timeline';
  return <section id="incident-timeline-results" tabIndex={-1} role="tabpanel" aria-labelledby="incident-timeline-results-tab" hidden={!active} className="timeline-container" aria-label="事案のタイムライン">
    {active && <TimelineContents {...props}/>}
  </section>;
}
