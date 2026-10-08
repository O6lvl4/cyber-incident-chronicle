import test from 'node:test';
import assert from 'node:assert/strict';
import { VirtualListLayout, virtualScrollOffset } from '../src/lib/virtualList.ts';

test('the viewport reaches every record with bounded rows at the first, middle and final offsets', () => {
  const keys = Array.from({ length: 7749 }, (_, index) => `package:${index}`);
  const layout = new VirtualListLayout(keys, 100);
  for (const index of [0, 3874, 7748]) {
    const range = layout.range(layout.offset(index), 600, 400);
    assert.ok(range.start <= index && range.end > index);
    assert.ok(range.end - range.start <= 15);
    assert.equal(layout.keys[layout.indexAt(layout.offset(index))], keys[index]);
  }
  assert.equal(layout.total, 774900);
  assert.deepEqual(layout.range(-100, 0, 0), { start: 0, end: 1 });
  assert.equal(layout.range(layout.total, 600, 400).end, keys.length);
});

test('measured heights preserve exact boundaries, including unusually long records', () => {
  const layout = new VirtualListLayout(['a', 'b', 'c', 'd'], 100);
  assert.equal(layout.setSize(1, 1523.5), true);
  assert.equal(layout.total, 1823.5);
  assert.equal(layout.offset(2), 1623.5);
  assert.equal(layout.indexAt(1623.4), 1);
  assert.equal(layout.indexAt(1623.5), 2);
  assert.deepEqual(layout.range(800, 600, 0), { start: 1, end: 2 });
  assert.equal(layout.setSize(1, 0), false);
  assert.equal(layout.setSize(1, NaN), false);
  assert.equal(layout.setSize(1, 1523.7), false);
  assert.equal(layout.size(1), 1523.5);
});

test('height corrections and reflow retain the same record and intra-row offset', () => {
  const layout = new VirtualListLayout(['a', 'b', 'c', 'd'], 100);
  const anchor = layout.anchor(225);
  layout.setSize(0, 250);
  layout.setSize(1, 80);
  assert.deepEqual(anchor, { key: 'c', index: 2, offset: 25 });
  assert.equal(layout.restore(anchor), 355);
  layout.resetMeasurements();
  assert.equal(layout.restore(anchor), 225);
  layout.setSize(2, 20);
  assert.equal(layout.restore(anchor), 219);
  const reordered = new VirtualListLayout(['c', 'a', 'b', 'd'], 100);
  assert.equal(reordered.restore(anchor), 25);
});

test('keyboard destinations and saved stable keys use measured offsets', () => {
  const layout = new VirtualListLayout(['exact:name', 'other:name', 'last:name'], 100);
  layout.setSize(1, 400);
  assert.equal(layout.indexOf('other:name'), 1);
  assert.equal(layout.indexOf('missing'), -1);
  assert.equal(virtualScrollOffset(layout, 2, 200, { current: 0, align: 'end' }), 400);
  assert.equal(virtualScrollOffset(layout, 0, 200, { current: 400, align: 'start' }), 0);
  assert.equal(virtualScrollOffset(layout, 2, 200, { current: 0 }), 400);
  assert.equal(virtualScrollOffset(layout, 1, 200, { current: 450 }), 100);
  assert.equal(virtualScrollOffset(layout, 1, 200, { current: 200 }), 200);
  assert.equal(virtualScrollOffset(layout, 0, 200, { current: 0 }), 0);
  assert.throws(() => new VirtualListLayout(['a', 'a']), /unique/);
});

test('empty and single-record lists have finite ranges and offsets', () => {
  const empty = new VirtualListLayout([]);
  assert.equal(empty.total, 0);
  assert.equal(empty.indexAt(500), -1);
  assert.equal(empty.anchor(0), undefined);
  assert.deepEqual(empty.range(500, 600), { start: 0, end: 0 });
  const single = new VirtualListLayout(['only'], 120);
  assert.equal(single.indexAt(1e9), 0);
  assert.deepEqual(single.range(1e9, 600), { start: 0, end: 1 });
});
