<?php
/**
 * ProductType class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Domain\Product;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart ProductType class.
 *
 * The vision's "Never use Product internally. Instead use Product." - Product
 * represents Physical Product, Digital Product, Subscription, Course,
 * Service, Membership, Booking, Rental, Bundle, Donation, Gift Card,
 * License, and future product types. One `vulocart_products` table covers all
 * of them (Install.php); this class is only the closed set of known `type`
 * values that column accepts today - per-type *behavior* differences
 * (e.g. a Booking product needing calendar availability) are a later,
 * separate layer, not something this constants class tries to encode.
 *
 * @class       ProductType class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ProductType {

    const PHYSICAL     = 'physical';
    const DIGITAL      = 'digital';
    const SUBSCRIPTION = 'subscription';
    const COURSE       = 'course';
    const SERVICE      = 'service';
    const MEMBERSHIP   = 'membership';
    const BOOKING      = 'booking';
    const RENTAL       = 'rental';
    const BUNDLE       = 'bundle';
    const DONATION     = 'donation';
    const GIFT_CARD    = 'gift_card';
    const LICENSE      = 'license';

    /**
     * Returns every known product type value.
     *
     * @return string[] Every known product type value.
     */
    public static function all(): array {
        return array(
            self::PHYSICAL,
            self::DIGITAL,
            self::SUBSCRIPTION,
            self::COURSE,
            self::SERVICE,
            self::MEMBERSHIP,
            self::BOOKING,
            self::RENTAL,
            self::BUNDLE,
            self::DONATION,
            self::GIFT_CARD,
            self::LICENSE,
        );
    }
}
