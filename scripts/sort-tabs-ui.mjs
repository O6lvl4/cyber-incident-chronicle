import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadData } from './data-status.mjs';
import { loadVulnerabilities } from './vulnerability-status.mjs';
import { PACKAGE_SCROLL, ADVISORY_SCROLL, assertVirtualRecords, seekVirtualIndex, settleVirtualList, sourcePackageGroups, visibleVirtualAnchor } from './virtual-list-helpers.mjs';

// Production-corpus sorting is checked before virtual-window sampling. Keep the
// matrix bounded: every sort in Chromium, representative sorts in WebKit, and
// four distinct viewport layouts rather than every engine/sort/size combination.
const base = process.env.UI_URL ?? 'http://127.0.0.1:4173/';
const output = `${process.env.UI_OUTPUT ?? 'artifacts/ui'}/sort-tabs`;
mkdirSync(output, { recursive: true });
const checks = [], errors = [], failures = [], measurements = [], screenshots = [];
const check = (label, value) => { assert.ok(value, label); checks.push(label); };
const incidents = loadData().incidents;
const advisories = loadVulnerabilities();
const groups = sourcePackageGroups(advisories);
const abundant = [...groups].sort((a, b) => b.advisories.length - a.advisories.length)[0];
assert.ok(advisories.length >= 18_000 && groups.length > 5_000 && abundant.advisories.length > 100, 'sorting gate uses the full production corpus');
const incidentSorts = ['published-desc', 'published-asc', 'company-asc', 'company-desc'];
const packageSorts = ['latest-desc', 'latest-asc', 'name-asc', 'name-desc', 'count-desc', 'count-asc'];
const advisorySorts = ['published-desc', 'published-asc', 'severity-desc', 'severity-asc'];
const rank = { low: 1, medium: 2, high: 3, critical: 4 };
const text = (a, b) => a === b ? 0 : a < b ? -1 : 1;
const company = new Intl.Collator('ja');
const direction = key => key.endsWith('-asc') ? 1 : -1;
// These oracles deliberately do not import production sorting utilities.
const orderedIncidents = key => [...incidents].sort((a, b) => direction(key) * (key.startsWith('company')
  ? company.compare(a.company, b.company) : text(a.announcementDate, b.announcementDate)) || text(a.id, b.id));
const orderedGroups = (records, key) => [...records].sort((a, b) => direction(key) * (key.startsWith('name')
  ? text(a.packageName, b.packageName) : key.startsWith('count') ? a.advisories.length - b.advisories.length
    : Date.parse(a.advisories[0].publishedAt) - Date.parse(b.advisories[0].publishedAt)) || text(a.key, b.key));
const orderedAdvisories = (records, key) => [...records].sort((a, b) => {
  if (key.startsWith('severity')) {
    const av = rank[a.severity.label], bv = rank[b.severity.label];
    if (av === undefined || bv === undefined) return av === bv ? text(a.id, b.id) : av === undefined ? 1 : -1;
    return direction(key) * (av - bv) || text(a.id, b.id);
  }
  return direction(key) * (Date.parse(a.publishedAt) - Date.parse(b.publishedAt)) || text(a.id, b.id);
});
const route = state => { const target = new URL(base); target.hash = new URLSearchParams(state).toString(); return target.href; };
const sortControl = page => page.getByRole('combobox', { name: '一覧の並び順', exact: true });
const tab = (page, name) => page.getByRole('tab', { name, exact: true });
const detailRequest = value => /\/advisories\/[a-f0-9]{64}\/[a-f0-9]{2}\.json/.test(value);
const urlValue = (page, field) => page.evaluate(key => new URLSearchParams(location.hash.slice(1)).get(key), field);

