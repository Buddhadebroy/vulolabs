<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Review;

defined( 'ABSPATH' ) || exit;

/**
 * Review module: the "Review your order" step of the checkout.
 *
 * Not the same as product reviews (see ProductReviews). Registers `VuloCart()->order_review_service`, which works out
 * the final totals (items, shipping and tax) without saving anything, so the shopper sees the real total before
 * pressing "Place order".
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * Creates the order review service (`VuloCart()->order_review_service`), its route and the checkout's Review step.
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
