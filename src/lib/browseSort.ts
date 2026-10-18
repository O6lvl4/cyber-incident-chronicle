import type { Incident, IncidentDateEvidence } from '../types';
import type { PackageGroup } from './packageGroups';
import type { VulnerabilitySummary } from './vulnerabilities';

export const INCIDENT_SORT_OPTIONS = [
  { value: 'published-desc', label: '公表日（新しい順）', shortLabel: '公表日：新しい順' },
  { value: 'published-asc', label: '公表日（古い順）', shortLabel: '公表日：古い順' },
  { value: 'attack-desc', label: '攻撃時期（新しい順・不明は末尾）', shortLabel: '攻撃時期：新しい順' },
  { value: 'attack-asc', label: '攻撃時期（古い順・不明は末尾）', shortLabel: '攻撃時期：古い順' },
  { value: 'damage-desc', label: '被害の初確認（新しい順・不明は末尾）', shortLabel: '被害初確認：新→古' },
  { value: 'damage-asc', label: '被害の初確認（古い順・不明は末尾）', shortLabel: '被害初確認：古→新' },
  { value: 'company-asc', label: '企業名（昇順）', shortLabel: '企業名：昇順' },
  { value: 'company-desc', label: '企業名（降順）', shortLabel: '企業名：降順' },
] as const;
export const PACKAGE_SORT_OPTIONS = [
  { value: 'latest-desc', label: '最新公表日（新しい順）', shortLabel: '最新公表：新→古' },
  { value: 'latest-asc', label: '最新公表日（古い順）', shortLabel: '最新公表：古→新' },
  { value: 'name-asc', label: 'パッケージ名（昇順）', shortLabel: '名前：昇順' },
  { value: 'name-desc', label: 'パッケージ名（降順）', shortLabel: '名前：降順' },
  { value: 'count-desc', label: '該当アドバイザリ数（多い順）', shortLabel: '該当件数：多い順' },
  { value: 'count-asc', label: '該当アドバイザリ数（少ない順）', shortLabel: '該当件数：少ない順' },
] as const;
export const ADVISORY_SORT_OPTIONS = [
  { value: 'published-desc', label: '公表日（新しい順）', shortLabel: '公表日：新しい順' },
  { value: 'published-asc', label: '公表日（古い順）', shortLabel: '公表日：古い順' },
  { value: 'severity-desc', label: '深刻度（高い順・未確認は末尾）', shortLabel: '深刻度：高い順' },
  { value: 'severity-asc', label: '深刻度（低い順・未確認は末尾）', shortLabel: '深刻度：低い順' },
] as const;

export type IncidentSort = typeof INCIDENT_SORT_OPTIONS[number]['value'];
export type PackageSort = typeof PACKAGE_SORT_OPTIONS[number]['value'];
export type AdvisorySort = typeof ADVISORY_SORT_OPTIONS[number]['value'];

export function normalizeIncidentSort(value?: string): IncidentSort {
  return INCIDENT_SORT_OPTIONS.find(option => option.value === value)?.value ?? 'published-desc';
}

export function normalizePackageSort(value?: string): PackageSort {
  return PACKAGE_SORT_OPTIONS.find(option => option.value === value)?.value ?? 'latest-desc';
}

export function normalizeAdvisorySort(value?: string): AdvisorySort {
  return ADVISORY_SORT_OPTIONS.find(option => option.value === value)?.value ?? 'published-desc';
}

type SortableIncident = Pick<Incident, 'id' | 'company' | 'announcementDate' | 'eventDates'>;
type SortablePackage = Pick<PackageGroup, 'key' | 'packageName' | 'latestPublishedAt' | 'advisories'>;
type SortableAdvisory = Pick<VulnerabilitySummary, 'id' | 'publishedAt' | 'severity'>;
type Comparator<T> = (left: T, right: T) => number;
const names = new Intl.Collator('ja');
const severityRank = { critical: 4, high: 3, medium: 2, low: 1, unknown: null } as const;

