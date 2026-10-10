import { DurableObject } from 'cloudflare:workers';

// One durable object per Checkout Session; no public route exposes customer data.
export class CheckoutOrder extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS paid_order (
      session_id TEXT PRIMARY KEY, event_id TEXT NOT NULL,
      recorded_at TEXT NOT NULL, fulfillment_status TEXT NOT NULL,
      details TEXT NOT NULL
    )`);
  }

  recordPaid(order) {
    this.ctx.storage.sql.exec(
      `INSERT OR IGNORE INTO paid_order VALUES (?, ?, ?, ?, ?)`,
      order.session_id, order.event_id, new Date().toISOString(),
      'awaiting_review', JSON.stringify(order),
    );
    return this.summary();
  }

  summary() {
    const row = this.ctx.storage.sql.exec(
      'SELECT recorded_at, fulfillment_status FROM paid_order LIMIT 1',
    ).toArray()[0];
    return row || null;
  }
}
