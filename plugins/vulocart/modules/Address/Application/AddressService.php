<?php
/**
 * AddressService class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Address\Application;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Address module AddressService.
 *
 * Where Address business logic lives — Rest calls only this class, same
 * as every other module's own Application service. An address here is a
 * plain, open-shape bag (full_name/phone/address_1/address_2/city/state/
 * postcode/country) snapshotted directly onto an Order, not a separate
 * persisted entity of its own.
 *
 * @class       AddressService class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AddressService {

    /**
     * Every field an address bag may carry, in a stable order — sanitize()
     * always returns exactly this key set (missing input becomes '') so a
     * caller never has to guess which keys are present.
     *
     * @var string[]
     */
    const FIELDS = array( 'full_name', 'phone', 'address_1', 'address_2', 'city', 'state', 'postcode', 'country' );

    /**
     * Fields validate() treats as required — `address_2` (apartment/suite,
     * genuinely optional) and `phone` (Customer's own field, already
     * captured at the wizard's Customer step) are deliberately excluded.
     *
     * @var string[]
     */
    const REQUIRED_FIELDS = array( 'full_name', 'address_1', 'city', 'state', 'postcode', 'country' );

    /**
     * Sanitizes a raw address bag into the full, stable FIELDS shape.
     *
     * @param array<string, mixed> $data Raw posted address fields.
     * @return array<string, string>
     */
    public function sanitize( array $data ): array {
        $sanitized = array();

        foreach ( self::FIELDS as $field ) {
            $sanitized[ $field ] = isset( $data[ $field ] ) ? sanitize_text_field( (string) $data[ $field ] ) : '';
        }

        return $sanitized;
    }

    /**
     * Checks whether every required field is present and non-empty.
     *
     * @param array<string, string> $address A sanitize()d address bag.
     * @return bool
     */
    public function validate( array $address ): bool {
        foreach ( self::REQUIRED_FIELDS as $field ) {
            if ( empty( $address[ $field ] ) ) {
                return false;
            }
        }

        return true;
    }

    /**
     * Whether every field in a sanitize()d address bag is blank — used by
     * callers deciding whether "no address given" and "an address with
     * every field empty" should be treated the same way.
     *
     * @param array<string, string> $address A sanitize()d address bag.
     * @return bool
     */
    public function is_empty( array $address ): bool {
        foreach ( $address as $value ) {
            if ( '' !== $value ) {
                return false;
            }
        }

        return true;
    }
}
