import test from 'node:test';
import assert from 'node:assert/strict';
import { readUrl, writeUrl } from '../src/lib/urlState.ts';
import { createUrlNavigation } from '../src/lib/urlNavigation.ts';
import { MAX_LEVEL, ZOOM_VERSION } from '../src/engine/zoom.ts';
function browser(hash = '') {
  globalThis.location = { hash };
  globalThis.history = { replaceState: (_a, _b, next) => { location.hash = next; }, pushState: (_a, _b, next) => { location.hash = next; } };
}
for (const hash of ['', '#kind=vulnerability', '#q=widget', '#kind=vulnerability&sel=GHSA-example', '#l=bad&t=bad', '#l=-1', '#view=invalid&l=6&t=2025-09-01', '#view=&l=6']) {
  test(`default or invalid explicit view is list: ${hash || '(empty URL)'}`, () => {
    browser(hash);
    assert.equal(readUrl().view, 'list');
  });
}
for (const suffix of ['l=6', 't=2025-09-01', `l=${MAX_LEVEL}&z=${ZOOM_VERSION}&t=2026-03-12`]) {
  for (const prefix of ['', 'kind=vulnerability&']) test(`valid legacy board coordinates retain timeline: ${prefix}${suffix}`, () => {
    browser(`#${prefix}${suffix}`);
    assert.equal(readUrl().view, 'timeline');
  });
}
for (const view of ['list', 'timeline']) test(`${view} round-trips all category, package and filter state without losing coordinates`, () => {
  browser();
  const key = JSON.stringify(['npm', '@Scope/widget+core?x=y&z=#包']);
  writeUrl({ kind: 'vulnerability', view, packageKey: key, packagePage: 27, page: 3, ecosystem: 'npm', year: '2024', lifecycle: 'withdrawn',
    query: 'CVE-2024', sel: 'GHSA-example', level: 6, center: Date.parse('2026-03-12'), dark: false });
  const result = readUrl();
  assert.equal(result.view, view);
  assert.equal(result.packageKey, key);
  assert.equal(result.packagePage, 27);
  assert.equal(result.page, 3);
  assert.equal(result.query, 'CVE-2024');
  assert.equal(result.sel, 'GHSA-example');
  assert.equal(result.ecosystem, 'npm');
  assert.equal(result.year, '2024');
  assert.equal(result.lifecycle, 'withdrawn');
  assert.equal(result.level, 6);
  assert.equal(result.center, Date.parse('2026-03-12'));
  assert.equal(result.dark, false);
  const parameters = new URLSearchParams(location.hash.slice(1));
  assert.equal(parameters.get('view'), view);
  assert.equal(parameters.get('pkg'), key);
  assert.equal(parameters.get('packagePage'), '27');
});
test('explicit list beats old timeline coordinates on newly shared links', () => {
  browser('#view=list&l=6&t=2025-09-01');
  assert.equal(readUrl().view, 'list');
  writeUrl(readUrl());
  assert.equal(new URLSearchParams(location.hash.slice(1)).get('view'), 'list');
});
test('untrusted group and issue pages are bounded or ignored independently', () => {
  browser('#kind=vulnerability&packagePage=9999999999999&page=9999999999999');
  assert.equal(readUrl().packagePage, 100000);
  assert.equal(readUrl().page, 100000);
  for (const value of ['-1', 'NaN', 'Infinity', '1.5', '1e3', '']) {
    browser(`#packagePage=${value}&page=${value}`);
    assert.equal(readUrl().packagePage, undefined);
    assert.equal(readUrl().page, undefined);
  }
});
test('malformed package identities cannot become a selected package route', () => {
  for (const key of ['null', '{}', '[]', '["npm"]', '[1,"pkg"]', '["npm","pkg","extra"]', 'npm:pkg']) {
    browser(`#kind=vulnerability&pkg=${encodeURIComponent(key)}`);
    assert.equal(readUrl().packageKey, undefined, key);
  }
});
test('Back/Forward preserves view and package pages while old route effects are revoked', () => {
  const list = '#kind=vulnerability&view=list&pkg=%5B%22npm%22%2C%22vite%22%5D&packagePage=2&page=1&q=CVE&lifecycle=all';
  const timeline = '#kind=vulnerability&view=timeline&l=6&z=2&t=2025-09-01&q=CVE&lifecycle=all';
  browser(list);
  const navigation = createUrlNavigation();
  const outgoingList = navigation.initial;
  location.hash = timeline;
  const next = navigation.restore();
  outgoingList.onUrlChange({ ...outgoingList.initialUrl, page: 10 });
  assert.equal(location.hash, timeline);
  assert.equal(next.initialUrl.view, 'timeline');
  location.hash = list;
  const back = navigation.restore();
  next.onUrlChange({ ...next.initialUrl, center: Date.parse('2026-01-01') });
  assert.equal(location.hash, list);
  assert.equal(back.initialUrl.view, 'list');
  assert.equal(back.initialUrl.packageKey, '["npm","vite"]');
  assert.equal(back.initialUrl.packagePage, 2);
  assert.equal(back.initialUrl.page, 1);
  location.hash = timeline;
  const forward = navigation.restore();
  back.onUrlChange({ ...back.initialUrl, view: 'list' });
  assert.equal(location.hash, timeline);
  assert.equal(forward.initialUrl.view, 'timeline');
  assert.equal(navigation.restore(), forward, 'duplicate hashchange/popstate leaves the restored route stable');
});

test('tab and package navigation push a destination and revoke the outgoing view writer', () => {
  browser('#view=list&q=incident&industry=manufacturing');
  const pushes = [];
  history.pushState = (_a, _b, next) => { pushes.push(next); location.hash = next; };
  const navigation = createUrlNavigation();
  const initial = navigation.initial;
  const timeline = navigation.navigate({ ...initial.initialUrl, view: 'timeline' }, initial.revision);
  assert.equal(pushes.length, 1);
  assert.equal(timeline.initialUrl.view, 'timeline');
  assert.equal(timeline.initialUrl.query, 'incident');
  assert.equal(timeline.initialUrl.classification.industry, 'manufacturing');
  const destination = location.hash;
  initial.onUrlChange({ ...initial.initialUrl, query: 'stale render' });
  assert.equal(location.hash, destination);
  const staleAttempt = navigation.navigate({ ...initial.initialUrl, view: 'list' }, initial.revision);
  assert.equal(staleAttempt, timeline);
  assert.equal(pushes.length, 1, 'stale tab callback cannot push another history entry');
  const duplicate = navigation.navigate(timeline.initialUrl, timeline.revision);
  assert.equal(duplicate, timeline);
  assert.equal(pushes.length, 1, 'activating current view does not duplicate browser history');
});
