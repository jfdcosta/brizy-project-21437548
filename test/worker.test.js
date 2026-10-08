import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

test('Stripe catalog feeds checkout and rejects unlisted prices', async () => {
  const originalFetch = globalThis.fetch;
  let checkoutBody;
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname;
    let payload;
    if (path === '/v1/products') payload = { data: [{ id: 'prod_1', name: 'Eco Strap', description: 'Demo', active: true, default_price: 'price_1', metadata: { storefront: 'eco-storefront', slug: 'eco-strap', model: 'strap' }, images: [] }], has_more: false };
    else if (path === '/v1/prices') payload = { data: [{ id: 'price_1', product: 'prod_1', active: true, type: 'one_time', unit_amount: 1800, currency: 'gbp', created: 1 }], has_more: false };
    else if (path === '/v1/checkout/sessions') {
      checkoutBody = options.body;
      payload = { id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' };
    } else throw new Error(`Unexpected Stripe path ${path}`);
    return new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } });
  };
  try {
    const env = { STRIPE_SECRET_KEY: 'sk_test_fake', ASSETS: { fetch: () => new Response('asset') } };
    const catalog = await worker.fetch(new Request('https://store.example/api/catalog'), env);
    const data = await catalog.json();
    assert.equal(data.mode, 'test');
    assert.equal(data.products[0].price_id, 'price_1');

    const bad = await worker.fetch(new Request('https://store.example/api/checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: [{ price_id: 'price_other', quantity: 1 }] }),
    }), env);
    assert.equal(bad.status, 400);

    const good = await worker.fetch(new Request('https://store.example/api/checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: [{ price_id: 'price_1', quantity: 2 }] }),
    }), env);
    assert.equal(good.status, 200);
    assert.equal((await good.json()).url, 'https://checkout.stripe.com/c/pay/cs_test_123');
    assert.equal(checkoutBody.get('line_items[0][price]'), 'price_1');
    assert.equal(checkoutBody.get('line_items[0][quantity]'), '2');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('live Stripe keys cannot create a Checkout Session in this prototype', async () => {
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
