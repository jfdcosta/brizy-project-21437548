# Run this project locally

This repository contains the original Brizy export and an original Cloudflare Worker storefront prototype. The handoff branch includes source files and the lockfile; dependencies and build output are intentionally omitted. No Stripe or Cloudflare credentials are included.

## Start the prototype

Install Node.js 20.19 or newer, then run from this directory:

```sh
npm ci
npm test
npm run dev
```

Open `http://127.0.0.1:8787/` in your browser. The site shows a non-purchasable JDC Duo prototype with an interactive 3D view of the actual dock parts, plus three concept products with procedural 3D previews. Chrome profiles with WebGL disabled get draggable 360-degree views of the same models. `/quote.html` also previews a local STL and measures its envelope and enclosed mesh volume; it does not upload the file or request a production quote. Add to bag works for the concept products; checkout stays disabled until a Stripe test key is connected.

To run the browser smoke check, install Chrome or Chromium and run `npm run smoke` while the server is running. If the executable is not in a standard location, set `CHROME_BIN` to its path.

## Connect test payments

Read `STOREFRONT.md` for the Stripe product and Cloudflare deployment flow. Use a Stripe **test** restricted key with the necessary catalog read and Checkout Session permissions. Supply secrets through your local secret manager or an ignored `.dev.vars` file for Wrangler development; never commit them or send them in chat. Three prototype products and prices were created in the connected JDC Ventures Stripe sandbox on 8 October 2026. `npm run seed:stripe` remains an idempotent fallback for another sandbox. Configure a test key for the local Worker, then test a Stripe Checkout session with Stripe's test cards.

Live checkout is deliberately blocked in this prototype, including when a live Stripe key is configured. The webhook currently logs payment events but does not save or fulfill orders. Before a live launch, replace the remaining concept products and procedural 3D models with approved products and assets, set shipping and tax policy, configure Stripe receipts and webhook secrets, establish fulfillment, and review the legal pages. The local reference audit is in `LIVE_AUDIT_2026-10-08.md` and `PROJECT_AUDIT_2026-10-08.md`.

This local checkout tracks the `codex/eco-storefront-local-handoff` branch at handoff commit `fa487d795367d5e2dd8b5647aa4211c7d33380d5` plus any subsequent local changes.
