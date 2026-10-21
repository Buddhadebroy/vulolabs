# Checkout Engine

The checkout is a pluggable sequence of steps. The server says which steps exist; the browser resolves each step to a React component. The same engine renders on the checkout page, in vulocart-pro's popup, drawer, embedded and hosted modes, and in the SDK.

## The two halves

| Half | Where | Job |
|---|---|---|
| Step discovery | PHP, `GET /checkout/steps` | Returns the list of step descriptors, sorted by `order` |
| Step rendering | JS, `src/blocks/checkout-engine/` | Turns a step id into a component and runs the flow |

### Step discovery (PHP)

A module adds its step to the `vulocart_checkout_steps` filter:

```php
add_filter( 'vulocart_checkout_steps', function ( $steps ) {
	$steps[] = array(
		'id'        => 'shipping',
		'label'     => __( 'Shipping', 'vulocart' ),
		'order'     => 30,
		'rest_base' => 'shipping',
	);
	return $steps;
} );
```

Because the callback is registered by the module's own `Module.php`, a module that is switched off never appears. `Controllers\Checkout::get_steps()` sorts the result by `order`.

| Step id | Module | Order |
|---|---|---|
| `customer` | Customer | 10 |
| `address` | Address | 20 |
| `shipping` | Shipping | 30 |
| `payment` | Payment | 40 |
| `review` | Review | 50 |
| `confirmation` | Confirmation | 100 |

### Step rendering (JS)

`registry.ts` keeps three lists and exposes them on `window.vulocartCheckoutEngine`, so a separate bundle (vulocart-pro's storefront scripts) can use them without importing the module:

- `registerCheckoutStep( { id, render } )` maps a step id to a component. `render( context )` receives a `CheckoutStepContext`.
- `registerCheckoutStepExtension( stepId, fn )` adds content inside an existing step (vulocart-pro's order notes, coupons and gift cards use the `review` step).
- `registerOrderPlacedHandler( fn )` runs after `POST /orders` succeeds and the order has an id. Handlers run in parallel and never delay the confirmation screen.
- `registerPaymentMethodRenderer( methodId, fn )` supplies the widget of an online gateway for the Payment step.

The free steps are registered by importing `steps/index.ts`. The engine itself is `CheckoutEngine.tsx`; `mount.tsx` adds `window.vulocartCheckoutEngine.mount( container, options )` and `unmount()` for code that wants to draw the engine into a node it created.

### The step context

Every step receives:

| Field | Meaning |
|---|---|
| `cartToken`, `cart` | The shopper's cart |
| `data`, `update( patch )` | The shared, open data bag of the run. Steps write their own keys; the engine does not know them |
| `summary` | The live price breakdown (shipping, tax, total) from `POST /review/summary` |
| `mode` | `single_page` or `multi_step` |
| `goNext()`, `goBack()` | Move between steps in multi-step mode |
| `onPlaceOrder()` | Places the order (used by the last step) |
| `isFirstStep`, `isLastStep` | Where the step is in the list |

In `single_page` mode every step is shown stacked with one "Place order" action; in `multi_step` mode one step is shown at a time with a stepper. Both modes use the same steps.

### What the shopper (and the merchant) can change

`options.ts` decides which steps and optional fields are shown: the site choice from Settings → Checkout (`checkout_steps`, `checkout_fields`) or an override set on a checkout block. Customer and Payment are always shown. `applyStepOptions()` limits and orders the steps; steps added by a module keep their place and Confirmation is never touched.

## Sessions

`CheckoutService` tracks one session per cart token in `vulocart_checkout_sessions`.

- `POST /checkout/sessions` starts (or returns) the session. It records the mode (`CheckoutMode`: `single_page`, `multi_step`, and the Pro modes `popup`, `drawer`, `embedded`, `hosted`, `one_click`).
- `PUT /checkout/sessions/{token}` records progress: the current step and the customer's email once known.
- The status has two stored values, `active` and `completed`. A session becomes `completed` when `vulocart_order_created` fires for its cart. "Abandoned" is not stored: `find_abandoned( $minutes )` lists active sessions untouched for that long, and vulocart-pro's Abandoned Checkout module reads it.

## Placing the order

1. The last step calls `onPlaceOrder()`. The engine posts `POST /orders` with the cart token, contact, addresses, shipping method and payment method (or payment intent id).
2. `OrderService::create_from_cart()` builds the order (see [MODULES](MODULES.md#order)), including the server-side shipping cost, tax and payment.
3. The engine runs the order-placed handlers, then shows the Confirmation step alone, using `data.confirmation`.

The server also re-checks guest checkout, phone number and terms acceptance according to Settings → Checkout.

## Delivery: where "Proceed to checkout" leads

Setting `checkout_delivery` (Settings → Checkout → Checkout opens as) is `page` by default. vulocart-pro adds `popup`, `drawer`, `hosted` and `one_click`. `Block::resolve_checkout_delivery()` returns the value that is actually usable (a Pro choice falls back to `page` when its module is not active), and `vulocartFrontendData` carries it to the storefront scripts. The filter `vulocart_checkout_delivery` can change the result.

## Extending the checkout

| I want to | Do this |
|---|---|
| Add a step | `vulocart_checkout_steps` (PHP) + `registerCheckoutStep()` (JS) |
| Add a field or panel to a step | `registerCheckoutStepExtension()` |
| React after the order exists | `registerOrderPlacedHandler()` |
| Add a payment method | See [PAYMENT-FRAMEWORK](PAYMENT-FRAMEWORK.md) |
| Change the order total | The `vulocart_order_total` filter |
| Add a shipping method | The `vulocart_shipping_methods` filter |
