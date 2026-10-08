import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const url = process.env.UI_URL ?? 'http://127.0.0.1:4173/';
const checks = []; const errors = [];
const check = (label, result) => { assert.ok(result, label); checks.push(label); };
const output = `${process.env.UI_OUTPUT ?? 'artifacts/ui'}/classification-viewports`; mkdirSync(output, { recursive: true });
const waitForCount = (page, count) => page.waitForFunction(expected => document.querySelectorAll('.incident-card').length === expected, count);
try {
  for (const [width, height] of [[320, 568], [393, 851], [640, 360], [640, 800], [1440, 980]]) {
    const page = await browser.newPage({ viewport: { width, height }, colorScheme: 'light' });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await page.waitForSelector('.tile-host .tile');
    check(`${width}x${height}: classification controls collapsed by default`, (await page.locator('.classification-filters').getAttribute('open')) === null);
    check(`${width}x${height}: reset stays available`, await page.getByRole('button', { name: 'すべての絞り込みを解除' }).isVisible());
    check(`${width}x${height}: no collapsed page overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const baselineCount = await page.locator('.incident-card').count();
    const workspaceHeight = await page.locator('.workspace').evaluate(el => el.clientHeight);
    check(`${width}x${height}: timeline retains useful height`, workspaceHeight >= 300);
    await page.locator('.classification-filters summary').click();
    check(`${width}x${height}: all six classifications have visible labels`, await page.locator('.classification-field select:visible').count() === 6);
    check(`${width}x${height}: no expanded page overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (width <= 640) {
      check(`${width}x${height}: expanded mobile controls preserve timeline height`, await page.locator('.workspace').evaluate(el => el.clientHeight) === workspaceHeight);
      if (height <= 640) {
        await page.locator('.classification-field select').last().scrollIntoViewIfNeeded();
        const bounds = await page.locator('.classification-field select').last().boundingBox();
        check(`${width}x${height}: last filter can be reached by scrolling`, bounds.y >= 0 && bounds.y + bounds.height <= height);
      } else {
        const bounds = await page.locator('.classification-filter-body').boundingBox();
        check(`${width}x${height}: expanded panel fits viewport height`, bounds.y + bounds.height <= height);
      }
    }
    await page.getByRole('combobox', { name: '製造業の細分類', exact: true }).selectOption('food');
    await page.waitForFunction(() => document.querySelector('.classification-filter-count')?.textContent === '1条件');
    check(`${width}x${height}: subtype is usable without industry selection`, (await page.locator('.incident-card').count()) > 0 && (await page.locator('.incident-card').count()) < baselineCount);
    check(`${width}x${height}: active count exposed`, (await page.locator('.classification-filter-count').innerText()) === '1条件');
    await page.screenshot({ path: `${output}/${width}x${height}-filters-light.png`, fullPage: true });
    await page.getByRole('button', { name: 'テーマ切替' }).click();
    await page.locator('.app.dark').waitFor();
    check(`${width}x${height}: dark theme applies`, await page.locator('.app.dark').count() === 1);
    await page.screenshot({ path: `${output}/${width}x${height}-filters-dark.png`, fullPage: true });
    await page.locator('.classification-filters summary').click();
    await page.getByRole('button', { name: 'すべての絞り込みを解除' }).click();
    await waitForCount(page, baselineCount);
    check(`${width}x${height}: reset works while controls collapsed`, await page.locator('.incident-card').count() === baselineCount);
    check(`${width}x${height}: reset clears active badge`, (await page.locator('.classification-filter-count').innerText()) === '指定なし');
    await page.getByRole('textbox', { name: '企業名・事案を検索' }).fill('アサヒ');
    await page.waitForFunction(() => new URLSearchParams(location.hash.slice(1)).get('q') === 'アサヒ');
    if (width <= 640) await page.getByRole('button', { name: /事案一覧/ }).click();
    await page.locator('.incident-card').first().click();
    await page.locator('.drawer.open .classification-detail').waitFor();
    check(`${width}x${height}: entity facts are available`, await page.locator('.classification-entity').count() > 0);
    check(`${width}x${height}: independent attack/access statuses are displayed`, await page.locator('.classification-attack .classification-confidence').count() === 2);
    check(`${width}x${height}: original attack-method text preserved`, (await page.locator('.method-note').allTextContents()).some(text => text.startsWith('攻撃手法：')));
    const sources = await page.locator('.classification-sources a').evaluateAll(els => els.map(el => el.href));
    check(`${width}x${height}: source evidence links use HTTPS`, sources.length > 0 && sources.every(url => url.startsWith('https://')));
    await page.locator('.classification-detail').scrollIntoViewIfNeeded();
    check(`${width}x${height}: detail has no horizontal overflow`, await page.locator('.drawer-content').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await page.screenshot({ path: `${output}/${width}x${height}-detail-dark.png`, fullPage: true });
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    await page.getByRole('button', { name: 'すべての絞り込みを解除' }).click();
    await waitForCount(page, baselineCount);
    check(`${width}x${height}: all incident filters reset search`, await page.getByRole('textbox', { name: '企業名・事案を検索' }).inputValue() === '');
    await page.getByRole('button', { name: 'ライブラリの脆弱性', exact: true }).click();
    await page.getByLabel('ライブラリ・脆弱性を検索').waitFor();
    check(`${width}x${height}: vulnerability view has no incident classification controls`, await page.locator('.classification-controls').count() === 0);
    await page.close();
  }
  check('no runtime JavaScript errors', errors.length === 0);
  writeFileSync(`${output}/results.json`, JSON.stringify({ ok: true, checks, errors }, null, 2));
  console.log(`Classification viewport UI: ${checks.length} checks passed`);
} catch (error) {
  for (const [index, page] of browser.contexts().flatMap(context => context.pages()).entries()) {
    await page.screenshot({ path: `${output}/failure-${index}.png`, fullPage: true }).catch(() => {});
  }
  throw error;
} finally { await browser.close(); }
