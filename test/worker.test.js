import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

test('Stripe catalog feeds checkout and rejects unlisted prices', async () => {
  const originalFetch = globalThis.fetch;
  let checkoutBody;
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname;
    let payload;
    if (path === '/v1/products') payload = { data: [
      { id: 'prod_1', name: 'Eco Strap', description: 'Demo', active: true, default_price: 'price_1', metadata: { storefront: 'eco-storefront', slug: 'eco-strap', model: 'strap' }, images: [] },
      { id: 'prod_duo', name: 'JDC Duo', active: true, default_price: 'price_duo', metadata: { storefront: 'eco-storefront', slug: 'jdc-duo' }, images: [] },
    ], has_more: false };
    else if (path === '/v1/prices') payload = { data: [
      { id: 'price_1', product: 'prod_1', active: true, type: 'one_time', unit_amount: 1800, currency: 'gbp', created: 1 },
      { id: 'price_duo', product: 'prod_duo', active: true, type: 'one_time', unit_amount: 1799, currency: 'gbp', created: 1 },
    ], has_more: false };
    else if (path === '/v1/checkout/sessions') {
      checkoutBody = new URLSearchParams(options.body);
      payload = { id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' };
    } else throw new Error(`Unexpected Stripe path ${path}`);
    return new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } });
  };
  try {
    const env = { STRIPE_SECRET_KEY: 'sk_test_fake', STRIPE_WEBHOOK_SECRET: 'whsec_fake', ORDERS: {}, ASSETS: { fetch: () => new Response('asset') } };
    const catalog = await worker.fetch(new Request('https://store.example/api/catalog'), env);
    const data = await catalog.json();
    assert.equal(data.mode, 'test');
    assert.equal(data.products.find((product) => product.slug === 'eco-strap').price_id, 'price_1');
    const duo = data.products.find((product) => product.slug === 'jdc-duo');
    assert.equal(duo.availability, 'available');
    assert.equal(duo.gallery[0].src, '/images/jdc-duo-mounted.jpg');
    assert.equal(duo.turntable.frames, 24);
    assert.equal(duo.unit_amount, 1799);
    assert.equal(duo.price_id, 'price_duo');
    assert.equal(duo.model3d, '/models/jdc-duo.glb');

    const bad = await worker.fetch(new Request('https://store.example/api/checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: [{ price_id: 'price_other', quantity: 1 }] }),
    }), env);
    assert.equal(bad.status, 400);

    const prototypeCheckout = await worker.fetch(new Request('https://store.example/api/checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: [{ price_id: null, quantity: 1 }] }),
    }), env);
    assert.equal(prototypeCheckout.status, 400);

    const good = await worker.fetch(new Request('https://store.example/api/checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: [{ price_id: 'price_1', quantity: 2 }] }),
    }), env);
    assert.equal(good.status, 200);
    assert.equal((await good.json()).url, 'https://checkout.stripe.com/c/pay/cs_test_123');
    assert.equal(checkoutBody.get('line_items[0][price]'), 'price_1');
    assert.equal(checkoutBody.get('line_items[0][quantity]'), '2');
    const duoCheckout = await worker.fetch(new Request('https://store.example/api/checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: [{ price_id: 'price_duo', quantity: 1 }] }),
    }), env);
    assert.equal(duoCheckout.status, 200);
    assert.equal(checkoutBody.get('line_items[0][price]'), 'price_duo');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('live checkout requires its explicit configuration', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Stripe should not be contacted'); };
  try {
    for (const key of ['sk_live_example', 'rk_live_example']) {
      const response = await worker.fetch(new Request('https://store.example/api/checkout', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: [{ price_id: 'price_1', quantity: 1 }] }),
      }), { STRIPE_SECRET_KEY: key });
      assert.equal(response.status, 503);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('webhooks record only signed, paid sandbox orders and retry storage failures', async () => {
  const originalFetch = globalThis.fetch;
  const recorded = [];
  const secret = 'whsec_test';
  const env = {
    STRIPE_SECRET_KEY: 'rk_test_fake', STRIPE_WEBHOOK_SECRET: secret,
    ORDERS: { getByName: (id) => ({ recordPaid: async (order) => recorded.push({ id, order }) }) },
  };
  globalThis.fetch = async () => new Response(JSON.stringify({ data: [
    { description: 'Eco Strap', price: { id: 'price_1' }, quantity: 2, amount_total: 3600 },
  ], has_more: false }));
  const session = { id: 'cs_test_123', livemode: false, payment_status: 'paid', amount_total: 3600, currency: 'gbp', metadata: { storefront: 'eco-storefront' } };
  async function send(type, changes = {}, invalidSignature = false, target = env) {
    const payload = JSON.stringify({ id: 'evt_test', type, livemode: changes.livemode ?? false, data: { object: { ...session, ...changes } } });
    const timestamp = Math.floor(Date.now() / 1000);
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
    const signature = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    return worker.fetch(new Request('https://store.example/api/webhook', {
      method: 'POST', body: payload, headers: { 'stripe-signature': `t=${timestamp},v1=${invalidSignature ? 'bad' : signature}` },
    }), target);
  }
  try {
    assert.equal((await send('checkout.session.completed', {}, true)).status, 400);
    assert.equal((await send('checkout.session.completed', { payment_status: 'unpaid' })).status, 200);
    assert.equal((await send('checkout.session.completed', { metadata: { storefront: 'other-store' } })).status, 200);
    assert.equal(recorded.length, 0);
    assert.equal((await send('checkout.session.completed')).status, 200);
    assert.equal((await send('checkout.session.async_payment_succeeded')).status, 200);
    assert.equal(recorded.length, 2);
    assert.equal(recorded[0].id, session.id);
    assert.equal(recorded[0].order.items[0].quantity, 2);
    assert.equal((await send('checkout.session.completed', { livemode: true })).status, 400);
    const liveEnv = { ...env, STRIPE_SECRET_KEY: 'rk_live_fake', STRIPE_MODE: 'live', LIVE_CHECKOUT_ENABLED: '1', SHIPPING_RATE_ID: 'shr_live' };
    assert.equal((await send('checkout.session.completed', {}, false, liveEnv)).status, 400);
    assert.equal((await send('checkout.session.completed', { livemode: true }, false, liveEnv)).status, 200);
    assert.equal(recorded.length, 3);
    assert.equal((await send('checkout.session.completed', { livemode: true }, false, { ...liveEnv, LIVE_CHECKOUT_ENABLED: '0' })).status, 503);
    assert.equal((await send('checkout.session.completed', {}, false, { ...env, ORDERS: undefined })).status, 503);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('live preview sells only its approved catalog and requires matching mode and shipping', async () => {
  const originalFetch = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname;
    let data;
    if (path === '/v1/products') data = { data: ['jdc-duo', 'eco-strap'].map((slug) => ({ id: `prod_${slug}`, name: slug, metadata: { storefront: 'eco-storefront', slug } })), has_more: false };
    else if (path === '/v1/prices') data = { data: ['jdc-duo', 'eco-strap'].map((slug) => ({ id: `price_${slug}`, product: `prod_${slug}`, type: 'one_time', currency: 'gbp', unit_amount: 1799 })), has_more: false };
    else if (path === '/v1/checkout/sessions') { sent = new URLSearchParams(options.body); data = { id: 'cs_live_example', url: 'https://checkout.stripe.com/example' }; }
    else throw new Error(`Unexpected request ${path}`);
    return new Response(JSON.stringify(data));
  };
  try {
    const env = { STRIPE_SECRET_KEY: 'rk_live_fake', STRIPE_WEBHOOK_SECRET: 'whsec_fake', ORDERS: {}, STRIPE_MODE: 'live', LIVE_CHECKOUT_ENABLED: '1', SHIPPING_RATE_ID: 'shr_live', STORE_PRODUCT_SLUGS: 'jdc-duo' };
    const data = await (await worker.fetch(new Request('https://store.example/api/catalog'), env)).json();
    assert.equal(data.checkout_enabled, true);
    assert.deepEqual(data.products.map((p) => p.slug), ['jdc-duo']);
    const request = (price) => new Request('https://store.example/api/checkout', { method: 'POST', body: JSON.stringify({ items: [{ price_id: price, quantity: 1 }] }) });
    assert.equal((await worker.fetch(request('price_eco-strap'), env)).status, 400);
    assert.equal((await worker.fetch(request('price_jdc-duo'), env)).status, 200);
    assert.equal(sent.get('shipping_options[0][shipping_rate]'), 'shr_live');
    assert.equal(sent.get('automatic_tax[enabled]'), null);
    for (const change of [{ STRIPE_SECRET_KEY: 'rk_test_fake' }, { SHIPPING_RATE_ID: undefined }, { LIVE_CHECKOUT_ENABLED: '0' }]) {
      assert.equal((await worker.fetch(request('price_jdc-duo'), { ...env, ...change })).status, 503);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('test checkout waits for both webhook signing secret and order storage', async () => {
  for (const missing of ['ORDERS', 'STRIPE_WEBHOOK_SECRET']) {
    const env = { STRIPE_SECRET_KEY: 'rk_test_fake', STRIPE_WEBHOOK_SECRET: 'whsec_test', ORDERS: {} };
    delete env[missing];
    const response = await worker.fetch(new Request('https://store.example/api/checkout', { method: 'POST' }), env);
    assert.equal(response.status, 503);
  }
});
