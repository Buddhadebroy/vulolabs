<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Confirmation;

defined( 'ABSPATH' ) || exit;

/**
 * Confirmation module: the "Thank you" step shown after an order is placed.
 *
 * Has no tables or service of its own. `GET /confirmation/{order_number}` returns the same order data as order tracking,
 * so the confirmation step and the separate order-tracking block can change independently.
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * Registers the confirmation route and the checkout's Confirmation step.
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
     * Registers this module's own checkout step. `order = 100` leaves a wide gap after Review's `50`: confirmation is
     * the terminal state after an order is placed, not a step that anything should slot into the middle of the
     * sequence.
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
