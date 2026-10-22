import type { Vulnerability } from './vulnerabilityTypes';
/** Why a product advisory is retained; each reason must be backed by its own evidence field. */
export type ProductInclusion = 'critical' | 'exploited' | 'kev' | 'alert';
export interface ProductAffectedRange { name: string; affected: string; fixed: string | null; sourceUrl: string; note?: string }
export interface ProductAlert { issuer: string; title: string; url: string; publishedDate: string }
export interface ProductAlertCheck { issuer: string; url: string; checkedAt: string; result: 'found' | 'notFound' | 'failed' }
export interface ProductSource { type: 'maintainer' | 'advisoryDatabase' | 'release' | 'kev' | 'exploitation' | 'alert'; title: string; url: string; publishedDate: string | null; publishedAt?: string; modifiedAt?: string }
/**
 * A vendor-disclosed vulnerability in a runtime, platform or product that is not a
 * package in the library ecosystems. Retained only when a stated inclusion reason holds.
 * Publication is the vendor's own disclosure day, not a database timestamp; the listed
 * day records when the retention rule was met and may be later than disclosure.
 */
export interface ProductAdvisory {
  kind: 'product';
  id: string;
  aliases: string[];
  vendor: string;
  product: string;
  productKey: string;
  title: string;
  summary: string;
  publishedDate: string;
  publishedAt: string | null;
  dateSourceUrl: string;
  dateNote: string;
  /** The day an inclusion reason was first met (vendor disclosure, alert, KEV addition or exploitation report). The timeline axis. */
  listedDate: string;
  listedNote: string;
  modifiedAt: string | null;
  withdrawnAt: string | null;
  lastVerifiedAt: string;
  affected: ProductAffectedRange[];
  severity: Vulnerability['severity'];
  exploitation: Vulnerability['exploitation'];
  kev: Vulnerability['kev'] & { addedDate?: string | null };
  alerts: ProductAlert[];
  alertChecks: ProductAlertCheck[];
  inclusion: ProductInclusion[];
  mitigations: { text: string; sourceUrl: string }[];
  sources: ProductSource[];
  caveats: string[];
}
