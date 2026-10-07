import { AXIS_H, TILE_W, tileCount } from './levels';
import { tileKey, type TileReq } from './protocol';
import type { TileImage, TileSource } from './tileSource';
import { noteTile } from '../lib/perf';

export interface Row {
  id: string;
  top: number;
  height: number;
  color: string;
  axis: boolean;
}

/** Visible part of the plot, in strip coordinates. */
export interface Viewport {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Hosts {
  axis: HTMLElement;
  body: HTMLElement;
}

const CACHE_MAX = 240;
const POOL_MAX = 80;

/**
 * Keeps exactly the tiles around the viewport mounted as <canvas> elements, fed from an image
 * cache and, on a miss, from the TileSource. Nothing here runs per frame except `update`,
 * which only touches the DOM when a tile enters or leaves the margin.
 */
export class TileLayer {
  level = 0;
  onSettled: (() => void) | null = null;
  private rows: Row[] = [];
  private mounted = new Map<string, HTMLCanvasElement>();
  private cache = new Map<string, TileImage>();
  private pending = new Set<string>();
  private pool: HTMLCanvasElement[] = [];
  private lastVp: Viewport | null = null;
  private unsub: () => void;

  constructor(private source: TileSource, private hosts: Hosts, private dpr: number) {
    this.unsub = source.subscribe(t => this.receive(t));
  }

  setRows(level: number, rows: Row[]) {
    this.level = level;
    this.rows = rows;
    for (const [key, cv] of this.mounted) {
      const row = rows.find(r => r.id === cv.dataset.row);
      if (!row || !key.startsWith(`${level}/`)) this.unmount(key);
      else cv.style.top = `${row.top}px`;
    }
  }

  /** Hands the mounted canvases over (for a zoom ghost); they are no longer managed here. */
  detachAll(): HTMLCanvasElement[] {
    const out = [...this.mounted.values()];
    this.mounted.clear();
    return out;
  }

  update(vp: Viewport) {
    this.lastVp = vp;
    const need = this.needed(vp);
    for (const key of [...this.mounted.keys()]) if (!need.has(key)) this.unmount(key);
    const reqs: TileReq[] = [];
    for (const [key, { row, ix }] of need) {
      if (!this.mounted.has(key)) this.mount(key, row, ix);
      if (!this.cache.has(key)) reqs.push(this.reqFor(key, row, ix));
    }
    const cx = vp.x + vp.w / 2;
    const cy = vp.y + vp.h / 2;
    const dist = (r: TileReq) => {
      const row = need.get(r.key)!.row;
      const dy = row.axis ? 0 : row.top + row.height / 2 - cy;
      return Math.hypot((r.ix + 0.5) * TILE_W - cx, dy * 2);
    };
    reqs.sort((a, b) => dist(a) - dist(b));
    this.pending = new Set(reqs.map(r => r.key));
    if (reqs.length > 0) this.source.want(reqs);
    else this.onSettled?.();
  }

  /** Drops every cached image (theme change) and re-requests what is on screen. */
  invalidate() {
    for (const t of this.cache.values()) if (t.image instanceof ImageBitmap) t.image.close();
    this.cache.clear();
    if (this.lastVp) this.update(this.lastVp);
  }

  dispose() {
    this.unsub();
    for (const key of [...this.mounted.keys()]) this.unmount(key);
    this.invalidate();
  }

  private needed(vp: Viewport): Map<string, { row: Row; ix: number }> {
    const mx = Math.max(1, Math.ceil((0.75 * vp.w) / TILE_W));
    const ix0 = Math.max(0, Math.floor(vp.x / TILE_W) - mx);
    const ix1 = Math.min(tileCount(this.level) - 1, Math.floor((vp.x + vp.w) / TILE_W) + mx);
    const yMin = vp.y - vp.h / 2;
    const yMax = vp.y + vp.h * 1.5;
    const need = new Map<string, { row: Row; ix: number }>();
    for (const row of this.rows) {
      if (!row.axis && (row.top + row.height < yMin || row.top > yMax)) continue;
      for (let ix = ix0; ix <= ix1; ix++) need.set(tileKey(this.level, row.id, ix), { row, ix });
    }
    return need;
  }

  private reqFor(key: string, row: Row, ix: number): TileReq {
    if (row.axis) return { kind: 'axis', key, level: this.level, ix };
    return { kind: 'lane', key, level: this.level, laneId: row.id, ix, height: row.height, color: row.color };
  }

  private mount(key: string, row: Row, ix: number) {
    const cv = this.pool.pop() ?? document.createElement('canvas');
    cv.className = 'tile';
    cv.dataset.row = row.id;
    const h = row.axis ? AXIS_H : row.height;
    cv.width = Math.ceil(TILE_W * this.dpr);
    cv.height = Math.ceil(h * this.dpr);
    cv.style.width = `${TILE_W}px`;
    cv.style.height = `${h}px`;
    cv.style.left = `${ix * TILE_W}px`;
    cv.style.top = `${row.axis ? 0 : row.top}px`;
    (row.axis ? this.hosts.axis : this.hosts.body).appendChild(cv);
    this.mounted.set(key, cv);
    const img = this.cache.get(key);
    if (img) this.draw(cv, img);
  }

  private unmount(key: string) {
    const cv = this.mounted.get(key);
    if (!cv) return;
    cv.remove();
    this.mounted.delete(key);
    if (this.pool.length < POOL_MAX) this.pool.push(cv);
  }

  private receive(t: TileImage) {
    noteTile(t.ms);
    this.cache.set(t.key, t);
    if (this.cache.size > CACHE_MAX) {
      const [oldKey, old] = this.cache.entries().next().value!;
      if (old.image instanceof ImageBitmap) old.image.close();
      this.cache.delete(oldKey);
    }
    const cv = this.mounted.get(t.key);
    if (cv) this.draw(cv, t);
    this.pending.delete(t.key);
    if (this.pending.size === 0) this.onSettled?.();
  }

  private draw(cv: HTMLCanvasElement, t: TileImage) {
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(t.image, 0, 0);
  }
}
