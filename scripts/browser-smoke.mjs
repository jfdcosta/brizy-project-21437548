import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const base = process.env.STORE_URL || 'http://127.0.0.1:8787';
const browserPath = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
].find((path) => path && existsSync(path));
if (!browserPath) throw new Error('Install Chrome/Chromium or set CHROME_BIN to its executable path.');
const browser = await chromium.launch({
  executablePath: browserPath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
  env: {
    ...process.env,
    XDG_CONFIG_HOME: join(tmpdir(), 'eco-playwright-config'),
    XDG_CACHE_HOME: join(tmpdir(), 'eco-playwright-cache'),
  },
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('.product-card').first().waitFor({ timeout: 15000 });
  assert.equal(await page.locator('.product-card').count(), 3);
  assert.equal(await page.locator('#product-canvas').count(), 1);
  await page.screenshot({ path: join(tmpdir(), 'eco-storefront-home.png'), fullPage: true });
  await page.locator('.product-card').first().getByRole('button', { name: 'Add to bag +' }).click();
  assert.equal(await page.locator('[data-cart-count]').textContent(), '1');
  await page.goto(`${base}/cart.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('.cart-row').waitFor({ timeout: 15000 });
  assert.equal(await page.locator('.cart-row').count(), 1);
  assert.equal(await page.locator('#checkout-button').isDisabled(), true);
  await page.screenshot({ path: join(tmpdir(), 'eco-storefront.png'), fullPage: true });
  console.log('Browser smoke passed: catalog, 3D canvas, add to bag, cart, mock checkout guard.');
} finally {
  await browser.close();
}
