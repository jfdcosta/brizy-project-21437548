import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';

const CART_KEY = 'form-lab-cart-v1';
const $ = (selector) => document.querySelector(selector);
const element = (tag, className, value) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value != null) node.textContent = value;
  return node;
};
const cart = () => {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
};
const saveCart = (items) => {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  document.querySelectorAll('[data-cart-count]').forEach((node) => {
    node.textContent = items.reduce((sum, item) => sum + item.quantity, 0);
  });
};
const money = (amount, currency = 'gbp') => new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100);
const showToast = (message) => {
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('show');
  setTimeout(() => node.classList.remove('show'), 3000);
};

async function getCatalog() {
  const response = await fetch('/api/catalog');
  if (!response.ok) throw new Error('The collection could not load.');
  return response.json();
}

function addToCart(product) {
  if (product.availability === 'prototype' || !Number.isInteger(product.unit_amount)) return;
  const items = cart();
  const existing = items.find((item) => item.slug === product.slug);
  if (existing) existing.quantity = Math.min(existing.quantity + 1, 10);
  else items.push({ slug: product.slug, quantity: 1 });
  saveCart(items);
  showToast(`${product.name} added to your cart`);
}

const productUrl = (product) => product.slug === 'jdc-duo' ? '/jdc-duo' : `/products/${encodeURIComponent(product.slug)}`;
const catalogNote = (catalog) => {
  if (catalog.mode === 'test') return 'Test purchases only. No real charges.';
  if (!catalog.checkout_enabled) return 'Online checkout is currently unavailable.';
  const product = catalog.products.find((item) => item.slug === 'jdc-duo');
  return [product?.delivery_note, product?.dispatch_note].filter(Boolean).join(' ');
};

async function home() {
  const grid = $('#product-grid');
  let result;
  try { result = await getCatalog(); }
  catch (error) { grid.textContent = error.message; return; }
  grid.replaceChildren();
  if (!result.products.length) { grid.textContent = 'Our products are coming soon.'; return; }
  $('#mode-note').textContent = catalogNote(result);
  grid.classList.toggle('single-product', result.products.length === 1);
  const duo = result.products.find((product) => product.slug === 'jdc-duo');
  if (duo?.availability !== 'prototype' && Number.isInteger(duo?.unit_amount)) {
    $('.hero-note').textContent = `${money(duo.unit_amount, duo.currency)} · ${duo.delivery_note}`;
  }
  for (const product of result.products) {
    const card = element('article', 'product-card');
    const art = element('a', 'product-art');
    art.href = productUrl(product);
    art.setAttribute('aria-label', `View ${product.name}`);
    const photo = element('img', 'product-photo');
    const picture = product.image || (product.turntable ? `${product.turntable.base}/00.webp` : null);
    if (picture) photo.src = picture;
    photo.alt = product.image_alt || product.name;
    photo.loading = 'lazy';
    photo.width = 800;
    photo.height = 600;
    art.append(photo);
    if (product.image_kind === 'render') art.append(element('span', 'product-badge', 'Concept preview'));
    card.append(art);
    const info = element('div', 'product-info');
    const title = element('h3');
    const link = element('a', '', product.name);
    link.href = productUrl(product);
    title.append(link);
    info.append(title, element('p', '', product.summary || product.description));
    const availability = product.availability === 'prototype' ? 'Coming soon' : `${money(product.unit_amount, product.currency)}${result.mode === 'live' ? '' : ' · Preview price'}`;
    info.append(element('strong', 'product-price', availability));
    card.append(info);
    const actions = element('div', 'product-actions');
    const detail = element('a', 'button button-outline', 'View product');
    detail.href = productUrl(product);
    detail.setAttribute('aria-label', `View ${product.name} details`);
    actions.append(detail);
    card.append(actions);
    grid.append(card);
  }
}

