import type { Incident, IncidentDateEvidence } from '../types';

export function incidentDateText(value?: IncidentDateEvidence): string {
  if (!value) return '未確認・不明';
  if (value.precision === 'unknown') return '未公表・不明';
  if (value.precision === 'notApplicable') return '該当なし';
  return `${value.label}${value.precision === 'approximate' ? '（推定）' : ''}`;
}

export function incidentDateComparisons(item: Incident) {
  return [
    { key: 'attack', title: '攻撃があったとされる時期', text: incidentDateText(item.eventDates?.attack), evidence: item.eventDates?.attack },
    { key: 'damage', title: '被害を最初に確認した日', text: incidentDateText(item.eventDates?.damageConfirmed), evidence: item.eventDates?.damageConfirmed },
    { key: 'publication', title: '公表日（収録資料の起点）', text: item.announcementDate, evidence: undefined },
  ];
}
