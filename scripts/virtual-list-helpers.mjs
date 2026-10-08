import assert from 'node:assert/strict';

export const PACKAGE_SCROLL = '[data-package-scroll="packages"]';
export const ADVISORY_SCROLL = '[data-package-scroll="advisories"]';
export const MAX_MOUNTED_ROWS = 100;
export async function settleVirtualList(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (let frame = 0; frame < 3; frame++) await new Promise(resolve => requestAnimationFrame(resolve));
  });
}

// Seek through the public scroll surface, never a production imperative ref.
// Each correction uses measured rows, so wrapped mobile rows need no fixed-height assumption.
export async function seekVirtualIndex(page, selector, index, { align = 'start' } = {}) {
  const host = page.locator(selector);
  await host.waitFor();
  const count = Number(await host.getAttribute('data-virtual-count'));
  assert.ok(index >= 0 && index < count, `target ${index} belongs to ${count} virtual records`);
  await host.evaluate((node, target) => { node.scrollTop = target === 0 ? 0 : node.scrollHeight * target / Number(node.dataset.virtualCount); }, index);
  for (let attempt = 0; attempt < 30; attempt++) {
    await settleVirtualList(page);
    const found = await host.evaluate((node, { target, align }) => {
      const rows = [...node.querySelectorAll('[data-virtual-index]')];
      const row = rows.find(item => Number(item.dataset.virtualIndex) === target);
      if (row) {
        const header = node.querySelector('.research-columns');
        const inset = header?.getBoundingClientRect().height ?? 0;
        const box = row.getBoundingClientRect(), bounds = node.getBoundingClientRect();
        const offset = align === 'center' ? Math.max(inset, (node.clientHeight - box.height) / 2) : inset;
        node.scrollTop += box.top - bounds.top - node.clientTop - offset;
        return true;
      }
      // Ignore a focus-pinned row outside the current rendered window.
      const start = Number(node.dataset.virtualStart), end = Number(node.dataset.virtualEnd);
      const windowRows = rows.filter(item => Number(item.dataset.virtualIndex) >= start && Number(item.dataset.virtualIndex) < end);
      const nearest = target < start ? windowRows[0] : windowRows.at(-1);
      if (nearest) {
        const average = windowRows.reduce((sum, item) => sum + item.getBoundingClientRect().height, 0) / windowRows.length;
        node.scrollTop += (target - Number(nearest.dataset.virtualIndex)) * average;
      }
      return false;
    }, { target: index, align });
    if (found) {
      await settleVirtualList(page);
      if (await host.locator(`[data-virtual-index="${index}"]`).count()) return host.locator(`[data-virtual-index="${index}"]`).locator('button').first();
    }
  }
  throw new Error(`Could not reach virtual row ${index} through ${selector}`);
}

export async function assertVirtualRecords(page, selector, expectedKeys, cardSelector, attribute) {
  await page.waitForFunction(({ selector, count }) => Number(document.querySelector(selector)?.getAttribute('data-virtual-count')) === count,
    { selector, count: expectedKeys.length });
  await settleVirtualList(page);
  const actual = await page.locator(selector).evaluate((node, { cardSelector, attribute }) => ({
    start: Number(node.dataset.virtualStart), end: Number(node.dataset.virtualEnd),
    cardCount: node.querySelectorAll(cardSelector).length,
    rows: [...node.querySelectorAll('[data-virtual-index]')].map(row => ({
      index: Number(row.dataset.virtualIndex), key: row.dataset.virtualKey,
      cardKey: row.querySelector(cardSelector)?.getAttribute(attribute),
      position: Number(row.getAttribute('aria-posinset')), size: Number(row.getAttribute('aria-setsize')),
      role: row.getAttribute('role'), focused: row.contains(document.activeElement),
    })),
    listRole: !!node.querySelector('[role="list"]')?.getAttribute('aria-label'),
  }), { cardSelector, attribute });
  assert.ok(actual.listRole, `${selector} exposes a labelled list`);
  assert.equal(actual.cardCount, actual.rows.length, 'every mounted record is counted by the virtual window');
  assert.ok(actual.rows.length <= MAX_MOUNTED_ROWS, `${selector} renders at most ${MAX_MOUNTED_ROWS} rows, got ${actual.rows.length}`);
  assert.equal(new Set(actual.rows.map(row => row.key)).size, actual.rows.length, 'mounted record keys are unique');
  assert.equal(new Set(actual.rows.map(row => row.index)).size, actual.rows.length, 'mounted source indexes are unique');
  for (const row of actual.rows) {
    assert.equal(row.key, expectedKeys[row.index], `source key at index ${row.index}`);
    assert.equal(row.cardKey, expectedKeys[row.index], `card identity at index ${row.index}`);
    assert.equal(row.position, row.index + 1, 'accessible position matches the full result set');
    assert.equal(row.size, expectedKeys.length, 'accessible set size includes unmounted records');
    assert.equal(row.role, 'listitem');
  }
  const windowRows = actual.rows.filter(row => row.index >= actual.start && row.index < actual.end);
  assert.deepEqual(windowRows.map(row => row.index), Array.from({ length: actual.end - actual.start }, (_, index) => index + actual.start), 'rendered window has no missing or duplicated source indexes');
  assert.ok(actual.rows.filter(row => row.index < actual.start || row.index >= actual.end).length <= 1, 'at most one focus or modal-opener row may be retained outside the viewport window');
  if (expectedKeys.length) assert.ok(actual.rows.length > 0, 'nonempty results mount records');
  assert.equal(await page.locator('.research-list .result-pagination').count(), 0, 'research lists have no page controls');
  return actual;
}

// Independent oracle from original source records, not production grouping or DOM output.
export function sourcePackageGroups(records) {
  const compare = (a, b) => a === b ? 0 : a < b ? -1 : 1;
  const groups = new Map();
  for (const record of records) for (const pkg of record.affected) {
    const key = JSON.stringify([pkg.ecosystem, pkg.packageName]);
    if (!groups.has(key)) groups.set(key, { key, ...pkg, advisories: new Map() });
    groups.get(key).advisories.set(record.id, record);
  }
  return [...groups.values()].map(group => ({ ...group, advisories: [...group.advisories.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || compare(a.id, b.id)) }))
    .sort((a, b) => Date.parse(b.advisories[0].publishedAt) - Date.parse(a.advisories[0].publishedAt) || compare(a.ecosystem, b.ecosystem) || compare(a.packageName, b.packageName));
}

export async function visibleVirtualAnchor(page, selector) {
  await settleVirtualList(page);
  return page.locator(selector).evaluate(node => {
    const bounds = node.getBoundingClientRect();
    const top = bounds.top + node.clientTop + (node.querySelector('.research-columns')?.getBoundingClientRect().height ?? 0);
    const rows = [...node.querySelectorAll('[data-virtual-index]')]
      .map(row => ({ key: row.dataset.virtualKey, box: row.getBoundingClientRect() }))
      .filter(row => row.box.bottom > top + 1 && row.box.top < bounds.bottom)
      .sort((a, b) => a.box.top - b.box.top);
    return rows.length ? { key: rows[0].key, offset: top - rows[0].box.top } : null;
  });
}
