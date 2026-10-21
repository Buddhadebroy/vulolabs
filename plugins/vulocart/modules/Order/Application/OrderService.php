<?php
/**
 * OrderService class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Order\Application;

use VuloCart\Application\ProductService;
use VuloCart\Cart\Application\CartService;
use VuloCart\Events\EventDispatcher;
use VuloCart\Order\Domain\FulfillmentStatus;
use VuloCart\Order\Domain\Order;
use VuloCart\Order\Domain\OrderItem;
use VuloCart\Order\Domain\OrderRepositoryInterface;
use VuloCart\Order\Domain\PaymentStatus;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Order module OrderService.
 *
 * Where Order business logic actually lives - Rest calls only this class.
 * Depends on the Cart module's own CartService (to read + clear the
 * source cart) and the core plugin's ProductService (to snapshot each line
 * item's title at order-creation time) - a real, deliberate cross-module
 * dependency: Order genuinely cannot function without Cart, which is why
 * Module::is_compatible() gates this module's own availability on Cart
 * being active, and Module's own constructor defers building this class
 * until `vulocart_loaded` (after every module in this pass - including
 * Cart - has already been constructed), rather than assuming any
 * particular module discovery/activation order.
 *
 * @class       OrderService class
 * @version     1.0.0
 * @author      VuloLabs
 */
class OrderService {

    /**
     * The bound repository implementation.
     *
     * @var OrderRepositoryInterface Resolved via VuloCart's ServiceContainer, not `new`d directly.
     */
    private $repository;

    /**
     * Used to read a cart's current items and clear it once converted.
     *
     * @var CartService
     */
    private $cart_service;

    /**
     * Used to snapshot each line item's title at order-creation time.
     *
     * @var ProductService
     */
    private $product_service;

    /**
     * Broadcasts what happened after each mutation.
     *
     * @var EventDispatcher
     */
    private $events;

    /**
     * OrderService constructor.
     *
     * @param OrderRepositoryInterface $repository    Resolved via VuloCart's ServiceContainer, not `new`d directly.
     * @param CartService              $cart_service   Used to read a cart's current items and clear it once converted.
     * @param ProductService          $product_service  Used to snapshot each line item's title at order-creation time.
     * @param EventDispatcher          $events         Broadcasts what happened; never decides what should happen.
     */
    public function __construct(
        OrderRepositoryInterface $repository,
        CartService $cart_service,
        ProductService $product_service,
        EventDispatcher $events
    ) {
        $this->repository       = $repository;
        $this->cart_service     = $cart_service;
        $this->product_service = $product_service;
        $this->events           = $events;
    }

    /**
     * Fetches one order by id, with its items loaded.
     *
     * @param int $id Order id.
     * @return Order|null
     */
    public function get_order( $id ) {
        return $this->repository->find( $id );
    }

    /**
     * The guest order-tracking lookup - an order number alone isn't
     * enough (it's sequential and guessable), the access_token is the
     * actual authorization check.
     *
     * @param string $order_number Human-facing order identifier.
     * @param string $access_token Opaque buyer-held access token.
     * @return Order|null
     */
    public function track_order( $order_number, $access_token ) {
        return $this->repository->find_by_number_and_token( $order_number, $access_token );
    }

    /**
     * Finds the most recent order placed with a given customer email -
     * see OrderRepositoryInterface::find_latest_by_customer_email()'s own
     * docblock for what this backs.
     *
     * @param string $customer_email Customer email to match.
     * @return Order|null Null if no order has ever been placed with this email.
     */
    public function find_latest_order_for_email( $customer_email ) {
        return $this->repository->find_latest_by_customer_email( $customer_email );
    }

    /**
     * Returns a page of orders, optionally filtered.
     *
     * @param array{page?: int, per_page?: int, payment_status?: string, fulfillment_status?: string, search?: string, date_from?: string, date_to?: string} $args Pagination/filter args, already sanitized by the caller.
     * @return array{data: Order[], total: int}
     */
    public function list_orders( $args = array() ) {
        return $this->repository->paginate( $args );
    }

