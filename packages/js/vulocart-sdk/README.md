# @vulocart/sdk

VuloCart's embeddable commerce SDK. Runs on any site — WordPress or not.

## Plain HTML / any site

```html
<script src="https://yourstore.com/wp-content/plugins/vulocart/assets/js/vulocart-sdk.js"></script>

<button data-vulocart-buy-button data-offering-id="123">Buy Now</button>
```

No further config — the script's own URL tells the SDK which store to talk to.

## React / Next.js

```bash
npm install @vulocart/sdk
```

```tsx
import { init, mountBuyButton } from '@vulocart/sdk';

init( { storeUrl: 'https://yourstore.com', skipAutoScan: true } );
```

For actual React components (`<BuyButton>`, `<EmbeddedCart>`, `<EmbeddedCheckout>`), use `@vulocart/react` instead, which wraps this package. In Next.js, use it from a Client Component (`'use client'`) — this SDK touches `window`/`document` and has no SSR-safe mode.

## Widgets

| `data-vulocart-*` attribute | Options |
| --- | --- |
| `buy-button` | `data-offering-id` (required), `data-quantity`, `data-target` (CSS selector to mount checkout into instead of an overlay) |
| `embedded-cart` | `data-checkout-target` (CSS selector) |
| `embedded-checkout` | `data-cart-token` (defaults to the shared ambient cart) |

## Known limitations

- **One store per page.** This package backs a single `window.VuloCart`/`init()` call; it doesn't support talking to two different VuloCart stores from the same page.
- **Cart tokens are scoped to the embedding page's own origin** (`localStorage`), not the store's. The same store embedded on two different third-party domains won't share a cart between them — there's no cross-origin storage bridge here.
- **Popup Checkout, Drawer Checkout, Checkout Links, and Hosted Checkout require vulocart-pro**, licensed and active on the target store. `init()` checks `/sdk/config` and lazy-loads vulocart-pro's own bundle only when applicable — on a free-tier install, `data-vulocart-popup-checkout-trigger` etc. simply do nothing.
