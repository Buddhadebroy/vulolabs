<?php
/**
 * Rest class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Review;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Review module Rest class.
 *
 * Module-level REST controller, public — same reasoning as Cart\Rest's own
 * docblock. `POST /review/summary` backs the checkout wizard's final
 * Review step.
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
            '/review/summary',
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'get_summary' ),
                'permission_callback' => '__return_true',
            )
        );
    }

    /**
     * Resolves the cart token for a request — same convention Cart\Rest's
     * own `resolve_token()` uses.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return string
     */
    private function resolve_token( \WP_REST_Request $request ): string {
        $token = $request->get_header( 'X-Cart-Token' );

        if ( ! $token ) {
            $token = (string) $request->get_param( 'cart_token' );
        }

        return substr( preg_replace( '/[^a-zA-Z0-9-]/', '', (string) $token ), 0, 64 );
    }

    /**
     * Builds and returns a full order preview for the current cart plus
     * in-progress checkout selections.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function get_summary( $request ) {
        $token = $this->resolve_token( $request );

        if ( '' === $token ) {
            return new \WP_Error( 'vulocart_missing_cart_token', esc_html__( 'A cart_token (or X-Cart-Token header) is required.', 'vulocart' ), array( 'status' => 400 ) );
        }

        $billing_address  = $request->get_param( 'billing_address' );
        $shipping_address = $request->get_param( 'shipping_address' );
        $shipping_method  = $request->get_param( 'shipping_method' ) ? sanitize_key( (string) $request->get_param( 'shipping_method' ) ) : null;
        $payment_method   = $request->get_param( 'payment_method' ) ? sanitize_key( (string) $request->get_param( 'payment_method' ) ) : null;

        try {
            $address_service = VuloCart()->address_service;

            if ( is_array( $billing_address ) ) {
                $billing_address = $address_service->sanitize( $billing_address );
            }

            if ( is_array( $shipping_address ) ) {
                $shipping_address = $address_service->sanitize( $shipping_address );
            }
        } catch ( \Exception $e ) {
            $billing_address  = is_array( $billing_address ) ? $billing_address : null;
            $shipping_address = is_array( $shipping_address ) ? $shipping_address : null;
        }

        try {
            $summary = VuloCart()->order_review_service->build_summary(
                $token,
                is_array( $billing_address ) ? $billing_address : null,
                is_array( $shipping_address ) ? $shipping_address : null,
                $shipping_method,
                $payment_method
            );
        } catch ( \InvalidArgumentException $exception ) {
            return new \WP_Error( 'vulocart_review_unavailable', esc_html( $exception->getMessage() ), array( 'status' => 400 ) );
        }

        return rest_ensure_response( $summary );
    }
}
