import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadVulnerabilities } from './vulnerability-status.mjs';
import { PACKAGE_SCROLL, ADVISORY_SCROLL, MAX_MOUNTED_ROWS, assertVirtualRecords, seekVirtualIndex, settleVirtualList, sourcePackageGroups } from './virtual-list-helpers.mjs';

const base = process.env.UI_URL ?? 'http://127.0.0.1:4173/';
const output = `${process.env.UI_OUTPUT ?? 'artifacts/ui'}/continuous-scroll`;
mkdirSync(output, { recursive: true });
const checks = [], errors = [], failures = [], measurements = [], screenshots = [];
const check = (label, value) => { assert.ok(value, label); checks.push(label); };
const sharedName = 'virtual-scroll-fixture/all-records';
const fixturePackages = index => [
  { ecosystem: 'npm', packageName: `${String(index).padStart(5, '0')}/${index % 3 ? 'short' : 'deliberately-long-package-path/'.repeat(7)}virtual-scroll-fixture` },
  { ecosystem: 'npm', packageName: sharedName },
];
// SYNTHETIC BROWSER STRESS FIXTURE: source IDs, publication order, titles and lifecycle
// remain real; package memberships are replaced only in the intercepted index response.
// These 18k-list counts are capacity evidence, not production package counts.
const source = loadVulnerabilities();
assert.ok(source.length >= 18_000, 'stress gate must use at least 18,000 source advisories');
const fixture = source.map((item, index) => ({ ...item, affected: fixturePackages(index) }));
const groups = sourcePackageGroups(fixture);
const groupKeys = groups.map(group => group.key);
const shared = groups.find(group => group.packageName === sharedName);
const issueKeys = shared.advisories.map(item => item.id);
const sharedIndex = groups.findIndex(group => group.key === shared.key);
const route = state => { const target = new URL(base); target.hash = new URLSearchParams(state).toString(); return target.href; };

async function screenshot(page, name) {
  await settleVirtualList(page);
  const file = `${name}.png`;
  await page.screenshot({ path: `${output}/${file}`, fullPage: false, animations: 'disabled' });
  screenshots.push(file);
}
async function viewportRows(page, selector, label) {
  const geometry = await page.locator(selector).evaluate(node => {
    const bounds = node.getBoundingClientRect();
    const header = node.querySelector('.research-columns');
    const top = Math.max(0, bounds.top + node.clientTop + (header?.getBoundingClientRect().height ?? 0));
    const bottom = Math.min(innerHeight, bounds.top + node.clientTop + node.clientHeight);
    const rows = [...node.querySelectorAll('[data-virtual-index]')].map(row => {
      const box = row.getBoundingClientRect();
      return { index: Number(row.dataset.virtualIndex), top: box.top, bottom: box.bottom, height: box.height };
    }).filter(row => row.bottom > top + 1 && row.top < bottom - 1).sort((a, b) => a.top - b.top);
    return { top, bottom, rows, total: Number(node.dataset.virtualCount), mounted: node.querySelectorAll('[data-virtual-index]').length,
      domNodes: document.querySelectorAll('*').length,
      overflow: [document.documentElement, node].some(element => element.scrollWidth > element.clientWidth + 1),
      sequential: rows.every((row, index) => !index || Math.abs(row.top - rows[index - 1].bottom) <= 1),
    };
  });
  measurements.push({ label, ...geometry });
  check(`${label}: virtual rows fill the scrollport without gaps or overlaps`, geometry.rows.length > 0 && geometry.sequential
    && geometry.rows[0].top <= geometry.top + 1
    && (geometry.rows.at(-1).bottom >= geometry.bottom - 1 || geometry.rows.at(-1).index === geometry.total - 1));
  check(`${label}: 18k results keep mounted rows and total DOM bounded`, geometry.mounted <= MAX_MOUNTED_ROWS && geometry.domNodes < 3000);
  check(`${label}: wrapped records do not overflow horizontally`, !geometry.overflow);
  return geometry.rows.map(row => Math.round(row.height));
}
async function keyboardRows(page, selector, keys, cardSelector, attribute, label) {
  const start = await seekVirtualIndex(page, selector, 50, { align: 'center' });
  await start.focus();
  for (const [key, index] of [['ArrowDown', 51], ['ArrowUp', 50], ['End', keys.length - 1], ['ArrowDown', keys.length - 1], ['Home', 0], ['ArrowUp', 0]]) {
    await page.keyboard.press(key);
    await page.waitForFunction(({ attribute, expected }) => document.activeElement?.getAttribute(attribute) === expected, { attribute, expected: keys[index] });
    await settleVirtualList(page);
    check(`${label}: ${key} focuses source row ${index + 1}`, await page.evaluate(() => {
      const node = document.activeElement, box = node.getBoundingClientRect(), host = node.closest('[data-virtual-count]'), bounds = host.getBoundingClientRect();
      return node.isConnected && box.bottom > bounds.top && box.top < bounds.bottom;
    }));
    await assertVirtualRecords(page, selector, keys, cardSelector, attribute);
  }
  // Pointer scrolling must not detach the focused button when its row leaves overscan.
  await seekVirtualIndex(page, selector, Math.floor(keys.length / 2));
  check(`${label}: focus survives scrolling its record outside the rendered window`, await page.evaluate(({ attribute, expected }) => document.activeElement?.isConnected && document.activeElement.getAttribute(attribute) === expected, { attribute, expected: keys[0] }));
  await assertVirtualRecords(page, selector, keys, cardSelector, attribute);
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(({ attribute, expected }) => document.activeElement?.getAttribute(attribute) === expected, { attribute, expected: keys[1] });
  check(`${label}: ArrowDown resumes from the retained focused record`, true);
}

