// Performance budget: fling both full-corpus boards on an emulated phone.
import { chromium, devices } from 'playwright';
const base = process.env.PERF_URL ?? 'http://127.0.0.1:4173/?perf=1#l=6&t=2025-09-01';
const scenarios = process.env.PERF_URL ? [['requested board', base]] : [
  ['incidents', base], ['advisories', `${base}&kind=vulnerability`],
];
const BUDGET = { longFrames: 10, tileP95: 50 };
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let failed = false;
try {
  for (const [name, url] of scenarios) {
    const ctx = await browser.newContext({ ...devices['Pixel 5'] });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForSelector('.tile-host .tile', { timeout: 30000 });
    await page.waitForTimeout(800);
    const box = await page.locator('.board').boundingBox();
    if (!box) throw new Error('board not found');
    await page.evaluate(() => { const p = window.__perf; p.longFrames = 0; p.tiles = 0; p.tileMax = 0; });
    const scrollLeft = () => page.evaluate(() => document.querySelector('.board').scrollLeft);
    const start = await scrollLeft();
    const cdp = await ctx.newCDPSession(page);
    async function fling() {
      const y = box.y + box.height * .5;
      let x = box.x + box.width * .85, t = Date.now() / 1000;
      const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points, timestamp: t });
      await touch('touchStart', [{ x, y }]);
      for (let i = 0; i < 12; i++) { x -= 22; t += .012; await touch('touchMove', [{ x, y }]); }
      t += .008; await touch('touchEnd', []);
    }
    for (let i = 0; i < 4; i++) { await fling(); await page.waitForTimeout(1000); }
    const stats = await page.evaluate(() => ({ ...window.__perf }));
    const travelled = Math.abs(await scrollLeft() - start);
    const dom = await page.locator('*').count();
    const rows = [
      ['long frames (>34 ms)', stats.longFrames, `<= ${BUDGET.longFrames}`, stats.longFrames <= BUDGET.longFrames],
      ['tile p95 (ms)', stats.tileP95.toFixed(1), `<= ${BUDGET.tileP95}`, stats.tileP95 <= BUDGET.tileP95],
      ['scrolled (px)', Math.round(travelled), '> 800', travelled > 800],
      ['tiles rendered', stats.tiles, '> 0', stats.tiles > 0],
      ['DOM elements', dom, '< 2500', dom < 2500],
      ['runtime errors', errors.length, '= 0', errors.length === 0],
    ];
    console.log(`\n${name}`);
    for (const [label, value, budget, ok] of rows) console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(22)} ${String(value).padStart(8)}  ${budget}`);
    if (rows.some(row => !row[3])) failed = true;
    await ctx.close();
  }
} finally { await browser.close(); }
if (failed) { console.error('performance budget exceeded'); process.exit(1); }
