import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJpcert, parseIpa, compareCandidates, draftFromKev, summarize } from './product-candidates.mjs';
import { loadProducts } from './product-status.mjs';
import { validateProducts } from './product-status.mjs';
const records = loadProducts();
const jpcertHtml = `<table><tr><td class="c">2026-10-22</td><td class="at_link"><a href="/at/2026/at260033.html">PHPにおける複数の脆弱性（CVE-2026-109618、CVE-2026-109619）に関する注意喚起 (公開)</a></td><td class="c"><a href="/at/2026/at260033.txt">5KB</a></td></tr>
<tr><td class="c">2026-10-08</td><td class="at_link"><a href="/at/2026/at260030.html">直近で相次いでいる国内組織における不正アクセスに関する注意喚起 (更新)</a></td></tr></table>`;
const ipaHtml = `<li class="news-list__item" data-search="urgent"><a href="/security/security-alert/2026/1014-ms.html" class="news-list__inner "><ul class="news-list__data-box"><li class="news-list__label label --info-cat --urgent">緊急</li><li class="news-list__date">2026年10月14日</li></ul><p class="news-list__ttl">Microsoft 製品の脆弱性対策について(2026年10月)</p></a></li>
<li class="news-list__item"><a href="/security/security-alert/2026/alert20261101.html" class="news-list__inner "><ul><li class="news-list__label label --info-cat --attention">注意</li><li class="news-list__date">2026年11月1日</li></ul><p class="news-list__ttl">Example 製品の脆弱性対策について(CVE-2026-999999)</p></a></li>`;

test('JPCERT and IPA index pages parse into dated, titled, CVE-tagged alerts with absolute URLs', () => {
  const jpcert = parseJpcert(jpcertHtml);
  assert.deepEqual(jpcert.map(item => item.id), ['JPCERT-AT-2026-0033', 'JPCERT-AT-2026-0030']);
  assert.deepEqual(jpcert[0].cves, ['CVE-2026-109618', 'CVE-2026-109619']);
  assert.equal(jpcert[0].url, 'https://www.jpcert.or.jp/at/2026/at260033.html');
  const ipa = parseIpa(ipaHtml);
  assert.equal(ipa.length, 2);
  assert.deepEqual([ipa[0].label, ipa[0].date, ipa[1].date, ipa[1].cves], ['緊急', '2026-10-14', '2026-11-01', ['CVE-2026-999999']]);
});
test('comparison reports only uncovered candidates and evidence drift, honouring prior exclusions', () => {
  const kev = { vulnerabilities: [
    { cveID: 'CVE-2026-109618', dateAdded: '2026-10-23', vulnerabilityName: 'PHP RCE', vendorProject: 'PHP Group', product: 'PHP', notes: 'https://www.php.net/ ; x' },
    { cveID: 'CVE-2026-888888', dateAdded: '2026-10-23', vulnerabilityName: 'New thing', vendorProject: 'Vendor', product: 'Thing', notes: 'https://vendor.example/advisory' },
    { cveID: 'CVE-2026-777777', dateAdded: '2026-09-01', vulnerabilityName: 'Old addition', vendorProject: 'V', product: 'P', notes: '' },
  ] };
  const result = compareCandidates({ records, kev, jpcert: parseJpcert(jpcertHtml), ipa: parseIpa(ipaHtml), since: '2026-10-01', decisions: { excludedUrls: new Set(['https://www.jpcert.or.jp/at/2026/at260030.html']), excludedIds: new Set() } });
  assert.deepEqual(result.candidates.map(item => item.id ?? item.url), ['https://www.ipa.go.jp/security/security-alert/2026/alert20261101.html', 'CVE-2026-888888']);
  assert.ok(result.drift.some(item => item.kind === 'kev-not-recorded' && item.id === 'CVE-2026-109618'));
  assert.ok(!result.drift.some(item => item.url?.endsWith('at260033.html')), 'alerts already recorded are not drift');
  assert.ok(!result.drift.some(item => item.url?.endsWith('1014-ms.html')));
  assert.ok(!result.candidates.some(item => item.id === 'CVE-2026-777777'), 'additions before --since are ignored');
});
test('KEV drafts are refused by the validator until a person completes them', () => {
  const entry = { cveID: 'CVE-2026-888888', dateAdded: '2026-10-23', vulnerabilityName: 'New thing', vendorProject: 'Vendor', product: 'Thing', notes: 'https://vendor.example/advisory' };
  const cve = { cveMetadata: { datePublished: '2026-10-20T00:00:00.000Z', dateUpdated: '2026-10-21T00:00:00.000Z' }, containers: { cna: { providerMetadata: { shortName: 'vendor' }, descriptions: [{ lang: 'en', value: 'desc' }], affected: [{ vendor: 'Vendor', product: 'Thing', versions: [{ version: '1.0', lessThan: '1.2', status: 'affected' }] }], metrics: [{ cvssV3_1: { version: '3.1', baseScore: 9.8, vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' } }] } } };
  const draft = draftFromKev(entry, cve, '2026-10-23T00:00:00Z');
  assert.deepEqual(draft.inclusion, ['critical', 'exploited', 'kev']);
  assert.equal(draft.affected[0].fixed, '1.2');
  const errors = validateProducts([draft], { windowStart: '2026-10-01', windowEnd: '2026-12-31', lastVerifiedDate: '2026-12-31' });
  assert.ok(errors.some(error => /draft placeholder/.test(error)), errors.join('\n'));
  assert.match(summarize({ since: '2026-10-01', sources: [{ name: 'CISA KEV', status: 'ok' }], candidates: [{ origin: 'kev', id: 'CVE-2026-888888', date: '2026-10-23', title: 'New thing' }], drift: [] }), /未収録の候補 1件/);
});
