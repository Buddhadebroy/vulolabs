<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Order;

defined( 'ABSPATH' ) || exit;

/**
 * Order module: orders and their line items.
 *
 * An order is built from a cart, so this module is only available while the Cart module is active (see is_compatible()).
 * It registers the order service (`VuloCart()->order_service`), the order REST routes and the order tables.
 *
 * The service is created on `vulocart_loaded`, after every active module has been loaded, so `cart_service` is
 * guaranteed to exist whatever order the modules were loaded in.
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * Creates the order tables now; the order service itself is created later on `vulocart_loaded` (see
     * wire_services()).
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
            VuloCart()->product_service,
            VuloCart()->event_dispatcher
        );

        VuloCart()->order_service = $service;

        new Rest();
    }
}
