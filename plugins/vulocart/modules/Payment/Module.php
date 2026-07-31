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
 * Same toggleable-addon pattern as VuloCart\Cart\Module. No own table, no
 * cross-module dependency — reads the Payments tab's own settings
 * (`enable_manual_payment`/`default_payment_status`, `src/settings/
 * Commerce/Payments.ts`) and turns them into a real, selectable payment
 * method: `manual` (pay on delivery / bank transfer / any offline
 * settlement), the only mode this plugin supports until a real gateway
 * module exists — same "extensible interface, one implementation today"
 * shape `get_available_methods()`'s id-based list already leaves room
 * for.
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
        $this->container['service'] = new Application\PaymentService();

        VuloCart()->payment_service = $this->container['service'];

        $this->container['rest'] = new Rest();

        add_filter( 'vulocart_checkout_steps', array( $this, 'register_checkout_step' ) );
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
