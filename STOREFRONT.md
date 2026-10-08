# Form Lab storefront prototype

The new Cloudflare Worker storefront is in `storefront/` and `src/`. The original Brizy export remains at the repository root. The current catalog contains three clearly labelled prototype products. The 3D views are original procedural models and do not use assets from a third-party site.

## Local development

Requires Node.js 20 or later. The cloud environment's home directory is read-only, so put Wrangler's config and npm's cache in writable paths:

```sh
cd /workspace/brizy-project-21437548
npm_config_cache=/tmp/eco-storefront-npm-cache npm ci
npm run build
XDG_CONFIG_HOME=/tmp/eco-storefront-config WRANGLER_SEND_METRICS=false npx wrangler dev --local --port 8787
```

Open the local app at port 8787. `npm test` checks cart validation, Stripe form creation, webhook signatures, and the catalog-to-checkout flow. `npm run smoke` runs a browser check against the local Worker.

## Stripe catalog and payments

Stripe Products and Prices are the source of truth when `STRIPE_SECRET_KEY` is configured on the Worker. The cart sends Stripe Price IDs, and the Worker verifies those IDs against the active catalog before creating a Stripe-hosted Checkout Session. Payment card details never pass through this app. The return page checks the Checkout Session's payment status with Stripe. Stripe stores customer and order records; the signed webhook endpoint is `/api/webhook`.

To seed the prototype catalog into **Stripe test mode**, provide a test secret key securely and run `npm run seed:stripe`. The script is idempotent by product slug and storefront metadata. It refuses a live key unless `ALLOW_LIVE_SEED=1` is explicitly set. Review names, descriptions, prices, images, stock, and policies before any live seeding.

For a deployed Worker, configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as encrypted Worker secrets, not in this repository. Register `https://<your-domain>/api/webhook` in Stripe for `checkout.session.completed`. Stripe receipts must be enabled in the Stripe dashboard. The current webhook verifies signatures and logs completed Checkout Session IDs; fulfillment automation has not been connected.

Live checkout requires `SHIPPING_RATE_ID` and `TAX_MODE` (`automatic` or `none`) as Worker variables. `SHIPPING_COUNTRIES` defaults to `GB`. Set a valid Stripe Shipping Rate and choose the tax mode according to the business's actual shipping and tax policies. Test keys permit a prototype checkout without these live settings.

## Cloudflare deployment

With Cloudflare account access, install dependencies, build, and run `npx wrangler deploy`. Connect a domain in Cloudflare and set the Worker secrets and variables there. Deploying source without Stripe secrets leaves the site in mock catalog mode with checkout disabled. A live launch also needs legal pages, returns/refund and delivery policies, product inventory, and a fulfillment process.

The requested reference is `ecolayerlabs.com`. Its visible catalog, 3D implementation, checkout, and network calls still need an audit. The current cloud runtime blocks that domain until the saved network draft is reviewed, saved, and published. The prototype is an original implementation and should not be described as a reproduction of the reference site yet.
