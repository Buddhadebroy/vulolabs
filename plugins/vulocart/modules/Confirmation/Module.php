<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Confirmation;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Confirmation Module.
 *
 * The checkout wizard's final "Thank you" step. Thin by design: no own
 * table, no own Application service - `Rest.php` delegates straight to
 * `VuloCart()->order_service->track_order()`, the same lookup
 * `Order\Rest::track_item()` already exposes at `GET /orders/track`. This
 * module exists as its own route/namespace anyway (`GET /confirmation/
 * {order_number}`) rather than reusing that route directly, so the
 * checkout wizard's own confirmation step and the separate, longer-lived
 * "track my order" feature (`src/blocks/order-tracking/`) stay two
 * decoupled call sites even though they resolve the same underlying data
 * today - a future confirmation-specific addition (e.g. "what's next"
 * copy, estimated next steps) has its own route to grow into without
 * changing order-tracking's.
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * Module constructor.
     */
    public function __construct() {
        new Rest();

        add_filter( 'vulocart_checkout_steps', array( $this, 'register_checkout_step' ) );
    }

    /**
     * Whether the Confirmation module can be active - vetoed unless the
     * Order module also is, since there's nothing to confirm without it.
     *
     * @return bool
     */
    public static function is_compatible(): bool {
        return VuloCart()->modules->is_active( 'order' );
    }

    /**
     * Registers this module's own step - see Customer/Module.php's own
     * docblock on register_checkout_step() for what this mechanism is.
     * `order = 100` deliberately leaves a wide gap after Review's `50` -
     * confirmation is the terminal state after an order is placed, not
     * something a step-reordering Checkout Builder (vulocart-pro) should
     * ever let a merchant slot in the middle of the sequence.
     *
     * @param array<int, array<string, mixed>> $steps Already-registered step descriptors.
     * @return array<int, array<string, mixed>>
     */
    public function register_checkout_step( $steps ) {
        $steps[] = array(
            'id'        => 'confirmation',
            'label'     => __( 'Confirmation', 'vulocart' ),
            'order'     => 100,
            'rest_base' => 'confirmation',
        );

        return $steps;
    }
}
