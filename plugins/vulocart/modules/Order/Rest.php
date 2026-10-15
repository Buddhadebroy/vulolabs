<?php
/**
 * Rest class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Order;

use VuloCart\Application\PriceCatalog;
use VuloCart\Order\Domain\Order as OrderEntity;
use VuloCart\Order\Domain\OrderItem;
use VuloCart\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Order module Rest class.
 *
 * Module-level REST controller - self-hooks `rest_api_init` in its own
 * constructor, per rest-api.md's "module-level controllers" tier, same as
 * VuloCart\Cart\Rest. `POST /orders` (create from cart) and
 * `GET /orders/track` are public, same "cart token is the access control"
 * reasoning VuloCart\Cart\Rest's docblock explains - a guest placing an
 * order and a guest checking on the order they just placed both need to
 * work with no WordPress session. Every other route (listing, single-order
 * read/update, manual order creation, refunds, bulk actions) stays
 * `manage_options`-gated, matching every other admin-listing controller
 * (rest-api.md) - order management (as opposed to placing/tracking one's
 * own order) is store-owner-only.
 *
 * Extends `\WP_REST_Controller` to match vulopilot's REST convention; this
 * class's own response-shaping helpers are named `format_order_item_for_
 * response()` and `prepare_order_for_response()`, neither of which collides
 * with anything `\WP_REST_Controller` declares.
 *
 * @class       Rest class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Rest extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'orders';

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
            '/orders',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_items' ),
                    'permission_callback' => array( $this, 'admin_permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'create_item' ),
                    'permission_callback' => '__return_true',
                ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/orders/manual',
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'create_manual_item' ),
                'permission_callback' => array( $this, 'admin_permissions_check' ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/orders/track',
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'track_item' ),
                'permission_callback' => '__return_true',
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/orders/bulk-fulfillment-status',
            array(
                'methods'             => \WP_REST_Server::EDITABLE,
                'callback'            => array( $this, 'bulk_update_fulfillment_status' ),
                'permission_callback' => array( $this, 'admin_permissions_check' ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/orders/bulk-delete',
            array(
                'methods'             => \WP_REST_Server::DELETABLE,
                'callback'            => array( $this, 'bulk_delete' ),
                'permission_callback' => array( $this, 'admin_permissions_check' ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/orders/bulk-payment-status',
            array(
                'methods'             => \WP_REST_Server::EDITABLE,
                'callback'            => array( $this, 'bulk_update_payment_status' ),
                'permission_callback' => array( $this, 'admin_permissions_check' ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/orders/(?P<id>\d+)',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_item' ),
                    'permission_callback' => array( $this, 'admin_permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::EDITABLE,
                    'callback'            => array( $this, 'update_item' ),
                    'permission_callback' => array( $this, 'admin_permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::DELETABLE,
                    'callback'            => array( $this, 'delete_item' ),
                    'permission_callback' => array( $this, 'admin_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/orders/(?P<id>\d+)/request-payment',
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'request_payment' ),
                'permission_callback' => array( $this, 'admin_permissions_check' ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/orders/(?P<id>\d+)/timeline',
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_timeline' ),
                'permission_callback' => array( $this, 'admin_permissions_check' ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/orders/(?P<id>\d+)/refund',
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'refund_item' ),
                'permission_callback' => array( $this, 'admin_permissions_check' ),
            )
        );
    }

    /**
     * Checks whether the current user can manage orders.
     *
     * @return bool
     */
    public function admin_permissions_check() {
        return current_user_can( 'manage_options' );
    }

    /**
     * Converts a domain OrderItem into the REST response shape.
     *
     * @param OrderItem $item Order item to convert to a REST response shape.
     * @return array<string, mixed>
     */
    private function format_order_item_for_response( OrderItem $item ): array {
        return array(
            'id'          => $item->id,
            'product_id' => $item->product_id,
            'title'       => $item->title,
            'quantity'    => $item->quantity,
            'unit_price'  => $item->unit_price,
            'currency'    => $item->currency,
            'subtotal'    => round( $item->unit_price * $item->quantity, 2 ),
            'price'       => PriceCatalog::line_price( $item->meta ),
        );
    }

    /**
     * Converts a domain Order into the REST response shape. `access_token`
     * is only ever included right after creation (create_item()/
     * create_manual_item()) - never on admin list/detail reads, so it
     * can't leak to anyone browsing the admin order list. `item_count` is
     * the sum of every line item's quantity - the admin grid's "Items"
     * column (OrdersList.tsx).
     *
     * @param OrderEntity $order          Order to convert to a REST response shape.
     * @param bool        $include_token Whether to include access_token (only true right after creation).
     * @return array<string, mixed>
     */
    private function prepare_order_for_response( OrderEntity $order, bool $include_token = false ): array {
        $response = array(
            'id'                 => $order->id,
            'order_number'       => $order->order_number,
            'customer_email'     => $order->customer_email,
            'customer_name'      => $order->customer_name,
            'customer_phone'     => $order->customer_phone,
            'customer_user_id'   => $order->customer_user_id,
            'payment_status'     => $order->payment_status,
            'fulfillment_status' => $order->fulfillment_status,
            'refunded_amount'    => $order->refunded_amount,
            'currency'           => $order->currency,
            'subtotal'           => $order->subtotal,
            'shipping_method'    => $order->shipping_method,
            'shipping_cost'      => $order->shipping_cost,
            'tax_amount'         => $order->tax_amount,
            'payment_method'     => $order->payment_method,
            'gateway_transaction_id' => $order->gateway_transaction_id,
            'authorized_amount'  => $order->authorized_amount,
            'captured_amount'    => $order->captured_amount,
            'total'              => $order->total,
            'billing_address'    => $order->billing_address,
            'shipping_address'   => $order->shipping_address,
            'item_count'         => array_sum( array_map( fn( $item ) => $item->quantity, $order->items ) ),
            'items'              => array_map( array( $this, 'format_order_item_for_response' ), $order->items ),
            'discount_total'     => max( 0, round( (float) $order->subtotal + (float) $order->shipping_cost + (float) $order->tax_amount - (float) $order->total, 2 ) ),
            'payment_requests'   => isset( $order->meta['payment_requests'] ) && is_array( $order->meta['payment_requests'] ) ? array_values( $order->meta['payment_requests'] ) : array(),
            'tags'               => isset( $order->meta['tags'] ) && is_array( $order->meta['tags'] ) ? array_values( $order->meta['tags'] ) : array(),
            'customer'           => $this->customer_summary( $order ),
            'created_at'         => $order->created_at,
            'updated_at'         => $order->updated_at,
        );

        if ( $include_token ) {
            $response['access_token'] = $order->access_token;
        }

        return $response;
    }

    /**
     * Lists orders, paginated - admin only. Also returns per-
     * fulfillment-status counts as response headers (`X-WP-Count-{status}`)
     * so the admin grid can render real "saved view" tab counts (TableCard's
     * `categoryCounts`, OrdersList.tsx) without a second request.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_items( $request ) {
        $page               = absint( $request->get_param( 'page' ) ? $request->get_param( 'page' ) : 1 );
        $per_page           = absint( $request->get_param( 'per_page' ) ? $request->get_param( 'per_page' ) : 20 );
        $payment_status     = sanitize_key( (string) $request->get_param( 'payment_status' ) );
        $fulfillment_status = sanitize_key( (string) $request->get_param( 'fulfillment_status' ) );
        $search             = sanitize_text_field( (string) $request->get_param( 'search' ) );
        $date_from          = sanitize_text_field( (string) $request->get_param( 'date_from' ) );
        $date_to            = sanitize_text_field( (string) $request->get_param( 'date_to' ) );

        $result = VuloCart()->order_service->list_orders(
            array(
                'page'               => $page,
                'per_page'           => $per_page,
                'payment_status'     => $payment_status,
                'fulfillment_status' => $fulfillment_status,
                'search'             => $search,
                'date_from'          => $date_from,
                'date_to'            => $date_to,
            )
        );

        $response = rest_ensure_response( array_map( array( $this, 'prepare_order_for_response' ), $result['data'] ) );
        $response->header( 'X-WP-Total', (string) $result['total'] );
        $response->header( 'X-WP-TotalPages', (string) ceil( $result['total'] / max( 1, $per_page ) ) );

        foreach ( VuloCart()->order_service->count_orders_by_fulfillment_status() as $status => $count ) {
            $response->header( 'X-WP-Count-' . $status, (string) $count );
        }

        return $response;
    }

    /**
     * Fetches one order by id - admin only.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function get_item( $request ) {
        $order = VuloCart()->order_service->get_order( absint( $request->get_param( 'id' ) ) );

        if ( ! $order ) {
            return new \WP_Error( 'vulocart_order_not_found', esc_html__( 'Order not found.', 'vulocart' ), array( 'status' => 404 ) );
        }

        return rest_ensure_response( $this->prepare_order_for_response( $order ) );
    }

    /**
     * The guest order-tracking lookup: order number + access token, both
     * required - neither alone is treated as sufficient authorization.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function track_item( $request ) {
        $order_number = sanitize_text_field( (string) $request->get_param( 'order_number' ) );
        $access_token = sanitize_text_field( (string) $request->get_param( 'access_token' ) );

        if ( '' === $order_number || '' === $access_token ) {
            return new \WP_Error(
                'vulocart_missing_tracking_params',
                esc_html__( 'order_number and access_token are both required.', 'vulocart' ),
                array( 'status' => 400 )
            );
        }

        $order = VuloCart()->order_service->track_order( $order_number, $access_token );

        if ( ! $order ) {
            return new \WP_Error( 'vulocart_order_not_found', esc_html__( 'Order not found.', 'vulocart' ), array( 'status' => 404 ) );
        }

        return rest_ensure_response( $this->prepare_order_for_response( $order ) );
    }

    /**
     * Creates an order from a cart. Public - see class docblock.
     *
     * Gated on the Checkout tab's `guest_checkout_enabled` setting: when
     * disabled, a request from a visitor with no active WordPress session
     * is rejected rather than silently placing a guest order - the same
     * enforcement `src/blocks/checkout/Checkout.tsx` also applies
     * client-side (hiding the "Place Order" button), duplicated here since
     * a client-side-only check is not real enforcement (a direct API call
     * would bypass it).
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function create_item( $request ) {
        $settings = wp_parse_args( get_option( Utill::SETTINGS_KEY, array() ), Utill::SETTINGS_DEFAULTS );

        if ( empty( $settings['guest_checkout_enabled'] ) && ! is_user_logged_in() ) {
            return new \WP_Error(
                'vulocart_guest_checkout_disabled',
                esc_html__( 'Guest checkout is disabled. Please log in to place an order.', 'vulocart' ),
                array( 'status' => 401 )
            );
        }

        $cart_token = $request->get_header( 'X-Cart-Token' );

        if ( ! $cart_token ) {
            $cart_token = (string) $request->get_param( 'cart_token' );
        }

        $cart_token = substr( preg_replace( '/[^a-zA-Z0-9-]/', '', (string) $cart_token ), 0, 64 );

        if ( '' === $cart_token ) {
            return new \WP_Error(
                'vulocart_missing_cart_token',
                esc_html__( 'A cart_token (or X-Cart-Token header) is required.', 'vulocart' ),
                array( 'status' => 400 )
            );
        }

        $customer_email = $request->get_param( 'customer_email' ) ? sanitize_email( (string) $request->get_param( 'customer_email' ) ) : null;
        $customer_name  = $request->get_param( 'customer_name' ) ? sanitize_text_field( (string) $request->get_param( 'customer_name' ) ) : null;
        $customer_phone = $request->get_param( 'customer_phone' ) ? sanitize_text_field( (string) $request->get_param( 'customer_phone' ) ) : null;
        $user_id        = get_current_user_id();

        // Checkout tab's `require_phone_number` - same "client hint,
        // server re-check" pattern `guest_checkout_enabled` above already
        // uses, so a direct API call can't skip a field the wizard's own
        // Customer step marks required.
        if ( ! empty( $settings['require_phone_number'] ) && ! $customer_phone ) {
            return new \WP_Error(
                'vulocart_missing_phone_number',
                esc_html__( 'A phone number is required.', 'vulocart' ),
                array( 'status' => 400 )
            );
        }

        // Address module's own sanitizer, called defensively - same
        // "checkout still works without an optional module active" rule
        // OrderService::resolve_optional_service() follows, just resolved
        // here since address *validation* (as opposed to shipping/tax/
        // payment calculation) has to happen before create_from_cart()
        // is even called, to return a 400 instead of a half-taken order.
        $address_service  = null;
        try {
            $address_service = VuloCart()->address_service;
        } catch ( \Exception $e ) {
            $address_service = null;
        }

        $billing_address_param  = $request->get_param( 'billing_address' );
        $shipping_address_param = $request->get_param( 'shipping_address' );

        $billing_address  = null;
        $shipping_address = null;

        if ( $address_service && is_array( $billing_address_param ) && ! empty( $billing_address_param ) ) {
            $billing_address = $address_service->sanitize( $billing_address_param );

            if ( ! $address_service->validate( $billing_address ) ) {
                return new \WP_Error( 'vulocart_invalid_billing_address', esc_html__( 'Billing address is missing required fields.', 'vulocart' ), array( 'status' => 400 ) );
            }
        }

        if ( $address_service && is_array( $shipping_address_param ) && ! empty( $shipping_address_param ) ) {
            $shipping_address = $address_service->sanitize( $shipping_address_param );

            if ( ! $address_service->validate( $shipping_address ) ) {
                return new \WP_Error( 'vulocart_invalid_shipping_address', esc_html__( 'Shipping address is missing required fields.', 'vulocart' ), array( 'status' => 400 ) );
            }
        }

        $shipping_method   = $request->get_param( 'shipping_method' ) ? sanitize_key( (string) $request->get_param( 'shipping_method' ) ) : null;
        $payment_method    = $request->get_param( 'payment_method' ) ? sanitize_key( (string) $request->get_param( 'payment_method' ) ) : null;
        $payment_intent_id = $request->get_param( 'payment_intent_id' ) ? sanitize_text_field( (string) $request->get_param( 'payment_intent_id' ) ) : null;

        try {
            $order = VuloCart()->order_service->create_from_cart(
                $cart_token,
                $customer_email,
                $customer_name,
                $customer_phone,
                $user_id ? $user_id : null,
                $billing_address,
                $shipping_address,
                $shipping_method,
                $payment_method,
                $payment_intent_id
            );
        } catch ( \InvalidArgumentException $exception ) {
            return new \WP_Error( 'vulocart_empty_cart', esc_html__( 'Cart is empty or does not exist.', 'vulocart' ), array( 'status' => 400 ) );
        }

        if ( $user_id && $customer_phone ) {
            try {
                VuloCart()->customer_service->remember_phone( $user_id, $customer_phone );
            } catch ( \Exception $e ) {
                // Customer module not active - nothing to remember into.
                unset( $e );
            }
        }

        $response = rest_ensure_response( $this->prepare_order_for_response( $order, true ) );
        $response->set_status( 201 );

        return $response;
    }

    /**
     * Creates a draft order directly from a merchant-picked item list -
     * admin only. Backs OrderAdd.tsx's "Add New" order page.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function create_manual_item( $request ) {
        $items = $request->get_param( 'items' );

        if ( ! is_array( $items ) || empty( $items ) ) {
            return new \WP_Error( 'vulocart_missing_items', esc_html__( 'At least one item is required.', 'vulocart' ), array( 'status' => 400 ) );
        }

        $sanitized_items = array();

        foreach ( $items as $item ) {
            if ( ! is_array( $item ) || empty( $item['product_id'] ) ) {
                continue;
            }

            $sanitized_items[] = array(
                'product_id' => absint( $item['product_id'] ),
                'quantity'    => isset( $item['quantity'] ) ? absint( $item['quantity'] ) : 1,
            );
        }

        $customer_email = $request->get_param( 'customer_email' ) ? sanitize_email( (string) $request->get_param( 'customer_email' ) ) : null;
        $customer_name  = $request->get_param( 'customer_name' ) ? sanitize_text_field( (string) $request->get_param( 'customer_name' ) ) : null;

        try {
            $order = VuloCart()->order_service->create_manual_order( $sanitized_items, $customer_email, $customer_name );
        } catch ( \InvalidArgumentException $exception ) {
            return new \WP_Error( 'vulocart_invalid_manual_order', esc_html( $exception->getMessage() ), array( 'status' => 400 ) );
        }

        $response = rest_ensure_response( $this->prepare_order_for_response( $order ) );
        $response->set_status( 201 );

        return $response;
    }

    /**
     * Updates an order's payment and/or fulfillment status - admin only.
     * Either field alone is accepted (OrderEdit.tsx saves whichever
     * changed), both together also works.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function update_item( $request ) {
        $id = absint( $request->get_param( 'id' ) );

        $order = null;

        try {
            if ( null !== $request->get_param( 'fulfillment_status' ) ) {
                $order = VuloCart()->order_service->update_fulfillment_status(
                    $id,
                    sanitize_key( (string) $request->get_param( 'fulfillment_status' ) )
                );
            }

            if ( null !== $request->get_param( 'payment_status' ) ) {
                $order = VuloCart()->order_service->update_payment_status(
                    $id,
                    sanitize_key( (string) $request->get_param( 'payment_status' ) )
                );
            }
        } catch ( \InvalidArgumentException $exception ) {
            return new \WP_Error( 'vulocart_invalid_status', esc_html( $exception->getMessage() ), array( 'status' => 400 ) );
        }

        if ( ! $order ) {
            $order = VuloCart()->order_service->get_order( $id );
        }

        if ( ! $order ) {
            return new \WP_Error( 'vulocart_order_not_found', esc_html__( 'Order not found.', 'vulocart' ), array( 'status' => 404 ) );
        }

        $detail_keys = array( 'customer_email', 'customer_name', 'customer_phone', 'shipping_method', 'payment_method', 'shipping_address', 'billing_address' );
        $details     = array();

        foreach ( $detail_keys as $key ) {
            if ( null !== $request->get_param( $key ) ) {
                $details[ $key ] = $request->get_param( $key );
            }
        }

        if ( $details ) {
            try {
                $order = VuloCart()->order_service->update_details( $id, $details ) ?? $order;
            } catch ( \InvalidArgumentException $exception ) {
                return new \WP_Error( 'vulocart_invalid_order_details', esc_html( $exception->getMessage() ), array( 'status' => 400 ) );
            }
        }

        if ( is_array( $request->get_param( 'tags' ) ) ) {
            $order = VuloCart()->order_service->set_tags( $id, array_map( 'sanitize_text_field', array_map( 'strval', $request->get_param( 'tags' ) ) ) ) ?? $order;
        }

        return rest_ensure_response( $this->prepare_order_for_response( $order ) );
    }

    /**
     * The order's customer as the order screen needs it - account type and lifetime numbers - or null when no
     * customer record exists for the order's email (the Customer module is off, or a guest never checked out).
     *
     * @param OrderEntity $order The order.
     * @return array<string, mixed>|null
     */
    private function customer_summary( OrderEntity $order ) {
        if ( empty( $order->customer_email ) ) {
            return null;
        }

        try {
            $customer = VuloCart()->customer_service->get_by_email( (string) $order->customer_email );
        } catch ( \Exception $exception ) {
            return null;
        }

        if ( ! $customer ) {
            return null;
        }

        return array(
            'id'            => $customer->id,
            'is_registered' => ! empty( $customer->wp_user_id ),
            'total_orders'  => $customer->total_orders,
            'total_spent'   => $customer->total_spent,
            'last_order_at' => $customer->last_order_at,
            'since'         => $customer->created_at,
        );
    }

    /**
     * Emails the customer a request to pay - admin only.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function request_payment( $request ) {
        try {
            $order = VuloCart()->order_service->request_payment( absint( $request->get_param( 'id' ) ) );
        } catch ( \InvalidArgumentException $exception ) {
            return new \WP_Error( 'vulocart_payment_request_invalid', esc_html( $exception->getMessage() ), array( 'status' => 400 ) );
        } catch ( \RuntimeException $exception ) {
            return new \WP_Error( 'vulocart_payment_request_failed', esc_html( $exception->getMessage() ), array( 'status' => 500 ) );
        }

        if ( ! $order ) {
            return new \WP_Error( 'vulocart_order_not_found', esc_html__( 'Order not found.', 'vulocart' ), array( 'status' => 404 ) );
        }

        return rest_ensure_response( $this->prepare_order_for_response( $order ) );
    }

    /**
     * Everything that has happened to an order, oldest first: it was placed, each payment-ledger event, and
     * whatever other modules add through `vulocart_order_timeline` (shipments, for one). Each event is
     * `{ type, title, detail, at, amount?, currency? }`.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function get_timeline( $request ) {
        $id    = absint( $request->get_param( 'id' ) );
        $order = VuloCart()->order_service->get_order( $id );

        if ( ! $order ) {
            return new \WP_Error( 'vulocart_order_not_found', esc_html__( 'Order not found.', 'vulocart' ), array( 'status' => 404 ) );
        }

        $events = array(
            array(
                'type'   => 'placed',
                'title'  => __( 'Order placed', 'vulocart' ),
                'detail' => '',
                'at'     => $order->created_at,
            ),
        );

        foreach ( (array) ( $order->meta['payment_requests'] ?? array() ) as $requested_at ) {
            $events[] = array(
                'type'   => 'payment',
                'title'  => __( 'Payment requested', 'vulocart' ),
                'detail' => (string) $order->customer_email,
                'at'     => $requested_at,
            );
        }

        try {
            $transactions = VuloCart()->payment_service->get_transaction_history( $id );
        } catch ( \Exception $exception ) {
            $transactions = array(); // The Payment module is off - there is no ledger to read.
        }

        foreach ( $transactions as $transaction ) {
            $events[] = array(
                'type'     => 'payment',
                'title'    => ucfirst( (string) $transaction['type'] ),
                'detail'   => trim( (string) $transaction['gateway'] . ' · ' . (string) $transaction['status'], ' ·' ),
                'at'       => $transaction['created_at'],
                'amount'   => (float) $transaction['amount'],
                'currency' => $transaction['currency'],
            );
        }

        /**
         * Lets other modules add events to an order's timeline.
         *
         * @param array<int, array<string, mixed>> $events   Events so far.
         * @param int                              $order_id The order.
         */
        $events = (array) apply_filters( 'vulocart_order_timeline', $events, $id );

        usort(
            $events,
            static fn( $a, $b ) => strcmp( (string) ( $a['at'] ?? '' ), (string) ( $b['at'] ?? '' ) )
        );

        return rest_ensure_response( array_values( $events ) );
    }

    /**
     * Issues a refund on an order - admin only.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function refund_item( $request ) {
        $amount = $request->get_param( 'amount' );

        if ( null === $amount || ! is_numeric( $amount ) || (float) $amount <= 0 ) {
            return new \WP_Error( 'vulocart_invalid_refund_amount', esc_html__( 'A positive refund amount is required.', 'vulocart' ), array( 'status' => 400 ) );
        }

        $order = VuloCart()->order_service->refund_order_via_gateway( absint( $request->get_param( 'id' ) ), (float) $amount );

        if ( ! $order ) {
            return new \WP_Error( 'vulocart_order_not_found', esc_html__( 'Order not found.', 'vulocart' ), array( 'status' => 404 ) );
        }

        return rest_ensure_response( $this->prepare_order_for_response( $order ) );
    }

    /**
     * Transitions many orders to the same fulfillment status in one
     * request - backs the admin grid's bulk-action dropdown. Admin only,
     * same gate as every other order-management route.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function bulk_update_fulfillment_status( $request ) {
        $ids = $request->get_param( 'ids' );

        if ( ! is_array( $ids ) || empty( $ids ) ) {
            return new \WP_Error( 'vulocart_missing_order_ids', esc_html__( 'No order ids were provided.', 'vulocart' ), array( 'status' => 400 ) );
        }

        $ids    = array_map( 'absint', $ids );
        $status = sanitize_key( (string) $request->get_param( 'status' ) );

        try {
            $updated = VuloCart()->order_service->bulk_update_fulfillment_status( $ids, $status );
        } catch ( \InvalidArgumentException $exception ) {
            return new \WP_Error( 'vulocart_invalid_status', esc_html( $exception->getMessage() ), array( 'status' => 400 ) );
        }

        return rest_ensure_response( array( 'updated' => $updated ) );
    }

    /**
     * Transitions many orders to the same payment status in one request -
     * same reasoning as bulk_update_fulfillment_status().
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function bulk_update_payment_status( $request ) {
        $ids = $request->get_param( 'ids' );

        if ( ! is_array( $ids ) || empty( $ids ) ) {
            return new \WP_Error( 'vulocart_missing_order_ids', esc_html__( 'No order ids were provided.', 'vulocart' ), array( 'status' => 400 ) );
        }

        $ids    = array_map( 'absint', $ids );
        $status = sanitize_key( (string) $request->get_param( 'status' ) );

        try {
            $updated = VuloCart()->order_service->bulk_update_payment_status( $ids, $status );
        } catch ( \InvalidArgumentException $exception ) {
            return new \WP_Error( 'vulocart_invalid_status', esc_html( $exception->getMessage() ), array( 'status' => 400 ) );
        }

        return rest_ensure_response( array( 'updated' => $updated ) );
    }

    /**
     * Permanently deletes one order.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function delete_item( $request ) {
        if ( ! VuloCart()->order_service->delete_order( absint( $request->get_param( 'id' ) ) ) ) {
            return new \WP_Error( 'vulocart_order_not_found', esc_html__( 'Order not found.', 'vulocart' ), array( 'status' => 404 ) );
        }

        return rest_ensure_response( array( 'deleted' => true ) );
    }

    /**
     * Permanently deletes several orders.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function bulk_delete( $request ) {
        $ids = $request->get_param( 'ids' );

        if ( ! is_array( $ids ) || empty( $ids ) ) {
            return new \WP_Error( 'vulocart_missing_order_ids', esc_html__( 'No order ids were provided.', 'vulocart' ), array( 'status' => 400 ) );
        }

        return rest_ensure_response( array( 'deleted' => VuloCart()->order_service->bulk_delete( array_map( 'absint', $ids ) ) ) );
    }
}
