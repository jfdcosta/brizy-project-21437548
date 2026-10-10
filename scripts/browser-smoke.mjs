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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  const noViewerRequests = () => {
    assert.equal(requests.some((url) => /\.glb(?:\?|$)|\/(?:viewer|three\.module)-[^/]+\.js/.test(url)), false, 'Photos must not load the 3D model or viewer');
    assert.equal(requests.some((url) => /\/turntable\/jdc-duo\//.test(url)), false, 'Photo gallery must not preload turntable frames');
  };
  await page.goto(base, { waitUntil: 'networkidle' });
  const catalog = await (await page.request.get(`${base}/api/catalog`)).json();
  await page.locator('.product-card').first().waitFor({ timeout: 15000 });
  assert.equal(await page.locator('.product-card').count(), catalog.products.length);
  assert.equal(await page.locator('canvas').count(), 0);
  assert.equal(await page.getByText('Explore in 3D').count(), 0);
  const duo = page.locator('.product-card').filter({ hasText: 'JDC Duo' });
  assert.equal(await duo.locator('.product-photo').getAttribute('src'), '/images/jdc-duo-mounted.jpg');
  noViewerRequests();
  for (const photo of await page.locator('.product-photo').all()) {
    await photo.scrollIntoViewIfNeeded();
    await photo.evaluate((image) => image.complete && image.naturalWidth ? Promise.resolve() : new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; }));
  }
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: join(tmpdir(), 'eco-storefront-home.png'), fullPage: true });
  await duo.getByRole('link', { name: 'View JDC Duo', exact: true }).click();
  await page.getByRole('heading', { name: 'JDC Duo', exact: true }).waitFor();
  await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('#gallery-stage').getAttribute('data-active-media'), 'photo');
  assert.equal(await page.locator('canvas').count(), 0);
  const product = catalog.products.find((item) => item.slug === 'jdc-duo');
  assert.equal(await page.locator('#product-add').isVisible(), product.availability !== 'prototype');
  if (catalog.mode === 'live') {
    assert.equal(await page.locator('#product-price').textContent(), '£17.99');
    assert.ok((await page.locator('#product-availability').textContent()).includes('£1.99 UK delivery'));
    assert.equal(await page.getByText('Coming soon', { exact: true }).count(), 0);
  }
  noViewerRequests();
  await page.getByRole('button', { name: 'Show charger fit photo of JDC Duo' }).click();
  assert.equal(await page.locator('#gallery-image').getAttribute('src'), '/images/jdc-duo-chargers.png');
  noViewerRequests();
  await page.screenshot({ path: join(tmpdir(), 'eco-storefront-jdc-duo.png'), fullPage: true });
  await page.getByRole('button', { name: 'Show 3D view of JDC Duo' }).click();
  await page.locator('#product-viewer-canvas[data-model-source="actual"][data-model-status="ready"]').waitFor({ timeout: 15000 });
  assert.ok(requests.some((url) => url.includes('/models/jdc-duo.glb')));
  await page.getByRole('button', { name: 'Rotate JDC Duo right' }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Reset view' }).click();
  await page.screenshot({ path: join(tmpdir(), 'eco-storefront-gallery-3d.png'), fullPage: true });
  await page.getByRole('button', { name: 'Show in use photo of JDC Duo' }).click();
  assert.equal(await page.locator('#gallery-viewer').isVisible(), false);
  await page.setViewportSize({ width: 375, height: 900 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Product page must fit mobile width');
  await page.screenshot({ path: join(tmpdir(), 'eco-storefront-product-mobile.png'), fullPage: true });
  await page.goto(base, { waitUntil: 'networkidle' });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Homepage must fit mobile width');
  await page.screenshot({ path: join(tmpdir(), 'eco-storefront-home-mobile.png'), fullPage: true });
  if (catalog.products.some((item) => item.slug === 'eco-strap')) {
    await page.locator('.product-card').filter({ hasText: 'Eco Strap' }).getByRole('link', { name: 'View Eco Strap', exact: true }).click();
    await page.getByRole('heading', { name: 'Eco Strap', exact: true }).waitFor();
    assert.equal(await page.locator('#gallery-image').getAttribute('src'), '/turntable/eco-strap/00.webp');
  }
  await page.goto(`${base}/jdc-duo`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  assert.equal(await page.locator('[data-cart-count]').textContent(), '1');
  await page.getByRole('link', { name: 'View cart', exact: false }).click();
  await page.locator('.cart-row').waitFor({ timeout: 15000 });
  assert.equal(await page.locator('.cart-row').count(), 1);
  assert.equal(await page.locator('#subtotal').textContent(), '£17.99');
  assert.equal(await page.locator('#checkout-button').isDisabled(), !catalog.checkout_enabled);
  if (catalog.mode === 'live') assert.ok((await page.locator('#checkout-message').textContent()).includes('£1.99 UK delivery'));
  await page.screenshot({ path: join(tmpdir(), 'eco-storefront-cart.png'), fullPage: true });
  console.log('Browser smoke passed: photo-only homepage, on-demand product gallery, mobile layout, product page cart, checkout guard.');
} finally {
  await browser.close();
}
