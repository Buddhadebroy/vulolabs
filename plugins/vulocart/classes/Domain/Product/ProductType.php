<?php
/**
 * ProductType class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Domain\Product;

defined( 'ABSPATH' ) || exit;

/**
 * The closed set of product `type` values the `vulocart_products` table accepts: Physical, Digital, Subscription,
 * Course, Service, Membership, Booking, Rental, Bundle, Donation, Gift Card and License. One table covers all of them
 * (see Install.php). Differences in behaviour between types (for example a booking needing calendar availability) are
 * not encoded here.
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