async function prepare(page, label) {
  page.setDefaultTimeout(20_000);
  page.on('pageerror', error => errors.push(`${label}: ${error.message}`));
  await page.addInitScript(() => {
    window.__sortPaintedTiles = new WeakSet();
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args) {
      const result = draw.apply(this, args);
      if (this.canvas.classList?.contains('tile')) window.__sortPaintedTiles.add(this.canvas);
      return result;
    };
  });
}
async function screenshot(page, name) {
  await settleVirtualList(page);
  if (await tab(page, 'タイムライン').getAttribute('aria-selected') === 'true') await page.waitForFunction(() => {
    const tiles = [...document.querySelectorAll('.tile-host .tile, .axis-tiles .tile')].filter(tile => tile.getBoundingClientRect().width > 0);
    return tiles.length > 0 && tiles.every(tile => window.__sortPaintedTiles.has(tile)) && !document.querySelector('.tile-ghost .tile');
  });
  const file = `${name}.png`;
  await page.screenshot({ path: `${output}/${file}`, fullPage: false, animations: 'disabled' });
  screenshots.push(file);
}
async function options(page, expected, label) {
  assert.deepEqual(await sortControl(page).locator('option').evaluateAll(nodes => nodes.map(node => node.value)), expected, `${label}: contextual sort options`);
  checks.push(`${label}: contextual sort options`);
}
async function selectSort(page, value, parameter, selector, label) {
  const previous = await sortControl(page).inputValue();
  if (previous !== value) {
    await page.locator(selector).evaluate(node => { node.scrollTop = node.scrollHeight; });
    await settleVirtualList(page);
  }
  await sortControl(page).selectOption(value);
  await page.waitForFunction(({ parameter, expected }) => new URLSearchParams(location.hash.slice(1)).get(parameter) === expected,
    { parameter, expected: value === (parameter === 'packageSort' ? 'latest-desc' : 'published-desc') ? null : value });
  if (previous !== value) await page.waitForFunction(selector => document.querySelector(selector)?.scrollTop === 0, selector);
  check(`${label}: chosen sort is shown and a change starts at the first record`, await sortControl(page).inputValue() === value
    && (previous === value || await page.locator(selector).evaluate(node => node.scrollTop === 0)));
}
async function sampleVirtual(page, selector, records, cardSelector, attribute, label) {
  const keys = records.map(item => item.key ?? item.id);
  for (const [position, index] of [['first', 0], ['middle', Math.floor(keys.length / 2)], ['end', keys.length - 1]]) {
    const row = await seekVirtualIndex(page, selector, index);
    check(`${label}: ${position} is exact source key ${index + 1}/${keys.length}`, await row.getAttribute(attribute) === keys[index]);
    await assertVirtualRecords(page, selector, keys, cardSelector, attribute);
  }
  checks.push(`${label}: full result count, deterministic neighboring ties, and bounded virtual windows`);
}
async function incidentOrder(page, sort, label) {
  const expected = orderedIncidents(sort).map(item => item.id);
  await page.waitForFunction(count => document.querySelectorAll('.research-incidents .incident-card').length === count, expected.length);
  assert.deepEqual(await page.locator('.research-incidents .incident-card').evaluateAll(nodes => nodes.map(node => node.dataset.incidentId)), expected, `${label}: every source incident appears in the chosen order`);
  checks.push(`${label}: every source incident appears in the chosen order, including equal-key ties`);
}
async function anchorEqual(page, selector, expected, label) {
  const actual = await visibleVirtualAnchor(page, selector);
  check(label, actual?.key === expected?.key && Math.abs(actual.offset - expected.offset) <= 2);
}
async function sourceSortCase(browser, engine) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', reducedMotion: 'reduce' });
  const requests = []; page.on('request', request => requests.push(request.url()));
  try {
    await prepare(page, engine);
    await page.goto(route({})); await page.locator('.research-incidents .incident-card').first().waitFor();
    check(`${engine}: old incident link defaults to publication descending`, await sortControl(page).inputValue() === 'published-desc');
    await options(page, incidentSorts, `${engine} incidents`);
    for (const sort of engine === 'chromium' ? incidentSorts : ['company-asc', 'published-asc']) {
      await selectSort(page, sort, 'sort', '.research-incidents .incident-scroll', `${engine} incidents ${sort}`);
      await incidentOrder(page, sort, `${engine} incidents ${sort}`);
    }
    await page.reload(); await page.locator('.research-incidents .incident-card').first().waitFor();
    await incidentOrder(page, await sortControl(page).inputValue(), `${engine} incident reload`);
    const incidentSort = await sortControl(page).inputValue();
    await page.locator('.research-incidents .incident-card').nth(30).click(); await page.locator('.drawer.open').waitFor();
    const incidentOffset = await page.locator('.research-incidents .incident-scroll').evaluate(node => node.scrollTop);
    await page.keyboard.press('Escape'); await page.locator('.drawer.open').waitFor({ state: 'hidden' });
    check(`${engine}: incident detail dismissal retains sort and scroll`, await sortControl(page).inputValue() === incidentSort
      && await page.locator('.research-incidents .incident-scroll').evaluate(node => node.scrollTop) === incidentOffset);
    await page.goto(route({ sort: 'invalid-sort' })); await page.locator('.research-incidents .incident-card').first().waitFor();
    check(`${engine}: invalid incident sort safely uses the old default`, await sortControl(page).inputValue() === 'published-desc');
    await incidentOrder(page, 'published-desc', `${engine} invalid incident link`);
    await sortControl(page).selectOption('company-desc');
    await tab(page, 'タイムライン').click(); await page.locator('.board').waitFor();
    await page.locator('.timeline-container:visible').focus(); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => new URLSearchParams(location.hash.slice(1)).has('sel'));
    const firstTimelineId = await urlValue(page, 'sel');
    check(`${engine}: timeline keyboard traversal remains chronological after company sorting`, incidents.find(item => item.id === firstTimelineId)?.announcementDate
      === orderedIncidents('published-asc')[0].announcementDate);
    await page.keyboard.press('Escape'); await page.locator('.drawer.open').waitFor({ state: 'hidden' });

    await page.goto(route({ kind: 'vulnerability', lifecycle: 'all' })); await page.locator('.package-card').first().waitFor();
    check(`${engine}: old package link defaults to latest publication descending`, await sortControl(page).inputValue() === 'latest-desc');
    await options(page, packageSorts, `${engine} packages`);
    for (const sort of engine === 'chromium' ? packageSorts : ['name-asc', 'count-desc']) {
      await selectSort(page, sort, 'packageSort', PACKAGE_SCROLL, `${engine} packages ${sort}`);
      await sampleVirtual(page, PACKAGE_SCROLL, orderedGroups(groups, sort), '.package-card', 'data-package-key', `${engine} packages ${sort}`);
    }
    if (engine === 'chromium') {
      // Count sorting must use filtered memberships, not cached all-time counts.
      await page.getByRole('combobox', { name: '公開年', exact: true }).selectOption('2025');
      await page.getByRole('combobox', { name: '撤回状況', exact: true }).selectOption('active');
      await page.getByRole('combobox', { name: 'エコシステム', exact: true }).selectOption('npm');
      const filtered = advisories.filter(item => item.publishedAt.startsWith('2025-') && !item.withdrawnAt && item.affected.some(pkg => pkg.ecosystem === 'npm'));
      const filteredGroups = sourcePackageGroups(filtered).filter(group => group.ecosystem === 'npm');
      assert.ok(filteredGroups.length > 50 && filtered.length < advisories.length, 'filtered count oracle is a strict nontrivial subset');
      await selectSort(page, 'count-desc', 'packageSort', PACKAGE_SCROLL, `${engine} filtered count`);
      await sampleVirtual(page, PACKAGE_SCROLL, orderedGroups(filteredGroups, 'count-desc'), '.package-card', 'data-package-key', `${engine} filtered count`);
      const expectedCounts = Object.fromEntries(filteredGroups.map(group => [group.key, group.advisories.length]));
      const visibleCounts = await page.locator('.package-card').evaluateAll(nodes => nodes.map(node => [node.dataset.packageKey, Number(node.querySelector('.package-advisory-count b').textContent.replaceAll(',', ''))]));
      check(`${engine}: rendered package counts match filtered unique memberships`, visibleCounts.every(([key, count]) => expectedCounts[key] === count)
        && Number(await page.locator('.package-list').getAttribute('data-advisory-count')) === filtered.length);
    }
    await page.goto(route({ kind: 'vulnerability', lifecycle: 'all', packageSort: 'name-asc' })); await page.locator('.package-card').first().waitFor();
    await page.reload(); await page.locator('.package-card').first().waitFor();
    check(`${engine}: package reload restores URL sort`, await sortControl(page).inputValue() === 'name-asc');
    const named = orderedGroups(groups, 'name-asc');
    const opener = await seekVirtualIndex(page, PACKAGE_SCROLL, named.findIndex(group => group.key === abundant.key), { align: 'center' });
    await opener.focus(); const packageAnchor = await visibleVirtualAnchor(page, PACKAGE_SCROLL);
    await opener.press('Enter'); await page.locator('.vulnerability-card').first().waitFor();
    check(`${engine}: drill-in preserves package sort and defaults advisory sort`, await urlValue(page, 'packageSort') === 'name-asc'
      && await sortControl(page).inputValue() === 'published-desc');
    await options(page, advisorySorts, `${engine} advisories`);
    for (const sort of engine === 'chromium' ? advisorySorts : ['published-asc', 'severity-asc']) {
      await selectSort(page, sort, 'advisorySort', ADVISORY_SCROLL, `${engine} advisories ${sort}`);
      await sampleVirtual(page, ADVISORY_SCROLL, orderedAdvisories(abundant.advisories, sort), '.vulnerability-card', 'data-advisory-id', `${engine} advisories ${sort}`);
    }
    check(`${engine}: sorting full corpus fetches neither detail shards nor SQL corpus`, !requests.some(detailRequest)
      && !requests.some(value => value.includes('vulnerability-imported')));
    await screenshot(page, `${engine}-sorted-advisories-deep`);
    const advisorySort = await sortControl(page).inputValue();
    const sorted = orderedAdvisories(abundant.advisories, advisorySort);
    const issue = await seekVirtualIndex(page, ADVISORY_SCROLL, Math.floor(sorted.length / 2), { align: 'center' });
    const issueId = await issue.getAttribute('data-advisory-id');
    await issue.focus(); const issueAnchor = await visibleVirtualAnchor(page, ADVISORY_SCROLL);
    await issue.press('Enter'); await page.locator('.vulnerability-detail').waitFor();
    check(`${engine}: selection fetches only one bounded detail shard`, requests.filter(detailRequest).length === 1);
    await page.keyboard.press('Escape');
    await page.waitForFunction(id => document.activeElement?.getAttribute('data-advisory-id') === id, issueId);
    await anchorEqual(page, ADVISORY_SCROLL, issueAnchor, `${engine}: sorted detail close restores exact visible issue anchor`);
    check(`${engine}: detail dismissal retains both sort contexts`, await urlValue(page, 'packageSort') === 'name-asc'
      && await sortControl(page).inputValue() === advisorySort && await urlValue(page, 'advisorySort') === advisorySort);
    await tab(page, 'タイムライン').click(); await page.locator('.board').waitFor();
    check(`${engine}: timeline explains fixed date order and retains the list sort in its URL`, await sortControl(page).isDisabled()
      && await sortControl(page).inputValue() === 'timeline-date' && await urlValue(page, 'advisorySort') === advisorySort);
    await page.goBack(); await page.locator(ADVISORY_SCROLL).waitFor();
    await anchorEqual(page, ADVISORY_SCROLL, issueAnchor, `${engine}: browser Back restores sorted issue context and anchor`);
    check(`${engine}: browser Back retains package and advisory sort`, await sortControl(page).inputValue() === advisorySort
      && await urlValue(page, 'packageSort') === 'name-asc');
    await page.goForward(); await page.locator('.board').waitFor();
    await page.reload(); await page.locator('.board').waitFor();
    check(`${engine}: timeline reload preserves disabled date order and advisory sort context`, await sortControl(page).isDisabled()
      && await sortControl(page).inputValue() === 'timeline-date' && await urlValue(page, 'advisorySort') === advisorySort);
    await tab(page, '一覧').click(); await page.locator(ADVISORY_SCROLL).waitFor();
    await sampleVirtual(page, ADVISORY_SCROLL, sorted, '.vulnerability-card', 'data-advisory-id', `${engine} advisory reload`);
    // Reload intentionally clears in-memory anchors; establish a fresh opener
    // before checking the scoped Back control's restoration contract.
    await page.goto(route({ kind: 'vulnerability', lifecycle: 'all', packageSort: 'name-asc' })); await page.locator('.package-card').first().waitFor();
    const returnOpener = await seekVirtualIndex(page, PACKAGE_SCROLL, named.findIndex(group => group.key === abundant.key), { align: 'center' });
    await returnOpener.focus(); const freshPackageAnchor = await visibleVirtualAnchor(page, PACKAGE_SCROLL);
    await returnOpener.press('Enter'); await page.locator(ADVISORY_SCROLL).waitFor();
    await selectSort(page, 'severity-asc', 'advisorySort', ADVISORY_SCROLL, `${engine} independent scoped sort`);
    await page.getByRole('button', { name: 'パッケージ一覧に戻る', exact: true }).click(); await page.locator(PACKAGE_SCROLL).waitFor();
    await page.waitForFunction(key => document.activeElement?.getAttribute('data-package-key') === key, abundant.key);
    await anchorEqual(page, PACKAGE_SCROLL, freshPackageAnchor, `${engine}: package Back restores the sorted opener anchor`);
    check(`${engine}: package Back restores package sort independently of advisory sort`, await sortControl(page).inputValue() === 'name-asc');
    assert.ok(packageAnchor, 'initial sorted package produced a visible anchor');
    await page.goto(route({ kind: 'vulnerability', lifecycle: 'all', packageSort: 'company-asc', advisorySort: 'count-desc', pkg: abundant.key }));
    await page.locator(ADVISORY_SCROLL).waitFor();
    check(`${engine}: invalid contextual sort values fall back safely`, await sortControl(page).inputValue() === 'published-desc');
    await page.getByRole('button', { name: 'パッケージ一覧に戻る', exact: true }).click(); await page.locator(PACKAGE_SCROLL).waitFor();
    check(`${engine}: invalid package sort falls back to the old default`, await sortControl(page).inputValue() === 'latest-desc');
    check(`${engine}: sort and navigation never request the full SQL corpus`, !requests.some(value => value.includes('vulnerability-imported')));
  } catch (error) {
    await page.screenshot({ path: `${output}/${engine}-source-sort-failure.png`, fullPage: false }).catch(() => {});
    throw error;
  } finally { await page.close(); }
}

