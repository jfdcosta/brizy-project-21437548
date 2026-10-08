import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutForm, validateCart, verifyStripeSignature } from '../src/commerce.js';

test('cart accepts only known Stripe price IDs and bounded quantities', () => {
  const catalog = [{ price_id: 'price_abc' }];
  assert.deepEqual(validateCart([{ price_id: 'price_abc', quantity: 2 }], catalog), [{ price_id: 'price_abc', quantity: 2 }]);
  assert.throws(() => validateCart([{ price_id: 'price_other', quantity: 1 }], catalog));
  assert.throws(() => validateCart([{ price_id: 'price_abc', quantity: 0 }], catalog));
});

test('checkout creates Stripe-hosted payment URLs and shipping fields', () => {
  const form = checkoutForm([{ price_id: 'price_abc', quantity: 2 }], 'https://store.example', 'shr_123', ['GB'], 'automatic');
  assert.equal(form.get('line_items[0][price]'), 'price_abc');
  assert.equal(form.get('shipping_options[0][shipping_rate]'), 'shr_123');
  assert.equal(form.get('success_url'), 'https://store.example/success.html?session_id={CHECKOUT_SESSION_ID}');
  assert.equal(form.get('automatic_tax[enabled]'), 'true');
});

test('webhook verifies Stripe signature and rejects tampering', async () => {
  const payload = '{"type":"checkout.session.completed"}';
  const timestamp = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('whsec_test'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const signature = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const header = `t=${timestamp},v1=${signature}`;
  assert.equal(await verifyStripeSignature(payload, header, 'whsec_test'), true);
  assert.equal(await verifyStripeSignature(payload + ' ', header, 'whsec_test'), false);
  assert.equal(await verifyStripeSignature(payload, header, 'whsec_test', Date.now() + 600000), false);
});