function compareExact(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/** Missing values stay last even when the known values are descending. */
function compareRank(left: number | null, right: number | null, direction: number): number {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return (left - right) * direction;
}

function timestamp(value: string): number | null {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function compareDate(left: string, right: string, direction: number): number {
  return compareRank(timestamp(left), timestamp(right), direction);
}

function sorted<T>(items: readonly T[], compare: Comparator<T>, key: (item: T) => string): T[] {
  return [...items].sort((left, right) => compare(left, right) || compareExact(key(left), key(right)));
}

function partialDateRank(value: IncidentDateEvidence): number | null {
  const label = value.label.trim().replace(/（(?:日不明|月日不明)）$/, '');
  if (value.precision === 'year') {
    const year = /^(\d{4})(?:年)?$/.exec(label);
    return year && Number(year[1]) > 0 ? Number(year[1]) * 10000 : null;
  }
  const parts = /^(\d{4})(?:年(\d{1,2})月|-(\d{2}))$/.exec(label);
  if (!parts) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2] ?? parts[3]);
  return year > 0 && month >= 1 && month <= 12 ? year * 10000 + month * 100 : null;
}

/** A calendar tuple, not a fabricated date: absent month/day components are zero.
 * Only exact month/year labels are parsed; narrative estimates remain unknown
 * unless the evidence supplies a date boundary. Never use legacy detection dates.
 */
function eventDateRank(value?: IncidentDateEvidence): number | null {
  if (!value || value.precision === 'unknown' || value.precision === 'notApplicable') return null;
  if (value.precision === 'month' || value.precision === 'year') return partialDateRank(value);
  const date = value.startDate;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = timestamp(date);
  if (time === null || new Date(time).toISOString().slice(0, 10) !== date) return null;
  return Number(date.replace(/-/g, ''));
}

/** Sort the complete filtered corpus before passing it to a virtual list. */
export function sortIncidents<T extends SortableIncident>(items: readonly T[], sort: IncidentSort = 'published-desc'): T[] {
  const direction = sort.endsWith('-desc') ? -1 : 1;
  const comparators: Record<string, Comparator<T>> = {
    attack: (left, right) => compareRank(eventDateRank(left.eventDates?.attack), eventDateRank(right.eventDates?.attack), direction),
    damage: (left, right) => compareRank(eventDateRank(left.eventDates?.damageConfirmed), eventDateRank(right.eventDates?.damageConfirmed), direction),
    company: (left, right) => names.compare(left.company, right.company) * direction,
    published: (left, right) => compareDate(left.announcementDate, right.announcementDate, direction),
  };
  return sorted(items, comparators[sort.split('-')[0]], item => item.id);
}

/** Groups must come from the current filtered corpus; their advisories are unique by ID. */
export function sortPackages<T extends SortablePackage>(items: readonly T[], sort: PackageSort = 'latest-desc'): T[] {
  const direction = sort.endsWith('-desc') ? -1 : 1;
  const comparators: Record<string, Comparator<T>> = {
    latest: (left, right) => compareDate(left.latestPublishedAt, right.latestPublishedAt, direction),
    name: (left, right) => compareExact(left.packageName, right.packageName) * direction,
    count: (left, right) => (left.advisories.length - right.advisories.length) * direction,
  };
  return sorted(items, comparators[sort.split('-')[0]], item => item.key);
}

export function sortAdvisories<T extends SortableAdvisory>(items: readonly T[], sort: AdvisorySort = 'published-desc'): T[] {
  const direction = sort.endsWith('-desc') ? -1 : 1;
  const compare: Comparator<T> = sort.startsWith('severity-')
    ? (left, right) => compareRank(severityRank[left.severity.label], severityRank[right.severity.label], direction)
    : (left, right) => compareDate(left.publishedAt, right.publishedAt, direction);
  return sorted(items, compare, item => item.id);
}
