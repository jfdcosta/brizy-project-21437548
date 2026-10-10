# Eco Layer Labs Stripe integration plan and review

10 October 2026. Business: https://ecolayerlabs.com, UK 3D printing solutions, JDC VENTURES LTD. Requested products: Payments, Invoicing, Tax.

## Plugin and account verification

The Stripe plugin is already installed and authenticated: its account-list, API and implementation-planner tools are callable. No duplicate plugin installation, additional MCP server or fallback skills installation was necessary.

Planner guide `iguide_61VYNU9kApKzc5Hta4106PcSYJA8k` was generated and accepted using the connected **JDC VENTURES LTD sandbox**, `acct_1UODLe06PcSYJA8k`, livemode false. The live ecolayerlabs account was subsequently connected and verified; the temporary preview now has live Checkout enabled. See LIVE_PREVIEW_SETUP.md for account, configuration and verification details. The planner review was recorded in the separate Stripe setup chat.

## Payments: prepared products

Use Stripe-hosted Checkout Sessions for one-time purchases. JDC Duo is £17.99 GBP for the two-body/two-insert PLA pair, plus £1.99 UK delivery per order. Dispatch within 2–3 working days; transit time is additional. Watches, chargers, cables and pegboard are excluded.

Retain the tested Worker implementation: server-derived Stripe Price IDs and amounts, UK address collection, dynamic payment methods, encrypted server credentials, integration identifier, signed paid webhooks and idempotent order persistence. Orders become eligible for production from verified payment events, not from the success-page redirect. Keep both immediate and asynchronous-payment success handling.

Use separate live products, prices, shipping rate, webhook signing secret and order environment. Sandbox IDs cannot be copied into live calls. The live product allowlist must contain only ready-to-sell items; Eco Strap, Modular Bottle and Desk Set are concept test listings and should not be seeded into live checkout by the general prototype seed script. Preserve model and product details from the local catalog.

Before switching the public domain, provide live credentials securely, verify the account can accept payments, create the live £17.99 price and £1.99 shipping rate, register the production webhook, and update the current explicit live-checkout/webhook guards only for the intended live environment. Test the live catalog, shipping configuration and event handling without placing an unauthorized real charge.

## Invoicing: custom STL printing

Start with reviewed, one-off Dashboard invoices and the Hosted Invoice Page. A customer provides an STL and requirements; the file is reviewed and sliced; a fixed quote is agreed; a draft invoice itemizes the accepted work and delivery; the customer pays before printing. Do not automatically invoice the enclosed STL volume.

Use Eco Layer Labs branding and a quote/job reference. Invoice line descriptions should state the part, material, quantity and agreed work; internal costs and pricing margin stay internal. Metadata can link records but does not replace customer-visible descriptions. Require deliberate review before finalizing/sending a custom invoice; do not automatically charge saved cards. No customer invoice or email was sent during this review.

Manual Dashboard reconciliation is sufficient initially. The current Worker does not process invoice events: invoices must not be treated as Checkout Session orders. If custom jobs are later managed in the app, add a separate invoice/job record keyed by invoice ID, associate the accepted quote, retrieve invoice status, and process paid/failure/void events idempotently. Do not assume every marked-paid invoice was paid through Stripe; reconcile its payment method before authorizing production. API automation should use idempotency keys and an authenticated admin workflow, never a public arbitrary-amount invoice endpoint.

Stripe Invoicing and Tax can have additional service fees beyond card processing. Add their applicable account pricing to custom-job economics before treating the card-only costing estimate as an invoice margin.

## Tax

The user confirmed JDC VENTURES LTD is **not VAT registered** on 10 October 2026. Keep VAT collection and automatic tax disabled for the current UK launch. Stripe Tax does not itself prove tax registration: configure the legal entity, head-office address, product tax codes, prices' tax behavior and any applicable active registrations first. Without a registration for the customer's location, automatic calculation may return zero tax.

If VAT registered, agree whether the advertised £17.99 and £1.99 are tax inclusive before creating live prices, configure the correct registration, and verify Checkout and invoice tax separately. For the confirmed current non-registered status, do not present charges as VAT or create a registration from an assumption. Monitor obligations separately from enabling collection. No tax registration or automatic tax setting was changed.

## Existing integration review

| Area | Current evidence | Improvement needed |
|---|---|---|
| Plugin/MCP | Planner, sandbox and live account tools callable | Retain separate account contexts |
| Catalog and Checkout | £19.98 live unpaid Checkout Session verified through the deployed preview | Verify an actual paid live event and fulfillment |
| Payment confirmation | Signed paid webhooks with live/test isolation; live endpoint configured | Verify actual live delivery after the first real payment |
| Duplicate events | One SQLite record per Checkout Session | Retain persistence tests |
| Checkout retries | SDK network retries; no explicit cart-attempt idempotency key | Add bounded server-validated checkout-attempt keys to avoid duplicate sessions |
| Fulfillment | Orders persist as awaiting_review | Authenticated order access, dispatch/status tracking and customer notifications |
| Customer data | No public stored customer-detail endpoint | Define staff access and retention/deletion procedures |
| Custom quotes | Browser-only STL geometry preview | Real request intake, slicing/review and accepted-job reference |
| Invoicing | No invoice-specific flow in the Worker | Manual reviewed invoices initially; add invoice events if app-managed |
| Tax | Automatic tax not configured | Not VAT registered; keep collection off and review obligations as the business grows |
| Public domain | https://ecolayerlabs.com returns HTTP 200 and serves a Firebase-containing storefront | Verify DNS/routes and migrate the intended app deliberately; the tested Worker is on a separate sandbox hostname |
| Sales information | Sandbox listing states price, contents and dispatch | Real seller contact, delivery/returns/refund/privacy information and a usable fulfillment process |

This review read `src/worker.js`, `src/commerce.js`, `src/order-store.js`, the catalog, deployment configs and existing costing implementation. Live Checkout was subsequently enabled on the temporary preview; no real payment was submitted, so paid fulfillment is not yet verified end to end. Existing tests and sandbox payment evidence are recorded in the earlier verification artifacts.

## Agreed costing defaults

Retain `catalog/costing.json` and `src/costing.js`: raw PLA £10/kg, PETG £12/kg; electricity £0.26/kWh at assumed 0.2 kW; actual wear £0.50/hour. Actual printer estimate £0.552/hour is separate from the customer printer tariff £3.50/hour. Any excess wear markup is margin. Use slicer grams/hours and actual postage, not solid mesh volume, for estimates. Card fees apply to item plus delivery revenue. Supplier costs, measured consumption, labour and failures still need reconciliation against actual jobs.

## Next implementation order

1. Live-account access and temporary preview checkout are complete; current non-VAT-registered status is confirmed.
2. Resolve live seller/payment settings and public-store information; establish authenticated fulfillment access.
3. Live JDC Duo price, delivery rate, webhook and encrypted restricted server key are configured on the preview.
4. Sandbox/live isolation is implemented. Add checkout retry idempotency and necessary invoice/job handling for the chosen operating process.
5. Validate, then switch the intended domain and enable real payments only on the production environment.

References: [Stripe hosted Checkout](https://docs.stripe.com/payments/accept-a-payment?payment-ui=checkout&ui=stripe-hosted), [Dashboard invoices](https://docs.stripe.com/invoicing/dashboard), [Hosted Invoice Page](https://docs.stripe.com/invoicing/hosted-invoice-page), [Stripe Tax setup](https://docs.stripe.com/tax/set-up), [go-live checklist](https://docs.stripe.com/get-started/checklist/go-live), [MCP setup](https://docs.stripe.com/mcp).