async function geometry(page, label) {
  await settleVirtualList(page);
  const actual = await page.evaluate(() => {
    const box = node => { const { x, y, width, height } = node.getBoundingClientRect(); return { x, y, width, height }; };
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const select = document.querySelector('select[aria-label="一覧の並び順"]');
    const header = document.querySelector('.app-header');
    const controls = [...tabs, select];
    const hittable = node => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= innerWidth + 1 && rect.top >= 0 && rect.bottom <= innerHeight + 1
        && node.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
    };
    return { tabs: tabs.map(node => ({ id: node.id, name: node.getAttribute('aria-label'), ...box(node) })), sort: box(select), controlsInHeader: controls.every(node => header.contains(node)),
      reachable: controls.every(hittable), horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      touchTargets: controls.every(node => { const rect = node.getBoundingClientRect(); return rect.width >= 44 && rect.height >= 44; }),
      panels: [...document.querySelectorAll('[role="tabpanel"]')].filter(node => node.getBoundingClientRect().height > 0).length,
      selectedOwnsPanel: tabs.filter(node => node.getAttribute('aria-selected') === 'true').every(node => {
        const panel = document.getElementById(node.getAttribute('aria-controls'));
        return panel?.getAttribute('aria-labelledby') === node.id && panel.getBoundingClientRect().height > 0;
      }),
    };
  });
  measurements.push({ label, ...actual });
  check(`${label}: exactly two stable header tabs own one visible panel`, actual.tabs.length === 2 && actual.controlsInHeader && actual.panels === 1 && actual.selectedOwnsPanel);
  check(`${label}: tabs and sort remain visible, unobstructed, and within the viewport`, actual.reachable && !actual.horizontalOverflow);
  if (page.viewportSize().width <= 640) check(`${label}: tab and sort controls retain 44px touch targets`, actual.touchTargets);
  return actual;
}
function sameGeometry(before, after, label, sameCategory = true) {
  assert.deepEqual(after.tabs.map(node => node.name), before.tabs.map(node => node.name), `${label}: tab names stay identical`);
  if (sameCategory) assert.deepEqual(after.tabs.map(node => node.id), before.tabs.map(node => node.id), `${label}: tab IDs stay identical`);
  for (const [index, node] of [...before.tabs, before.sort].entries()) {
    const other = [...after.tabs, after.sort][index];
    for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(node[key] - other[key]) <= 1, `${label}: control ${index} ${key} changed from ${node[key]} to ${other[key]}`);
  }
  checks.push(`${label}: same tab ${sameCategory ? 'IDs' : 'names'} and bounding boxes, including reserved sort space`);
}
async function geometryCase(browser, engine, viewport) {
  const label = `${engine} ${viewport.width}x${viewport.height}`;
  const page = await browser.newPage({ viewport, hasTouch: viewport.width <= 640, colorScheme: 'light', reducedMotion: 'reduce' });
  try {
    await prepare(page, label);
    await page.goto(route({ sort: 'company-desc' })); await page.locator('.research-incidents .incident-card').first().waitFor();
    const initial = await geometry(page, `${label} incident list`);
    for (const category of ['incidents', 'packages', 'advisories']) {
      if (category === 'packages') {
        await page.getByRole('button', { name: 'ライブラリの脆弱性', exact: true }).click(); await page.locator('.package-card').first().waitFor();
        await sortControl(page).selectOption('name-desc');
      } else if (category === 'advisories') {
        // A known real package with hundreds of issues exercises deep scope.
        await page.goto(route({ kind: 'vulnerability', lifecycle: 'all', pkg: abundant.key, packageSort: 'name-desc', advisorySort: 'severity-desc' }));
        await page.locator('.vulnerability-card').first().waitFor();
      }
      const list = await geometry(page, `${label} ${category} list`);
      sameGeometry(initial, list, `${label} ${category} shares the same toolbar location`, category === 'incidents');
      await screenshot(page, `${engine}-${viewport.width}x${viewport.height}-${category}-list-toolbar`);
      const selector = category === 'incidents' ? '.research-incidents .incident-scroll' : category === 'packages' ? PACKAGE_SCROLL : ADVISORY_SCROLL;
      if (category === 'incidents') await page.locator(selector).evaluate(node => { node.scrollTop = node.scrollHeight; });
      else await seekVirtualIndex(page, selector, Math.floor(Number(await page.locator(selector).getAttribute('data-virtual-count')) * 0.75));
      const deep = await geometry(page, `${label} ${category} deep list`);
      sameGeometry(list, deep, `${label} ${category} deep scroll`);
      check(`${label} ${category}: the test actually scrolled deeply`, await page.locator(selector).evaluate(node => node.scrollTop > node.clientHeight));
      await screenshot(page, `${engine}-${viewport.width}x${viewport.height}-${category}-sort-deep`);
      const selectedSort = await sortControl(page).inputValue();
      await tab(page, '一覧').focus(); await page.keyboard.press('ArrowRight'); await page.locator('.board').waitFor();
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'タイムライン');
      const timeline = await geometry(page, `${label} ${category} timeline`);
      sameGeometry(list, timeline, `${label} ${category} list-to-timeline switch`);
      const sortParameter = category === 'incidents' ? 'sort' : category === 'packages' ? 'packageSort' : 'advisorySort';
      check(`${label} ${category}: timeline reserves disabled date order and retains the chosen list sort`, await sortControl(page).isDisabled()
        && await sortControl(page).inputValue() === 'timeline-date' && await urlValue(page, sortParameter) === selectedSort);
      await screenshot(page, `${engine}-${viewport.width}x${viewport.height}-${category}-timeline-toolbar`);
      if (viewport.height <= 360) {
        await page.locator('.app').evaluate(node => { node.scrollTop = node.scrollHeight; });
        sameGeometry(timeline, await geometry(page, `${label} ${category} outer timeline scroll`), `${label} ${category} outer scroll keeps toolbar reachable`);
        await screenshot(page, `${engine}-${viewport.width}x${viewport.height}-${category}-timeline-deep-toolbar`);
      }
      await page.keyboard.press('Home'); await page.locator(selector).waitFor();
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '一覧');
      sameGeometry(list, await geometry(page, `${label} ${category} restored list`), `${label} ${category} timeline-to-list switch`);
      check(`${label} ${category}: selected tab keeps keyboard focus after panel restoration`, await tab(page, '一覧').evaluate(node => document.activeElement === node)
        && await sortControl(page).isEnabled());
    }
  } catch (error) {
    await page.screenshot({ path: `${output}/${engine}-${viewport.width}x${viewport.height}-geometry-failure.png`, fullPage: false }).catch(() => {});
    throw error;
  } finally { await page.close(); }
}

