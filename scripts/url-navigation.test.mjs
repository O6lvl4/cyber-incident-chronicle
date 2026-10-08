import test from 'node:test';
import assert from 'node:assert/strict';
import { createUrlNavigation } from '../src/lib/urlNavigation.ts';

function browser(hash) {
  globalThis.location = { hash };
  globalThis.history = { replaceState: (_a, _b, next) => { location.hash = next; } };
}

test('destination query, selection and filters survive an outgoing route effect before mount', () => {
  browser('#kind=vulnerability&q=GHSA-old&sel=GHSA-old&year=2024&lifecycle=withdrawn&page=3');
  const navigation = createUrlNavigation();
  const outgoing = navigation.initial;
  const destination = '#q=Incident&sel=incident-event&lanes=leak&status=possible&theme=dark&l=6&z=2&t=2025-09-01';
  location.hash = destination;
  const incident = navigation.restore();
  // React can flush this old effect after navigation but before mounting IncidentApp.
  outgoing.onUrlChange({ ...outgoing.initialUrl, center: Date.parse('2026-01-01') });
  assert.equal(location.hash, destination);
  assert.equal(incident.initialUrl.kind, undefined);
  assert.equal(incident.initialUrl.query, 'Incident');
  assert.equal(incident.initialUrl.sel, 'incident-event');
  assert.equal(incident.initialUrl.status, 'possible');
  assert.deepEqual(incident.initialUrl.lanes, ['leak']);
  assert.equal(incident.initialUrl.level, 6);
  incident.onUrlChange({ ...incident.initialUrl, query: 'Updated incident' });
  assert.equal(new URLSearchParams(location.hash.slice(1)).get('q'), 'Updated incident');
});

test('duplicate popstate/hashchange and canonical URL writes do not remount the same route', () => {
  browser('#q=initial');
  const navigation = createUrlNavigation();
  location.hash = '#kind=vulnerability&q=GHSA-next&year=2023&lifecycle=all&page=2';
  const advisory = navigation.restore();
  assert.equal(navigation.restore(), advisory);
  advisory.onUrlChange({ ...advisory.initialUrl, dark: false });
  assert.equal(navigation.restore(), advisory);
  assert.equal(advisory.initialUrl.year, '2023');
  assert.equal(advisory.initialUrl.lifecycle, 'all');
  assert.equal(advisory.initialUrl.page, 2);
});

test('Back/Forward and rapid destinations revoke every older writer while a lazy route is pending', () => {
  const incidentHash = '#q=incident&sel=incident-event';
  const advisoryHash = '#kind=vulnerability&q=GHSA-new&sel=GHSA-new';
  browser(incidentHash);
  const navigation = createUrlNavigation();
  const first = navigation.initial;
  location.hash = advisoryHash;
  const pendingAdvisory = navigation.restore();
  location.hash = incidentHash;
  const back = navigation.restore();
  pendingAdvisory.onUrlChange(pendingAdvisory.initialUrl);
  first.onUrlChange({ query: 'late original effect' });
  assert.equal(location.hash, incidentHash);
  assert.equal(back.initialUrl.sel, 'incident-event');
  location.hash = advisoryHash;
  const forward = navigation.restore();
  back.onUrlChange(back.initialUrl);
  assert.equal(location.hash, advisoryHash);
  assert.equal(forward.initialUrl.sel, 'GHSA-new');
  assert.ok(forward.revision > back.revision);
});
