# Run this project locally

This repository contains the original Brizy export and an original Cloudflare Worker storefront prototype. The handoff branch includes source files and the lockfile; dependencies and build output are intentionally omitted. No Stripe or Cloudflare credentials are included.

## Start the prototype

Install Node.js 20.19 or newer, then run from this directory:

```sh
npm ci
npm test
npm run dev
```

Open `http://127.0.0.1:8787/` in your browser. The homepage and collection show static pictures; JDC Duo uses its actual printed product photo. Each product opens a familiar photo gallery with a 3D thumbnail. The viewer code and models load only when that thumbnail is selected. Chrome profiles with WebGL disabled get draggable 360-degree views of the same models. JDC Duo is £17.99 for the complete PLA pair; the other three listings are concept previews. The connected live preview sells only JDC Duo. `/quote.html` previews a local STL and measures its envelope and enclosed mesh volume; it does not upload the file or request a production quote. Add to cart works locally; checkout stays disabled until a matching Stripe key, webhook signing secret and order-storage binding are configured.

To run the browser smoke check, install Chrome or Chromium and run `npm run smoke` while the server is running. It checks that browsing photos never fetches the 3D viewer or JDC Duo model, then opens the 3D thumbnail, checks mobile layout and tests the cart. `npm run smoke:fallback` checks the same gallery with WebGL disabled. If the executable is not in a standard location, set `CHROME_BIN` to its path.

## Connect test payments

Read `STOREFRONT.md` for the Stripe product and Cloudflare deployment flow. Use a Stripe **test** restricted key with the necessary catalog read and Checkout Session permissions. Supply secrets through your local secret manager or an ignored `.dev.vars` file for Wrangler development; never commit them or send them in chat. Three prototype products and prices were created in the connected JDC Ventures Stripe sandbox on 8 October 2026. `npm run seed:stripe` remains an idempotent fallback for another sandbox. Configure a test key for the local Worker, then test a Stripe Checkout session with Stripe's test cards.

The temporary preview has live checkout configured for JDC Duo with £1.99 UK delivery per order and dispatch within 2–3 working days. Signed paid webhooks save orders idempotently. Local development defaults to no credentials and disabled checkout; use sandbox credentials for local payment tests. Read `STRIPE_SETUP.md` and `LIVE_PREVIEW_SETUP.md` for the separate sandbox/live configurations. Authenticated staff order access and dispatch tracking remain separate work for the eventual public-domain launch. The local reference audit is in `LIVE_AUDIT_2026-10-08.md` and `PROJECT_AUDIT_2026-10-08.md`.

This local checkout tracks `codex/eco-storefront-local-handoff` and contains the combined simplified design and payment setup. Deploy the temporary preview with `npm run deploy:preview`; avoid deploying an older checkout over it.
