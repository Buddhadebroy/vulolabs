# Sell From Any Website (JavaScript Checkout)

## What it does

VuloCart's checkout is not tied to your WordPress pages. With the **VuloCart JavaScript SDK** you can put a **Buy button**, a **cart** and a full **checkout** on any website: a landing page, a static HTML page, a site built with Next.js or another framework, or a different WordPress site. The shopper never has to visit your WordPress store. The orders, payments, tax and stock are all handled by your VuloCart store.

This works with the free plugin.

## Why it matters

Your store and your marketing pages do not have to be the same site. Sell from a campaign page, a blog or a partner's site and still manage everything in one place.

## Add it to a page

1. Add one script tag to the page (replace `yourstore.com` with your store's address):

```html
<script src="https://yourstore.com/wp-content/plugins/vulocart/assets/js/vulocart-sdk.js"></script>
```

The script knows which store to talk to from its own address. No other setup is needed.

2. Add the widgets you want, as plain HTML:

```html
<!-- A Buy button for product 123 -->
<button data-vulocart-buy-button data-offering-id="123">Buy now</button>

<!-- The shopper's cart -->
<div data-vulocart-embedded-cart></div>

<!-- The checkout, right on the page -->
<div data-vulocart-embedded-checkout></div>
```

| Widget | Attribute | Options |
|---|---|---|
| **Buy button** | `data-vulocart-buy-button` | `data-offering-id` is the product id (required), `data-quantity`, `data-target` (a CSS selector to show the checkout in, instead of an overlay) |
| **Cart** | `data-vulocart-embedded-cart` | `data-checkout-target` (a CSS selector to show the checkout in) |
| **Checkout** | `data-vulocart-embedded-checkout` | `data-cart-token` (defaults to the shopper's own cart) |

The **Embed code** card on each product's edit page generates these snippets for you.

## What the shopper sees

The embedded checkout is one screen: address, shipping method and payment method, with a **Place order** button, then a confirmation with the order number. Tax and shipping are worked out by your store. It uses the same payment methods as your own checkout.

## Using it in React or Next.js

Install the package and start it with your store address:

```bash
npm install @vulocart/sdk
```

```js
import { init } from '@vulocart/sdk';

init( { storeUrl: 'https://yourstore.com' } );
```

The `@vulocart/react` package adds ready-made components (`<BuyButton>`, `<EmbeddedCart>`, `<EmbeddedCheckout>`). In Next.js use them from a Client Component (`'use client'`).

## More ways to open the checkout (Pro)

With VuloCart Pro the same script also supports **popup**, **side drawer** and **hosted page** checkouts and payment links. Add `data-vulocart-popup-checkout-trigger`, `data-vulocart-drawer-checkout-trigger` or `data-vulocart-hosted-checkout-trigger` to any button. See the Pro guide on [checkout options](../../../../../plugins/vulocart-pro/docs/user/CHECKOUT-OPTIONS.md).

## Good to know

- **One store per page.** A page talks to one VuloCart store at a time.
- **The cart belongs to the page's own domain.** It is remembered in the shopper's browser for that site, so the same store embedded on two different domains does not share a cart between them.
- **Allowed from anywhere.** VuloCart lets other websites call its shop routes. Those routes are the public ones the checkout needs; managing the store always needs your WordPress login.
- **Pro triggers do nothing on the free plugin.** Popup, drawer, hosted and payment-link triggers need VuloCart Pro licensed and active; without it they are ignored.

## Related

- [CHECKOUT](CHECKOUT.md), [PAYMENTS](PAYMENTS.md)
