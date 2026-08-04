<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Ai;

use VuloCart\AI\AiClient;
use VuloCart\AI\AiProviderConfigUtil;
use VuloCart\AI\AiUsageLogUtil;
use VuloCart\AI\ProviderRegistry;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart AI Module.
 *
 * Same toggleable-addon shape as VuloCart\Cart\Module/VuloCart\Order\Module
 * (module-architecture.md). The real AI provider engine
 * (classes/AI/ — adapters, encrypted BYOK storage, ProviderRegistry,
 * AiClient) has now landed, exactly where this module's own original
 * docblock said it would: "its Frontend/Rest/`src/` pieces slot into this
 * same Module.php". This module's real effect:
 *
 * 1. Making "AI" a real, toggleable entry on the Modules page — activating
 *    it is what makes `AiClient` resolvable at all (same
 *    `VuloCart()->ai_client` magic-property pattern
 *    `Shipping\Module`/`Taxes\Module` already use for their own services),
 *    so `Order\Application\OrderService::resolve_optional_service()`'s
 *    "gracefully absent" pattern is exactly how a Pro AI feature module
 *    should reach for it too.
 * 2. Registering `/ai/providers`/`/ai/usage` (Rest.php) — BYOK key
 *    management and the usage log.
 * 3. Owning `vulocart_ai_provider_configs`/`vulocart_ai_usage_log`
 *    (Install.php).
 *
 * The engine deliberately lives in this FREE module rather than
 * `vulocart-pro` — same "the engine is free infrastructure, Pro modules
 * are what's built on it" split vulopilot's own AI-ARCHITECTURE.md
 * documents for `classes/AIProviders/` there. `vulocart-pro`'s own
 * CatalogAi/CheckoutAi/SupportAi/VectorSearch modules are the Pro-gated
 * features built on top of this.
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * Container for this module's own class instances.
     *
     * @var array
     */
    private $container = array();

    /**
     * Module constructor.
     */
    public function __construct() {
        new Install();

        $this->init_classes();
    }

    /**
     * @return void
     */
    public function init_classes() {
        $this->container['registry']   = new ProviderRegistry();
        $this->container['configs']    = new AiProviderConfigUtil();
        $this->container['usage_log']  = new AiUsageLogUtil();
        $this->container['client']     = new AiClient( $this->container['registry'], $this->container['usage_log'] );
        $this->container['rest']       = new Rest( $this->container['registry'], $this->container['configs'], $this->container['usage_log'] );

        // Same `VuloCart()->shipping_service = ...` pattern Shipping\Module
        // uses — makes the client reachable from any Pro module without a
        // hard dependency, via the same graceful
        // `try { VuloCart()->ai_client } catch (\Exception $e) { null }`
        // shape OrderService::resolve_optional_service() already
        // documents for Shipping/Taxes/Payment.
        VuloCart()->ai_client           = $this->container['client'];
        VuloCart()->ai_provider_registry = $this->container['registry'];

        add_action( 'admin_menu', array( $this, 'register_menu' ) );
    }

    /**
     * Registers the "Settings" submenu under the top-level AI menu
     * (Menu.php::add_ai_menu()) — the BYOK provider configuration screen.
     * Every other submenu under `vulocart-ai` (Catalog/Checkout/Support/
     * Search) is registered by vulocart-pro's own AI feature modules,
     * same "Free owns top-level chrome, Pro fills it in" split
     * `ShippingEngine\Module::register_menu()`'s own docblock documents.
     *
     * @return void
     */
    public function register_menu() {
        add_submenu_page(
            'vulocart-ai',
            __( 'AI Settings', 'vulocart' ),
            __( 'Settings', 'vulocart' ),
            'manage_options',
            'vulocart-ai&view=settings',
            array( $this, 'render_page' )
        );
    }

    /**
     * @return void
     */
    public function render_page() {
        echo '<div id="vulocart-ai-admin-root"></div>';
    }

    /**
     * Magic getter for this module's own container.
     *
     * @param string $class_name Container key to retrieve.
     * @return mixed
     * @throws \Exception If the requested key does not exist in the container.
     */
    public function __get( $class_name ) { // phpcs:ignore Universal.NamingConventions.NoReservedKeywordParameterNames.classFound
        if ( array_key_exists( $class_name, $this->container ) ) {
            return $this->container[ $class_name ];
        }

        throw new \Exception( sprintf( 'Call to unknown class %s.', esc_html( $class_name ) ) );
    }
}
