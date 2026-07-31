<?php
/**
 * TaxService class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Taxes\Application;

use VuloCart\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Taxes module TaxService.
 *
 * The vision's lightweight-first tax engine: one flat marketplace-wide
 * rate (the Taxes tab's `default_tax_rate_percent`), not per-region tax
 * rules. When `prices_include_tax` is on, offering prices are treated as
 * already tax-inclusive — calculate() then adds nothing further on top,
 * since re-adding tax on an already-tax-inclusive price would double-charge
 * the buyer; a future receipt/invoice feature is where the *included*
 * portion would be broken out for display, not this method.
 *
 * @class       TaxService class
 * @version     1.0.0
 * @author      VuloLabs
 */
class TaxService {

    /**
     * Reads the stored settings option, defaults filled in.
     *
     * @return array Stored settings, defaults filled in for any never-saved key.
     */
    private function get_settings(): array {
        return wp_parse_args( get_option( Utill::SETTINGS_KEY, array() ), Utill::SETTINGS_DEFAULTS );
    }

    /**
     * Whether tax calculation is currently enabled.
     *
     * @return bool
     */
    public function is_enabled(): bool {
        return ! empty( $this->get_settings()['enable_tax_calculation'] );
    }

    /**
     * The flat tax rate currently configured, as a percentage (e.g. `10.0`
     * for 10%).
     *
     * @return float
     */
    public function get_rate_percent(): float {
        return (float) $this->get_settings()['default_tax_rate_percent'];
    }

    /**
     * Whether offering prices already include tax.
     *
     * @return bool
     */
    public function prices_include_tax(): bool {
        return ! empty( $this->get_settings()['prices_include_tax'] );
    }

    /**
     * Computes the tax amount to add on top of a taxable amount (a cart's
     * subtotal, e.g.) — 0.0 when tax calculation is disabled, or when
     * prices already include tax (see class docblock).
     *
     * @param float $taxable_amount The amount tax is calculated against.
     * @return float
     */
    public function calculate( float $taxable_amount ): float {
        if ( ! $this->is_enabled() || $this->prices_include_tax() ) {
            return 0.0;
        }

        return round( $taxable_amount * ( $this->get_rate_percent() / 100 ), 2 );
    }
}
