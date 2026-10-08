import test from 'node:test';
import assert from 'node:assert/strict';
import { paginate, ADVISORY_PAGE_SIZE, SQL_PAGE_SIZE } from '../src/lib/pagination.ts';
import { filterVulnerabilities } from '../src/lib/vulnerabilities.ts';
import { loadVulnerabilities } from './vulnerability-status.mjs';

test('bounded advisory pages cover every result once, including the final partial page', () => {
  const all = Array.from({ length: 30017 }, (_, id) => ({ id }));
  const collected = [];
  for (let page = 0; page < Math.ceil(all.length / ADVISORY_PAGE_SIZE); page++) {
    const part = paginate(all, page, ADVISORY_PAGE_SIZE);
    assert.ok(part.items.length <= ADVISORY_PAGE_SIZE);
    assert.equal(part.page, page);
    collected.push(...part.items);
  }
  assert.deepEqual(collected, all);
  assert.equal(paginate(all, 999999, ADVISORY_PAGE_SIZE).end, all.length);
  assert.equal(paginate(all, -1, ADVISORY_PAGE_SIZE).page, 0);
  assert.deepEqual(paginate([], 99, ADVISORY_PAGE_SIZE).items, []);
  assert.equal(paginate(all, 0, SQL_PAGE_SIZE).items.length, 100);
});

test('a record beyond the rendered first page is still searchable by ID and package', () => {
  const records = loadVulnerabilities();
  const sorted = filterVulnerabilities(records, 'all', '');
  const last = sorted.at(-1);
  assert.ok(last);
  const result = filterVulnerabilities(records, 'all', last.id);
  assert.ok(result.some(item => item.id === last.id));
  assert.ok(filterVulnerabilities(records, last.affected[0].ecosystem, last.affected[0].packageName).some(item => item.id === last.id));
  assert.equal(paginate(result, 0, ADVISORY_PAGE_SIZE).items[0].id, last.id);
});