async function cartPage() {
  const list = $('#cart-items');
  const message = $('#checkout-message');
  let result;
  try { result = await getCatalog(); }
  catch (error) { list.textContent = error.message; return; }
  const bySlug = new Map(result.products.map((product) => [product.slug, product]));
  const render = () => {
    const items = cart().filter((item) => {
      const product = bySlug.get(item.slug);
      return product && product.availability !== 'prototype' && Number.isInteger(product.unit_amount);
    });
    saveCart(items);
    list.replaceChildren();
    if (!items.length) list.append(element('p', 'empty-cart', 'Your cart is empty. Browse products in the shop.'));
    let subtotal = 0;
    for (const item of items) {
      const product = bySlug.get(item.slug);
      subtotal += product.unit_amount * item.quantity;
      const row = element('div', 'cart-row');
      const swatch = element('div', 'cart-swatch', '✳');
      swatch.style.color = product.accent;
      const details = element('div');
      details.append(element('h2', '', product.name), element('p', '', product.description));
      const quantity = element('div', 'quantity');
      const minus = element('button', '', '−');
      minus.type = 'button'; minus.setAttribute('aria-label', `Remove one ${product.name}`);
      minus.addEventListener('click', () => change(item.slug, -1));
      const plus = element('button', '', '+');
      plus.type = 'button'; plus.setAttribute('aria-label', `Add one ${product.name}`);
      plus.addEventListener('click', () => change(item.slug, 1));
      const remove = element('button', 'remove', 'Remove');
      remove.type = 'button'; remove.addEventListener('click', () => change(item.slug, -item.quantity));
      quantity.append(minus, element('span', '', item.quantity), plus, remove);
      details.append(quantity);
      row.append(swatch, details, element('strong', '', money(product.unit_amount * item.quantity, product.currency)));
      list.append(row);
    }
    $('#subtotal').textContent = money(subtotal, result.products[0]?.currency || 'gbp');
    $('#checkout-button').disabled = !items.length || !result.checkout_enabled;
    message.textContent = catalogNote(result);
  };
  const change = (slug, difference) => {
    const items = cart();
    const item = items.find((entry) => entry.slug === slug);
    if (item) item.quantity = Math.max(0, Math.min(10, item.quantity + difference));
    saveCart(items.filter((entry) => entry.quantity > 0));
    render();
  };
  $('#checkout-button').addEventListener('click', async () => {
    message.classList.remove('error');
    message.textContent = 'Opening secure checkout…';
    const button = $('#checkout-button');
    button.disabled = true;
    try {
      const items = cart().map((item) => ({ price_id: bySlug.get(item.slug)?.price_id, quantity: item.quantity }));
      const response = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items }) });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || 'Checkout is unavailable.');
      window.location.assign(data.url);
    } catch (error) { message.textContent = error.message; message.classList.add('error'); button.disabled = false; }
  });
  render();
}

async function successPage() {
  const status = $('#order-status');
  const id = new URLSearchParams(window.location.search).get('session_id');
  if (!id) { status.textContent = 'No checkout session was provided.'; return; }
  try {
    const response = await fetch(`/api/order?session_id=${encodeURIComponent(id)}`);
    const order = await response.json();
    if (!response.ok) throw new Error(order.error || 'Could not retrieve the order.');
    if (order.payment_status === 'paid') {
      status.textContent = order.mode === 'test'
        ? 'Test payment received. No real charge was made.'
        : 'Your payment was received. Thank you for your order.';
      saveCart([]);
    } else status.textContent = order.status === 'complete'
      ? 'Your payment is still processing. Your order will be recorded when payment is confirmed.'
      : 'Payment has not been completed. Return to your cart to continue checkout.';
    const panel = $('#order-panel');
    panel.append(element('div', 'eyebrow', `ORDER ${order.id}`));
    for (const item of order.items) {
      const row = element('div', 'order-line');
      row.append(element('span', '', `${item.description} × ${item.quantity}`), element('strong', '', money(item.amount_total, order.currency)));
      panel.append(row);
    }
    const total = element('div', 'order-line');
    total.append(element('strong', '', order.payment_status === 'paid' ? 'Total paid' : 'Order total'), element('strong', '', money(order.amount_total, order.currency)));
    panel.append(total);
  } catch (error) { status.textContent = error.message; }
}

saveCart(cart());
if (document.body.dataset.page === 'home') home();
if (document.body.dataset.page === 'cart') cartPage();
if (document.body.dataset.page === 'success') successPage();

if (document.body.dataset.page === 'product') {
  import('./product-page.js').then(({ productPage }) => productPage({ getCatalog, addToCart, money, catalogNote }));
}
