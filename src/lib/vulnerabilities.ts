import type { TimelineEvent } from '../types';
import type { Vulnerability } from '../vulnerabilityTypes';
export interface VulnerabilitySummary extends Pick<Vulnerability, 'id' | 'aliases' | 'title' | 'publishedAt' | 'withdrawnAt'> {
  summary?: string;
  affected: { ecosystem: string; packageName: string }[];
  severity: Pick<Vulnerability['severity'], 'label'>;
  fixStatus: 'fixed' | 'partial' | 'unknown';
  shard: string;
}
type SearchableAdvisory = Vulnerability | VulnerabilitySummary;
export const SEVERITY_LABELS: Record<Vulnerability['severity']['label'], string> = {
  critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', unknown: '評価未確認',
};
const searchText = new WeakMap<SearchableAdvisory, string>();
function searchable(item: SearchableAdvisory): string {
  let text = searchText.get(item);
  if (text === undefined) {
    text = [item.id, ...item.aliases, item.title, item.summary, ...item.affected.map(pkg => `${pkg.ecosystem} ${pkg.packageName}`)].join(' ').toLocaleLowerCase();
    searchText.set(item, text);
  }
  return text;
}
export function filterVulnerabilities<T extends SearchableAdvisory>(items: T[], ecosystem: string, query: string, { year = 'all', lifecycle = 'all' }: { year?: string; lifecycle?: string } = {}): T[] {
  const needle = query.trim().toLocaleLowerCase();
  return items.filter(item => (ecosystem === 'all' || item.affected.some(pkg => pkg.ecosystem === ecosystem))
    && (lifecycle === 'all' || (lifecycle === 'withdrawn' ? !!item.withdrawnAt : !item.withdrawnAt))
    && (year === 'all' || item.publishedAt.startsWith(`${year}-`))
    && (!needle || searchable(item).includes(needle)))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
}
export function projectVulnerabilities(items: SearchableAdvisory[]): TimelineEvent[] {
  return items.map(item => ({ id: item.id, vulnerabilityId: item.id, threadId: 'vulnerabilities',
    date: item.publishedAt.slice(0, 10), weight: 2, title: item.affected.map(pkg => pkg.packageName).join(' / '),
    body: item.title, source: 'sources' in item ? item.sources[0]?.title ?? '' : 'GitHub Advisory Database', sourceUrl: 'sources' in item ? item.sources[0]?.url : undefined, sourceTier: 'primary',
  }));
}
export function fixLabel(item: SearchableAdvisory): string {
  if (item.withdrawnAt) return '撤回済み';
  if ('fixStatus' in item) return { fixed: '修正版あり', partial: '一部に修正版', unknown: '修正版未確認' }[item.fixStatus];
  const ranges = item.affected.flatMap(pkg => pkg.ranges);
  if (ranges.every(range => range.fixed !== null)) return '修正版あり';
  return ranges.some(range => range.fixed !== null) ? '一部に修正版' : '修正版未確認';
}
