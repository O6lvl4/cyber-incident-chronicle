import test from 'node:test';
import assert from 'node:assert/strict';
import { incidentDateText, incidentDateComparisons } from '../src/lib/incidentDates.ts';
import { validateIncidentDates } from './incident-dates-status.mjs';
const evidence = { precision: 'day', label: '2024-07-11', startDate: '2024-07-11', note: '公式調査で確認された不正アクセス', sourceUrl: 'https://example.com/notice', reviewedDate: '2026-10-18' };
const incident = { announcementDate: '2024-07-29', occurredDate: '2024-07-22', detectedDate: '2024-07-22', sources: [{ url: evidence.sourceUrl }], eventDates: { attack: evidence } };
test('legacy detection/occurrence dates never become attack or first damage confirmation dates', () => {
  const rows = incidentDateComparisons({ ...incident, eventDates: undefined });
  assert.deepEqual(rows.map(row => row.text), ['未確認・不明', '未確認・不明', '2024-07-29']);
});
test('preserves periods, open bounds and approximate precision without fabricating a day', () => {
  assert.equal(incidentDateText({ ...evidence, precision: 'period', label: '2024-08-03以降' }), '2024-08-03以降');
  assert.equal(incidentDateText({ ...evidence, precision: 'approximate', label: '2024年夏ごろ' }), '2024年夏ごろ（推定）');
  assert.equal(incidentDateText({ precision: 'unknown' }), '未公表・不明');
  assert.equal(incidentDateText({ precision: 'notApplicable' }), '該当なし');
});
test('evidence requires a cited primary source, review date and valid bounded dates', () => {
  assert.deepEqual(validateIncidentDates(incident, '2026-10-18'), []);
  for (const change of [{ sourceUrl: 'https://example.com/missing' }, { precision: 'invented' }, { startDate: '2024-02-30' }, { reviewedDate: '2026-10-19' }, { note: '' }, { precision: 'period', endDate: '2024-07-01' }, { precision: 'unknown' }]) {
    assert.ok(validateIncidentDates({ ...incident, eventDates: { attack: { ...evidence, ...change } } }, '2026-10-18').length, JSON.stringify(change));
  }
});
