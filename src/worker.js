import mockProducts from '../catalog/products.json' with { type: 'json' };
import Stripe from 'stripe';
import { STOREFRONT_ID, checkoutForm, stripeMode, validateCart, verifyStripeSignature } from './commerce.js';

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
});

function stripeClient(env) {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
  });
}

function paymentReady(env) {
  const mode = stripeMode(env.STRIPE_SECRET_KEY);
  const expected = env.STRIPE_MODE || 'test';
  return mode === expected && !!env.STRIPE_WEBHOOK_SECRET && !!env.ORDERS
    && (mode === 'test' || (mode === 'live' && env.LIVE_CHECKOUT_ENABLED === '1' && !!env.SHIPPING_RATE_ID));
}

function allowedProducts(env) {
  const slugs = env.STORE_PRODUCT_SLUGS?.split(',').map((slug) => slug.trim());
  return slugs ? mockProducts.filter((product) => slugs.includes(product.slug)) : mockProducts;
}

async function stripeList(env, resource) {
  const all = [];
  let after;
  do {
    const page = await stripeClient(env)[resource].list({ active: true, limit: 100, ...(after ? { starting_after: after } : {}) });
    all.push(...page.data);
    after = page.has_more ? page.data.at(-1)?.id : undefined;
  } while (after);
  return all;
}

async function catalog(env) {
  const localProducts = allowedProducts(env);
  const prototypeProducts = localProducts.filter((product) => product.availability === 'prototype')
    .map((product) => ({ ...product, id: `prototype_${product.slug}`, price_id: null }));
  if (!env.STRIPE_SECRET_KEY) {
    return {
      mode: 'mock',
      checkout_enabled: false,
      products: localProducts.map((product) => ({ ...product, id: `mock_${product.slug}`, price_id: null })),
    };
  }
  const [products, prices] = await Promise.all([stripeList(env, 'products'), stripeList(env, 'prices')]);
  const activePrices = new Map();
  const pricesById = new Map();
  for (const price of prices) {
    pricesById.set(price.id, price);
    if (price.type === 'one_time' && price.currency === 'gbp' && Number.isInteger(price.unit_amount) && price.unit_amount > 0 && typeof price.product === 'string') {
      const current = activePrices.get(price.product);
      if (!current || price.created > current.created) activePrices.set(price.product, price);
    }
  }
  return {
    mode: stripeMode(env.STRIPE_SECRET_KEY),
    checkout_enabled: paymentReady(env),
    products: [...prototypeProducts, ...products.filter((product) => product.metadata?.storefront === STOREFRONT_ID && localProducts.some((item) => item.slug === product.metadata?.slug) && !prototypeProducts.some((preview) => preview.slug === product.metadata?.slug))
      .map((product) => {
        const localProduct = mockProducts.find((item) => item.slug === product.metadata.slug);
        const defaultPrice = pricesById.get(product.default_price);
        const price = defaultPrice?.product === product.id && defaultPrice?.type === 'one_time' && defaultPrice?.currency === 'gbp' && Number.isInteger(defaultPrice?.unit_amount) && defaultPrice.unit_amount > 0
          ? defaultPrice : activePrices.get(product.id);
        if (!price) return null;
        return {
          ...localProduct,
          id: product.id,
          price_id: price.id,
          slug: product.metadata.slug || product.id,
          name: product.name,
          description: product.description || '',
          unit_amount: price.unit_amount,
          currency: price.currency,
          model: product.metadata.model || 'generic',
          accent: product.metadata.accent || '#6d8a53',
          image: localProduct?.image || product.images?.[0] || null,
          model3d: localProduct?.model3d || null,
          detail_url: localProduct?.detail_url || null,
          availability: stripeMode(env.STRIPE_SECRET_KEY) === 'live' ? 'available' : localProduct?.availability,
        };
      }).filter(Boolean)],
  };
}

async function checkout(request, env) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Checkout is not connected to Stripe yet.' }, 503);
  if (!paymentReady(env)) return json({ error: 'Checkout is waiting for its payment, shipping and order configuration.' }, 503);
  let payload;
  try { payload = await request.json(); } catch { return json({ error: 'Invalid cart.' }, 400); }
  let items;
  try { items = validateCart(payload.items, (await catalog(env)).products); }
  catch (error) { return json({ error: error.message }, 400); }
  const origin = new URL(request.url).origin;
  const countries = (env.SHIPPING_COUNTRIES || 'GB').split(',').map((country) => country.trim().toUpperCase());
  const form = checkoutForm(items, origin, env.SHIPPING_RATE_ID, countries, env.TAX_MODE);
  const session = await stripeClient(env).checkout.sessions.create(Object.fromEntries(form));
  return json({ url: session.url, id: session.id });
}

async function order(request, env) {
  const id = new URL(request.url).searchParams.get('session_id');
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Stripe is not connected.' }, 503);
  if (!id || !/^cs_(test_|live_)[A-Za-z0-9]+$/.test(id)) return json({ error: 'Invalid session ID.' }, 400);
  const [session, lines] = await Promise.all([
    stripeClient(env).checkout.sessions.retrieve(id),
    stripeClient(env).checkout.sessions.listLineItems(id, { limit: 100 }),
  ]);
  if (session.metadata?.storefront !== STOREFRONT_ID) return json({ error: 'Order not found.' }, 404);
  const recorded = env.ORDERS ? await env.ORDERS.getByName(id).summary() : null;
  return json({
    id: session.id,
    mode: session.livemode ? 'live' : 'test',
    payment_status: session.payment_status,
    status: session.status,
    amount_total: session.amount_total,
    currency: session.currency,
    order_recorded: !!recorded,
    fulfillment_status: recorded?.fulfillment_status || null,
    items: lines.data.map((line) => ({ description: line.description, quantity: line.quantity, amount_total: line.amount_total })),
  });
}

async function webhook(request, env) {
  const payload = await request.text();
  const valid = await verifyStripeSignature(payload, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return json({ error: 'Invalid Stripe signature.' }, 400);
  let event;
  try { event = JSON.parse(payload); } catch { return json({ error: 'Invalid webhook payload.' }, 400); }
  const checkoutEvent = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type);
  const session = event.data?.object;
  if (checkoutEvent && session?.metadata?.storefront === STOREFRONT_ID && session.payment_status === 'paid') {
    const live = (env.STRIPE_MODE || 'test') === 'live';
    if (stripeMode(env.STRIPE_SECRET_KEY) !== (live ? 'live' : 'test') || event.livemode !== live || session.livemode !== live) {
      return json({ error: 'Payment event does not match this store environment.' }, 400);
    }
    if (live && !paymentReady(env)) return json({ error: 'Live order configuration is incomplete.' }, 503);
    if (!env.ORDERS) return json({ error: 'Order storage is not configured.' }, 503);
    const lines = [];
    for await (const line of stripeClient(env).checkout.sessions.listLineItems(session.id, { limit: 100 })) {
      lines.push({ price_id: line.price?.id, description: line.description, quantity: line.quantity, amount_total: line.amount_total });
    }
    await env.ORDERS.getByName(session.id).recordPaid({
      session_id: session.id, event_id: event.id, amount_total: session.amount_total,
      currency: session.currency, payment_intent: session.payment_intent,
      customer_details: session.customer_details,
      shipping_details: session.collected_information?.shipping_details || session.shipping_details || null,
      items: lines,
    });
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
      const assetUrl = new URL(request.url);
      if (/^\/products\/[a-z0-9-]+\/?$/.test(url.pathname)) assetUrl.pathname = '/product';
      const asset = await env.ASSETS.fetch(new Request(assetUrl, request));
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
