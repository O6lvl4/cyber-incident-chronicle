import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadData } from './data-status.mjs';
import { DEFAULT_CLASSIFICATION, CLASSIFICATION_OPTIONS, matchesClassification } from '../src/lib/classification.ts';

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const url = process.env.UI_URL ?? 'http://127.0.0.1:4173/';
const checks = [];
const errors = [];
const failures = [];
const check = (label, result) => { assert.ok(result, label); checks.push(label); };
const output = `${process.env.UI_OUTPUT ?? 'artifacts/ui'}/classification-viewports`;
mkdirSync(output, { recursive: true });
const { incidents } = loadData();
const labels = { industry: '被害対象企業の業種', manufacturingType: '製造業の細分類', listingStatus: '被害対象企業の上場区分', attackKind: '攻撃・事象の種類', initialAccess: '初期侵入経路', confidence: '攻撃・経路の確度' };
const foodCount = incidents.filter(item => matchesClassification(item, { ...DEFAULT_CLASSIFICATION, manufacturingType: 'food' })).length;
const waitForCount = (page, count) => page.waitForFunction(expected => document.querySelectorAll('.incident-card').length === expected, count);
const dialog = page => page.locator('dialog.classification-dialog');
const reset = page => page.getByRole('button', { name: 'すべての絞り込みを解除', exact: true }).click();

async function prepare(page) {
  page.on('pageerror', error => errors.push(error.message));
  // Canvas insertion is earlier than worker rendering; wait for real draws, including transparent tiles.
  await page.addInitScript(() => {
    window.__classificationPaintedTiles = new WeakSet();
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args) {
      const result = drawImage.apply(this, args);
      if (this.canvas.classList?.contains('tile')) window.__classificationPaintedTiles.add(this.canvas);
      return result;
    };
  });
}
async function screenshot(page, name) {
  await page.waitForFunction(() => {
    if (document.querySelector('[role=tab][aria-selected=true]')?.getAttribute('aria-label') !== 'タイムライン') return true;
    const tiles = [...document.querySelectorAll('.tile-host .tile, .axis-tiles .tile')].filter(tile => tile.getBoundingClientRect().width > 0);
    return tiles.length > 0 && tiles.every(tile => window.__classificationPaintedTiles.has(tile))
      && document.querySelectorAll('.tile-ghost .tile').length === 0;
  });
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true, animations: 'disabled' });
}
async function openFilters(page) {
  await page.locator('.classification-toggle').click();
  await dialog(page).waitFor();
  await page.waitForFunction(() => document.querySelector('dialog.classification-dialog')?.matches(':modal'));
}
async function closedWithFocus(page) {
  await dialog(page).waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.activeElement === document.querySelector('.classification-toggle'));
  await page.waitForFunction(() => document.querySelector('.classification-toggle')?.getAttribute('aria-expanded') === 'false');
}
async function backdropClick(page) {
  const bounds = await dialog(page).boundingBox();
  const { width, height } = page.viewportSize();
  const point = [[2, 2], [width - 2, 2], [2, height - 2], [width - 2, height - 2]]
    .find(([x, y]) => x < bounds.x || x > bounds.x + bounds.width || y < bounds.y || y > bounds.y + bounds.height);
  assert.ok(point, 'dialog leaves a tappable backdrop inside the viewport');
  await page.mouse.click(...point);
}
async function controlIsReachable(locator) {
  return locator.evaluate(node => {
    const bounds = node.getBoundingClientRect();
    const body = node.closest('.classification-filter-body')?.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2;
    const y = bounds.top + bounds.height / 2;
    return bounds.left >= 0 && bounds.right <= innerWidth + 1 && bounds.top >= 0 && bounds.bottom <= innerHeight + 1
      && (!body || (bounds.top >= body.top - 1 && bounds.bottom <= body.bottom + 1))
      && node.contains(document.elementFromPoint(x, y));
  });
}
async function showResults(page, count, headingId) {
  await dialog(page).getByRole('button', { name: `${count}件の結果を見る`, exact: true }).click();
  await dialog(page).waitFor({ state: 'hidden' });
  await page.waitForFunction(id => document.activeElement?.id === id, headingId);
  const heading = headingId === 'incident-timeline-results'
    ? page.locator(`#${headingId} .board-toolbar strong`)
    : page.locator(`#${headingId}`);
  const bounds = await heading.boundingBox();
  assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= page.viewportSize().height + 1, 'result heading is revealed in the viewport');
}

