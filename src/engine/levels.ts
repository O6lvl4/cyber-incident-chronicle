import type { Weight } from '../types';
import meta from '../data/meta.json';
import vulnerabilityMeta from '../data/vulnerability-meta.json';
import { DAY, PX_PER_DAY, MAX_LEVEL } from './zoom';
export { DAY, PX_PER_DAY, MAX_LEVEL, fitLevel } from './zoom';

/**
 * Discrete zoom levels, like a programme guide's 30 min / 1 h / 2 h grids. Every level has a fixed
 * pixels-per-day, so layout and tiles depend only on the level, never on the device.
 */
/** Shared strip bounds cover both categories without changing either category's records. */
export const T0 = Date.UTC(Math.min(new Date(meta.windowStart).getUTCFullYear(), new Date(vulnerabilityMeta.windowStart).getUTCFullYear()), 0, 1);
/** Right edge of the strip: six months past the coverage window. */
export const T1 = Math.max(Date.parse(meta.windowEnd), Date.parse(vulnerabilityMeta.windowEnd)) + 183 * DAY;

export const TILE_W = 512;
export const AXIS_H = 44;
export const ROW_H = 26;
export const LANE_PAD = 7;
export const MAX_ROWS = 8;
export const RADIUS: Record<Weight, number> = { 1: 4, 2: 5.5, 3: 7 };

export function clampLevel(l: number): number {
  return Math.max(0, Math.min(MAX_LEVEL, Math.round(l)));
}

/** The level whose scale is closest to `level` stretched by `scale`. */
export function levelForScale(level: number, scale: number): number {
  const want = Math.log(PX_PER_DAY[level] * scale);
  let best = level;
  PX_PER_DAY.forEach((p, i) => { if (Math.abs(Math.log(p) - want) < Math.abs(Math.log(PX_PER_DAY[best]) - want)) best = i; });
  return best;
}

export function ppd(level: number): number {
  return PX_PER_DAY[level];
}

/** Strip x (px from the left edge of the plot) of an instant at a level. */
export function xAt(level: number, t: number): number {
  return ((t - T0) / DAY) * ppd(level);
}

export function tAt(level: number, x: number): number {
  return T0 + (x / ppd(level)) * DAY;
}

export function stripWidth(level: number): number {
  return Math.ceil(xAt(level, T1));
}

export function tileCount(level: number): number {
  return Math.ceil(stripWidth(level) / TILE_W);
}

/** Weight threshold for labels: coarse levels only label the milestones. */
export function labelWeightFor(level: number): Weight {
  const p = ppd(level);
  if (p <= 0.5) return 3;
  if (p <= 1.5) return 2;
  return 1;
}

export function labelWidthFor(width: number): number {
  return width < 640 ? 56 : 140;
}

export function laneHeight(rows: number): number {
  return LANE_PAD * 2 + Math.max(rows, 5) * ROW_H;
}

export function rowCenter(row: number): number {
  return LANE_PAD + row * ROW_H + ROW_H / 2;
}
