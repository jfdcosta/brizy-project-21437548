import * as THREE from 'three';
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

function makeModel(product) {
  const group = new THREE.Group();
  const color = new THREE.Color(product.accent || '#6d8a53');
  const material = new THREE.MeshStandardMaterial({ color, metalness: .13, roughness: .57 });
  const detail = new THREE.MeshStandardMaterial({ color: '#d7ddc8', metalness: .35, roughness: .32 });
  const dark = new THREE.MeshStandardMaterial({ color: '#29312b', metalness: .2, roughness: .4 });
  const add = (geometry, mat, position = [0, 0, 0], rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  if (product.model === 'bottle') {
    add(new THREE.CylinderGeometry(.67, .75, 2.25, 48), material, [0, 0, 0]);
    add(new THREE.CylinderGeometry(.42, .45, .48, 48), detail, [0, 1.36, 0]);
    add(new THREE.CylinderGeometry(.44, .44, .18, 48), dark, [0, 1.68, 0]);
    add(new THREE.TorusGeometry(.7, .04, 12, 48), dark, [0, -.93, 0], [Math.PI / 2, 0, 0]);
    add(new THREE.BoxGeometry(.68, .15, .035), detail, [0, .15, .67]);
  } else if (product.model === 'desk') {
    add(new THREE.BoxGeometry(2.35, .23, 1.55), material, [0, -.6, 0]);
    add(new THREE.BoxGeometry(.16, .7, 1.42), material, [-1.08, -.13, 0]);
    add(new THREE.BoxGeometry(.16, .7, 1.42), material, [1.08, -.13, 0]);
    add(new THREE.BoxGeometry(2.05, .7, .16), material, [0, -.13, -.65]);
    add(new THREE.BoxGeometry(.1, .66, 1.3), detail, [.25, -.11, 0]);
    add(new THREE.CylinderGeometry(.35, .35, .15, 32), dark, [-.45, -.38, .05]);
  } else {
    const points = [];
    for (let index = 0; index <= 96; index++) {
      const theta = (index / 96) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(theta) * 1.25, Math.sin(theta) * .76, Math.sin(theta) * .15));
    }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 120, .22, 12, true), material);
    add(new THREE.BoxGeometry(.42, .47, .5), dark, [0, -.79, 0]);
    add(new THREE.BoxGeometry(.27, .35, .53), detail, [0, -.79, .03]);
  }
  return group;
}

function createViewer(canvas, product, interactive = false) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); }
  catch { canvas.replaceWith(element('div', 'viewer-fallback', product.name)); return { setProduct() {} }; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  camera.position.set(0, 1.15, 6.4);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight('#ffffff', 2.1));
  const light = new THREE.DirectionalLight('#fff5e6', 3.2);
  light.position.set(3, 5, 5);
  light.castShadow = true;
  scene.add(light);
  const rim = new THREE.DirectionalLight('#c9e4dc', 2.0);
  rim.position.set(-4, 2, -4);
  scene.add(rim);
  let model = makeModel(product);
  scene.add(model);
  let dragging = false, lastX = 0, lastY = 0;
  if (interactive) {
    canvas.addEventListener('pointerdown', (event) => { dragging = true; lastX = event.clientX; lastY = event.clientY; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      model.rotation.y += (event.clientX - lastX) * .008;
      model.rotation.x = Math.max(-.6, Math.min(.6, model.rotation.x + (event.clientY - lastY) * .006));
      lastX = event.clientX; lastY = event.clientY;
    });
    canvas.addEventListener('pointerup', () => { dragging = false; });
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      camera.position.z = Math.max(4.2, Math.min(8.4, camera.position.z + event.deltaY * .004));
    }, { passive: false });
  }
  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();
  let previous = 0;
  const animate = (time) => {
    if (!dragging) model.rotation.y += Math.min((time - previous) || 0, 100) * .00018;
    previous = time;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
  return {
    setProduct(next) {
      scene.remove(model);
      model = makeModel(next);
      scene.add(model);
    },
  };
}

async function getCatalog() {
  const response = await fetch('/api/catalog');
  if (!response.ok) throw new Error('The collection could not load.');
  return response.json();
}

