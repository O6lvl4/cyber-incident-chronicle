/// <reference lib="webworker" />
import { PX_PER_DAY, TILE_W } from './levels';
import { layoutLevel, type LevelLayout } from './layout';
import { renderTile, tileHeight, type RenderEnv } from './paint';
import { CHIP_FONT, type FromRenderer, type InitMsg, type TileReq, type ToRenderer } from './protocol';

/** Tile renderer: lays out every level once, then paints requested tiles off the main thread. */

let env: RenderEnv | null = null;
let queue: TileReq[] = [];
let pumping = false;

const scratch = new OffscreenCanvas(1, 1).getContext('2d')!;
const widths = new Map<string, number>();
function measure(s: string): number {
  let w = widths.get(s);
  if (w === undefined) {
    scratch.font = CHIP_FONT;
    w = scratch.measureText(s).width;
    widths.set(s, w);
  }
  return w;
}

function post(msg: FromRenderer, transfer: Transferable[] = []) {
  (self as unknown as Worker).postMessage(msg, transfer);
}

function init(msg: InitMsg) {
  const layouts: LevelLayout[] = PX_PER_DAY.map((_, level) => layoutLevel(msg.events, msg.threads, level, measure));
  env = { layouts, titles: new Map(msg.events.map(e => [e.id, e.title])), theme: msg.theme, dpr: msg.dpr };
  post({ type: 'layouts', layouts });
}

function render(req: TileReq) {
  if (!env) return;
  const t0 = performance.now();
  const h = tileHeight(req);
  const canvas = new OffscreenCanvas(Math.ceil(TILE_W * env.dpr), Math.ceil(h * env.dpr));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  renderTile(ctx, req, env);
  const bitmap = canvas.transferToImageBitmap();
  post({ type: 'tile', key: req.key, bitmap, ms: performance.now() - t0 }, [bitmap]);
}

function pump() {
  if (pumping) return;
  pumping = true;
  const step = () => {
    const req = queue.shift();
    if (!req) { pumping = false; return; }
    render(req);
    setTimeout(step, 0);
  };
  step();
}

self.onmessage = (e: MessageEvent<ToRenderer>) => {
  const msg = e.data;
  if (msg.type === 'init') { init(msg); return; }
  if (msg.type === 'theme') { if (env) env.theme = msg.theme; return; }
  queue = msg.tiles;
  pump();
};
