export interface VirtualListAnchor {
  key: string;
  index: number;
  offset: number;
}

export interface VirtualListRange { start: number; end: number }

/** Prefix sums let measured, wrapping rows retain their natural height. */
export class VirtualListLayout {
  readonly keys: readonly string[];
  private readonly indices: Map<string, number>;
  private readonly sizes: Float64Array;
  private readonly tree: Float64Array;
  readonly estimate: number;

  constructor(keys: readonly string[], estimate = 96, measured?: ReadonlyMap<string, number>) {
    this.keys = keys;
    this.estimate = Number.isFinite(estimate) && estimate > 0 ? estimate : 96;
    this.indices = new Map(keys.map((key, index) => [key, index]));
    if (this.indices.size !== keys.length) throw new Error('Virtual list record keys must be unique');
    this.sizes = Float64Array.from(keys, key => measured?.get(key) ?? this.estimate);
    this.tree = new Float64Array(keys.length + 1);
    this.rebuild();
  }

  private rebuild() {
    this.tree.fill(0);
    for (let index = 1; index <= this.keys.length; index++) {
      this.tree[index] += this.sizes[index - 1];
      const parent = index + (index & -index);
      if (parent < this.tree.length) this.tree[parent] += this.tree[index];
    }
  }

  indexOf(key: string) { return this.indices.get(key) ?? -1; }
  size(index: number) { return this.sizes[index] ?? 0; }
  get total() { return this.offset(this.keys.length); }

  offset(index: number) {
    let sum = 0;
    for (let cursor = Math.max(0, Math.min(this.keys.length, Math.floor(index))); cursor > 0; cursor -= cursor & -cursor) {
      sum += this.tree[cursor];
    }
    return sum;
  }

  setSize(index: number, height: number) {
    if (index < 0 || index >= this.keys.length || !Number.isFinite(height) || height <= 0) return false;
    const difference = height - this.sizes[index];
    if (Math.abs(difference) < 0.5) return false;
    this.sizes[index] = height;
    for (let cursor = index + 1; cursor < this.tree.length; cursor += cursor & -cursor) this.tree[cursor] += difference;
    return true;
  }

  resetMeasurements() {
    this.sizes.fill(this.estimate);
    this.rebuild();
  }

  /** The row containing this offset; an exact boundary belongs to the next row. */
  indexAt(offset: number) {
    if (!this.keys.length) return -1;
    let index = 0;
    let sum = 0;
    let step = 1;
    while (step * 2 <= this.keys.length) step *= 2;
    for (; step > 0; step = Math.floor(step / 2)) {
      const next = index + step;
      if (next <= this.keys.length && sum + this.tree[next] <= Math.max(0, offset)) {
        sum += this.tree[next];
        index = next;
      }
    }
    return Math.min(index, this.keys.length - 1);
  }

  range(top: number, viewport: number, overscan = 600): VirtualListRange {
    if (!this.keys.length) return { start: 0, end: 0 };
    const padding = Math.max(0, overscan);
    return {
      start: this.indexAt(Math.max(0, top - padding)),
      end: Math.min(this.keys.length, this.indexAt(Math.max(0, top) + Math.max(0, viewport) + padding) + 1),
    };
  }

  anchor(top: number): VirtualListAnchor | undefined {
    const index = this.indexAt(top);
    return index < 0 ? undefined : { key: this.keys[index], index, offset: Math.max(0, top - this.offset(index)) };
  }

  restore(anchor: VirtualListAnchor) {
    const found = this.indexOf(anchor.key);
    const index = found < 0 ? Math.max(0, Math.min(this.keys.length - 1, anchor.index)) : found;
    return this.offset(index) + Math.max(0, Math.min(anchor.offset, this.size(index) - 1));
  }
}

export type VirtualScrollAlignment = 'start' | 'center' | 'end' | 'auto';

export function virtualScrollOffset(layout: VirtualListLayout, index: number, viewport: number, options: { current: number; align?: VirtualScrollAlignment }) {
  const { current, align = 'auto' } = options;
  const start = layout.offset(index);
  const end = start + layout.size(index);
  const visibleHeight = Math.max(0, viewport);
  if (align === 'start') return start;
  if (align === 'end') return Math.max(0, end - visibleHeight);
  if (align === 'center') return Math.max(0, start - (visibleHeight - layout.size(index)) / 2);
  if (start <= current && end >= current + visibleHeight) return current;
  if (start < current || layout.size(index) > visibleHeight) return start;
  return end > current + visibleHeight ? Math.max(0, end - visibleHeight) : current;
}
