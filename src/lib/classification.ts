import { ENTITIES } from '../data/entities-index.ts';
import incidentEntitiesJson from '../data/incident-entities.json' with { type: 'json' };
import { ATTACKS } from '../data/attack-classifications-index.ts';
import type { AttackClassification, ClassificationFilters, EntityClassification } from '../classificationTypes';
import type { Incident } from '../types';

export const INDUSTRY_LABELS: Record<EntityClassification['industry'], string> = {
  manufacturing: '製造業', it: 'IT・通信', retail: '卸売・小売', finance: '金融・保険', transport: '運輸・物流',
  energy: 'エネルギー', construction: '建設・不動産', media: '出版・メディア', services: 'サービス',
  other: 'その他', unknown: '未確認・不明', notApplicable: '企業以外・対象外',
};
export const MANUFACTURING_LABELS: Record<EntityClassification['manufacturingType'], string> = {
  food: '食品・飲料', electronics: '電機・電子', automotive: '自動車・部品', machinery: '機械・設備',
  chemicals: '化学・素材', medical: '医療機器・医薬', textiles: '繊維', other: 'その他の製造業',
  unknown: '未確認・不明', notApplicable: '製造業以外・対象外',
};
export const LISTING_LABELS: Record<EntityClassification['listingStatus'], string> = {
  listed: '対象企業自体が上場', unlisted: '対象企業自体は非上場', unknown: '未確認・不明', notApplicable: '企業以外・対象外',
};
export const ATTACK_LABELS: Record<AttackClassification['attackKind'], string> = {
  ransomware: 'ランサムウェア', malware: 'その他のマルウェア', credentialAbuse: '認証情報の悪用',
  webTampering: 'Web改ざん・スキミング', insider: '内部者による持ち出し', misconfiguration: '設定不備による露出',
  other: 'その他の公表された手法', unknown: '未公表・不明', notApplicable: '攻撃には該当せず',
};
export const ACCESS_LABELS: Record<AttackClassification['initialAccess'], string> = {
  vulnerability: '脆弱性の悪用', credentials: '認証情報の悪用', phishing: 'フィッシング', networkDevice: 'ネットワーク機器経由（詳細不明）',
  insider: '内部者の権限', misconfiguration: '設定不備', other: 'その他の公表された経路', unknown: '未公表・不明', notApplicable: '該当なし',
};
export const CONFIDENCE_LABELS = { confirmed: '公表で確認', possible: '可能性あり', unknown: '未公表・不明', notApplicable: '該当なし' };
export const DEFAULT_CLASSIFICATION: ClassificationFilters = {
  industry: 'all', manufacturingType: 'all', listingStatus: 'all', attackKind: 'all', initialAccess: 'all', confidence: 'all',
};
export const CLASSIFICATION_OPTIONS = {
  industry: INDUSTRY_LABELS, manufacturingType: MANUFACTURING_LABELS, listingStatus: LISTING_LABELS,
  attackKind: ATTACK_LABELS, initialAccess: ACCESS_LABELS, confidence: CONFIDENCE_LABELS,
};
const entities = ENTITIES;
const incidentEntities = incidentEntitiesJson as Record<string, string[]>;
const attacks = ATTACKS;
const unknownEntity: EntityClassification = { name: '対象組織（未分類）', industry: 'unknown', manufacturingType: 'unknown', listingStatus: 'unknown', listingAsOfDate: '', sources: [] };
const unknownAttack: AttackClassification = { attackKind: 'unknown', attackKindStatus: 'unknown', initialAccess: 'unknown', initialAccessStatus: 'unknown', sourceUrls: [], reviewedDate: '', note: '分類資料は未確認です' };
export function getEntities(id: string): EntityClassification[] { return incidentEntities[id]?.map(key => entities[key] ?? unknownEntity) ?? [unknownEntity]; }
export function getAttack(id: string): AttackClassification { return attacks[id] ?? unknownAttack; }
export function normalizeClassification(input: Partial<ClassificationFilters>): ClassificationFilters {
  const result = { ...DEFAULT_CLASSIFICATION };
  for (const key of Object.keys(result) as (keyof ClassificationFilters)[]) {
    const value = input[key];
    if (value && Object.prototype.hasOwnProperty.call(CLASSIFICATION_OPTIONS[key], value)) result[key] = value;
  }
  return result;
}
function matchesEntity(entity: EntityClassification, filters: ClassificationFilters): boolean {
  return (filters.industry === 'all' || entity.industry === filters.industry)
    && (filters.manufacturingType === 'all' || entity.manufacturingType === filters.manufacturingType)
    && (filters.listingStatus === 'all' || entity.listingStatus === filters.listingStatus);
}
function matchesAttack(attack: AttackClassification, filters: ClassificationFilters): boolean {
  if (filters.attackKind !== 'all' && attack.attackKind !== filters.attackKind) return false;
  if (filters.initialAccess !== 'all' && attack.initialAccess !== filters.initialAccess) return false;
  if (filters.confidence === 'all') return true;
  const kindMatch = attack.attackKindStatus === filters.confidence;
  const accessMatch = attack.initialAccessStatus === filters.confidence;
  // Confidence applies to each selected axis; without one, it applies to attack kind.
  if (filters.initialAccess !== 'all' && !accessMatch) return false;
  return filters.attackKind === 'all' && filters.initialAccess !== 'all' ? true : kindMatch;
}
export function matchesClassification(item: Incident, filters: ClassificationFilters): boolean {
  // All entity conditions must match the SAME victim, never a different group member or its parent.
  return getEntities(item.id).some(entity => matchesEntity(entity, filters)) && matchesAttack(getAttack(item.id), filters);
}
export function summarizeAttacks(incidents: Incident[]) {
  const counts = { total: incidents.length, confirmedRansomware: 0, possibleRansomware: 0, unknown: 0 };
  for (const item of incidents) {
    const attack = getAttack(item.id);
    if (attack.attackKind === 'unknown') counts.unknown++;
    if (attack.attackKind === 'ransomware' && attack.attackKindStatus === 'confirmed') counts.confirmedRansomware++;
    if (attack.attackKind === 'ransomware' && attack.attackKindStatus === 'possible') counts.possibleRansomware++;
  }
  return counts;
}
