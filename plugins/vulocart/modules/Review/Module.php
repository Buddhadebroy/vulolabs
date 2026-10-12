<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Review;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Review Module.
 *
 * The checkout wizard's final "Review your order" step - deliberately its
 * own namespace (`VuloCart\Review`, distinct from the existing product
 * star-rating feature at `VuloCart\Domain\Review`/
 * `VuloCart\Application\ReviewService`, exposed as
 * `VuloCart()->review_service`) to avoid colliding with that unrelated,
 * already-shipped concept. This module registers itself as
 * `VuloCart()->order_review_service`.
 *
 * Same toggleable-addon pattern as VuloCart\Cart\Module. No own table -
 * `build_summary()` is a pure read: it recomputes exactly what
 * `Order\Application\OrderService::create_from_cart()` would charge,
 * without persisting anything, so the wizard's Review step can show the
 * real final total before the buyer commits to "Place Order".
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * Module constructor. Wires this module's own classes directly and
     * registers its service on the main plugin container
     * (`VuloCart()->order_review_service`) - plain, self-wiring shape
     * vulopilot's own Module.php files use (no container/magic getter:
     * nothing outside this module ever reaches into its instance).
     */
    public function __construct() {
        $service = new Application\OrderReviewService();

        VuloCart()->order_review_service = $service;

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
            'id'        => 'review',
            'label'     => __( 'Review', 'vulocart' ),
            'order'     => 50,
            'rest_base' => 'review',
        );

        return $steps;
    }
}
