const $ = (selector) => document.querySelector(selector);
const node = (tag, className, text) => {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text != null) item.textContent = text;
  return item;
};

export async function productPage({ getCatalog, addToCart, money, catalogNote }) {
  const slug = document.body.dataset.product || location.pathname.match(/^\/products\/([a-z0-9-]+)/)?.[1] || new URLSearchParams(location.search).get('product');
  let result;
  try { result = await getCatalog(); }
  catch (error) { $('#product-loading').textContent = error.message; return; }
  const product = result.products.find((item) => item.slug === slug);
  if (!product) { $('#product-loading').textContent = 'This product could not be found. Please return to the shop.'; return; }
  document.title = `${product.name} — Eco Layer Labs`;
  $('#product-loading').hidden = true;
  $('#product-content').hidden = false;
  $('#product-breadcrumb').textContent = product.name;
  $('#product-name').textContent = product.name;
  $('#product-subtitle').textContent = product.subtitle || product.description;
  $('#product-description').textContent = product.description;
  $('#product-label').textContent = product.image_kind === 'render' ? 'Concept preview' : 'Watch charging docks';
  $('#product-store-note').textContent = catalogNote(result.mode);
  for (const highlight of product.highlights || []) $('#product-highlights').append(node('li', '', highlight));
  const isPrototype = product.availability === 'prototype';
  const add = $('#product-add');
  if (isPrototype) {
    $('#product-price').textContent = 'Coming soon';
    $('#product-availability').textContent = 'This prototype is not yet available to order. Price and release date will be confirmed.';
    add.hidden = true;
    $('#product-primary').textContent = 'Check compatibility';
  } else {
    $('#product-price').textContent = money(product.unit_amount, product.currency);
    $('#product-availability').textContent = 'Preview price · This design is still in development.';
    $('#product-primary').hidden = true;
    add.addEventListener('click', () => {
      addToCart(product);
      $('#product-cart-message').textContent = `${product.name} added to your cart.`;
      $('#product-cart-link').hidden = false;
    });
  }
  for (const detail of product.details || []) {
    const section = node('section', 'product-detail-section');
    section.append(node('h3', '', detail.title), node('p', '', detail.text));
    $('#product-detail-list').append(section);
  }
  if (product.independent_note) $('#product-detail-list').append(node('p', 'independent-note', product.independent_note));

  const photos = product.gallery?.length ? product.gallery : [{ src: product.image, label: 'Photo', alt: product.name, caption: product.name }];
  const media = [...photos];
  if (product.model3d || product.model) media.push({ kind: '3d', label: '3D view' });
  const stage = $('#gallery-stage');
  const image = $('#gallery-image');
  const viewerPanel = $('#gallery-viewer');
  const caption = $('#gallery-caption');
  let selected = 0;
  let viewer;
  let viewerLoad;
  let buttons = [];
  const select = async (index) => {
    selected = index;
    const item = media[index];
    const is3d = item.kind === '3d';
    stage.dataset.activeMedia = is3d ? '3d' : 'photo';
    image.hidden = is3d;
    viewerPanel.hidden = !is3d;
    buttons.forEach((button, buttonIndex) => button.setAttribute('aria-pressed', String(buttonIndex === index)));
    $('#gallery-position').textContent = `${index + 1} of ${media.length}`;
    viewer?.setActive(is3d);
    if (!is3d) {
      image.src = item.src;
      image.alt = item.alt;
      caption.textContent = item.caption;
      return;
    }
    caption.textContent = product.model3d
      ? 'Dock parts only. Watches, chargers and pegboard are shown in the photos.'
      : 'Interactive view of the concept design.';
    if (!viewerLoad) {
      $('#viewer-status').textContent = 'Loading the 3D view…';
      viewerLoad = import('./viewer.js').then(({ createViewer }) => {
        const canvas = node('canvas');
        canvas.id = 'product-viewer-canvas';
        canvas.setAttribute('aria-label', `Interactive 3D view of ${product.name}`);
        viewerPanel.append(canvas);
        viewer = createViewer(canvas, product, true);
        viewer.setActive(selected === media.length - 1);
        $('#viewer-status').textContent = 'Drag to rotate. Use + and − to zoom.';
      }).catch(() => {
        $('#viewer-status').textContent = 'The 3D view could not load. Please select a photo.';
        viewerLoad = null;
      });
    }
    await viewerLoad;
  };
  media.forEach((item, index) => {
    const button = node('button', 'gallery-thumbnail');
    button.type = 'button';
    button.setAttribute('aria-label', item.kind === '3d' ? `Show 3D view of ${product.name}` : `Show ${item.label.toLowerCase()} photo of ${product.name}`);
    button.setAttribute('aria-pressed', String(index === 0));
    if (item.kind === '3d') button.append(node('span', 'thumbnail-3d', '360°'));
    else {
      const thumb = node('img');
      thumb.src = item.src;
      thumb.alt = '';
      thumb.loading = 'lazy';
      button.append(thumb);
    }
    button.append(node('span', 'thumbnail-label', item.label));
    button.addEventListener('click', () => select(index));
    buttons.push(button);
    $('#gallery-thumbnails').append(button);
  });
  $('#gallery-previous').addEventListener('click', () => select((selected - 1 + media.length) % media.length));
  $('#gallery-next').addEventListener('click', () => select((selected + 1) % media.length));
  select(0);

  // The frame-generation tool opts into the viewer; normal visits stay photo-only.
  if (new URLSearchParams(location.search).has('capture')) {
    await select(media.length - 1);
    window.__turntableCapture = { viewer, products: result.products };
  }
}