    /**
     * Counts orders in each FulfillmentStatus bucket - backs the admin
     * grid's "saved view" tabs (Rest::get_items()).
     *
     * @return array<string, int>
     */
    public function count_orders_by_fulfillment_status() {
        return $this->repository->count_by_fulfillment_status();
    }

    /**
     * Resolves an optional sibling module's own service off the main
     * plugin container, without hard-failing when that module isn't
     * active - `VuloCart()->$key`'s magic `__get()` throws for an unknown
     * container key (VuloCart.php's own docblock), so this is how
     * OrderService reaches for Shipping/Taxes/Payment the same
     * "gracefully absent" way every other toggleable-module dependency in
     * this codebase already works, without taking a hard constructor
     * dependency on three more optional modules the way it does on Cart.
     *
     * @param string $key Container key, e.g. 'shipping_service'.
     * @return mixed|null Null if no module registered that service.
     */
    private function resolve_optional_service( string $key ) {
        try {
            return VuloCart()->$key; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase -- magic __get(), not a real property.
        } catch ( \Exception $e ) {
            return null;
        }
    }

    /**
     * Builds `ShippingService::calculate_cost()`'s own optional
     * `$context` - same cart-weight-summed-from-Product-meta shape
     * `Shipping\Rest::build_context()` computes for the pre-order
     * `GET /shipping/methods` call, just resolved from the cart/address
     * this method already has in hand rather than a fresh REST request.
     *
     * @param object                     $cart             Cart\Domain\Cart.
     * @param array<string, mixed>|null  $shipping_address Sanitized shipping address, if given.
     * @param float                      $cart_subtotal    Cart's own subtotal, already computed by the caller.
     * @return array{shipping_address?: array<string, mixed>, cart_weight?: float, cart_subtotal?: float}
     */
    private function build_shipping_context( $cart, $shipping_address, float $cart_subtotal ): array {
        $context = array( 'cart_subtotal' => $cart_subtotal );

        if ( $shipping_address ) {
            $context['shipping_address'] = $shipping_address;
        }

        $weight = 0.0;

        foreach ( $cart->items as $cart_item ) {
            $product = $this->product_service->get_product( $cart_item->product_id );

            if ( $product && ! empty( $product->meta['weight'] ) ) {
                $weight += (float) $product->meta['weight'] * (int) $cart_item->quantity;
            }
        }

        $context['cart_weight'] = $weight;

        return $context;
    }

