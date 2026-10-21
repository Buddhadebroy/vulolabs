# JavaScript SDK (`@vulocart/sdk`)

The SDK lets anyone host VuloCart's checkout **anywhere**: a static page, a Next.js app, another WordPress site. The store (this plugin) stays the single source of truth for products, carts, tax, shipping, payment and orders. The SDK is only a presentation layer over the public REST routes.

Code: `packages/js/vulocart-sdk` (npm `@vulocart/sdk`, React wrappers in `packages/js/vulocart-react`). The plugin serves the built script at `assets/js/vulocart-sdk.js` (copied by `webpack.config.js`).

## How a page uses it

```html
<script src="https://store.example/wp-content/plugins/vulocart/assets/js/vulocart-sdk.js"></script>
<button data-vulocart-buy-button data-offering-id="123">Buy now</button>
<div data-vulocart-embedded-checkout></div>
```

`auto.ts` takes the store origin from the script's own URL and calls `init()`. From npm: `init( { storeUrl, skipAutoScan? } )`.

`init()` registers the free widgets, scans the DOM for `data-vulocart-*` elements, sets `window.VuloCart` and fetches `GET /sdk/config`. When the config reports `proActive` and a `proSdkUrl`, it lazy-loads the Pro companion bundle ([CHECKOUT-DELIVERY](../../../../../plugins/vulocart-pro/docs/developer/CHECKOUT-DELIVERY.md#the-sdk-companion-sdk-pro)).

## Widgets

| Attribute | Function | Notes |
|---|---|---|
| `data-vulocart-buy-button` | `mountBuyButton` | `data-offering-id` (the product id), `data-quantity`, `data-target` |
| `data-vulocart-embedded-cart` | `mountEmbeddedCart` | `data-checkout-target` |
| `data-vulocart-embedded-checkout` | `mountEmbeddedCheckout` | `data-cart-token` (defaults to the ambient cart) |

`registerWidget( attribute, factory )` adds more; the Pro bundle uses it for the popup, drawer and hosted triggers.

## The embedded checkout

`widgets/embedded-checkout.ts` is **deliberately not** the WordPress `checkout-engine`. The engine depends on `@wordpress/element` and only runs on pages this WordPress site renders. The SDK widget has no framework dependency (plain DOM through `dom.ts`'s `h()`), so it runs where nothing else is loaded. It is a single screen (address, shipping method, payment method, **Place order**) and calls the same endpoints as the engine: `/shipping/methods`, `/payment/methods`, `/review/summary` and `POST /orders`. A shopper who needs the multi-step wizard uses the `vulocart/checkout` block on a WordPress page instead.

## What the server provides

- `GET /sdk/config`: the site URL, REST URL, currency and one flag per feature (`buyButton`, `embeddedCart`, `embeddedCheckout`, `popupCheckout`, `drawerCheckout`, `checkoutLinks`, `hostedCheckout`, `proActive`, `proSdkUrl`).
- CORS: `RestAPI\Cors` sends `Access-Control-Allow-Origin: *` on the `vulocart/v1` namespace. The routes the SDK calls are public and guest-safe (cart token or order access token, never a nonce), so cross-origin calls add no new trust boundary.

## Limits

- One store per page (a single `window.VuloCart`).
- The cart token is kept in `localStorage` of the embedding page's origin, so two domains do not share a cart.
- No server-side rendering: the package touches `window` and `document`. In Next.js use it from a Client Component.
- Popup, drawer, hosted and checkout-link triggers need VuloCart Pro licensed on the target store; without it they do nothing.

## Build

`pnpm run build` in `packages/js/vulocart-sdk` runs `build.mjs` (esbuild, no `@wordpress/*` externals so it can run without WordPress scripts) and emits `dist/vulocart-sdk.js` plus ESM, CJS and type declarations.
