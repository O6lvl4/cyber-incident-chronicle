import { webkit, devices } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const output = `${process.env.UI_OUTPUT ?? 'artifacts/ui'}/mobile-webkit`;
mkdirSync(output, { recursive: true });
const browser = await webkit.launch();
const url = process.env.UI_URL ?? 'http://127.0.0.1:4173/';
const checks = [];
const errors = [];
const check = (label, ok) => { assert.ok(ok, label); checks.push(label); };
try {
  for (const [width, height] of [[393, 851], [320, 568], [640, 360]]) {
    const page = await browser.newPage({ ...devices['iPhone 13'], viewport: { width, height } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.waitForSelector('.tile-host .tile');
    check(`${width}: timeline default preserved`, await page.getByRole('button', { name: 'タイムライン', exact: true }).getAttribute('aria-pressed') === 'true');
    await page.locator('.classification-toggle').tap();
    await page.locator('.classification-dialog[open]').waitFor();
    await page.getByLabel('製造業の細分類', { exact: true }).selectOption('food');
    const results = page.getByRole('button', { name: '4件の結果を見る', exact: true });
    await results.waitFor();
    const box = await results.boundingBox();
    check(`${width}: result CTA remains inside viewport`, box && box.y >= 0 && box.y + box.height <= height + 1);
    await page.screenshot({ path: `${output}/${width}x${height}-filter.png`, fullPage: true });
    await results.tap();
    await page.waitForFunction(() => !document.querySelector('.classification-dialog[open]'));
    await page.waitForFunction(() => document.activeElement?.id === 'incident-timeline-results');
    check(`${width}: result action preserves timeline choice`, await page.getByRole('button', { name: 'タイムライン', exact: true }).getAttribute('aria-pressed') === 'true');
    await page.getByRole('button', { name: '事案一覧 (4)', exact: true }).tap();
    await page.locator('.incident-card').first().waitFor({ state: 'visible' });
    await page.screenshot({ path: `${output}/${width}x${height}-results.png`, fullPage: true });
    await page.getByRole('button', { name: '製造業の細分類：食品・飲料の条件を解除', exact: true }).tap();
    await page.waitForFunction(() => document.querySelectorAll('.incident-card').length === 95);
    check(`${width}: chip removal restores all records`, await page.locator('.classification-chip').count() === 0);
    await page.locator('.classification-toggle').tap();
    await page.locator('.classification-dialog[open]').waitFor();
    await page.getByRole('button', { name: '絞り込みを閉じる', exact: true }).tap();
    await page.waitForFunction(() => document.activeElement?.classList.contains('classification-toggle'));
    check(`${width}: touch dismissal restores opener focus`, await page.locator('.classification-dialog[open]').count() === 0);
    check(`${width}: page has no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.close();
  }
  check('no WebKit runtime errors', errors.length === 0);
  writeFileSync(`${output}/results.json`, JSON.stringify({ checks, errors }, null, 2));
  console.log(`Mobile WebKit: ${checks.length} checks passed`);
} catch (error) {
  for (const [index, page] of browser.contexts().flatMap(context => context.pages()).entries()) {
    await page.screenshot({ path: `${output}/failure-${index}.png`, fullPage: true }).catch(() => {});
  }
  throw error;
} finally { await browser.close(); }