function addToCart(product) {
  const items = cart();
  const existing = items.find((item) => item.slug === product.slug);
  if (existing) existing.quantity = Math.min(existing.quantity + 1, 10);
  else items.push({ slug: product.slug, quantity: 1 });
  saveCart(items);
  showToast(`${product.name} added to your bag`);
}

async function home() {
  const grid = $('#product-grid');
  let result;
  try { result = await getCatalog(); }
  catch (error) { grid.textContent = error.message; return; }
  const products = result.products;
  grid.replaceChildren();
  if (!products.length) { grid.textContent = 'The collection is coming soon.'; return; }
  const note = $('#mode-note');
  note.textContent = result.mode === 'mock' ? 'Prototype catalog: checkout becomes available when Stripe test products and a payment key are connected.' : result.mode === 'test' ? 'Stripe test mode: use test cards only. No real charges will be made.' : 'Live checkout is disabled while fulfillment and store policies are unfinished.';
  let selected = 0;
  $('#featured-total').textContent = String(products.length).padStart(2, '0');
  const heroViewer = createViewer($('#product-canvas'), products[0], true);
  const select = (index) => {
    selected = (index + products.length) % products.length;
    heroViewer.setProduct(products[selected]);
    $('#featured-number').textContent = String(selected + 1).padStart(2, '0');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  $('#prev-model').addEventListener('click', () => select(selected - 1));
  $('#next-model').addEventListener('click', () => select(selected + 1));
  products.forEach((product, index) => {
    const card = element('article', 'product-card');
    const art = element('div', 'product-art');
    art.style.backgroundColor = `${product.accent}22`;
    art.append(element('span', 'product-number', `0${index + 1} / 3D VIEW`));
    const canvas = element('canvas');
    canvas.setAttribute('aria-label', `3D preview of ${product.name}`);
    art.append(canvas);
    card.append(art);
    const info = element('div', 'product-info');
    const copy = element('div');
    copy.append(element('h3', '', product.name), element('p', '', product.description));
    info.append(copy, element('strong', '', money(product.unit_amount, product.currency)));
    card.append(info);
    const actions = element('div', 'product-actions');
    const view = element('button', '', 'Explore in 3D →');
    view.type = 'button';
    view.addEventListener('click', () => select(index));
    const add = element('button', '', 'Add to bag +');
    add.type = 'button';
    add.addEventListener('click', () => addToCart(product));
    actions.append(view, add);
    card.append(actions);
    grid.append(card);
    createViewer(canvas, product, false);
  });
}

async function cartPage() {
  const list = $('#cart-items');
  const message = $('#checkout-message');
  let result;
  try { result = await getCatalog(); }
  catch (error) { list.textContent = error.message; return; }
  const bySlug = new Map(result.products.map((product) => [product.slug, product]));
  const render = () => {
    const items = cart().filter((item) => bySlug.has(item.slug));
    saveCart(items);
    list.replaceChildren();
    if (!items.length) list.append(element('p', 'empty-cart', 'Your bag is empty. Find something to explore in the collection.'));
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
    if (result.mode === 'mock') message.textContent = 'Checkout is awaiting a connected Stripe account.';
    else if (result.mode === 'test') message.textContent = 'Test mode: no real charges will be made.';
    else message.textContent = 'Live checkout is disabled while fulfillment and store policies are unfinished.';
  };
  const change = (slug, difference) => {
    const items = cart();
    const item = items.find((entry) => entry.slug === slug);
    if (item) item.quantity = Math.max(0, Math.min(10, item.quantity + difference));
    saveCart(items.filter((entry) => entry.quantity > 0));
    render();
  };
  $('#checkout-button').addEventListener('click', async () => {
    message.textContent = 'Opening secure checkout…';
    const button = $('#checkout-button');
    button.disabled = true;
    try {
      const items = cart().map((item) => ({ price_id: bySlug.get(item.slug)?.price_id, quantity: item.quantity }));
      const response = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items }) });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || 'Checkout is unavailable.');
      window.location.assign(data.url);
    } catch (error) { message.textContent = error.message; button.disabled = false; }
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
      status.textContent = 'Your payment was received. A Stripe receipt will be sent to your email address.';
      saveCart([]);
    } else status.textContent = 'Your checkout is complete. Payment is still processing; check your email for confirmation.';
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
