# Payment Framework

Every payment method, offline or online, is a class that implements one interface. The Payment module collects them, charges through them and records what happened in a ledger. Nothing else in the plugin knows which gateway it is talking to.

Code: `modules/Payment/`.

## Parts

| Class | Job |
|---|---|
| `Domain\PaymentGatewayInterface` | The contract every gateway implements |
| `Domain\PaymentContext` | The input of a gateway call: `order_id` or `cart_token`, `amount`, `currency`, customer email and name, `description`, `capture_immediately`, `save_payment_method`, `saved_payment_method_ref`, gateway-specific `payment_data` and `metadata` |
| `Domain\PaymentResult` | The output of every gateway call; never a raw SDK response |
| `Application\GatewayRegistry` | Collects gateways from the `vulocart_payment_gateways` filter (once per request) |
| `Application\PaymentService` | Orchestrates: picks the gateway, calls it, writes the ledger |
| `Infrastructure\WPDBTransactionLedger` | Writes `vulocart_payment_transactions` |
| `Gateways\ManualGateway`, `BankTransferGateway`, `CashOnDeliveryGateway` | The three offline gateways |
| `Rest` | `/payment/methods`, `/payment/intent`, `/payments/webhook/{gateway}`, order capture / cancel / history |

A gateway never sees a cart or an order object. This keeps the payment layer reusable: a subscription renewal calls the same `authorize()` an order does.

## The interface

| Method | Purpose |
|---|---|
| `get_id()` | Stable id. It becomes the order's `payment_method`, the `{gateway}` segment of the webhook route and the prefix of its settings keys |
| `get_label()` | Name shown in the Payment step and in Settings → Payments |
| `is_configured()` | Whether the gateway can run now (required settings saved, toggle on). Only configured gateways are offered |
| `supports_recurring()` | Whether a saved payment method can be charged off-session (needed by Subscriptions) |
| `supports_partial_capture()`, `supports_partial_refund()` | Whether `capture()` / `refund()` may settle less than the full amount |
| `authorize( $context )` | Authorizes a payment and, when `capture_immediately` is true (the usual case), captures it in the same call. Also serves as "create or confirm a payment intent" |
| `capture( $transaction_id, $amount, $context )` | Captures an authorized payment, in full or in part |
| `refund( $transaction_id, $amount, $context )` | Refunds a captured payment, in full or in part |
| `cancel( $transaction_id, $context )` | Voids an authorized, uncaptured payment |
| `handle_webhook( $request )` | Verifies the gateway's own signature and returns the resulting `PaymentResult`. An unsigned payload must never be trusted |

## Results and statuses

`PaymentResult::$status` is one of:

| Gateway status | Meaning | Becomes the order's payment status |
|---|---|---|
| `requires_action` | The shopper must finish something in the browser (3-D Secure, redirect) | `pending` |
| `authorized` | Funds are held, not captured | `pending` |
| `captured` | Funds are settled (see `captured_amount`) | `paid` |
| `failed` | The attempt did not succeed | `failed` |
| `canceled` | An authorization was voided | `failed` |
| `refunded` | Captured funds were returned (in full or in part) | `refunded` |

`PaymentResult::to_order_payment_status()` does that mapping. The result also carries `authorized_amount`, `captured_amount`, `refunded_amount`, a `gateway_transaction_id`, a `client_secret` for browser-side confirmation, an error message and the gateway's raw response.

## The two charge paths

**Inline** (`PaymentService::authorize_for_order()`). For gateways with nothing to confirm in the browser (the offline ones). The order exists; the charge happens in the same request that created it.

**Intent first** (`create_intent()` then `finalize_intent_for_order()`). For online gateways:

1. The storefront calls `POST /payment/intent` against the cart before the order exists. The gateway creates an intent and returns a `client_secret` (or equivalent).
2. The gateway's JavaScript widget finishes the payment in the browser. The widget is the one registered with `registerPaymentMethodRenderer()` ([CHECKOUT-ENGINE](CHECKOUT-ENGINE.md)); until it has confirmed, "Place order" stays disabled.
3. The storefront places the order with the intent's `gateway_transaction_id`. `finalize_intent_for_order()` links the ledger row to the new order id and reports its current state. A webhook may already have moved it past what the synchronous call returned.
4. Later changes arrive through `POST /payments/webhook/{gateway}`; `PaymentService::handle_webhook()` records each as a new ledger row.

`charge_off_session()` charges a saved payment method with no cart or order (used by subscription renewals).

## Capture mode

Settings → Payments → Charge the card (`payment_capture_mode`): **At checkout** (`immediate`) charges at checkout; **Later, when I capture it** (`manual`) only authorizes, so the merchant captures later from the order screen (`POST /orders/{id}/capture-payment`). Offline gateways are not affected.

## Admin actions

All admin only (`manage_options`):

- `POST /orders/{id}/capture-payment` - capture an authorization, in full or in part
- `POST /orders/{id}/cancel-payment` - void an authorization
- `POST /orders/{id}/refund` - refund (goes through `OrderService::refund_order_via_gateway()`)
- `GET /orders/{id}/payment-transactions` - the ledger of the order

## Writing a gateway

```php
class MyGateway implements \VuloCart\Payment\Domain\PaymentGatewayInterface { /* ... */ }

add_filter( 'vulocart_payment_gateways', function ( $gateways ) {
	$gateways['my-gateway'] = new MyGateway();
	return $gateways;
} );
```

1. Implement every method. A feature you do not support returns `false` from its `supports_*()` method and a `PaymentResult::failed()` from the call.
2. Read your settings from the plugin's settings option under keys prefixed with your gateway id. Add the fields to Settings → Payments with the `vulocart_settings_fields` JavaScript filter.
3. For a gateway that needs the browser, expose the public key through your own route and register a payment method renderer for your id.
4. Verify the signature of every webhook inside `handle_webhook()`.

vulocart-pro's Stripe, PayPal and Razorpay modules are complete examples.

## Settings

| Key | Default | Meaning |
|---|---|---|
| `enable_manual_payment` | on | Offer the manual (offline settlement) method |
| `default_payment_status` | `pending` | Status a new manual-payment order starts at |
| `enable_bank_transfer`, `bank_transfer_instructions` | off | Offer bank transfer and show the instructions on the confirmation |
| `enable_cash_on_delivery` | off | Offer cash on delivery |
| `payment_capture_mode` | `immediate` | `immediate` or `manual` |
