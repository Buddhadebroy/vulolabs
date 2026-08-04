<?php
/**
 * Install class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Payment;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Payment module Install class.
 *
 * Owns `vulocart_payment_transactions` — the Payment Framework's own
 * audit ledger, one row per gateway call (intent/authorize/capture/
 * refund/cancel/webhook), independent of `vulocart_orders` (a row can
 * exist before an order does, while a payment intent is still
 * cart-scoped — `order_id` is nullable and gets linked once one exists).
 * Same version-gated activation-hook pattern `Order\Install`/`Cart\Install`
 * already establish.
 *
 * @class       Install class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Install {

    /**
     * Version-gate option.
     *
     * @var string
     */
    const TABLE_SCHEMA_VERSION_OPTION = 'vulocart_payment_table_version';

    /**
     * Current schema version.
     *
     * @var string
     */
    const TABLE_SCHEMA_VERSION = '1.0.0';

    /**
     * Install constructor.
     */
    public function __construct() {
        add_action( 'vulocart_activated_module_payment', array( $this, 'maybe_create_tables' ) );
    }

    /**
     * Creates `vulocart_payment_transactions` — only when
     * TABLE_SCHEMA_VERSION_OPTION is behind TABLE_SCHEMA_VERSION.
     *
     * @return void
     */
    public function maybe_create_tables(): void {
        if ( get_option( self::TABLE_SCHEMA_VERSION_OPTION ) === self::TABLE_SCHEMA_VERSION ) {
            return;
        }

        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $collate = $wpdb->get_charset_collate();

        // `type` is one of 'intent'/'authorize'/'capture'/'refund'/
        // 'cancel'/'webhook' — a log entry, not a state machine row (a
        // single payment naturally has several rows: authorize, capture,
        // a later partial refund). `gateway_transaction_id` is how
        // `handle_webhook()`'s own result gets reconciled back to the
        // right row/order without the gateway ever knowing this table
        // exists. `raw_response` is admin-visible-only audit data, never
        // returned to the storefront.
        $sql = "CREATE TABLE `{$wpdb->prefix}vulocart_payment_transactions` (
            `id`                     bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `order_id`               bigint(20) unsigned DEFAULT NULL,
            `cart_token`             varchar(64) DEFAULT NULL,
            `gateway`                varchar(50) NOT NULL,
            `type`                   varchar(20) NOT NULL,
            `gateway_transaction_id` varchar(191) DEFAULT NULL,
            `status`                 varchar(20) NOT NULL,
            `amount`                 decimal(19,4) NOT NULL DEFAULT 0.0000,
            `currency`               varchar(10) DEFAULT NULL,
            `raw_response`           longtext DEFAULT NULL,
            `created_at`             timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at`             timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_order_id` (`order_id`),
            KEY `idx_gateway_transaction_id` (`gateway_transaction_id`),
            KEY `idx_cart_token` (`cart_token`)
        ) $collate;";

        dbDelta( $sql );

        update_option( self::TABLE_SCHEMA_VERSION_OPTION, self::TABLE_SCHEMA_VERSION );
    }
}
