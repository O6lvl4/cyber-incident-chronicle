import type { VulnerabilitySummary } from './vulnerabilities';

export type PackageSeverity = VulnerabilitySummary['severity']['label'];
export type PackageSeverityCounts = Record<PackageSeverity, number>;
export interface PackageCoordinate { ecosystem: string; packageName: string }
export interface PackageGroup extends PackageCoordinate {
  key: string;
  advisories: VulnerabilitySummary[];
  latestPublishedAt: string;
  latestModifiedAt: string;
  highestSeverity: PackageSeverity;
  severityCounts: PackageSeverityCounts;
  withdrawnCount: number;
}
interface PendingGroup extends PackageCoordinate { advisories: Map<string, VulnerabilitySummary> }
const severityRank: Record<PackageSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 };

/** Package identity is the exact source tuple, including casing and punctuation. */
export function packageKey(ecosystem: string, packageName: string): string {
  return JSON.stringify([ecosystem, packageName]);
}

export function parsePackageKey(key: string | undefined): PackageCoordinate | undefined {
  if (key === undefined) return undefined;
  try {
    const value: unknown = JSON.parse(key);
    if (!Array.isArray(value) || value.length !== 2) return undefined;
    if (typeof value[0] !== 'string' || typeof value[1] !== 'string') return undefined;
    return { ecosystem: value[0], packageName: value[1] };
  } catch { return undefined; }
}

function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
function compareAdvisories(a: VulnerabilitySummary, b: VulnerabilitySummary): number {
  return Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || compareText(a.id, b.id);
}
function compareGroups(a: PackageGroup, b: PackageGroup): number {
  return Date.parse(b.latestPublishedAt) - Date.parse(a.latestPublishedAt)
    || compareText(a.ecosystem, b.ecosystem) || compareText(a.packageName, b.packageName);
}
function addAdvisory(groups: Map<string, PendingGroup>, pkg: PackageCoordinate, item: VulnerabilitySummary) {
  const key = packageKey(pkg.ecosystem, pkg.packageName);
  let group = groups.get(key);
  if (!group) {
    group = { ecosystem: pkg.ecosystem, packageName: pkg.packageName, advisories: new Map() };
    groups.set(key, group);
  }
  const previous = group.advisories.get(item.id);
  if (!previous || compareAdvisories(item, previous) < 0
    || (compareAdvisories(item, previous) === 0 && Date.parse(item.modifiedAt) > Date.parse(previous.modifiedAt))) {
    group.advisories.set(item.id, item);
  }
}

/** Describe the currently retained advisory facts; never infer scores or package exploitability. */
function summarizeAdvisories(advisories: VulnerabilitySummary[]) {
  const severityCounts: PackageSeverityCounts = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  let highestSeverity: PackageSeverity = 'unknown';
  let latestModifiedAt = '';
  let latestModifiedTime = -Infinity;
  let withdrawnCount = 0;
  for (const item of advisories) {
    const severity = item.severity.label;
    severityCounts[severity]++;
    if (severityRank[severity] > severityRank[highestSeverity]) highestSeverity = severity;
    const modifiedTime = Date.parse(item.modifiedAt);
    if (modifiedTime > latestModifiedTime) {
      latestModifiedTime = modifiedTime;
      latestModifiedAt = item.modifiedAt;
    }
    if (item.withdrawnAt) withdrawnCount++;
  }
  return { highestSeverity, severityCounts, latestModifiedAt, withdrawnCount };
}

/** Call after advisory filtering; an ecosystem selection also limits package rows. */
export function groupPackages(items: VulnerabilitySummary[], ecosystem = 'all'): PackageGroup[] {
  const groups = new Map<string, PendingGroup>();
  for (const item of items) for (const pkg of item.affected) {
    if (ecosystem === 'all' || pkg.ecosystem === ecosystem) addAdvisory(groups, pkg, item);
  }
  return [...groups].map(([key, group]) => {
    const advisories = [...group.advisories.values()].sort(compareAdvisories);
    return { key, ecosystem: group.ecosystem, packageName: group.packageName, advisories,
      latestPublishedAt: advisories[0].publishedAt, ...summarizeAdvisories(advisories) };
  }).sort(compareGroups);
}
