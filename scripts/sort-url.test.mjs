import test from 'node:test';
import assert from 'node:assert/strict';
import { readUrl, writeUrl } from '../src/lib/urlState.ts';
function at(hash = '') {
  globalThis.location = { hash };
  globalThis.history = { replaceState(_state, _title, hash) { location.hash = hash; }, pushState(_state, _title, hash) { location.hash = hash; } };
}
test('all ordering contexts round-trip independently through shared links', () => {
  at();
  writeUrl({ view:'list', kind:'vulnerability', packageKey: '["npm","example"]', sort:'company-asc', packageSort:'count-desc', advisorySort:'severity-asc' });
  const state = readUrl();
  assert.equal(state.sort, 'company-asc');
  assert.equal(state.packageSort, 'count-desc');
  assert.equal(state.advisorySort, 'severity-asc');
  writeUrl({ ...state, view:'timeline' });
  assert.equal(readUrl().packageSort, 'count-desc');
  assert.equal(readUrl().advisorySort, 'severity-asc');
});
test('legacy links retain implicit default order and invalid values normalize safely', () => {
  at('#view=list&kind=vulnerability&packagePage=8&page=2');
  assert.equal(readUrl().packageSort, undefined);
  assert.equal(readUrl().packagePage, 8);
  at('#sort=severity-desc&packageSort=company-desc&advisorySort=count-desc');
  assert.deepEqual([readUrl().sort, readUrl().packageSort, readUrl().advisorySort], ['published-desc','latest-desc','published-desc']);
});
test('default sort options do not clutter existing URLs', () => {
  at();
  writeUrl({view:'list',sort:'published-desc',packageSort:'latest-desc',advisorySort:'published-desc'});
  assert.equal(location.hash, '#view=list');
});
