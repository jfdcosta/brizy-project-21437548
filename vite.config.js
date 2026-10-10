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
        quote: resolve('storefront/quote.html'),
        jdcDuo: resolve('storefront/jdc-duo.html'),
        product: resolve('storefront/product.html'),
        success: resolve('storefront/success.html'),
      },
    },
  },
});
