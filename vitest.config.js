import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.preview.jsonc' } })],
  test: { include: ['runtime-test/**/*.spec.js'] },
});
