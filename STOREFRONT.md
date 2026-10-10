# Eco Layer Labs storefront prototype

The Cloudflare Worker storefront is in `storefront/` and `src/`. The original Brizy export remains at the repository root. The live preview sells JDC Duo at £17.99, with £1.99 UK delivery per order and dispatch within 2–3 working days. Only JDC Duo is allowed in its live catalog. Three concept products remain available in local and sandbox previews. The homepage leads with a real JDC Duo photo and a product CTA. Collection cards use static pictures and link to product pages; they create no viewers and fetch no models. Each product page starts with a photo gallery and loads `viewer.js` through a dynamic import only when its 3D thumbnail is selected. JDC Duo's 3D display shows the four current dock parts, assembled from the local Blender source and revised Galaxy insert; watches and chargers are absent from that display. The other product images and 3D views are concept renders. When a browser cannot create a WebGL context, the viewer uses draggable turntable frames rendered from the same models. `/quote.html` offers a browser-only STL preview with geometry measurements, but quote requests and pricing are not enabled.

## Local development

Requires Node.js 20.19 or later. The cloud environment's home directory is read-only, so put Wrangler's config and npm's cache in writable paths:

```sh
cd /workspace/brizy-project-21437548
npm_config_cache=/tmp/eco-storefront-npm-cache npm ci
npm run build
XDG_CONFIG_HOME=/tmp/eco-storefront-config WRANGLER_SEND_METRICS=false npx wrangler dev --local --port 8787
```

Open the local app at port 8787. `npm test` checks cart validation, Stripe form creation, webhook signatures, and the catalog-to-checkout flow. `npm run smoke` checks the static collection, photo-first product galleries, absence of early 3D requests, on-demand WebGL view, mobile layout and cart. `npm run smoke:fallback` checks the gallery's rotating view with WebGL disabled. `/jdc-duo` preserves the existing product URL; the concept pages use `/products/:slug`, served through `product.html`.

## Stripe catalog and payments

Stripe Products and Prices are the source of truth when `STRIPE_SECRET_KEY` is configured on the Worker. The cart sends Stripe Price IDs, and the Worker verifies those IDs against the active catalog before creating a Stripe-hosted Checkout Session. Payment card details never pass through this app. The return page checks the Checkout Session's payment status with Stripe. Verified paid events create one durable SQLite order record per Checkout Session, with fulfillment status `awaiting_review`. The success page only displays payment status; it does not create or fulfill orders. The signed webhook endpoint is `/api/webhook`.

To seed the prototype catalog into **Stripe test mode**, provide a test secret key securely and run `npm run seed:stripe`. The script is idempotent by product slug and storefront metadata. It refuses a live key unless `ALLOW_LIVE_SEED=1` is explicitly set. Review names, descriptions, prices, images, stock, and policies before any live seeding.

The connected **JDC VENTURES LTD sandbox** already has the three prototype products and GBP prices as of 8 October 2026. The local Worker does not inherit connector access: it still needs its own Stripe test key. A restricted key is preferable where its permissions cover product and price reads plus Checkout Session creation and retrieval.

For a deployed Worker, configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as encrypted Worker secrets, not in this repository. Register `https://<your-domain>/api/webhook` in Stripe for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Stripe receipts must be enabled in the Stripe dashboard. The webhook verifies signatures, checks the live/test environment and records paid orders idempotently. Authenticated staff order access and dispatch tracking are still separate work.

Checkout requires a matching Stripe mode, webhook signing secret and order storage. Live checkout additionally requires `LIVE_CHECKOUT_ENABLED=1` and `SHIPPING_RATE_ID`. The live preview is configured with `TAX_MODE=none` for the confirmed non-VAT-registered business. `SHIPPING_COUNTRIES` defaults to `GB`.

## Cloudflare deployment

The isolated public preview is at https://eco-storefront-preview.jfdcosta-jdc.workers.dev/ and uses `wrangler.preview.jsonc`. Run `npm run deploy:preview` to update it. That config routes all preview requests through the Worker so responses carry `X-Robots-Tag: noindex, nofollow, noarchive`. The preview now has live Stripe checkout, an approved JDC Duo catalog and durable order storage. The public `ecolayerlabs.com` domain is unchanged. See `LIVE_PREVIEW_SETUP.md` for configuration and verification. Always deploy from this combined source: an older Stripe worktree previously replaced the simplified frontend. This checkout now contains both changes.

The JDC Duo browser model is `storefront/public/models/jdc-duo.glb`. `scripts/export-jdc-duo.py` regenerates it with Blender from the editable assembly, the fitted Galaxy R2 insert, and the dock parameters. The source files live in the local SKADIS Watch Dock project; the export script accepts their paths as arguments. This display model is separate from the unpublished MakerWorld print-profile draft.

The fallback frames are in `storefront/public/turntable/`. After changing a 3D model, build and run the local Worker, then run `npm run render:turntables` to regenerate the frames. They are small WebP images and stay interactive through drag, arrow buttons, and keyboard arrows in browsers without WebGL.

For a later production deployment, install dependencies, build, and run `npx wrangler deploy` only after completing the launch requirements. Connect a domain in Cloudflare and set the Worker secrets and variables there. Deploying source without Stripe secrets leaves the site in mock catalog mode with checkout disabled. The eventual public-domain launch still needs the remaining store information and fulfillment operations described in `LIVE_PREVIEW_SETUP.md`.

The requested reference is `ecolayerlabs.com`. It was inspected from the local environment on 8 October 2026; see `LIVE_AUDIT_2026-10-08.md` and `PROJECT_AUDIT_2026-10-08.md`. The prototype is an original implementation and is not a reproduction of the reference site yet.
