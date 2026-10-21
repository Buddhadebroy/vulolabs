<?php
/**
 * Install class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Taxes;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Taxes module Install class.
 *
 * Owns `vulocart_tax_rates`: one row per tax rate, matched against where an order is going (country, state,
 * postcode) and the product's tax class. Same version-gated activation-hook pattern as VuloCart\Order\Install.
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
    const TABLE_SCHEMA_VERSION_OPTION = 'vulocart_tax_table_version';

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
        add_action( 'vulocart_activated_module_taxes', array( $this, 'maybe_create_tables' ) );
    }

    /**
     * Creates `vulocart_tax_rates` when its schema version is behind.
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

        // An empty `country`/`state`/`postcode` means "any". `priority` stacks taxes: within one priority the most
        // specific match wins, and every priority that matches adds its rate (a federal and a regional tax).
        $sql = "CREATE TABLE `{$wpdb->prefix}vulocart_tax_rates` (
            `id`         bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `tax_class`  varchar(64) NOT NULL DEFAULT 'standard',
            `country`    varchar(2) NOT NULL DEFAULT '',
            `state`      varchar(64) NOT NULL DEFAULT '',
            `postcode`   varchar(255) NOT NULL DEFAULT '',
            `rate`       decimal(8,4) NOT NULL DEFAULT 0.0000,
            `name`       varchar(100) NOT NULL DEFAULT '',
            `priority`   int(11) NOT NULL DEFAULT 1,
            `shipping`   tinyint(1) NOT NULL DEFAULT 1,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (`id`),
            KEY `idx_tax_class` (`tax_class`),
            KEY `idx_country` (`country`)
        ) $collate;";

        dbDelta( $sql );

        update_option( self::TABLE_SCHEMA_VERSION_OPTION, self::TABLE_SCHEMA_VERSION );
    }
}
