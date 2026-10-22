import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../src/data/products/', import.meta.url);
export function loadProducts() {
  return readdirSync(root).filter(file => file.endsWith('.json')).sort().map(file => {
    const record = JSON.parse(readFileSync(new URL(file, root), 'utf8'));
    if (file !== `${record.id}.json`) throw new Error(`${file}: filename must match advisory ID`);
    return record;
  });
}
export function loadProductMeta() {
  return JSON.parse(readFileSync(new URL('../src/data/product-meta.json', import.meta.url), 'utf8'));
}
/** A CVE, or a vendor bulletin identifier when one bulletin covers many CVEs (listed as aliases). */
const identifier = /^(?:CVE-\d{4}-\d{4,}|[A-Z][A-Z0-9]*(?:-[A-Za-z0-9.]+)+)$/;
const aliasIdentifier = /^(?:GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}|CVE-\d{4}-\d{4,}|[A-Z][A-Z0-9_]*(?:-[A-Za-z0-9_.:]+)+)$/;
const text = value => typeof value === 'string' && value.trim().length > 0;
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const https = value => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
const INCLUSIONS = ['critical', 'exploited', 'kev', 'alert', 'poc'];
const SOURCE_TYPES = ['maintainer', 'advisoryDatabase', 'release', 'kev', 'exploitation', 'alert', 'poc'];
function validateSources(item, fail) {
  const sources = Array.isArray(item?.sources) ? item.sources : [];
  if (!sources.some(source => source?.type === 'maintainer')) fail('missing maintainer source');
  const urls = new Set();
  for (const source of sources) {
    if (!source || typeof source !== 'object') { fail('invalid source'); continue; }
    if (!https(source.url) || !text(source.title) || !SOURCE_TYPES.includes(source.type)) fail('invalid source');
    if (source.publishedDate !== null && !day(source.publishedDate)) fail('invalid source publication date');
    for (const field of ['publishedAt', 'modifiedAt']) {
      const value = source[field];
      if (value !== undefined && (!timestamp(value) || Date.parse(value) > Date.parse(item.lastVerifiedAt))) fail(`invalid source ${field}`);
    }
    if (source.publishedAt && source.publishedDate !== source.publishedAt.slice(0, 10)) fail('source date disagrees with timestamp');
    if (urls.has(source.url)) fail('duplicate source URL');
    urls.add(source.url);
  }
  return url => https(url) && urls.has(url);
}
function validateAssessment(item, cited, fail) {
  const severity = item?.severity;
  if (!['critical', 'high', 'medium', 'low', 'unknown'].includes(severity?.label)) fail('invalid severity');
  if (severity?.label !== 'unknown' && !cited(severity?.sourceUrl)) fail('uncited severity');
  if (severity?.label === 'unknown' && severity.sourceUrl !== null) fail('unknown severity must have null source');
  if (!Array.isArray(severity?.cvss)) fail('CVSS must be an array');
  for (const score of Array.isArray(severity?.cvss) ? severity.cvss : []) {
    if (!score || typeof score !== 'object') { fail('invalid CVSS'); continue; }
    if (!['2.0', '3.0', '3.1', '4.0'].includes(score.version) || !cited(score.sourceUrl)) fail('invalid or uncited CVSS');
    if (score.score !== null && (!Number.isFinite(score.score) || score.score < 0 || score.score > 10)) fail('invalid CVSS score');
    if (score.vector !== null && (!text(score.vector) || (score.version !== '2.0' && !score.vector.startsWith(`CVSS:${score.version}/`)))) fail('invalid CVSS vector');
    if (score.score === null && score.vector === null) fail('empty CVSS assessment');
  }
  if (!['unknown', 'reported'].includes(item?.exploitation?.status)) fail('invalid exploitation status');
  if (item?.exploitation?.status === 'reported' && !cited(item.exploitation.sourceUrl)) fail('uncited exploitation');
  if (item?.exploitation?.status === 'unknown' && item.exploitation.sourceUrl !== null) fail('unknown exploitation must have null source');
  if (!['unknown', 'listed', 'notListed'].includes(item?.kev?.status)) fail('invalid KEV status');
  if (item?.kev?.status !== 'unknown') {
    if (!timestamp(item?.kev?.checkedAt) || !cited(item?.kev?.sourceUrl)) fail('uncited KEV check');
    const source = (item?.sources ?? []).find(source => source?.url === item?.kev?.sourceUrl);
    if (source?.type !== 'kev' || !https(source?.url) || !/(^|\.)cisa\.gov$/.test(new URL(source.url).hostname)) fail('KEV requires CISA evidence');
    if (timestamp(item?.kev?.checkedAt) && Date.parse(item.kev.checkedAt) > Date.parse(item.lastVerifiedAt)) fail('KEV check after verification');
  } else if (item?.kev?.sourceUrl !== null || item?.kev?.checkedAt !== null) fail('unknown KEV must have null evidence');
  if (!['unknown', 'public'].includes(item?.poc?.status)) fail('invalid poc status');
  if (item?.poc?.status === 'public' && (!cited(item.poc.sourceUrl) || (item?.sources ?? []).find(source => source?.url === item.poc.sourceUrl)?.type !== 'poc')) fail('public poc requires a cited poc-typed source');
  if (item?.poc?.status === 'unknown' && item?.poc?.sourceUrl !== null) fail('unknown poc must have null source');
  if (item?.kev?.status === 'listed' && !day(item.kev.addedDate)) fail('KEV listing requires addedDate');
  if (item?.kev?.status !== 'listed' && item?.kev?.addedDate !== undefined && item.kev.addedDate !== null) fail('addedDate requires KEV listing');
}
function validateAlerts(item, cited, fail) {
  const alerts = Array.isArray(item?.alerts) ? item.alerts : [];
  if (!Array.isArray(item?.alerts)) fail('alerts must be an array');
  for (const alert of alerts) {
    if (!alert || !text(alert.issuer) || !text(alert.title) || !day(alert.publishedDate) || !cited(alert.url)) { fail('invalid or uncited alert'); continue; }
    if ((item?.sources ?? []).find(source => source?.url === alert.url)?.type !== 'alert') fail('alert source must be typed alert');
  }
  const checks = Array.isArray(item?.alertChecks) ? item.alertChecks : [];
  if (!Array.isArray(item?.alertChecks)) fail('alertChecks must be an array');
  for (const check of checks) {
    if (!check || !text(check.issuer) || !https(check.url) || !timestamp(check.checkedAt) || !['found', 'notFound', 'failed'].includes(check.result)) fail('invalid alert check');
    else if (Date.parse(check.checkedAt) > Date.parse(item.lastVerifiedAt)) fail('alert check after verification');
    if (check?.result === 'found' && !alerts.some(alert => alert?.issuer === check.issuer)) fail('found alert check without an alert record');
  }
}
/** Every retention reason must be proven by the matching evidence field; none is inferred. */
function validateInclusion(item, fail) {
  const inclusion = Array.isArray(item?.inclusion) ? item.inclusion : [];
  if (!inclusion.length) fail('missing inclusion reason');
  if (new Set(inclusion).size !== inclusion.length) fail('duplicate inclusion reason');
  for (const reason of inclusion) {
    if (!INCLUSIONS.includes(reason)) { fail('invalid inclusion reason'); continue; }
    if (reason === 'critical' && item?.severity?.label !== 'critical') fail('critical inclusion without critical severity');
    if (reason === 'exploited' && item?.exploitation?.status !== 'reported') fail('exploited inclusion without exploitation evidence');
    if (reason === 'kev' && item?.kev?.status !== 'listed') fail('kev inclusion without KEV listing');
    if (reason === 'alert' && !(Array.isArray(item?.alerts) && item.alerts.length)) fail('alert inclusion without an alert');
    if (reason === 'poc' && item?.poc?.status !== 'public') fail('poc inclusion without public attack code');
  }
  if (item?.severity?.label === 'critical' && !inclusion.includes('critical')) fail('critical severity must be declared as an inclusion reason');
  if (item?.exploitation?.status === 'reported' && !inclusion.includes('exploited')) fail('reported exploitation must be declared as an inclusion reason');
  if (item?.kev?.status === 'listed' && !inclusion.includes('kev')) fail('KEV listing must be declared as an inclusion reason');
  if (Array.isArray(item?.alerts) && item.alerts.length && !inclusion.includes('alert')) fail('alerts must be declared as an inclusion reason');
  if (item?.poc?.status === 'public' && !inclusion.includes('poc')) fail('public attack code must be declared as an inclusion reason');
  // The listed day must be one of the evidence dates, never a chosen date.
  const evidenceDates = new Set();
  if (inclusion.includes('critical')) evidenceDates.add(item?.publishedDate);
  if (inclusion.includes('alert')) for (const alert of item?.alerts ?? []) evidenceDates.add(alert?.publishedDate);
  if (inclusion.includes('kev')) evidenceDates.add(item?.kev?.addedDate);
  if (inclusion.includes('exploited')) evidenceDates.add((item?.sources ?? []).find(source => source?.url === item?.exploitation?.sourceUrl)?.publishedDate);
  if (inclusion.includes('poc')) evidenceDates.add((item?.sources ?? []).find(source => source?.url === item?.poc?.sourceUrl)?.publishedDate);
  if (day(item?.listedDate) && !evidenceDates.has(item.listedDate)) fail('listedDate is not an evidence date of an inclusion reason');
}
export function validateProducts(records, meta = loadProductMeta()) {
  const errors = [];
  const identities = new Map();
  if (!day(meta?.windowStart) || !day(meta?.windowEnd) || meta.windowStart > meta.windowEnd || !day(meta?.lastVerifiedDate)) errors.push('invalid product coverage window');
  for (const item of records) {
    const fail = message => errors.push(`${item?.id ?? 'unknown'}: ${message}`);
    if (!item || typeof item !== 'object') { fail('invalid record'); continue; }
    // Generated drafts carry TODO markers; they must never reach the published dataset.
    if (JSON.stringify(item).includes('TODO')) fail('draft placeholder present');
    if (item.kind !== 'product') fail('invalid kind');
    if (!identifier.test(item?.id)) fail('invalid advisory ID');
    if (!Array.isArray(item?.aliases)) fail('aliases must be an array');
    for (const id of [item?.id, ...(Array.isArray(item?.aliases) ? item.aliases : [])]) {
      if (!aliasIdentifier.test(id)) fail('invalid alias');
      if (identities.has(id)) fail(`duplicate identity/alias ${id}`);
      identities.set(id, item?.id);
    }
    for (const key of ['vendor', 'product', 'productKey', 'title', 'summary', 'dateNote']) if (!text(item?.[key])) fail(`missing ${key}`);
    if (text(item?.productKey) && !/^[a-z0-9][a-z0-9-]*$/.test(item.productKey)) fail('productKey must be a lowercase slug');
    if (!day(item?.publishedDate)) fail('invalid publishedDate');
    if (!day(item?.listedDate)) fail('invalid listedDate');
    else if (item.listedDate < meta.windowStart || item.listedDate > meta.windowEnd) fail('listing outside product coverage window');
    if (day(item?.publishedDate) && day(item?.listedDate) && item.listedDate < item.publishedDate) fail('listed before vendor publication');
    if (!text(item?.listedNote)) fail('missing listedNote');
    if (item?.publishedAt !== null && (!timestamp(item?.publishedAt) || item.publishedAt.slice(0, 10) !== item.publishedDate)) fail('publishedAt disagrees with publishedDate');
    if (!timestamp(item?.lastVerifiedAt)) fail("invalid lastVerifiedAt");
    if (item?.modifiedAt !== null && !timestamp(item?.modifiedAt)) fail("invalid modifiedAt");
    if (timestamp(item?.lastVerifiedAt)) {
      if (Date.parse(item.lastVerifiedAt) > Date.now() + 300000) fail('verification is in the future');
      if (item.lastVerifiedAt.slice(0, 10) > meta.lastVerifiedDate) fail('verification after coverage lastVerifiedDate');
      for (const key of ['publishedAt', 'modifiedAt', 'withdrawnAt']) if (timestamp(item?.[key]) && Date.parse(item[key]) > Date.parse(item.lastVerifiedAt)) fail(`${key} after verification`);
    }
    if (timestamp(item?.modifiedAt) && day(item?.publishedDate) && item.modifiedAt.slice(0, 10) < item.publishedDate) fail('modified before published');
    if (item?.withdrawnAt !== null && !timestamp(item?.withdrawnAt)) fail('invalid withdrawnAt');
    const cited = validateSources(item, fail);
    if (!cited(item?.dateSourceUrl)) fail('missing date source');
    const affected = Array.isArray(item?.affected) ? item.affected : [];
    if (!affected.length) fail('missing affected ranges');
    const names = new Set();
    for (const range of affected) {
      if (!range || typeof range !== 'object' || !text(range.name) || !text(range.affected) || (range.fixed !== null && !text(range.fixed)) || !cited(range.sourceUrl)) { fail('invalid or uncited affected/fixed range'); continue; }
      if (range.note !== undefined && !text(range.note)) fail('invalid range note');
      if (names.has(range.name)) fail('duplicate affected range name');
      names.add(range.name);
    }
    validateAssessment(item, cited, fail);
    validateAlerts(item, cited, fail);
    validateInclusion(item, fail);
    if (!Array.isArray(item?.mitigations) || item.mitigations.some(entry => !entry || !text(entry.text) || !cited(entry.sourceUrl))) fail('invalid or uncited mitigation');
    if (!Array.isArray(item?.caveats) || !item.caveats.length || !item.caveats.every(text)) fail('missing caveats');
  }
  return errors;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const records = loadProducts();
  const errors = validateProducts(records);
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log(JSON.stringify({ ok: true, products: records.length }, null, 2));
}
