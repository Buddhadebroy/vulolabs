<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Payment;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Payment Module.
 *
 * Now the Payment Framework's own home, not just a settings-reader: owns
 * `vulocart_payment_transactions` (Install.php), registers this plugin's
 * own three offline `PaymentGatewayInterface` implementations
 * (Gateways/) onto the `vulocart_payment_gateways` filter
 * `Application\GatewayRegistry` collects from, and wires
 * `Application\PaymentService` up with that registry plus its own
 * transaction ledger. `vulocart-pro`'s Stripe/PayPal/Razorpay modules
 * hook the same filter with zero dependency on this class beyond the
 * filter name — same "module contributes to a filter this plugin's core
 * collects" shape `vulocart_checkout_steps` already establishes.
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * Container for this module's own class instances.
     *
     * @var array
     */
    private $container = array();

    /**
     * Module constructor.
     */
    public function __construct() {
        $this->init_classes();
    }

    /**
     * Constructs this module's own classes and registers its service on
     * the main plugin container (`VuloCart()->payment_service`).
     *
     * @return void
     */
    public function init_classes() {
        $this->container['install'] = new Install();
        $this->container['ledger']  = new Infrastructure\WPDBTransactionLedger();
        $this->container['registry'] = new Application\GatewayRegistry();
        $this->container['service']  = new Application\PaymentService( $this->container['registry'], $this->container['ledger'] );

        VuloCart()->payment_service = $this->container['service'];

        $this->container['rest'] = new Rest();

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
     * Registers this module's own step — see Customer/Module.php's own
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

    /**
     * Magic getter for this module's own container.
     *
     * @param string $class_name Container key to retrieve.
     * @return mixed
     * @throws \Exception If the requested key does not exist in the container.
     */
    public function __get( $class_name ) { // phpcs:ignore Universal.NamingConventions.NoReservedKeywordParameterNames.classFound
        if ( array_key_exists( $class_name, $this->container ) ) {
            return $this->container[ $class_name ];
        }

        throw new \Exception( sprintf( 'Call to unknown class %s.', esc_html( $class_name ) ) );
    }
}
