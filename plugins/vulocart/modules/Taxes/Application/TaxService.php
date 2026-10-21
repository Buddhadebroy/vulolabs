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
 * Works out the tax on a cart the way current stores do it: by where the order is going and what each product is,
 * not one rate for everything.
 *
 * - **Destination.** Rates are matched on country, state and postcode, taken from the shipping address, the billing
 *   address or the store's own address (Settings → Tax → "Calculate tax based on").
 * - **Tax classes.** Each product is taxable or not, and belongs to a class (standard, reduced, zero, or your own);
 *   a class has its own rates.
 * - **Stacked taxes.** Within one priority the most specific matching rate wins; every priority that matches adds its
 *   rate, so a federal tax and a regional one can both apply (India's CGST + SGST, Canada's GST + PST).
 * - **Shipping.** Optionally taxed, with the standard class's rates that are marked for shipping.
 * - **Inclusive prices.** When prices already include tax, the tax is backed out of the price for display and nothing
 *   is added on top.
 * - **No rates yet.** A store that has not entered any rates keeps the old behaviour: one flat rate
 *   (`default_tax_rate_percent`) on everything, so upgrading changes nothing until rates are added.
 * - **Providers and exemptions.** `vulocart_tax_calculation` lets a provider (vulocart-pro's Stripe Tax) return the
 *   whole result; `vulocart_tax_exempt` lets a module (tax-ID / reverse charge) zero the tax for a buyer.
 *
 * @class       TaxService class
 * @version     2.0.0
 * @author      VuloLabs
 */
class TaxService {

    /**
     * Rates and classes.
     *
     * @var RateRepository
     */
    private $rates;

    /**
     * TaxService constructor.
     *
     * @param RateRepository $rates Rates and classes.
     */
    public function __construct( RateRepository $rates ) {
        $this->rates = $rates;
    }

    /**
     * The rates and classes store.
     *
     * @return RateRepository
     */
    public function rates(): RateRepository {
        return $this->rates;
    }

    /**
     * Reads the stored settings option, defaults filled in.
     *
     * @return array Stored settings, defaults filled in for any never-saved key.
     */
    private function get_settings(): array {
        return wp_parse_args( get_option( Utill::SETTINGS_KEY, array() ), Utill::SETTINGS_DEFAULTS );
    }

    /**
     * Whether tax is being charged: any rate entered, or a flat fallback rate above 0.
     *
     * @return bool
     */
    public function is_enabled(): bool {
        return $this->rates->count() > 0 || $this->get_rate_percent() > 0;
    }

    /**
     * The flat fallback rate, as a percentage (e.g. `10.0` for 10%).
     *
     * @return float
     */
    public function get_rate_percent(): float {
        return (float) $this->get_settings()['default_tax_rate_percent'];
    }

    /**
     * Whether product prices already include tax.
     *
     * @return bool
     */
    public function prices_include_tax(): bool {
        return ! empty( $this->get_settings()['prices_include_tax'] );
    }

    /**
     * Tax on a plain amount at the flat fallback rate. Kept for callers that only have a subtotal; carts should use
     * `calculate_cart()`, which knows where the order is going.
     *
     * @param float $taxable_amount The amount tax is calculated against.
     * @return float
     */
    public function calculate( float $taxable_amount ): float {
        if ( $this->get_rate_percent() <= 0 || $this->prices_include_tax() ) {
            return 0.0;
        }

        return round( $taxable_amount * ( $this->get_rate_percent() / 100 ), 2 );
    }

    /**
     * Where the tax should be worked out for: the shipping or billing address (per the setting), or the store's own.
     *
     * @param array<string, mixed>|null $shipping_address Shipping address, if any.
     * @param array<string, mixed>|null $billing_address  Billing address, if any.
     * @return array{country: string, state: string, postcode: string}
     */
    public function destination( $shipping_address, $billing_address ): array {
        $settings = $this->get_settings();
        $based_on = (string) $settings['tax_based_on'];
        $address  = 'billing' === $based_on ? $billing_address : $shipping_address;

        // An unset shipping address means "same as billing", and vice versa.
        if ( ! is_array( $address ) || empty( $address['country'] ) ) {
            $address = is_array( $shipping_address ) && ! empty( $shipping_address['country'] ) ? $shipping_address : $billing_address;
        }

        if ( 'store' === $based_on || ! is_array( $address ) || empty( $address['country'] ) ) {
            $address = array(
                'country' => (string) $settings['store_country'],
                'state'   => (string) $settings['store_state'],
            );
        }

        return array(
            'country'  => strtoupper( (string) ( $address['country'] ?? '' ) ),
            'state'    => strtoupper( (string) ( $address['state'] ?? '' ) ),
            'postcode' => strtoupper( trim( (string) ( $address['postcode'] ?? '' ) ) ),
        );
    }

    /**
     * Tax for a cart.
     *
     * @param object                    $cart             The cart (with `items`, each `product_id`/`unit_price`/`quantity`).
     * @param array<string, mixed>|null $shipping_address Shipping address, if any.
     * @param array<string, mixed>|null $billing_address  Billing address, if any.
     * @param float                     $shipping_cost    Shipping charged on the order.
     * @param array<string, mixed>      $extra            Anything a provider or exemption handler may want (cart token, customer email).
     * @return array{amount: float, included: float, inclusive: bool, lines: array<int, array{name: string, rate: float, amount: float}>, source: string}
     */
    public function calculate_cart( $cart, $shipping_address = null, $billing_address = null, float $shipping_cost = 0.0, array $extra = array() ): array {
        $destination = $this->destination( $shipping_address, $billing_address );
        $inclusive   = $this->prices_include_tax();
        $items       = array();

        foreach ( (array) ( $cart->items ?? array() ) as $item ) {
            $meta    = $this->product_tax_meta( (int) $item->product_id );
            $items[] = array(
                'product_id' => (int) $item->product_id,
                'amount'     => round( (float) $item->unit_price * (int) $item->quantity, 2 ),
                'taxable'    => 'none' !== $meta['status'],
                'tax_class'  => $meta['class'],
                'tax_code'   => $meta['code'],
            );
        }

        $context = array(
            'items'            => $items,
            'shipping_cost'    => $shipping_cost,
            'destination'      => $destination,
            'inclusive'        => $inclusive,
            'currency'         => (string) ( $cart->currency ?? '' ),
            'shipping_address' => $shipping_address,
            'billing_address'  => $billing_address,
            'extra'            => $extra,
        );

        /**
         * Lets a tax provider (vulocart-pro's Stripe Tax) supply the whole result. Return null to use the built-in rates.
         *
         * @param array|null $result  Same shape `calculate_cart()` returns, or null.
         * @param array      $context Items (with tax class), shipping cost, destination, addresses, `extra`.
         */
        $provided = apply_filters( 'vulocart_tax_calculation', null, $context );

        if ( is_array( $provided ) && isset( $provided['amount'] ) ) {
            return $provided + array(
                'included'  => 0.0,
                'inclusive' => $inclusive,
                'lines'     => array(),
                'source'    => 'provider',
            );
        }

        /**
         * Lets a module (a tax-ID / reverse-charge handler) make this order tax-free.
         *
         * @param bool  $exempt  Whether the buyer is exempt.
         * @param array $context Same context as `vulocart_tax_calculation`.
         */
        if ( apply_filters( 'vulocart_tax_exempt', false, $context ) ) {
            return $this->result( array(), $inclusive, 'exempt' );
        }

        return $this->from_rates( $context );
    }

    /**
     * The built-in calculation: rates (or the flat fallback) applied per line and to shipping.
     *
     * @param array<string, mixed> $context Calculation context.
     * @return array
     */
    private function from_rates( array $context ): array {
        $settings  = $this->get_settings();
        $inclusive = (bool) $context['inclusive'];
        $has_rates = $this->rates->count() > 0;
        // Shipping is only taxed once real rates exist, so a store on the old flat rate keeps its old totals.
        $tax_ship = $has_rates && ! empty( $settings['tax_shipping'] );
        $amounts  = array(); // "name|rate" => tax amount.
        $labels   = array();

        foreach ( $context['items'] as $line ) {
            if ( ! $line['taxable'] || $line['amount'] <= 0 ) {
                continue;
            }

            $matched = $has_rates ? $this->match( (string) $line['tax_class'], $context['destination'], false ) : $this->flat_rate();

            $this->accumulate( $amounts, $labels, $matched, (float) $line['amount'], $inclusive );
        }

        if ( $tax_ship && $context['shipping_cost'] > 0 ) {
            $matched = $has_rates ? $this->match( 'standard', $context['destination'], true ) : $this->flat_rate();

            $this->accumulate( $amounts, $labels, $matched, (float) $context['shipping_cost'], $inclusive );
        }

        $lines = array();

        foreach ( $amounts as $key => $amount ) {
            $lines[] = array(
                'name'   => $labels[ $key ]['name'],
                'rate'   => $labels[ $key ]['rate'],
                'amount' => round( $amount, 2 ),
            );
        }

        return $this->result( $lines, $inclusive, $has_rates ? 'rates' : 'flat' );
    }

    /**
     * The flat fallback as a one-rate match.
     *
     * @return array<int, array{name: string, rate: float}>
     */
    private function flat_rate(): array {
        $rate = $this->get_rate_percent();

        return $rate > 0 ? array(
			array(
				'name' => __( 'Tax', 'vulocart' ),
				'rate' => $rate,
			),
		) : array();
    }

    /**
     * Adds one amount's tax, for each matched rate, to the running totals.
     *
     * @param array             $amounts   Running tax per rate.
     * @param array             $labels    Name and rate per key.
     * @param array<int, array> $matched   Matched rates.
     * @param float             $amount    The line (or shipping) amount.
     * @param bool              $inclusive Whether the amount already includes tax.
     * @return void
     */
    private function accumulate( array &$amounts, array &$labels, array $matched, float $amount, bool $inclusive ): void {
        $total_rate = array_sum( array_column( $matched, 'rate' ) );

        foreach ( $matched as $rate ) {
            $key = $rate['name'] . '|' . $rate['rate'];

            // Inclusive: the share of the price that is tax, split across the matched rates by their size.
            $tax = $inclusive
                ? ( $total_rate > 0 ? ( $amount - $amount / ( 1 + $total_rate / 100 ) ) * ( $rate['rate'] / $total_rate ) : 0.0 )
                : $amount * $rate['rate'] / 100;

            $amounts[ $key ] = ( $amounts[ $key ] ?? 0.0 ) + $tax;
            $labels[ $key ]  = array(
                'name' => $rate['name'],
                'rate' => (float) $rate['rate'],
            );
        }
    }

    /**
     * Rates that apply to a class at a destination: per priority, the most specific match; all priorities stack.
     *
     * @param string                $tax_class   Class slug.
     * @param array<string, string> $destination Country, state, postcode.
     * @param bool                  $for_shipping Only rates marked for shipping.
     * @return array<int, array{name: string, rate: float}>
     */
    public function match( string $tax_class, array $destination, bool $for_shipping ): array {
        $class   = isset( $this->rates->classes()[ $tax_class ] ) ? $tax_class : 'standard';
        $by_prio = array();

        foreach ( $this->rates->all( $class ) as $rate ) {
            if ( $for_shipping && ! $rate['shipping'] ) {
                continue;
            }

            if ( '' !== $rate['country'] && $rate['country'] !== $destination['country'] ) {
                continue;
            }

            if ( '' !== $rate['state'] && $rate['state'] !== $destination['state'] ) {
                continue;
            }

            if ( '' !== $rate['postcode'] && ! $this->postcode_matches( $rate['postcode'], $destination['postcode'] ) ) {
                continue;
            }

            $specificity = ( '' !== $rate['country'] ? 1 : 0 ) + ( '' !== $rate['state'] ? 2 : 0 ) + ( '' !== $rate['postcode'] ? 4 : 0 );

            if ( ! isset( $by_prio[ $rate['priority'] ] ) || $specificity > $by_prio[ $rate['priority'] ]['specificity'] ) {
                $by_prio[ $rate['priority'] ] = array(
                    'specificity' => $specificity,
                    'name'        => '' !== $rate['name'] ? $rate['name'] : __( 'Tax', 'vulocart' ),
                    'rate'        => (float) $rate['rate'],
                );
            }
        }

        ksort( $by_prio );

        return array_values(
            array_map(
                static fn( $m ) => array(
					'name' => $m['name'],
					'rate' => $m['rate'],
                ),
                $by_prio
            )
        );
    }

    /**
     * Whether a postcode matches a rate's postcode field: a comma- or semicolon-separated list of exact codes,
     * wildcards (`SW1*`) and numeric ranges (`2000...3000`).
     *
     * @param string $pattern  The rate's postcode field.
     * @param string $postcode The destination postcode.
     * @return bool
     */
    public function postcode_matches( string $pattern, string $postcode ): bool {
        $postcode = strtoupper( str_replace( ' ', '', $postcode ) );

        if ( '' === $postcode ) {
            return false;
        }

        foreach ( preg_split( '/[,;]/', strtoupper( $pattern ) ) as $part ) {
            $part = str_replace( ' ', '', $part );

            if ( '' === $part ) {
                continue;
            }

            if ( false !== strpos( $part, '...' ) ) {
                list( $from, $to ) = array_pad( explode( '...', $part, 2 ), 2, '' );

                if ( is_numeric( $from ) && is_numeric( $to ) && is_numeric( $postcode ) && (float) $postcode >= (float) $from && (float) $postcode <= (float) $to ) {
                    return true;
                }

                continue;
            }

            if ( false !== strpos( $part, '*' ) ) {
                $regex = '/^' . str_replace( '\*', '.*', preg_quote( $part, '/' ) ) . '$/';

                if ( preg_match( $regex, $postcode ) ) {
                    return true;
                }

                continue;
            }

            if ( $part === $postcode ) {
                return true;
            }
        }

        return false;
    }

    /**
     * A product's tax status and class.
     *
     * @param int $product_id Product id.
     * @return array{status: string, class: string, code: string}
     */
    private function product_tax_meta( int $product_id ): array {
        $product = function_exists( 'VuloCart' ) && isset( VuloCart()->product_service ) ? VuloCart()->product_service->get_product( $product_id ) : null;
        $meta    = $product && is_array( $product->meta ) ? $product->meta : array();

        return array(
            'status' => isset( $meta['tax_status'] ) && 'none' === $meta['tax_status'] ? 'none' : 'taxable',
            'class'  => isset( $meta['tax_class'] ) && '' !== $meta['tax_class'] ? (string) $meta['tax_class'] : 'standard',
            'code'   => isset( $meta['tax_code'] ) ? (string) $meta['tax_code'] : '',
        );
    }

    /**
     * The result shape: what is added to the total, what is already included, and the per-tax lines.
     *
     * @param array<int, array{name: string, rate: float, amount: float}> $lines     Tax lines.
     * @param bool                                                        $inclusive Whether prices include tax.
     * @param string                                                      $source    Where the numbers came from.
     * @return array{amount: float, included: float, inclusive: bool, lines: array, source: string}
     */
    private function result( array $lines, bool $inclusive, string $source ): array {
        $sum = round( array_sum( array_column( $lines, 'amount' ) ), 2 );

        return array(
            'amount'    => $inclusive ? 0.0 : $sum,
            'included'  => $inclusive ? $sum : 0.0,
            'inclusive' => $inclusive,
            'lines'     => $lines,
            'source'    => $source,
        );
    }
}
