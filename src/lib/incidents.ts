import type { DisclosureStatus, Incident, TimelineEvent } from '../types';
export const STATUS_LABELS: Record<DisclosureStatus, string> = {
  confirmed: '流出を確認', possible: '流出の可能性', investigating: '流出状況を調査中', noConfirmedLeak: '流出は確認されず',
};
export const METHOD_STATUS: Record<Incident['attackMethod']['status'], string> = {
  confirmed: '公表で確認', possible: '可能性あり', unknown: '未公表・不明', notApplicable: '該当なし',
};
/** One marker per impact, one incident in all counts and the company list. */
export function projectEvents(incidents: Incident[]): TimelineEvent[] {
  return incidents.flatMap(item => item.impactTypes.map(impact => ({
    id: `${item.id}--${impact}`, incidentId: item.id, threadId: impact,
    date: item.announcementDate, weight: 2,
    title: `${item.company} · ${STATUS_LABELS[item.disclosureStatus]}`,
    body: item.summary, source: item.sources[0]?.title ?? '', sourceUrl: item.sources[0]?.url, sourceTier: 'primary',
  })));
}
export function filterIncidents(incidents: Incident[], impacts: string[], status: string, query: string): Incident[] {
  const q = query.trim().toLocaleLowerCase('ja');
  return incidents.filter(item => item.impactTypes.some(impact => impacts.includes(impact))
    && (status === 'all' || item.disclosureStatus === status)
    && (!q || [item.company, item.title, item.summary, item.attackMethod.label, ...item.affectedData].join(' ').toLocaleLowerCase('ja').includes(q)))
    .sort((a, b) => b.announcementDate.localeCompare(a.announcementDate) || a.company.localeCompare(b.company, 'ja'));
}
export function companyCount(incidents: Incident[]): number { return new Set(incidents.map(item => item.company)).size; }
