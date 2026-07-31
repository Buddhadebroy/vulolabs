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
 * The vision's lightweight-first shipping engine: one marketplace-wide
 * flat rate (the Shipping tab's `flat_rate_shipping_cost`), not zones or
 * per-offering carrier rates. `get_available_methods()` always returns at
 * least one method (a store with shipping "disabled" still ships for
 * free, rather than leaving checkout with no shipping option to select at
 * all) — `enable_shipping` toggles which method that is, not whether
 * shipping is offered.
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
     * @return array<int, array{id: string, label: string, cost: float}>
     */
    public function get_available_methods(): array {
        $settings = $this->get_settings();

        if ( empty( $settings['enable_shipping'] ) ) {
            return array(
                array(
                    'id'    => 'free',
                    'label' => __( 'Free shipping', 'vulocart' ),
                    'cost'  => 0.0,
                ),
            );
        }

        return array(
            array(
                'id'    => 'flat_rate',
                'label' => __( 'Flat rate', 'vulocart' ),
                'cost'  => (float) $settings['flat_rate_shipping_cost'],
            ),
        );
    }

    /**
     * Resolves a chosen method id to its cost — 0.0 for an unrecognized
     * id rather than throwing, since this runs server-side at
     * order-creation time and an order shouldn't fail to place over a
     * stale/unknown method id (Order\Application\OrderService's own
     * "checkout still works" graceful-degradation rule).
     *
     * @param string $method_id A `get_available_methods()` id.
     * @return float
     */
    public function calculate_cost( string $method_id ): float {
        foreach ( $this->get_available_methods() as $method ) {
            if ( $method['id'] === $method_id ) {
                return $method['cost'];
            }
        }

        return 0.0;
    }
}
