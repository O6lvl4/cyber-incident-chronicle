import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadVulnerabilities } from './vulnerability-status.mjs';
const base = process.env.UI_URL ?? 'http://127.0.0.1:4173/';
const output = `${process.env.UI_OUTPUT ?? 'artifacts/ui'}/package-severity`;
mkdirSync(output, { recursive: true });
const source = loadVulnerabilities();
const levels = ['critical', 'high', 'medium', 'low', 'unknown'];
const check = (label, value) => { assert.ok(value, label); checks.push(label); };
const checks = [], errors = [], failures = [];
const unknown = { ...source.find(item => !item.withdrawnAt), id: 'GHSA-test-unknown-fixture', severity: { label: 'unknown' } };
const withdrawn = source.find(item => item.withdrawnAt && item.severity.label === 'high');
assert.ok(unknown && withdrawn);
// Independent oracle from full source records; never use production aggregators.
async function verifyRows(page, records, label) {
  const ecosystemFilter = new URL(page.url()).hash.slice(1);
  const ecosystem = new URLSearchParams(ecosystemFilter).get('ecosystem') ?? 'all';
  const expectedKeys = new Set(records.flatMap(item => item.affected.filter(pkg => ecosystem === 'all' || pkg.ecosystem === ecosystem).map(pkg => JSON.stringify([pkg.ecosystem, pkg.packageName]))));
  await page.waitForFunction(({ packages, advisories }) => {
    const list = document.querySelector('.package-list');
    return Number(list?.dataset.packageCount) === packages && Number(list?.dataset.advisoryCount) === advisories;
  }, { packages: expectedKeys.size, advisories: new Set(records.map(item => item.id)).size });
  await page.locator('.package-card').first().waitFor();
  const rows = await page.locator('.package-card').all();
  for (const row of rows) {
    const key = await row.getAttribute('data-package-key');
    check(`${label}: rendered coordinate belongs to filtered results`, expectedKeys.has(key));
    const [ecosystem, packageName] = JSON.parse(key);
    const recordsById = new Map(records.filter(item => item.affected.some(pkg => pkg.ecosystem === ecosystem && pkg.packageName === packageName)).map(item => [item.id, item]));
    const items = [...recordsById.values()];
    assert.ok(items.length);
    const counts = Object.fromEntries(levels.map(level => [level, items.filter(item => item.severity.label === level).length]));
    const highest = levels.find(level => counts[level]);
    check(`${label}/${packageName}: highest source severity is visible`, await row.locator('.package-severity .status-badge').getAttribute('data-severity') === highest && (await row.locator('.package-severity .status-badge').innerText()).includes(highest.toUpperCase()));
    for (const level of levels) {
      const count = row.locator(`[data-severity-count="${level}"]`);
      check(`${label}/${packageName}/${level}: exact filtered unique count`, counts[level] ? await count.locator('b').innerText() === counts[level].toLocaleString() : await count.count() === 0);
    }
    const latest = [...items].sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt))[0].modifiedAt;
    check(`${label}/${packageName}: update date matches current source`, await row.locator('.package-updated time').getAttribute('dateTime') === latest);
    const withdrawnCount = items.filter(item => item.withdrawnAt).length;
    check(`${label}/${packageName}: withdrawn history has exact count`, withdrawnCount ? await row.locator('.package-withdrawn').innerText() === `撤回済み ${withdrawnCount.toLocaleString()}件を含む` : await row.locator('.package-withdrawn').count() === 0);
    const overflow = await row.evaluate(node => node.scrollWidth > node.clientWidth + 1 || [...node.querySelectorAll('.package-severity, .package-identity, .package-dates')].some(child => { const a = child.getBoundingClientRect(), b = node.getBoundingClientRect(); return a.left < b.left || a.right > b.right + 1; }));
    check(`${label}/${packageName}: summary stays within row`, !overflow);
  }
}
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  let browser;
  try {
    browser = await engine.launch(name === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    for (const [width, height] of [[1440, 980], [393, 851], [320, 568]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 641 });
      page.on('pageerror', e => errors.push(e.message));
      const route = values => `${base}#${new URLSearchParams({ kind: 'vulnerability', view: 'list', ...values })}`;
      await page.goto(route({}));
      await verifyRows(page, source.filter(item => !item.withdrawnAt), `${name}/${width}/default`);
      await page.screenshot({ path: `${output}/${name}-${width}-default.png` });
      for (const lifecycle of ['active', 'all']) {
        const expected = source.filter(item => (lifecycle === 'all' || !item.withdrawnAt) && item.affected.some(pkg => pkg.ecosystem === 'npm') && [item.id, ...item.aliases, item.title, item.summary, ...item.affected.map(pkg => `${pkg.ecosystem} ${pkg.packageName}`)].join(' ').toLowerCase().includes('lodash'));
        assert.ok(expected.length > 1 && new Set(expected.map(item => item.severity.label)).size > 1, 'mixed-severity fixture');
        await page.goto(route({ q: 'lodash', ecosystem: 'npm', lifecycle }));
        await verifyRows(page, expected, `${name}/${width}/mixed-${lifecycle}`);
        await page.screenshot({ path: `${output}/${name}-${width}-mixed-${lifecycle}.png` });
      }
      const historyPackage = withdrawn.affected[0];
      const historyQuery = historyPackage.packageName.toLowerCase();
      for (const lifecycle of ['all', 'withdrawn']) {
        const expected = source.filter(item => (lifecycle === 'all' || !!item.withdrawnAt) && item.affected.some(pkg => pkg.ecosystem === historyPackage.ecosystem) && [item.id, ...item.aliases, item.title, item.summary, ...item.affected.map(pkg => `${pkg.ecosystem} ${pkg.packageName}`)].join(' ').toLowerCase().includes(historyQuery));
        await page.goto(route({ q: historyPackage.packageName, ecosystem: historyPackage.ecosystem, lifecycle }));
        await verifyRows(page, expected, `${name}/${width}/history-${lifecycle}`);
      }
      const yearRecord = source.find(item => !item.withdrawnAt && item.publishedAt.startsWith('2025') && item.affected.some(pkg => pkg.ecosystem === 'npm'));
      await page.goto(route({ q: yearRecord.id, ecosystem: 'npm', year: '2025' }));
      await verifyRows(page, [yearRecord], `${name}/${width}/year`);
      // The pinned corpus has no unknown ratings; exercise that supported state
      // through an isolated browse-index response fixture, never production data.
      await page.route('**/advisories/**/index.json?schema=2', async route => {
        const response = await route.fetch();
        const index = await response.json();
        index.records[0] = { ...index.records[0], id: unknown.id, aliases: [], severity: { label: 'unknown' }, withdrawnAt: null, affected: unknown.affected.map(({ ecosystem, packageName }) => ({ ecosystem, packageName })), publishedAt: unknown.publishedAt, modifiedAt: unknown.modifiedAt };
        await route.fulfill({ response, json: index });
      });
      await page.goto(route({ q: unknown.id }));
      await page.reload();
      await verifyRows(page, [unknown], `${name}/${width}/unknown`);
      check('unknown is visibly unverified', (await page.locator('.package-card').first().innerText()).includes('評価未確認'));
      await page.unroute('**/advisories/**/index.json?schema=2');
      await page.goto(route({ q: withdrawn.id, lifecycle: 'withdrawn' }));
      await page.reload();
      await verifyRows(page, [withdrawn], `${name}/${width}/withdrawn`);
      await page.screenshot({ path: `${output}/${name}-${width}-withdrawn.png` });
      await page.getByRole('combobox', { name: '撤回状況', exact: true }).selectOption('active');
      await page.locator('.empty-state').waitFor();
      check('active filter removes withdrawn severity and counts', await page.locator('.package-card').count() === 0);
      await page.close();
    }
  } catch (error) { failures.push(`${name}: ${error.stack}`); }
  finally { await browser?.close(); }
}
writeFileSync(`${output}/results.json`, JSON.stringify({ checks, errors, failures }, null, 2));
assert.deepEqual(failures, []);
assert.deepEqual(errors, []);
console.log(`Package severity UI: ${checks.length} checks passed in Chromium and WebKit`);
