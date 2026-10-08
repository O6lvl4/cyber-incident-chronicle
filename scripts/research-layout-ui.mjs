import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

// Keep this visual gate bounded: four viewports, list browsing, and one detail
// drawer per viewport. Existing suites exercise timeline rendering and WebKit.
const base = process.env.UI_URL ?? 'http://127.0.0.1:4173/';
const output = `${process.env.UI_OUTPUT ?? 'artifacts/ui'}/research-layout`;
mkdirSync(output, { recursive: true });
const checks = [], errors = [], failures = [], measurements = [], screenshots = [];
const check = (label, ok, actual) => {
  if (ok) checks.push(label);
  else failures.push({ label, ...(actual === undefined ? {} : { actual }) });
};
const route = state => { const target = new URL(base); target.hash = new URLSearchParams(state).toString(); return target.href; };
const viewports = [{ width: 1180, height: 757 }, { width: 1440, height: 900 }, { width: 393, height: 851 }, { width: 320, height: 568 }];

async function settled(page) {
  // List-only screenshots must never wait for timeline canvas workers.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity)
      .map(animation => animation.finished.catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function screenshot(page, name) {
  await settled(page);
  // A viewport image preserves the actual first-screen density, even if a
  // regression accidentally makes the outer document taller than the screen.
  const file = `${name}.png`;
  await page.screenshot({ path: `${output}/${file}`, fullPage: false, animations: 'disabled' });
  screenshots.push(file);
}

async function listLayout(page, label, defaultList) {
  await settled(page);
  const actual = await page.locator('.research-list:visible').evaluate(list => {
    const box = node => {
      const { x, y, width, height, top, right, bottom, left } = node.getBoundingClientRect();
      return { x, y, width, height, top, right, bottom, left };
    };
    const scroll = list.querySelector('.incident-scroll');
    const scrollBox = box(scroll);
    const rows = [...scroll.querySelectorAll('.incident-card')].map(box);
    // A row is complete only inside every clipping ancestor and the viewport.
    let top = 0, bottom = innerHeight;
    for (let node = scroll; node; node = node.parentElement) {
      if (/auto|scroll|hidden|clip/.test(getComputedStyle(node).overflowY)) {
        const bounds = box(node);
        top = Math.max(top, bounds.top + node.clientTop);
        bottom = Math.min(bottom, bounds.top + node.clientTop + node.clientHeight);
      }
    }
    const innerLeft = scrollBox.left + scroll.clientLeft;
    const innerRight = innerLeft + scroll.clientWidth;
    const complete = rows.filter(row => row.top >= top - 1 && row.bottom <= bottom + 1);
    const listBox = box(list);
    const visibleRows = rows.filter(row => row.bottom > top && row.top < bottom);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      first: rows[0], completeRecords: complete.length, renderedRecords: rows.length,
      visibleScrollport: { top, bottom }, scrollBox,
      scrollOffsets: { outer: document.querySelector('.app').scrollTop, page: scrollY, list: scroll.scrollTop },
      fullWidthRows: rows.every(row => Math.abs(row.left - innerLeft) <= 1 && Math.abs(row.right - innerRight) <= 1),
      sequentialRows: rows.every((row, index) => !index || row.top >= rows[index - 1].bottom - 1),
      rowTargets: rows.every(row => row.height >= 44 && row.width >= 44),
      horizontalOverflow: [document.documentElement, document.querySelector('.app'), list, scroll]
        .some(node => node.scrollWidth > node.clientWidth + 1),
      pagerCount: list.querySelectorAll('.result-pagination').length,
      reachesListBottom: Math.abs(scrollBox.bottom - listBox.bottom) <= 2,
      recordsReachFormerPagerSpace: visibleRows.some(row => row.bottom > bottom - 54),
      listOnly: !document.querySelector('.board, .tile-host .tile'),
    };
  });
  measurements.push({ label, ...actual });
  check(`${label}: no horizontal overflow`, !actual.horizontalOverflow, actual);
  check(`${label}: list rows fill the available width`, actual.fullWidthRows, actual);
  check(`${label}: records stack as a single list rather than a card grid`, actual.sequentialRows, actual);
  check(`${label}: entire records are usable touch targets`, actual.rowTargets, actual.first);
  check(`${label}: at least one full record is visible without scrolling`, actual.completeRecords >= 1 && Object.values(actual.scrollOffsets).every(value => value === 0), actual);
  check(`${label}: continuous research lists have no pager`, actual.pagerCount === 0, actual);
  check(`${label}: list scrolling reaches the full available bottom edge`, actual.reachesListBottom, actual);
  if (defaultList) check(`${label}: additional records use the former pager area`, actual.recordsReachFormerPagerSpace, actual);
  check(`${label}: list browsing does not mount timeline canvases`, actual.listOnly);
  if (defaultList && actual.viewport.width >= 1180) {
    const required = actual.viewport.width === 1180 ? 5 : 7;
    check(`${label}: first default record begins before y=300`, actual.first?.top < 300, actual.first);
    check(`${label}: at least ${required} complete records fit on the first screen`, actual.completeRecords >= required, actual);
  }
  await controls(page, label);
}

async function controls(page, label) {
  const actual = await page.locator('.app-header button, .app-header input, .app-header select, .research-list .view-tabs button, .research-list .package-back').evaluateAll(nodes => nodes.flatMap(node => {
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height || getComputedStyle(node).visibility === 'hidden') return [];
    const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return [{ name: node.getAttribute('aria-label') ?? node.textContent?.trim(), width: rect.width, height: rect.height,
      inViewport: rect.left >= 0 && rect.right <= innerWidth + 1 && rect.top >= 0 && rect.bottom <= innerHeight + 1,
      reachable: node.contains(target) }];
  }));
  const mobile = page.viewportSize().width <= 640;
  const tooSmall = actual.filter(control => control.height < (mobile ? 44 : 28) || control.width < (mobile ? 44 : 24));
  check(`${label}: primary controls have ${mobile ? '44px touch' : 'usable pointer'} targets`, tooSmall.length === 0, tooSmall);
  const obstructed = actual.filter(control => !control.inViewport || !control.reachable);
  check(`${label}: primary controls are visible and unobstructed`, obstructed.length === 0, obstructed);
}

