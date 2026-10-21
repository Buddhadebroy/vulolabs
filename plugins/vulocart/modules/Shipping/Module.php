<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Shipping;

defined( 'ABSPATH' ) || exit;

/**
 * Shipping module: shipping methods and shipping cost at checkout.
 *
 * Offers the flat rate set in Settings → Shipping (a rate of 0 shows as free shipping) and adds the Shipping step to the
 * checkout. The cost is always calculated on the server when the order is created. vulocart-pro's Fulfillment module
 * adds zone-based rates to the same list.
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * Creates the shipping service (`VuloCart()->shipping_service`), its route and the checkout's Shipping step.
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