    /**
     * Converts a cart into a placed order: snapshots every line item
     * (title, price, currency), computes shipping/tax via the Shipping/
     * Taxes modules when active (0.0 either way when they're not -
     * checkout still works with just Cart+Order, same graceful-absence
     * rule every other optional module in this plugin follows), persists
     * the order, clears the source cart, and broadcasts `order_created`.
     *
     * @param string                     $cart_token       Opaque client-held cart identity.
     * @param string|null                $customer_email   Buyer's email, if given.
     * @param string|null                $customer_name    Buyer's display name, if given.
     * @param string|null                $customer_phone   Buyer's phone number, if given.
     * @param int|null                   $customer_user_id The WP user id placing this order, if logged in.
     * @param array<string, mixed>|null  $billing_address  Sanitized billing address, if given.
     * @param array<string, mixed>|null  $shipping_address Sanitized shipping address, if given (null = same as billing).
     * @param string|null                $shipping_method  Chosen shipping method id.
     * @param string|null                $payment_method   Chosen payment method id.
     * @param string|null                $payment_intent_id A payment intent id from `POST /payment/intent`, when the chosen gateway needed one (Payment\Application\PaymentService's own docblock explains the two charge paths).
     * @return Order
     * @throws \InvalidArgumentException If the cart doesn't exist or has no items.
     */
    public function create_from_cart(
        $cart_token,
        $customer_email = null,
        $customer_name = null,
        $customer_phone = null,
        $customer_user_id = null,
        $billing_address = null,
        $shipping_address = null,
        $shipping_method = null,
        $payment_method = null,
        $payment_intent_id = null
    ) {
        $cart = $this->cart_service->find_cart( $cart_token );

        if ( ! $cart || empty( $cart->items ) ) {
            throw new \InvalidArgumentException( 'Cart is empty or does not exist.' );
        }

        $totals = $this->cart_service->get_totals( $cart );

        $shipping_service = $this->resolve_optional_service( 'shipping_service' );
        $shipping_cost    = ( $shipping_service && $shipping_method )
            ? $shipping_service->calculate_cost( $shipping_method, $this->build_shipping_context( $cart, $shipping_address, $totals['subtotal'] ) )
            : 0.0;

        $tax_service = $this->resolve_optional_service( 'tax_service' );
        $tax         = $tax_service
            ? $tax_service->calculate_cart(
                $cart,
                $shipping_address,
                $billing_address,
                (float) $shipping_cost,
                array(
                    'cart_token'     => $cart_token,
                    'customer_email' => $customer_email,
                )
            )
            : array( 'amount' => 0.0 );
        $tax_amount  = (float) $tax['amount'];

        $payment_service        = $this->resolve_optional_service( 'payment_service' );
        $initial_payment_status = $payment_service ? $payment_service->get_initial_payment_status() : PaymentStatus::PENDING;

        $total = round( $totals['subtotal'] + $shipping_cost + $tax_amount, 2 );

        // Same `vulocart_order_total` filter, same $context shape, as
        // Review\Application\OrderReviewService::build_summary()'s own
        // preview computation - that method's own docblock explains why
        // this is filter-resolved from the checkout session rather than a
        // new parameter here.
        $total = (float) apply_filters(
            'vulocart_order_total',
            $total,
            array(
                'cart_token'    => $cart_token,
                'subtotal'      => $totals['subtotal'],
                'shipping_cost' => $shipping_cost,
                'tax_amount'    => $tax_amount,
            )
        );

        $order = new Order(
            null,
            null,
            wp_generate_uuid4(),
            $cart_token,
            $customer_email,
            $customer_name,
            $initial_payment_status,
            FulfillmentStatus::PENDING,
            $cart->currency,
            $totals['subtotal'],
            $total,
            null,
            array(),
            array(),
            null,
            null,
            $customer_phone,
            $customer_user_id,
            $billing_address,
            $shipping_address,
            $shipping_method,
            $shipping_cost,
            $tax_amount,
            $payment_method
        );

        $order = $this->repository->insert( $order );

        foreach ( $cart->items as $cart_item ) {
            $product = $this->product_service->get_product( $cart_item->product_id );

            $this->repository->insert_item(
                new OrderItem(
                    null,
                    $order->id,
                    $cart_item->product_id,
                    $product ? $product->title : '',
                    $cart_item->quantity,
                    $cart_item->unit_price,
                    $cart_item->currency,
                    $cart_item->meta
                )
            );
        }

        $this->cart_service->clear_cart( $cart_token );

        $order = $this->repository->find( $order->id );

        // Real gateway charge, now that the order (and its own id/total)
        // actually exists - see Payment\Application\PaymentService's own
        // docblock for the inline-vs-intent-first split this branches on.
        // Left at $initial_payment_status (the Payments tab's own
        // fallback default) when the Payment module isn't active at all,
        // exactly this method's pre-Payment-Framework behavior.
        if ( $payment_service && ( $payment_intent_id || $payment_method ) ) {
            $result = $payment_intent_id
                ? $payment_service->finalize_intent_for_order( $order->id, (string) $payment_intent_id )
                : $payment_service->authorize_for_order( (string) $payment_method, $order->id, $order->total, (string) $order->currency, array(
                    'customer_email' => $customer_email,
                    'customer_name'  => $customer_name,
                ) );

            if ( $result ) {
                $order->payment_status         = $result->to_order_payment_status();
                $order->gateway_transaction_id = $result->gateway_transaction_id;
                $order->authorized_amount      = $result->authorized_amount;
                $order->captured_amount        = $result->captured_amount;
                $order                         = $this->repository->update( $order );
            }
        }

        $this->events->dispatch( 'order_created', array( 'order' => $order ) );

        return $order;
    }

