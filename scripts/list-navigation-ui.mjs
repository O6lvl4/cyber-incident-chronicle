import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadVulnerabilities } from './vulnerability-status.mjs';
import { PACKAGE_SCROLL, ADVISORY_SCROLL, assertVirtualRecords, seekVirtualIndex, settleVirtualList, sourcePackageGroups, visibleVirtualAnchor } from './virtual-list-helpers.mjs';

const base = process.env.UI_URL ?? 'http://127.0.0.1:4173/';
const output = `${process.env.UI_OUTPUT ?? 'artifacts/ui'}/list-navigation`;
mkdirSync(output, { recursive: true });
const checks = [], errors = [], failures = [];
const check = (label, ok) => { assert.ok(ok, label); checks.push(label); };
const records = loadVulnerabilities();
const allGroups = sourcePackageGroups(records);
const abundant = [...allGroups].sort((a, b) => b.advisories.length - a.advisories.length)[0];
assert.ok(abundant.advisories.length > 100, 'real full-corpus fixture must exceed former page boundaries');
const abundantGroupIndex = allGroups.findIndex(group => group.key === abundant.key);
const listTab = page => page.getByRole('tab', { name: '一覧', exact: true });
const timelineTab = page => page.getByRole('tab', { name: 'タイムライン', exact: true });
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
    if (category === 'vulnerability') {
      const scopedPackage = await page.locator('.package-card').first().getAttribute('data-package-key');
      await page.locator('.package-card').first().click();
      await page.locator('.package-advisory-list').waitFor();
      await listTab(page).focus();
      await page.keyboard.press('ArrowRight'); await tabState(page, 'timeline', `${label} scoped package`);
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'タイムライン');
      await page.keyboard.press('ArrowRight'); await tabState(page, 'list', `${label} scoped package arrow wrap`);
      // Let both the tab focus and the package heading restoration frames run.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      check(`${label}: scoped heading restoration does not steal list tab focus`, await listTab(page).evaluate(tab => document.activeElement === tab));
      check(`${label}: keyboard view changes retain the selected package`, await page.locator('.package-advisory-list').getAttribute('data-package-key') === scopedPackage);
      await page.keyboard.press('End'); await tabState(page, 'timeline', `${label} scoped package subsequent End`);
      await page.keyboard.press('Home'); await tabState(page, 'list', `${label} scoped package Home`);
    }
  } catch (error) {
    failures.push({ label, error: error.stack });
    await page.screenshot({ path: `${output}/${engine}-${viewport.width}-${category}-failure.png`, fullPage: true }).catch(() => {});
  } finally { await page.close(); }
}
async function packageScrollCase(browser, engine, viewport) {
  const label = `${engine} ${viewport.width}px full-corpus continuous package and advisory lists`;
  const page = await browser.newPage({ viewport, hasTouch: viewport.width <= 640, colorScheme: 'light', reducedMotion: 'reduce' });
  const requests = []; page.on('request', request => requests.push(request.url()));
  const groupKeys = allGroups.map(group => group.key), issueKeys = abundant.advisories.map(item => item.id);
  const scrollOffset = selector => page.locator(selector).evaluate(node => node.scrollTop);
  try {
    await prepare(page, label);
    await page.goto(route({ kind: 'vulnerability', view: 'list', lifecycle: 'all', packagePage: '100000' }));
    await page.waitForFunction(key => [...document.querySelectorAll('.package-card')].some(card => card.dataset.packageKey === key), allGroups.at(-1).key);
    check(`${label}: out-of-range legacy package page reaches the last source record`, await scrollOffset(PACKAGE_SCROLL) > 0);
    await assertVirtualRecords(page, PACKAGE_SCROLL, groupKeys, '.package-card', 'data-package-key');
    await page.getByRole('textbox', { name: 'ライブラリ・脆弱性を検索' }).fill(abundant.advisories[0].id);
    await page.waitForFunction(() => document.querySelector('[data-package-scroll="packages"]')?.scrollTop === 0);
    check(`${label}: search from a legacy deep position resets scroll`, await page.locator('.package-card').count() > 0);
    await page.goto(route({ kind: 'vulnerability', view: 'list', lifecycle: 'all', pkg: abundant.key, page: '100000' }));
    await page.waitForFunction(id => [...document.querySelectorAll('.vulnerability-card')].some(card => card.dataset.advisoryId === id), issueKeys.at(-1));
    check(`${label}: out-of-range legacy issue page reaches the last source issue`, await scrollOffset(ADVISORY_SCROLL) > 0);
    check(`${label}: package count reflects unique advisory membership`, Number(await page.locator('.package-advisory-list').getAttribute('data-filtered')) === issueKeys.length);
    await assertVirtualRecords(page, ADVISORY_SCROLL, issueKeys, '.vulnerability-card', 'data-advisory-id');
    await page.waitForFunction(() => { const params = new URLSearchParams(location.hash.slice(1)); return !params.has('page') && !params.has('packagePage'); });
    await page.reload(); await page.locator('.vulnerability-card').first().waitFor();
    check(`${label}: cleaned legacy link reloads the same package without page controls`, await page.locator('.package-advisory-list').getAttribute('data-package-key') === abundant.key && await page.locator('.research-list .result-pagination').count() === 0);

    await page.goto(route({ kind: 'vulnerability', view: 'list', lifecycle: 'all' }));
    await page.locator('.package-card').first().waitFor();
    const groupOpener = await seekVirtualIndex(page, PACKAGE_SCROLL, abundantGroupIndex, { align: 'center' });
    await assertVirtualRecords(page, PACKAGE_SCROLL, groupKeys, '.package-card', 'data-package-key');
    check(`${label}: deep group is the exact source package`, await groupOpener.getAttribute('data-package-key') === abundant.key);
    await screenshot(page, `${engine}-${viewport.width}-packages-deep`);
    await groupOpener.focus();
    const groupAnchor = await visibleVirtualAnchor(page, PACKAGE_SCROLL);
    await groupOpener.press('Enter'); await page.locator('.vulnerability-card').first().waitFor();
    check(`${label}: fresh package drill-in starts with its newest advisory`, await page.locator('.vulnerability-card').first().getAttribute('data-advisory-id') === issueKeys[0]);
    for (const [name, index] of [['former-boundary', 50], ['middle', Math.floor(issueKeys.length / 2)], ['end', issueKeys.length - 1]]) {
      const target = await seekVirtualIndex(page, ADVISORY_SCROLL, index);
      check(`${label}: ${name} advisory is the exact source record`, await target.getAttribute('data-advisory-id') === issueKeys[index]);
      await assertVirtualRecords(page, ADVISORY_SCROLL, issueKeys, '.vulnerability-card', 'data-advisory-id');
      await screenshot(page, `${engine}-${viewport.width}-package-advisories-${name}`);
    }
    check(`${label}: grouping and deep continuous scrolling fetch no detail shards or SQL corpus`, !requests.some(detailRequest) && !requests.some(value => value.includes('vulnerability-imported')));
    const selectedIndex = Math.floor(issueKeys.length / 2), selected = issueKeys[selectedIndex];
    const opener = await seekVirtualIndex(page, ADVISORY_SCROLL, selectedIndex, { align: 'center' });
    await opener.focus(); const issueOffset = await scrollOffset(ADVISORY_SCROLL);
    const issueAnchor = await visibleVirtualAnchor(page, ADVISORY_SCROLL);
    await opener.press('Enter'); await page.locator('.vulnerability-detail').waitFor();
    const expectedShard = createHash('sha256').update(selected).digest('hex').slice(0, 2);
    const detailRequests = requests.filter(detailRequest);
    check(`${label}: selecting one issue fetches exactly its bounded detail shard`, detailRequests.length === 1 && new URL(detailRequests[0]).pathname.endsWith(`/${expectedShard}.json`));
    check(`${label}: detail loading never fetches the 63-MiB SQL corpus`, !requests.some(value => value.includes('vulnerability-imported')));
    await page.keyboard.press('Escape');
    await page.waitForFunction(id => document.activeElement?.getAttribute('data-advisory-id') === id, selected);
    await settleVirtualList(page);
    check(`${label}: drawer close preserves deep scroll and restores the exact issue focus`, Math.abs(await scrollOffset(ADVISORY_SCROLL) - issueOffset) <= 2);
    await timelineTab(page).click(); await tabState(page, 'timeline', label);
    await page.goBack(); await tabState(page, 'list', label); await settleVirtualList(page);
    const restoredIssue = await visibleVirtualAnchor(page, ADVISORY_SCROLL);
    check(`${label}: browser Back after view switch preserves package and visible issue anchor`, await page.locator('.package-advisory-list').getAttribute('data-package-key') === abundant.key && restoredIssue?.key === issueAnchor?.key && Math.abs(restoredIssue.offset - issueAnchor.offset) <= 2);
    await page.goForward(); await tabState(page, 'timeline', label);
    await page.goBack(); await tabState(page, 'list', label);
    await back(page).click(); await page.locator(PACKAGE_SCROLL).waitFor(); await focusPackage(page, abundant.key); await settleVirtualList(page);
    const restoredGroup = await visibleVirtualAnchor(page, PACKAGE_SCROLL);
    check(`${label}: package Back restores exact deep group anchor and focus`, restoredGroup?.key === groupAnchor?.key && Math.abs(restoredGroup.offset - groupAnchor.offset) <= 2);
    await page.locator('.package-card').evaluateAll((cards, key) => cards.find(card => card.dataset.packageKey === key)?.click(), abundant.key);
    await page.locator(ADVISORY_SCROLL).waitFor(); await settleVirtualList(page);
    check(`${label}: fresh drill-in resets issue scroll`, await scrollOffset(ADVISORY_SCROLL) === 0);
    await seekVirtualIndex(page, ADVISORY_SCROLL, issueKeys.length - 1);
    await page.getByRole('textbox', { name: 'ライブラリ・脆弱性を検索' }).fill(issueKeys.at(-1));
    await page.waitForFunction(() => {
      const scroll = document.querySelector('[data-virtual-count]');
      return scroll && Number(scroll.dataset.virtualCount) > 0 && scroll.scrollTop === 0;
    });
    if (await page.locator('.package-card').count()) { await page.locator('.package-card').first().click(); await page.locator('.vulnerability-card').waitFor(); }
    check(`${label}: full-corpus search finds the exact issue beyond the old page boundary`, await page.locator('.vulnerability-card').count() === 1 && await page.locator('.vulnerability-card').getAttribute('data-advisory-id') === issueKeys.at(-1));
    check(`${label}: all package navigation remains free of full-corpus SQL requests`, !requests.some(value => value.includes('vulnerability-imported')));
  } catch (error) {
    failures.push({ label, error: error.stack });
    await page.screenshot({ path: `${output}/${engine}-${viewport.width}-continuous-navigation-failure.png`, fullPage: true }).catch(() => {});
  } finally { await page.close(); }
}
for (const [engine, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
  let browser;
  try {
    browser = await browserType.launch(engine === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    for (const viewport of [{ width: 1440, height: 980 }, { width: 393, height: 851 }]) {
      for (const category of ['incident', 'vulnerability']) await tabsCase(browser, engine, viewport, category);
    }
    for (const viewport of [{ width: 1440, height: 980 }, { width: 393, height: 851 }]) await packageScrollCase(browser, engine, viewport);
  } catch (error) { failures.push({ label: engine, error: error.stack }); }
  finally { await browser?.close(); }
}
writeFileSync(`${output}/results.json`, JSON.stringify({ ok: failures.length === 0 && errors.length === 0, checks, errors, failures }, null, 2));
for (const failure of failures) console.error(`${failure.label}: ${failure.error}`);
check('all list-navigation browser cases pass', failures.length === 0);
check('no list-navigation runtime errors', errors.length === 0);
console.log(`List navigation UI: ${checks.length} checks passed in Chromium and WebKit`);
