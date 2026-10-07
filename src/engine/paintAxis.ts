import { AXIS_H, TILE_W, ppd, tAt, xAt } from './levels';
import { tickLabel, tickSpec, ticksBetween, type Unit } from './ticks';
import { AXIS_FONT, type AxisTileReq, type Theme } from './protocol';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const UNIT_DAYS: Record<Unit, number> = { year: 365, quarter: 91, month: 30, week: 7, day: 1 };

interface Ticks {
  level: number;
  unit: Unit;
  range: [number, number];
  major: boolean;
}

function drawTicks(ctx: Ctx, { level, unit, range, major }: Ticks) {
  const [t0, t1] = range;
  ctx.font = AXIS_FONT;
  ctx.textBaseline = 'alphabetic';
  const labelMinor = ppd(level) * UNIT_DAYS[unit] >= 26;
  for (const t of ticksBetween(unit, t0, t1)) {
    const x = Math.round(xAt(level, t)) + 0.5;
    ctx.globalAlpha = major ? 0.7 : 0.3;
    ctx.beginPath();
    ctx.moveTo(x, major ? AXIS_H - 14 : AXIS_H - 7);
    ctx.lineTo(x, AXIS_H);
    ctx.stroke();
    if (!major && !labelMinor) continue;
    ctx.globalAlpha = major ? 1 : 0.55;
    ctx.fillText(tickLabel(unit, t), x + 4, major ? 18 : 31);
  }
  ctx.globalAlpha = 1;
}

function drawToday(ctx: Ctx, level: number, theme: Theme) {
  const x = xAt(level, Date.now());
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.roundRect(x - 22, 2, 44, 14, 3);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 8px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TODAY', x, 9.5);
  ctx.textAlign = 'left';
  ctx.beginPath();
  ctx.moveTo(x + 0.5, 16);
  ctx.lineTo(x + 0.5, AXIS_H);
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** Time axis strip: labelled major boundaries, faint minor ones and the TODAY marker. */
export function paintAxisTile(ctx: Ctx, req: AxisTileReq, theme: Theme, dpr: number) {
  const x0 = req.ix * TILE_W;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = theme.surface;
  ctx.fillRect(0, 0, TILE_W, AXIS_H);
  ctx.translate(-x0, 0);
  const range: [number, number] = [tAt(req.level, x0 - 40), tAt(req.level, x0 + TILE_W + 1)];
  const spec = tickSpec(req.level);
  ctx.strokeStyle = theme.ink;
  ctx.fillStyle = theme.text;
  ctx.lineWidth = 1;
  if (spec.minor) drawTicks(ctx, { level: req.level, unit: spec.minor, range, major: false });
  drawTicks(ctx, { level: req.level, unit: spec.major, range, major: true });
  const today = xAt(req.level, Date.now());
  if (today >= x0 - 30 && today <= x0 + TILE_W + 30) drawToday(ctx, req.level, theme);
  ctx.strokeStyle = theme.ink;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, AXIS_H - 1);
  ctx.lineTo(x0 + TILE_W, AXIS_H - 1);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