    /**
     * Persists an Order object whose payment-related fields
     * (`payment_status`/`gateway_transaction_id`/`authorized_amount`/
     * `captured_amount`) a caller has already mutated directly (an
     * admin-triggered capture/cancel, `Payment\Rest`'s own
     * `capture_order_payment()`/`cancel_order_payment()`) - and
     * broadcasts `order_payment_status_changed`. Kept generic (accepts
     * an already-mutated Order rather than a status string) since a
     * gateway capture can change `authorized_amount`/`captured_amount`
     * without necessarily changing `payment_status` itself (a partial
     * capture stays 'pending' until the full amount is settled).
     *
     * @param Order $order An order with already-mutated payment fields.
     * @return Order The same order, freshly re-read from storage.
     */
    public function apply_payment_result( Order $order ) {
        $order = $this->repository->update( $order );

        $this->events->dispatch( 'order_payment_status_changed', array( 'order' => $order ) );

        return $order;
    }

    /**
     * Issues a refund, going through the order's own linked payment
     * gateway first (when one exists) before recording the resulting
     * amount - the gateway-aware entrypoint `Order\Rest::refund_item()`
     * calls; refund_order() itself stays the plain "just record these
     * numbers" primitive for orders with no gateway to call (pre-Payment-
     * Framework orders, or a merchant recording an out-of-band
     * adjustment).
     *
     * @param int   $id     Order id.
     * @param float $amount Amount to refund.
     * @return Order|null Null if no order with this id exists.
     */
    public function refund_order_via_gateway( $id, $amount ) {
        $order = $this->repository->find( $id );

        if ( ! $order ) {
            return null;
        }

        $payment_service = $this->resolve_optional_service( 'payment_service' );

        if ( $payment_service && $order->payment_method ) {
            $result = $payment_service->refund_for_order( $order->payment_method, $order->gateway_transaction_id, $order->id, (float) $amount, (string) $order->currency );

            if ( $result && $result->success ) {
                $order->captured_amount = max( 0.0, $order->captured_amount - (float) $amount );
            }
        }

        $order->payment_status  = PaymentStatus::REFUNDED;
        $order->refunded_amount = ( $order->refunded_amount ? $order->refunded_amount : 0.0 ) + (float) $amount;
        $order                  = $this->repository->update( $order );

        $this->events->dispatch( 'order_payment_status_changed', array( 'order' => $order ) );
        $this->events->dispatch( 'order_refunded', array( 'order' => $order ) );

        return $order;
    }

