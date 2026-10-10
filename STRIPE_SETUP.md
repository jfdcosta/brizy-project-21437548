# Eco Layer Labs sandbox checkout

Account: JDC VENTURES LTD sandbox (`acct_1UODLe06PcSYJA8k`).
Checked on 10 October 2026: Eco Strap £18, Modular Bottle £28, Desk Set £42.
These are test listings. JDC Duo is now £17.99 in sandbox checkout, with £1.99 UK delivery per order and dispatch within 2–3 working days. The separate temporary live preview is configured; see `LIVE_PREVIEW_SETUP.md`.

## Credentials

In the sandbox Stripe Dashboard, open Developers → API keys and create a restricted key named `Eco Layer Labs sandbox storefront`.
Grant Products read, Prices read, and Checkout Sessions write (including session and line-item retrieval). Keep unrelated permissions disabled.
Save the key in the ignored `.dev.vars` file as `STRIPE_SECRET_KEY=rk_test_...`; never put its value in chat, source control, or the browser code.
For the hosted preview, use Cloudflare encrypted secrets rather than committing credentials.

## Local payment test

1. Run `npm ci`, `npm test`, `npm run test:runtime`, and `npm run dev`.
2. Sign the Stripe CLI into the same sandbox. Forward `checkout.session.completed` and `checkout.session.async_payment_succeeded` to `http://127.0.0.1:8787/api/webhook` with `stripe listen`.
3. Save the listener's actual signing secret in `.dev.vars` as `STRIPE_WEBHOOK_SECRET=whsec_...` and restart the local Worker. A CLI listener secret is different from a Dashboard endpoint secret.
4. Open the catalog, add a test product to the bag, and check the hosted Stripe Checkout price and quantity.
5. Use test card `4242 4242 4242 4242`, a future expiry date and any valid CVC. Complete checkout. Verify that the return page API reports `payment_status: paid` and `order_recorded: true`.
6. Redeliver the same webhook. The order must remain a single SQLite record.

The Worker validates Price IDs against the active GBP catalog. Checkout waits for both its webhook secret and order-storage binding. Paid webhooks store the items, total, customer/shipping details and `awaiting_review` fulfillment status in one Durable Object per Checkout Session. Both immediate and delayed payment events are handled. Unpaid, unrelated-store and live events cannot create sandbox orders. Stored customer details have no public HTTP endpoint.

## Hosted sandbox preview

The isolated Stripe sandbox is deployed at https://eco-storefront-stripe-sandbox.jfdcosta-jdc.workers.dev/ using `wrangler.stripe-sandbox.jsonc`. Update it with `npm run deploy:stripe-sandbox`. The `orders-v1` migration creates its SQLite order namespace. Configure encrypted secrets with this sandbox config.
Register `https://eco-storefront-stripe-sandbox.jfdcosta-jdc.workers.dev/api/webhook` in this sandbox for both `checkout.session.completed` and `checkout.session.async_payment_succeeded`, then store the endpoint signing secret with `wrangler secret put STRIPE_WEBHOOK_SECRET --config wrangler.stripe-sandbox.jsonc`.
Use API version `2026-09-30.endive` for that endpoint to match Stripe Node 23.0.0. Re-run the payment test against the hosted URL and verify webhook delivery and durable order recording.

UK shipping is fixed at £1.99 per order in the sandbox; automatic tax is not configured. The separate live configuration and remaining public-domain launch work are documented in `LIVE_PREVIEW_SETUP.md`.

References: [Stripe hosted Checkout](https://docs.stripe.com/payments/accept-a-payment?payment-ui=checkout&ui=stripe-hosted), [fulfillment](https://docs.stripe.com/checkout/fulfillment), [restricted keys](https://docs.stripe.com/keys-best-practices).

## Verified setup

On 10 October 2026, a local and a hosted £18 test checkout both succeeded and recorded an order. The hosted endpoint `we_1UOyl406PcSYJA8kgGaJ9mXy` is enabled in the sandbox, with its signing secret stored as an encrypted Cloudflare Worker secret. `.dev.vars` contains the local CLI listener secret; `.dev.vars.stripe-sandbox` contains the hosted configuration and is ignored by Git. Both local processes were stopped after testing; hosted checkout continues to work independently. This earlier payment verification was performed in the separate Stripe setup chat; no live payment was submitted.

## Agreed costing and JDC Duo listing

Defaults are in `catalog/costing.json`, with reusable arithmetic in `src/costing.js`. PLA £10/kg, PETG £12/kg, electricity £0.26/kWh at 0.2 kW, wear £0.50/hour. Customer printer service £3.50/hour remains separate from actual printer cost. JDC Duo product `prod_VPopCPEXyImnkV`, price `price_1UOzC706PcSYJA8kL7s5tKxb`, £17.99. Shipping `shr_1UOzC806PcSYJA8kuCxBAiLA` is £1.99 per order. Dispatch 2–3 working days, distinct from delivery transit time. Seller absorbs postage above £1.99; deduct actual postage in the costing calculator. These identifiers are sandbox-only.