for (const [engine, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
  let browser, page;
  const requests = [];
  try {
    browser = await browserType.launch(engine === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', reducedMotion: 'reduce' });
    page.setDefaultTimeout(20_000);
    page.on('pageerror', error => errors.push(`${engine}: ${error.message}`));
    page.on('request', request => requests.push(request.url()));
    await page.route(/\/advisories\/[a-f0-9]{64}\/index\.json/, async route => {
      const response = await route.fetch();
      const index = await response.json();
      assert.deepEqual(index.records.map(item => item.id), source.map(item => item.id), 'fixture must preserve actual browse-index source identities');
      index.records = index.records.map((item, position) => ({ ...item, affected: fixturePackages(position) }));
      await route.fulfill({ response, json: index });
    });
    await page.goto(route({ kind: 'vulnerability', view: 'list', lifecycle: 'all' }));
    await page.locator('.package-card').first().waitFor();
    await assertVirtualRecords(page, PACKAGE_SCROLL, groupKeys, '.package-card', 'data-package-key');
    check(`${engine}: synthetic package list includes all ${groupKeys.length} groups`, Number(await page.locator('.package-list').getAttribute('data-package-count')) === groupKeys.length);
    await screenshot(page, `${engine}-synthetic-18k-packages-desktop-initial`);
    const heights = new Set();
    for (const [name, index] of [['first', 0], ['former-boundary', 50], ['middle', Math.floor(groupKeys.length / 2)], ['end', groupKeys.length - 1]]) {
      const row = await seekVirtualIndex(page, PACKAGE_SCROLL, index);
      check(`${engine}: synthetic ${name} package is exact`, await row.getAttribute('data-package-key') === groupKeys[index]);
      await assertVirtualRecords(page, PACKAGE_SCROLL, groupKeys, '.package-card', 'data-package-key');
      for (const height of await viewportRows(page, PACKAGE_SCROLL, `${engine} packages ${name}`)) heights.add(height);
    }
    await screenshot(page, `${engine}-synthetic-18k-packages-desktop-end`);
    await keyboardRows(page, PACKAGE_SCROLL, groupKeys, '.package-card', 'data-package-key', `${engine} package keyboard`);
    const middle = Math.floor(groupKeys.length / 2);
    const row = await seekVirtualIndex(page, PACKAGE_SCROLL, middle, { align: 'center' }); await row.focus();
    for (const width of [320, 393, 1440]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 900 }); await settleVirtualList(page);
      await assertVirtualRecords(page, PACKAGE_SCROLL, groupKeys, '.package-card', 'data-package-key');
      for (const height of await viewportRows(page, PACKAGE_SCROLL, `${engine} deep packages resized to ${width}`)) heights.add(height);
      check(`${engine}: ${width}px resize retains the focused package`, await page.evaluate(expected => document.activeElement?.getAttribute('data-package-key') === expected && document.activeElement.isConnected, groupKeys[middle]));
      await screenshot(page, `${engine}-synthetic-18k-packages-${width}-deep`);
    }
    check(`${engine}: measurement handles genuinely variable row heights`, heights.size > 1);
    const sharedRow = await seekVirtualIndex(page, PACKAGE_SCROLL, sharedIndex); await sharedRow.click();
    await page.locator(ADVISORY_SCROLL).waitFor();
    await assertVirtualRecords(page, ADVISORY_SCROLL, issueKeys, '.vulnerability-card', 'data-advisory-id');
    check(`${engine}: synthetic shared package contains every source advisory once`, Number(await page.locator('.package-advisory-list').getAttribute('data-filtered')) === source.length);
    await screenshot(page, `${engine}-synthetic-18k-advisories-desktop-initial`);
    for (const [name, index] of [['first', 0], ['former-boundary', 50], ['middle', Math.floor(issueKeys.length / 2)], ['end', issueKeys.length - 1]]) {
      const issue = await seekVirtualIndex(page, ADVISORY_SCROLL, index);
      check(`${engine}: synthetic ${name} issue is exact`, await issue.getAttribute('data-advisory-id') === issueKeys[index]);
      await assertVirtualRecords(page, ADVISORY_SCROLL, issueKeys, '.vulnerability-card', 'data-advisory-id');
      await viewportRows(page, ADVISORY_SCROLL, `${engine} advisories ${name}`);
    }
    await screenshot(page, `${engine}-synthetic-18k-advisories-desktop-end`);
    await keyboardRows(page, ADVISORY_SCROLL, issueKeys, '.vulnerability-card', 'data-advisory-id', `${engine} advisory keyboard`);
    await seekVirtualIndex(page, ADVISORY_SCROLL, Math.floor(issueKeys.length / 2));
    for (const width of [320, 393, 1440]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 900 }); await settleVirtualList(page);
      await assertVirtualRecords(page, ADVISORY_SCROLL, issueKeys, '.vulnerability-card', 'data-advisory-id');
      await viewportRows(page, ADVISORY_SCROLL, `${engine} deep advisories resized to ${width}`);
      await screenshot(page, `${engine}-synthetic-18k-advisories-${width}-deep`);
    }
    await page.getByRole('textbox', { name: 'ライブラリ・脆弱性を検索' }).fill(issueKeys.at(-1));
    await page.waitForFunction(() => { const node = document.querySelector('[data-virtual-count]'); return node && node.scrollTop === 0 && Number(node.dataset.virtualCount) <= 2; });
    if (await page.locator('.package-card').count()) { await page.locator('.package-card').first().click(); await page.locator('.vulnerability-card').waitFor(); }
    check(`${engine}: high-index search returns the exact source advisory after deep scrolling`, await page.locator('.vulnerability-card').count() === 1 && await page.locator('.vulnerability-card').getAttribute('data-advisory-id') === issueKeys.at(-1));
    check(`${engine}: synthetic stress browsing fetches no full SQL corpus or detail shards`, !requests.some(value => /vulnerability-imported|\/advisories\/[a-f0-9]{64}\/[a-f0-9]{2}\.json/.test(value)));
  } catch (error) {
    failures.push({ label: engine, error: error.stack });
    await page?.screenshot({ path: `${output}/${engine}-failure.png`, fullPage: false }).catch(() => {});
  } finally { await browser?.close(); }
}
writeFileSync(`${output}/results.json`, JSON.stringify({ ok: failures.length === 0 && errors.length === 0, fixture: 'Synthetic package membership stress test; source advisory identities and content are preserved', sourceRecords: source.length, syntheticGroups: groupKeys.length, checks, errors, failures, measurements, screenshots }, null, 2));
for (const failure of failures) console.error(`${failure.label}: ${failure.error}`);
assert.equal(failures.length, 0, 'all continuous-scroll browser cases pass');
assert.equal(errors.length, 0, `no continuous-scroll runtime errors: ${errors.join('; ')}`);
console.log(`Continuous scroll UI: ${checks.length} checks passed in Chromium and WebKit`);
