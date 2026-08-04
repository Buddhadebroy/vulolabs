<?php
/**
 * Rest class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Payment;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Payment module Rest class.
 *
 * Module-level REST controller. `GET /payment/methods` and
 * `POST /payment/intent` are public — same "cart token is the access
 * control" reasoning `Cart\Rest`/`Order\Rest`'s own docblocks explain, a
 * guest at checkout has no WordPress session. `POST /payments/webhook/
 * {gateway}` is also public (`__return_true`) by necessity — the caller
 * is the payment gateway's own server, which never holds a WordPress
 * nonce or cart token; `PaymentGatewayInterface::handle_webhook()`'s own
 * signature verification is the real access control there, not this
 * route's `permission_callback`. Order-scoped capture/refund/cancel stay
 * `manage_options`-gated, same as every other order-management route.
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
            '/payment/methods',
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_methods' ),
                'permission_callback' => '__return_true',
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/payment/intent',
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'create_intent' ),
                'permission_callback' => '__return_true',
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/payments/webhook/(?P<gateway>[a-z0-9-]+)',
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_webhook' ),
                'permission_callback' => '__return_true',
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/orders/(?P<id>\d+)/capture-payment',
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'capture_order_payment' ),
                'permission_callback' => array( $this, 'admin_permissions_check' ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/orders/(?P<id>\d+)/cancel-payment',
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'cancel_order_payment' ),
                'permission_callback' => array( $this, 'admin_permissions_check' ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/orders/(?P<id>\d+)/payment-transactions',
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_order_transactions' ),
                'permission_callback' => array( $this, 'admin_permissions_check' ),
            )
        );
    }

    /**
     * Checks whether the current user can manage payments.
     *
     * @return bool
     */
    public function admin_permissions_check() {
        return current_user_can( 'manage_options' );
    }

    /**
     * Returns every currently-available payment method.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_methods( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
        return rest_ensure_response( VuloCart()->payment_service->get_available_methods() );
    }

    /**
     * Creates a payment intent against a cart — the step a real gateway's
     * own storefront widget (`vulocart-pro`'s Stripe/PayPal/Razorpay
     * modules) calls before the buyer finishes checkout, to get a
     * `client_secret`/equivalent handle to confirm directly with that
     * gateway's own JS SDK.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function create_intent( $request ) {
        $gateway_id = sanitize_key( (string) $request->get_param( 'gateway' ) );
        $cart_token = $request->get_header( 'X-Cart-Token' );

        if ( ! $cart_token ) {
            $cart_token = (string) $request->get_param( 'cart_token' );
        }

        $cart_token = substr( preg_replace( '/[^a-zA-Z0-9-]/', '', (string) $cart_token ), 0, 64 );

        if ( '' === $cart_token ) {
            return new \WP_Error( 'vulocart_missing_cart_token', __( 'A cart_token (or X-Cart-Token header) is required.', 'vulocart' ), array( 'status' => 400 ) );
        }

        $cart = VuloCart()->cart_service->find_cart( $cart_token );

        if ( ! $cart || empty( $cart->items ) ) {
            return new \WP_Error( 'vulocart_empty_cart', __( 'Cart is empty or does not exist.', 'vulocart' ), array( 'status' => 400 ) );
        }

        $totals = VuloCart()->cart_service->get_totals( $cart );

        $shipping_method = $request->get_param( 'shipping_method' ) ? sanitize_key( (string) $request->get_param( 'shipping_method' ) ) : null;

        $shipping_cost = 0.0;
        try {
            $shipping_cost = ( $shipping_method ) ? VuloCart()->shipping_service->calculate_cost( $shipping_method ) : 0.0;
        } catch ( \Exception $e ) {
            unset( $e );
        }

        $tax_amount = 0.0;
        try {
            $tax_amount = VuloCart()->tax_service->calculate( $totals['subtotal'] );
        } catch ( \Exception $e ) {
            unset( $e );
        }

        $amount = round( $totals['subtotal'] + $shipping_cost + $tax_amount, 2 );

        $payment_data = $request->get_param( 'payment_data' );

        $result = VuloCart()->payment_service->create_intent(
            $gateway_id,
            $cart_token,
            $amount,
            $cart->currency ? $cart->currency : (string) wp_parse_args( get_option( \VuloCart\Utill::SETTINGS_KEY, array() ), \VuloCart\Utill::SETTINGS_DEFAULTS )['default_currency'],
            array(
                'customer_email' => $request->get_param( 'customer_email' ) ? sanitize_email( (string) $request->get_param( 'customer_email' ) ) : null,
                'payment_data'   => is_array( $payment_data ) ? $payment_data : array(),
            )
        );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response(
            array(
                'gateway_transaction_id' => $result->gateway_transaction_id,
                'status'                 => $result->status,
                'client_secret'          => $result->client_secret,
                'amount'                 => $amount,
                'error_message'          => $result->error_message,
            )
        );
    }

    /**
     * Dispatches an inbound gateway webhook — public, see class docblock
     * for why. Always replies 200 on a recognized-but-unlinked event
     * (nothing this codebase needs to do yet) so the gateway doesn't
     * retry a call it already delivered successfully; a genuinely
     * unverifiable payload gets a 400 so the gateway's own dashboard
     * flags it.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function handle_webhook( $request ) {
        $gateway_id = sanitize_key( (string) $request->get_param( 'gateway' ) );
        $result     = VuloCart()->payment_service->handle_webhook( $gateway_id, $request );

        if ( ! $result->success ) {
            return new \WP_Error( 'vulocart_webhook_verification_failed', esc_html( (string) $result->error_message ), array( 'status' => 400 ) );
        }

        return rest_ensure_response( array( 'received' => true ) );
    }

    /**
     * Captures an order's authorized payment — admin only.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function capture_order_payment( $request ) {
        $order = VuloCart()->order_service->get_order( absint( $request->get_param( 'id' ) ) );

        if ( ! $order ) {
            return new \WP_Error( 'vulocart_order_not_found', __( 'Order not found.', 'vulocart' ), array( 'status' => 404 ) );
        }

        $amount_param = $request->get_param( 'amount' );
        $amount       = ( null !== $amount_param && is_numeric( $amount_param ) ) ? (float) $amount_param : null;

        $result = VuloCart()->payment_service->capture_for_order( $order->payment_method, $order->gateway_transaction_id, $order->id, $amount, (string) $order->currency, (float) $order->authorized_amount );

        if ( ! $result ) {
            return new \WP_Error( 'vulocart_no_payment_gateway', __( 'This order has no linked payment gateway to capture from.', 'vulocart' ), array( 'status' => 400 ) );
        }

        $order->payment_status    = $result->to_order_payment_status();
        $order->authorized_amount = $result->authorized_amount;
        $order->captured_amount   = $result->captured_amount;
        $order                    = VuloCart()->order_service->apply_payment_result( $order );

        return rest_ensure_response(
            array(
                'success' => $result->success,
                'status'  => $result->status,
                'order'   => array(
                    'payment_status'    => $order->payment_status,
                    'authorized_amount' => $order->authorized_amount,
                    'captured_amount'   => $order->captured_amount,
                ),
            )
        );
    }

    /**
     * Voids an order's authorized (not yet captured) payment — admin
     * only.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function cancel_order_payment( $request ) {
        $order = VuloCart()->order_service->get_order( absint( $request->get_param( 'id' ) ) );

        if ( ! $order ) {
            return new \WP_Error( 'vulocart_order_not_found', __( 'Order not found.', 'vulocart' ), array( 'status' => 404 ) );
        }

        $result = VuloCart()->payment_service->cancel_for_order( $order->payment_method, $order->gateway_transaction_id, $order->id, (string) $order->currency );

        if ( ! $result ) {
            return new \WP_Error( 'vulocart_no_payment_gateway', __( 'This order has no linked payment gateway to cancel.', 'vulocart' ), array( 'status' => 400 ) );
        }

        $order->payment_status = $result->to_order_payment_status();
        $order                 = VuloCart()->order_service->apply_payment_result( $order );

        return rest_ensure_response(
            array(
                'success' => $result->success,
                'status'  => $result->status,
                'order'   => array( 'payment_status' => $order->payment_status ),
            )
        );
    }

    /**
     * Returns an order's own payment transaction history — admin only.
     * Backs the admin order detail screen's "payment history" panel.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_order_transactions( $request ) {
        $order_id = absint( $request->get_param( 'id' ) );

        return rest_ensure_response( VuloCart()->payment_service->get_transaction_history( $order_id ) );
    }
}
