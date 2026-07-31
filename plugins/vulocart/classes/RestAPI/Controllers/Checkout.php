<?php
/**
 * Checkout class file.
 *
 * @package VuloCart
 */

namespace VuloCart\RestAPI\Controllers;

use VuloCart\Domain\Checkout\CheckoutMode;
use VuloCart\Domain\Checkout\CheckoutSession;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Checkout REST controller — the Checkout Engine's own routes.
 *
 * `GET /checkout/steps` is the pluggability mechanism itself: rather than
 * any client hardcoding a step sequence (the old Checkout.tsx's own
 * `CheckoutStep` union type did exactly that), every step-owning module
 * (Customer/Address/Shipping/Taxes/Payment/Review/Confirmation, and any
 * future vulocart-pro one) registers its own descriptor into the
 * `vulocart_checkout_steps` filter, and this endpoint is the single place
 * that list is assembled and sorted — a checkout UI in ANY delivery mode
 * (block, popup, embedded, hosted) discovers what to render from this one
 * call instead of shipping its own copy of the step list.
 *
 * `/checkout/sessions/*` is Application\CheckoutService's own REST
 * surface — public, cart-token-authenticated the same way Cart's own
 * routes are (`X-Cart-Token`, never a nonce), since a guest with no
 * WordPress session at all must be able to use every delivery mode this
 * engine supports.
 *
 * @class       Checkout class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Checkout extends \WP_REST_Controller {

    /**
     * Registers this controller's REST routes.
     *
     * @return void
     */
    public function register_routes() {
        register_rest_route(
            VuloCart()->rest_namespace,
            '/checkout/steps',
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_steps' ),
                'permission_callback' => '__return_true',
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/checkout/sessions',
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'create_session' ),
                'permission_callback' => '__return_true',
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/checkout/sessions/(?P<token>[a-zA-Z0-9_-]+)',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_session' ),
                    'permission_callback' => '__return_true',
                ),
                array(
                    'methods'             => \WP_REST_Server::EDITABLE,
                    'callback'            => array( $this, 'update_session' ),
                    'permission_callback' => '__return_true',
                ),
            )
        );
    }

    /**
     * Converts a domain CheckoutSession into the REST response shape.
     *
     * @param CheckoutSession $session Session to convert to a REST response shape.
     * @return array<string, mixed>
     */
    private function prepare_session_for_response( CheckoutSession $session ): array {
        return array(
            'cart_token'     => $session->cart_token,
            'status'         => $session->status,
            'mode'           => $session->mode,
            'current_step'   => $session->current_step,
            'customer_email' => $session->customer_email,
            'meta'           => $session->meta,
            'created_at'     => $session->created_at,
            'updated_at'     => $session->updated_at,
        );
    }

    /**
     * Assembles every registered checkout step, sorted by its own
     * declared `order` (ties broken by registration order — `usort()` is
     * stable in PHP 8+, this codebase's own testVersion floor is 7.4, but
     * a tie only ever affects display order of two steps declaring the
     * exact same `order` value, which no step here does).
     *
     * @return \WP_REST_Response
     */
    public function get_steps() {
        /**
         * `vulocart_checkout_steps` — every checkout-step-owning module
         * appends its own `{id, label, order, rest_base}` descriptor here.
         * Free's own Customer/Address/Shipping/Taxes/Payment/Review/
         * Confirmation modules each self-register (their own Module.php),
         * gated on their own `is_active()` the same way any toggleable
         * module already is — an inactive module's filter callback never
         * runs, so it never appears here, no separate active-check needed
         * by this endpoint itself.
         *
         * @param array<int, array{id: string, label: string, order: int, rest_base: string}> $steps Registered step descriptors.
         */
        $steps = apply_filters( 'vulocart_checkout_steps', array() );

        usort(
            $steps,
            function ( $a, $b ) {
                return $a['order'] <=> $b['order'];
            }
        );

        return rest_ensure_response( array_values( $steps ) );
    }

    /**
     * Starts (or returns the existing) session for a cart token.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function create_session( $request ) {
        $cart_token = sanitize_text_field( (string) $request->get_param( 'cart_token' ) );

        if ( '' === $cart_token ) {
            return new \WP_Error( 'vulocart_missing_cart_token', esc_html__( 'A cart_token is required.', 'vulocart' ), array( 'status' => 400 ) );
        }

        $mode = sanitize_key( (string) $request->get_param( 'mode' ) );
        $mode = $mode ? $mode : CheckoutMode::MULTI_STEP;

        $session = VuloCart()->checkout_service->start_session( $cart_token, $mode );

        $response = rest_ensure_response( $this->prepare_session_for_response( $session ) );
        $response->set_status( 201 );

        return $response;
    }

    /**
     * Fetches a session by cart token.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function get_session( $request ) {
        $session = VuloCart()->checkout_service->get_session( (string) $request->get_param( 'token' ) );

        if ( ! $session ) {
            return new \WP_Error( 'vulocart_checkout_session_not_found', esc_html__( 'No checkout session exists for this cart token.', 'vulocart' ), array( 'status' => 404 ) );
        }

        return rest_ensure_response( $this->prepare_session_for_response( $session ) );
    }

    /**
     * Records step progress on a session.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function update_session( $request ) {
        $data = array();

        if ( null !== $request->get_param( 'current_step' ) ) {
            $data['current_step'] = sanitize_key( (string) $request->get_param( 'current_step' ) );
        }

        if ( null !== $request->get_param( 'customer_email' ) ) {
            $data['customer_email'] = sanitize_email( (string) $request->get_param( 'customer_email' ) );
        }

        if ( is_array( $request->get_param( 'meta' ) ) ) {
            $data['meta'] = map_deep( $request->get_param( 'meta' ), 'sanitize_text_field' );
        }

        $session = VuloCart()->checkout_service->update_progress( (string) $request->get_param( 'token' ), $data );

        if ( ! $session ) {
            return new \WP_Error( 'vulocart_checkout_session_not_found', esc_html__( 'No checkout session exists for this cart token.', 'vulocart' ), array( 'status' => 404 ) );
        }

        return rest_ensure_response( $this->prepare_session_for_response( $session ) );
    }
}
