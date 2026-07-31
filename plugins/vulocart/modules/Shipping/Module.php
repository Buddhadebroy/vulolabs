<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Shipping;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Shipping Module.
 *
 * Same toggleable-addon pattern as VuloCart\Cart\Module. No own table, no
 * cross-module dependency — reads the Shipping tab's own settings
 * (`enable_shipping`/`flat_rate_shipping_cost`, `src/settings/Commerce/
 * Shipping.ts`) and turns them into a real, calculable shipping cost:
 * `Order\Application\OrderService::create_from_cart()` resolves this
 * module's own service (when active) to compute `Order::$shipping_cost`
 * server-side, never trusting a client-sent figure.
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
     * the main plugin container (`VuloCart()->shipping_service`).
     *
     * @return void
     */
    public function init_classes() {
        $this->container['service'] = new Application\ShippingService();

        VuloCart()->shipping_service = $this->container['service'];

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
            'id'        => 'shipping',
            'label'     => __( 'Shipping', 'vulocart' ),
            'order'     => 30,
            'rest_base' => 'shipping',
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
