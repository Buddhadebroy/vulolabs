<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Payment;

defined( 'ABSPATH' ) || exit;

/**
 * Payment module: the payment framework and the built-in offline gateways.
 *
 * Owns the `vulocart_payment_transactions` ledger, registers the offline gateways (manual, bank transfer, cash on
 * delivery) on the `vulocart_payment_gateways` filter, and creates the payment service that charges, captures, voids and
 * refunds through them. Online gateways (Stripe, PayPal, Razorpay in vulocart-pro) add themselves to the same filter.
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * Creates the transaction ledger table and the payment service (`VuloCart()->payment_service`), registers the
     * payment routes, the Payment checkout step and the offline gateways.
     */
    public function __construct() {
        new Install();

        $ledger   = new Infrastructure\WPDBTransactionLedger();
        $registry = new Application\GatewayRegistry();
        $service  = new Application\PaymentService( $registry, $ledger );

        VuloCart()->payment_service = $service;

        new Rest();

        add_filter( 'vulocart_checkout_steps', array( $this, 'register_checkout_step' ) );
        add_filter( 'vulocart_payment_gateways', array( $this, 'register_offline_gateways' ) );
    }

    /**
     * Registers this plugin's own three offline gateways.
     *
     * @param array<int, Domain\PaymentGatewayInterface> $gateways Already-registered gateways.
     * @return array<int, Domain\PaymentGatewayInterface>
     */
    public function register_offline_gateways( $gateways ) {
        $gateways[] = new Gateways\ManualGateway();
        $gateways[] = new Gateways\BankTransferGateway();
        $gateways[] = new Gateways\CashOnDeliveryGateway();

        return $gateways;
    }

    /**
     * Registers this module's own step - see Customer/Module.php's own
     * docblock on register_checkout_step() for what this mechanism is.
     *
     * @param array<int, array<string, mixed>> $steps Already-registered step descriptors.
     * @return array<int, array<string, mixed>>
     */
    public function register_checkout_step( $steps ) {
        $steps[] = array(
            'id'        => 'payment',
            'label'     => __( 'Payment', 'vulocart' ),
            'order'     => 40,
            'rest_base' => 'payment',
        );

        return $steps;
    }
}
