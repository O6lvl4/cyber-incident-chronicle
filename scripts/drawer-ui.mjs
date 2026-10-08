import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadData } from './data-status.mjs';
import { loadVulnerabilities } from './vulnerability-status.mjs';

const url = process.env.UI_URL ?? 'http://127.0.0.1:4173/';
const output = `${process.env.UI_OUTPUT ?? 'artifacts/ui'}/drawer`;
mkdirSync(output, { recursive: true });
const checks = [], errors = [], failures = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); };
// Exercise genuine long records, including their evidence, rather than injecting filler.
const longest = records => [...records].sort((a, b) => JSON.stringify(b).length - JSON.stringify(a).length)[0];
const incidents = loadData().incidents;
const vulnerabilities = loadVulnerabilities();
const categories = [
  { kind: 'incident', records: incidents, item: longest(incidents), card: '.incident-card', detail: '.incident-detail', query: '企業名・事案を検索', tab: '企業のインシデント', list: /^事案一覧/ },
  { kind: 'vulnerability', records: vulnerabilities, item: longest(vulnerabilities), card: '.vulnerability-card', detail: '.vulnerability-detail', query: 'ライブラリ・脆弱性を検索', tab: 'ライブラリの脆弱性', list: /^脆弱性一覧/ },
];
const drawer = page => page.locator('.drawer.open');
const body = page => drawer(page).locator('.drawer-content');
const close = page => drawer(page).locator('.drawer-close');
const route = (category, extra = {}) => {
  const target = new URL(url);
  target.hash = new URLSearchParams({ ...(category.kind === 'vulnerability' ? { kind: category.kind } : {}), ...extra }).toString();
  return target.href;
};
async function settled(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('.drawer.open')].flatMap(node => node.getAnimations()).map(animation => animation.finished.catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
async function prepare(page, label) {
  page.on('pageerror', error => errors.push(`${label}: ${error.message}`));
  await page.addInitScript(() => {
    window.__drawerPaintedTiles = new WeakSet();
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args) {
      const result = drawImage.apply(this, args);
      if (this.canvas.classList?.contains('tile')) window.__drawerPaintedTiles.add(this.canvas);
      return result;
    };
  });
}
async function ready(page, category) {
  await page.waitForFunction(({ selector, count }) => document.querySelectorAll(selector).length === count,
    { selector: category.card, count: category.records.length });
  await page.locator('.tile-host .tile').first().waitFor({ state: 'attached' });
  if (page.viewportSize().width <= 640) await page.getByRole('button', { name: category.list }).click();
  await settled(page);
}
async function openItem(page, category) {
  const opener = page.locator(category.card).filter({ has: page.locator('.incident-card-title', { hasText: category.item.title }) }).first();
  await opener.scrollIntoViewIfNeeded();
  // A keyboard opener gives a defined focus target on both Chromium and Safari.
  await opener.focus();
  await opener.press('Enter');
  await page.waitForFunction(() => document.querySelector('.drawer.open')?.matches(':modal'));
  await drawer(page).locator(category.detail).waitFor();
  await settled(page);
  return opener;
}
async function closed(page, opener) {
  await drawer(page).waitFor({ state: 'hidden' });
  if (opener) {
    await page.waitForFunction(node => document.activeElement === node, await opener.elementHandle());
  }
}
async function screenshot(page, name) {
  await page.waitForFunction(() => [...document.querySelectorAll('.tile-host .tile, .axis-tiles .tile')]
    .filter(tile => tile.getBoundingClientRect().width > 0 && tile.getBoundingClientRect().height > 0)
    .every(tile => window.__drawerPaintedTiles.has(tile))
    && document.querySelectorAll('.tile-ghost .tile').length === 0);
  await settled(page);
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true, animations: 'disabled' });
}
async function phoneLayout(page) {
  const { width, height } = page.viewportSize();
  return width <= 640 || (width <= 900 && height <= 500 && await page.evaluate(() => matchMedia('(pointer: coarse)').matches));
}
async function bounds(page, label) {
  const { width, height } = page.viewportSize();
  const box = await drawer(page).boundingBox();
  check(`${label}: native modal semantics`, await drawer(page).evaluate(node => node instanceof HTMLDialogElement && node.matches(':modal')));
  check(`${label}: extends from viewport top to bottom`, box && Math.abs(box.y) <= 1 && Math.abs(box.y + box.height - height) <= 1);
  if (await phoneLayout(page)) check(`${label}: mobile drawer fills the viewport width`, Math.abs(box.x) <= 1 && Math.abs(box.width - width) <= 1);
  else check(`${label}: desktop drawer is a right-aligned side panel`, box.x > 0 && box.width < width && Math.abs(box.x + box.width - width) <= 1);
  check(`${label}: no drawer or page horizontal overflow`, await page.evaluate(() => {
    const node = document.querySelector('.drawer.open');
    const content = node.querySelector('.drawer-content');
    return document.documentElement.scrollWidth <= innerWidth + 1 && node.scrollWidth <= node.clientWidth + 1 && content.scrollWidth <= content.clientWidth + 1;
  }));
  await reachableClose(page, label);
}
async function reachableClose(page, label) {
  check(`${label}: close target is visible, reachable and at least 44px`, await close(page).evaluate(node => {
    const box = node.getBoundingClientRect();
    return box.width >= 44 && box.height >= 44 && box.left >= 0 && box.top >= 0 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1
      && node.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
  }));
}
const backgroundScroll = page => page.evaluate(() => ({
  window: [scrollX, scrollY], document: [document.documentElement.scrollLeft, document.documentElement.scrollTop],
  app: [document.querySelector('.app').scrollLeft, document.querySelector('.app').scrollTop],
  list: [document.querySelector('.incident-scroll').scrollLeft, document.querySelector('.incident-scroll').scrollTop],
}));
async function scrollAndFocus(page, label) {
  const before = await backgroundScroll(page);
  const headerBefore = await drawer(page).locator('.drawer-head').boundingBox();
  check(`${label}: real evidence content overflows the scroll body`, await body(page).evaluate(node => node.scrollHeight > node.clientHeight));
  const contentBox = await body(page).boundingBox();
  await page.mouse.move(contentBox.x + contentBox.width / 2, contentBox.y + contentBox.height / 2);
  await page.mouse.wheel(0, 520);
  await page.waitForFunction(() => document.querySelector('.drawer.open .drawer-content').scrollTop > 0);
  check(`${label}: wheel scrolls the detail body`, await body(page).evaluate(node => node.scrollTop > 0));
  await body(page).evaluate(node => { node.scrollTop = node.scrollHeight; });
  await settled(page);
  check(`${label}: last source remains reachable at the end of the long detail`, await drawer(page).locator('.sources').last().evaluate(node => {
    const box = node.getBoundingClientRect(), scrollport = node.closest('.drawer-content').getBoundingClientRect();
    return box.bottom <= scrollport.bottom + 1 && box.bottom > scrollport.top;
  }));
  await reachableClose(page, `${label} after long scroll`);
  const headerAfter = await drawer(page).locator('.drawer-head').boundingBox();
  check(`${label}: scrolling keeps the close header fixed`, Math.abs(headerAfter.y - headerBefore.y) <= 1 && Math.abs(headerAfter.height - headerBefore.height) <= 1);
  // Wheel past the content boundary; the underlying app and incident list must not move.
  await page.mouse.wheel(0, 600);
  if (page.viewportSize().width > 640) {
    const box = await drawer(page).boundingBox();
    await page.mouse.move(Math.min(100, box.x / 2), page.viewportSize().height / 2);
    await page.mouse.wheel(0, 600);
  }
  await page.waitForTimeout(150);
  assert.deepEqual(await backgroundScroll(page), before, `${label}: wheel input cannot scroll the background`);
  checks.push(`${label}: wheel input cannot scroll the background`);
  await close(page).focus();
  await page.keyboard.press('Shift+Tab');
  check(`${label}: reverse Tab wraps from close to the last link`, await drawer(page).evaluate(node => document.activeElement === [...node.querySelectorAll('a[href], button:not([disabled])')].at(-1)));
  await page.keyboard.press('Tab');
  check(`${label}: forward Tab wraps back to close`, await close(page).evaluate(node => document.activeElement === node));
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    check(`${label}: Tab focus stays in the dialog ${i + 1}`, await drawer(page).evaluate(node => node.contains(document.activeElement)));
  }
  await body(page).evaluate(node => { node.scrollTop = 0; });
  await settled(page);
}
async function backdrop(page, category, opener, label) {
  const other = categories.find(item => item.kind !== category.kind);
  const button = page.getByRole('button', { name: other.tab, exact: true });
  const target = await button.boundingBox(), panel = await drawer(page).boundingBox();
  check(`${label}: other category is behind the desktop backdrop`, target && target.x + target.width / 2 < panel.x);
  await page.evaluate(() => {
    window.__drawerBackgroundClicks = 0;
    document.querySelector('.app').addEventListener('click', event => {
      if (!event.target.closest('.drawer')) window.__drawerBackgroundClicks++;
    }, { capture: true });
  });
  await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
  await closed(page, opener);
  check(`${label}: backdrop closes without activating the underlying category`, await page.evaluate(() => window.__drawerBackgroundClicks === 0)
    && await page.getByRole('button', { name: category.tab, exact: true }).getAttribute('aria-pressed') === 'true');
}
async function viewportCase(browser, engine, viewport, category, hasTouch = viewport.width <= 640) {
  const label = `${engine} ${viewport.width}x${viewport.height} ${hasTouch ? 'touch' : 'mouse'} ${category.kind}`;
  const page = await browser.newPage({ viewport, colorScheme: 'light', hasTouch });
  try {
    await prepare(page, label);
    await page.goto(route(category)); await ready(page, category);
    const overflowBefore = await page.locator('.app').evaluate(node => getComputedStyle(node).overflowY);
    const opener = await openItem(page, category);
    await bounds(page, label);
    check(`${label}: background app scrolling is locked`, await page.locator('.app').evaluate(node => getComputedStyle(node).overflowY === 'hidden'));
    await scrollAndFocus(page, label);
    await screenshot(page, `${engine}-${await phoneLayout(page) ? 'mobile' : 'desktop'}-${viewport.width}x${viewport.height}-${category.kind}-detail`);
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.keyboard.press('Escape'); await closed(page, opener);
      check(`${label}: Escape restores the original opener ${attempt + 1}`, await opener.evaluate(node => document.activeElement === node));
      await openItem(page, category);
    }
    await close(page).click(); await closed(page, opener);
    check(`${label}: explicit close restores background scrolling policy`, await page.locator('.app').evaluate(node => getComputedStyle(node).overflowY) === overflowBefore);
    if (viewport.width > 900 && !(await phoneLayout(page))) {
      await openItem(page, category); await backdrop(page, category, opener, label);
    }
  } catch (error) {
    failures.push({ label, error: error.stack });
    await page.screenshot({ path: `${output}/${engine}-${viewport.width}x${viewport.height}-${category.kind}-failure.png`, fullPage: true, animations: 'disabled' }).catch(() => {});
  } finally { await page.close(); }
}
async function resizeAndHistory(browser, engine) {
  const label = `${engine} resize/history/reduced motion`;
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, reducedMotion: 'reduce' });
  try {
    await prepare(page, label);
    const [incident, vulnerability] = categories;
    await page.goto(route(incident)); await ready(page, incident);
    await page.getByRole('textbox', { name: incident.query, exact: true }).fill(incident.item.company);
    await openItem(page, incident);
    await page.waitForFunction(() => new URLSearchParams(location.hash.slice(1)).has('sel'));
    const selectedIncidentUrl = page.url();
    for (const viewport of [{ width: 393, height: 851 }, { width: 320, height: 568 }, { width: 640, height: 360 }, { width: 1440, height: 980 }]) {
      await page.setViewportSize(viewport); await settled(page);
      await bounds(page, `${label} ${viewport.width}x${viewport.height}`);
    }
    check(`${label}: reduced-motion preference is active`, await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches));
    await page.reload(); await drawer(page).locator(incident.detail).waitFor();
    check(`${label}: reload restores the selected incident and query`, await page.getByRole('textbox', { name: incident.query, exact: true }).inputValue() === incident.item.company
      && (await drawer(page).innerText()).includes(incident.item.title));
    await close(page).click(); await closed(page);
    await page.getByRole('button', { name: vulnerability.tab, exact: true }).click(); await ready(page, vulnerability);
    await page.getByRole('textbox', { name: vulnerability.query, exact: true }).fill(vulnerability.item.id);
    await openItem(page, vulnerability);
    await page.waitForFunction(() => new URLSearchParams(location.hash.slice(1)).get('sel') === document.querySelector('.drawer.open .detail-tags span')?.textContent);
    const selectedVulnerabilityUrl = page.url();
    for (const viewport of [{ width: 393, height: 851 }, { width: 1440, height: 980 }]) {
      await page.setViewportSize(viewport); await settled(page);
      await bounds(page, `${label} advisory ${viewport.width}x${viewport.height}`);
    }
    check(`${label}: reduced motion disables the drawer entry animation`, await drawer(page).evaluate(node => getComputedStyle(node).animationName === 'none'));
    await page.reload(); await drawer(page).locator(vulnerability.detail).waitFor();
    check(`${label}: reload restores advisory selection, query and category`, await page.getByRole('textbox', { name: vulnerability.query, exact: true }).inputValue() === vulnerability.item.id
      && (await drawer(page).innerText()).includes(vulnerability.item.title)
      && new URLSearchParams(new URL(page.url()).hash.slice(1)).get('kind') === 'vulnerability');
    // Back is browser navigation while the modal is open, not a click through it.
    await page.goBack();
    await page.getByRole('textbox', { name: incident.query, exact: true }).waitFor();
    await closed(page);
    check(`${label}: Back while open restores the incident query without a stale advisory`, await page.getByRole('textbox', { name: incident.query, exact: true }).inputValue() === incident.item.company);
    await page.goForward(); await drawer(page).locator(vulnerability.detail).waitFor();
    check(`${label}: Forward restores the open advisory and its query`, await page.getByRole('textbox', { name: vulnerability.query, exact: true }).inputValue() === vulnerability.item.id
      && (await drawer(page).innerText()).includes(vulnerability.item.title));
    // A fresh selected route must replace an already open category modal cleanly.
    await page.goto(selectedIncidentUrl); await drawer(page).locator(incident.detail).waitFor();
    check(`${label}: navigating to an incident selection replaces the advisory modal`, await page.locator('dialog:modal').count() === 1 && await page.locator('.vulnerability-detail').count() === 0);
    await page.goto(selectedVulnerabilityUrl); await drawer(page).locator(vulnerability.detail).waitFor();
    await bounds(page, `${label} advisory route`);
    await close(page).click(); await closed(page);
    await page.getByRole('button', { name: incident.tab, exact: true }).click(); await ready(page, incident);
    check(`${label}: changing category after close leaves no stale drawer`, await drawer(page).count() === 0);
  } catch (error) {
    failures.push({ label, error: error.stack });
    await page.screenshot({ path: `${output}/${engine}-history-failure.png`, fullPage: true, animations: 'disabled' }).catch(() => {});
  } finally { await page.close(); }
}

