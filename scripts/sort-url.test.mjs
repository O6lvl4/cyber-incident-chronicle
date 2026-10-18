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

test('event-date sorts round-trip through shared links while retaining selection and filters', () => {
  const retained = {
    view: 'list', query: '被害 公表', status: 'confirmed', lanes: ['leak', 'outage'],
    sel: 'incident-selected', dark: true, classification: {
      industry: 'manufacturing', manufacturingType: 'electronics', listingStatus: 'listed',
      attackKind: 'ransomware', initialAccess: 'vulnerability', confidence: 'confirmed',
    },
    ecosystem: 'npm', year: '2024', lifecycle: 'all', page: 3,
    packageKey: '["npm","example"]', packagePage: 2,
    packageSort: 'count-desc', advisorySort: 'severity-asc',
  };
  for (const sort of ['attack-asc', 'attack-desc', 'damage-asc', 'damage-desc']) {
    at();
    writeUrl({ ...retained, sort });
    assert.equal(new URLSearchParams(location.hash.slice(1)).get('sort'), sort);
    const state = readUrl();
    assert.equal(state.sort, sort);
    for (const [key, value] of Object.entries(retained)) assert.deepEqual(state[key], value, `${sort}: ${key}`);
    writeUrl({ ...state, view: 'timeline' }, 'push');
    assert.equal(readUrl().sort, sort);
    assert.deepEqual(readUrl().classification, retained.classification);
    assert.equal(readUrl().sel, retained.sel);
  }
});

test('event-date keys are incident-only and malformed values retain safe URL defaults', () => {
  for (const sort of ['attack-asc', 'attack-desc', 'damage-asc', 'damage-desc']) {
    at(`#sort=${sort}&packageSort=${sort}&advisorySort=${sort}`);
    const state = readUrl();
    assert.deepEqual([state.sort, state.packageSort, state.advisorySort], [sort, 'latest-desc', 'published-desc']);
    writeUrl(state);
    const params = new URLSearchParams(location.hash.slice(1));
    assert.equal(params.get('sort'), sort);
    assert.equal(params.has('packageSort'), false);
    assert.equal(params.has('advisorySort'), false);
  }
  for (const sort of ['ATTACK-ASC', 'damage', 'damageConfirmed-desc', 'occurred-asc', 'detected-desc']) {
    at(`#sort=${sort}`);
    assert.equal(readUrl().sort, 'published-desc');
  }
});
