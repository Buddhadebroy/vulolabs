<?php
/**
 * ManualGateway class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Payment\Gateways;

use VuloCart\Payment\Domain\PaymentContext;
use VuloCart\Payment\Domain\PaymentGatewayInterface;
use VuloCart\Payment\Domain\PaymentResult;
use VuloCart\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Payment module ManualGateway.
 *
 * The original (pre-Payment-Framework) `manual` method, now expressed as
 * a real `PaymentGatewayInterface` implementation instead of a hardcoded
 * array entry — same settings key (`enable_manual_payment`), same
 * behavior (`authorize()` never calls out anywhere; the resulting status
 * is whatever the Payments tab's `default_payment_status` says, exactly
 * `PaymentService::get_initial_payment_status()`'s old return value).
 * `capture()`/`refund()`/`cancel()` are all no-ops that just acknowledge
 * — the actual money movement (pay on delivery, a bank transfer the
 * merchant reconciles by hand) happens outside this software; this
 * gateway's job is only to let the admin's own manual
 * fulfillment/payment-status change on the order (Order\Rest's existing
 * routes) reflect that.
 *
 * @class       ManualGateway class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ManualGateway implements PaymentGatewayInterface {

    /**
     * {@inheritDoc}
     */
    public function get_id(): string {
        return 'manual';
    }

    /**
     * {@inheritDoc}
     */
    public function get_label(): string {
        return __( 'Manual / offline payment (pay on delivery, bank transfer, etc.)', 'vulocart' );
    }

    /**
     * {@inheritDoc}
     */
    public function is_configured(): bool {
        $settings = wp_parse_args( get_option( Utill::SETTINGS_KEY, array() ), Utill::SETTINGS_DEFAULTS );

        return ! empty( $settings['enable_manual_payment'] );
    }

    /**
     * {@inheritDoc}
     */
    public function supports_recurring(): bool {
        return false;
    }

    /**
     * {@inheritDoc}
     */
    public function supports_partial_capture(): bool {
        return false;
    }

    /**
     * {@inheritDoc}
     */
    public function supports_partial_refund(): bool {
        return true;
    }

    /**
     * {@inheritDoc}
     */
    public function authorize( PaymentContext $context ): PaymentResult {
        $settings = wp_parse_args( get_option( Utill::SETTINGS_KEY, array() ), Utill::SETTINGS_DEFAULTS );
        $status   = (string) $settings['default_payment_status'];

        $is_paid = 'paid' === $status;

        return new PaymentResult(
            true,
            $is_paid ? PaymentResult::CAPTURED : PaymentResult::AUTHORIZED,
            null,
            $is_paid ? 0.0 : $context->amount,
            $is_paid ? $context->amount : 0.0
        );
    }

    /**
     * {@inheritDoc}
     */
    public function capture( string $gateway_transaction_id, $amount, PaymentContext $context ): PaymentResult {
        return new PaymentResult( true, PaymentResult::CAPTURED, null, 0.0, null === $amount ? $context->amount : (float) $amount );
    }

    /**
     * {@inheritDoc}
     */
    public function refund( string $gateway_transaction_id, $amount, PaymentContext $context ): PaymentResult {
        return new PaymentResult( true, PaymentResult::REFUNDED, null, 0.0, 0.0, null === $amount ? $context->amount : (float) $amount );
    }

    /**
     * {@inheritDoc}
     */
    public function cancel( string $gateway_transaction_id, PaymentContext $context ): PaymentResult {
        return new PaymentResult( true, PaymentResult::CANCELED );
    }

    /**
     * {@inheritDoc}
     */
    public function handle_webhook( \WP_REST_Request $request ): PaymentResult {
        return PaymentResult::failed( 'The manual gateway has no webhook.' );
    }
}