try {
  check('food subtype fixture is a nonempty strict subset', foodCount > 0 && foodCount < incidents.length);
  for (const [width, height] of [[320, 568], [393, 851], [640, 360], [640, 800], [1440, 980]]) {
    const size = `${width}x${height}`;
    const mobile = width <= 640;
    const page = await browser.newPage({ viewport: { width, height }, colorScheme: 'light' });
    try {
    await prepare(page);
    await page.goto(url); await waitForCount(page, incidents.length);
    check(`${size}: classification controls collapsed by default`, !(await dialog(page).isVisible())
      && await page.locator('.classification-toggle').getAttribute('aria-expanded') === 'false');
    check(`${size}: reset stays available`, await page.getByRole('button', { name: 'すべての絞り込みを解除', exact: true }).isVisible());
    check(`${size}: no collapsed page overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    check(`${size}: both categories use list-first browsing`, await page.getByRole('tab', { name: '一覧', exact: true }).getAttribute('aria-selected') === 'true'
      && await page.locator('.incident-list').isVisible() && !(await page.locator('.timeline-container').isVisible()));
    await screenshot(page, `${size}-collapsed-initial-light`);
    if (mobile) {
      check(`${size}: disclosure and reset have touch-sized targets`, (await page.locator('.classification-toggle').boundingBox()).height >= 44
        && (await page.getByRole('button', { name: 'すべての絞り込みを解除', exact: true }).boundingBox()).height >= 44);
      await page.getByRole('tab', { name: '一覧', exact: true }).click();
      const placement = await page.locator('.incident-card').first().evaluate(card => {
        const cardBounds = card.getBoundingClientRect();
        const company = card.querySelector('strong').getBoundingClientRect();
        const title = card.querySelector('.incident-card-title').getBoundingClientRect();
        const scrollport = card.closest('.incident-scroll').getBoundingClientRect();
        const top = Math.max(0, scrollport.top);
        const bottom = Math.min(innerHeight, scrollport.bottom);
        return { cardTop: cardBounds.top, companyVisible: company.top >= top && company.bottom <= bottom,
          titleVisible: title.top >= top && title.bottom <= bottom, outerScroll: document.querySelector('.app').scrollTop,
          innerScroll: card.closest('.incident-scroll').scrollTop };
      });
      check(`${size}: first incident is meaningfully visible without scrolling ${JSON.stringify(placement)}`, placement.cardTop >= 0 && placement.cardTop < height
        && placement.companyVisible && placement.titleVisible && placement.outerScroll === 0 && placement.innerScroll === 0);
      await screenshot(page, `${size}-collapsed-list-light`);
    }

    await openFilters(page);
    check(`${size}: disclosure opens a native modal`, await dialog(page).evaluate(node => node instanceof HTMLDialogElement && node.matches(':modal')));
    check(`${size}: four primary classifications are exposed initially`, await dialog(page).locator('.classification-field select:visible').count() === 4);
    check(`${size}: advanced conditions and long notes start collapsed`, !(await dialog(page).locator('.classification-advanced').evaluate(node => node.open))
      && !(await dialog(page).locator('.classification-explanation').evaluate(node => node.open)));
    const baselineAction = dialog(page).getByRole('button', { name: `${incidents.length}件の結果を見る`, exact: true });
    check(`${size}: baseline result count is inside an accessible footer`, await controlIsReachable(baselineAction)
      && await baselineAction.locator('[aria-live="polite"]').count() === 1);
    await screenshot(page, `${size}-filters-light`);
    // Native modality must keep keyboard navigation out of the obscured page.
    for (let index = 0; index < 9; index++) {
      await page.keyboard.press('Tab');
      check(`${size}: modal contains tab focus ${index + 1}`, await dialog(page).evaluate(node => node.contains(document.activeElement)));
    }
    await page.keyboard.press('Escape'); await closedWithFocus(page);
    check(`${size}: Escape dismisses and restores disclosure focus`, await page.locator('.classification-toggle').getAttribute('aria-expanded') === 'false');
    await openFilters(page); await backdropClick(page); await closedWithFocus(page);
    check(`${size}: tapping backdrop dismisses and restores focus`, !(await dialog(page).isVisible()));
    await openFilters(page);
    await dialog(page).getByRole('button', { name: '絞り込みを閉じる', exact: true }).click(); await closedWithFocus(page);
    check(`${size}: explicit close dismisses and restores focus`, !(await dialog(page).isVisible()));

    await openFilters(page);
    await dialog(page).getByLabel(labels.manufacturingType, { exact: true }).selectOption('food');
    await waitForCount(page, foodCount);
    const foodAction = dialog(page).getByRole('button', { name: `${foodCount}件の結果を見る`, exact: true });
    await foodAction.waitFor();
    check(`${size}: subtype works without selecting industry`, await dialog(page).getByLabel(labels.industry, { exact: true }).inputValue() === 'all'
      && await page.locator('.incident-card').count() === foodCount);
    check(`${size}: active count and live result count update`, await page.locator('.classification-filter-count').innerText() === '1条件'
      && await foodAction.isEnabled());
    await dialog(page).locator('.classification-advanced summary').click();
    check(`${size}: all six classifications have preserved accessible labels`, await dialog(page).locator('.classification-field select:visible').count() === 6);
    for (const key of Object.keys(labels)) {
      const field = dialog(page).getByLabel(labels[key], { exact: true });
      await field.scrollIntoViewIfNeeded();
      check(`${size}: ${key} is fully reachable inside the scrollable body`, await controlIsReachable(field));
    }
    await dialog(page).locator('.classification-explanation summary').click();
    const beforeScroll = await foodAction.boundingBox();
    await dialog(page).locator('.classification-filter-body').evaluate(node => { node.scrollTop = node.scrollHeight; });
    check(`${size}: long notes remain reachable in the dialog body`, await dialog(page).locator('.classification-help').last().evaluate(node => {
      const bounds = node.getBoundingClientRect();
      const body = node.closest('.classification-filter-body').getBoundingClientRect();
      return bounds.bottom <= body.bottom + 1 && bounds.bottom > body.top;
    }));
    const afterScroll = await foodAction.boundingBox();
    check(`${size}: footer remains visible when body scrolls`, await controlIsReachable(foodAction)
      && Math.abs(afterScroll.y - beforeScroll.y) <= 1 && afterScroll.height >= 44);
    if (height <= 568) check(`${size}: overflowing filter body can actually scroll`, await dialog(page).locator('.classification-filter-body').evaluate(node => node.scrollHeight > node.clientHeight && node.scrollTop > 0));
    check(`${size}: dialog causes no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
      && await dialog(page).evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    await screenshot(page, `${size}-advanced-light`);
    const resultHeading = 'incident-results-heading';
    await showResults(page, foodCount, resultHeading);
    check(`${size}: result action closes and focuses visible results`, !(await dialog(page).isVisible()));
    check(`${size}: result action preserves list selection`, await page.getByRole('tab', { name: '一覧', exact: true }).getAttribute('aria-selected') === 'true');
    await screenshot(page, `${size}-results-after-close-light`);
    const chip = page.locator('.classification-chips').getByRole('button', { name: `${labels.manufacturingType}：${CLASSIFICATION_OPTIONS.manufacturingType.food}の条件を解除`, exact: true });
    await chip.scrollIntoViewIfNeeded();
    check(`${size}: collapsed selection shows the actual subtype`, await chip.isVisible());
    await screenshot(page, `${size}-selected-chips-light`);

    // Mark existing canvases unpainted so the dark screenshot cannot capture stale light tiles.
    await page.evaluate(() => { window.__classificationPaintedTiles = new WeakSet(); });
    await page.getByRole('button', { name: 'テーマ切替', exact: true }).click();
    await page.locator('.app.dark').waitFor();
    check(`${size}: dark theme remains reachable`, await page.locator('.app.dark').count() === 1);
    await openFilters(page);
    await screenshot(page, `${size}-filters-dark`);
    await dialog(page).getByRole('button', { name: '絞り込みを閉じる', exact: true }).click(); await closedWithFocus(page);
    await chip.click(); await waitForCount(page, incidents.length);
    check(`${size}: individual chip removal clears subtype`, await page.locator('.classification-chips button').count() === 0);
    for (let attempt = 0; attempt < 2; attempt++) { await reset(page); await waitForCount(page, incidents.length); }
    check(`${size}: repeated reset works while controls are collapsed`, await page.locator('.incident-card').count() === incidents.length
      && await page.locator('.classification-filter-count').count() === 0);
    await page.getByRole('textbox', { name: '企業名・事案を検索', exact: true }).fill('no-match-classification-viewport');
    await waitForCount(page, 0);
    await openFilters(page);
    const zeroAction = dialog(page).getByRole('button', { name: '0件の結果を見る', exact: true });
    check(`${size}: zero-result action stays enabled and visible`, await zeroAction.isEnabled() && await controlIsReachable(zeroAction));
    await showResults(page, 0, resultHeading);
    check(`${size}: zero-result action reveals usable empty state`, await page.getByText('条件に合う事案がありません', { exact: true }).isVisible());
    await reset(page); await waitForCount(page, incidents.length);

    await page.getByRole('textbox', { name: '企業名・事案を検索', exact: true }).fill('アサヒ');
    await page.waitForFunction(() => new URLSearchParams(location.hash.slice(1)).get('q') === 'アサヒ');
    await page.locator('.incident-card').first().click();
    await page.locator('.drawer.open .classification-detail').waitFor();
    check(`${size}: entity facts are available`, await page.locator('.classification-entity').count() > 0);
    check(`${size}: independent attack/access statuses are displayed`, await page.locator('.classification-attack .classification-confidence').count() === 2);
    check(`${size}: original attack-method text is preserved`, (await page.locator('.method-note').allTextContents()).some(text => text.startsWith('攻撃手法：')));
    const sources = await page.locator('.classification-sources a').evaluateAll(nodes => nodes.map(node => node.href));
    check(`${size}: source evidence links use HTTPS`, sources.length > 0 && sources.every(source => source.startsWith('https://')));
    await page.locator('.classification-detail').scrollIntoViewIfNeeded();
    check(`${size}: detail has no horizontal overflow`, await page.locator('.drawer-content').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    await screenshot(page, `${size}-detail-dark`);
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    await reset(page); await waitForCount(page, incidents.length);
    check(`${size}: all-incident reset clears search`, await page.getByRole('textbox', { name: '企業名・事案を検索', exact: true }).inputValue() === '');
    {
      await page.getByRole('tab', { name: 'タイムライン', exact: true }).click();
      await page.locator('.tile-host .tile').first().waitFor();
      check(`${size}: timeline replaces the list`, await page.locator('.timeline-container').isVisible() && !(await page.locator('.incident-list').isVisible()));
      await screenshot(page, `${size}-timeline-dark`);
      await openFilters(page); await showResults(page, incidents.length, 'incident-timeline-results');
      check(`${size}: result action also preserves timeline selection`, await page.getByRole('tab', { name: 'タイムライン', exact: true }).getAttribute('aria-selected') === 'true');
    }
    await page.getByRole('button', { name: 'ライブラリの脆弱性', exact: true }).click();
    await page.getByLabel('ライブラリ・脆弱性を検索').waitFor();
    check(`${size}: vulnerability view has no incident classification controls`, await page.locator('.classification-controls').count() === 0);
    } catch (error) {
      failures.push({ size, error: error.message });
      console.error(`${size}: ${error.stack}`);
      await page.screenshot({ path: `${output}/${size}-failure.png`, fullPage: true, animations: 'disabled' }).catch(() => {});
    } finally { await page.close(); }
  }
  writeFileSync(`${output}/results.json`, JSON.stringify({ ok: failures.length === 0 && errors.length === 0, checks, errors, failures }, null, 2));
  check('all viewport cases pass', failures.length === 0);
  check('no runtime JavaScript errors', errors.length === 0);
  console.log(`Classification viewport UI: ${checks.length} checks passed`);
} catch (error) {
  for (const [index, page] of browser.contexts().flatMap(context => context.pages()).entries()) {
    await page.screenshot({ path: `${output}/failure-${index}.png`, fullPage: true }).catch(() => {});
  }
  throw error;
} finally { await browser.close(); }
