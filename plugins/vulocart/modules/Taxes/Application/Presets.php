<?php
/**
 * Presets class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Taxes\Application;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Taxes module Presets: ready-made rate sets, so a store does not type 27 EU rates by hand.
 *
 * These are starting points on the standard class, not tax advice: rates change, reduced rates and thresholds
 * differ, and the merchant is responsible for what they charge. Applying one replaces the standard-class rates.
 *
 * @class       Presets class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Presets {

    /**
     * EU member states' standard VAT rates (percent), by ISO country code.
     *
     * @var array<string, float>
     */
    const EU_VAT = array(
        'AT' => 20,
		'BE' => 21,
		'BG' => 20,
		'HR' => 25,
		'CY' => 19,
		'CZ' => 21,
		'DK' => 25,
		'EE' => 24,
		'FI' => 25.5,
        'FR' => 20,
		'DE' => 19,
		'GR' => 24,
		'HU' => 27,
		'IE' => 23,
		'IT' => 22,
		'LV' => 21,
		'LT' => 21,
		'LU' => 17,
        'MT' => 18,
		'NL' => 21,
		'PL' => 23,
		'PT' => 23,
		'RO' => 21,
		'SK' => 23,
		'SI' => 22,
		'ES' => 21,
		'SE' => 25,
    );

    /**
     * Presets the settings screen offers: id => label and what it asks for.
     *
     * @return array<int, array{id: string, label: string, note: string, needs_state?: bool}>
     */
    public function available(): array {
        return array(
            array(
                'id'    => 'eu-vat',
                'label' => __( 'EU VAT (27 countries)', 'vulocart' ),
                'note'  => __( 'Standard VAT rate for every EU member state, charged at the buyer\'s country rate.', 'vulocart' ),
            ),
            array(
                'id'    => 'gb-vat',
                'label' => __( 'United Kingdom VAT', 'vulocart' ),
                'note'  => __( '20% standard rate.', 'vulocart' ),
            ),
            array(
                'id'          => 'in-gst',
                'label'       => __( 'India GST', 'vulocart' ),
                'note'        => __( 'CGST + SGST inside your state, IGST everywhere else in India. Pick your state and the GST slab.', 'vulocart' ),
                'needs_state' => true,
            ),
            array(
                'id'    => 'au-gst',
                'label' => __( 'Australia GST', 'vulocart' ),
                'note'  => __( '10%.', 'vulocart' ),
            ),
            array(
                'id'    => 'nz-gst',
                'label' => __( 'New Zealand GST', 'vulocart' ),
                'note'  => __( '15%.', 'vulocart' ),
            ),
            array(
                'id'    => 'sg-gst',
                'label' => __( 'Singapore GST', 'vulocart' ),
                'note'  => __( '9%.', 'vulocart' ),
            ),
            array(
                'id'    => 'ca-gst',
                'label' => __( 'Canada GST (federal only)', 'vulocart' ),
                'note'  => __( '5% GST. Add provincial PST / HST rows yourself.', 'vulocart' ),
            ),
        );
    }

    /**
     * The rows a preset makes.
     *
     * @param string $id    Preset id.
     * @param string $state Seller's state code (India GST).
     * @param float  $slab  GST slab percent (India GST).
     * @return array<int, array<string, mixed>>|null Null for an unknown preset.
     */
    public function rows( string $id, string $state = '', float $slab = 18.0 ): ?array {
        $row = static fn( $country, $rate, $name, $state = '', $priority = 1 ) => array(
            'tax_class' => 'standard',
            'country'   => $country,
            'state'     => $state,
            'rate'      => $rate,
            'name'      => $name,
            'priority'  => $priority,
            'shipping'  => 1,
        );

        switch ( $id ) {
            case 'eu-vat':
                $rows = array();

                foreach ( self::EU_VAT as $country => $rate ) {
                    $rows[] = $row( $country, $rate, 'VAT' );
                }

                return $rows;
            case 'gb-vat':
                return array( $row( 'GB', 20, 'VAT' ) );
            case 'au-gst':
                return array( $row( 'AU', 10, 'GST' ) );
            case 'nz-gst':
                return array( $row( 'NZ', 15, 'GST' ) );
            case 'sg-gst':
                return array( $row( 'SG', 9, 'GST' ) );
            case 'ca-gst':
                return array( $row( 'CA', 5, 'GST' ) );
            case 'in-gst':
                $state = strtoupper( $state );
                $rows  = array( $row( 'IN', $slab, 'IGST' ) );

                // Inside the seller's state the state-specific CGST (priority 1) beats the country-wide IGST, and
                // SGST (priority 2) is added; everywhere else only IGST matches.
                if ( '' !== $state ) {
                    $rows[] = $row( 'IN', $slab / 2, 'CGST', $state, 1 );
                    $rows[] = $row( 'IN', $slab / 2, 'SGST', $state, 2 );
                }

                return $rows;
        }

        return null;
    }
}
