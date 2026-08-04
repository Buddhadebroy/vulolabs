<?php
/**
 * Sdk class file.
 *
 * @package VuloCart
 */

namespace VuloCart\RestAPI\Controllers;

use VuloCart\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Sdk REST controller.
 *
 * `@vulocart/sdk`'s bootstrap call — the cross-domain replacement for
 * `wp_localize_script()`/`vulocartFrontendData` (Block.php's own
 * docblock on that mechanism), which only ever reaches a page THIS
 * WordPress install rendered. A page the SDK runs on (a merchant's own
 * landing page, a Next.js app, plain HTML anywhere) never gets that
 * inline `<script>` config block, so it has to ask for its own config
 * over REST instead — this is that one call, and it's the first thing
 * `@vulocart/sdk`'s `init()` does.
 *
 * Per-feature flags (not just one blanket `proActive` bool) so the SDK
 * can offer Buy Button/Embedded Cart/basic Embedded Checkout on every
 * install, and independently light up whichever Pro delivery modes are
 * actually licensed+active on THIS site — reusing the exact same
 * `Modules::is_active()` check every other Pro-gated surface in this
 * codebase already relies on (a Pro module's source path is only ever
 * registered with this plugin's loader once its own license is active,
 * CLAUDE.md's own "Licensing" paragraph), so this endpoint introduces no
 * new cross-plugin coupling.
 *
 * @class       Sdk class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Sdk extends \WP_REST_Controller {

    /**
     * Registers this controller's REST routes.
     *
     * @return void
     */
    public function register_routes() {
        register_rest_route(
            VuloCart()->rest_namespace,
            '/sdk/config',
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_config' ),
                'permission_callback' => '__return_true',
            )
        );
    }

    /**
     * Returns the SDK's own bootstrap config: where to call, what
     * currency to render, and which Pro delivery modes (if any) it
     * should lazy-load its `sdk-pro.js` companion bundle for.
     *
     * @return \WP_REST_Response
     */
    public function get_config() {
        $saved    = get_option( Utill::SETTINGS_KEY, array() );
        $settings = wp_parse_args( is_array( $saved ) ? $saved : array(), Utill::SETTINGS_DEFAULTS );
        $modules  = VuloCart()->modules;

        $pro_active = $modules->is_active( 'popup-checkout' )
            || $modules->is_active( 'checkout-links' )
            || $modules->is_active( 'hosted-checkout' );

        /**
         * `vulocart_pro_sdk_bundle_url` — vulocart-pro's own bootstrap
         * (registered once vulocart-pro is loaded) fills this in with the
         * URL to its `assets/js/sdk-pro.js` build. Null (and therefore no
         * lazy-load attempt at all) on an install with no Pro plugin, or
         * with Pro installed but no SDK-facing module actually active.
         *
         * @param string|null $url Defaults to null.
         */
        $pro_sdk_url = $pro_active ? apply_filters( 'vulocart_pro_sdk_bundle_url', null ) : null;

        return rest_ensure_response(
            array(
                'siteUrl'    => home_url( '/' ),
                'restUrl'    => rest_url( VuloCart()->rest_namespace ),
                'currency'   => $settings['default_currency'],
                'proActive'  => $pro_active,
                'proSdkUrl'  => $pro_sdk_url,
                'features'   => array(
                    'buyButton'        => true,
                    'embeddedCart'     => true,
                    'embeddedCheckout' => true,
                    'popupCheckout'    => $modules->is_active( 'popup-checkout' ),
                    'drawerCheckout'   => $modules->is_active( 'drawer-checkout' ),
                    'checkoutLinks'    => $modules->is_active( 'checkout-links' ),
                    'hostedCheckout'   => $modules->is_active( 'hosted-checkout' ),
                ),
            )
        );
    }
}
