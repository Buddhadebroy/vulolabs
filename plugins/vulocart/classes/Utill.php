<?php
/**
 * Utill class file.
 *
 * @package VuloCart
 */

namespace VuloCart;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Utill class.
 *
 * Central registry of custom table names and installation-tracking option
 * keys, mirroring VuloPilot\Utill's role for its own product line.
 *
 * @class       Utill class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Utill {

    /**
     * Custom $wpdb table names, keyed by short entity id. Only 'product'
     * lives here - Product is the plugin's always-on core entity. Cart and
     * Order own their own tables directly (`modules/Cart/Install.php`,
     * `modules/Order/Install.php`), not registered in this shared
     * registry, since they're real toggleable modules now - same
     * "module owns its own table names" convention `vulocart-pro`'s
     * Passport module already establishes (`Passport\Util::get_table()`
     * hardcodes its own table name rather than adding to the free
     * plugin's registry).
     *
     * @var array
     */
    const TABLES = array(
        'product' => 'vulocart_products',
    );

    /**
     * Option keys used by the bootstrap/Install flow.
     *
     * @var array
     */
    const OTHER_SETTINGS = array(
        'run_installer'     => 'vulocart_run_installer',
        'plugin_db_version' => 'vulocart_version',
    );

    /**
     * Option name the active-modules list is stored under - mirrors
     * VuloPilot\Utill::ACTIVE_MODULES_DB_KEY's role
     * for this product line's own `modules/` addon system
     * (module-architecture.md's discovery/loading mechanism, added here
     * for VuloCart via `Modules::load_active_modules()`).
     *
     * @var string
     */
    const ACTIVE_MODULES_DB_KEY = 'vulocart_all_active_module_list';

    /**
     * Option name VuloCart's settings screen reads/writes - a single flat
     * `wp_options` row, mirroring VuloPilot\Utill::VULOPILOT_SETTINGS_KEY
     * (not a per-tab-namespaced `admin_settings` shape,
     * which doesn't apply here since VuloCart has exactly one settings
     * tab so far).
     *
     * @var string
     */
    const SETTINGS_KEY = 'vulocart_settings';

    /**
     * Every known setting key and its default, so a missing/never-saved
     * key still has a sane value instead of null - same role as
     * VuloPilot\Utill::VULOPILOT_SETTINGS_DEFAULTS. Grouped by the
     * Settings screen's 12 tabs (src/settings/*.ts), one section per tab.
     *
     * Boolean-style toggle fields (`type: 'checkbox', look: 'toggle'`)
     * store an array, not a literal bool - zyra's InputRenderer/
     * MultiCheckboxInput persists a toggle as the array of its one
     * selected option's value when on, `array()` when off (verified
     * against @zyra/inputs' MultiCheckboxInput.tsx and
     * VuloPilot\Utill::VULOPILOT_SETTINGS_DEFAULTS's own
     * `enable_debug_logging => array()` default for the identical
     * pattern) - every toggle default below follows that shape.
     *
     * `enable_debug_logging` (Utill::log()), the three Email tab keys
     * (Notifications\OrderEmails), `cart_expiry_days`
     * (Cart\Application\CartCleanupScheduler's daily cron),
     * `guest_checkout_enabled`/`require_terms_acceptance`/
     * `checkout_terms_url` (Block.php's `print_frontend_config()` →
     * src/blocks/checkout/Checkout.tsx, plus Order\Rest::create_item()'s
     * own server-side guest-checkout re-check), and now the whole
     * Payments/Shipping/Taxes section are all actually read by business
     * logic: `Shipping\Application\ShippingService`,
     * `Taxes\Application\TaxService`, and `Payment\Application\
     * PaymentService` (each its own toggleable module now) read these
     * directly, and `Order\Application\OrderService::create_from_cart()`
     * resolves whichever of those modules is active to compute
     * `Order::$shipping_cost`/`$tax_amount`/initial payment status -
     * `total` is no longer always `=== subtotal` (that docblock line on
     * `Order\Domain\Order` is stale as of the Customer/Address/Shipping/
     * Taxes/Payment/Review/Confirmation modules). `require_phone_number`
     * (Checkout section) is enforced directly by `Order\Rest::
     * create_item()`, same "client hint, server re-check" pattern
     * `guest_checkout_enabled` already uses.
     *
     * Settings nothing read were removed (default product status/type/visibility, allow_guest_cart,
     * default_shipping_class, the public REST API toggle and its rate limit) - a stored value stays harmless
     * in an existing install's option.
     *
     * Deliberately no `enable_mcp_server`/`enable_ai_recommendations` keys
     * (removed after MCP/AI were built) - both were a Settings-tab
     * toggle duplicating what module activation on the Modules page
     * already does once MCP/AI ship as their own modules
     * (module-architecture.md), two sources of truth for one on/off
     * state. src/settings/Integrations/Mcp.ts's own docblock explains the
     * same reasoning; only its *configuration* field (`mcp_api_key`)
     * remains here. AI has no stored setting at all - it's a VuloCloud
     * connection (classes/AI/VuloCloudConnection.php).
     *
     * @var array
     */
    const SETTINGS_DEFAULTS = array(
        // General.
        'default_currency'              => 'USD',

        // Frontend.
        // Storefront listing template (src/blocks/products/ProductsListing.tsx): grid|compact|list|showcase.
        'listing_template'              => 'grid',
        'listing_columns'               => '4',

        // Catalog.
        'low_stock_threshold'           => 5,
        // Adding a product starts on the "What are you selling?" screen; off = pick the type on the product page.
        'ask_product_type'              => array( 'ask_product_type' ),

        // Cart.
        'cart_expiry_days'              => 14,

        // Checkout.
        'guest_checkout_enabled'        => array( 'guest_checkout_enabled' ),
        'require_terms_acceptance'      => array(),
        'checkout_terms_url'            => '',
        'require_phone_number'          => array(),
        // Domain\Checkout\CheckoutMode::free() - which of the two free
        // delivery modes Checkout.tsx mounts CheckoutEngine in.
        'checkout_mode'                 => \VuloCart\Domain\Checkout\CheckoutMode::MULTI_STEP,

        // Extra ways to present checkout (VuloCart Pro): any of popup, drawer, embedded, hosted. Empty until chosen.
        'checkout_styles'               => array(),

        // Where "Proceed to checkout" / "Buy now" lead: page, or (VuloCart Pro) popup, drawer, hosted, one_click.
        'checkout_delivery'             => 'page',

        // The steps the checkout shows, in their natural order. Customer and Payment are always kept.
        'checkout_steps'                => array( 'customer', 'address', 'shipping', 'payment', 'review' ),
        'checkout_extras'             => array(),

        // The optional fields the checkout shows: the buyer's name, a phone number, the address's second line.
        'checkout_fields'               => array( 'name', 'phone', 'address_2' ),

        // Other checkout extras (VuloCart Pro): any of one-click, links, notes, autocomplete.
        'checkout_extras'             => array(),

        // Payments.
        'enable_manual_payment'         => array( 'enable_manual_payment' ),
        'default_payment_status'        => 'pending',
        'enable_bank_transfer'          => array(),
        'bank_transfer_instructions'    => '',
        'enable_cash_on_delivery'       => array(),
        'payment_capture_mode'          => 'immediate',

        // Shipping.
        'flat_rate_shipping_cost'       => 0,

        // Taxes.
        'default_tax_rate_percent'      => 0,
        'prices_include_tax'            => array(),
        // Where tax is worked out for: the `shipping` or `billing` address, or the `store`'s own. Shipping can be taxed too.
        'tax_based_on'                  => 'shipping',
        'tax_shipping'                  => array( 'tax_shipping' ),
        'store_country'                 => '',
        'store_state'                   => '',

        // Email.
        'send_order_confirmation_email' => array( 'send_order_confirmation_email' ),
        'send_status_update_email'      => array( 'send_status_update_email' ),
        'notification_from_email'       => '',

        // MCP.
        'mcp_api_key'                   => '',

        // Advanced.
        'enable_debug_logging'          => array(),
    );

    /**
     * Records an unexpected exception - Modules::load_active_modules()'s
     * catch-and-skip path calls this so one broken module's constructor
     * (a third party's, or vulocart-pro's) doesn't take the whole site
     * down. Gated behind the Advanced tab's `enable_debug_logging` toggle
     * now that a Settings screen exists to hold it - mirrors
     * VuloPilot\Utill::log()'s identical pattern exactly.
     *
     * @param \Throwable $exception The exception to record.
     * @return void
     */
    public function log( \Throwable $exception ): void {
        $settings = wp_parse_args( get_option( self::SETTINGS_KEY, array() ), self::SETTINGS_DEFAULTS );

        if ( empty( $settings['enable_debug_logging'] ) ) {
            return;
        }

        // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- gated behind an explicit, opt-in admin setting (Advanced tab), matching VuloPilot\Utill::log()'s identical pattern.
        error_log( sprintf( '[VuloCart] %s', $exception->getMessage() ) );
    }

    /**
     * Whether VuloCart Pro is installed, active, and license-active -
     * mirrors VuloPilot\Utill::is_khali_dabba()'s role
     * for this product line. VuloCartPro::check_pro_active() is the only
     * thing that ever hooks `kothay_dabba_vulocart` (default false when
     * Pro isn't present), same filter-based "ask Pro, don't check for it
     * directly" pattern the other product families use.
     *
     * @return bool
     */
    public function is_khali_dabba(): bool {
        return (bool) apply_filters( 'kothay_dabba_vulocart', false );
    }
}
