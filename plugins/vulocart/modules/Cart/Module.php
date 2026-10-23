<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Cart;

defined( 'ABSPATH' ) || exit;

/**
 * Cart module: shopping carts for guests and signed-in customers.
 *
 * Registers the cart service (`VuloCart()->cart_service`), the cart REST routes, the cart tables, and the daily cleanup
 * of abandoned carts. It is a core module: the cart cannot be switched off.
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * Creates the cart tables, the cart service (`VuloCart()->cart_service`), the cart routes and the daily expired-cart
     * cleanup.
     */
    public function __construct() {
        new Install();

        VuloCart()->service_container->singleton(
            Domain\CartRepositoryInterface::class,
            function () {
                return new Infrastructure\WPDBCartRepository();
            }
        );

        $service = new Application\CartService(
            VuloCart()->service_container->make( Domain\CartRepositoryInterface::class ),
            VuloCart()->product_service,
            VuloCart()->event_dispatcher
        );

        VuloCart()->cart_service = $service;

        new Rest();
        new Application\CartCleanupScheduler( $service );
    }
}
