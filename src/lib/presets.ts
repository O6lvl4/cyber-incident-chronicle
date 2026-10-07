export interface Preset { name: string; sql: string }
export const PRESETS: Preset[] = [
  { name: '事案一覧（重複なし）', sql: `SELECT id, company AS 企業, announcementDate AS 収録公表日, disclosureStatus AS 確認状況 FROM incidents ORDER BY announcementDate DESC` },
  { name: '確認状況別の事案数', sql: `SELECT disclosureStatus AS 確認状況, count(*) AS 事案数 FROM incidents GROUP BY 1 ORDER BY 1` },
  { name: '影響別の事案数（重複あり）', sql: `SELECT t.name AS 影響, count(*) AS 事案数 FROM (SELECT unnest(impactTypes) AS impact FROM incidents) i JOIN threads t ON t.id = i.impact GROUP BY 1 ORDER BY 1` },
  { name: '事案をタイムラインで開く', sql: `SELECT id, date AS 収録公表日, title AS 事案 FROM events ORDER BY date DESC` },
  { name: 'ライブラリの脆弱性', sql: `SELECT id, title, CAST(publishedAt AS VARCHAR) AS publishedAt, CAST(modifiedAt AS VARCHAR) AS modifiedAt, CAST(withdrawnAt AS VARCHAR) AS withdrawnAt FROM vulnerabilities ORDER BY publishedAt DESC` },
];
