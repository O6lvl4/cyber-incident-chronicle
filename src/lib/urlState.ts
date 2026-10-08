import type { ClassificationFilters } from '../classificationTypes';
import { CLASSIFICATION_OPTIONS } from './classification.ts';
/** Shareable timeline view, filter, selection and theme state. */
export interface UrlState { classification?: Partial<ClassificationFilters>; kind?: 'incident' | 'vulnerability'; ecosystem?: string; level?: number; center?: number; sel?: string; lanes?: string[]; dark?: boolean; query?: string; status?: string }
function readView(p: URLSearchParams): UrlState {
  const view: UrlState = {};
  const level = p.get('l');
  if (level !== null && /^\d+$/.test(level)) view.level = Math.min(11, Number(level));
  const time = Date.parse(p.get('t') ?? '');
  if (Number.isFinite(time)) view.center = time;
  return view;
}
function readClassification(p: URLSearchParams, out: UrlState) {
  const classification: Partial<ClassificationFilters> = {};
  for (const key of Object.keys(CLASSIFICATION_OPTIONS) as (keyof ClassificationFilters)[]) {
    const value = p.get(key);
    if (value && Object.prototype.hasOwnProperty.call(CLASSIFICATION_OPTIONS[key], value)) classification[key] = value;
  }
  if (Object.keys(classification).length) out.classification = classification;
}
export function readUrl(): UrlState {
  const p = new URLSearchParams(location.hash.replace(/^#/, ''));
  const out = readView(p);
  if (p.get('kind') === 'vulnerability') out.kind = 'vulnerability';
  if (p.has('ecosystem')) out.ecosystem = p.get('ecosystem')!.slice(0, 80);
  out.sel = p.get('sel') ?? undefined;
  if (p.has('lanes')) out.lanes = p.get('lanes')!.split(',').filter(Boolean);
  const theme = p.get('theme');
  if (theme === 'dark' || theme === 'light') out.dark = theme === 'dark';
  out.query = p.get('q') ?? '';
  const status = p.get('status');
  if (status && ['confirmed', 'possible', 'investigating', 'noConfirmedLeak'].includes(status)) out.status = status;
  readClassification(p, out);
  return out;
}
function writeView(p: URLSearchParams, state: UrlState) {
  if (state.level !== undefined) p.set('l', String(state.level));
  if (state.center !== undefined && Number.isFinite(state.center)) p.set('t', new Date(state.center).toISOString().slice(0, 10));
  if (state.dark !== undefined) p.set('theme', state.dark ? 'dark' : 'light');
}
function writeClassification(p: URLSearchParams, classification?: Partial<ClassificationFilters>) {
  for (const key of Object.keys(CLASSIFICATION_OPTIONS) as (keyof ClassificationFilters)[]) {
    const value = classification?.[key];
    if (value && Object.prototype.hasOwnProperty.call(CLASSIFICATION_OPTIONS[key], value)) p.set(key, value);
  }
}
export function writeUrl(state: UrlState) {
  const p = new URLSearchParams();
  writeView(p, state);
  if (state.kind === 'vulnerability') p.set('kind', state.kind);
  if (state.ecosystem && state.ecosystem !== 'all') p.set('ecosystem', state.ecosystem);
  if (state.sel) p.set('sel', state.sel);
  if (state.lanes) p.set('lanes', state.lanes.join(','));
  if (state.query) p.set('q', state.query);
  if (state.status && state.status !== 'all') p.set('status', state.status);
  writeClassification(p, state.classification);
  const hash = `#${p.toString()}`;
  if (hash !== location.hash) history.replaceState(null, '', hash);
}
