import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadVulnerabilities } from './vulnerability-status.mjs';
import { groupPackages } from '../src/lib/packageGroups.ts';
import { ADVISORY_PAGE_SIZE } from '../src/lib/pagination.ts';

const base = process.env.UI_URL ?? 'http://127.0.0.1:4173/';
const output = `${process.env.UI_OUTPUT ?? 'artifacts/ui'}/list-navigation`;
mkdirSync(output, { recursive: true });
const checks = [], errors = [], failures = [];
const check = (label, ok) => { assert.ok(ok, label); checks.push(label); };
const records = loadVulnerabilities();
const allGroups = groupPackages(records);
const abundant = [...allGroups].sort((a, b) => b.advisories.length - a.advisories.length)[0];
assert.ok(abundant.advisories.length > ADVISORY_PAGE_SIZE, 'real full-corpus fixture must span multiple advisory pages');
const abundantGroupPage = Math.floor(allGroups.findIndex(group => group.key === abundant.key) / ADVISORY_PAGE_SIZE);
const listTab = page => page.getByRole('tab', { name: '一覧', exact: true });
const timelineTab = page => page.getByRole('tab', { name: 'タイムライン', exact: true });
const groupPage = page => page.getByRole('combobox', { name: 'パッケージ一覧のページ', exact: true });
const issuePage = page => page.getByRole('combobox', { name: 'パッケージの脆弱性一覧のページ', exact: true });
const back = page => page.getByRole('button', { name: 'パッケージ一覧に戻る', exact: true });
const detailRequest = url => /\/advisories\/[a-f0-9]{64}\/[a-f0-9]{2}\.json/.test(url);
const route = state => { const target = new URL(base); target.hash = new URLSearchParams(state).toString(); return target.href; };
const focusPackage = (page, key) => page.waitForFunction(value => document.activeElement?.getAttribute('data-package-key') === value, key);
async function tabState(page, view, label) {
  const selected = view === 'list' ? listTab(page) : timelineTab(page);
  const inactive = view === 'list' ? timelineTab(page) : listTab(page);
  await page.waitForFunction(expected => new URLSearchParams(location.hash.slice(1)).get('view') === expected, view);
  check(`${label}: ${view} tab is selected`, await selected.getAttribute('aria-selected') === 'true' && await inactive.getAttribute('aria-selected') === 'false');
  check(`${label}: one tab participates in ordinary Tab navigation`, await selected.getAttribute('tabindex') === '0' && await inactive.getAttribute('tabindex') === '-1');
  check(`${label}: tab owns a labelled visible panel`, await selected.evaluate(node => {
    const panel = document.getElementById(node.getAttribute('aria-controls'));
    return panel?.getAttribute('role') === 'tabpanel' && panel.getAttribute('aria-labelledby') === node.id && panel.getBoundingClientRect().height > 0;
  }));
  check(`${label}: exactly one main panel is visible`, await page.locator('[role="tabpanel"]:visible').count() === 1);
  if (view === 'list') check(`${label}: list does not mount timeline workers or tiles`, await page.locator('.board').count() === 0 && await page.locator('.tile-host .tile').count() === 0);
  else { await page.locator('.tile-host .tile').first().waitFor(); check(`${label}: timeline does not show package or incident cards`, await page.locator('.incident-card:visible').count() === 0); }
}
async function screenshot(page, name) {
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  if (await timelineTab(page).getAttribute('aria-selected') === 'true') await page.waitForFunction(() => {
    const tiles = [...document.querySelectorAll('.tile-host .tile, .axis-tiles .tile')];
    return tiles.length > 0 && tiles.every(tile => window.__navigationPaintedTiles.has(tile)) && !document.querySelector('.tile-ghost .tile');
  });
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true, animations: 'disabled' });
}
async function prepare(page, label) {
  page.on('pageerror', error => errors.push(`${label}: ${error.message}`));
  await page.addInitScript(() => {
    window.__navigationPaintedTiles = new WeakSet();
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args) { const result = draw.apply(this, args); if (this.canvas.classList?.contains('tile')) window.__navigationPaintedTiles.add(this.canvas); return result; };
  });
}
async function tabsCase(browser, engine, viewport, category) {
  const label = `${engine} ${viewport.width}x${viewport.height} ${category}`;
  const page = await browser.newPage({ viewport, hasTouch: viewport.width <= 640, colorScheme: 'light', reducedMotion: 'reduce' });
  try {
    await prepare(page, label);
    await page.goto(route(category === 'vulnerability' ? { kind: category } : {}));
    await page.locator(category === 'vulnerability' ? '.package-card' : '.incident-card').first().waitFor();
    check(`${label}: two real tabs appear on desktop and mobile`, await page.getByRole('tablist', { name: '表示切替', exact: true }).getByRole('tab').count() === 2);
    await tabState(page, 'list', label);
    check(`${label}: default list remains within viewport`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await screenshot(page, `${engine}-${viewport.width}-${category}-list`);
    await listTab(page).focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'タイムライン');
    await tabState(page, 'timeline', label);
    await screenshot(page, `${engine}-${viewport.width}-${category}-timeline`);
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '一覧');
    await tabState(page, 'list', `${label} arrow wrap`);
    await page.keyboard.press('End'); await tabState(page, 'timeline', `${label} End`);
    await page.keyboard.press('Home'); await tabState(page, 'list', `${label} Home`);
    await page.keyboard.press('ArrowLeft'); await tabState(page, 'timeline', `${label} reverse wrap`);
    await page.keyboard.press('Tab');
    check(`${label}: Tab leaves the tablist for the chosen panel rather than inactive tab`, await page.evaluate(() => !document.activeElement?.closest('[role="tablist"]')));
    await page.goBack(); await tabState(page, 'list', `${label} browser Back`);
    await page.goForward(); await tabState(page, 'timeline', `${label} browser Forward`);
    await page.reload(); await tabState(page, 'timeline', `${label} reload`);
    await listTab(page).click(); await page.reload(); await tabState(page, 'list', `${label} list reload after timeline coordinates`);
  } catch (error) {
    failures.push({ label, error: error.stack });
    await page.screenshot({ path: `${output}/${engine}-${viewport.width}-${category}-failure.png`, fullPage: true }).catch(() => {});
  } finally { await page.close(); }
}
async function packagePagesCase(browser) {
  const label = 'full-corpus package and advisory pages';
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, colorScheme: 'light' });
  const requests = []; page.on('request', request => requests.push(request.url()));
  try {
    await prepare(page, label);
    await page.goto(route({ kind: 'vulnerability', view: 'list', lifecycle: 'all', packagePage: '100000' }));
    const lastGroupPage = Math.ceil(allGroups.length / ADVISORY_PAGE_SIZE) - 1;
    await page.waitForFunction(expected => document.querySelector('[aria-label="パッケージ一覧のページ"]')?.value === String(expected), lastGroupPage);
    check('out-of-range group page clamps to last valid page', await page.locator('.package-card').last().getAttribute('data-package-key') === allGroups.at(-1).key);
    await page.getByRole('textbox', { name: 'ライブラリ・脆弱性を検索' }).fill(abundant.advisories[0].id);
    await page.waitForFunction(() => document.querySelector('[aria-label="パッケージ一覧のページ"]')?.value === '0');
    check('query change resets clamped group page', await groupPage(page).inputValue() === '0');
    const lastIssuePage = Math.ceil(abundant.advisories.length / ADVISORY_PAGE_SIZE) - 1;
    await page.goto(route({ kind: 'vulnerability', view: 'list', lifecycle: 'all', pkg: abundant.key, packagePage: String(abundantGroupPage), page: '100000' }));
    await page.waitForFunction(expected => document.querySelector('[aria-label="パッケージの脆弱性一覧のページ"]')?.value === String(expected), lastIssuePage);
    check('out-of-range inline issue page clamps independently', await page.locator('.vulnerability-card').last().getAttribute('data-advisory-id') === abundant.advisories.at(-1).id);
    check('package count reflects unique advisory membership', Number(await page.locator('.package-advisory-list').getAttribute('data-filtered')) === abundant.advisories.length);
    await page.reload(); await issuePage(page).waitFor();
    check('reload restores package and clamped issue page', await issuePage(page).inputValue() === String(lastIssuePage) && await page.locator('.package-advisory-list').getAttribute('data-package-key') === abundant.key);
    await issuePage(page).selectOption('0');
    await page.getByRole('button', { name: 'パッケージの脆弱性一覧の次のページ', exact: true }).click();
    check('next issue page reaches the original source record at position 51', await page.locator('.vulnerability-card').first().getAttribute('data-advisory-id') === abundant.advisories[ADVISORY_PAGE_SIZE].id);
    check('inline issue list is bounded at fifty', await page.locator('.vulnerability-card').count() === Math.min(ADVISORY_PAGE_SIZE, abundant.advisories.length - ADVISORY_PAGE_SIZE));
    await screenshot(page, 'desktop-package-advisories-page-2');
    check('grouping, pagination and inline drill-in fetch neither detail shards nor SQL corpus', !requests.some(detailRequest) && !requests.some(value => value.includes('vulnerability-imported')));
    const opener = page.locator('.vulnerability-card').first();
    const selected = await opener.getAttribute('data-advisory-id');
    await opener.focus(); await opener.press('Enter'); await page.locator('.vulnerability-detail').waitFor();
    const expectedShard = createHash('sha256').update(selected).digest('hex').slice(0, 2);
    const detailRequests = requests.filter(detailRequest);
    check('selecting one issue fetches exactly its bounded detail shard', detailRequests.length === 1 && new URL(detailRequests[0]).pathname.endsWith(`/${expectedShard}.json`));
    check('detail loading still never fetches the 63-MiB SQL corpus', !requests.some(value => value.includes('vulnerability-imported')));
    await page.keyboard.press('Escape');
    await page.waitForFunction(id => document.activeElement?.getAttribute('data-advisory-id') === id, selected);
    check('closing drawer restores the correct issue on page two', await issuePage(page).inputValue() === '1');
    await timelineTab(page).click(); await tabState(page, 'timeline', label);
    await page.goBack(); await tabState(page, 'list', label);
    check('Back after view switch preserves the package and issue page', await page.locator('.package-advisory-list').getAttribute('data-package-key') === abundant.key && await issuePage(page).inputValue() === '1');
    await page.goForward(); await tabState(page, 'timeline', label);
    await page.goBack(); await tabState(page, 'list', label);
    await back(page).click(); await groupPage(page).waitFor();
    await focusPackage(page, abundant.key);
    check('returning to groups restores the correct group page and focused package', await groupPage(page).inputValue() === String(abundantGroupPage));
    await page.locator('.package-card').evaluateAll((cards, key) => cards.find(card => card.dataset.packageKey === key)?.click(), abundant.key);
    await issuePage(page).waitFor();
    // A fresh package drill-in starts from its first issue page, avoiding stale pages from another group.
    check('fresh package drill-in resets issue pagination', await issuePage(page).inputValue() === '0');
    await issuePage(page).selectOption('1');
    await page.getByRole('textbox', { name: 'ライブラリ・脆弱性を検索' }).fill(abundant.advisories[0].id);
    await page.waitForFunction(() => {
      const params = new URLSearchParams(location.hash.slice(1));
      return !params.has('page') && !params.has('packagePage');
    });
    check('changing filters resets both pagination coordinates', true);
    check('search results remain reachable after pagination reset', await page.locator('.package-card').count() > 0 || await page.locator('.vulnerability-card').count() === 1);
    check('all package navigation remains free of full-corpus SQL requests', !requests.some(value => value.includes('vulnerability-imported')));
  } catch (error) {
    failures.push({ label, error: error.stack });
    await page.screenshot({ path: `${output}/package-pagination-failure.png`, fullPage: true }).catch(() => {});
  } finally { await page.close(); }
}
for (const [engine, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
  let browser;
  try {
    browser = await browserType.launch(engine === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    for (const viewport of [{ width: 1440, height: 980 }, { width: 393, height: 851 }]) {
      for (const category of ['incident', 'vulnerability']) await tabsCase(browser, engine, viewport, category);
    }
    if (engine === 'chromium') await packagePagesCase(browser);
  } catch (error) { failures.push({ label: engine, error: error.stack }); }
  finally { await browser?.close(); }
}
writeFileSync(`${output}/results.json`, JSON.stringify({ ok: failures.length === 0 && errors.length === 0, checks, errors, failures }, null, 2));
for (const failure of failures) console.error(`${failure.label}: ${failure.error}`);
check('all list-navigation browser cases pass', failures.length === 0);
check('no list-navigation runtime errors', errors.length === 0);
console.log(`List navigation UI: ${checks.length} checks passed in Chromium and WebKit`);
