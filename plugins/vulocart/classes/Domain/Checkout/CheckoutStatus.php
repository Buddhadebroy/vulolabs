<?php
/**
 * CheckoutStatus class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Domain\Checkout;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart CheckoutStatus class.
 *
 * Only two real, stored values — "abandoned" is deliberately NOT a third
 * one. Whether a session counts as abandoned depends on the current time
 * (an ACTIVE session becomes "abandoned" the moment it's old enough, with
 * nothing having to write to it), so Application\CheckoutService::
 * find_abandoned() computes it at query time (`status = ACTIVE AND
 * updated_at < cutoff`) instead — no cron job needed to flip a stored
 * flag, and it's always accurate rather than only as fresh as the last
 * cron run.
 *
 * @class       CheckoutStatus class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CheckoutStatus {

    /** Created/updated but hasn't produced an Order yet — includes what a Pro Abandoned Checkout feature would call "abandoned", computed at query time rather than stored. */
    const ACTIVE = 'active';

    /** An Order was created from this session's cart_token (Application\CheckoutService's own vulocart_order_created listener). */
    const COMPLETED = 'completed';

    /**
     * Every known stored status.
     *
     * @return string[]
     */
    public static function all(): array {
        return array( self::ACTIVE, self::COMPLETED );
    }
}
