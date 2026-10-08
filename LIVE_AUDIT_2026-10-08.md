# Eco Layer Labs live-site recheck — 8 October 2026

Scope: read-only review of https://ecolayerlabs.com/ and its public quote page before comparing them with the local storefront prototype. No account was created, STL uploaded, order submitted, or payment attempted.

## Confirmed in this session

- The homepage loads six catalog cards. Adding **Heavy Duty Gear Set** changed the cart badge to 1 and showed a £24.99 line item plus £3.99 shipping (£28.98 total). The cart item remained visible on the quote page. The earlier report that Add to Cart did nothing no longer reproduces.
- The browser console still reports `FirebaseError: Missing or insufficient permissions` from `js/app.js` while loading products. The displayed cards therefore do not establish that live inventory is available from Firestore.
- Every visible catalog image uses `https://via.placeholder.com/300x200?text=EcoLayer+Labs` and had `naturalWidth: 0` in the browser. Product photography is broken.
- At a 375 px viewport, the quote page's configuration panel extended from x=258 to x=608. Material, colour, prices, and the Add to Cart button were clipped beyond the right edge. The page's root scroll width remained 375 px, so horizontal scrolling did not expose the missing controls.
- `https://ecolayerlabs.com/robots.txt` and `/sitemap.xml` returned 404. The homepage had no canonical link or JSON-LD script when inspected.
- Public `js/cart.js` labels its checkout a `MOCK CHECKOUT SYSTEM`. Its code calculates totals from client-side cart data, writes an order directly to Firestore, then displays “Order Placed Successfully! (Mock Checkout completed)”. This is a code-path finding, not a verified completed order. It needs to be removed or clearly gated before treating the live site as a paid storefront.

## Local prototype comparison

The source is now available on the `codex/eco-storefront-local-handoff` branch. See `PROJECT_AUDIT_2026-10-08.md` for the comparison. Stripe test mode and a production payment path still require separate verification. Do not mark checkout live from a mock catalog or passing unit tests alone.
