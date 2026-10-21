<?php
/**
 * Block class file.
 *
 * @package VuloCart
 */

namespace VuloCart;

defined( 'ABSPATH' ) || exit;

/**
 * Discovers and registers every Gutenberg block VuloCart ships.
 *
 * Each `src/blocks/{name}/` folder is built into `assets/js/block/{name}/` (with its block.json copied alongside).
 * This class `glob()`s that built directory at runtime instead of listing blocks by hand, so a new block folder is
 * picked up after a build with no PHP change.
 *
 * @class       Block class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Block {

    /**
     * Discovered blocks, cached for the lifetime of one request.
     *
     * @var array<int, array{name: string, path: string}>|null
     */
    private $blocks;

    /**
     * Block constructor.
     */
    public function __construct() {
        add_action( 'init', array( $this, 'register_blocks' ) );
        add_action( 'wp_head', array( $this, 'print_frontend_config' ) );
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_shared_vendors_chunk' ), 20 );
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_storefront_bootstrap' ), 21 );
        add_action( 'save_post', array( $this, 'clear_block_page_url_cache' ) );
    }

    /**
     * Prints a tiny inline `vulocartFrontendData` global on every frontend
     * page load - deliberately not `wp_localize_script()` against a
     * specific block's auto-generated view-script handle (fragile to
     * depend on WordPress's exact handle-naming convention); `wp_head`
     * always runs before any `viewScript` (typically footer-enqueued), so
     * this is guaranteed to exist by the time a block's view.js runs.
     * Cheap and harmless to print unconditionally even on pages with no
     * VuloCart block - same tradeoff Cart/Order's public REST routes
     * already accept (no nonce needed since these routes don't require
     * one, see RestAPI/Controllers/Cart.php's own docblock).
     *
     * @return void
     */
    public function print_frontend_config(): void {
        $settings = wp_parse_args( get_option( Utill::SETTINGS_KEY, array() ), Utill::SETTINGS_DEFAULTS );

        $config = array(
            'apiUrl'                  => untrailingslashit( esc_url_raw( rest_url() ) ),
            'restUrl'                 => VuloCart()->rest_namespace,
            // Checkout tab settings (src/settings/Checkout.ts) - real
            // storefront behavior now, not just saved-and-unread values:
            // src/blocks/checkout/Checkout.tsx enforces both client-side,
            // and Order\Rest::create_item() enforces guestCheckoutEnabled
            // again server-side (a client-side-only check isn't real
            // enforcement against a direct API call).
            'guestCheckoutEnabled'    => ! empty( $settings['guest_checkout_enabled'] ),
            'requireTermsAcceptance'  => ! empty( $settings['require_terms_acceptance'] ),
            'requirePhoneNumber'      => 'required' === $settings['checkout_phone'],
            'checkoutTermsUrl'        => (string) $settings['checkout_terms_url'],
            // Domain\Checkout\CheckoutMode::free() - read by
            // src/blocks/checkout-engine/CheckoutEngine.tsx to decide
            // single-page vs. multi-step layout; the engine itself has no
            // idea this setting (or WordPress) exists, only Checkout.tsx
            // reads it and passes `mode` down as a prop.
            'checkoutMode'            => $this->resolve_checkout_mode( (string) $settings['checkout_mode'] ),
            // Where "Proceed to checkout" / "Buy now" lead: the Checkout page (`page`), or one of vulocart-pro's
            // delivery styles (popup, drawer, hosted page, one-click). Pro answers the filter; Free alone is `page`.
            'checkoutDelivery'        => $this->resolve_checkout_delivery(),
            // What the checkout shows by default (Settings → Checkout); a checkout block can override both for its page.
            'checkoutExtras'        => $this->checkout_list( $settings['checkout_extras'], array( 'order_notes', 'address_autocomplete' ), array() ),
            'checkoutSteps'           => $this->checkout_list( $settings['checkout_steps'], array( 'customer', 'address', 'shipping', 'payment', 'review' ), array( 'customer', 'payment' ) ),
            'checkoutFields'          => $this->checkout_list( array_merge( (array) $settings['checkout_fields'], 'hidden' === $settings['checkout_phone'] ? array() : array( 'phone' ) ), array( 'name', 'phone', 'address_2' ), array() ),
            'homeUrl'                 => esc_url_raw( home_url( '/' ) ),
            // Only the signed-in shopper's own address, so one-click checkout can offer it as the default.
            'userEmail'               => is_user_logged_in() ? (string) wp_get_current_user()->user_email : '',
            'isLoggedIn'              => is_user_logged_in(),
            // The WordPress session, so the checkout can say who is signed in and offer sign out / log in (returning to this page).
            'currentUser'             => $this->current_user_payload(),
            // Layout the public products listing renders in; anything unknown falls back to the grid.
            'listingTemplate'         => in_array( $settings['listing_template'], array( 'grid', 'compact', 'list', 'showcase' ), true ) ? (string) $settings['listing_template'] : 'grid',
            'listingColumns'          => in_array( (string) $settings['listing_columns'], array( '2', '3', '4', '5' ), true ) ? (int) $settings['listing_columns'] : 4,
            // Cross-links between the storefront blocks - see
            // find_page_url_with_block()'s own docblock for why this is
            // auto-discovered rather than a settings field the merchant
            // has to fill in by hand.
            'checkoutPageUrl'         => $this->find_page_url_with_block( 'vulocart/checkout' ),
            'cartPageUrl'            => $this->find_page_url_with_block( 'vulocart/cart' ),
            'shopPageUrl'            => $this->find_page_url_with_block( 'vulocart/product-collection' ),
        );

        echo '<script id="vulocart-frontend-data">window.vulocartFrontendData = ' . wp_json_encode( $config ) . ';</script>' . "\n"; // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript -- a ~2-property inline config object, not a real script asset; every other frontend block's view.js depends on this existing before it runs (see docblock).

        /**
         * Fires unconditionally on every `wp_head`, same "cheap and
         * harmless" posture this whole method already has - lets
         * vulocart-pro enqueue its own storefront bundle (e.g. Order
         * Notes/Coupons/Gift Cards' checkout-step extensions,
         * `window.vulocartCheckoutEngine`'s own registrants -
         * `src/blocks/checkout-engine/registry.ts`'s own docblock on why
         * a *storefront* Pro bundle, distinct from the wp-admin one
         * `VuloCartPro::enqueue_admin_script()` already handles, is
         * needed at all) without this class knowing vulocart-pro exists.
         * A registrant is expected to call `has_block('vulocart/checkout')`
         * itself before actually enqueueing anything, same as this method
         * would if it needed to conditionally skip pages with no
         * checkout block.
         */
        do_action( 'vulocart_frontend_config_printed' );
    }

    /**
     * The signed-in WordPress user as the storefront needs them, or null for a guest. The logout link returns to the
     * page it was clicked on; the login link does the same, so a shopper lands back in their checkout.
     *
     * @return array<string, string>|null
     */
    private function current_user_payload(): ?array {
        $here = is_singular() ? (string) get_permalink( get_queried_object_id() ) : home_url( '/' );

        if ( ! is_user_logged_in() ) {
            return array(
                'loginUrl' => esc_url_raw( wp_specialchars_decode( wp_login_url( $here ) ) ),
            );
        }

        $user = wp_get_current_user();

        return array(
            'name'      => (string) $user->display_name,
            'email'     => (string) $user->user_email,
            'avatar'    => (string) get_avatar_url( $user->ID, array( 'size' => 80 ) ),
            'logoutUrl' => esc_url_raw( wp_specialchars_decode( wp_logout_url( $here ) ) ),
        );
    }

    /**
     * The checkout layout to render: the Settings → Checkout layout value, unless something more specific overrides
     * it (a checkout block can force its own layout). Anything that is not one of the
     * free layouts falls back to the setting.
     *
     * @param string $configured The Settings value.
     * @return string `single_page` or `multi_step`.
     */
    private function resolve_checkout_mode( string $configured ): string {
        /**
         * Filters the checkout layout (`single_page` or `multi_step`).
         *
         * @param string $configured The layout chosen in Settings → Commerce → Checkout.
         */
        $mode = (string) apply_filters( 'vulocart_checkout_mode', $configured );

        return in_array( $mode, \VuloCart\Domain\Checkout\CheckoutMode::free(), true ) ? $mode : \VuloCart\Domain\Checkout\CheckoutMode::MULTI_STEP;
    }

    /**
     * How the shopper reaches checkout from the cart or a product page.
     *
     * @return string One of page|popup|drawer|hosted|one_click.
     */
    public function resolve_checkout_delivery(): string {
        $settings   = wp_parse_args( get_option( Utill::SETTINGS_KEY, array() ), Utill::SETTINGS_DEFAULTS );
        $configured = (string) $settings['checkout_delivery'];

        // A delivery style only takes effect when the module that draws it is switched on.
        $modules = array(
            'popup'     => 'popup-checkout',
            'drawer'    => 'drawer-checkout',
            'hosted'    => 'hosted-checkout',
            'one_click' => 'one-click-checkout',
        );

        if ( ! isset( $modules[ $configured ] ) || ! VuloCart()->modules->is_active( $modules[ $configured ] ) ) {
            $configured = 'page';
        }

        /**
         * Filters the checkout delivery style.
         *
         * @param string $delivery The style chosen in Settings → Checkout (`page` unless its module is on).
         */
        $delivery = (string) apply_filters( 'vulocart_checkout_delivery', $configured );

        return in_array( $delivery, array( 'popup', 'drawer', 'hosted', 'one_click' ), true ) ? $delivery : 'page';
    }

    /**
     * A saved checkout list (steps, fields) cleaned to known values, keeping the natural order, and always including
     * the `$required` ones. Anything unsaved or malformed is every known value.
     *
     * @param mixed         $saved    The stored setting.
     * @param array<string> $known    Every valid value, in natural order.
     * @param array<string> $required Values that cannot be turned off.
     * @return array<string>
     */
    private function checkout_list( $saved, array $known, array $required ): array {
        if ( ! is_array( $saved ) ) {
            return $known;
        }

        return array_values( array_filter( $known, fn( $value ) => in_array( $value, $saved, true ) || in_array( $value, $required, true ) ) );
    }

    /**
     * Finds the first published page or post that contains a given block and returns its permalink. Backs
     * `checkoutPageUrl` and `shopPageUrl` in `vulocartFrontendData`, so storefront blocks can link to each other
     * (for example the "Go to checkout" link) without the merchant entering a page URL in Settings.
     *
     * The result is cached in a transient and cleared on every `save_post` (clear_block_page_url_cache()). It only
     * needs to be roughly fresh: a page's blocks rarely change, and a stale URL for one save is harmless.
     *
     * @param string $block_name Registered block name, e.g. 'vulocart/checkout'.
     * @return string|null Permalink, or null if no published page/post has this block.
     */
    private function find_page_url_with_block( string $block_name ): ?string {
        $cache_key = 'vulocart_page_url_' . str_replace( '/', '_', $block_name );
        $cached    = get_transient( $cache_key );

        if ( false !== $cached ) {
            return '' === $cached ? null : $cached;
        }

        global $wpdb;

        $post_id = $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- one-time lookup, result cached in a transient immediately below.
            $wpdb->prepare(
                "SELECT ID FROM {$wpdb->posts} WHERE post_status = 'publish' AND post_type IN ('page', 'post') AND post_content LIKE %s ORDER BY ID ASC LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $wpdb->posts, not user input.
                '%<!-- wp:' . $wpdb->esc_like( $block_name ) . ' %'
            )
        );

        $url = $post_id ? get_permalink( (int) $post_id ) : null;

        set_transient( $cache_key, $url ? $url : '', HOUR_IN_SECONDS );

        return $url ? $url : null;
    }

    /**
     * Clears find_page_url_with_block()'s cache whenever any post/page is
     * saved - cheap and broad rather than trying to detect exactly which
     * save could have added/removed a `vulocart/checkout`/
     * `vulocart/product-collection` block, since `save_post` isn't hot enough
     * (admin-only, infrequent) to make that precision worth the
     * complexity.
     *
     * @return void
     */
    public function clear_block_page_url_cache(): void {
        delete_transient( 'vulocart_page_url_vulocart_checkout' );
        delete_transient( 'vulocart_page_url_vulocart_products' );
    }

    /**
     * Scans `assets/js/block/` for built block folders containing a
     * `block.json`.
     *
     * @return array<int, array{name: string, path: string}>
     */
    private function get_blocks(): array {
        if ( null !== $this->blocks ) {
            return $this->blocks;
        }

        $this->blocks = array();

        $block_base_path = VuloCart()->plugin_path . 'assets/js/block/';

        if ( ! is_dir( $block_base_path ) ) {
            return $this->blocks;
        }

        $folders = glob( $block_base_path . '*', GLOB_ONLYDIR );

        foreach ( $folders as $folder ) {
            if ( file_exists( $folder . '/block.json' ) ) {
                $this->blocks[] = array(
                    'name' => basename( $folder ),
                    'path' => $folder,
                );
            }
        }

        return $this->blocks;
    }

    /**
     * Registers every discovered block.
     *
     * @return void
     */
    public function register_blocks(): void {
        foreach ( $this->get_blocks() as $block ) {
            register_block_type( $block['path'] );
        }
    }

    /**
     * Makes every block's `viewScript` depend on the shared `vendors.js` chunk that webpack's `splitChunks` produces.
     * Any npm dependency a block's view.js imports that WordPress does not provide (for example `axios` in
     * `src/blocks/checkout/Checkout.tsx`) ends up in `vendors.js`, and the generated `.asset.php` only lists
     * WordPress script handles, so `register_block_type()` would enqueue the view script without it. The block would
     * then silently fail to mount, with no error in the console. The admin bundle needs the same chunk (see
     * Admin\Menu::enqueue_admin_script()).
     *
     * @return void
     */
    public function enqueue_shared_vendors_chunk(): void {
        $vendors_asset_file = VuloCart()->plugin_path . 'assets/js/vendors.asset.php';

        if ( ! file_exists( $vendors_asset_file ) ) {
            return;
        }

        $vendors_asset = require $vendors_asset_file;

        wp_register_script(
            'vulocart-block-vendors',
            VuloCart()->plugin_url . 'assets/js/vendors.js',
            $vendors_asset['dependencies'],
            $vendors_asset['version'],
            true
        );

        foreach ( $this->get_blocks() as $block ) {
            $handle = 'vulocart-' . $block['name'] . '-view-script';

            if ( wp_script_is( $handle, 'registered' ) ) {
                wp_scripts()->registered[ $handle ]->deps[] = 'vulocart-block-vendors';
            }
        }
    }

    /**
     * Enqueues `src/storefront/index.tsx`'s built output
     * (`assets/js/storefront.js`) - see that file's own docblock for why
     * this exists as an independent entry from the `vulocart/checkout`
     * block's own view script, and why that independence matters for
     * vulocart-pro's Popup/Embedded delivery modes specifically. Not gated on
     * `has_block()` - unlike a block's own
     * view script, this has nothing to do with which blocks are on THIS
     * page, so a page-content check would be the wrong gate entirely.
     *
     * @return void
     */
    public function enqueue_storefront_bootstrap(): void {
        $settings = wp_parse_args( get_option( Utill::SETTINGS_KEY, array() ), Utill::SETTINGS_DEFAULTS );


        // The checkout engine's stylesheet: the engine runs on the Checkout page and, through vulocart-pro's popup,
        // drawer and embedded modes, on any page - the same reach as the bootstrap script below.
        $engine_css = VuloCart()->plugin_path . 'assets/styles/block/checkout/view.css';

        if ( file_exists( $engine_css ) ) {
            wp_enqueue_style( 'vulocart-checkout-engine', VuloCart()->plugin_url . 'assets/styles/block/checkout/view.css', array(), (string) filemtime( $engine_css ) );
        }

        $asset_file = VuloCart()->plugin_path . 'assets/js/storefront.asset.php';

        if ( ! file_exists( $asset_file ) ) {
            return;
        }

        $asset = require $asset_file;

        $dependencies = array_unique( array_merge( $asset['dependencies'], array( 'vulocart-block-vendors' ) ) );

        wp_enqueue_script(
            'vulocart-storefront-bootstrap',
            VuloCart()->plugin_url . 'assets/js/storefront.js',
            $dependencies,
            $asset['version'],
            true
        );
    }
}
