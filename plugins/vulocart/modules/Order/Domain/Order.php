<?php
/**
 * Order class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Order\Domain;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Order module Order entity.
 *
 * Plain domain object, same shape/rules as VuloCart\Domain\Offering\Offering/
 * VuloCart\Cart\Domain\Cart. `order_number` is the human-facing identifier
 * (shown to the buyer); `access_token` is the headless equivalent of
 * Cart's `token` — an opaque value only the buyer who placed the order (or
 * whoever it was emailed to) holds, letting a guest with no WordPress
 * account look their own order up (Rest::track_item()) without needing
 * `manage_options`.
 *
 * `$payment_status`/`$fulfillment_status` replaced a single flat `$status`
 * field (PaymentStatus.php's/FulfillmentStatus.php's own docblocks explain
 * why) — the underlying `vulocart_orders` table still has a `status`
 * column (Install.php's migration is additive-only, backward-
 * compatibility.md), kept in sync with `$fulfillment_status` on write for
 * any external code still reading it directly, but no longer read by this
 * class or anything in this codebase.
 *
 * @class       Order class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Order {

    /**
     * Order id.
     *
     * @var int|null Null for an order not yet persisted.
     */
    public $id;

    /**
     * Human-facing order identifier, e.g. 'VC-000042'.
     *
     * @var string|null Null until persisted (needs the auto-increment id).
     */
    public $order_number;

    /**
     * Opaque token letting the buyer who placed this order look it up
     * without an account — see class docblock.
     *
     * @var string
     */
    public $access_token;

    /**
     * The Cart this order was created from, for traceability. Informational
     * only — by the time an Order exists, CartService has already cleared
     * this cart's items (Application\OrderService::create_from_cart()).
     *
     * @var string|null
     */
    public $cart_token;

    /**
     * Buyer's email, for guest orders (no Customer/Identity module exists
     * yet to reference instead — vision's "Customer" module).
     *
     * @var string|null
     */
    public $customer_email;

    /**
     * Buyer's display name.
     *
     * @var string|null
     */
    public $customer_name;

    /**
     * Whether/how this order has been paid.
     *
     * @var string One of PaymentStatus's constants.
     */
    public $payment_status;

    /**
     * Where this order is in fulfillment.
     *
     * @var string One of FulfillmentStatus's constants.
     */
    public $fulfillment_status;

    /**
     * Amount refunded so far — null until a refund has been issued;
     * partial refunds are possible (this can be less than $total).
     *
     * @var float|null
     */
    public $refunded_amount;

    /**
     * Currency code.
     *
     * @var string|null ISO 4217 currency code.
     */
    public $currency;

    /**
     * Sum of every line item's (unit_price * quantity), at order-creation
     * time.
     *
     * @var float
     */
    public $subtotal;

    /**
     * `subtotal` + `$shipping_cost` + `$tax_amount` — the two latter
     * fields are 0.0 whenever the Shipping/Taxes modules aren't active
     * (Application\OrderService::create_from_cart()'s own graceful-
     * absence handling), so `total === subtotal` is still what a
     * cart-only/no-checkout-modules install sees, just no longer
     * guaranteed. Cart\Application\CartService::get_totals() still
     * documents the identical gap for a cart's own totals, which never
     * gained shipping/tax (that's checkout-time-only, once an Order
     * exists).
     *
     * @var float
     */
    public $total;

    /**
     * Line items belonging to this order.
     *
     * @var OrderItem[]
     */
    public $items;

    /**
     * Extensible, order-specific attributes.
     *
     * @var array<string, mixed>
     */
    public $meta;

    /**
     * Creation timestamp.
     *
     * @var string|null MySQL datetime string, once persisted.
     */
    public $created_at;

    /**
     * Last-updated timestamp.
     *
     * @var string|null MySQL datetime string, once persisted.
     */
    public $updated_at;

    /**
     * Buyer's phone number, captured by the Customer module's checkout
     * step — optional, same "real field, only populated once the owning
     * module is active/used" status every field below shares.
     *
     * @var string|null
     */
    public $customer_phone;

    /**
     * The WP user id who placed this order, when logged in — null for a
     * guest order. Resolved directly from `get_current_user_id()` at
     * order-creation time (Order\Rest::create_item()), not through the
     * Customer module, since attributing an order to a WP account is core
     * Order behavior, not something Customer's own (optional, toggleable)
     * module should gate.
     *
     * @var int|null
     */
    public $customer_user_id;

    /**
     * Snapshotted billing address, from the Address module's checkout
     * step — same open-bag shape as $meta (full_name, phone, address_1,
     * address_2, city, state, postcode, country), not a reusable address
     * book entry (vision's lightweight-first scope: an order is a
     * historical record, not a live reference to an editable address).
     *
     * @var array<string, mixed>|null
     */
    public $billing_address;

    /**
     * Snapshotted shipping address — same shape as $billing_address, null
     * when the buyer chose "same as billing" (Checkout.tsx resolves that
     * client-side before submitting, so this column is never a proxy
     * value that silently drifts from billing).
     *
     * @var array<string, mixed>|null
     */
    public $shipping_address;

    /**
     * Chosen shipping method id, from the Shipping module's
     * `GET /shipping/methods` list (e.g. 'flat_rate', 'free').
     *
     * @var string|null
     */
    public $shipping_method;

    /**
     * Shipping cost, computed server-side by the Shipping module at
     * order-creation time — never trusted from the client.
     *
     * @var float
     */
    public $shipping_cost;

    /**
     * Tax amount, computed server-side by the Taxes module at
     * order-creation time — never trusted from the client. `total` is no
     * longer always `=== subtotal` now that this and $shipping_cost exist
     * (OrderService::create_from_cart() is where they're added in).
     *
     * @var float
     */
    public $tax_amount;

    /**
     * Chosen payment method id, from the Payment module's
     * `GET /payment/methods` list — one of the ids a registered
     * `Payment\Domain\PaymentGatewayInterface` gateway exposes via
     * `get_id()` ('manual', 'bank-transfer', 'cash-on-delivery', or a Pro
     * gateway like 'stripe'/'paypal'/'razorpay').
     *
     * @var string|null
     */
    public $payment_method;

    /**
     * The gateway's own reference for this order's payment (Stripe
     * PaymentIntent id, PayPal order id, Razorpay order id, etc.) — null
     * for gateways that never call out to an external API (manual/bank
     * transfer/COD), and null until `Payment\Application\PaymentService`
     * has actually authorized/finalized a payment against this order.
     *
     * @var string|null
     */
    public $gateway_transaction_id;

    /**
     * Amount the gateway has authorized (held, not yet settled) —
     * distinct from `$total` (what's owed) and `$refunded_amount`/
     * `$captured_amount` (what's actually moved). Stays 0.0 for gateways
     * that authorize and capture in the same step.
     *
     * @var float
     */
    public $authorized_amount;

    /**
     * Amount actually captured/settled so far — a running total, same
     * "can be less than the authorized/total amount" partial-capture
     * shape `$refunded_amount`'s own docblock already documents for
     * partial refunds.
     *
     * @var float
     */
    public $captured_amount;

    /**
     * Order constructor.
     *
     * @param int|null             $id             Null for an order not yet persisted.
     * @param string|null          $order_number   Human-facing order identifier.
     * @param string               $access_token   Opaque token letting the buyer look this order up.
     * @param string|null          $cart_token     The Cart this order was created from.
     * @param string|null          $customer_email     Buyer's email.
     * @param string|null          $customer_name      Buyer's display name.
     * @param string               $payment_status     One of PaymentStatus's constants.
     * @param string               $fulfillment_status One of FulfillmentStatus's constants.
     * @param string|null          $currency           ISO 4217 currency code.
     * @param float                $subtotal           Sum of every line item's (unit_price * quantity).
     * @param float                $total              `subtotal` + `$shipping_cost` + `$tax_amount`.
     * @param float|null           $refunded_amount    Amount refunded so far, null if none.
     * @param OrderItem[]          $items              Line items belonging to this order.
     * @param array<string, mixed> $meta               Extensible, order-specific attributes.
     * @param string|null          $created_at         MySQL datetime string, once persisted.
     * @param string|null          $updated_at         MySQL datetime string, once persisted.
     * @param string|null          $customer_phone     Buyer's phone number.
     * @param int|null             $customer_user_id   The WP user id who placed this order, null for a guest order.
     * @param array<string, mixed>|null $billing_address  Snapshotted billing address.
     * @param array<string, mixed>|null $shipping_address Snapshotted shipping address, null if same as billing.
     * @param string|null          $shipping_method    Chosen shipping method id.
     * @param float                $shipping_cost      Shipping cost, computed server-side.
     * @param float                $tax_amount         Tax amount, computed server-side.
     * @param string|null          $payment_method     Chosen payment method id.
     * @param string|null          $gateway_transaction_id The gateway's own reference for this order's payment.
     * @param float                $authorized_amount  Amount the gateway has authorized (held, not yet settled).
     * @param float                $captured_amount    Amount actually captured/settled so far.
     */
    public function __construct(
        $id,
        $order_number,
        $access_token,
        $cart_token,
        $customer_email,
        $customer_name,
        $payment_status = PaymentStatus::PENDING,
        $fulfillment_status = FulfillmentStatus::PENDING,
        $currency = null,
        $subtotal = 0.0,
        $total = 0.0,
        $refunded_amount = null,
        $items = array(),
        $meta = array(),
        $created_at = null,
        $updated_at = null,
        $customer_phone = null,
        $customer_user_id = null,
        $billing_address = null,
        $shipping_address = null,
        $shipping_method = null,
        $shipping_cost = 0.0,
        $tax_amount = 0.0,
        $payment_method = null,
        $gateway_transaction_id = null,
        $authorized_amount = 0.0,
        $captured_amount = 0.0
    ) {
        $this->id                 = $id;
        $this->order_number       = $order_number;
        $this->access_token       = $access_token;
        $this->cart_token         = $cart_token;
        $this->customer_email     = $customer_email;
        $this->customer_name      = $customer_name;
        $this->payment_status     = $payment_status;
        $this->fulfillment_status = $fulfillment_status;
        $this->currency           = $currency;
        $this->subtotal           = $subtotal;
        $this->total              = $total;
        $this->refunded_amount    = $refunded_amount;
        $this->items              = $items;
        $this->meta               = $meta;
        $this->created_at         = $created_at;
        $this->updated_at         = $updated_at;
        $this->customer_phone     = $customer_phone;
        $this->customer_user_id   = $customer_user_id;
        $this->billing_address    = $billing_address;
        $this->shipping_address   = $shipping_address;
        $this->shipping_method    = $shipping_method;
        $this->shipping_cost      = $shipping_cost;
        $this->tax_amount         = $tax_amount;
        $this->payment_method     = $payment_method;
        $this->gateway_transaction_id = $gateway_transaction_id;
        $this->authorized_amount      = $authorized_amount;
        $this->captured_amount        = $captured_amount;
    }
}
