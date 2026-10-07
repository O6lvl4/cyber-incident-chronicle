import type { Thread } from '../types';
import type { Chip, LevelLayout } from './layout';
import { RADIUS, ROW_H, rowCenter } from './levels';
import type { Row } from './tileLayer';

export interface LaneRows {
  rows: Row[];
  totalH: number;
}

/** Lane rows (tops/heights) for the active lanes at a level; the axis row is prepended. */
export function rowsFor(layout: LevelLayout, threads: Thread[], activeIds: string[], colorOf: (id: string) => string): LaneRows {
  const rows: Row[] = [{ id: 'axis', top: 0, height: 0, color: '', axis: true }];
  let top = 0;
  for (const t of threads) {
    if (!activeIds.includes(t.id)) continue;
    const lane = layout.lanes.get(t.id);
    const height = lane?.height ?? 0;
    rows.push({ id: t.id, top, height, color: colorOf(t.id), axis: false });
    top += height;
  }
  return { rows, totalH: top };
}

export interface Pt {
  x: number;
  y: number;
}

/** Strip-space centre of a chip's marker. */
export function chipCenter(chip: Chip, rows: Row[]): Pt | null {
  const row = rows.find(r => r.id === chip.laneId);
  if (!row) return null;
  return { x: chip.x, y: row.top + rowCenter(chip.row) };
}

/** Topmost chip under a strip-space point, or null. */
export function hitTest(layout: LevelLayout, rows: Row[], p: Pt): Chip | null {
  const row = rows.find(r => !r.axis && p.y >= r.top && p.y < r.top + r.height);
  const lane = row ? layout.lanes.get(row.id) : undefined;
  if (!row || !lane) return null;
  for (let i = lane.chips.length - 1; i >= 0; i--) {
    const c = lane.chips[i];
    if (Math.abs(p.y - (row.top + rowCenter(c.row))) > ROW_H / 2 - 1) continue;
    const pad = c.labeled ? 2 : RADIUS[c.weight] + 3;
    if (p.x >= c.x0 - pad && p.x <= c.x1 + pad) return c;
  }
  return null;
}
