import products from '../catalog/products.json' with { type: 'json' };
import { STOREFRONT_ID } from '../src/commerce.js';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('STRIPE_SECRET_KEY is required to create Stripe test products.');
  process.exit(1);
}
async function stripe(path, body) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      authorization: `Bearer ${key}`,
      ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
    body,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `Stripe returned ${response.status}`);
  return data;
}

const balance = await stripe('/balance');
if (balance.livemode !== false && process.env.ALLOW_LIVE_SEED !== '1') {
  console.error('Prototype seeding requires Stripe test mode. Live seeding requires ALLOW_LIVE_SEED=1.');
  process.exit(1);
}

async function list(resource) {
  const result = [];
  let after;
  do {
    const params = new URLSearchParams({ active: 'true', limit: '100' });
    if (after) params.set('starting_after', after);
    const page = await stripe(`/${resource}?${params}`);
    result.push(...page.data);
    after = page.has_more ? page.data.at(-1)?.id : undefined;
  } while (after);
  return result;
}

const existing = await list('products');
const prices = await list('prices');
for (const product of products.filter((product) => product.availability !== 'prototype' && Number.isInteger(product.unit_amount))) {
  const form = new URLSearchParams({
    name: product.name,
    description: product.description,
    'metadata[storefront]': STOREFRONT_ID,
    'metadata[slug]': product.slug,
    'metadata[model]': product.model || 'generic',
    'metadata[accent]': product.accent,
  });
  const found = existing.find((item) => item.metadata?.storefront === STOREFRONT_ID && item.metadata?.slug === product.slug);
  const saved = await stripe(found ? `/products/${found.id}` : '/products', form);
  let price = prices.find((item) => item.product === saved.id && item.unit_amount === product.unit_amount && item.currency === product.currency && item.type === 'one_time');
  if (!price) {
    price = await stripe('/prices', new URLSearchParams({
      product: saved.id,
      unit_amount: String(product.unit_amount),
      currency: product.currency,
      nickname: `${STOREFRONT_ID}:${product.slug}`,
    }));
  }
  if (saved.default_price !== price.id) {
    await stripe(`/products/${saved.id}`, new URLSearchParams({ default_price: price.id }));
  }
  console.log(`${found ? 'Updated' : 'Created'} ${product.slug}: ${saved.id}, ${price.id}`);
}
