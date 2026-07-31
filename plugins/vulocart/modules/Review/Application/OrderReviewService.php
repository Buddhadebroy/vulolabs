<?php
/**
 * OrderReviewService class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Review\Application;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Review module OrderReviewService.
 *
 * Recomputes exactly what `Order\Application\OrderService::
 * create_from_cart()` would charge — same subtotal-from-cart, same
 * Shipping/Taxes cost resolution — without persisting anything, so the
 * checkout wizard's Review step shows the real final total before the
 * buyer commits. Depends on the Cart module (a review with no cart makes
 * no sense) the same hard-dependency way Order\Module depends on Cart,
 * but resolved defensively here rather than via `is_compatible()`, since
 * this module has no Install.php/table-creation timing constraint forcing
 * an eager check.
 *
 * @class       OrderReviewService class
 * @version     1.0.0
 * @author      VuloLabs
 */
class OrderReviewService {

    /**
     * Resolves an optional sibling module's own service off the main
     * plugin container — same pattern Order\Application\OrderService::
     * resolve_optional_service() uses.
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
     * Builds a full order preview for a cart plus in-progress checkout
     * selections — everything the wizard's Review step needs to render,
     * matching `Order\Rest`'s own response shape closely enough that the
     * UI can reuse most of its rendering.
     *
     * @param string                    $cart_token       Opaque client-held cart identity.
     * @param array<string, mixed>|null $billing_address  Sanitized billing address, if given.
     * @param array<string, mixed>|null $shipping_address Sanitized shipping address, if given.
     * @param string|null               $shipping_method  Chosen shipping method id.
     * @param string|null               $payment_method   Chosen payment method id.
     * @return array<string, mixed>
     * @throws \InvalidArgumentException If the Cart module isn't active, or the cart doesn't exist/is empty.
     */
    public function build_summary(
        string $cart_token,
        $billing_address = null,
        $shipping_address = null,
        $shipping_method = null,
        $payment_method = null
    ): array {
        $cart_service = $this->resolve_optional_service( 'cart_service' );

        if ( ! $cart_service ) {
            throw new \InvalidArgumentException( 'The Cart module is not active.' );
        }

        $cart = $cart_service->find_cart( $cart_token );

        if ( ! $cart || empty( $cart->items ) ) {
            throw new \InvalidArgumentException( 'Cart is empty or does not exist.' );
        }

        $totals = $cart_service->get_totals( $cart );

        $shipping_service = $this->resolve_optional_service( 'shipping_service' );
        $shipping_cost    = ( $shipping_service && $shipping_method ) ? $shipping_service->calculate_cost( $shipping_method ) : 0.0;

        $tax_service = $this->resolve_optional_service( 'tax_service' );
        $tax_amount  = $tax_service ? $tax_service->calculate( $totals['subtotal'] ) : 0.0;

        $payment_service = $this->resolve_optional_service( 'payment_service' );
        $payment_status  = $payment_service ? $payment_service->get_initial_payment_status() : 'pending';

        $offering_service = VuloCart()->offering_service;

        $items = array();

        foreach ( $cart->items as $item ) {
            $offering = $offering_service->get_offering( $item->offering_id );

            $items[] = array(
                'offering_id' => $item->offering_id,
                'title'       => $offering ? $offering->title : '',
                'quantity'    => $item->quantity,
                'unit_price'  => $item->unit_price,
                'currency'    => $item->currency,
                'subtotal'    => round( $item->unit_price * $item->quantity, 2 ),
            );
        }

        $total = round( $totals['subtotal'] + $shipping_cost + $tax_amount, 2 );

        /**
         * `vulocart_order_total` — the one place a cart's final total gets
         * computed, shared by this preview and Order\Application\
         * OrderService::create_from_cart()'s own real computation (same
         * filter, same $context shape, called from both places so a
         * discount always matches between what Review showed and what the
         * order actually charges). vulocart-pro's Coupons/Gift Cards
         * modules hook this — the applied code itself isn't a parameter
         * here; a handler resolves it from the checkout session's own
         * `meta` (`VuloCart()->checkout_service->get_session( $cart_token )`,
         * set via `PATCH /checkout/sessions/{token}` when the shopper
         * applies a code) rather than this method's signature growing a
         * `$coupon_code` parameter Free itself has no concept of.
         *
         * @param float                                                                            $total   Pre-discount total.
         * @param array{cart_token: string, subtotal: float, shipping_cost: float, tax_amount: float} $context
         */
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

        return array(
            'currency'               => $cart->currency,
            'items'                  => $items,
            'billing_address'        => $billing_address,
            'shipping_address'       => $shipping_address,
            'shipping_method'        => $shipping_method,
            'shipping_cost'          => $shipping_cost,
            'payment_method'         => $payment_method,
            'initial_payment_status' => $payment_status,
            'subtotal'               => $totals['subtotal'],
            'tax_amount'             => $tax_amount,
            'total'                  => $total,
        );
    }
}
