<?php
/**
 * Rest class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Shipping;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Shipping module Rest class.
 *
 * Module-level REST controller, public — same reasoning as Cart\Rest's own
 * docblock. Backs the checkout wizard's Shipping step (which method is
 * available, and what it costs, before the buyer commits to placing the
 * order).
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
            '/shipping/methods',
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_methods' ),
                'permission_callback' => '__return_true',
            )
        );
    }

    /**
     * Returns every currently-available shipping method.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_methods( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
        return rest_ensure_response( VuloCart()->shipping_service->get_available_methods() );
    }
}
