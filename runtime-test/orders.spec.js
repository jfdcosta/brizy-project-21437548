import { env } from 'cloudflare:workers';
import { runInDurableObject } from 'cloudflare:test';
import { expect, test } from 'vitest';
import { CheckoutOrder } from '../src/order-store.js';

test('duplicate and concurrent paid notifications leave one persisted order', async () => {
  const sessionId = `cs_test_${crypto.randomUUID()}`;
  const stub = env.ORDERS.getByName(sessionId);
  const order = { session_id: sessionId, event_id: 'evt_first', items: [{ quantity: 2 }], amount_total: 3600 };
  const [first, second] = await Promise.all([stub.recordPaid(order), stub.recordPaid({ ...order, event_id: 'evt_retry' })]);
  expect(first).toEqual(second);
  await runInDurableObject(stub, async (instance, state) => {
    const rows = state.storage.sql.exec('SELECT * FROM paid_order').toArray();
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].details).items).toEqual(order.items);
    // Reconstruct the class over the same SQLite state to verify storage-backed recovery.
    const reconstructed = new CheckoutOrder(state, env);
    expect(reconstructed.summary()).toEqual(first);
  });
  expect(await env.ORDERS.getByName(`cs_test_${crypto.randomUUID()}`).summary()).toBeNull();
});
