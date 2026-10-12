<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Cart;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Cart Module.
 *
 * The vision: an independent Cart Engine, its own toggleable module
 * (`modules/Cart/Module.php`), discovered and instantiated only by
 * VuloCart's own `Modules` loader (module-architecture.md), never
 * constructed directly anywhere in this codebase - same pattern
 * `vulocart-pro`'s Passport module already establishes, just with the
 * fuller Domain/Application/Infrastructure/Rest layering Cart's own
 * business complexity earns (unlike Passport's flatter single-Util
 * shape - module-architecture.md: "no fixed contract... decide
 * per-feature").
 *
 * No cross-module dependency to defer here (unlike Order\Module, which
 * needs Cart's own service to already exist) - `offering_service` is
 * constructed eagerly in `VuloCart::init_classes()` *before* any module
 * loads, so this module can wire everything synchronously in its own
 * constructor.
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * Module constructor. Wires this module's own classes directly and
     * registers its service on the main plugin container
     * (`VuloCart()->cart_service`) so sibling modules (Order\Module) and
     * the core plugin can reach it the same way they reach any other core
     * service - same plain, self-wiring shape vulopilot(-pro)'s own
     * Module.php files use (no per-module container/magic getter: nothing
     * outside this module ever reaches into its instance, so there was
     * never a consumer for one).
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
            VuloCart()->offering_service,
            VuloCart()->event_dispatcher
        );

        VuloCart()->cart_service = $service;

        new Rest();
        new Application\CartCleanupScheduler( $service );
    }
}
