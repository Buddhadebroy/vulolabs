<?php
/**
 * Install class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Order;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Order module Install class.
 *
 * Owns `vulocart_orders`/`vulocart_order_items` — same module-owned-table,
 * version-gated activation-hook pattern VuloCart\Cart\Install and
 * `vulocart-pro`'s `Passport\Util` already establish.
 *
 * @class       Install class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Install {

    /**
     * Version-gate option — see VuloCart\Cart\Install's own docblock for
     * why this is necessary (`vulocart_activated_module_order` fires on
     * every active-module pass, not only the first).
     *
     * @var string
     */
    const TABLE_SCHEMA_VERSION_OPTION = 'vulocart_order_table_version';

    /**
     * Current schema version — bump this alongside a new dbDelta() call in
     * maybe_create_tables() when the tables need an additive change.
     *
     * No `IF NOT EXISTS` in either CREATE TABLE statement below —
     * `dbDelta()` extracts the table name via a regex that stops at the
     * first space after `CREATE TABLE`, so `CREATE TABLE IF NOT EXISTS
     * \`wp_x\`` reads as table name `IF` and silently does nothing to the
     * real table.
     *
     * 1.1.0 (Customer/Address/Shipping/Taxes/Payment modules): adds
     * `customer_phone`, `customer_user_id`, `billing_address`,
     * `shipping_address`, `shipping_method`, `shipping_cost`,
     * `tax_amount`, `payment_method` to `vulocart_orders` — additive only,
     * `dbDelta()` adds the missing columns to the existing table rather
     * than recreating it.
     *
     * 1.2.0 (Payment Framework, Phase 5): adds `gateway_transaction_id`,
     * `authorized_amount`, `captured_amount` to `vulocart_orders` —
     * additive only, same reasoning as 1.1.0.
     *
     * @var string
     */
    const TABLE_SCHEMA_VERSION = '1.2.0';

    /**
     * Install constructor.
     */
    public function __construct() {
        add_action( 'vulocart_activated_module_order', array( $this, 'maybe_create_tables' ) );
    }

    /**
     * Creates `vulocart_orders`/`vulocart_order_items` — only when
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

        // Vision: "Order Created" event, own tables. `order_number` is
        // stamped after insert (Infrastructure\WPDBOrderRepository::insert()
        // explains why); `access_token` is the guest order-tracking
        // credential, this module's equivalent of Cart's own `token`.
        // `order_items` has no `updated_at` — unlike cart items, an
        // order's line items are an immutable historical record once
        // placed.
        //
        // `status` is kept alongside `payment_status`/`fulfillment_status`
        // (Order.php's docblock explains the split) but is no longer read
        // by this codebase beyond that column existing.
        $sql_orders = "CREATE TABLE `{$wpdb->prefix}vulocart_orders` (
            `id`                 bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `order_number`       varchar(32) NOT NULL,
            `access_token`       varchar(64) NOT NULL,
            `cart_token`         varchar(64) DEFAULT NULL,
            `customer_email`     varchar(200) DEFAULT NULL,
            `customer_name`      varchar(200) DEFAULT NULL,
            `customer_phone`     varchar(30) DEFAULT NULL,
            `customer_user_id`   bigint(20) unsigned DEFAULT NULL,
            `status`             varchar(20) NOT NULL DEFAULT 'pending',
            `payment_status`     varchar(20) NOT NULL DEFAULT 'pending',
            `fulfillment_status` varchar(20) NOT NULL DEFAULT 'pending',
            `refunded_amount`    decimal(19,4) DEFAULT NULL,
            `currency`           varchar(10) DEFAULT NULL,
            `subtotal`           decimal(19,4) NOT NULL DEFAULT 0.0000,
            `shipping_method`    varchar(50) DEFAULT NULL,
            `shipping_cost`      decimal(19,4) NOT NULL DEFAULT 0.0000,
            `tax_amount`         decimal(19,4) NOT NULL DEFAULT 0.0000,
            `payment_method`     varchar(50) DEFAULT NULL,
            `gateway_transaction_id` varchar(191) DEFAULT NULL,
            `authorized_amount`  decimal(19,4) NOT NULL DEFAULT 0.0000,
            `captured_amount`    decimal(19,4) NOT NULL DEFAULT 0.0000,
            `total`              decimal(19,4) NOT NULL DEFAULT 0.0000,
            `billing_address`    longtext DEFAULT NULL,
            `shipping_address`   longtext DEFAULT NULL,
            `meta`               longtext DEFAULT NULL,
            `created_at`         timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at`         timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `idx_order_number` (`order_number`),
            KEY `idx_status` (`status`),
            KEY `idx_payment_status` (`payment_status`),
            KEY `idx_fulfillment_status` (`fulfillment_status`),
            KEY `idx_customer_email` (`customer_email`),
            KEY `idx_customer_user_id` (`customer_user_id`),
            KEY `idx_gateway_transaction_id` (`gateway_transaction_id`)
        ) $collate;";

        dbDelta( $sql_orders );

        $sql_order_items = "CREATE TABLE `{$wpdb->prefix}vulocart_order_items` (
            `id`         bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `order_id`   bigint(20) unsigned NOT NULL,
            `offering_id`   bigint(20) unsigned NOT NULL,
            `title`      varchar(255) NOT NULL,
            `quantity`   int(10) unsigned NOT NULL DEFAULT 1,
            `unit_price` decimal(19,4) DEFAULT NULL,
            `currency`   varchar(10) DEFAULT NULL,
            `meta`       longtext DEFAULT NULL,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_order_id` (`order_id`),
            KEY `idx_offering_id` (`offering_id`)
        ) $collate;";

        dbDelta( $sql_order_items );

        update_option( self::TABLE_SCHEMA_VERSION_OPTION, self::TABLE_SCHEMA_VERSION );
    }
}
