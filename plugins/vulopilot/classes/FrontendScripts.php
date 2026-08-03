<?php
/**
 * FrontendScripts class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot;

defined( 'ABSPATH' ) || exit;

/**
 * VuloPilot FrontendScripts class.
 *
 * Registers and localizes the admin React bundle. Deliberately much
 * smaller than VuloLabs\FrontendScripts — that class's size comes from
 * WooCommerce-specific localized data (store owners, payment gateways, WC
 * countries) VuloPilot has no equivalent of; this only carries what the
 * React app actually needs to boot and call the REST API (see
 * src/global.d.ts's AppLocalizer interface).
 *
 * @class       FrontendScripts class
 * @version     1.0.0
 * @author      VuloLabs
 */
class FrontendScripts {

    /**
     * FrontendScripts constructor.
     */
    public function __construct() {
        add_action( 'admin_enqueue_scripts', array( $this, 'admin_load_scripts' ) );
    }

    /**
     * Returns the URL to the built assets directory.
     *
     * @return string
     */
    public static function get_asset_url() {
        return VuloPilot()->plugin_url . 'assets/';
    }

    /**
     * Registers the admin script and style bundles (built by wp-scripts;
     * see webpack.config.js / package.json).
     *
     * @return void
     */
    public static function admin_load_scripts() {
        self::register_admin_scripts();
        self::register_admin_styles();
    }

    /**
     * Registers every admin script handle — both the app entry
     * ('vulopilot-admin-script', from index.js) and the shared-dependency
     * chunk webpack's splitChunks config emits alongside it
     * ('vulopilot-vendor-script', from vendors.js — see
     * tools/webpack/create-config.js's `optimization.splitChunks.cacheGroups.vendors`).
     * index.js's own webpack runtime expects vendors.js's module registry
     * to already be on the page; registering only the admin script and
     * never the vendor one (a bug this method used to have) means
     * index.js loads with nothing to resolve its own chunk references
     * against and the React app silently never mounts — a blank content
     * area with working WP-admin chrome around it, not a fatal error.
     *
     * @return void
     */
    private static function register_admin_scripts() {
        $index_asset_path  = VuloPilot()->plugin_path . 'assets/js/index.asset.php';
        $vendor_asset_path = VuloPilot()->plugin_path . 'assets/js/vendors.asset.php';

        $index_asset = file_exists( $index_asset_path )
            ? include $index_asset_path
            : array(
                'dependencies' => array( 'wp-element', 'wp-i18n', 'wp-hooks' ),
                'version'      => VULOPILOT_PLUGIN_VERSION,
            );

        $vendor_asset = file_exists( $vendor_asset_path )
            ? include $vendor_asset_path
            : array(
                'dependencies' => array(),
                'version'      => VULOPILOT_PLUGIN_VERSION,
            );

        wp_register_script(
            'vulopilot-vendor-script',
            self::get_asset_url() . 'js/vendors.js',
            $vendor_asset['dependencies'],
            $vendor_asset['version'],
            true
        );

        wp_register_script(
            'vulopilot-admin-script',
            self::get_asset_url() . 'js/index.js',
            $index_asset['dependencies'],
            $index_asset['version'],
            true
        );
        wp_set_script_translations( 'vulopilot-admin-script', 'vulopilot' );
    }

    /**
     * Registers every admin style handle.
     *
     * @return void
     */
    private static function register_admin_styles() {
        wp_register_style(
            'vulopilot-admin-style',
            self::get_asset_url() . 'styles/index.css',
            array(),
            VULOPILOT_PLUGIN_VERSION
        );
    }

    /**
     * Enqueues a previously registered script handle.
     *
     * @param string $handle Script handle.
     * @return void
     */
    public static function enqueue_script( $handle ) {
        wp_enqueue_script( $handle );
    }

    /**
     * Enqueues a previously registered style handle.
     *
     * @param string $handle Style handle.
     * @return void
     */
    public static function enqueue_style( $handle ) {
        wp_enqueue_style( $handle );
    }

