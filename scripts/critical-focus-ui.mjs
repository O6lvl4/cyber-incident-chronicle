import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadVulnerabilities } from './vulnerability-status.mjs';
import { loadProducts } from './product-status.mjs';
const base = process.env.UI_URL ?? 'http://127.0.0.1:4173/';
const output = `${process.env.UI_OUTPUT ?? 'artifacts/ui'}/critical-focus`;
mkdirSync(output, { recursive: true });
const library = loadVulnerabilities();
const products = loadProducts();
const checks = [], errors = [], failures = [];
const check = (label, value) => { assert.ok(value, label); checks.push(label); };
// Independent oracles from source records; production filters are never reused here.
const libraryFocus = { critical: item => item.severity.label === 'critical', exploited: item => item.exploitation.status === 'reported', kev: item => item.kev.status === 'listed' };
libraryFocus.priority = item => libraryFocus.critical(item) || libraryFocus.exploited(item) || libraryFocus.kev(item);
const productFocus = { ...libraryFocus, alert: item => item.alerts.length > 0, poc: item => item.poc.status === 'public' };
const sortedProducts = [...products].sort((a, b) => b.listedDate.localeCompare(a.listedDate) || a.id.localeCompare(b.id));
async function waitFiltered(page, selector, count) {
  await page.waitForFunction(({ selector, count }) => Number(document.querySelector(selector)?.dataset.filtered) === count, { selector, count });
}
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  let browser;
  try {
    browser = await engine.launch(name === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    for (const [width, height] of [[1440, 980], [393, 851]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 641 });
      page.on('pageerror', e => errors.push(`${name}/${width}: ${e.message}`));
      // Library focus: counts are exact against the source corpus, and the URL carries the focus.
      for (const focus of ['critical', 'exploited', 'kev', 'priority']) {
        const expected = library.filter(item => !item.withdrawnAt && libraryFocus[focus](item));
        await page.goto(`${base}#${new URLSearchParams({ kind: 'vulnerability', view: 'list', focus })}`);
        await waitFiltered(page, '.vulnerability-app', expected.length);
        check(`${name}/${width}/library/${focus}: exact source-backed count`, Number(await page.locator('.vulnerability-app').getAttribute('data-filtered')) === expected.length);
        check(`${name}/${width}/library/${focus}: select reflects URL`, await page.getByRole('combobox', { name: '注目', exact: true }).inputValue() === focus);
        if (!expected.length) check(`${name}/${width}/library/${focus}: empty focus is explicit, not blank`, await page.locator('.empty-state').isVisible());
      }
      await page.getByRole('combobox', { name: '注目', exact: true }).selectOption('all');
      await waitFiltered(page, '.vulnerability-app', library.filter(item => !item.withdrawnAt).length);
      check(`${name}/${width}/library: clearing focus drops it from the URL`, !new URL(page.url()).hash.includes('focus='));
      await page.screenshot({ path: `${output}/${name}-${width}-library-critical.png` });
      // Product advisories: every record is listed with its retention reasons and both dates.
      await page.goto(`${base}#${new URLSearchParams({ kind: 'product', view: 'list' })}`);
      await waitFiltered(page, '.product-app', products.length);
      const rows = await page.locator('.product-card').all();
      check(`${name}/${width}/products: every record is a row in listed-day order`, rows.length === products.length && (await Promise.all(rows.map(row => row.getAttribute('data-product-id')))).join(',') === sortedProducts.map(item => item.id).join(','));
      for (const item of sortedProducts.slice(0, 5)) {
        const row = page.locator(`.product-card[data-product-id="${item.id}"]`);
        const text = await row.innerText();
        check(`${name}/${width}/products/${item.id}: listed day and severity visible`, text.includes(item.listedDate.replace(/-/g, '.')) && (await row.locator('.status-badge[data-severity]').getAttribute('data-severity')) === item.severity.label);
        const reasons = await row.locator('.status-badge[data-inclusion]').evaluateAll(nodes => nodes.map(node => node.dataset.inclusion).sort());
        check(`${name}/${width}/products/${item.id}: retention reasons match evidence`, reasons.join(',') === [...item.inclusion].sort().join(','));
        if (item.publishedDate !== item.listedDate) check(`${name}/${width}/products/${item.id}: vendor day shown when it differs`, text.includes(item.publishedDate.replace(/-/g, '.')));
      }
      for (const focus of ['alert', 'critical', 'exploited', 'kev', 'poc']) {
        const expected = products.filter(productFocus[focus]);
        await page.getByRole('combobox', { name: '収録理由', exact: true }).selectOption(focus);
        await waitFiltered(page, '.product-app', expected.length);
        check(`${name}/${width}/products/${focus}: exact count and URL`, Number(await page.locator('.product-app').getAttribute('data-filtered')) === expected.length && new URL(page.url()).hash.includes(`focus=${focus}`));
      }
      await page.getByRole('combobox', { name: '収録理由', exact: true }).selectOption('all');
      if (width >= 768) {
        await page.getByRole('button', { name: '深刻度・収録理由で並べ替え', exact: true }).click();
        await page.waitForFunction(() => new URL(location.href).hash.includes('productSort=severity-desc'));
        const rank = { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 };
        const shown = await page.locator('.product-card .status-badge[data-severity]').evaluateAll(nodes => nodes.map(node => node.dataset.severity));
        check(`${name}/${width}/products: severity column sorts the full list and lands in the URL`, shown.length === products.length && shown.every((level, index) => index === 0 || rank[shown[index - 1]] >= rank[level]));
        check(`${name}/${width}/products: active column exposes aria-sort`, await page.locator('[role="columnheader"][aria-sort="descending"] [data-sort-key="severity"]').count() === 1);
        await page.getByRole('button', { name: '深刻度・収録理由で並べ替え', exact: true }).click();
        await page.waitForFunction(() => new URL(location.href).hash.includes('productSort=severity-asc'));
        check(`${name}/${width}/products: second click flips direction and the select follows`, await page.getByRole('combobox', { name: '一覧の並び順', exact: true }).inputValue() === 'severity-asc');
        await page.getByRole('button', { name: '収録契機 / 開発元公表で並べ替え', exact: true }).click();
        await page.waitForFunction(() => !new URL(location.href).hash.includes('productSort='));
      }
      const productKey = sortedProducts[0].productKey;
      await page.getByRole('combobox', { name: '製品', exact: true }).selectOption(productKey);
      await waitFiltered(page, '.product-app', products.filter(item => item.productKey === productKey).length);
      check(`${name}/${width}/products: product filter is exact and shareable`, new URL(page.url()).hash.includes(`product=${productKey}`));
      await page.locator('.product-card').first().click();
      await page.locator('.drawer.open .product-detail').waitFor();
      const detail = await page.locator('.drawer.open').innerText();
      const opened = products.find(item => item.id === new URLSearchParams(new URL(page.url()).hash.slice(1)).get('sel'));
      check(`${name}/${width}/products: detail shows sources, KEV state, alerts and caveats`, !!opened && detail.includes('CISA KEV') && detail.includes('公的機関の注意喚起') && detail.includes('解釈上の注意') && detail.includes(opened.listedDate));
      const links = await page.locator('.drawer.open .sources a').evaluateAll(nodes => nodes.map(node => node.href));
      check(`${name}/${width}/products: every cited source is HTTPS`, links.length > 0 && links.every(link => link.startsWith('https://')));
      await page.screenshot({ path: `${output}/${name}-${width}-product-detail.png` });
      await page.keyboard.press('Escape');
      await page.getByRole('tab', { name: 'タイムライン', exact: true }).click();
      await page.locator('.tile-host .tile').first().waitFor();
      check(`${name}/${width}/products: timeline renders for the listed-day axis`, (await page.locator('.board-toolbar').innerText()).includes('収録契機'));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      check(`${name}/${width}/products: no horizontal overflow`, !overflow);
      await page.close();
    }
  } catch (error) { failures.push(`${name}: ${error.stack}`); }
  finally { await browser?.close(); }
}
writeFileSync(`${output}/results.json`, JSON.stringify({ checks, errors, failures }, null, 2));
assert.deepEqual(failures, []);
assert.deepEqual(errors, []);
console.log(`Critical focus UI: ${checks.length} checks passed in Chromium and WebKit`);
