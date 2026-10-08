import { parsePackageKey, packageKey } from './packageGroups.ts';
import type { ClassificationFilters } from '../classificationTypes';
import { CLASSIFICATION_OPTIONS } from './classification.ts';
import { LEGACY_LEVEL_OFFSET, MAX_LEVEL, ZOOM_VERSION } from '../engine/zoom.ts';
/** Shareable timeline view, filter, selection and theme state. */
export interface UrlState { view?: 'list' | 'timeline'; packageKey?: string; packagePage?: number; classification?: Partial<ClassificationFilters>; kind?: 'incident' | 'vulnerability'; ecosystem?: string; year?: string; lifecycle?: 'active' | 'all' | 'withdrawn'; page?: number; level?: number; center?: number; sel?: string; lanes?: string[]; dark?: boolean; query?: string; status?: string }
function readView(p: URLSearchParams): UrlState {
  const view: UrlState = {};
  const level = p.get('l');
  if (level !== null && /^\d+$/.test(level)) view.level = Math.min(MAX_LEVEL, Number(level) + (p.get('z') === ZOOM_VERSION ? 0 : LEGACY_LEVEL_OFFSET));
  const time = Date.parse(p.get('t') ?? '');
  if (Number.isFinite(time)) view.center = time;
  return view;
}
function readDisplay(p: URLSearchParams, out: UrlState) {
  const value = p.get('view');
  out.view = value === 'timeline' ? 'timeline' : 'list';
  if (value === null && (out.level !== undefined || out.center !== undefined)) out.view = 'timeline';
}
function readPackage(p: URLSearchParams, out: UrlState) {
  const key = p.get('pkg');
  const parsed = key && key.length <= 4096 ? parsePackageKey(key) : undefined;
  if (parsed) out.packageKey = packageKey(parsed.ecosystem, parsed.packageName);
  if (/^\d+$/.test(p.get('packagePage') ?? '')) out.packagePage = Math.min(100000, Number(p.get('packagePage')));
}
function readClassification(p: URLSearchParams, out: UrlState) {
  const classification: Partial<ClassificationFilters> = {};
  for (const key of Object.keys(CLASSIFICATION_OPTIONS) as (keyof ClassificationFilters)[]) {
    const value = p.get(key);
    if (value && Object.prototype.hasOwnProperty.call(CLASSIFICATION_OPTIONS[key], value)) classification[key] = value;
  }
  if (Object.keys(classification).length) out.classification = classification;
}
function readAdvisory(p: URLSearchParams, out: UrlState) {
  if (p.get('kind') === 'vulnerability') out.kind = 'vulnerability';
  if (p.has('ecosystem')) out.ecosystem = p.get('ecosystem')!.slice(0, 80);
  const lifecycle = p.get('lifecycle');
  if (lifecycle === 'active' || lifecycle === 'all' || lifecycle === 'withdrawn') out.lifecycle = lifecycle;
  if (/^\d{4}$/.test(p.get('year') ?? '')) out.year = p.get('year')!;
  if (/^\d+$/.test(p.get('page') ?? '')) out.page = Math.min(100000, Number(p.get('page')));
}
export function readUrl(): UrlState {
  const p = new URLSearchParams(location.hash.replace(/^#/, ''));
  const out = readView(p);
  readAdvisory(p, out);
  readDisplay(p, out);
  readPackage(p, out);
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
  if (state.view === 'list' || state.view === 'timeline') p.set('view', state.view);
  if (state.level !== undefined) { p.set('l', String(state.level)); p.set('z', ZOOM_VERSION); }
  if (state.center !== undefined && Number.isFinite(state.center)) p.set('t', new Date(state.center).toISOString().slice(0, 10));
  if (state.dark !== undefined) p.set('theme', state.dark ? 'dark' : 'light');
}
function writeClassification(p: URLSearchParams, classification?: Partial<ClassificationFilters>) {
  for (const key of Object.keys(CLASSIFICATION_OPTIONS) as (keyof ClassificationFilters)[]) {
    const value = classification?.[key];
    if (value && Object.prototype.hasOwnProperty.call(CLASSIFICATION_OPTIONS[key], value)) p.set(key, value);
  }
}
function writeAdvisory(p: URLSearchParams, state: UrlState) {
  if (state.kind === 'vulnerability') p.set('kind', state.kind);
  if (state.ecosystem && state.ecosystem !== 'all') p.set('ecosystem', state.ecosystem);
  if (state.lifecycle && state.lifecycle !== 'active') p.set('lifecycle', state.lifecycle);
  if (state.year && state.year !== 'all') p.set('year', state.year);
  if (state.page !== undefined && state.page > 0) p.set('page', String(state.page));
}
function writePackage(p: URLSearchParams, state: UrlState) {
  if (state.packageKey && parsePackageKey(state.packageKey)) p.set('pkg', state.packageKey);
  if (state.packagePage !== undefined && (state.packagePage > 0 || !!state.packageKey)) p.set('packagePage', String(state.packagePage));
}
export function writeUrl(state: UrlState, mode: 'replace' | 'push' = 'replace') {
  const p = new URLSearchParams();
  writeView(p, state);
  writeAdvisory(p, state);
  writePackage(p, state);
  if (state.sel) p.set('sel', state.sel);
  if (state.lanes) p.set('lanes', state.lanes.join(','));
  if (state.query) p.set('q', state.query);
  if (state.status && state.status !== 'all') p.set('status', state.status);
  writeClassification(p, state.classification);
  const hash = `#${p.toString()}`;
  if (hash !== location.hash) history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', hash);
}
