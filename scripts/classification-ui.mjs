import { chromium, devices } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadData } from './data-status.mjs';
import { DEFAULT_CLASSIFICATION, CLASSIFICATION_OPTIONS, getAttack, getEntities, matchesClassification } from '../src/lib/classification.ts';
import { filterIncidents } from '../src/lib/incidents.ts';
import { THREADS } from '../src/data/threads.ts';

const url = process.env.UI_URL ?? 'http://127.0.0.1:4173/';
const output = process.env.UI_OUTPUT ?? 'artifacts/ui';
mkdirSync(output, { recursive: true });
const { incidents } = loadData();
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const results = [];
const errors = [];
const check = (name, value) => { assert.ok(value, name); results.push(name); };
const labels = { industry: '被害対象企業の業種', manufacturingType: '製造業の細分類', listingStatus: '被害対象企業の上場区分', attackKind: '攻撃・事象の種類', initialAccess: '初期侵入経路', confidence: '攻撃・経路の確度' };
const dialog = page => page.locator('dialog.classification-dialog');
const reset = page => page.getByRole('button', { name: 'すべての絞り込みを解除', exact: true }).click();
const count = (page, expected) => page.waitForFunction(n => document.querySelector('.classification-summary strong')?.textContent === `表示中 ${n}件`, expected);
const matching = classification => filterIncidents(incidents, ['leak', 'outage', 'unauthorizedAccess'], 'all', '').filter(item => matchesClassification(item, classification));

