<?php
/**
 * BankTransferGateway class file.
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
 * VuloCart Payment module BankTransferGateway.
 *
 * Distinct from ManualGateway even though both are offline: a bank
 * transfer always starts `AUTHORIZED` (never immediately `CAPTURED`,
 * regardless of the Payments tab's `default_payment_status`) since real
 * money hasn't moved yet — a merchant has to actually see the transfer
 * land before marking the order paid (Order\Rest's existing
 * payment-status route), so defaulting to "paid" here would be actively
 * misleading. `bank_transfer_instructions` is shown to the buyer on the
 * order confirmation screen (Confirmation module's own extension point).
 *
 * @class       BankTransferGateway class
 * @version     1.0.0
 * @author      VuloLabs
 */
class BankTransferGateway implements PaymentGatewayInterface {

    /**
     * {@inheritDoc}
     */
    public function get_id(): string {
        return 'bank-transfer';
    }

    /**
     * {@inheritDoc}
     */
    public function get_label(): string {
        return __( 'Bank transfer', 'vulocart' );
    }

    /**
     * {@inheritDoc}
     */
    public function is_configured(): bool {
        $settings = wp_parse_args( get_option( Utill::SETTINGS_KEY, array() ), Utill::SETTINGS_DEFAULTS );

        return ! empty( $settings['enable_bank_transfer'] );
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
        return new PaymentResult( true, PaymentResult::AUTHORIZED, null, $context->amount, 0.0 );
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
        return PaymentResult::failed( 'The bank transfer gateway has no webhook.' );
    }
}
