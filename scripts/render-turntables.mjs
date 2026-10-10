import { writeFile, mkdir } from 'node:fs/promises';
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
].find((path) => path && existsSync(path));
if (!browserPath) throw new Error('Chrome or Chromium is required to render turntable frames.');

const browser = await chromium.launch({
  executablePath: browserPath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(`${base}/jdc-duo?capture=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__turntableCapture?.products?.length > 0);
  await page.addStyleTag({ content: '.product-layout{grid-template-columns:936px 1fr}.gallery-stage{height:868px;min-height:868px;aspect-ratio:auto}' });
  const products = await page.evaluate(() => window.__turntableCapture.products);

  for (const product of products.filter((item) => item.turntable)) {
    const output = join('storefront/public', product.turntable.base.replace(/^\//, ''));
    await mkdir(output, { recursive: true });
    await page.evaluate((item) => window.__turntableCapture.viewer.setProduct(item), product);
    await page.waitForFunction(() => document.querySelector('#product-viewer-canvas')?.dataset.modelStatus === 'ready');
    for (let frame = 0; frame < product.turntable.frames; frame++) {
      const yaw = (product.model3d ? Math.PI + 0.35 : 0) + frame * Math.PI * 2 / product.turntable.frames;
      const dataUrl = await page.evaluate((angle) => {
        window.__turntableCapture.viewer.setYaw(angle);
        return window.__turntableCapture.viewer.capture();
      }, yaw);
      if (!dataUrl.startsWith('data:image/webp;base64,')) throw new Error(`Frame capture failed for ${product.slug}`);
      const path = join(output, `${String(frame).padStart(2, '0')}.webp`);
      await writeFile(path, Buffer.from(dataUrl.split(',')[1], 'base64'));
    }
    console.log(`Rendered ${product.turntable.frames} frames for ${product.slug}`);
  }
} finally {
  await browser.close();
}
