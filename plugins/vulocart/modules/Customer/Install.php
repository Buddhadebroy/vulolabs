<?php
/**
 * Install class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Customer;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Customer module Install class.
 *
 * Owns `vulocart_customers`/`vulocart_customer_addresses`/
 * `vulocart_customer_notes` — this module's first-ever tables (Domain\
 * Customer's own docblock explains why a persistent entity is new here).
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
    const TABLE_SCHEMA_VERSION_OPTION = 'vulocart_customer_table_version';

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
        add_action( 'vulocart_activated_module_customer', array( $this, 'maybe_create_tables' ) );
    }

    /**
     * Creates the three tables this module owns.
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

        $sql_customers = "CREATE TABLE `{$wpdb->prefix}vulocart_customers` (
            `id`             bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `email`          varchar(200) NOT NULL,
            `wp_user_id`     bigint(20) unsigned DEFAULT NULL,
            `name`           varchar(200) DEFAULT NULL,
            `phone`          varchar(30) DEFAULT NULL,
            `total_orders`   int(10) unsigned NOT NULL DEFAULT 0,
            `total_spent`    decimal(19,4) NOT NULL DEFAULT 0.0000,
            `last_order_at`  datetime DEFAULT NULL,
            `created_at`     timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at`     timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `idx_email` (`email`),
            KEY `idx_wp_user_id` (`wp_user_id`)
        ) $collate;";

        dbDelta( $sql_customers );

        // A real address book — `label` is the buyer's own name for it
        // ("Home", "Work"); `is_default_billing`/`is_default_shipping` let
        // the checkout wizard's own Address step (a future enhancement,
        // not built this pass — see AddressService's own docblock on why
        // checkout itself still snapshots free-typed fields onto the
        // Order rather than reading from here yet) eventually offer "use
        // a saved address" as a real option.
        $sql_addresses = "CREATE TABLE `{$wpdb->prefix}vulocart_customer_addresses` (
            `id`                  bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `customer_id`         bigint(20) unsigned NOT NULL,
            `label`               varchar(100) DEFAULT NULL,
            `is_default_billing`  tinyint(1) NOT NULL DEFAULT 0,
            `is_default_shipping` tinyint(1) NOT NULL DEFAULT 0,
            `full_name`           varchar(200) DEFAULT NULL,
            `phone`               varchar(30) DEFAULT NULL,
            `address_1`           varchar(255) DEFAULT NULL,
            `address_2`           varchar(255) DEFAULT NULL,
            `city`                varchar(100) DEFAULT NULL,
            `state`               varchar(100) DEFAULT NULL,
            `postcode`            varchar(30) DEFAULT NULL,
            `country`             varchar(100) DEFAULT NULL,
            `created_at`          timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at`          timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_customer_id` (`customer_id`)
        ) $collate;";

        dbDelta( $sql_addresses );

        // Admin-only, same "internal record about a customer" role
        // `Order`'s own admin-facing fields play — never shown to the
        // customer themselves.
        $sql_notes = "CREATE TABLE `{$wpdb->prefix}vulocart_customer_notes` (
            `id`             bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `customer_id`    bigint(20) unsigned NOT NULL,
            `author_user_id` bigint(20) unsigned DEFAULT NULL,
            `note`           longtext NOT NULL,
            `created_at`     timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_customer_id` (`customer_id`)
        ) $collate;";

        dbDelta( $sql_notes );

        update_option( self::TABLE_SCHEMA_VERSION_OPTION, self::TABLE_SCHEMA_VERSION );
    }
}
