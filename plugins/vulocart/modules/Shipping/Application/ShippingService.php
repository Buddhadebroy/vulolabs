<?php
/**
 * ShippingService class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Shipping\Application;

use VuloCart\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Shipping module ShippingService.
 *
 * The free tier's own lightweight shipping engine: one marketplace-wide
 * flat rate (the Shipping tab's `flat_rate_shipping_cost`), not zones or
 * per-offering carrier rates. `get_available_methods()` always returns at
 * least one method (a store with shipping "disabled" still ships for
 * free, rather than leaving checkout with no shipping option to select at
 * all) — `enable_shipping` toggles which method that is, not whether
 * shipping is offered.
 *
 * `$context` (`shipping_address`/`cart_weight`/`cart_subtotal`, all
 * optional) exists purely so `vulocart_shipping_methods` has something to
 * compute zone/weight-based rates from — this class itself never reads
 * it. `vulocart-pro`'s own ShippingEngine module is what actually adds
 * zone-matched rates here (same `vulocart_payment_gateways`-style "Free
 * defines the extension point, Pro fills it in" split
 * `Payment\Application\GatewayRegistry`'s own docblock establishes), so a
 * store with that module active still shows the flat rate/free-shipping
 * fallback alongside any zone rates that match — this method never stops
 * returning at least one method.
 *
 * @class       ShippingService class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ShippingService {

    /**
     * Reads the stored settings option, defaults filled in — same small
     * local copy every non-REST class in this codebase uses rather than
     * reaching into a REST controller's private method (Notifications\
     * OrderEmails::get_settings()'s own docblock explains why).
     *
     * @return array Stored settings, defaults filled in for any never-saved key.
     */
    private function get_settings(): array {
        return wp_parse_args( get_option( Utill::SETTINGS_KEY, array() ), Utill::SETTINGS_DEFAULTS );
    }

    /**
     * Every shipping method currently offered, with its cost.
     *
     * @param array{shipping_address?: array<string, mixed>|null, cart_weight?: float, cart_subtotal?: float} $context Optional — zone/weight-based rate inputs, unused by this class itself (see class docblock).
     * @return array<int, array{id: string, label: string, cost: float}>
     */
    public function get_available_methods( array $context = array() ): array {
        $settings = $this->get_settings();

        if ( empty( $settings['enable_shipping'] ) ) {
            $methods = array(
                array(
                    'id'    => 'free',
                    'label' => __( 'Free shipping', 'vulocart' ),
                    'cost'  => 0.0,
                ),
            );
        } else {
            $methods = array(
                array(
                    'id'    => 'flat_rate',
                    'label' => __( 'Flat rate', 'vulocart' ),
                    'cost'  => (float) $settings['flat_rate_shipping_cost'],
                ),
            );
        }

        /**
         * Lets vulocart-pro's own ShippingEngine module add zone/weight-
         * matched (and, where a carrier is registered, live-quoted) rates
         * alongside the flat-rate/free fallback above — see this class's
         * own docblock.
         *
         * @param array<int, array{id: string, label: string, cost: float}> $methods Methods registered so far.
         * @param array<string, mixed>                                      $context Optional zone/weight-based rate inputs.
         */
        return apply_filters( 'vulocart_shipping_methods', $methods, $context );
    }

    /**
     * Resolves a chosen method id to its cost — 0.0 for an unrecognized
     * id rather than throwing, since this runs server-side at
     * order-creation time and an order shouldn't fail to place over a
     * stale/unknown method id (Order\Application\OrderService's own
     * "checkout still works" graceful-degradation rule).
     *
     * @param string                $method_id A `get_available_methods()` id.
     * @param array<string, mixed>  $context   Optional zone/weight-based rate inputs, passed through to `get_available_methods()`.
     * @return float
     */
    public function calculate_cost( string $method_id, array $context = array() ): float {
        foreach ( $this->get_available_methods( $context ) as $method ) {
            if ( $method['id'] === $method_id ) {
                return $method['cost'];
            }
        }

        return 0.0;
    }
}
