import type { TimelineEvent } from '../types';
import type { Vulnerability } from '../vulnerabilityTypes';
export const SEVERITY_LABELS: Record<Vulnerability['severity']['label'], string> = {
  critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', unknown: '評価未確認',
};
export function filterVulnerabilities(items: Vulnerability[], ecosystem: string, query: string): Vulnerability[] {
  const needle = query.trim().toLocaleLowerCase();
  return items.filter(item => (ecosystem === 'all' || item.affected.some(pkg => pkg.ecosystem === ecosystem))
    && (!needle || [item.id, ...item.aliases, item.title, item.summary, ...item.affected.map(pkg => `${pkg.ecosystem} ${pkg.packageName}`)]
      .join(' ').toLocaleLowerCase().includes(needle)))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
}
export function projectVulnerabilities(items: Vulnerability[]): TimelineEvent[] {
  return items.map(item => ({ id: item.id, vulnerabilityId: item.id, threadId: 'vulnerabilities',
    date: item.publishedAt.slice(0, 10), weight: 2, title: item.affected.map(pkg => pkg.packageName).join(' / '),
    body: item.title, source: item.sources[0]?.title ?? '', sourceUrl: item.sources[0]?.url, sourceTier: 'primary',
  }));
}
export function fixLabel(item: Vulnerability): string {
  if (item.withdrawnAt) return '撤回済み';
  const ranges = item.affected.flatMap(pkg => pkg.ranges);
  if (ranges.every(range => range.fixed !== null)) return '修正版あり';
  return ranges.some(range => range.fixed !== null) ? '一部に修正版' : '修正版未確認';
}
