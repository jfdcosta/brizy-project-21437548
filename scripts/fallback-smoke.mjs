import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
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
if (!browserPath) throw new Error('Install Chrome/Chromium or set CHROME_BIN.');

const browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ['--no-sandbox', '--disable-webgl'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const hero = page.locator('.hero-stage .turntable-image');
  await hero.waitFor({ timeout: 15000 });
  assert.equal(await hero.getAttribute('data-model-source'), 'turntable');
  assert.equal(await page.locator('.product-card .turntable-image').count(), 4);
  await page.getByRole('button', { name: 'Rotate JDC Duo right' }).click();
  assert.equal(await hero.getAttribute('data-frame'), '1');
  await page.waitForFunction(() => document.querySelector('.hero-stage .turntable-image')?.naturalWidth > 0);
  assert.ok(await hero.evaluate((image) => image.naturalWidth > 0));

  await page.goto(`${base}/jdc-duo`, { waitUntil: 'domcontentloaded' });
  const duo = page.locator('.duo-viewer .turntable-image');
  await duo.waitFor({ timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('.duo-viewer .turntable-image')?.naturalWidth > 0);
  assert.ok(await duo.evaluate((image) => image.naturalWidth > 0));
  await page.getByRole('button', { name: 'Rotate JDC Duo left' }).click();
  assert.equal(await duo.getAttribute('data-frame'), '23');
  console.log('No-WebGL browser smoke passed: home and JDC Duo show rotating model frames.');
} finally {
  await browser.close();
}
