import { PX_PER_DAY, TILE_W } from './levels';
import { layoutLevel, type LevelLayout } from './layout';
import { renderTile, tileHeight, type RenderEnv } from './paint';
import { CHIP_FONT, type FromRenderer, type InitMsg, type Theme, type TileReq } from './protocol';

export interface TileImage {
  key: string;
  image: ImageBitmap | HTMLCanvasElement;
  ms: number;
}

/** Where tiles come from: a worker with OffscreenCanvas, or the main thread when that is unavailable. */
export interface TileSource {
  layouts: Promise<LevelLayout[]>;
  want: (tiles: TileReq[]) => void;
  setTheme: (theme: Theme) => void;
  subscribe: (cb: (t: TileImage) => void) => () => void;
  dispose: () => void;
}

type Init = Omit<InitMsg, 'type'>;

function makeHub() {
  const subs = new Set<(t: TileImage) => void>();
  return {
    emit: (t: TileImage) => { for (const cb of subs) cb(t); },
    subscribe: (cb: (t: TileImage) => void) => { subs.add(cb); return () => { subs.delete(cb); }; },
  };
}

function workerSource(init: Init): TileSource {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const hub = makeHub();
  const layouts = new Promise<LevelLayout[]>(resolve => {
    worker.onmessage = (e: MessageEvent<FromRenderer>) => {
      const msg = e.data;
      if (msg.type === 'layouts') resolve(msg.layouts);
      else hub.emit({ key: msg.key, image: msg.bitmap, ms: msg.ms });
    };
  });
  worker.postMessage({ type: 'init', ...init } satisfies InitMsg);
  return {
    layouts,
    want: tiles => worker.postMessage({ type: 'want', tiles }),
    setTheme: theme => worker.postMessage({ type: 'theme', theme }),
    subscribe: hub.subscribe,
    dispose: () => worker.terminate(),
  };
}

function inlineSource(init: Init): TileSource {
  const hub = makeHub();
  const scratch = document.createElement('canvas').getContext('2d');
  const measure = (s: string) => { if (!scratch) return s.length * 11; scratch.font = CHIP_FONT; return scratch.measureText(s).width; };
  const env: RenderEnv = {
    layouts: PX_PER_DAY.map((_, level) => layoutLevel(init.events, init.threads, level, measure)),
    titles: new Map(init.events.map(e => [e.id, e.title])),
    theme: init.theme,
    dpr: init.dpr,
  };
  let queue: TileReq[] = [];
  let timer = 0;
  const step = () => {
    const req = queue.shift();
    if (!req) { timer = 0; return; }
    const t0 = performance.now();
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(TILE_W * env.dpr);
    canvas.height = Math.ceil(tileHeight(req) * env.dpr);
    const ctx = canvas.getContext('2d');
    if (ctx) { renderTile(ctx, req, env); hub.emit({ key: req.key, image: canvas, ms: performance.now() - t0 }); }
    timer = window.setTimeout(step, 0);
  };
  return {
    layouts: Promise.resolve(env.layouts),
    want: tiles => { queue = tiles; if (!timer) timer = window.setTimeout(step, 0); },
    setTheme: theme => { env.theme = theme; },
    subscribe: hub.subscribe,
    dispose: () => { window.clearTimeout(timer); queue = []; },
  };
}

export function createTileSource(init: Init): TileSource {
  const offscreen = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
  return offscreen ? workerSource(init) : inlineSource(init);
}
