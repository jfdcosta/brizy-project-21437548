import { createViewer } from './app.js';

async function showDuo() {
  const canvas = document.querySelector('#duo-canvas');
  try {
    const response = await fetch('/api/catalog');
    if (!response.ok) throw new Error('The model listing could not load.');
    const { products } = await response.json();
    const product = products.find((item) => item.slug === 'jdc-duo');
    if (!product?.model3d) throw new Error('The JDC Duo model is unavailable.');
    createViewer(canvas, product, true);
  } catch (error) {
    canvas.replaceWith(Object.assign(document.createElement('p'), { className: 'viewer-fallback', textContent: error.message }));
  }
}

showDuo();