    /**
     * Creates a draft order directly from a merchant-picked list of
     * products - no cart involved. Backs the admin grid's "Add New" page
     * (OrderAdd.tsx) and the "Draft Orders" submenu
     * (`FulfillmentStatus::DRAFT`) - an admin building an order on a
     * customer's behalf (phone/email order) before it's actually placed.
     * Same item-snapshotting shape as create_from_cart(), just sourced
     * from a plain `{product_id, quantity}[]` array instead of a Cart.
     *
     * @param array{product_id: int, quantity: int}[] $items          Products and quantities to snapshot onto the order.
     * @param string|null                              $customer_email Buyer's email, if given.
     * @param string|null                              $customer_name  Buyer's display name, if given.
     * @param string|null                              $payment_method Chosen payment method id, if this order is already paid (a recurring-billing engine's own renewal order, for instance) - left null for a genuine draft with nothing charged yet.
     * @return Order
     * @throws \InvalidArgumentException If $items is empty or references no valid product.
     */
    public function create_manual_order( array $items, $customer_email = null, $customer_name = null, $payment_method = null ) {
        if ( empty( $items ) ) {
            throw new \InvalidArgumentException( 'At least one item is required.' );
        }

        $snapshots = array();
        $subtotal  = 0.0;
        $currency  = null;

        foreach ( $items as $item ) {
            $product = $this->product_service->get_product( absint( $item['product_id'] ) );

            if ( ! $product ) {
                continue;
            }

            $quantity   = max( 1, absint( $item['quantity'] ) );
            $unit_price = null === $product->price ? 0.0 : $product->price;
            $currency   = $currency ?? $product->currency;

            $snapshots[] = array(
                'product_id' => $product->id,
                'title'       => $product->title,
                'quantity'    => $quantity,
                'unit_price'  => $unit_price,
                'currency'    => $currency,
            );

            $subtotal += $unit_price * $quantity;
        }

        if ( empty( $snapshots ) ) {
            throw new \InvalidArgumentException( 'None of the given items reference a valid product.' );
        }

        $order = new Order(
            null,
            null,
            wp_generate_uuid4(),
            null,
            $customer_email,
            $customer_name,
            PaymentStatus::PENDING,
            FulfillmentStatus::DRAFT,
            $currency,
            $subtotal,
            $subtotal,
            null,
            array(),
            array(),
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            0.0,
            0.0,
            $payment_method
        );

        $order = $this->repository->insert( $order );

        foreach ( $snapshots as $snapshot ) {
            $this->repository->insert_item(
                new OrderItem(
                    null,
                    $order->id,
                    $snapshot['product_id'],
                    $snapshot['title'],
                    $snapshot['quantity'],
                    $snapshot['unit_price'],
                    $snapshot['currency']
                )
            );
        }

        $order = $this->repository->find( $order->id );

        $this->events->dispatch( 'order_created', array( 'order' => $order ) );

        return $order;
    }

    /**
     * Transitions an order's fulfillment status and broadcasts
     * `order_fulfillment_status_changed`.
     *
     * @param int    $id     Order id.
     * @param string $status One of FulfillmentStatus's constants.
     * @return Order|null Null if no order with this id exists.
     * @throws \InvalidArgumentException If $status isn't a known FulfillmentStatus.
     */
    public function update_fulfillment_status( $id, $status ) {
        if ( ! in_array( $status, FulfillmentStatus::all(), true ) ) {
            throw new \InvalidArgumentException( 'Unknown fulfillment status.' );
        }

        $order = $this->repository->find( $id );

        if ( ! $order ) {
            return null;
        }

        $order->fulfillment_status = $status;
        $order                     = $this->repository->update( $order );

        $this->events->dispatch( 'order_fulfillment_status_changed', array( 'order' => $order ) );

        return $order;
    }

    /**
     * Fills in or corrects the details an order was placed without - contact, addresses, shipping and payment
     * method. Only the keys present in $fields change; addresses are sanitised to the stable address shape.
     *
     * @param int                  $id     Order id.
     * @param array<string, mixed> $fields Any of customer_email, customer_name, customer_phone, shipping_method,
     *                                     payment_method, shipping_address, billing_address.
     * @return Order|null Null if no order with this id exists.
     * @throws \InvalidArgumentException If the email is not a valid address.
     */
    public function update_details( $id, array $fields ) {
        $order = $this->repository->find( $id );

        if ( ! $order ) {
            return null;
        }

        if ( array_key_exists( 'customer_email', $fields ) ) {
            $email = sanitize_email( (string) $fields['customer_email'] );

            if ( '' !== (string) $fields['customer_email'] && ! is_email( $email ) ) {
                throw new \InvalidArgumentException( 'That email address is not valid.' );
            }

            $order->customer_email = '' === $email ? null : $email;
        }

        foreach ( array( 'customer_name', 'customer_phone', 'shipping_method', 'payment_method' ) as $key ) {
            if ( array_key_exists( $key, $fields ) ) {
                $value        = sanitize_text_field( (string) $fields[ $key ] );
                $order->$key = '' === $value ? null : $value;
            }
        }

        foreach ( array( 'shipping_address', 'billing_address' ) as $key ) {
            if ( array_key_exists( $key, $fields ) && is_array( $fields[ $key ] ) ) {
                $bag = array();

                foreach ( array( 'full_name', 'phone', 'address_1', 'address_2', 'city', 'state', 'postcode', 'country' ) as $field ) {
                    $bag[ $field ] = isset( $fields[ $key ][ $field ] ) ? sanitize_text_field( (string) $fields[ $key ][ $field ] ) : '';
                }

                $order->$key = $bag;
            }
        }

        return $this->repository->update( $order );
    }

