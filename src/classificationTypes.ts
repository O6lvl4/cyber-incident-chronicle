export interface EntityClassification {
  name: string;
  industry: 'manufacturing' | 'it' | 'retail' | 'finance' | 'transport' | 'energy' | 'construction' | 'media' | 'services' | 'other' | 'unknown' | 'notApplicable';
  manufacturingType: 'food' | 'electronics' | 'automotive' | 'machinery' | 'chemicals' | 'medical' | 'textiles' | 'other' | 'unknown' | 'notApplicable';
  listingStatus: 'listed' | 'unlisted' | 'unknown' | 'notApplicable';
  listingAsOfDate: string;
  listedParent?: { name: string; sourceUrl: string };
  sources: { url: string; title: string; checkedDate: string }[];
  note?: string;
}
export type ClassificationStatus = 'confirmed' | 'possible' | 'unknown' | 'notApplicable';
export interface AttackClassification {
  attackKind: 'ransomware' | 'malware' | 'credentialAbuse' | 'webTampering' | 'insider' | 'misconfiguration' | 'other' | 'unknown' | 'notApplicable';
  attackKindStatus: ClassificationStatus;
  initialAccess: 'vulnerability' | 'credentials' | 'phishing' | 'networkDevice' | 'insider' | 'misconfiguration' | 'other' | 'unknown' | 'notApplicable';
  initialAccessStatus: ClassificationStatus;
  sourceUrls: string[];
  reviewedDate: string;
  note: string;
}
export interface ClassificationFilters {
  industry: string; manufacturingType: string; listingStatus: string;
  attackKind: string; initialAccess: string; confidence: string;
}
