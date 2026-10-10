export const STOREFRONT_ID = 'eco-storefront';

export function stripeMode(key) {
  if (/^(sk|rk)_live_/.test(key || '')) return 'live';
  if (/^(sk|rk)_test_/.test(key || '')) return 'test';
  return 'unknown';
}

export function validateCart(items, catalog) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
    throw new Error('Cart must contain 1 to 20 products.');
  }
  const prices = new Map(catalog.filter((product) => product.price_id).map((product) => [product.price_id, product]));
  const seen = new Set();
  return items.map((item) => {
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new Error('Quantity must be between 1 and 10.');
    }
    if (!prices.has(item.price_id)) {
      throw new Error('A product in your cart is no longer available.');
    }
    if (seen.has(item.price_id)) {
      throw new Error('Combine duplicate products into one cart line.');
    }
    seen.add(item.price_id);
    return { price_id: item.price_id, quantity };
  });
}

export function checkoutForm(items, origin, shippingRateId, countries = ['GB'], taxMode = 'none') {
  const body = new URLSearchParams({
    integration_identifier: `eco_storefront_${Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => String.fromCharCode(97 + byte % 26)).join('')}`,
    mode: 'payment',
    success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/cart.html`,
    billing_address_collection: 'required',
    allow_promotion_codes: 'true',
    'metadata[storefront]': STOREFRONT_ID,
  });
  items.forEach((item, index) => {
    body.set(`line_items[${index}][price]`, item.price_id);
    body.set(`line_items[${index}][quantity]`, String(item.quantity));
  });
  countries.forEach((country, index) => {
    body.set(`shipping_address_collection[allowed_countries][${index}]`, country);
  });
  if (shippingRateId) body.set('shipping_options[0][shipping_rate]', shippingRateId);
  if (taxMode === 'automatic') body.set('automatic_tax[enabled]', 'true');
  return body;
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export async function verifyStripeSignature(payload, signatureHeader, secret, now = Date.now()) {
  if (!signatureHeader || !secret) return false;
  const parts = signatureHeader.split(',').map((part) => part.trim().split('='));
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1]);
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!Number.isInteger(timestamp) || Math.abs(now / 1000 - timestamp) > 300 || signatures.length === 0) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return signatures.some((signature) => constantTimeEqual(signature, expected));
}
