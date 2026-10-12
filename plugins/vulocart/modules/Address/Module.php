<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Address;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Address Module.
 *
 * Same toggleable-addon pattern as VuloCart\Cart\Module. No hard
 * cross-module dependency, no own table - an address here is a per-order
 * snapshot (`Order::$billing_address`/`$shipping_address`, a plain array
 * like `$meta`), not a reusable address-book entry (vision's
 * lightweight-first scope). This module's whole job is sanitizing and
 * validating that snapshot's shape, shared by the checkout wizard's own
 * client-side step validation (`POST /address/validate`) and
 * Order\Rest::create_item()'s server-side re-check before an order is
 * actually persisted.
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * Module constructor. Constructs this module's own classes and
     * registers its service on the main plugin container
     * (`VuloCart()->address_service`).
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
