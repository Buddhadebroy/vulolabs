<?php
/**
 * Install class file.
 *
 * @package VuloCart
 */

namespace VuloCart;

defined( 'ABSPATH' ) || exit;

/**
 * Creates the plugin's core database tables with dbDelta().
 *
 * Owns `vulocart_products` plus the catalog tables used by the Products menu: `vulocart_terms` (categories, brands,
 * collections, tags), `vulocart_attributes`, `vulocart_attribute_values`, `vulocart_reviews` and
 * `vulocart_checkout_sessions`. Tables that belong to a module (cart, orders, customers, payments, taxes, AI) are
 * created by that module's own Install.php when the module is activated.
 *
 * @class       Install class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Install {

    /**
     * Class constructor - runs the install immediately. It is only constructed from VuloCart::init_plugin() and
     * VuloCart::init_classes(), both at or after `init`, so running synchronously is safe.
     */
    public function __construct() {
        $this->run_migration();
    }

    /**
     * Runs the database install process.
     *
     * @return void
     */
    public function run_migration() {
        $previous_version = get_option( Utill::OTHER_SETTINGS['plugin_db_version'], false );

        if ( ! $previous_version ) {
            $this->create_database_tables();
        } else {
            $this->do_migration( $previous_version );
        }

        update_option( Utill::OTHER_SETTINGS['plugin_db_version'], VULOCART_PLUGIN_VERSION );
        do_action( 'vulocart_after_installed' );
    }

    /**
     * Creates every VuloCart custom table for a fresh install. Additive-only.
     *
     * @return void
     */
    private static function create_database_tables() {
        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        self::create_product_table();
        self::create_catalog_taxonomy_tables();
        self::create_checkout_sessions_table();
    }

    /**
     * Creates `vulocart_products`.
     *
     * The CREATE TABLE statement must not use `IF NOT EXISTS`: dbDelta() reads the table name up to the first space
     * after `CREATE TABLE`, so `CREATE TABLE IF NOT EXISTS ...` is read as a table called `IF` and nothing happens to
     * the real table.
     *
     * @return void
     */
    private static function create_product_table() {
        global $wpdb;

        $collate = $wpdb->get_charset_collate();

        // One table covers every product type in Domain\Product\ProductType: the `type` column tells physical,
        // digital, subscription and so on apart, and `meta` / `passport` are JSON columns rather than fixed columns
        // per type, because the list of types is expected to grow.
        $sql_products = "CREATE TABLE `{$wpdb->prefix}" . Utill::TABLES['product'] . "` (
            `id`         bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `type`       varchar(50) NOT NULL,
            `sku`        varchar(100) DEFAULT NULL,
            `title`      varchar(255) NOT NULL,
            `slug`       varchar(200) NOT NULL,
            `status`     varchar(20) NOT NULL DEFAULT 'draft',
            `price`      decimal(19,4) DEFAULT NULL,
            `currency`   varchar(10) DEFAULT NULL,
            `meta`       longtext DEFAULT NULL,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `published_at` datetime DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_type` (`type`),
            KEY `idx_status` (`status`),
            KEY `idx_sku` (`sku`),
            KEY `idx_slug` (`slug`)
        ) $collate;";

        dbDelta( $sql_products );
    }

    /**
     * Creates `vulocart_terms` (Categories/Brands/Collections -
     * Domain\Term\Taxonomy's own docblock explains the shared-table
     * design), `vulocart_attributes`/`vulocart_attribute_values`, and
     * `vulocart_reviews`.
     *
     * @return void
     */
    private static function create_catalog_taxonomy_tables() {
        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $collate = $wpdb->get_charset_collate();

        $sql_terms = "CREATE TABLE `{$wpdb->prefix}vulocart_terms` (
            `id`          bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `taxonomy`    varchar(20) NOT NULL,
            `name`        varchar(200) NOT NULL,
            `slug`        varchar(200) NOT NULL,
            `parent_id`   bigint(20) unsigned DEFAULT NULL,
            `description` text DEFAULT NULL,
            `meta`        longtext DEFAULT NULL,
            `created_at`  timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at`  timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `idx_taxonomy_slug` (`taxonomy`, `slug`),
            KEY `idx_parent_id` (`parent_id`)
        ) $collate;";

        dbDelta( $sql_terms );

        $sql_attributes = "CREATE TABLE `{$wpdb->prefix}vulocart_attributes` (
            `id`         bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `name`       varchar(200) NOT NULL,
            `slug`       varchar(200) NOT NULL,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `idx_slug` (`slug`)
        ) $collate;";

        dbDelta( $sql_attributes );

        $sql_attribute_values = "CREATE TABLE `{$wpdb->prefix}vulocart_attribute_values` (
            `id`           bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `attribute_id` bigint(20) unsigned NOT NULL,
            `value`        varchar(200) NOT NULL,
            `created_at`   timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_attribute_id` (`attribute_id`)
        ) $collate;";

        dbDelta( $sql_attribute_values );

        $sql_reviews = "CREATE TABLE `{$wpdb->prefix}vulocart_reviews` (
            `id`             bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `product_id`       bigint(20) unsigned NOT NULL,
            `customer_name`  varchar(200) DEFAULT NULL,
            `customer_email` varchar(200) DEFAULT NULL,
            `rating`         tinyint(1) unsigned NOT NULL DEFAULT 5,
            `title`          varchar(200) DEFAULT NULL,
            `content`        text DEFAULT NULL,
            `status`         varchar(20) NOT NULL DEFAULT 'pending',
            `created_at`     timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at`     timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_product_id` (`product_id`),
            KEY `idx_status` (`status`)
        ) $collate;";

        dbDelta( $sql_reviews );
    }

    /**
     * Creates `vulocart_checkout_sessions` - the Checkout Engine's own
     * session-tracking table (Domain\Checkout\CheckoutSession's own
     * docblock). `UNIQUE KEY idx_cart_token` since a session is always
     * one-per-cart (Application\CheckoutService::start_session()'s own
     * find-or-create semantics rely on that).
     *
     * @return void
     */
    private static function create_checkout_sessions_table() {
        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $collate = $wpdb->get_charset_collate();

        $sql_checkout_sessions = "CREATE TABLE `{$wpdb->prefix}vulocart_checkout_sessions` (
            `id`             bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `cart_token`     varchar(191) NOT NULL,
            `status`         varchar(20) NOT NULL DEFAULT 'active',
            `mode`           varchar(20) NOT NULL DEFAULT 'multi_step',
            `current_step`   varchar(50) DEFAULT NULL,
            `customer_email` varchar(200) DEFAULT NULL,
            `meta`           longtext DEFAULT NULL,
            `created_at`     timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at`     timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `idx_cart_token` (`cart_token`),
            KEY `idx_status_updated` (`status`, `updated_at`)
        ) $collate;";

        dbDelta( $sql_checkout_sessions );
    }

    /**
     * Adds `vulocart_checkout_sessions` for the Checkout Engine - dbDelta()
     * is safe to call unconditionally for a table (creates it if missing,
     * no-ops if it's already there).
     *
     * @param string $previous_version The version option value before this run.
     * @return void
     */
    public function do_migration( $previous_version ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
        self::create_checkout_sessions_table();

        self::ensure_product_published_at();
    }

    /**
     * `published_at` on products: dbDelta adds the column, then products that were already published get
     * their creation date as the best available publish date. Once per site.
     *
     * Also called from VuloCart::init_plugin() on every request until it has run, not only from
     * `do_migration()`: that only runs when the plugin version goes up, so a site already on the current
     * version would otherwise never get the column - and every product save would fail on it.
     *
     * @return void
     */
    public static function ensure_product_published_at() {
        if ( get_option( 'vulocart_product_published_at_added' ) ) {
            return;
        }

        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        self::create_product_table();

        $table = $wpdb->prefix . Utill::TABLES['product'];
        $wpdb->query( "UPDATE {$table} SET published_at = created_at WHERE status = 'published' AND published_at IS NULL" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- one-time backfill, table name is plugin-defined.

        update_option( 'vulocart_product_published_at_added', '1' );
    }
}
