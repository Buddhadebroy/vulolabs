<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Order;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Order Module.
 *
 * Same toggleable-addon pattern as VuloCart\Cart\Module - but Order has a
 * real, hard dependency Cart doesn't: an order is built from a cart, so it
 * needs `VuloCart()->cart_service` to already exist. Two things make that
 * safe without assuming any particular module discovery/activation order:
 *
 * 1. is_compatible() vetoes this module's own availability
 *    (module-architecture.md's optional gate, checked by
 *    Modules::is_module_available()) whenever the 'cart' module isn't
 *    active - so Order is simply never instantiated at all if Cart isn't,
 *    rather than failing at the point it tries to use a service that was
 *    never wired.
 * 2. Even when 'cart' *is* active, this module's own constructor only
 *    registers Install() (see its own docblock for why that part must
 *    stay eager) and defers the actual service-wiring
 *    (wire_services()) to the `vulocart_loaded` action - which
 *    `VuloCart::init_classes()` only fires *after*
 *    `Modules::load_active_modules()`'s entire loop has finished
 *    constructing every active module for this request, Cart included.
 *    That guarantees `VuloCart()->cart_service` exists by the time
 *    wire_services() actually runs, regardless of whether Cart or Order
 *    happened to be discovered/instantiated first within that loop.
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * Module constructor. Plain, self-wiring shape vulopilot's own
     * Module.php files use (no container/magic getter: nothing outside
     * this module ever reaches into its instance).
     */
    public function __construct() {
        // Eager: registers the `vulocart_activated_module_order` listener
        // this same request's `do_action()` call (fired by
        // Modules::load_active_modules() right after this constructor
        // returns) needs to already be listening for - see Install's own
        // docblock. Nothing here touches cart_service.
        new Install();

        add_action( 'vulocart_loaded', array( $this, 'wire_services' ) );
    }

    /**
     * Whether the Order module can be active at all - vetoed unless the
     * Cart module also is, since an order is built from a cart.
     *
     * @return bool
     */
    public static function is_compatible(): bool {
        return VuloCart()->modules->is_active( 'cart' );
    }

    /**
     * Builds this module's Application/Rest layer. Deferred to
     * `vulocart_loaded` - see class docblock for why.
     *
     * @return void
     */
    public function wire_services() {
        VuloCart()->service_container->singleton(
            Domain\OrderRepositoryInterface::class,
            function () {
                return new Infrastructure\WPDBOrderRepository();
            }
        );

        $service = new Application\OrderService(
            VuloCart()->service_container->make( Domain\OrderRepositoryInterface::class ),
            VuloCart()->cart_service,
            VuloCart()->offering_service,
            VuloCart()->event_dispatcher
        );

        VuloCart()->order_service = $service;

        new Rest();
    }
}