    /**
     * Localizes the admin script with everything the React app needs to
     * boot and call the REST API.
     *
     * @param string $handle Script handle to attach the localized data to.
     * @return void
     */
    public static function localize_scripts( $handle ) {
        wp_localize_script(
            $handle,
            'appLocalizer',
            array(
                'apiUrl'         => untrailingslashit( get_rest_url() ),
                'restUrl'        => VuloPilot()->rest_namespace,
                'nonce'          => wp_create_nonce( 'wp_rest' ),
                'plugin_url'     => VuloPilot()->plugin_url,
                'admin_url'      => admin_url( 'admin.php?page=vulopilot' ),
                'site_url'       => site_url(),
                'version'        => VuloPilot()->version,
                'plugin_slug'    => VuloPilot()->plugin_slug,
                'text_domain'    => VULOPILOT_PLUGIN_TEXTDOMAIN,
                'date_format'    => get_option( 'date_format' ) . ' ' . get_option( 'time_format' ),
                // Settings → General → Date Format, translated into zyra's
                // own token syntax (YYYY/MM/DD/…) — TableCard's `date`
                // column type and any other date display in the React app
                // pass this through as the `format` it renders with, so
                // dates show the way this site is actually configured
                // rather than zyra's hardcoded "YYYY-MM-DD" default.
                'date_format_js' => self::convert_date_format_to_js( get_option( 'date_format' ) ),
                // Feeds zyra's configureZyra()/ZyraVariable.khali_dabba (a
                // proSetting field's Pro-tag/lock in InputRenderer) and
                // vulopilot-pro's src/index.tsx (which module JS entries
                // actually load) — both were reading these two keys off
                // appLocalizer already, but nothing populated them yet.
                'khali_dabba'    => VuloPilot()->util->is_khali_dabba(),
                'active_modules' => VuloPilot()->modules->get_active_modules(),
                'shop_url'       => VULOPILOT_PRO_SHOP_URL,
                // 'version' defaults to false (Pro not installed) unless
                // vulopilot-pro's own bootstrap overrides it — same
                // shape/default as vulocart's 'pro_data'/
                // `vulocart_update_pro_data` filter. Feeds the header's
                // "Pro: …" version tag (app.tsx).
                'pro_data'       => apply_filters(
                    'vulopilot_update_pro_data',
                    array(
                        'version'         => false,
                        'manage_plan_url' => VULOPILOT_PRO_SHOP_URL,
                    )
                ),
            )
        );
    }

    /**
     * Translates a PHP `date()` format string (Settings → General → Date
     * Format only ever produces one of a handful of single-character
     * tokens — Y/y/F/M/m/n/j/d, plus whatever literal punctuation sits
     * between them) into the token syntax zyra's own TableCard `date`
     * column type understands (YYYY/YY/MMMM/MMM/MM/DD/D). zyra has no
     * unpadded-numeric-month or 12-hour/am-pm tokens, so `n`/`h`/`g` fall
     * back to their nearest zyra equivalent and `a`/`A` are dropped rather
     * than leaking the literal letter into the rendered date — a
     * non-issue in practice since `date_format` (unlike `time_format`)
     * never contains time tokens on a default WordPress install.
     *
     * @param string $php_format A PHP `date()` format string, e.g. get_option( 'date_format' ).
     * @return string The same format expressed in zyra's token syntax.
     */
    private static function convert_date_format_to_js( string $php_format ): string {
        $token_map = array(
            'Y' => 'YYYY',
            'y' => 'YY',
            'F' => 'MMMM',
            'M' => 'MMM',
            'm' => 'MM',
            'n' => 'MM',
            'd' => 'DD',
            'j' => 'D',
            'H' => 'HH',
            'G' => 'HH',
            'h' => 'HH',
            'g' => 'HH',
            'i' => 'mm',
            's' => 'ss',
        );

        $js_format = '';
        $length    = strlen( $php_format );

        for ( $i = 0; $i < $length; $i++ ) {
            $char = $php_format[ $i ];

            // A backslash escapes the next character as a literal in
            // PHP's date() syntax (e.g. custom formats like 'jS \o\f F').
            if ( '\\' === $char && $i + 1 < $length ) {
                $js_format .= $php_format[ ++$i ];
                continue;
            }

            if ( 'a' === $char || 'A' === $char ) {
                continue;
            }

            $js_format .= $token_map[ $char ] ?? $char;
        }

        return trim( $js_format );
    }
}
