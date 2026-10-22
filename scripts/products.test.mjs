import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProducts, loadProductMeta, validateProducts } from './product-status.mjs';
import { filterProducts, projectProducts, productFixLabel, normalizeProductFocus } from '../src/lib/products.ts';
import { sortProducts, normalizeProductSort } from '../src/lib/browseSort.ts';
import { readUrl, writeUrl } from '../src/lib/urlState.ts';
const records = loadProducts();
const meta = loadProductMeta();
const critical = records.find(item => item.inclusion.includes('critical') && item.kev.status === 'notListed');
const listed = records.find(item => item.kev.status === 'listed' && item.listedDate !== item.publishedDate);
const alerted = records.find(item => item.inclusion.includes('alert'));
assert.ok(critical && listed && alerted, 'fixtures for each retention reason exist');

test('all product advisories pass evidence validation and sit inside the coverage window', () => {
  assert.ok(records.length >= 4);
  assert.deepEqual(validateProducts(records, meta), []);
  assert.ok(records.every(item => item.kind === 'product' && item.listedDate >= meta.windowStart && item.listedDate <= meta.windowEnd));
  assert.ok(records.every(item => item.inclusion.length > 0));
});
test('every retention reason must be backed by its evidence field', () => {
  const a = structuredClone(critical); a.inclusion = ['kev'];
  assert.match(validateProducts([a], meta).join(' '), /kev inclusion without KEV listing/);
  const b = structuredClone(critical); b.inclusion = ['exploited'];
  assert.match(validateProducts([b], meta).join(' '), /exploited inclusion without exploitation evidence/);
  const c = structuredClone(critical); c.inclusion = ['alert']; c.alerts = [];
  assert.match(validateProducts([c], meta).join(' '), /alert inclusion without an alert/);
  const d = structuredClone(critical); d.inclusion = [];
  assert.match(validateProducts([d], meta).join(' '), /missing inclusion reason/);
  const e = structuredClone(critical); e.severity.label = 'high';
  assert.match(validateProducts([e], meta).join(' '), /critical inclusion without critical severity/);
});
test('a critical severity, KEV listing or alert cannot be silently left out of the inclusion list', () => {
  const a = structuredClone(critical); a.inclusion = a.inclusion.filter(reason => reason !== 'critical');
  assert.match(validateProducts([a], meta).join(' '), /critical severity must be declared/);
  const b = structuredClone(listed); b.inclusion = b.inclusion.filter(reason => reason !== 'kev');
  assert.match(validateProducts([b], meta).join(' '), /KEV listing must be declared/);
});
test('listed date is an evidence date, never a chosen date, and never precedes vendor disclosure', () => {
  const a = structuredClone(listed); a.listedDate = '2026-10-03';
  assert.match(validateProducts([a], meta).join(' '), /listedDate is not an evidence date/);
  const b = structuredClone(critical); b.listedDate = '2020-01-01';
  assert.match(validateProducts([b], meta).join(' '), /listing outside product coverage window/);
  const c = structuredClone(critical); c.publishedDate = '2026-10-22'; c.publishedAt = null;
  assert.match(validateProducts([c], meta).join(' '), /listed before vendor publication|listedDate is not an evidence date/);
});
test('KEV listing needs CISA evidence, an added date and a check time; unknown needs none', () => {
  const a = structuredClone(listed); delete a.kev.addedDate;
  assert.match(validateProducts([a], meta).join(' '), /KEV listing requires addedDate/);
  const b = structuredClone(listed); b.kev.sourceUrl = b.sources.find(source => source.type === 'maintainer').url;
  assert.match(validateProducts([b], meta).join(' '), /KEV requires CISA evidence/);
  const c = structuredClone(critical); c.kev = { status: 'unknown', checkedAt: null, sourceUrl: null, addedDate: '2026-10-01' };
  assert.match(validateProducts([c], meta).join(' '), /addedDate requires KEV listing/);
});
test('uncited ranges, severity, exploitation, alerts and mitigations are rejected', () => {
  const item = structuredClone(alerted);
  item.affected[0].sourceUrl = 'https://example.com/not-cited'; item.severity.sourceUrl = 'https://example.com/not-cited';
  item.alerts[0].url = 'https://example.com/not-cited'; item.mitigations = [{ text: 'x', sourceUrl: 'https://example.com/not-cited' }];
  const errors = validateProducts([item], meta).join(' ');
  for (const phrase of ['invalid or uncited affected/fixed range', 'uncited severity', 'invalid or uncited alert', 'invalid or uncited mitigation']) assert.ok(errors.includes(phrase), phrase);
  const exploited = structuredClone(listed); exploited.exploitation = { status: 'reported', sourceUrl: 'https://example.com/not-cited' };
  assert.match(validateProducts([exploited], meta).join(' '), /uncited exploitation/);
  assert.doesNotThrow(() => validateProducts([null, {}], meta));
});
test('duplicate identities across records and aliases are rejected', () => {
  const a = structuredClone(critical); const b = structuredClone(listed); b.aliases.push(a.id);
  assert.match(validateProducts([a, b], meta).join(' '), /duplicate identity\/alias/);
});
test('filters narrow by product, retention reason, year and search without inventing matches', () => {
  assert.deepEqual(filterProducts(records).map(item => item.id), [...records].sort((a, b) => b.listedDate.localeCompare(a.listedDate) || a.id.localeCompare(b.id)).map(item => item.id));
  assert.ok(filterProducts(records, { productKey: critical.productKey }).every(item => item.productKey === critical.productKey));
  assert.ok(filterProducts(records, { focus: 'kev' }).every(item => item.kev.status === 'listed'));
  assert.ok(filterProducts(records, { focus: 'critical' }).every(item => item.severity.label === 'critical'));
  assert.ok(filterProducts(records, { focus: 'exploited' }).every(item => item.exploitation.status === 'reported'));
  assert.ok(filterProducts(records, { focus: 'alert' }).every(item => item.alerts.length > 0));
  assert.equal(filterProducts(records, { focus: 'alert' }).length, records.filter(item => item.inclusion.includes('alert')).length);
  assert.equal(filterProducts(records, { query: critical.id.toLowerCase() }).length, 1);
  assert.equal(filterProducts(records, { query: 'no-such-product-zzz' }).length, 0);
  assert.equal(filterProducts(records, { year: '1999' }).length, 0);
  assert.equal(normalizeProductFocus('bogus'), 'all');
});
test('timeline markers use the listed day, one per record, and fix labels never invent a fix', () => {
  const events = projectProducts(records);
  assert.equal(events.length, records.length);
  assert.ok(events.every(event => event.threadId === 'products' && event.weight === 2));
  const byId = new Map(records.map(item => [item.id, item]));
  assert.ok(events.every(event => event.date === byId.get(event.id).listedDate));
  const item = structuredClone(critical);
  for (const range of item.affected) range.fixed = null;
  assert.equal(productFixLabel(item), '修正版未確認');
  item.affected[0].fixed = '1.0';
  assert.equal(productFixLabel(item), item.affected.length > 1 ? '一部に修正版' : '修正版あり');
});
test('product sorts keep unknown severities last and default to the listed day', () => {
  assert.equal(normalizeProductSort('bogus'), 'listed-desc');
  const bySeverity = sortProducts(records, 'severity-desc');
  const ranks = bySeverity.map(item => ({ critical: 4, high: 3, medium: 2, low: 1, unknown: null }[item.severity.label]));
  const known = ranks.filter(rank => rank !== null);
  assert.deepEqual(known, [...known].sort((a, b) => b - a));
  assert.ok(ranks.lastIndexOf(null) === -1 || ranks.indexOf(null) > known.length - 1);
  const byListed = sortProducts(records, 'listed-asc');
  assert.deepEqual(byListed.map(item => item.listedDate), [...byListed.map(item => item.listedDate)].sort());
});
test('product category, product filter, focus and sort round-trip through the URL hash', () => {
  globalThis.location = { hash: '' }; globalThis.history = { replaceState: (_a, _b, value) => { location.hash = value; }, pushState: (_a, _b, value) => { location.hash = value; } };
  writeUrl({ kind: 'product', product: 'php', focus: 'alert', productSort: 'severity-desc', query: 'PHP', sel: critical.id, dark: true, view: 'list' });
  const read = readUrl();
  assert.equal(read.kind, 'product'); assert.equal(read.product, 'php'); assert.equal(read.focus, 'alert'); assert.equal(read.productSort, 'severity-desc'); assert.equal(read.sel, critical.id);
  writeUrl({ kind: 'product', product: 'all', focus: 'all', productSort: 'listed-desc', view: 'list' });
  assert.equal(location.hash, '#view=list&kind=product');
  location.hash = '#kind=product&product=Bad%20Key&focus=NOPE&productSort=count-desc';
  assert.equal(readUrl().product, undefined); assert.equal(readUrl().focus, undefined); assert.equal(readUrl().productSort, 'listed-desc');
});
