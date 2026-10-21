<?php
/**
 * VuloCart class file.
 *
 * @package VuloCart
 */

namespace VuloCart;

defined( 'ABSPATH' ) || exit;

/**
 * Plugin bootstrap singleton: a plain-array container with magic `__get` / `__set`, created once by the global
 * `VuloCart()` accessor. VuloCart does not depend on WooCommerce (it keeps its own tables), so it boots on
 * `plugins_loaded`.
 *
 * @class       VuloCart class
 * @version     1.0.0
 * @author      VuloLabs
 */
final class VuloCart {

    /**
     * Holds the single instance of the class (singleton pattern).
     *
     * @var self|null
     */
    private static $instance = null;

    /**
     * The main plugin file path.
     *
     * @var string
     */
    private $file = '';

    /**
     * Container for shared class instances and config values.
     *
     * @var array
     */
    private $container = array();

    /**
     * Class constructor.
     *
     * @param string $file Main plugin file path.
     */
    public function __construct( $file ) {
        require_once trailingslashit( dirname( $file ) ) . '/config.php';

        $this->file                        = $file;
        $this->container['plugin_url']     = trailingslashit( plugins_url( '', $file ) );
        $this->container['plugin_path']    = trailingslashit( dirname( $file ) );
        $this->container['plugin_base']    = plugin_basename( $file );
        $this->container['version']        = VULOCART_PLUGIN_VERSION;
        $this->container['rest_namespace'] = 'vulocart/v1';
        $this->container['plugin_slug']    = VULOCART_PLUGIN_SLUG;

        register_activation_hook( $file, array( $this, 'activate' ) );
        register_deactivation_hook( $file, array( $this, 'deactivate' ) );

        add_action( 'plugins_loaded', array( $this, 'init_plugin' ) );
        add_action( 'init', array( $this, 'load_plugin_textdomain' ) );
    }

    /**
     * Runs on plugin activation. Sets a flag instead of creating tables, because `register_activation_hook()` fires
     * before `plugins_loaded`, when the `dbDelta()` include is not guaranteed to be available. The tables are created
     * later, in init_plugin().
     *
     * @return void
     */
    public function activate() {
        add_option( Utill::OTHER_SETTINGS['run_installer'], true );
        flush_rewrite_rules();
    }

    /**
     * Runs on plugin deactivation.
     *
     * @return void
     */
    public function deactivate() {
        flush_rewrite_rules();
    }

    /**
     * Boots the plugin once every other active plugin has loaded.
     *
     * @return void
     */
    public function init_plugin() {
        add_action( 'init', array( $this, 'init_classes' ), 0 );

        if ( get_option( Utill::OTHER_SETTINGS['run_installer'] ) ) {
            new Install();
            delete_option( Utill::OTHER_SETTINGS['run_installer'] );
        }
    }

