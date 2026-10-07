import type { Thread, TimelineEvent, Weight } from '../types';
import { MAX_ROWS, RADIUS, labelWeightFor, laneHeight, xAt } from './levels';

/** Programme-guide packing of one lane's events into rows, per zoom level. */

export type Measure = (s: string) => number;

export interface Chip {
  id: string;
  laneId: string;
  weight: Weight;
  x: number;        // marker centre (start date), strip px
  x0: number;       // left edge of the occupied extent
  x1: number;       // right edge of the occupied extent (label included)
  barEnd: number;   // right edge of the duration bar (= x for point events)
  row: number;
  labeled: boolean;
}

export interface LaneLayout {
  id: string;
  rows: number;
  height: number;
  chips: Chip[];    // sorted by x
}

export interface LevelLayout {
  level: number;
  lanes: Map<string, LaneLayout>;
}

const GAP = 6;

interface Extent {
  x0: number;
  x1: number;
  barEnd: number;
}

function extentOf(ev: TimelineEvent, level: number, labelW: number): Extent {
  const r = RADIUS[ev.weight];
  const x = xAt(level, Date.parse(ev.date));
  const barEnd = ev.endDate ? Math.max(xAt(level, Date.parse(ev.endDate)), x + 2 * r) : x;
  const x0 = ev.endDate ? x : x - r;
  const x1 = Math.max(barEnd + (ev.endDate ? 0 : r), x0 + labelW);
  return { x0, x1, barEnd };
}

function firstFreeRow(rowEnds: number[], x0: number): number {
  return rowEnds.findIndex(end => end + GAP <= x0);
}

function leastLoadedRow(rowEnds: number[]): number {
  let best = 0;
  for (let i = 1; i < rowEnds.length; i++) if (rowEnds[i] < rowEnds[best]) best = i;
  return best;
}

interface Placement {
  row: number;
  labeled: boolean;
  ext: Extent;
}

function place(ev: TimelineEvent, level: number, rowEnds: number[], labelW: number): Placement {
  let labeled = labelW > 0;
  let ext = extentOf(ev, level, labelW);
  let row = firstFreeRow(rowEnds, ext.x0);
  if (row < 0 && rowEnds.length < MAX_ROWS) { rowEnds.push(-Infinity); row = rowEnds.length - 1; }
  if (row < 0 && labeled) { labeled = false; ext = extentOf(ev, level, 0); row = firstFreeRow(rowEnds, ext.x0); }
  if (row < 0) row = leastLoadedRow(rowEnds);
  return { row, labeled, ext };
}

function layoutLane(laneId: string, events: TimelineEvent[], level: number, measure: Measure): LaneLayout {
  const minWeight = labelWeightFor(level);
  const sorted = [...events].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const rowEnds: number[] = [];
  const chips: Chip[] = [];
  for (const ev of sorted) {
    const r = RADIUS[ev.weight];
    const labelW = ev.weight >= minWeight ? measure(ev.title) + 2 * r + 16 : 0;
    const { row, labeled, ext } = place(ev, level, rowEnds, labelW);
    rowEnds[row] = Math.max(rowEnds[row], ext.x1);
    chips.push({ id: ev.id, laneId, weight: ev.weight, x: xAt(level, Date.parse(ev.date)), x0: ext.x0, x1: ext.x1, barEnd: ext.barEnd, row, labeled });
  }
  const rows = Math.max(rowEnds.length, 1);
  return { id: laneId, rows, height: laneHeight(rows), chips };
}

/** Lays out every lane at one level; lanes are independent so hiding one never re-flows the others. */
export function layoutLevel(events: TimelineEvent[], threads: Thread[], level: number, measure: Measure): LevelLayout {
  const byLane = new Map<string, TimelineEvent[]>();
  for (const ev of events) (byLane.get(ev.threadId) ?? byLane.set(ev.threadId, []).get(ev.threadId)!).push(ev);
  const lanes = new Map<string, LaneLayout>();
  for (const t of threads) lanes.set(t.id, layoutLane(t.id, byLane.get(t.id) ?? [], level, measure));
  return { level, lanes };
}

/** Chips of one lane whose extent overlaps [x0, x1]. */
export function chipsIn(lane: LaneLayout | undefined, x0: number, x1: number): Chip[] {
  if (!lane) return [];
  return lane.chips.filter(c => c.x1 >= x0 && c.x0 <= x1);
}