    /**
     * Emails the customer a payment request and remembers when (in the order's `meta`, newest last).
     *
     * @param int $id Order id.
     * @return Order|null Null if no order with this id exists.
     * @throws \InvalidArgumentException If the order has no customer email, or is already paid.
     * @throws \RuntimeException If the mail could not be sent.
     */
    public function request_payment( $id ) {
        $order = $this->repository->find( $id );

        if ( ! $order ) {
            return null;
        }

        if ( empty( $order->customer_email ) ) {
            throw new \InvalidArgumentException( 'Add the customer\'s email address first.' );
        }

        if ( in_array( $order->payment_status, array( PaymentStatus::PAID, PaymentStatus::REFUNDED ), true ) ) {
            throw new \InvalidArgumentException( 'This order is already paid.' );
        }

        if ( ! \VuloCart\Notifications\OrderEmails::send_payment_request( $order ) ) {
            throw new \RuntimeException( 'The email could not be sent.' );
        }

        $order->meta                     = is_array( $order->meta ) ? $order->meta : array();
        $order->meta['payment_requests'] = array_slice( array_merge( (array) ( $order->meta['payment_requests'] ?? array() ), array( current_time( 'mysql' ) ) ), -10 );

        return $this->repository->update( $order );
    }

    /**
     * Replaces an order's free-form tags (kept in the order's `meta`).
     *
     * @param int      $id   Order id.
     * @param string[] $tags The tags, in order.
     * @return Order|null Null if no order with this id exists.
     */
    public function set_tags( $id, array $tags ) {
        $order = $this->repository->find( $id );

        if ( ! $order ) {
            return null;
        }

        $clean = array();

        foreach ( $tags as $tag ) {
            $tag = trim( (string) $tag );

            if ( '' !== $tag && ! in_array( $tag, $clean, true ) ) {
                $clean[] = mb_substr( $tag, 0, 40 );
            }
        }

        $order->meta         = is_array( $order->meta ) ? $order->meta : array();
        $order->meta['tags'] = array_slice( $clean, 0, 20 );

        return $this->repository->update( $order );
    }

    /**
     * Transitions an order's payment status and broadcasts
     * `order_payment_status_changed` (plus `order_refunded`, matching the
     * vision's explicit "RefundIssued" event, when the new status is
     * 'refunded'). Prefer refund_order() when transitioning to 'refunded'
     * with a specific amount - this method alone doesn't touch
     * `refunded_amount`.
     *
     * @param int    $id     Order id.
     * @param string $status One of PaymentStatus's constants.
     * @return Order|null Null if no order with this id exists.
     * @throws \InvalidArgumentException If $status isn't a known PaymentStatus.
     */
    public function update_payment_status( $id, $status ) {
        if ( ! in_array( $status, PaymentStatus::all(), true ) ) {
            throw new \InvalidArgumentException( 'Unknown payment status.' );
        }

        $order = $this->repository->find( $id );

        if ( ! $order ) {
            return null;
        }

        $order->payment_status = $status;
        $order                 = $this->repository->update( $order );

        $this->events->dispatch( 'order_payment_status_changed', array( 'order' => $order ) );

        if ( PaymentStatus::REFUNDED === $status ) {
            $this->events->dispatch( 'order_refunded', array( 'order' => $order ) );
        }

        return $order;
    }