async function unknownSeverityCase(browser) {
  // Explicit synthetic summary fixture: replace only two real severity labels.
  // Source IDs, package membership, publication dates and remaining rows stay real.
  const unknownIds = new Set([abundant.advisories[0].id, abundant.advisories.at(-1).id]);
  const fixture = abundant.advisories.map(item => unknownIds.has(item.id) ? { ...item, severity: { ...item.severity, label: 'unknown' } } : item);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  try {
    await prepare(page, 'synthetic unknown severity');
    await page.route(/\/advisories\/[a-f0-9]{64}\/index\.json/, async route => {
      const response = await route.fetch(); const index = await response.json();
      assert.deepEqual(index.records.map(item => item.id), advisories.map(item => item.id), 'severity fixture preserves source identities');
      index.records = index.records.map(item => unknownIds.has(item.id) ? { ...item, severity: { ...item.severity, label: 'unknown' } } : item);
      await route.fulfill({ response, json: index });
    });
    await page.goto(route({ kind: 'vulnerability', lifecycle: 'all', pkg: abundant.key })); await page.locator(ADVISORY_SCROLL).waitFor();
    for (const sort of ['severity-asc', 'severity-desc']) {
      await selectSort(page, sort, 'advisorySort', ADVISORY_SCROLL, `synthetic ${sort}`);
      const expected = orderedAdvisories(fixture, sort);
      await sampleVirtual(page, ADVISORY_SCROLL, expected, '.vulnerability-card', 'data-advisory-id', `synthetic ${sort}`);
      check(`synthetic ${sort}: unknown severity stays last with ascending ID ties`, expected.slice(-unknownIds.size).every(item => unknownIds.has(item.id))
        && await page.locator(`${ADVISORY_SCROLL} [data-virtual-index="${expected.length - 1}"] [data-severity]`).getAttribute('data-severity') === 'unknown');
    }
    await screenshot(page, 'chromium-synthetic-unknown-severity-last');
  } catch (error) {
    await page.screenshot({ path: `${output}/unknown-severity-failure.png`, fullPage: false }).catch(() => {});
    throw error;
  } finally { await page.close(); }
}

