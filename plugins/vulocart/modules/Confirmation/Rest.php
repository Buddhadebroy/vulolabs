<?php
/**
 * Rest class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Confirmation;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Confirmation module Rest class.
 *
 * Module-level REST controller, public — same reasoning as Cart\Rest's own
 * docblock: the buyer who just placed the order has whatever the
 * `POST /orders` response already gave them (order_number + access_token)
 * and no WordPress session.
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
            '/confirmation/(?P<order_number>[A-Za-z0-9\-]+)',
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_confirmation' ),
                'permission_callback' => '__return_true',
            )
        );
    }

    /**
     * Returns the confirmation-step view of a just-placed order — the
     * order number plus its access token, both required, are the
     * authorization check (Order\Rest::track_item()'s own docblock).
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function get_confirmation( $request ) {
        $order_number = sanitize_text_field( (string) $request->get_param( 'order_number' ) );
        $access_token = sanitize_text_field( (string) $request->get_param( 'access_token' ) );

        if ( '' === $access_token ) {
            return new \WP_Error(
                'vulocart_missing_access_token',
                esc_html__( 'An access_token is required.', 'vulocart' ),
                array( 'status' => 400 )
            );
        }

        $order = VuloCart()->order_service->track_order( $order_number, $access_token );

        if ( ! $order ) {
            return new \WP_Error( 'vulocart_order_not_found', esc_html__( 'Order not found.', 'vulocart' ), array( 'status' => 404 ) );
        }

        return rest_ensure_response(
            array(
                'order_number'       => $order->order_number,
                'customer_name'      => $order->customer_name,
                'customer_email'     => $order->customer_email,
                'payment_status'     => $order->payment_status,
                'fulfillment_status' => $order->fulfillment_status,
                'payment_method'     => $order->payment_method,
                'shipping_method'    => $order->shipping_method,
                'shipping_address'   => $order->shipping_address,
                'currency'           => $order->currency,
                'subtotal'           => $order->subtotal,
                'shipping_cost'      => $order->shipping_cost,
                'tax_amount'         => $order->tax_amount,
                'total'              => $order->total,
                'created_at'         => $order->created_at,
            )
        );
    }
}
