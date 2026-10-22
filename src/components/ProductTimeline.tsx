import type { RefObject } from 'react';
import type { AppState } from '../hooks/useAppState';
import type { Theme } from '../engine/protocol';
import type { TimelineEvent } from '../types';
import { PRODUCT_LANES, PRODUCT_START, PRODUCT_END } from '../data/product-index';
import Board, { type BoardApi } from '../board/Board';
import Minimap from './Minimap';
const LANE_IDS = ['products'];
const NO_LINKS: [] = [];
export const PRODUCT_TIMELINE_ID = 'product-timeline-panel';
interface Props { state: AppState; events: TimelineEvent[]; theme: Theme; board: RefObject<BoardApi | null>; onReset: () => void }
export default function ProductTimeline({ state: st, events, theme, board, onReset }: Props) {
  return <section id={PRODUCT_TIMELINE_ID} role="tabpanel" aria-labelledby={`${PRODUCT_TIMELINE_ID}-tab`} tabIndex={-1} hidden={st.displayView !== 'timeline'} className="timeline-container" aria-label="製品の注意喚起のタイムライン">
    {st.displayView === 'timeline' && <>
      <div className="board-toolbar"><div><strong>収録契機日のタイムライン</strong><span>注意喚起・KEV追加・Critical公表・実悪用報告の確認日。開発元の公表日は詳細で確認</span></div><div className="zoom-controls"><button className="n-btn" onClick={() => board.current?.zoomBy(-1)} aria-label="縮小">−</button><button className="n-btn" onClick={() => board.current?.zoomBy(1)} aria-label="拡大">＋</button><button className="n-btn" onClick={() => board.current?.fitAll()}>全期間</button></div></div>
      <Board threads={PRODUCT_LANES} events={events} links={NO_LINKS} activeIds={LANE_IDS} theme={theme} selectedId={st.selectedId} matches={st.matches} dataStart={PRODUCT_START} dataEnd={PRODUCT_END} initial={st.initial} onSelect={st.select} onIdle={st.setView} apiRef={board}/>
      {!events.length && <div className="board-empty"><p>表示する注意喚起がありません</p><button className="n-btn" onClick={onReset}>絞り込みを解除</button></div>}
      <div className="timeline-caption"><span>横にスワイプ・ドラッグで移動 / ピンチで拡大縮小</span><span>点の色や大きさは深刻度の順位ではありません</span></div>
      <Minimap threads={PRODUCT_LANES} events={events} activeThreadIds={LANE_IDS} dataStart={PRODUCT_START} dataEnd={PRODUCT_END} viewStart={st.view?.start ?? PRODUCT_START} viewEnd={st.view?.end ?? PRODUCT_END} dark={st.dark} onViewChange={(start, end) => board.current?.centerOn((start + end) / 2)}/>
    </>}
  </section>;
}
