export type Weight = 1 | 2 | 3;
export type SourceTier = 'primary' | 'secondary';
export type ImpactType = 'leak' | 'outage' | 'unauthorizedAccess';
export type DisclosureStatus = 'confirmed' | 'possible' | 'investigating' | 'noConfirmedLeak';
export interface Thread { id: string; name: string; en: string; color: string; darkColor: string }
export interface Incident {
  id: string;
  company: string;
  geography?: string;
  caveats?: string[];
  announcementDateLabel?: string;
  statusAsOfDate?: string;
  title: string;
  announcementDate: string;
  occurredDate: string | null;
  occurredDateLabel: string;
  updatedDate: string;
  impactTypes: ImpactType[];
  disclosureStatus: DisclosureStatus;
  attackMethod: { label: string; status: 'confirmed' | 'possible' | 'unknown' | 'notApplicable' };
  summary: string;
  affectedData: string[];
  counts: { value: number; unit: string; status: string; label: string; approximate: boolean }[];
  sources: { title: string; url: string; publishedDate: string }[];
  timeline: { date: string; label: string; kind: 'occurrence' | 'disclosure' | 'update'; summary: string; sourceUrl: string }[];
  lastVerifiedDate: string;
}
export interface IncidentDataset {
  meta: { windowStart: string; windowEnd: string; lastVerifiedDate: string; coverageNote: string };
  incidents: Incident[];
}
export interface TimelineEvent {
  id: string; incidentId: string; threadId: string; date: string; endDate?: string;
  weight: Weight; title: string; body: string; source: string; sourceUrl?: string; sourceTier?: SourceTier;
}
export interface Link { from: string; to: string; why: string }
