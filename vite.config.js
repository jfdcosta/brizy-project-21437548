import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'storefront',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve('storefront/index.html'),
        cart: resolve('storefront/cart.html'),
        success: resolve('storefront/success.html'),
      },
    },
  },
});