async function prepare(page) {
  page.on('pageerror', error => errors.push(error.message));
  // Mounted canvases can still be blank. Observe actual tile paints before taking evidence screenshots.
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
async function expandAdvanced(page) {
  const advanced = dialog(page).locator('details.classification-advanced');
  if (!(await advanced.evaluate(node => node.open))) await advanced.locator('summary').click();
}
async function selectFilter(page, key, value) {
  if (key === 'initialAccess' || key === 'confidence') await expandAdvanced(page);
  await dialog(page).getByLabel(labels[key], { exact: true }).selectOption(value);
}
async function resultCount(page, expected, name) {
  await count(page, expected);
  const button = dialog(page).getByRole('button', { name: `${expected}件の結果を見る`, exact: true });
  await button.waitFor();
  check(name, await button.isEnabled());
}
async function showResults(page, expected, headingId = 'incident-results-heading') {
  await dialog(page).getByRole('button', { name: `${expected}件の結果を見る`, exact: true }).click();
  await dialog(page).waitFor({ state: 'hidden' });
  await page.waitForFunction(id => document.activeElement?.id === id, headingId);
}
async function closeFilters(page) {
  await dialog(page).getByRole('button', { name: '絞り込みを閉じる', exact: true }).click();
  await dialog(page).waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.activeElement === document.querySelector('.classification-toggle'));
}
async function exactCards(page, expected, name) {
  const actual = await page.locator('.incident-card').evaluateAll(cards => cards.map(card => ({
    company: card.querySelector('strong')?.textContent,
    title: card.querySelector('.incident-card-title')?.textContent,
    date: card.querySelector('time')?.getAttribute('datetime'),
  })));
  assert.deepEqual(actual, expected.map(item => ({ company: item.company, title: item.title, date: item.announcementDate })), name);
  results.push(name);
}
async function classificationInUrl(page, filters) {
  await page.waitForFunction(expected => {
    const params = new URLSearchParams(location.hash.slice(1));
    return Object.entries(expected).every(([key, value]) => value === 'all' ? !params.has(key) : params.get(key) === value);
  }, filters);
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, colorScheme: 'light' });
  await prepare(page);
  await page.goto(url); await count(page, incidents.length);
  check('classification disclosure is a real button', await page.locator('.classification-toggle').evaluate(node => node.tagName === 'BUTTON'));
  await openFilters(page);
  check('filters use a native modal dialog', await dialog(page).evaluate(node => node instanceof HTMLDialogElement && node.matches(':modal')));
  check('only the four primary classifications are initially exposed', await dialog(page).locator('.classification-field select:visible').count() === 4);
  check('advanced controls start collapsed', !(await dialog(page).locator('.classification-advanced').evaluate(node => node.open)));
  const selected = { ...DEFAULT_CLASSIFICATION, industry: 'manufacturing', listingStatus: 'listed', attackKind: 'ransomware', confidence: 'confirmed' };
  const changing = { ...DEFAULT_CLASSIFICATION };
  for (const key of ['industry', 'listingStatus', 'attackKind', 'confidence']) {
    await selectFilter(page, key, selected[key]);
    changing[key] = selected[key];
    await resultCount(page, matching(changing).length, `${key}: result action updates while filtering`);
  }
  const expected = matching(selected);
  check('manufacturing, listed and confirmed ransomware intersection is nonempty', expected.length > 0);
  await exactCards(page, expected, 'combined filters show the exact expected incident company/title/date tuples');
  check('classification count is announced', await page.locator('.classification-summary').getAttribute('aria-live') === 'polite'
    && (await page.locator('.classification-summary').innerText()).includes(`表示中 ${expected.length}件`));
  await classificationInUrl(page, selected);
  const sharedUrl = page.url();
  await showResults(page, expected.length);
  await page.locator('.classification-chips').scrollIntoViewIfNeeded();
  await screenshot(page, 'classification-desktop-selected-chips');
  await page.reload(); await count(page, expected.length);
  check('share URL reload keeps the dialog closed', !(await dialog(page).isVisible()));
  await openFilters(page); await expandAdvanced(page);
  for (const key of Object.keys(selected)) check(`share URL restores ${key}`, await dialog(page).getByLabel(labels[key], { exact: true }).inputValue() === selected[key]);
  await closeFilters(page);
  for (const key of ['industry', 'listingStatus', 'attackKind', 'confidence']) {
    const valueLabel = CLASSIFICATION_OPTIONS[key][selected[key]];
    check(`${key}: collapsed chip exposes its selected value`, await page.locator('.classification-chips').getByRole('button', { name: `${labels[key]}：${valueLabel}の条件を解除`, exact: true }).isVisible());
  }
  await page.getByRole('button', { name: 'ライブラリの脆弱性', exact: true }).click();
  await page.getByLabel('ライブラリ・脆弱性を検索').waitFor();
  check('vulnerability category has no company classification controls', await page.locator('.classification-controls').count() === 0);
  await page.goBack(); await count(page, expected.length);
  check('Back restores classification route', new URLSearchParams(new URL(page.url()).hash.slice(1)).get('industry') === 'manufacturing');
  await page.goForward();
  await page.waitForFunction(() => new URLSearchParams(location.hash.slice(1)).get('kind') === 'vulnerability');
  await page.goto(sharedUrl); await count(page, expected.length);
  await reset(page); await count(page, incidents.length); await classificationInUrl(page, DEFAULT_CLASSIFICATION);
  check('reset clears every classification URL filter', Object.keys(labels).every(key => !new URLSearchParams(new URL(page.url()).hash.slice(1)).has(key)));

  const target = incidents.find(item => getEntities(item.id).some(entity => entity.manufacturingType === 'electronics') && getAttack(item.id).attackKind === 'ransomware');
  check('representative electronics ransomware record exists', !!target);
  await page.getByRole('textbox', { name: '企業名・事案を検索', exact: true }).fill(target.company);
  await openFilters(page); await selectFilter(page, 'manufacturingType', 'electronics');
  const searchExpected = filterIncidents(incidents, ['leak', 'outage', 'unauthorizedAccess'], 'all', target.company)
    .filter(item => matchesClassification(item, { ...DEFAULT_CLASSIFICATION, manufacturingType: 'electronics' }));
  await resultCount(page, searchExpected.length, 'classification and text search compose');
  await showResults(page, searchExpected.length);
  await exactCards(page, searchExpected, 'search and subtype return the exact expected incidents');
  await page.locator('.incident-card').first().click();
  await page.locator('.drawer.open .classification-detail').waitFor();
  check('detail shows evidence and current listing basis', (await page.locator('.drawer').innerText()).includes('上場区分') && (await page.locator('.drawer').innerText()).includes('初期侵入経路'));
  await page.waitForFunction(() => new URLSearchParams(location.hash.slice(1)).has('sel'));
  const selectedDetailUrl = new URL(page.url());
  // A native modal intentionally makes background filters inert. Close it before editing.
  await page.locator('.drawer-close').click();
  await page.getByRole('textbox', { name: '企業名・事案を検索', exact: true }).fill('no-match-classification-zz');
  await count(page, 0);
  // Keep the selected-item invalidation regression check through a real share URL.
  const excludedSelection = new URLSearchParams(selectedDetailUrl.hash.slice(1));
  excludedSelection.set('q', 'no-match-classification-zz');
  selectedDetailUrl.hash = excludedSelection.toString();
  await page.goto(selectedDetailUrl.href); await count(page, 0);
  await page.waitForFunction(() => !document.querySelector('.drawer.open') && !new URLSearchParams(location.hash.slice(1)).has('sel'));
  check('filtering selected incident out closes the drawer and clears its URL selection', await page.locator('.drawer.open').count() === 0);
  check('zero results are explicit', await page.getByText('条件に合う事案がありません', { exact: true }).isVisible());
  await openFilters(page); await resultCount(page, 0, 'zero-result action is enabled and accurately labelled');
  await showResults(page, 0);
  check('zero-result action still closes the dialog', !(await dialog(page).isVisible()));
  await reset(page); await count(page, incidents.length);
  await reset(page); await count(page, incidents.length);
  await screenshot(page, 'classification-desktop');

  const mobile = await browser.newPage({ ...devices['Pixel 5'], colorScheme: 'light' });
  await prepare(mobile);
  const advancedTarget = incidents.find(item => {
    const attack = getAttack(item.id);
    return attack.attackKind === 'ransomware' && attack.attackKindStatus === 'confirmed'
      && attack.initialAccessStatus === 'confirmed' && attack.initialAccess !== 'unknown';
  });
  check('a confirmed ransomware and access fixture exists', !!advancedTarget);
  const mobileSelection = { ...DEFAULT_CLASSIFICATION, attackKind: 'ransomware', initialAccess: getAttack(advancedTarget.id).initialAccess, confidence: 'confirmed' };
  const mobileExpected = matching(mobileSelection);
  const mobileUrl = new URL(url);
  mobileUrl.hash = new URLSearchParams(Object.entries(mobileSelection).filter(([, value]) => value !== 'all')).toString();
  await mobile.goto(mobileUrl.href); await count(mobile, mobileExpected.length);
  check('mobile shared filters default to list', await mobile.getByRole('tab', { name: '一覧', exact: true }).getAttribute('aria-selected') === 'true');
  await mobile.getByRole('tab', { name: 'タイムライン', exact: true }).click();
  await openFilters(mobile);
  check('URL-restored advanced selections are revealed when the dialog opens', await dialog(mobile).locator('.classification-advanced').evaluate(node => node.open));
  for (const key of ['attackKind', 'initialAccess', 'confidence']) check(`mobile URL restores ${key}`, await dialog(mobile).getByLabel(labels[key], { exact: true }).inputValue() === mobileSelection[key]);
  await showResults(mobile, mobileExpected.length, 'incident-timeline-results');
  check('results action preserves the chosen timeline view', await mobile.getByRole('tab', { name: 'タイムライン', exact: true }).getAttribute('aria-selected') === 'true');
  await mobile.getByRole('tab', { name: '一覧', exact: true }).click();
  await mobile.locator('.classification-chips').scrollIntoViewIfNeeded();
  await screenshot(mobile, 'classification-mobile-selected-chips');

  await mobile.getByRole('textbox', { name: '企業名・事案を検索', exact: true }).fill(advancedTarget.company);
  await mobile.getByRole('button', { name: '影響・確認状況', exact: true }).click();
  await mobile.getByRole('combobox', { name: '情報流出の確認状況', exact: true }).selectOption(advancedTarget.disclosureStatus);
  const retainedImpact = advancedTarget.impactTypes[0];
  for (const impact of THREADS.filter(item => item.id !== retainedImpact)) await mobile.getByRole('button', { name: impact.name, exact: true }).click();
  const impactsBefore = await mobile.locator('.thread-chip').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-pressed')));
  await mobile.locator('.classification-chips').getByRole('button', { name: `${labels.attackKind}：${CLASSIFICATION_OPTIONS.attackKind.ransomware}の条件を解除`, exact: true }).click();
  const afterRemoval = { ...mobileSelection, attackKind: 'all' };
  const removalExpected = filterIncidents(incidents, [retainedImpact], advancedTarget.disclosureStatus, advancedTarget.company)
    .filter(item => matchesClassification(item, afterRemoval));
  await count(mobile, removalExpected.length); await classificationInUrl(mobile, afterRemoval);
  await exactCards(mobile, removalExpected, 'removing one chip recomputes the exact remaining-filter intersection');
  check('removing one chip preserves search and disclosure status', await mobile.getByRole('textbox', { name: '企業名・事案を検索', exact: true }).inputValue() === advancedTarget.company
    && await mobile.getByRole('combobox', { name: '情報流出の確認状況', exact: true }).inputValue() === advancedTarget.disclosureStatus);
  assert.deepEqual(await mobile.locator('.thread-chip').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-pressed'))), impactsBefore, 'chip removal preserves impact filters');
  results.push('chip removal preserves impact filters');
  await openFilters(mobile); await expandAdvanced(mobile);
  for (const key of ['attackKind', 'initialAccess', 'confidence']) check(`chip removal leaves ${key} correct`, await dialog(mobile).getByLabel(labels[key], { exact: true }).inputValue() === afterRemoval[key]);
  await showResults(mobile, removalExpected.length, 'incident-results-heading');
  check('results action preserves the chosen list view', await mobile.getByRole('tab', { name: '一覧', exact: true }).getAttribute('aria-selected') === 'true');

  await reset(mobile); await count(mobile, incidents.length);
  await openFilters(mobile); await selectFilter(mobile, 'attackKind', 'unknown');
  await resultCount(mobile, matching({ ...DEFAULT_CLASSIFICATION, attackKind: 'unknown' }).length, 'mobile unknown attack filter updates live count');
  check('mobile expanded filters have no page overflow', await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await showResults(mobile, matching({ ...DEFAULT_CLASSIFICATION, attackKind: 'unknown' }).length, 'incident-results-heading');
  await openFilters(mobile);
  await selectFilter(mobile, 'initialAccess', 'unknown'); await selectFilter(mobile, 'confidence', 'unknown');
  const unknownFilters = { ...DEFAULT_CLASSIFICATION, attackKind: 'unknown', initialAccess: 'unknown', confidence: 'unknown' };
  await resultCount(mobile, matching(unknownFilters).length, 'independent unknown fields update the live count');
  await showResults(mobile, matching(unknownFilters).length, 'incident-results-heading');
  for (const key of ['attackKind', 'initialAccess', 'confidence']) {
    check(`${key}: repeated unknown labels have unambiguous chip actions`, await mobile.locator('.classification-chips').getByRole('button', { name: `${labels[key]}：${CLASSIFICATION_OPTIONS[key].unknown}の条件を解除`, exact: true }).count() === 1);
  }
  await mobile.locator('.classification-chips').getByRole('button', { name: `${labels.initialAccess}：${CLASSIFICATION_OPTIONS.initialAccess.unknown}の条件を解除`, exact: true }).click();
  await classificationInUrl(mobile, { ...unknownFilters, initialAccess: 'all' });
  check('removing one unknown chip preserves the other unknown conditions', await mobile.locator('.classification-chips button').count() === 2);
  await reset(mobile); await count(mobile, incidents.length);
  await reset(mobile); await count(mobile, incidents.length); await classificationInUrl(mobile, DEFAULT_CLASSIFICATION);
  check('repeated mobile reset clears search, status and selected chips', await mobile.getByRole('textbox', { name: '企業名・事案を検索', exact: true }).inputValue() === ''
    && await mobile.getByRole('combobox', { name: '情報流出の確認状況', exact: true }).inputValue() === 'all'
    && await mobile.locator('.classification-chips button').count() === 0);
  await screenshot(mobile, 'classification-mobile');
  check('no browser runtime errors', errors.length === 0);
  writeFileSync(`${output}/classification-results.json`, JSON.stringify({ ok: true, results, errors }, null, 2));
  console.log(`Classification UI: ${results.length} checks passed`);
} catch (error) {
  for (const [index, page] of browser.contexts().flatMap(context => context.pages()).entries()) {
    await page.screenshot({ path: `${output}/failure-${index}.png`, fullPage: true }).catch(() => {});
  }
  throw error;
} finally { await browser.close(); }
