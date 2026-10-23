<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\ProductReviews;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart ProductReviews Module - customer reviews on products: the moderation queue (VuloCart → Reviews), the
 * `reviews` REST routes (list, submit, moderate, delete) and the dashboard's "reviews to moderate" count.
 *
 * Not to be confused with the `Review` module, which is the checkout's order-review *step*. Switching this one off
 * removes the Reviews screen and routes; the stored reviews are kept, so switching it back on restores them.
 * The domain classes (`Domain\Review`, `Application\ReviewService`, the repository) and the table stay in core -
 * the module owns the wiring, so an inactive store loads none of it.
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * Builds the review service (`VuloCart()->review_service`) and adds the reviews REST controller.
     */
    public function __construct() {
        $container = VuloCart()->service_container;

        VuloCart()->review_service = new \VuloCart\Application\ReviewService(
            $container->make( \VuloCart\Domain\Review\ReviewRepositoryInterface::class ),
            VuloCart()->product_service,
            VuloCart()->event_dispatcher
        );

        add_filter( 'vulocart_rest_controllers', array( $this, 'register_controller' ) );
    }

    /**
     * Adds the Reviews controller to Free's REST controllers.
     *
     * @param array $controllers Controllers already registered.
     * @return array
     */
    public function register_controller( $controllers ) {
        $controllers['reviews'] = new \VuloCart\RestAPI\Controllers\Reviews();

        return $controllers;
    }
}
