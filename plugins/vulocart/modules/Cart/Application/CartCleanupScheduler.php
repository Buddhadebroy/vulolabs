<?php
/**
 * CartCleanupScheduler class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Cart\Application;

use VuloCart\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Deletes expired carts. A daily `wp_cron` event removes carts nobody has touched for the number of days set in
 * Settings → Cart (`cart_expiry_days`). The hooks are registered in the constructor, which Module.php calls once.
 *
 * @class       CartCleanupScheduler class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CartCleanupScheduler {

    /**
     * The cron hook this class schedules and listens for.
     *
     * @var string
     */
    const CRON_HOOK = 'vulocart_cleanup_expired_carts';

    /**
     * Used to actually delete expired carts once the cron fires.
     *
     * @var CartService
     */
    private $cart_service;

    /**
     * CartCleanupScheduler constructor.
     *
     * @param CartService $cart_service Used to actually delete expired carts once the cron fires.
     */
    public function __construct( CartService $cart_service ) {
        $this->cart_service = $cart_service;

        add_action( 'init', array( $this, 'maybe_schedule' ) );
        add_action( self::CRON_HOOK, array( $this, 'run_cleanup' ) );
        add_action( 'vulocart_deactivated_module_cart', array( $this, 'unschedule' ) );
    }

    /**
     * Clears the scheduled event when the Cart module is deactivated - a
     * daily cron for a module that's off is just dead weight, and Order
     * (which depends on Cart) is force-inactive alongside it anyway
     * (Order\Module::is_compatible()).
     *
     * @return void
     */
    public function unschedule(): void {
        $timestamp = wp_next_scheduled( self::CRON_HOOK );

        if ( $timestamp ) {
            wp_unschedule_event( $timestamp, self::CRON_HOOK );
        }
    }

    /**
     * Schedules the daily cleanup event if it isn't already - `init`
     * fires on every request while the Cart module is active, but
     * `wp_next_scheduled()` makes this a cheap no-op after the first
     * successful schedule (WordPress's own recommended cron pattern).
     *
     * @return void
     */
    public function maybe_schedule(): void {
        if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
            wp_schedule_event( time(), 'daily', self::CRON_HOOK );
        }
    }

    /**
     * Reads the current `cart_expiry_days` setting and deletes carts
     * older than that.
     *
     * @return void
     */
    public function run_cleanup(): void {
        $settings = wp_parse_args( get_option( Utill::SETTINGS_KEY, array() ), Utill::SETTINGS_DEFAULTS );
        $days     = max( 1, (int) $settings['cart_expiry_days'] );

        $this->cart_service->delete_expired_carts( $days );
    }
}
