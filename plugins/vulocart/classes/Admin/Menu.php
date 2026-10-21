<?php
/**
 * Menu class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Admin;

defined( 'ABSPATH' ) || exit;

/**
 * Registers VuloCart's admin menus and mounts the React admin app.
 *
 * The main "VuloCart" menu has one submenu entry per tab (Dashboard, Reviews, Settings), each pointing to
 * `vulocart#&tab={tab}`. The part after `#` never reaches the server, so every entry loads the same page
 * (render_admin_page()); the client-side route registry (src/routeRegistry.ts, src/routes.ts, App.tsx) reads `tab`
 * from `location.hash` to decide what to show.
 *
 * Orders, Products, Customers and Marketing have their own top-level menus. Inventory, Shipping, AI and Workflows are
 * submenus of the "VuloCart" menu with their own page slugs (they are separate screens, not tabs). Analytics has no
 * menu entry of its own: it redirects to the dashboard. See the add_*_menu() methods below.
 *
 * @class       Menu class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Menu {

    /**
     * Menu constructor.
     */
    public function __construct() {
        add_action( 'admin_menu', array( $this, 'add_menu' ) );
        add_action( 'admin_menu', array( $this, 'add_orders_menu' ) );
        add_action( 'admin_menu', array( $this, 'add_products_menu' ) );
        add_action( 'admin_menu', array( $this, 'add_customers_menu' ) );
        add_action( 'admin_menu', array( $this, 'add_inventory_menu' ) );
        add_action( 'admin_menu', array( $this, 'add_shipping_menu' ) );
        add_action( 'admin_menu', array( $this, 'add_ai_menu' ) );
        add_action( 'admin_menu', array( $this, 'add_workflows_menu' ) );
        add_action( 'admin_menu', array( $this, 'add_marketing_menu' ) );
        add_action( 'admin_menu', array( $this, 'order_submenu' ), 999 );
        add_action( 'admin_menu', array( $this, 'order_marketing_submenu' ), 999 );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_script' ) );
        add_filter( 'submenu_file', array( $this, 'highlight_current_submenu' ), 10, 2 );
    }

    /**
     * Registers the VuloCart top-level admin page and its tab submenus.
     *
     * @return void
     */
    public function add_menu() {
        add_menu_page(
            'VuloCart',
            'VuloCart',
            'manage_options',
            'vulocart',
            array( $this, 'render_admin_page' ),
            'dashicons-cart',
            56.8
        );

        $tabs = array( 'dashboard' => __( 'Dashboard', 'vulocart' ) );

        // Reviews is the ProductReviews module: its tab exists while the module is on.
        if ( VuloCart()->modules->is_active( 'product-reviews' ) ) {
            $tabs['reviews'] = __( 'Reviews', 'vulocart' );
        }

        $tabs['settings'] = __( 'Settings', 'vulocart' );

        foreach ( $tabs as $slug => $label ) {
            add_submenu_page(
                'vulocart',
                $label,
                $label,
                'manage_options',
                'vulocart#&tab=' . $slug,
                '__return_null'
            );
        }

        // add_menu_page() always adds a first submenu item that repeats the parent title ("VuloCart") and duplicates
        // the explicit "Dashboard" tab, so it is removed.
        remove_submenu_page( 'vulocart', 'vulocart' );
    }

    /**
     * Puts the VuloCart submenu in its intended order. The entries are registered by separate methods (and Pro
     * adds more), so registration order alone cannot give this order; this runs after all of them.
     * Anything not listed (an entry a Pro module adds) sits just before Settings.
     *
     * @return void
     */
    public function order_submenu() {
        global $submenu;

        if ( empty( $submenu['vulocart'] ) ) {
            return;
        }

        $order = array(
            'vulocart#&tab=dashboard',
            'ai',
            'workflows',
            'inventory',
            'shipping',
            'vulocart#&tab=reviews',
        );

        $last = 'vulocart#&tab=settings';
        $rank = static function ( $item ) use ( $order, $last ) {
            $position = array_search( $item[2], $order, true );

            if ( false !== $position ) {
                return $position;
            }

            return $last === $item[2] ? 1000 : 500;
        };

        $items = array_values( $submenu['vulocart'] );

        usort(
            $items,
            static function ( $a, $b ) use ( $rank ) {
                return $rank( $a ) <=> $rank( $b );
            }
        );

        $submenu['vulocart'] = $items; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- reordering core's own menu array is the supported way to order submenus.
    }

    /**
     * Tidies the Marketing submenu, whose entries are all added by vulocart-pro modules. Drops the item
     * add_menu_page() generates from the menu title ("Marketing", which only showed Coupons a second time)
     * and puts the rest in order: promotions, then recovery, then checkout tools. An entry not listed sits last.
     *
     * @return void
     */
    public function order_marketing_submenu() {
        global $submenu;

        if ( empty( $submenu['marketing'] ) ) {
            return;
        }

        $order = array( 'coupons', 'pricing-rules', 'gift-cards', 'abandoned-checkouts', 'checkout-links' );
        $rank  = static function ( $item ) use ( $order ) {
            $position = array_search( str_replace( 'marketing&view=', '', $item[2] ), $order, true );

            return false === $position ? 500 : $position;
        };

        $items = array_values(
            array_filter(
                $submenu['marketing'],
                static function ( $item ) {
                    return 'marketing' !== $item[2];
                }
            )
        );

        usort(
            $items,
            static function ( $a, $b ) use ( $rank ) {
                return $rank( $a ) <=> $rank( $b );
            }
        );

        $submenu['marketing'] = $items; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- see order_submenu().
    }

    /**
     * Registers Orders as its own top-level admin menu, separate from the "VuloCart" menu.
     *
     * "All Orders" and "Add New" are the only submenus. Draft and refunded orders are reached with the status pills
     * on the orders list itself (`&filter=draft` / `&filter=refunds` still preselect them), not their own menu items.
     *
     * @return void
     */
    public function add_orders_menu() {
        add_menu_page(
            __( 'VuloCart Orders', 'vulocart' ),
            __( 'Orders', 'vulocart' ),
            'manage_options',
            'orders',
            array( $this, 'render_orders_admin_page' ),
            'dashicons-list-view',
            56.4
        );

        add_submenu_page(
            'orders',
            __( 'All Orders', 'vulocart' ),
            __( 'All Orders', 'vulocart' ),
            'manage_options',
            'orders',
            array( $this, 'render_orders_admin_page' )
        );

        add_submenu_page(
            'orders',
            __( 'Add New', 'vulocart' ),
            __( 'Add New', 'vulocart' ),
            'manage_options',
            'orders&action=add',
            array( $this, 'render_orders_admin_page' )
        );
    }

    /**
     * Registers Products as its own top-level admin menu, separate from the "VuloCart" menu.
     *
     * "All Products" and "Add New" use the same `products` page slug; `&action=add` is only a query-string addition.
     * Categories, Collections, Brands, Tags, Attributes, Product Types, Inventory and Reviews work the same way
     * through `&view=`. `src/pages/Products/Products.tsx` reads `action`, `id` and `view` to decide which screen to
     * render.
     *
     * @return void
     */
    public function add_products_menu() {
        add_menu_page(
            __( 'VuloCart Products', 'vulocart' ),
            __( 'Products', 'vulocart' ),
            'manage_options',
            'products',
            array( $this, 'render_products_admin_page' ),
            'dashicons-archive',
            56.1
        );

        add_submenu_page(
            'products',
            __( 'All Products', 'vulocart' ),
            __( 'All Products', 'vulocart' ),
            'manage_options',
            'products',
            array( $this, 'render_products_admin_page' )
        );

        add_submenu_page(
            'products',
            __( 'Add New', 'vulocart' ),
            __( 'Add New', 'vulocart' ),
            'manage_options',
            'products&action=add',
            array( $this, 'render_products_admin_page' )
        );

        $sub_views = array(
            'categories'     => __( 'Categories', 'vulocart' ),
            'collections'    => __( 'Collections', 'vulocart' ),
            'brands'         => __( 'Brands', 'vulocart' ),
            'tags'           => __( 'Tags', 'vulocart' ),
            'attributes'     => __( 'Attributes', 'vulocart' ),
            'product-types' => __( 'Product Types', 'vulocart' ),
        );

        foreach ( $sub_views as $slug => $label ) {
            add_submenu_page(
                'products',
                $label,
                $label,
                'manage_options',
                'products&view=' . $slug,
                array( $this, 'render_products_admin_page' )
            );
        }
    }

    /**
     * Registers Customers as its own top-level admin menu, separate from the "VuloCart" menu, now that a customer is
     * a stored entity (`Customer\Install.php`).
     *
     * Pro modules extend the customer detail view through the `vulocart_customer_detail_sections` filter
     * (`src/pages/Customers/CustomerDetail.tsx`). Wishlist, saved carts, groups, segments, loyalty and communication
     * history live in vulocart-pro's CustomerGrowth module.
     *
     * @return void
     */
    public function add_customers_menu() {
        add_menu_page(
            __( 'VuloCart Customers', 'vulocart' ),
            __( 'Customers', 'vulocart' ),
            'manage_options',
            'customers',
            array( $this, 'render_customers_admin_page' ),
            'dashicons-groups',
            56.5
        );

        add_submenu_page(
            'customers',
            __( 'All Customers', 'vulocart' ),
            __( 'All Customers', 'vulocart' ),
            'manage_options',
            'customers',
            array( $this, 'render_customers_admin_page' )
        );
    }

    /**
     * Registers Inventory as its own dedicated top-level WP admin menu -
     * same "deserves first-class space, not a settings-style tab"
     * treatment `add_orders_menu()`/`add_products_menu()`/
     * `add_customers_menu()`'s own docblocks establish. Unlike Customers,
     * this plugin owns no Inventory-engine entity of its own - Warehouses/
     * Purchase Orders/Transfers/Reservations/Batch & Serial Tracking/
     * Forecasting all live in `vulocart-pro`'s own Inventory module, same
     * "Free owns top-level chrome, Pro fills it in via a filtered router"
     * split `add_customers_menu()`'s own docblock documents for
     * CustomerGrowth. This is distinct from the existing
     * `products&view=inventory` sub-page (a simple bulk stock-
     * quantity/status editor scoped to one product at a time,
     * RestAPI\Controllers\Inventory.php) - that page is left untouched;
     * this top-level menu is for the warehouse-aware engine sitting above
     * it, not a replacement.
     *
     * Inventory is one submenu of VuloCart; stock levels, warehouses, suppliers, purchase orders and the rest are
     * tabs on that page (`&view=`), filled in by `vulocart-pro` through `vulocart_inventory_view`.
     *
     * @return void
     */
    public function add_inventory_menu() {
        add_submenu_page(
            'vulocart',
            __( 'VuloCart Inventory', 'vulocart' ),
            __( 'Inventory', 'vulocart' ),
            'manage_options',
            'inventory',
            array( $this, 'render_inventory_admin_page' )
        );
    }

    /**
     * Registers Fulfillment (page slug `shipping`) as its own dedicated top-level WP admin menu -
     * same "Free owns top-level chrome, Pro fills it in" split
     * `add_inventory_menu()`'s own docblock documents. Distinct from the
     * free Shipping module's own checkout-step settings (Settings tab,
     * `flat_rate_shipping_cost`) - this menu is for
     * `vulocart-pro`'s own Fulfillment module (Zones/Rates/Packaging/
     * Shipments/Labels/Returns/Pickup), which extends
     * `ShippingService::get_available_methods()` via the
     * `vulocart_shipping_methods` filter rather than replacing it.
     *
     * Fulfillment is one submenu of VuloCart; shipments, returns and pickup are tabs on that page (`&view=`). Zones,
     * rates and packaging are configuration, so they live in Settings → Shipping, filled in by `vulocart-pro`'s Fulfillment module through `vulocart_fulfillment_view`.
     *
     * @return void
     */
    public function add_shipping_menu() {
        add_submenu_page(
            'vulocart',
            __( 'VuloCart Shipment', 'vulocart' ),
            __( 'Shipment', 'vulocart' ),
            'manage_options',
            'shipping',
            array( $this, 'render_shipping_admin_page' )
        );
    }

    /**
     * Registers AI as a single submenu of VuloCart. The page slug is `ai`, and
     * `&view=catalog|checkout|support|search` selects a tab on the same page. The free plugin owns the frame; each
     * tab is a vulocart-pro module (CatalogAi, CheckoutAi, SupportAi, VectorSearch) plugged into `vulocart_ai_view`.
     *
     * @return void
     */
    public function add_ai_menu() {
        add_submenu_page(
            'vulocart',
            __( 'VuloCart AI', 'vulocart' ),
            __( 'AI', 'vulocart' ),
            'manage_options',
            'ai',
            array( $this, 'render_ai_admin_page' )
        );
    }

    /**
     * Registers Workflows as a submenu of VuloCart. The page slug is `workflows`, and the editor and run links use
     * `&view=edit|runs&id=`. The free plugin has no view of its own here: the list, editor and run history belong to
     * vulocart-pro's WorkflowBuilder module, which plugs into `vulocart_workflows_view`.
     *
     * @return void
     */
    public function add_workflows_menu() {
        add_submenu_page(
            'vulocart',
            __( 'VuloCart Workflows', 'vulocart' ),
            __( 'Workflows', 'vulocart' ),
            'manage_options',
            'workflows',
            array( $this, 'render_workflows_admin_page' )
        );
    }

    /**
     * Registers Marketing as its own top-level admin menu. The free plugin owns the frame only; Coupons, Pricing
     * Rules, Gift Cards, Abandoned Checkout and Checkout Links are vulocart-pro modules that register their submenus
     * under `marketing` (ordered by order_marketing_submenu()).
     *
     * @return void
     */
    public function add_marketing_menu() {
        add_menu_page(
            __( 'VuloCart Marketing', 'vulocart' ),
            __( 'Marketing', 'vulocart' ),
            'manage_options',
            'marketing',
            array( $this, 'render_marketing_admin_page' ),
            'dashicons-megaphone',
            56.7
        );
    }

    /**
     * Renders the mount point the React bundle attaches to. The element needs the id and class `admin-main-wrapper`,
     * because the shared admin stylesheet applies its full-height page and `#wpcontent` reset rules to exactly that
     * id.
     *
     * @return void
     */
    public function render_admin_page() {
        echo '<div id="admin-main-wrapper" class="admin-main-wrapper"></div>';
    }

    /**
     * Renders the mount point for the standalone Orders admin app - a
     * different root element id than render_admin_page()'s, so
     * src/index.tsx can tell which top-level page it's mounting into and
     * render the right, self-contained app (see index.tsx's docblock).
     *
     * @return void
     */
    public function render_orders_admin_page() {
        echo '<div id="vulocart-orders-admin-root"></div>';
    }

    /**
     * Renders the mount point for the standalone Products admin app - see
     * render_orders_admin_page()'s docblock for why this is a separate
     * root element id rather than reusing render_admin_page()'s.
     *
     * @return void
     */
    public function render_products_admin_page() {
        echo '<div id="vulocart-products-admin-root"></div>';
    }

    /**
     * Renders the mount point for the standalone Customers admin app -
     * see render_orders_admin_page()'s docblock for why this is a
     * separate root element id rather than reusing render_admin_page()'s.
     *
     * @return void
     */
    public function render_customers_admin_page() {
        echo '<div id="vulocart-customers-admin-root"></div>';
    }

    /**
     * Renders the mount point for the standalone Inventory admin app - see
     * render_orders_admin_page()'s docblock for why this is a separate
     * root element id rather than reusing render_admin_page()'s.
     *
     * @return void
     */
    public function render_inventory_admin_page() {
        echo '<div id="vulocart-inventory-admin-root"></div>';
    }

    /**
     * Renders the mount point for the standalone Shipping admin app - see
     * render_orders_admin_page()'s docblock for why this is a separate
     * root element id rather than reusing render_admin_page()'s.
     *
     * @return void
     */
    public function render_shipping_admin_page() {
        echo '<div id="vulocart-shipping-admin-root"></div>';
    }

    /**
     * Renders the mount point for the standalone AI admin app - see
     * render_orders_admin_page()'s docblock for why this is a separate
     * root element id.
     *
     * @return void
     */
    public function render_ai_admin_page() {
        echo '<div id="vulocart-ai-admin-root"></div>';
    }

    /**
     * Renders the mount point for the standalone Marketing admin app - see
     * render_orders_admin_page()'s docblock for why this is a separate root element id.
     *
     * @return void
     */
    public function render_marketing_admin_page() {
        echo '<div id="vulocart-marketing-admin-root"></div>';
    }

    /**
     * Renders the mount point for the standalone Workflows admin app -
     * see render_orders_admin_page()'s docblock for why this is a
     * separate root element id.
     *
     * @return void
     */
    public function render_workflows_admin_page() {
        echo '<div id="vulocart-workflows-admin-root"></div>';
    }

    /**
     * Keeps the right submenu item highlighted on `?page=vulocart-x&view=y`
     * (and `&action=add`) screens. Every such item is registered with a slug
     * like `products&view=collections`, but WordPress matches the
     * active item against the `page` query value alone - which never equals that
     * slug - so it falls back to the first item ("All Products") and the
     * page you're on never looks selected. Returns the registered slug that
     * matches the current `view`/`action`, when one exists.
     *
     * @param string|null $submenu_file Submenu file WordPress resolved.
     * @param string      $parent_file  Parent menu file.
     * @return string|null
     */
    public function highlight_current_submenu( $submenu_file, $parent_file ) {
        global $submenu;

        $page = sanitize_key( (string) filter_input( INPUT_GET, 'page', FILTER_UNSAFE_RAW ) );

        if ( ! in_array( $page, array( 'products', 'orders', 'customers', 'inventory', 'shipping', 'ai', 'workflows', 'marketing' ), true ) || empty( $submenu[ $page ] ) ) {
            return $submenu_file;
        }

        $candidates = array();

        $view = sanitize_key( (string) filter_input( INPUT_GET, 'view', FILTER_UNSAFE_RAW ) );

        if ( '' !== $view ) {
            $candidates[] = $page . '&view=' . $view;
        }

        if ( 'add' === sanitize_key( (string) filter_input( INPUT_GET, 'action', FILTER_UNSAFE_RAW ) ) ) {
            $candidates[] = $page . '&action=add';
        }

        $registered = wp_list_pluck( $submenu[ $page ], 2 );

        foreach ( $candidates as $candidate ) {
            if ( in_array( $candidate, $registered, true ) ) {
                return $candidate;
            }
        }

        // Marketing has no item for its bare page (order_marketing_submenu() drops it); that page shows Coupons.
        if ( 'marketing' === $page && ! in_array( $page, $registered, true ) && in_array( 'marketing&view=coupons', $registered, true ) ) {
            return 'marketing&view=coupons';
        }

        return $submenu_file;
    }

    /**
     * Enqueues the React admin bundle on VuloCart's own screens only, and localizes `vulocartLocalizer`, a plugin-own
     * global (not `appLocalizer`). Its shape is what zyra's `configureZyra()` expects: `apiUrl` is the bare REST root
     * and `restUrl` is the namespace, because zyra builds links as `${apiUrl}/${restUrl}/${endpoint}`.
     *
     * Every top-level screen (main, Orders, Products, Customers and so on) loads the same bundle; src/index.tsx
     * decides which app to render from the root element id present in the page.
     *
     * The check reads the `page` query value, not `$hook_suffix`. A Pro module registers its pages as separate submenu pages
     * (for example `products&view=suppliers`), and WordPress turns that whole string into a hook suffix like
     * `admin_page_products&view=suppliers`, never `toplevel_page_products`, so a hook suffix check would never match
     * those pages and the app would not load on them. The `page` value is always the plain page slug.
     *
     * @param string $hook_suffix Current admin page hook suffix - unused, see above.
     * @return void
     */
    public function enqueue_admin_script( $hook_suffix ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
        $current_page   = sanitize_key( (string) filter_input( INPUT_GET, 'page', FILTER_UNSAFE_RAW ) );
        $vulocart_pages = array( 'vulocart', 'orders', 'products', 'customers', 'inventory', 'shipping', 'ai', 'workflows', 'marketing' );

        if ( ! in_array( $current_page, $vulocart_pages, true ) ) {
            return;
        }

        // Registers `wp.media()` (media-views/media-editor + the attachment
        // browser markup) - the Product edit page's Featured Image/Gallery
        // fields (zyra's `FileInput`, ProductEdit.tsx) call `wp.media()`
        // directly, same real WordPress media-library integration every
        // other admin screen with an image picker uses; without this call
        // registered, `wp.media` is simply undefined on the page.
        wp_enqueue_media();

        $asset_file = VuloCart()->plugin_path . 'assets/js/index.asset.php';

        if ( ! file_exists( $asset_file ) ) {
            return;
        }

        $asset = require $asset_file;

        // webpack's splitChunks puts every node_modules dependency the entry uses (react-router-dom, zyra,
        // @tanstack/react-query, axios, clsx) into a separate vendors.js. index.js expects that chunk to be
        // registered first; without it, index.js runs without an error but renders nothing.
        $vendors_asset_file = VuloCart()->plugin_path . 'assets/js/vendors.asset.php';
        $vendors_asset      = file_exists( $vendors_asset_file ) ? require $vendors_asset_file : array(
            'dependencies' => array(),
            'version'      => $asset['version'],
        );

        wp_enqueue_script(
            'vulocart-admin-vendors',
            VuloCart()->plugin_url . 'assets/js/vendors.js',
            $vendors_asset['dependencies'],
            $vendors_asset['version'],
            true
        );

        wp_enqueue_script(
            'vulocart-admin',
            VuloCart()->plugin_url . 'assets/js/index.js',
            array_merge( $asset['dependencies'], array( 'vulocart-admin-vendors' ) ),
            $asset['version'],
            true
        );

        wp_enqueue_style(
            'vulocart-admin',
            VuloCart()->plugin_url . 'assets/styles/index.css',
            array(),
            $asset['version']
        );

        wp_localize_script(
            'vulocart-admin',
            'vulocartLocalizer',
            array(
                'apiUrl'         => untrailingslashit( esc_url_raw( rest_url() ) ),
                'restUrl'        => VuloCart()->rest_namespace,
                'nonce'          => wp_create_nonce( 'wp_rest' ),
                'adminUrl'       => esc_url_raw( admin_url() ),
                'active_modules' => VuloCart()->modules->get_active_modules(),
                'khali_dabba'    => VuloCart()->util->is_khali_dabba(),
                'disabled_product_types' => array_values( array_unique( array_merge( \VuloCart\RestAPI\Controllers\ProductTypes::disabled_types(), \VuloCart\RestAPI\Controllers\ProductTypes::locked_types() ) ) ),
                'ask_product_type' => ! empty( wp_parse_args( get_option( \VuloCart\Utill::SETTINGS_KEY, array() ), \VuloCart\Utill::SETTINGS_DEFAULTS )['ask_product_type'] ),
                'version'        => VuloCart()->version,
                'pro_version'    => defined( 'VULOCART_PRO_PLUGIN_VERSION' ) ? VULOCART_PRO_PLUGIN_VERSION : null,
                'active_plugins' => get_option( 'active_plugins', array() ),
                'shop_url'       => defined( 'VULOCART_PRO_SHOP_URL' ) ? VULOCART_PRO_SHOP_URL : '',
                'site_url'       => esc_url_raw( site_url() ),
                'user_display_name' => wp_get_current_user()->display_name,
                // Settings → General date/time format (PHP `date()` syntax) and timezone as a minute offset from UTC;
                // services/formatWpDate.ts formats every date the admin shows with them.
                'date_format'        => get_option( 'date_format' ),
                'time_format'        => get_option( 'time_format' ),
                'gmt_offset_minutes' => (int) round( wp_timezone()->getOffset( new \DateTime( 'now', new \DateTimeZone( 'UTC' ) ) ) / 60 ),
            )
        );
    }
}
