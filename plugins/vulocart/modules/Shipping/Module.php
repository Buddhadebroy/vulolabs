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
 * cross-module dependency - reads the Shipping tab's own settings
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
     * Module constructor. Wires this module's own classes directly and
     * registers its service on the main plugin container
     * (`VuloCart()->shipping_service`) - plain, self-wiring shape
     * vulopilot's own Module.php files use (no container/magic getter:
     * nothing outside this module ever reaches into its instance).
     */
    public function __construct() {
        $service = new Application\ShippingService();

        VuloCart()->shipping_service = $service;

        new Rest();

        add_filter( 'vulocart_checkout_steps', array( $this, 'register_checkout_step' ) );
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
            'id'        => 'shipping',
            'label'     => __( 'Shipping', 'vulocart' ),
            'order'     => 30,
            'rest_base' => 'shipping',
        );

        return $steps;
    }
}
