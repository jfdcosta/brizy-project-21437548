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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${base}/jdc-duo`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.turntable-image').count(), 0);
  await page.getByRole('button', { name: 'Show 3D view of JDC Duo' }).click();
  const duo = page.locator('.gallery-viewer .turntable-image');
  await duo.waitFor({ timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('.gallery-viewer .turntable-image')?.naturalWidth > 0);
  await page.getByRole('button', { name: 'Rotate JDC Duo left' }).click();
  assert.equal(await duo.getAttribute('data-frame'), '23');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  assert.ok((await duo.getAttribute('style')).includes('scale(1.15)'));
  await page.getByRole('button', { name: 'Reset view' }).click();
  assert.equal(await duo.getAttribute('data-frame'), '0');
  await page.getByRole('button', { name: 'Show in use photo of JDC Duo' }).click();
  assert.equal(await page.locator('#gallery-viewer').isVisible(), false);
  await page.getByRole('button', { name: 'Show 3D view of JDC Duo' }).click();
  assert.equal(await page.locator('.turntable-image').count(), 1);
  console.log('No-WebGL browser smoke passed: 3D thumbnail opens the turntable, rotation/zoom/reset work, photos stay selectable.');
} finally {
  await browser.close();
}
