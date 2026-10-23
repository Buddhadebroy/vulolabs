<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Address;

defined( 'ABSPATH' ) || exit;

/**
 * Address module: sanitizes and validates the billing and shipping address of an order.
 *
 * An address is stored as a snapshot on the order (not as a reusable address book entry). The checkout validates it step
 * by step through `POST /address/validate`, and the order REST controller checks it again on the server before an order
 * is saved.
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * Creates the address service (`VuloCart()->address_service`), the validation route and the checkout's Address step.
     */
    public function __construct() {
        $service = new Application\AddressService();

        VuloCart()->address_service = $service;

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
            'id'        => 'address',
            'label'     => __( 'Address', 'vulocart' ),
            'order'     => 20,
            'rest_base' => 'address',
        );

        return $steps;
    }
}
