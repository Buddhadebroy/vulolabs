<?php
/**
 * PaymentContext class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Payment\Domain;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Payment module PaymentContext.
 *
 * What `PaymentService` hands a gateway's `authorize()`/`capture()`/
 * `refund()`/`cancel()` — everything a gateway needs to act, without the
 * gateway ever touching a Cart/Order object directly (Payment has no
 * dependency on either module's namespace, by design — see
 * `PaymentGatewayInterface`'s own docblock). Built once per call by
 * `PaymentService`, from either a cart's current totals (payment-intent
 * step, before an order exists) or an already-placed order's own fields
 * (inline offline-gateway path, or an admin-triggered capture/refund).
 *
 * @class       PaymentContext class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PaymentContext {

    /**
     * The order this payment belongs to, once one exists — null while
     * still cart-scoped (a payment intent created before checkout
     * finishes).
     *
     * @var int|null
     */
    public $order_id;

    /**
     * The cart this payment was initiated from — always set (an intent
     * needs a cart to price against even once an order exists).
     *
     * @var string|null
     */
    public $cart_token;

    /**
     * Amount to authorize/capture/refund, in the site's decimal currency
     * unit (matching every other money field in this codebase — never
     * gateway "smallest unit"/cents; each gateway adapter converts at its
     * own boundary).
     *
     * @var float
     */
    public $amount;

    /**
     * ISO 4217 currency code.
     *
     * @var string
     */
    public $currency;

    /**
     * Buyer's email — passed to gateways that attach a receipt/customer
     * record to the charge.
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
     * A short human-readable line item description, shown on the
     * gateway's own hosted receipt/statement where supported.
     *
     * @var string
     */
    public $description;

    /**
     * Whether the gateway should capture in the same call as authorizing
     * (true — the common case) or leave funds merely authorized for a
     * later, separate `capture()` call (manual-capture flows).
     *
     * @var bool
     */
    public $capture_immediately;

    /**
     * Whether the gateway should retain a reusable reference to this
     * payment method (a Stripe Customer+PaymentMethod, a PayPal vaulted
     * token) for later off-session charges — set true by the Subscriptions
     * module (`vulocart-pro`) when starting a recurring plan's first
     * charge.
     *
     * @var bool
     */
    public $save_payment_method;

    /**
     * A previously-saved payment method reference (from a prior result's
     * own `$raw['saved_payment_method_ref']`, vision: recurring/off-
     * session charges) — when set, the gateway charges this reference
     * directly instead of expecting fresh client-collected payment data
     * in `$payment_data`.
     *
     * @var string|null
     */
    public $saved_payment_method_ref;

    /**
     * Gateway-specific data the storefront widget collected client-side
     * before calling the server (a Stripe PaymentMethod id, a confirmed
     * PayPal order id, a Razorpay payment id + signature) — an opaque bag
     * only the resolved gateway's own adapter reads keys out of.
     *
     * @var array<string, mixed>
     */
    public $payment_data;

    /**
     * Free-form metadata attached to the gateway-side record (order
     * number once known, etc.) — shown on the gateway's own dashboard
     * where supported, never interpreted by this codebase.
     *
     * @var array<string, mixed>
     */
    public $metadata;

    /**
     * PaymentContext constructor.
     *
     * @param float                 $amount                   Amount to authorize/capture/refund.
     * @param string                $currency                 ISO 4217 currency code.
     * @param string|null           $cart_token               The cart this payment was initiated from.
     * @param int|null              $order_id                 The order this payment belongs to, once one exists.
     * @param string|null           $customer_email           Buyer's email.
     * @param string|null           $customer_name            Buyer's display name.
     * @param string                $description              A short human-readable line item description.
     * @param bool                  $capture_immediately      Whether to capture in the same call as authorizing.
     * @param bool                  $save_payment_method      Whether to retain a reusable payment method reference.
     * @param string|null           $saved_payment_method_ref A previously-saved payment method reference.
     * @param array<string, mixed>  $payment_data             Gateway-specific client-collected data.
     * @param array<string, mixed>  $metadata                 Free-form metadata attached to the gateway-side record.
     */
    public function __construct(
        float $amount,
        string $currency,
        $cart_token = null,
        $order_id = null,
        $customer_email = null,
        $customer_name = null,
        string $description = '',
        bool $capture_immediately = true,
        bool $save_payment_method = false,
        $saved_payment_method_ref = null,
        array $payment_data = array(),
        array $metadata = array()
    ) {
        $this->amount                   = $amount;
        $this->currency                 = $currency;
        $this->cart_token               = $cart_token;
        $this->order_id                 = $order_id;
        $this->customer_email           = $customer_email;
        $this->customer_name            = $customer_name;
        $this->description              = $description;
        $this->capture_immediately      = $capture_immediately;
        $this->save_payment_method      = $save_payment_method;
        $this->saved_payment_method_ref = $saved_payment_method_ref;
        $this->payment_data             = $payment_data;
        $this->metadata                 = $metadata;
    }
}