    /**
     * Issues a refund: sets payment_status to 'refunded' and records the
     * refunded amount (partial or full - not validated against $total
     * here, since a merchant may legitimately record a refund alongside a
     * restocking fee or other adjustment that changes the effective
     * amount).
     *
     * @param int   $id     Order id.
     * @param float $amount Amount refunded.
     * @return Order|null Null if no order with this id exists.
     */
    public function refund_order( $id, $amount ) {
        $order = $this->repository->find( $id );

        if ( ! $order ) {
            return null;
        }

        $order->payment_status  = PaymentStatus::REFUNDED;
        $order->refunded_amount = (float) $amount;
        $order                  = $this->repository->update( $order );

        $this->events->dispatch( 'order_payment_status_changed', array( 'order' => $order ) );
        $this->events->dispatch( 'order_refunded', array( 'order' => $order ) );

        return $order;
    }

    /**
     * Transitions many orders to the same new fulfillment status in one
     * call - backs the admin grid's bulk-action dropdown (OrdersList.tsx).
     * Reuses update_fulfillment_status() per id, same reasoning
     * update_status() used to document: every transition goes through the
     * exact same single-order code path regardless of how it was
     * triggered.
     *
     * @param int[]  $ids    Order ids to transition.
     * @param string $status One of FulfillmentStatus's constants.
     * @return int Number of orders actually found and updated.
     * @throws \InvalidArgumentException If $status isn't a known FulfillmentStatus.
     */
    public function bulk_update_fulfillment_status( array $ids, string $status ): int {
        if ( ! in_array( $status, FulfillmentStatus::all(), true ) ) {
            throw new \InvalidArgumentException( 'Unknown fulfillment status.' );
        }

        $updated = 0;

        foreach ( $ids as $id ) {
            if ( $this->update_fulfillment_status( (int) $id, $status ) ) {
                ++$updated;
            }
        }

        return $updated;
    }

    /**
     * Transitions many orders to the same new payment status in one call -
     * same reasoning as bulk_update_fulfillment_status().
     *
     * @param int[]  $ids    Order ids to transition.
     * @param string $status One of PaymentStatus's constants.
     * @return int Number of orders actually found and updated.
     * @throws \InvalidArgumentException If $status isn't a known PaymentStatus.
     */
    public function bulk_update_payment_status( array $ids, string $status ): int {
        if ( ! in_array( $status, PaymentStatus::all(), true ) ) {
            throw new \InvalidArgumentException( 'Unknown payment status.' );
        }

        $updated = 0;

        foreach ( $ids as $id ) {
            if ( $this->update_payment_status( (int) $id, $status ) ) {
                ++$updated;
            }
        }

        return $updated;
    }

    /**
     * Permanently deletes an order and its line items. `order_deleted` is broadcast with the order as it was, so
     * the customer's totals are recounted and any module keeping its own rows for the order can tidy up.
     *
     * @param int $id Order id.
     * @return bool True if the order existed and was deleted.
     */
    public function delete_order( $id ): bool {
        $order = $this->repository->find( (int) $id );

        if ( ! $order || ! $this->repository->delete( (int) $id ) ) {
            return false;
        }

        $this->events->dispatch( 'order_deleted', array( 'order' => $order ) );

        return true;
    }

    /**
     * Deletes many orders through the same single-order path.
     *
     * @param int[] $ids Order ids.
     * @return int Number of orders actually deleted.
     */
    public function bulk_delete( array $ids ): int {
        $deleted = 0;

        foreach ( $ids as $id ) {
            if ( $this->delete_order( (int) $id ) ) {
                ++$deleted;
            }
        }

        return $deleted;
    }
}
