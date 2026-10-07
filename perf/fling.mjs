// Performance budget: fling the board on an emulated phone and fail when frames or tiles blow the budget.
// Run against a preview server: `pnpm build && pnpm preview --port 4173` then `node perf/fling.mjs`.
import { chromium, devices } from 'playwright';

// A month-scale level so the strip is many screens wide and every fling has to fetch fresh tiles.
const URL = process.env.PERF_URL ?? 'http://127.0.0.1:4173/?perf=1#l=6&t=2025-09-01';
const BUDGET = { longFrames: 10, tileP95: 50 };
const FLINGS = 4;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ ...devices['Pixel 5'] });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'load' });
await page.waitForSelector('.tile-host .tile', { timeout: 20000 });
await page.waitForTimeout(800);

const box = await page.locator('.board').boundingBox();
if (!box) throw new Error('board not found');
await page.evaluate(() => { const p = window.__perf; p.longFrames = 0; p.tiles = 0; p.tileMax = 0; });
const scrollLeft = () => page.evaluate(() => document.querySelector('.board').scrollLeft);
const start = await scrollLeft();

const cdp = await ctx.newCDPSession(page);
/** A finger swipe: fast leftward moves then lift, so the browser flings with momentum. */
async function fling() {
  const y = box.y + box.height * 0.5;
  let x = box.x + box.width * 0.85;
  let t = Date.now() / 1000;
  const touch = (type, tp) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: tp, timestamp: t });
  await touch('touchStart', [{ x, y }]);
  for (let i = 0; i < 12; i++) {
    x -= 22;
    t += 0.012;
    await touch('touchMove', [{ x, y }]);
  }
  t += 0.008;
  await touch('touchEnd', []);
}
for (let i = 0; i < FLINGS; i++) { await fling(); await page.waitForTimeout(1000); }
const s = await page.evaluate(() => ({ ...window.__perf }));
const travelled = Math.abs(await scrollLeft() - start);
await browser.close();

const rows = [
  ['long frames (>34 ms)', s.longFrames, `<= ${BUDGET.longFrames}`, s.longFrames <= BUDGET.longFrames],
  ['tile p95 (ms)', s.tileP95.toFixed(1), `<= ${BUDGET.tileP95}`, s.tileP95 <= BUDGET.tileP95],
  ['scrolled (px)', Math.round(travelled), '> 800', travelled > 800],
  ['tiles rendered', s.tiles, '> 0', s.tiles > 0],
  ['tile max (ms)', s.tileMax.toFixed(1), '', true],
];
for (const [name, value, budget, ok] of rows) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(22)} ${String(value).padStart(8)}  ${budget}`);
if (rows.some(r => !r[3])) { console.error('performance budget exceeded'); process.exit(1); }
