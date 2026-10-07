import type { Thread, TimelineEvent } from '../types';
import type { LevelLayout } from './layout';

/** Messages between the board (main thread) and the tile renderer (worker or inline). */

export interface Theme {
  dark: boolean;
  text: string;
  ink: string;
  surface: string;
  accent: string;
}

export interface LaneTileReq {
  kind: 'lane';
  key: string;
  level: number;
  laneId: string;
  ix: number;
  height: number;
  color: string;
}

export interface AxisTileReq {
  kind: 'axis';
  key: string;
  level: number;
  ix: number;
}

export type TileReq = LaneTileReq | AxisTileReq;

export interface InitMsg {
  type: 'init';
  events: TimelineEvent[];
  threads: Thread[];
  theme: Theme;
  dpr: number;
}

export interface WantMsg {
  type: 'want';
  tiles: TileReq[];
}

export interface ThemeMsg {
  type: 'theme';
  theme: Theme;
}

export type ToRenderer = InitMsg | WantMsg | ThemeMsg;

export interface LayoutsMsg {
  type: 'layouts';
  layouts: LevelLayout[];
}

export interface TileMsg {
  type: 'tile';
  key: string;
  bitmap: ImageBitmap;
  ms: number;
}

export type FromRenderer = LayoutsMsg | TileMsg;

export function tileKey(level: number, rowId: string, ix: number): string {
  return `${level}/${rowId}/${ix}`;
}

export const CHIP_FONT = '500 11px -apple-system, "Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", system-ui, sans-serif';
export const AXIS_FONT = '600 10px ui-monospace, Menlo, "DM Mono", monospace';
