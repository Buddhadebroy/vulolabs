<?php
/**
 * CashOnDeliveryGateway class file.
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
 * VuloCart Payment module CashOnDeliveryGateway.
 *
 * Same "no external call, merchant confirms by hand" shape as
 * BankTransferGateway — kept as its own gateway (rather than folding
 * into ManualGateway) so it has its own settings toggle
 * (`enable_cash_on_delivery`) and label, letting a merchant offer "pay on
 * delivery" and "any other offline settlement" as two visibly distinct
 * checkout options.
 *
 * @class       CashOnDeliveryGateway class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CashOnDeliveryGateway implements PaymentGatewayInterface {

    /**
     * {@inheritDoc}
     */
    public function get_id(): string {
        return 'cash-on-delivery';
    }

    /**
     * {@inheritDoc}
     */
    public function get_label(): string {
        return __( 'Cash on delivery', 'vulocart' );
    }

    /**
     * {@inheritDoc}
     */
    public function is_configured(): bool {
        $settings = wp_parse_args( get_option( Utill::SETTINGS_KEY, array() ), Utill::SETTINGS_DEFAULTS );

        return ! empty( $settings['enable_cash_on_delivery'] );
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
        return PaymentResult::failed( 'The cash on delivery gateway has no webhook.' );
    }
}
