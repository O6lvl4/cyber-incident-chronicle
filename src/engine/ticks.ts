import { ppd } from './levels';

export type Unit = 'year' | 'quarter' | 'month' | 'week' | 'day';

export interface TickSpec {
  major: Unit;
  minor: Unit | null;
}

/** Which boundaries get a label (major) and a faint grid line (minor) at a level. */
export function tickSpec(level: number): TickSpec {
  const p = ppd(level);
  if (p < 0.5) return { major: 'year', minor: null };
  if (p < 1) return { major: 'year', minor: 'quarter' };
  if (p < 4) return { major: 'year', minor: 'month' };
  if (p < 16) return { major: 'month', minor: 'week' };
  return { major: 'week', minor: 'day' };
}

function floorTo(unit: Unit, t: number): number {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (unit === 'year') return Date.UTC(y, 0, 1);
  if (unit === 'quarter') return Date.UTC(y, m - (m % 3), 1);
  if (unit === 'month') return Date.UTC(y, m, 1);
  const day = Date.UTC(y, m, d.getUTCDate());
  if (unit === 'day') return day;
  const dow = (new Date(day).getUTCDay() + 6) % 7; // Monday = 0
  return day - dow * 86400000;
}

function next(unit: Unit, t: number): number {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const step: Record<Unit, () => number> = {
    year: () => Date.UTC(y + 1, 0, 1),
    quarter: () => Date.UTC(y, m + 3, 1),
    month: () => Date.UTC(y, m + 1, 1),
    week: () => t + 7 * 86400000,
    day: () => t + 86400000,
  };
  return step[unit]();
}

/** All `unit` boundaries in [t0, t1]. */
export function ticksBetween(unit: Unit, t0: number, t1: number): number[] {
  const out: number[] = [];
  for (let t = floorTo(unit, t0); t <= t1; t = next(unit, t)) if (t >= t0) out.push(t);
  return out;
}

export function tickLabel(unit: Unit, t: number): string {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const byUnit: Record<Unit, string> = {
    year: String(y),
    quarter: `Q${Math.floor((m - 1) / 3) + 1}`,
    month: m === 1 ? `${y}` : `${m}月`,
    week: m === 1 && day <= 7 ? `${y}` : `${m}/${day}`,
    day: String(day),
  };
  return byUnit[unit];
}
