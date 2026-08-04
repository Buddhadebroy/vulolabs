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
 * order). Optional `cart_token`/`country`/`state` query params resolve a
 * `$context` (cart weight, summed from each line item's own Offering
 * `meta.weight`, plus the shipping address) purely so
 * `vulocart_shipping_methods` (ShippingService's own docblock) has
 * something to match a zone/weight rate against — this controller has no
 * opinion on what that filter does with it.
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
    public function get_methods( $request ) {
        return rest_ensure_response( VuloCart()->shipping_service->get_available_methods( $this->build_context( $request ) ) );
    }

    /**
     * Resolves `get_methods()`'s own optional `$context` — see this
     * class's own docblock. Silently omits `shipping_address`/
     * `cart_weight` when the caller doesn't supply enough to resolve
     * them (an early checkout step, before a cart token or address is
     * known yet) rather than erroring — `get_available_methods()` and
     * everything hooked into `vulocart_shipping_methods` already treat a
     * missing context key as "can't match a zone/weight rate, fall back
     * to flat rate."
     *
     * @param \WP_REST_Request $request Full request object.
     * @return array{shipping_address?: array<string, mixed>, cart_weight?: float, cart_subtotal?: float}
     */
    private function build_context( $request ): array {
        $context = array();

        $country = $request->get_param( 'country' );

        if ( $country ) {
            $context['shipping_address'] = array(
                'country' => sanitize_text_field( (string) $country ),
                'state'   => $request->get_param( 'state' ) ? sanitize_text_field( (string) $request->get_param( 'state' ) ) : null,
            );
        }

        $cart_token = $request->get_param( 'cart_token' );

        if ( $cart_token ) {
            $cart = VuloCart()->cart_service->find_cart( sanitize_text_field( (string) $cart_token ) );

            if ( $cart && ! empty( $cart->items ) ) {
                $weight   = 0.0;
                $subtotal = 0.0;

                foreach ( $cart->items as $item ) {
                    $offering = VuloCart()->offering_service->get_offering( $item->offering_id );
                    $subtotal += (float) $item->unit_price * (int) $item->quantity;

                    if ( $offering && ! empty( $offering->meta['weight'] ) ) {
                        $weight += (float) $offering->meta['weight'] * (int) $item->quantity;
                    }
                }

                $context['cart_weight']   = $weight;
                $context['cart_subtotal'] = $subtotal;
            }
        }

        return $context;
    }
}
