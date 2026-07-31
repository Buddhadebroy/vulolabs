<?php
/**
 * Rest class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Taxes;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Taxes module Rest class.
 *
 * Module-level REST controller, public — same reasoning as Cart\Rest's own
 * docblock. Backs the checkout wizard's Review step, so a "Tax (10%)" line
 * can be labeled correctly before the order is actually placed (the real
 * tax amount charged always comes from `POST /orders`'/`POST /review/
 * summary`'s own server-side calculation, never trusted from this route's
 * rate alone).
 *
 * @class       Rest class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Rest {

    /**
     * Rest constructor.
     */
    public function __construct() {
        add_action( 'rest_api_init', array( $this, 'register_routes' ) );
    }

    /**
     * Registers this module's REST routes.
     *
     * @return void
     */
    public function register_routes(): void {
        register_rest_route(
            VuloCart()->rest_namespace,
            '/taxes/rate',
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_rate' ),
                'permission_callback' => '__return_true',
            )
        );
    }

    /**
     * Returns the currently configured tax rate.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_rate( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
        $tax_service = VuloCart()->tax_service;

        return rest_ensure_response(
            array(
                'enabled'            => $tax_service->is_enabled(),
                'rate_percent'       => $tax_service->get_rate_percent(),
                'prices_include_tax' => $tax_service->prices_include_tax(),
            )
        );
    }
}
