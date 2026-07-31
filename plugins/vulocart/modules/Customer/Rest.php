<?php
/**
 * Rest class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Customer;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Customer module Rest class.
 *
 * Module-level REST controller — self-hooks `rest_api_init` in its own
 * constructor, same pattern every other module-level controller in this
 * codebase follows (Cart\Rest's own docblock). Public — a guest visiting
 * the checkout wizard for the first time has no WordPress session, and
 * this route only ever returns prefill data (or an empty shape), never
 * anything requiring authorization to read.
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
            '/customer/me',
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_current_customer' ),
                'permission_callback' => '__return_true',
            )
        );
    }

    /**
     * Returns the checkout wizard's Customer step prefill values.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_current_customer( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
        return rest_ensure_response( VuloCart()->customer_service->resolve_current() );
    }
}
