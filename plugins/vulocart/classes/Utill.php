<?php
/**
 * Utill class file.
 *
 * @package VuloCart
 */

namespace VuloCart;

defined( 'ABSPATH' ) || exit;

/**
 * Central registry of table names, option keys and setting defaults used across the plugin.
 *
 * @class       Utill class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Utill {

    /**
     * Custom table names, keyed by short entity id. Only the core product table is listed here; each module (Cart,
     * Order, ...) names its own tables in its own Install.php.
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
     * Option name the list of active module ids is stored under (see Modules::load_active_modules()).
     *
     * @var string
     */
    const ACTIVE_MODULES_DB_KEY = 'vulocart_all_active_module_list';

    /**
     * Option name the Settings screens read and write: a single flat `wp_options` row.
     *
     * @var string
     */
    const SETTINGS_KEY = 'vulocart_settings';

    /**
     * Every known setting key and its default, so a missing or never-saved key still has a sensible value. Grouped by
     * the Settings tabs (src/settings/*.ts).
     *
     * On/off toggle fields (`type: 'checkbox', look: 'toggle'`) are stored as an array, not a boolean: the array
     * holds the one selected option's value when on and is empty when off. Every toggle default follows that shape.
     *
     * Most values are read by Shipping\Application\ShippingService, Taxes\Application\TaxService,
     * Payment\Application\PaymentService and Order\Application\OrderService::create_from_cart(), which use them to
     * work out the shipping cost, tax amount and initial payment status on the server. Checkout options (guest
     * checkout, terms, phone number) are sent to the checkout block by Block::print_frontend_config() and checked
     * again on the server by Order\Rest::create_item().
     *
     * There is no on/off key for MCP or AI: turning those on is done by activating their module on the Modules
     * screen. Only MCP's API key (`mcp_api_key`) is stored here, and AI has no stored setting at all (it is a
     * VuloCloud connection, see classes/AI/VuloCloudConnection.php).
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
     * Records an unexpected exception to the PHP error log, when the Advanced tab's "Enable debug logging" is on.
     * Used by Modules::load_active_modules() so one broken module does not take the whole site down.
     *
     * @param \Throwable $exception The exception to record.
     * @return void
     */
    public function log( \Throwable $exception ): void {
        $settings = wp_parse_args( get_option( self::SETTINGS_KEY, array() ), self::SETTINGS_DEFAULTS );

        if ( empty( $settings['enable_debug_logging'] ) ) {
            return;
        }

        // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- gated behind the opt-in Advanced tab setting "Enable debug logging".
        error_log( sprintf( '[VuloCart] %s', $exception->getMessage() ) );
    }

    /**
     * Whether VuloCart Pro is installed, active and licensed. Asks Pro through the `kothay_dabba_vulocart` filter
     * (false when Pro is not present) instead of checking for the plugin directly.
     *
     * @return bool
     */
    public function is_khali_dabba(): bool {
        return (bool) apply_filters( 'kothay_dabba_vulocart', false );
    }
}
