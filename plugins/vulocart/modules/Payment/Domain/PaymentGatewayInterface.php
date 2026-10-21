<?php
/**
 * PaymentGatewayInterface file.
 *
 * @package VuloCart
 */

namespace VuloCart\Payment\Domain;

defined( 'ABSPATH' ) || exit;

/**
 * The one contract every payment method implements: the three offline gateways of this plugin and the Stripe, PayPal
 * and Razorpay gateways of vulocart-pro. `PaymentService` and `GatewayRegistry` never know which concrete class they
 * hold.
 *
 * A gateway never sees a Cart or Order object, only a `PaymentContext`, a gateway transaction id or the webhook
 * `\WP_REST_Request`, so the payment layer can be reused outside checkout (a subscription renewal calls `authorize()`
 * the same way an order does).
 *
 * `authorize()` is also the "create or confirm a payment intent" step. A gateway that needs the shopper to finish in
 * the browser (Stripe, PayPal, Razorpay) returns `PaymentResult::REQUIRES_ACTION` with a `client_secret` for its
 * JavaScript widget, and `handle_webhook()` reports the final result later. A gateway with nothing to confirm (the
 * offline ones) returns a final status at once.
 *
 * @class       PaymentGatewayInterface interface
 * @version     1.0.0
 * @author      VuloLabs
 */
interface PaymentGatewayInterface {

    /**
     * This gateway's stable id - becomes `Order::$payment_method`'s
     * value, the `/payments/webhook/{gateway}` route segment, and the
     * settings-field-key prefix (`vulocart_pro_{id}_...`).
     *
     * @return string
     */
    public function get_id(): string;

    /**
     * Human-readable label shown in the checkout wizard's Payment step
     * and the admin Payments settings tab.
     *
     * @return string
     */
    public function get_label(): string;

    /**
     * Whether this gateway has everything it needs to run right now
     * (required settings saved, feature toggle on). `GatewayRegistry`
     * only ever offers configured gateways to the storefront -
     * unconfigured ones stay invisible rather than erroring at checkout.
     *
     * @return bool
     */
    public function is_configured(): bool;

    /**
     * Whether this gateway can charge a previously-saved payment method
     * off-session - gates whether the Subscriptions module (`vulocart-
     * pro`) offers this gateway on a recurring plan.
     *
     * @return bool
     */
    public function supports_recurring(): bool;

    /**
     * Whether `capture()` can settle less than the full authorized
     * amount in one call (and be called again for the remainder).
     *
     * @return bool
     */
    public function supports_partial_capture(): bool;

    /**
     * Whether `refund()` can return less than the full captured amount
     * in one call (and be called again for the remainder).
     *
     * @return bool
     */
    public function supports_partial_refund(): bool;

    /**
     * Authorizes a payment - and, when `$context->capture_immediately`
     * is true (the common case), captures it in the same call. See class
     * docblock for how this also stands in as "create/confirm a payment
     * intent."
     *
     * @param PaymentContext $context What to charge and how.
     * @return PaymentResult
     */
    public function authorize( PaymentContext $context ): PaymentResult;

    /**
     * Captures a previously-authorized payment, in full or in part.
     *
     * @param string          $gateway_transaction_id The gateway's own reference, from a prior `authorize()` result.
     * @param float|null      $amount                  Amount to capture; null = capture the full remaining authorized amount.
     * @param PaymentContext  $context                 The same context shape `authorize()` takes, for gateways that need it (currency, metadata).
     * @return PaymentResult
     */
    public function capture( string $gateway_transaction_id, $amount, PaymentContext $context ): PaymentResult;

    /**
     * Refunds a previously-captured payment, in full or in part.
     *
     * @param string          $gateway_transaction_id The gateway's own reference.
     * @param float|null      $amount                  Amount to refund; null = refund the full remaining captured amount.
     * @param PaymentContext  $context                 Same shape `authorize()` takes.
     * @return PaymentResult
     */
    public function refund( string $gateway_transaction_id, $amount, PaymentContext $context ): PaymentResult;

    /**
     * Voids an authorized-but-not-yet-captured payment.
     *
     * @param string          $gateway_transaction_id The gateway's own reference.
     * @param PaymentContext  $context                 Same shape `authorize()` takes.
     * @return PaymentResult
     */
    public function cancel( string $gateway_transaction_id, PaymentContext $context ): PaymentResult;

    /**
     * Handles an inbound webhook call from this gateway - verifies the
     * request's own signature (never trusts an unsigned payload) and
     * returns the resulting `PaymentResult` so `PaymentService` can
     * reconcile its transaction ledger and, when the transaction is
     * already linked to an order, that order's own payment state.
     *
     * @param \WP_REST_Request $request The raw inbound webhook request.
     * @return PaymentResult A failed() result (with no ledger side effects) when the payload doesn't verify.
     */
    public function handle_webhook( \WP_REST_Request $request ): PaymentResult;
}
