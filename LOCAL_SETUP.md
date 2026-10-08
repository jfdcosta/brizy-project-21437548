# Run this project locally

This archive contains the original Brizy export and the new, original Cloudflare Worker storefront prototype. It contains source files and the lockfile; dependencies and build output are intentionally omitted. No Stripe or Cloudflare credentials are included.

## Start the prototype

Install Node.js 20.19 or newer, then run from this directory:

```sh
npm ci
npm test
npm run dev
```

Open `http://127.0.0.1:8787/` in your browser. The site currently shows three mock products and interactive procedural 3D previews. Add to bag works; checkout stays disabled until Stripe is connected.

To run the browser smoke check, install Chrome or Chromium and run `npm run smoke` while the server is running. If the executable is not in a standard location, set `CHROME_BIN` to its path.

## Connect test payments

Read `STOREFRONT.md` for the Stripe product seeding and Cloudflare deployment flow. Use a Stripe **test** key first. Supply secrets through your local secret manager or an ignored `.dev.vars` file for Wrangler development; never commit them or send them in chat. Run `npm run seed:stripe` with `STRIPE_SECRET_KEY` available to that process to create the three test products and prices. Configure the same test key for the local Worker, then test a Stripe Checkout session with Stripe's test cards.

Before a live launch, replace the mock catalog and 3D models with approved products and assets, set shipping and tax policy, configure Stripe receipts and webhook secrets, establish fulfillment, and review the legal pages. The reference site `ecolayerlabs.com` has not yet been audited because the cloud machine's active network policy blocks it; you can inspect it from your local browser if your connection allows it.

The archive has no `.git` directory. To retain Git history, clone `jfdcosta/brizy-project-21437548` and copy the archive's files over that checkout. Its base commit is `a194a199434d94831c1c693cce3ca9416afefe5e`.
