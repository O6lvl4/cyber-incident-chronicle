export interface Preset { name: string; sql: string }
export const PRESETS: Preset[] = [
  { name: '事案一覧（重複なし）', sql: `SELECT id, company AS 企業, announcementDate AS 収録公表日, disclosureStatus AS 確認状況 FROM incidents ORDER BY announcementDate DESC` },
  { name: '確認状況別の事案数', sql: `SELECT disclosureStatus AS 確認状況, count(*) AS 事案数 FROM incidents GROUP BY 1 ORDER BY 1` },
  { name: '影響別の事案数（重複あり）', sql: `SELECT t.name AS 影響, count(DISTINCT e.incidentId) AS 事案数 FROM events e JOIN threads t ON t.id = e.threadId GROUP BY 1 ORDER BY 1` },
  { name: '事案をタイムラインで開く', sql: `SELECT id, date AS 収録公表日, title AS 事案 FROM events QUALIFY row_number() OVER (PARTITION BY incidentId ORDER BY id) = 1 ORDER BY date DESC` },
];
