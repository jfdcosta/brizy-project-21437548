# Eco Layer Labs storefront prototype

The Cloudflare Worker storefront is in `storefront/` and `src/`. The original Brizy export remains at the repository root. The current catalog contains JDC Duo as a non-purchasable working prototype alongside three concept products with prototype prices. JDC Duo has an interactive 3D display of the four current dock parts, assembled from the local Blender source and revised Galaxy insert; watches and chargers are absent from that display. The other 3D product views are procedural concepts. When a browser cannot create a WebGL context, the storefront uses draggable turntable frames rendered from the same models. `/quote.html` offers a browser-only STL preview with geometry measurements, but quote requests and pricing are not enabled.

## Local development

Requires Node.js 20 or later. The cloud environment's home directory is read-only, so put Wrangler's config and npm's cache in writable paths:

```sh
cd /workspace/brizy-project-21437548
npm_config_cache=/tmp/eco-storefront-npm-cache npm ci
npm run build
XDG_CONFIG_HOME=/tmp/eco-storefront-config WRANGLER_SEND_METRICS=false npx wrangler dev --local --port 8787
```

Open the local app at port 8787. `npm test` checks cart validation, Stripe form creation, webhook signatures, and the catalog-to-checkout flow. `npm run smoke` checks the WebGL view and cart; `npm run smoke:fallback` checks the rotating view with WebGL disabled.

## Stripe catalog and payments

Stripe Products and Prices are the source of truth when `STRIPE_SECRET_KEY` is configured on the Worker. The cart sends Stripe Price IDs, and the Worker verifies those IDs against the active catalog before creating a Stripe-hosted Checkout Session. Payment card details never pass through this app. The return page checks the Checkout Session's payment status with Stripe. Stripe stores Checkout Sessions and Customer objects; the app has no durable order or fulfillment record yet. The signed webhook endpoint is `/api/webhook`.

To seed the prototype catalog into **Stripe test mode**, provide a test secret key securely and run `npm run seed:stripe`. The script is idempotent by product slug and storefront metadata. It refuses a live key unless `ALLOW_LIVE_SEED=1` is explicitly set. Review names, descriptions, prices, images, stock, and policies before any live seeding.

The connected **JDC VENTURES LTD sandbox** already has the three prototype products and GBP prices as of 8 October 2026. The local Worker does not inherit connector access: it still needs its own Stripe test key. A restricted key is preferable where its permissions cover product and price reads plus Checkout Session creation and retrieval.

For a deployed Worker, configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as encrypted Worker secrets, not in this repository. Register `https://<your-domain>/api/webhook` in Stripe for `checkout.session.completed`. Stripe receipts must be enabled in the Stripe dashboard. The current webhook verifies signatures and logs completed Checkout Session IDs; fulfillment automation has not been connected.

Test keys permit prototype checkout. Live checkout is blocked in code until durable order recording and fulfillment are implemented and the store policies are approved. Future live setup will also require `SHIPPING_RATE_ID` and an explicit `TAX_MODE` (`automatic` or `none`) chosen for the business's actual tax obligations. `SHIPPING_COUNTRIES` defaults to `GB`.

## Cloudflare deployment

The isolated public preview is at https://eco-storefront-preview.jfdcosta-jdc.workers.dev/ and uses `wrangler.preview.jsonc`. Run `npm run deploy:preview` to update it. That config routes all preview requests through the Worker so responses carry `X-Robots-Tag: noindex, nofollow, noarchive`. The preview has no Stripe key, no production domain route, and disabled checkout. Its deployed home, JDC Duo 3D detail page, API catalog, and browser cart flow were checked on 10 October 2026.

The JDC Duo browser model is `storefront/public/models/jdc-duo.glb`. `scripts/export-jdc-duo.py` regenerates it with Blender from the editable assembly, the fitted Galaxy R2 insert, and the dock parameters. The source files live in the local SKADIS Watch Dock project; the export script accepts their paths as arguments. This display model is separate from the unpublished MakerWorld print-profile draft.

The fallback frames are in `storefront/public/turntable/`. After changing a 3D model, build and run the local Worker, then run `npm run render:turntables` to regenerate the frames. They are small WebP images and stay interactive through drag, arrow buttons, and keyboard arrows in browsers without WebGL.

For a later production deployment, install dependencies, build, and run `npx wrangler deploy` only after completing the launch requirements. Connect a domain in Cloudflare and set the Worker secrets and variables there. Deploying source without Stripe secrets leaves the site in mock catalog mode with checkout disabled. A live launch also needs legal pages, returns/refund and delivery policies, product inventory, and a fulfillment process.

The requested reference is `ecolayerlabs.com`. It was inspected from the local environment on 8 October 2026; see `LIVE_AUDIT_2026-10-08.md` and `PROJECT_AUDIT_2026-10-08.md`. The prototype is an original implementation and is not a reproduction of the reference site yet.