for (const [engine, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
  let browser;
  try {
    browser = await browserType.launch(engine === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const run = async (label, action) => { try { await action(); } catch (error) { failures.push({ label, error: error.stack }); } };
    await run(`${engine} full-corpus sorting`, () => sourceSortCase(browser, engine));
    const viewports = engine === 'chromium'
      ? [{ width: 1440, height: 900 }, { width: 393, height: 851 }, { width: 320, height: 568 }, { width: 640, height: 360 }]
      : [{ width: 393, height: 851 }];
    for (const viewport of viewports) await run(`${engine} ${viewport.width}x${viewport.height} toolbar geometry`, () => geometryCase(browser, engine, viewport));
    if (engine === 'chromium') await run('synthetic unknown severity', () => unknownSeverityCase(browser));
  } catch (error) { failures.push({ label: `${engine} launch`, error: error.stack }); }
  finally { await browser?.close(); }
}
writeFileSync(`${output}/results.json`, JSON.stringify({ ok: failures.length === 0 && errors.length === 0, sourceRecords: advisories.length,
  sourcePackages: groups.length, unknownSeverityFixture: 'Only two severity labels in intercepted summaries are synthetic; source IDs and memberships are preserved',
  checks, errors, failures, measurements, screenshots }, null, 2));
for (const failure of failures) console.error(`${failure.label}: ${failure.error}`);
assert.equal(failures.length, 0, 'all sort and stable-toolbar browser cases pass');
assert.equal(errors.length, 0, `no sorting runtime errors: ${errors.join('; ')}`);
console.log(`Sort and stable tabs UI: ${checks.length} checks passed; ${screenshots.length} screenshots saved`);
