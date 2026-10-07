import type { Chip, LevelLayout } from './layout';
import { chipsIn } from './layout';
import { AXIS_H, RADIUS, ROW_H, TILE_W, rowCenter, tAt, xAt } from './levels';
import { tickSpec, ticksBetween } from './ticks';
import { paintAxisTile } from './paintAxis';
import { CHIP_FONT, type LaneTileReq, type Theme, type TileReq } from './protocol';

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const H = ROW_H - 6;

interface Grid {
  level: number;
  x0: number;
  x1: number;
  height: number;
}

function line(ctx: Ctx, x: number, h: number) {
  ctx.moveTo(x, 0);
  ctx.lineTo(x, h);
}

/** Faint minor / major boundaries and the "today" rule; clipped to the tile. */
export function drawGrid(ctx: Ctx, g: Grid, theme: Theme, xAt: (t: number) => number) {
  const spec = tickSpec(g.level);
  const t0 = tAt(g.level, g.x0 - 1);
  const t1 = tAt(g.level, g.x1 + 1);
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = 1;
  if (spec.minor) {
    ctx.globalAlpha = 0.05;
    ctx.beginPath();
    for (const t of ticksBetween(spec.minor, t0, t1)) line(ctx, Math.round(xAt(t)) + 0.5, g.height);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  for (const t of ticksBetween(spec.major, t0, t1)) line(ctx, Math.round(xAt(t)) + 0.5, g.height);
  ctx.stroke();
  const today = xAt(Date.now());
  if (today >= g.x0 - 2 && today <= g.x1 + 2) {
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3.5]);
    ctx.beginPath(); line(ctx, today, g.height); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function roundRect(ctx: Ctx, { x, y, w, h }: Rect, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Lane colour, theme and title of the chip being drawn. */
export interface ChipStyle {
  color: string;
  theme: Theme;
  title: string;
}

function drawMarker(ctx: Ctx, c: Chip, y: number, { color, theme }: ChipStyle) {
  const r = RADIUS[c.weight];
  if (c.barEnd > c.x) {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = color;
    roundRect(ctx, { x: c.x, y: y - r * 0.6, w: c.barEnd - c.x, h: r * 1.2 }, r);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.beginPath();
  ctx.arc(c.x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = theme.surface;
  ctx.stroke();
}

function drawLabel(ctx: Ctx, c: Chip, y: number, { color, theme, title }: ChipStyle) {
  const r = RADIUS[c.weight];
  const px = c.x + r + 6;
  const w = c.x1 - px;
  if (w < 12) return;
  ctx.fillStyle = theme.surface;
  ctx.strokeStyle = color;
  ctx.lineWidth = c.weight === 3 ? 1.5 : 1;
  roundRect(ctx, { x: px, y: y - H / 2, w, h: H }, H / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = theme.text;
  ctx.font = CHIP_FONT;
  ctx.textBaseline = 'middle';
  ctx.fillText(title, px + 5, y + 0.5, w - 9);
}

export function drawChip(ctx: Ctx, c: Chip, st: ChipStyle) {
  const y = rowCenter(c.row);
  drawMarker(ctx, c, y, st);
  if (c.labeled) drawLabel(ctx, c, y, st);
}

export interface RenderEnv {
  layouts: LevelLayout[];
  titles: Map<string, string>;
  theme: Theme;
  dpr: number;
}

function paintLaneTile(ctx: Ctx, req: LaneTileReq, env: RenderEnv) {
  const x0 = req.ix * TILE_W;
  const x1 = x0 + TILE_W;
  ctx.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
  ctx.clearRect(0, 0, TILE_W, req.height);
  ctx.translate(-x0, 0);
  drawGrid(ctx, { level: req.level, x0, x1, height: req.height }, env.theme, t => xAt(req.level, t));
  const lane = env.layouts[req.level]?.lanes.get(req.laneId);
  for (const c of chipsIn(lane, x0 - 4, x1 + 4)) drawChip(ctx, c, { color: req.color, theme: env.theme, title: env.titles.get(c.id) ?? '' });
}

/** Paints one tile (lane or axis) into a context whose canvas is TILE_W × height css px at `dpr`. */
export function renderTile(ctx: Ctx, req: TileReq, env: RenderEnv) {
  if (req.kind === 'axis') { paintAxisTile(ctx, req, env.theme, env.dpr); return; }
  paintLaneTile(ctx, req, env);
}

export function tileHeight(req: TileReq): number {
  return req.kind === 'axis' ? AXIS_H : req.height;
}
