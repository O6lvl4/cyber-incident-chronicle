import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAY, PX_PER_DAY, MAX_LEVEL, ZOOM_VERSION, fitLevel } from '../src/engine/zoom.ts';
import { readUrl, writeUrl } from '../src/lib/urlState.ts';

test('the full advisory period fits even a 320px phone and chooses the finest fitting level', () => {
  const meta = JSON.parse(readFileSync(new URL('../src/data/vulnerability-meta.json', import.meta.url)));
  const span = Date.parse(meta.windowEnd) - Date.parse(meta.windowStart) + 28 * DAY;
  for (const width of [320, 375, 393, 640, 1440]) {
    const plotWidth = width - (width < 640 ? 56 : 140);
    const level = fitLevel(span, plotWidth);
    assert.ok(span / DAY * PX_PER_DAY[level] <= plotWidth, `${width}px fits the complete padded period`);
    if (level < MAX_LEVEL) assert.ok(span / DAY * PX_PER_DAY[level + 1] > plotWidth, `${width}px selects the finest fitting level`);
    const midpoint = (Date.parse(meta.windowStart) + Date.parse(meta.windowEnd)) / 2;
    const half = plotWidth / PX_PER_DAY[level] * DAY / 2;
    assert.ok(midpoint - half <= Date.parse(meta.windowStart) - 14 * DAY);
    assert.ok(midpoint + half >= Date.parse(meta.windowEnd) + 14 * DAY);
  }
});

test('every legacy shared zoom keeps its original scale and rewrites to a versioned URL', () => {
  const legacyScales = [0.25, 0.4, 0.64, 1, 1.6, 2.56, 4, 6.4, 10, 16, 26, 40];
  globalThis.history = { replaceState: (_a, _b, value) => { location.hash = value; } };
  for (const [oldLevel, scale] of legacyScales.entries()) {
    globalThis.location = { hash: `#l=${oldLevel}&t=2025-09-01` };
    const state = readUrl();
    assert.equal(PX_PER_DAY[state.level], scale);
    assert.equal(state.center, Date.parse('2025-09-01'));
    writeUrl(state);
    assert.equal(new URLSearchParams(location.hash.slice(1)).get('z'), ZOOM_VERSION);
    assert.equal(readUrl().level, state.level);
  }
});

test('all current zoom levels, including the new overview, round-trip and clamp to the defined range', () => {
  globalThis.location = { hash: '' };
  globalThis.history = { replaceState: (_a, _b, value) => { location.hash = value; } };
  for (let level = 0; level <= MAX_LEVEL; level++) {
    writeUrl({ level });
    assert.equal(readUrl().level, level);
  }
  for (const version of ['', `&z=${ZOOM_VERSION}`]) {
    location.hash = `#l=999999${version}`;
    assert.equal(readUrl().level, MAX_LEVEL);
    location.hash = `#l=NaN${version}`;
    assert.equal(readUrl().level, undefined);
  }
});
