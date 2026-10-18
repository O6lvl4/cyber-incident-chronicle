import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base = process.env.UI_URL ?? 'http://127.0.0.1:4173/';
const output = `${process.env.UI_OUTPUT ?? 'artifacts/ui'}/incident-dates`;
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] });
try {
  for (const width of [1440, 768, 393, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`${base}#q=${encodeURIComponent('シャープ')}`);
    const row = page.locator('[data-incident-id="sharp-cocoro-2024"]');
    await row.waitFor();
    assert.match(await row.innerText(), /2024-07-11/);
    assert.match(await row.innerText(), /2024-07-22/);
    assert.match(await row.innerText(), /2024.07.29/);
    assert.match(await row.ariaSnapshot(), /攻撃時期.*被害の初確認.*公表日/s);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ animations: 'disabled', path: `${output}/list-${width}.png` });
    await row.click();
    const dates = page.locator('.event-date-grid');
    await dates.waitFor();
    await page.locator('dialog.drawer.open').evaluate(async element => {
      await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})));
    });
    const bounds = await page.locator('dialog.drawer.open').boundingBox();
    assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= width + 1);
    assert.equal(await dates.locator(':scope > div').count(), 3);
    assert.match(await dates.innerText(), /改ざん/);
    assert.match(await dates.innerText(), /翌23日/);
    assert.equal(await dates.getByRole('link', { name: '日付の根拠' }).count(), 2);
    assert.equal(await dates.evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
    await page.screenshot({ animations: 'disabled', path: `${output}/detail-${width}.png` });
    await page.keyboard.press('Escape');
    await row.click();
    await dates.waitFor();
    await page.close();
  }
} finally { await browser.close(); }
console.log('Incident date comparison: desktop/mobile, accessible labels, cited detail, reopen passed');
