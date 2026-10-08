import { chromium, devices } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadData } from './data-status.mjs';
const url = process.env.UI_URL ?? 'http://127.0.0.1:4173/';
const output = process.env.UI_OUTPUT ?? 'artifacts/ui';
mkdirSync(output, { recursive: true });
const data = loadData();
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const results = [];
const errors = [];
const check = (label, ok) => { assert.ok(ok, label); results.push(label); };
async function ready(page) {
  await page.getByRole('tab', { name: '一覧', exact: true }).waitFor();
  if (await page.getByRole('tab', { name: 'タイムライン', exact: true }).getAttribute('aria-selected') === 'true') await page.locator('.tile-host .tile').first().waitFor();
  else await page.locator('.incident-list').waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function noOverflow(page, label) {
  check(label, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
}
try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 980 }, colorScheme: 'light' });
  const page = await desktop.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto(url); await ready(page);
  check('desktop has all deduplicated incident cards', await page.locator('.incident-card').count() === data.incidents.length);
  check('desktop defaults to a mutually exclusive list', await page.getByRole('tab', { name: '一覧', exact: true }).getAttribute('aria-selected') === 'true' && !(await page.locator('.timeline-container').isVisible()));
  check('DuckDB is not loaded before SQL opens', !requests.some(request => /duckdb/.test(request)));
  await noOverflow(page, 'desktop has no page overflow');
  await page.screenshot({ path: `${output}/desktop-light.png`, fullPage: true });
  const possible = data.incidents.find(i => i.disclosureStatus === 'possible');
  await page.locator('.incident-card', { hasText: possible.title }).first().click();
  await page.locator('.drawer.open .incident-detail').waitFor();
  check('detail distinguishes possible leakage', (await page.locator('.drawer').innerText()).includes('流出の可能性'));
  check('detail includes geography, sources, caveats and verification date', (await page.locator('.drawer').innerText()).includes('対象地域・範囲') && (await page.locator('.drawer').innerText()).includes('解釈上の注意'));
  const sourceLinks = await page.locator('.drawer .sources a').evaluateAll(links => links.map(link => link.href));
  check('source links use official HTTPS documents', sourceLinks.length > 0 && sourceLinks.every(link => link.startsWith('https://')));
  await page.screenshot({ path: `${output}/desktop-detail.png`, fullPage: true });
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  for (let i = 0; i < 3; i++) { await page.locator('.incident-card').nth(i).click(); await page.keyboard.press('Escape'); }
  check('repeated open/close leaves no open drawer', await page.locator('.drawer.open').count() === 0);
  await page.getByRole('combobox', { name: '情報流出の確認状況' }).selectOption('confirmed');
  check('confirmed filter returns only confirmed incidents', await page.locator('.incident-card').count() === data.incidents.filter(i => i.disclosureStatus === 'confirmed').length);
  await page.getByRole('combobox', { name: '情報流出の確認状況' }).selectOption('all');
  await page.getByRole('textbox', { name: '企業名・事案を検索' }).fill('アスクル');
  check('company search is deduplicated', await page.locator('.incident-card').count() === 1);
  await page.locator('.incident-card').first().click(); await page.waitForTimeout(200);
  const sharedUrl = page.url(); await page.reload(); await ready(page);
  check('shared URL restores search and selected detail', await page.getByRole('textbox', { name: '企業名・事案を検索' }).inputValue() === 'アスクル' && await page.locator('.drawer.open').count() === 1);
  check('shared URL includes selected marker', sharedUrl.includes('sel='));
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByRole('textbox', { name: '企業名・事案を検索' }).fill('NO_MATCH_2026');
  check('search empty state is explicit', await page.locator('.empty-state').isVisible());
  await page.locator('.empty-state').getByRole('button').click(); await ready(page);
  for (const chip of await page.locator('.thread-chip').all()) await chip.click();
  check('all lanes can be disabled with a usable empty state', await page.locator('.empty-state').isVisible());
  await page.reload();
  check('empty lane state persists after reload', await page.locator('.thread-chip[aria-pressed="false"]').count() === 3);
  await page.locator('.empty-state').getByRole('button').click(); await ready(page);
  await page.getByRole('tab', { name: 'タイムライン', exact: true }).click(); await ready(page);
  check('timeline has a single lane and replaces the list', await page.locator('.lane-label').count() === 1 && !(await page.locator('.incident-list').isVisible()));
  for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: '拡大', exact: true }).click(); await page.getByRole('button', { name: '縮小', exact: true }).click(); }
  await page.getByRole('button', { name: '全期間', exact: true }).click(); await ready(page);
  await page.getByRole('button', { name: 'テーマ切替' }).click();
  check('theme toggle works', await page.locator('.app.dark').count() === 1);
  await page.screenshot({ path: `${output}/desktop-dark.png`, fullPage: true });
  await page.getByRole('button', { name: 'SQL', exact: true }).click();
  await page.locator('.db-status.ok').waitFor({ timeout: 30000 });
  await page.locator('.sql-result tbody tr').first().waitFor();
  check('SQL default table has unique incidents', await page.locator('.sql-result tbody tr').count() === data.incidents.length);
  for (const preset of await page.locator('.preset').all()) { await preset.click(); await page.waitForFunction(() => !document.querySelector('.sql-actions button').disabled); check('SQL preset executes: ' + await preset.innerText(), await page.locator('.sql-error').count() === 0); }
  await page.locator('.preset').first().click(); await page.waitForFunction(() => !document.querySelector('.sql-actions button').disabled);
  await page.locator('.sql-result tbody tr.clickable').first().click();
  check('SQL incident rows open detail', await page.locator('.drawer.open .incident-detail').isVisible());
  await desktop.close();
  const mobile = await browser.newContext({ ...devices['Pixel 5'], colorScheme: 'light' });
  const phone = await mobile.newPage(); phone.on('pageerror', error => errors.push(error.message));
  await phone.goto(url); await ready(phone); await noOverflow(phone, 'mobile has no page overflow');
  check('mobile defaults to list', await phone.getByRole('tab', { name: '一覧', exact: true }).getAttribute('aria-selected') === 'true' && !(await phone.locator('.timeline-container').isVisible()));
  check('mobile list shows all unique incident cards', await phone.locator('.incident-card:visible').count() === data.incidents.length);
  await phone.screenshot({ path: `${output}/mobile-list.png`, fullPage: true });
  await phone.locator('.incident-card').first().click();
  check('mobile detail sheet is visible', await phone.locator('.drawer.open').isVisible());
  await phone.screenshot({ path: `${output}/mobile-detail.png`, fullPage: true });
  await phone.getByRole('button', { name: '閉じる', exact: true }).click();
  await phone.getByRole('tab', { name: 'タイムライン', exact: true }).click(); await ready(phone);
  await phone.screenshot({ path: `${output}/mobile-timeline.png`, fullPage: true });
  await phone.getByRole('button', { name: '掲載方針', exact: true }).click();
  check('methodology explains source-date limitations', (await phone.locator('.drawer').innerText()).includes('事案の最初の発表日とは限りません'));
  await phone.getByRole('button', { name: '閉じる', exact: true }).click();
  await noOverflow(phone, 'mobile remains within viewport after sheet closes');
  check('no runtime JavaScript errors', errors.length === 0);
  await mobile.close();
  writeFileSync(`${output}/report.json`, JSON.stringify({ ok: true, checks: results, errors }, null, 2));
  console.log(`PASS ${results.length} UI checks; screenshots in ${output}`);
} finally { await browser.close(); }