// Desktop emulation has zero physical safe-area insets; verify the authored fallback too.
const css = ['drawer.css'].map(file => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')).join('\n');
const drawerRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selector]) => /\.drawer(?:\b|-)/.test(selector)).map(([, , declarations]) => declarations).join('\n');
for (const edge of ['top', 'right', 'bottom', 'left']) check(`drawer CSS accounts for the ${edge} safe area`, drawerRules.includes(`env(safe-area-inset-${edge}`));
for (const [engine, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
  let browser;
  try {
    browser = await browserType.launch(engine === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    for (const [width, height, hasTouch] of [[1440, 980, false], [393, 851, true], [320, 568, true], [640, 360, true], [844, 390, true], [800, 450, false]]) {
      for (const category of categories) await viewportCase(browser, engine, { width, height }, category, hasTouch);
    }
    await resizeAndHistory(browser, engine);
  } catch (error) { failures.push({ label: engine, error: error.stack }); }
  finally { await browser?.close(); }
}
writeFileSync(`${output}/results.json`, JSON.stringify({ ok: failures.length === 0 && errors.length === 0, checks, errors, failures }, null, 2));
for (const failure of failures) console.error(`${failure.label}: ${failure.error}`);
check('all drawer browser cases pass', failures.length === 0);
check('no drawer runtime errors', errors.length === 0);
console.log(`Drawer UI: ${checks.length} checks passed in Chromium and WebKit`);
