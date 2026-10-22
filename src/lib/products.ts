import type { TimelineEvent } from '../types';
import type { ProductAdvisory, ProductInclusion } from '../productTypes';
import { matchesFocus, type Focus } from './vulnerabilities.ts';
export const INCLUSION_LABELS: Record<ProductInclusion, string> = {
  critical: '公表元評価 Critical', exploited: '実悪用の報告', kev: 'CISA KEV 掲載', alert: '公的機関の注意喚起', poc: '攻撃コード公開',
};
export const INCLUSION_ORDER: ProductInclusion[] = ['alert', 'kev', 'exploited', 'poc', 'critical'];
/** Product focus adds the alert reason; the four library focus values keep the same meaning. */
export const PRODUCT_FOCUS_OPTIONS = [
  { value: 'all', label: '収録理由：すべて' },
  { value: 'alert', label: '公的機関の注意喚起あり' },
  { value: 'critical', label: '公表元評価 Critical' },
  { value: 'exploited', label: '実悪用の報告あり' },
  { value: 'kev', label: 'CISA KEV 掲載' },
  { value: 'poc', label: '攻撃コードの公開あり' },
] as const;
export type ProductFocus = typeof PRODUCT_FOCUS_OPTIONS[number]['value'];
export function normalizeProductFocus(value?: string): ProductFocus {
  return PRODUCT_FOCUS_OPTIONS.find(option => option.value === value)?.value ?? 'all';
}
const searchText = new WeakMap<ProductAdvisory, string>();
function searchable(item: ProductAdvisory): string {
  let text = searchText.get(item);
  if (text === undefined) {
    text = [item.id, ...item.aliases, item.vendor, item.product, item.productKey, item.title, item.summary, ...item.affected.map(range => range.name)].join(' ').toLocaleLowerCase();
    searchText.set(item, text);
  }
  return text;
}
function matchesProductFocus(item: ProductAdvisory, focus: ProductFocus): boolean {
  if (focus === 'alert' || focus === 'poc') return item.inclusion.includes(focus);
  return focus === 'all' || matchesFocus(item, focus as Focus);
}
export function filterProducts(items: ProductAdvisory[], { productKey = 'all', focus = 'all', year = 'all', query = '' }: { productKey?: string; focus?: ProductFocus; year?: string; query?: string } = {}): ProductAdvisory[] {
  const needle = query.trim().toLocaleLowerCase();
  return items.filter(item => (productKey === 'all' || item.productKey === productKey)
    && matchesProductFocus(item, focus)
    && (year === 'all' || item.listedDate.startsWith(`${year}-`))
    && (!needle || searchable(item).includes(needle)))
    .sort((a, b) => b.listedDate.localeCompare(a.listedDate) || a.id.localeCompare(b.id));
}
/** One marker per advisory on the day its retention rule was met. */
export function projectProducts(items: ProductAdvisory[]): TimelineEvent[] {
  return items.map(item => ({ id: item.id, threadId: 'products', date: item.listedDate, weight: 2,
    title: `${item.product} · ${item.title}`, body: item.summary, source: item.sources[0]?.title ?? '', sourceUrl: item.sources[0]?.url, sourceTier: 'primary' }));
}
export function productFixLabel(item: ProductAdvisory): string {
  if (item.withdrawnAt) return '撤回済み';
  if (item.affected.every(range => range.fixed !== null)) return '修正版あり';
  return item.affected.some(range => range.fixed !== null) ? '一部に修正版' : '修正版未確認';
}
