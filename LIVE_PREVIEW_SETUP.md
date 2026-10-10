# Live payments on the temporary preview address

Activated 10 October 2026 on https://eco-storefront-preview.jfdcosta-jdc.workers.dev/ using the live ecolayerlabs account. The eventual ecolayerlabs.com domain is unchanged. The independent sandbox remains separate.

## Configuration

- Account: acct_1UOzU80S61GdmERu; charges and payouts enabled, no currently due requirements when checked.
- JDC Duo: prod_VPpKXH8TTsAW0a; price_1UOzfy0S61GdmERuaJ35kOT6, £17.99 GBP.
- UK delivery: shr_1UOznH0S61GdmERuUhqxmjBc, £1.99 per order.
- Dispatch: 2–3 working days; transit additional.
- Tax: none; business confirmed not VAT registered.
- Live webhook: we_1UOzgD0S61GdmERuYlFkx0ir at /api/webhook, API 2026-09-30.endive, checkout.session.completed and checkout.session.async_payment_succeeded.
- STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are encrypted Cloudflare secrets. The local private .dev.vars.preview is ignored by Git. Never copy credentials into client code or documentation.
- wrangler.preview.jsonc: STRIPE_MODE=live, LIVE_CHECKOUT_ENABLED=1, JDC Duo allowlist, GB shipping only, isolated Durable Object order storage.
- Initial payment deployment: 1798a4ca-5b67-4930-9a04-fbd2673dece3. Combined design/payment deployment: 27caa0c4-3343-450b-bcc3-d167d88fc88a.

## Verification

Published catalog returns mode live, checkout_enabled true, and only JDC Duo at 1799 GBP. A Checkout Session created through the published backend was retrieved from Stripe: livemode true, item 1799, shipping 199, total 1998, tax 0, payment_status unpaid. The combined deployment verification is in `artifacts/RESTORED_CHECKOUT_VERIFICATION_2026-10-10.json`. Unsigned webhook request correctly returns HTTP 400. No real payment was submitted, so an actual paid live webhook and fulfillment have not been verified end to end.

Before activation, 12 Node tests, the Durable Object runtime test, build and dry-run passed. Activation build and deployment passed. Tests cover approved-only products, configuration guards, signed live/test event isolation and idempotent order persistence.

Paid sessions are recorded as awaiting_review from verified Stripe events, rather than a success-page redirect. Authenticated staff access/dispatch tracking remains to be implemented; use Stripe Dashboard to review actual payments. Seller contact, returns/refund/privacy information and the operational fulfillment process remain items for the full public-domain launch. Custom STL quoting is still a browser geometry preview; accepted custom jobs require manual review and invoicing.

The combined design restores the photo-led homepage, static collection cards and product gallery with an on-demand 3D thumbnail. The live catalog preserves gallery, turntable and compatibility metadata from the local catalog. Existing encrypted secrets, the shipping rate, `orders-v1` migration and order namespace are retained. Deployed Chrome checks pass for the gallery, WebGL, the fallback with WebGL disabled, mobile layout and cart. The live checkout handoff was verified from the restored cart in headless Chrome: Stripe Checkout displayed £19.98, and the order API reported live mode, item £17.99, shipping £1.99, unpaid, and no recorded paid order. No payment details were entered and no real payment was submitted. Twelve Node tests, the Durable Object persistence test, build and deployment dry-run passed. The deployed order namespace is unchanged: `6683c96b67354932a17eb93906841dcd`.