async function drawerLayout(page, label) {
  await settled(page);
  const actual = await page.locator('dialog.drawer.open').evaluate(drawer => {
    const rect = drawer.getBoundingClientRect();
    const close = drawer.querySelector('.drawer-close');
    const closeBox = close.getBoundingClientRect();
    const content = drawer.querySelector('.drawer-content');
    return {
      modal: drawer.matches(':modal'), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width,
      viewport: { width: innerWidth, height: innerHeight },
      overflow: [document.documentElement, drawer, content].some(node => node.scrollWidth > node.clientWidth + 1),
      closeTarget: closeBox.width >= 44 && closeBox.height >= 44 && closeBox.top >= 0 && closeBox.bottom <= innerHeight
        && close.contains(document.elementFromPoint(closeBox.left + closeBox.width / 2, closeBox.top + closeBox.height / 2)),
    };
  });
  measurements.push({ label, ...actual });
  check(`${label}: detail is a native modal`, actual.modal);
  check(`${label}: drawer reaches both viewport edges vertically`, Math.abs(actual.top) <= 1 && Math.abs(actual.bottom - actual.viewport.height) <= 1, actual);
  check(`${label}: no horizontal overflow in detail`, !actual.overflow, actual);
  check(`${label}: close remains reachable with a 44px target`, actual.closeTarget, actual);
  check(`${label}: drawer aligns with the viewport right edge`, Math.abs(actual.right - actual.viewport.width) <= 1, actual);
  if (actual.viewport.width <= 640) check(`${label}: phone drawer fills the viewport width`, Math.abs(actual.left) <= 1 && Math.abs(actual.width - actual.viewport.width) <= 1, actual);
  else check(`${label}: desktop drawer leaves list context visible`, actual.left > 0 && actual.width < actual.viewport.width, actual);
}

let browser;
try {
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const viewport of viewports) {
    const size = `${viewport.width}x${viewport.height}`;
    const page = await browser.newPage({ viewport, hasTouch: viewport.width <= 640, colorScheme: 'light', reducedMotion: 'reduce' });
    page.setDefaultTimeout(20_000);
    page.on('pageerror', error => errors.push(`${size}: ${error.message}`));
    try {
      await page.goto(route({}));
      await page.locator('.research-incidents .incident-card').first().waitFor();
      check(`${size}: initial incident view is the list`, await page.getByRole('tab', { name: '一覧', exact: true }).getAttribute('aria-selected') === 'true');
      await listLayout(page, `${size} incidents`, true);
      await screenshot(page, `${size}-incident-list`);

      await page.getByRole('button', { name: 'ライブラリの脆弱性', exact: true }).click();
      await page.locator('.package-card').first().waitFor();
      check(`${size}: initial library view is the package list`, await page.getByRole('tab', { name: '一覧', exact: true }).getAttribute('aria-selected') === 'true');
      await listLayout(page, `${size} packages`, true);
      await screenshot(page, `${size}-package-list`);

      const packageKey = await page.locator('.package-card').first().getAttribute('data-package-key');
      await page.locator('.package-card').first().click();
      await page.locator('.package-advisory-list .vulnerability-card').first().waitFor();
      check(`${size}: package click opens its scoped advisory list`, await page.locator('.package-advisory-list').getAttribute('data-package-key') === packageKey);
      await listLayout(page, `${size} scoped advisories`, false);
      await screenshot(page, `${size}-scoped-advisories`);

      // Opening a package only drills in; open a real issue before awaiting detail.
      await page.locator('.vulnerability-card').first().click();
      await page.locator('.drawer.open .vulnerability-detail').waitFor();
      await drawerLayout(page, `${size} advisory drawer`);
      await screenshot(page, `${size}-advisory-drawer`);
    } catch (error) {
      failures.push({ label: size, error: error.stack });
      await screenshot(page, `${size}-failure`).catch(() => {});
    } finally { await page.close(); }
  }
} catch (error) {
  failures.push({ label: 'Chromium launch', error: error.stack });
} finally {
  await browser?.close();
  writeFileSync(`${output}/results.json`, JSON.stringify({ ok: failures.length === 0 && errors.length === 0, checks, errors, failures, measurements, screenshots }, null, 2));
}
for (const failure of failures) console.error(`${failure.label}: ${JSON.stringify(failure.actual ?? failure.error)}`);
assert.equal(failures.length, 0, 'all research layout cases pass');
assert.equal(errors.length, 0, `no research layout runtime errors: ${errors.join('; ')}`);
console.log(`Research layout UI: ${checks.length} checks passed; ${screenshots.length} viewport screenshots saved`);
