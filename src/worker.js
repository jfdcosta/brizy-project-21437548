import mockProducts from '../catalog/products.json' with { type: 'json' };
import { STOREFRONT_ID, checkoutForm, stripeMode, validateCart, verifyStripeSignature } from './commerce.js';

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
});

async function stripe(env, path, options = {}) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      ...(options.body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `Stripe returned ${response.status}.`);
  return data;
}

async function stripeList(env, resource) {
  const all = [];
  let after;
  do {
    const query = new URLSearchParams({ active: 'true', limit: '100' });
    if (after) query.set('starting_after', after);
    const page = await stripe(env, `/${resource}?${query}`);
    all.push(...page.data);
    after = page.has_more ? page.data.at(-1)?.id : undefined;
  } while (after);
  return all;
}

async function catalog(env) {
  const prototypeProducts = mockProducts.filter((product) => product.availability === 'prototype')
    .map((product) => ({ ...product, id: `prototype_${product.slug}`, price_id: null }));
  if (!env.STRIPE_SECRET_KEY) {
    return {
      mode: 'mock',
      checkout_enabled: false,
      products: mockProducts.map((product) => ({ ...product, id: `mock_${product.slug}`, price_id: null })),
    };
  }
  const [products, prices] = await Promise.all([stripeList(env, 'products'), stripeList(env, 'prices')]);
  const activePrices = new Map();
  const pricesById = new Map();
  for (const price of prices) {
    pricesById.set(price.id, price);
    if (price.type === 'one_time' && typeof price.product === 'string') {
      const current = activePrices.get(price.product);
      if (!current || price.created > current.created) activePrices.set(price.product, price);
    }
  }
  return {
    mode: stripeMode(env.STRIPE_SECRET_KEY),
    checkout_enabled: stripeMode(env.STRIPE_SECRET_KEY) === 'test',
    products: [...prototypeProducts, ...products.filter((product) => product.metadata?.storefront === STOREFRONT_ID && !prototypeProducts.some((preview) => preview.slug === product.metadata?.slug))
      .map((product) => {
        const price = pricesById.get(product.default_price) || activePrices.get(product.id);
        if (!price) return null;
        const localProduct = mockProducts.find((item) => item.slug === product.metadata.slug);
        return {
          id: product.id,
          price_id: price.id,
          slug: product.metadata.slug || product.id,
          name: product.name,
          description: product.description || '',
          unit_amount: price.unit_amount,
          currency: price.currency,
          model: product.metadata.model || 'generic',
          accent: product.metadata.accent || '#6d8a53',
          image: product.images?.[0] || null,
          turntable: localProduct?.turntable || null,
        };
      }).filter(Boolean)],
  };
}

async function checkout(request, env) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Checkout is not connected to Stripe yet.' }, 503);
  if (stripeMode(env.STRIPE_SECRET_KEY) !== 'test') return json({ error: 'Live checkout is disabled while fulfillment and store policies are unfinished.' }, 503);
  let payload;
  try { payload = await request.json(); } catch { return json({ error: 'Invalid cart.' }, 400); }
  let items;
  try { items = validateCart(payload.items, (await catalog(env)).products); }
  catch (error) { return json({ error: error.message }, 400); }
  const origin = new URL(request.url).origin;
  const countries = (env.SHIPPING_COUNTRIES || 'GB').split(',').map((country) => country.trim().toUpperCase());
  const form = checkoutForm(items, origin, env.SHIPPING_RATE_ID, countries, env.TAX_MODE);
  const session = await stripe(env, '/checkout/sessions', { method: 'POST', body: form });
  return json({ url: session.url, id: session.id });
}

async function order(request, env) {
  const id = new URL(request.url).searchParams.get('session_id');
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Stripe is not connected.' }, 503);
  if (!id || !/^cs_(test_|live_)[A-Za-z0-9]+$/.test(id)) return json({ error: 'Invalid session ID.' }, 400);
  const [session, lines] = await Promise.all([
    stripe(env, `/checkout/sessions/${id}`),
    stripe(env, `/checkout/sessions/${id}/line_items?limit=100`),
  ]);
  if (session.metadata?.storefront !== STOREFRONT_ID) return json({ error: 'Order not found.' }, 404);
  return json({
    id: session.id,
    payment_status: session.payment_status,
    status: session.status,
    amount_total: session.amount_total,
    currency: session.currency,
    items: lines.data.map((line) => ({ description: line.description, quantity: line.quantity, amount_total: line.amount_total })),
  });
}

async function webhook(request, env) {
  const payload = await request.text();
  const valid = await verifyStripeSignature(payload, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return json({ error: 'Invalid Stripe signature.' }, 400);
  const event = JSON.parse(payload);
  if (event.type === 'checkout.session.completed' && event.data.object.metadata?.storefront === STOREFRONT_ID) {
    console.log('Checkout completed:', event.data.object.id);
  }
  return json({ received: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/catalog' && request.method === 'GET') return json(await catalog(env));
      if (url.pathname === '/api/checkout' && request.method === 'POST') return await checkout(request, env);
      if (url.pathname === '/api/order' && request.method === 'GET') return await order(request, env);
      if (url.pathname === '/api/webhook' && request.method === 'POST') return await webhook(request, env);
      if (url.pathname.startsWith('/api/')) return json({ error: 'Not found.' }, 404);
      const asset = await env.ASSETS.fetch(request);
      if (env.STOREFRONT_PREVIEW !== '1') return asset;
      const headers = new Headers(asset.headers);
      headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
      return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
    } catch (error) {
      console.error(error);
      return json({ error: 'The store could not complete this request.' }, 500);
    }
  },
};
