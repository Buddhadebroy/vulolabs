<?php
/**
 * PaymentGatewayInterface file.
 *
 * @package VuloCart
 */

namespace VuloCart\Payment\Domain;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Payment module PaymentGatewayInterface.
 *
 * The Payment Framework's one contract — every payment method this app
 * ever offers (the three offline ones this plugin ships, plus Stripe/
 * PayPal/Razorpay in `vulocart-pro`) is a class implementing this
 * interface and nothing more; `PaymentService`/`GatewayRegistry` never
 * know which concrete class they're holding. Deliberately has no
 * `use VuloCart\Order\...`/`use VuloCart\Cart\...` anywhere in this
 * file or any of its implementations — a gateway only ever sees a
 * `PaymentContext`/gateway_transaction_id/`\WP_REST_Request`, never a
 * Cart or Order object directly, so the payment layer stays reusable
 * outside this app's own checkout flow (a Subscriptions billing cycle
 * calls `authorize()` the same way an order-creation request does).
 *
 * `authorize()` also serves as this framework's "create/confirm a
 * payment intent" step (Phase 5's "Support payment intents" requirement)
 * — a gateway that needs client-side confirmation (Stripe/PayPal/
 * Razorpay) returns `PaymentResult::REQUIRES_ACTION` with a
 * `client_secret` the storefront's own JS SDK widget uses to finish the
 * job directly with the gateway; `handle_webhook()` is how this codebase
 * later learns the outcome. A gateway with nothing to confirm client-side
 * (the three offline ones) just returns a final status immediately.
 *
 * @class       PaymentGatewayInterface interface
 * @version     1.0.0
 * @author      VuloLabs
 */
interface PaymentGatewayInterface {

    /**
     * This gateway's stable id — becomes `Order::$payment_method`'s
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
     * only ever offers configured gateways to the storefront —
     * unconfigured ones stay invisible rather than erroring at checkout.
     *
     * @return bool
     */
    public function is_configured(): bool;

    /**
     * Whether this gateway can charge a previously-saved payment method
     * off-session — gates whether the Subscriptions module (`vulocart-
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
     * Authorizes a payment — and, when `$context->capture_immediately`
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
     * Handles an inbound webhook call from this gateway — verifies the
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
