export const DAY = 86400000;

export function ms(iso: string): number {
  return new Date(iso).getTime();
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function fmtDate(t: number | string): string {
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function elapsedStr(fromMs: number, toMs: number): string {
  const diff = toMs - fromMs;
  if (diff < 0) return '';
  const months = Math.floor(diff / (30.44 * DAY));
  const years = Math.floor(months / 12);
  if (years >= 1) return `${years}年${months % 12}ヶ月前`;
  if (months >= 1) return `${months}ヶ月前`;
  return `${Math.floor(diff / DAY)}日前`;
}

export function spanLabel(start: number, end: number): string {
  const days = Math.round((end - start) / DAY);
  if (days < 60) return `${days}日間`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months}ヶ月間`;
  return `${Math.round(months / 12)}年間`;
}

export type TickUnit = 'week' | 'month' | 'quarter' | 'year';

export function pickUnit(spanMs: number): TickUnit {
  if (spanMs < 60 * DAY) return 'week';
  if (spanMs < 180 * DAY) return 'month';
  if (spanMs < 548 * DAY) return 'quarter';
  return 'year';
}

/** First UTC month boundary at or after `start`, stepped by `stepMonths`, aligned to the step. */
function monthTicks(start: number, end: number, stepMonths: number): number[] {
  const d0 = new Date(start);
  const alignedMonth = Math.ceil((d0.getUTCMonth() + 1) / stepMonths) * stepMonths;
  let cur = Date.UTC(d0.getUTCFullYear(), alignedMonth, 1);
  const out: number[] = [];
  while (cur <= end) {
    out.push(cur);
    const c = new Date(cur);
    cur = Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + stepMonths, 1);
  }
  return out;
}

function weekTicks(start: number, end: number): number[] {
  const offset = ((7 - new Date(start).getUTCDay()) % 7) * DAY;
  const out: number[] = [];
  for (let cur = start + offset; cur <= end; cur += 7 * DAY) out.push(cur);
  return out;
}

const STEP: Record<TickUnit, number> = { week: 0, month: 1, quarter: 3, year: 12 };

export function generateTicks(start: number, end: number): { ticks: number[]; unit: TickUnit } {
  const unit = pickUnit(end - start);
  const ticks = unit === 'week' ? weekTicks(start, end) : monthTicks(start, end, STEP[unit]);
  return { ticks, unit };
}

export function formatTick(t: number, unit: TickUnit): string {
  const dt = new Date(t);
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth() + 1;
  switch (unit) {
    case 'year': return `${y}`;
    case 'quarter': return `${y} Q${Math.ceil(m / 3)}`;
    case 'month': return `${y}/${pad2(m)}`;
    default: return `${m}/${dt.getUTCDate()}`;
  }
}