    /**
     * Initializes VuloCart's classes and fires `vulocart_loaded`, the action VuloCart Pro and third-party extensions
     * wait for before booting.
     *
     * @return void
     */
    public function init_classes() {
        $this->container['util'] = new Utill();

        // Each repository interface is bound to its concrete class here, and only here. Every other class asks the
        // container for the interface, so switching storage engines is a change to this binding.
        $this->container['service_container'] = new ServiceContainer();
        $this->container['service_container']->singleton(
            Domain\Product\ProductRepositoryInterface::class,
            function () {
                return new Infrastructure\Database\WPDBProductRepository();
            }
        );
        $this->container['service_container']->singleton(
            Domain\Term\TermRepositoryInterface::class,
            function () {
                return new Infrastructure\Database\WPDBTermRepository();
            }
        );
        $this->container['service_container']->singleton(
            Domain\Attribute\AttributeRepositoryInterface::class,
            function () {
                return new Infrastructure\Database\WPDBAttributeRepository();
            }
        );
        $this->container['service_container']->singleton(
            Domain\Review\ReviewRepositoryInterface::class,
            function () {
                return new Infrastructure\Database\WPDBReviewRepository();
            }
        );
        $this->container['service_container']->singleton(
            Domain\Checkout\CheckoutSessionRepositoryInterface::class,
            function () {
                return new Infrastructure\Database\WPDBCheckoutSessionRepository();
            }
        );

        $this->container['event_dispatcher'] = new Events\EventDispatcher();

        $this->container['product_service'] = new Application\ProductService(
            $this->container['service_container']->make( Domain\Product\ProductRepositoryInterface::class ),
            $this->container['event_dispatcher']
        );

        // Categories/Brands/Collections/Attributes/Reviews (Products menu)
        // - core, always-loaded infrastructure the same way Product is, not
        // a toggleable module (Install.php's own docblock).
        $this->container['term_service']      = new Application\TermService(
            $this->container['service_container']->make( Domain\Term\TermRepositoryInterface::class ),
            $this->container['event_dispatcher']
        );
        $this->container['attribute_service'] = new Application\AttributeService(
            $this->container['service_container']->make( Domain\Attribute\AttributeRepositoryInterface::class ),
            $this->container['event_dispatcher']
        );
        // Reviews are the ProductReviews module (modules/ProductReviews): it builds `review_service` when it is on.

        // The Checkout Engine's own orchestration core (Application\
        // CheckoutService's own docblock) - core infrastructure like
        // Product/Term/Attribute/Review above, not a toggleable module:
        // every checkout delivery mode (the free block, vulocart-pro's
        // Popup/Embedded/Hosted modes) needs session tracking to exist
        // regardless of which step modules happen to be active.
        $this->container['checkout_service'] = new Application\CheckoutService(
            $this->container['service_container']->make( Domain\Checkout\CheckoutSessionRepositoryInterface::class ),
            $this->container['event_dispatcher']
        );

        // The module loader is created before the REST dispatcher, so a module constructor can register REST
        // controllers (`vulocart_rest_controllers`) or react to `vulocart_activated_module_{id}` before those hooks
        // fire.
        $this->container['modules'] = new Modules();

        // Cart, Order and the checkout modules are activated once on a new install, with a one-time flag option each.
        // Activation merges into the stored list of active modules, and because the flag is stored, switching a
        // module off later is respected and it is never turned back on. A separate flag exists for each group so a
        // site that was seeded by an earlier version still gets the modules added later. `$modules_activated_now`
        // stops load_active_modules() from running a second time in the same request, because activate_modules()
        // already calls it.
        $modules_activated_now = false;

        if ( ! get_option( 'vulocart_cart_order_modules_seeded' ) ) {
            $this->container['modules']->activate_modules( array( 'cart', 'order' ) );
            update_option( 'vulocart_cart_order_modules_seeded', true );
            $modules_activated_now = true;
        }

        if ( ! get_option( 'vulocart_checkout_modules_seeded' ) ) {
            $this->container['modules']->activate_modules(
                array( 'customer', 'address', 'shipping', 'taxes', 'payment', 'review', 'confirmation' )
            );
            update_option( 'vulocart_checkout_modules_seeded', true );
            $modules_activated_now = true;
        }

        // Customer reviews became a module; a store that already had them keeps them, once.
        if ( ! get_option( 'vulocart_reviews_module_seeded' ) ) {
            $this->container['modules']->activate_modules( array( 'product-reviews' ) );
            update_option( 'vulocart_reviews_module_seeded', true );
            $modules_activated_now = true;
        }

        if ( ! $modules_activated_now ) {
            $this->container['modules']->load_active_modules();
        }

        $this->container['admin']        = new Admin\Menu();
        $this->container['rest']         = new RestAPI\Rest();
        $this->container['cors']         = new RestAPI\Cors();
        $this->container['block']        = new Block();
        $this->container['storefront']   = new Storefront\Storefront();
        $this->container['permalinks']   = new Storefront\Permalinks();
        $this->container['order_emails'] = new Notifications\OrderEmails();

        $previous_version = get_option( Utill::OTHER_SETTINGS['plugin_db_version'], '' );
        if ( version_compare( $previous_version, $this->container['version'], '<' ) ) {
            new Install();
        }

        // Self-heals a site that is already on the current version but never got the products `published_at` column.
        Install::ensure_product_published_at();

        do_action( 'vulocart_loaded' );
    }

    /**
     * Loads translation files.
     *
     * @return void
     */
    public function load_plugin_textdomain() {
        if ( version_compare( $GLOBALS['wp_version'], '6.7', '<' ) ) {
            load_plugin_textdomain( 'vulocart', false, plugin_basename( dirname( $this->file ) ) . '/languages' );
        } else {
            load_textdomain( 'vulocart', WP_LANG_DIR . '/plugins/vulocart-' . determine_locale() . '.mo' );
        }
    }

    /**
     * Magic getter for the container.
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

    /**
     * Magic setter for the container.
     *
     * @param string $class_name Container key to store under.
     * @param mixed  $value      Value to store.
     * @return void
     */
    public function __set( $class_name, $value ) { // phpcs:ignore Universal.NamingConventions.NoReservedKeywordParameterNames.classFound
        $this->container[ $class_name ] = $value;
    }

    /**
     * Returns the single instance of this class, creating it if necessary.
     *
     * @param string $file Main plugin file path.
     * @return self
     */
    public static function init( $file ) {
        if ( null === self::$instance ) {
            self::$instance = new self( $file );
        }

        return self::$instance;
    }
}
