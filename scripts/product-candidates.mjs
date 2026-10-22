#!/usr/bin/env node
/**
 * Read-only candidate discovery for the product/runtime advisory category.
 * Compares CISA KEV additions, JPCERT/CC alerts and IPA alerts against the
 * committed records and prior review decisions, then writes a report. Nothing
 * is published or edited automatically; --draft writes skeletons outside src/.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProducts } from './product-status.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export const SOURCES = {
  kev: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
  jpcert: year => `https://www.jpcert.or.jp/at/${year}.html`,
  ipa: fiscalYear => `https://www.ipa.go.jp/security/security-alert/${fiscalYear}/index.html`,
  cve: id => `https://cveawg.mitre.org/api/cve/${id}`,
};
// Some public feeds reject the default Node user agent; identify as a browser-like client.
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; cyber-incident-chronicle-candidates/1.0)', Accept: 'application/json, text/html;q=0.9, */*;q=0.8' };
const CVE = /CVE-\d{4}-\d{4,}/g;
const day = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '');
const decode = text => text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

/** JPCERT/CC yearly index: one table row per alert with a date cell and a titled link. */
export function parseJpcert(html, base = 'https://www.jpcert.or.jp') {
  const items = [];
  const row = /<td class="c">(\d{4}-\d{2}-\d{2})<\/td>\s*<td class="at_link"><a href="([^"]+)">([\s\S]*?)<\/a>/g;
  for (const match of html.matchAll(row)) {
    const title = decode(match[3].replace(/<[^>]+>/g, ''));
    const id = /at(\d{2})(\d{4})\.html$/.exec(match[2]);
    items.push({ issuer: 'JPCERT/CC', id: id ? `JPCERT-AT-20${id[1]}-${id[2]}` : null, date: match[1], title, url: new URL(match[2], base).href, cves: [...new Set(title.match(CVE) ?? [])] });
  }
  return items;
}
/** IPA fiscal-year index: list items carrying a label (緊急/注意), a Japanese date and a title. */
export function parseIpa(html, base = 'https://www.ipa.go.jp') {
  const items = [];
  const item = /<a href="([^"]+)" class="news-list__inner[^"]*">[\s\S]*?news-list__label[^>]*>([^<]*)<\/li>[\s\S]*?news-list__date">(\d{4})年(\d{1,2})月(\d{1,2})日<\/li>[\s\S]*?news-list__ttl">([\s\S]*?)<\/p>/g;
  for (const match of html.matchAll(item)) {
    const title = decode(match[6].replace(/<[^>]+>/g, ''));
    items.push({ issuer: 'IPA', id: null, label: decode(match[2]), date: `${match[3]}-${match[4].padStart(2, '0')}-${match[5].padStart(2, '0')}`, title, url: new URL(match[1], base).href, cves: [...new Set(title.match(CVE) ?? [])] });
  }
  return items;
}
export function loadReviewDecisions(directory = resolve(root, 'docs/data')) {
  const excludedUrls = new Set(), excludedIds = new Set();
  for (const file of readdirSync(directory).filter(name => /^product-advisory-review-\d{4}-\d{2}-\d{2}\.json$/.test(name))) {
    const review = JSON.parse(readFileSync(resolve(directory, file), 'utf8'));
    for (const candidate of review.candidates ?? []) if (candidate.decision === 'excluded') { if (candidate.url) excludedUrls.add(candidate.url); if (candidate.id) excludedIds.add(candidate.id); }
  }
  return { excludedUrls, excludedIds };
}
/** Pure comparison so it can be tested without the network. */
export function compareCandidates({ records, kev, jpcert, ipa, since, decisions }) {
  const identities = new Map();
  for (const record of records) for (const id of [record.id, ...record.aliases]) identities.set(id, record.id);
  const alertUrls = new Set(records.flatMap(record => record.alerts.map(alert => alert.url)));
  const candidates = [], drift = [];
  for (const entry of kev?.vulnerabilities ?? []) {
    if (entry.dateAdded < since) continue;
    const recordId = identities.get(entry.cveID);
    const record = recordId ? records.find(item => item.id === recordId) : undefined;
    if (!record) { if (!decisions.excludedIds.has(entry.cveID)) candidates.push({ origin: 'kev', id: entry.cveID, date: entry.dateAdded, title: entry.vulnerabilityName, vendor: entry.vendorProject, product: entry.product, url: (entry.notes ?? '').split(' ; ')[0], dueDate: entry.dueDate }); }
    else if (record.kev.status !== 'listed') drift.push({ kind: 'kev-not-recorded', id: record.id, cve: entry.cveID, dateAdded: entry.dateAdded });
  }
  for (const alert of [...(jpcert ?? []), ...(ipa ?? [])]) {
    if (alert.date < since || alertUrls.has(alert.url) || decisions.excludedUrls.has(alert.url)) continue;
    const matched = [...new Set(alert.cves.map(cve => identities.get(cve)).filter(Boolean))];
    if (matched.length) drift.push({ kind: 'alert-not-recorded', issuer: alert.issuer, url: alert.url, date: alert.date, title: alert.title, records: matched });
    else candidates.push({ origin: alert.issuer === 'IPA' ? 'ipa' : 'jpcert', id: alert.id, date: alert.date, title: alert.title, url: alert.url, cves: alert.cves, label: alert.label });
  }
  candidates.sort((a, b) => b.date.localeCompare(a.date) || String(a.id ?? a.url).localeCompare(String(b.id ?? b.url)));
  return { candidates, drift };
}
async function fetchText(url) {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}
async function attempt(name, url, parse) {
  try { const body = await fetchText(url); return { name, url, status: 'ok', fetchedAt: new Date().toISOString(), value: parse(body) }; }
  catch (error) { return { name, url, status: 'failed', fetchedAt: new Date().toISOString(), error: String(error.message ?? error), value: null }; }
}
function slug(text) { return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'product'; }
/** Draft skeletons carry TODO markers so the validator refuses them until a person completes the review. */
export function draftFromKev(entry, cve, checkedAt) {
  const cna = cve?.containers?.cna ?? {}; const meta = cve?.cveMetadata ?? {};
  const cvss = [];
  for (const metric of cna.metrics ?? []) for (const [key, value] of Object.entries(metric)) if (key.startsWith('cvss')) cvss.push({ version: value.version, score: value.baseScore, vector: value.vectorString, sourceUrl: SOURCES.cve(entry.cveID) });
  const critical = cvss.some(score => score.score >= 9.0);
  const affected = (cna.affected ?? []).flatMap(product => (product.versions ?? []).filter(version => version.status === 'affected').map(version => ({ name: `${product.vendor ?? entry.vendorProject} ${product.product ?? entry.product}`, affected: `${version.version}${version.lessThan ? ` < ${version.lessThan}` : ''}${version.lessThanOrEqual ? ` <= ${version.lessThanOrEqual}` : ''}`, fixed: version.lessThan ?? null, sourceUrl: SOURCES.cve(entry.cveID) })));
  const vendorUrl = (entry.notes ?? '').split(' ; ')[0];
  return {
    kind: 'product', id: entry.cveID, aliases: [], vendor: entry.vendorProject, product: entry.product, productKey: slug(`${entry.vendorProject}-${entry.product}`),
    title: 'TODO: 日本語の題名', summary: `TODO: 要約。CNA説明文: ${(cna.descriptions ?? []).find(d => d.lang?.startsWith('en'))?.value ?? ''}`,
    publishedDate: (meta.datePublished ?? '').slice(0, 10) || 'TODO', publishedAt: meta.datePublished ?? null, dateSourceUrl: SOURCES.cve(entry.cveID), dateNote: 'TODO: 開発元の公表日を確認し、CVEレコードの日時との関係を書く',
    listedDate: entry.dateAdded, listedNote: 'CISA KEVに追加された日（TODO: 他の理由が先なら差し替え）', modifiedAt: meta.dateUpdated ?? null, withdrawnAt: null, lastVerifiedAt: checkedAt,
    affected: affected.length ? affected : [{ name: `${entry.vendorProject} ${entry.product}`, affected: 'TODO', fixed: null, sourceUrl: SOURCES.cve(entry.cveID) }],
    severity: { label: critical ? 'critical' : cvss.length ? 'TODO' : 'unknown', sourceUrl: cvss.length ? SOURCES.cve(entry.cveID) : null, cvss },
    exploitation: { status: 'reported', sourceUrl: SOURCES.kev }, kev: { status: 'listed', checkedAt, sourceUrl: SOURCES.kev, addedDate: entry.dateAdded }, poc: { status: 'unknown', sourceUrl: null },
    alerts: [], alertChecks: [], inclusion: [...(critical ? ['critical'] : []), 'exploited', 'kev'], mitigations: [],
    sources: [{ type: 'maintainer', title: `TODO: 開発元告知（KEV備考: ${vendorUrl}）`, url: vendorUrl.startsWith('https://') ? vendorUrl : 'https://TODO', publishedDate: null }, { type: 'advisoryDatabase', title: `公開CVEレコード（CNA: ${cna.providerMetadata?.shortName ?? 'TODO'}）`, url: SOURCES.cve(entry.cveID), publishedDate: (meta.datePublished ?? '').slice(0, 10) || null, publishedAt: meta.datePublished, modifiedAt: meta.dateUpdated }, { type: 'kev', title: 'CISA Known Exploited Vulnerabilities catalog', url: SOURCES.kev, publishedDate: entry.dateAdded }],
    caveats: ['TODO: 開発元資料を読んで注意書きを書く。この下書きはCISA KEVとCNAレコードだけから生成した。'],
  };
}
export function summarize(report) {
  const lines = [`# 製品・ランタイム注意喚起の候補（${report.since} 以降）`, ''];
  for (const source of report.sources) lines.push(`- ${source.name}: ${source.status}${source.error ? ` (${source.error})` : ''}${source.catalogVersion ? ` catalog ${source.catalogVersion}` : ''}`);
  lines.push('', `## 未収録の候補 ${report.candidates.length}件`, '');
  for (const c of report.candidates) lines.push(`- ${c.date} [${c.origin}] ${c.id ?? ''} ${c.title ?? ''} ${c.url ?? ''}`.replace(/\s+/g, ' '));
  lines.push('', `## 収録済み記録との差分 ${report.drift.length}件`, '');
  for (const d of report.drift) lines.push(`- ${d.kind}: ${d.id ?? d.records?.join(', ') ?? ''} ${d.cve ?? ''} ${d.url ?? ''} ${d.dateAdded ?? d.date ?? ''}`.replace(/\s+/g, ' '));
  return lines.join('\n') + '\n';
}
async function main() {
  const args = process.argv.slice(2);
  const today = new Date().toISOString().slice(0, 10);
  const options = { since: new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10), output: resolve(root, `.cache/product-candidates/${today}.json`), draft: false, summary: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--since' && day(args[i + 1])) options.since = args[++i];
    else if (args[i] === '--output' && args[i + 1]) options.output = resolve(args[++i]);
    else if (args[i] === '--summary' && args[i + 1]) options.summary = resolve(args[++i]);
    else if (args[i] === '--draft') options.draft = true;
    else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
  }
  const records = loadProducts();
  const year = options.since.slice(0, 4);
  const fiscalYear = Number(options.since.slice(5, 7)) >= 4 ? year : String(Number(year) - 1);
  const [kev, jpcert, ipa] = await Promise.all([
    attempt('CISA KEV', SOURCES.kev, body => JSON.parse(body)),
    attempt('JPCERT/CC 注意喚起', SOURCES.jpcert(year), parseJpcert),
    attempt('IPA 重要なセキュリティ情報', SOURCES.ipa(fiscalYear), parseIpa),
  ]);
  const { candidates, drift } = compareCandidates({ records, kev: kev.value, jpcert: jpcert.value, ipa: ipa.value, since: options.since, decisions: loadReviewDecisions() });
  const report = { generatedAt: new Date().toISOString(), since: options.since, records: records.length,
    sources: [{ ...kev, value: undefined, catalogVersion: kev.value?.catalogVersion, dateReleased: kev.value?.dateReleased, count: kev.value?.count }, { ...jpcert, value: undefined, items: jpcert.value?.length }, { ...ipa, value: undefined, items: ipa.value?.length }],
    candidates, drift, note: '取得失敗は候補なしを意味しない。候補は一次資料を読んで判定し、除外も確認記録に残す。' };
  mkdirSync(resolve(options.output, '..'), { recursive: true });
  writeFileSync(options.output, JSON.stringify(report, null, 2) + '\n');
  if (options.summary) writeFileSync(options.summary, summarize(report), { flag: 'a' });
  if (options.draft && kev.value) {
    const directory = resolve(root, '.cache/product-drafts'); mkdirSync(directory, { recursive: true });
    for (const candidate of candidates.filter(item => item.origin === 'kev')) {
      const entry = kev.value.vulnerabilities.find(item => item.cveID === candidate.id);
      const cve = await attempt(candidate.id, SOURCES.cve(candidate.id), body => JSON.parse(body));
      writeFileSync(resolve(directory, `${candidate.id}.json`), JSON.stringify(draftFromKev(entry, cve.value, kev.fetchedAt), null, 2) + '\n');
    }
  }
  process.stdout.write(summarize(report));
  if (report.sources.some(source => source.status === 'failed')) process.exitCode = 2;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
