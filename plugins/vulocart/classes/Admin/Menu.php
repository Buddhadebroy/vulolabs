<?php
/**
 * Menu class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Admin;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Admin Menu class.
 *
 * Registers VuloCart's top-level admin page and its tabs, and mounts the
 * React admin console there. Tab structure mirrors
 * `VuloPilot\Admin` exactly: real `add_submenu_page()`
 * sidebar entries, each pointing to `vulocart#&tab={tab}` with a
 * `'__return_null'` callback - the hash fragment never reaches the
 * server, so every one of these entries actually loads the same
 * `render_admin_page()` output; the client-side route registry
 * (src/routeRegistry.ts/routes.ts, App.tsx) is what makes the tab differ,
 * reading `tab` from `location.hash` the same way
 * `vulopilot/src/app.tsx`'s own `Route` component does. Unlike the
 * vulopilot/vulopilot-pro relationship (Pro extends Free's
 * already-mounted dashboard via `@wordpress/hooks` filters,
 * react-frontend.md), VuloCart has no separate Free/Pro dashboard split
 * yet, so this plugin owns its own single mount point directly.
 *
 * Orders and Offerings are deliberately NOT among these tabs - see
 * add_orders_menu()'s/add_offerings_menu()'s docblocks for why both get
 * their own top-level WP admin menu instead, matching how WooCommerce
 * gives "Products"/"Orders" their own top-level menus rather than burying
 * them in a settings-style tab set.
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
        add_action( 'admin_menu', array( $this, 'add_offerings_menu' ) );
        add_action( 'admin_menu', array( $this, 'add_customers_menu' ) );
        add_action( 'admin_menu', array( $this, 'add_inventory_menu' ) );
        add_action( 'admin_menu', array( $this, 'add_shipping_menu' ) );
        add_action( 'admin_menu', array( $this, 'add_ai_menu' ) );
        add_action( 'admin_menu', array( $this, 'add_workflows_menu' ) );
        add_action( 'admin_menu', array( $this, 'add_analytics_menu' ) );
        add_action( 'admin_menu', array( $this, 'add_marketing_menu' ) );
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

        $tabs = array(
            'dashboard' => __( 'Dashboard', 'vulocart' ),
            'reviews'   => __( 'Reviews', 'vulocart' ),
            'settings'  => __( 'Settings', 'vulocart' ),
        );

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

        // add_menu_page() always auto-generates a first submenu item that
        // reuses the parent slug/title ("VuloCart"), duplicating the
        // explicit "Dashboard" tab above. vulopilot strips
        // this the same way rather than avoiding it (Admin.php's own
        // `remove_submenu_page( 'vulopilot', 'vulopilot' )`).
        remove_submenu_page( 'vulocart', 'vulocart' );
    }

    /**
     * Registers Orders as its own dedicated top-level WP admin menu,
     * separate from the "VuloCart" menu above. Order management is
     * explicitly called out (per this plugin's admin-UX brief) as
     * deserving its own first-class space rather than being one more tab
     * next to Dashboard/Modules/Settings - the same treatment WooCommerce
     * gives "WooCommerce" (settings) vs. "Products"/"Orders" as separate
     * top-level menus, and a marketplace platform gives its own marketplace
     * admin.
     *
     * "All Orders" and "Add New" are the only submenus. Draft and refunded
     * orders are reached with the status pills on the orders list itself
     * (`&filter=draft`/`&filter=refunds` still preselect them), not their
     * own menu items.
     *
     * @return void
     */
    public function add_orders_menu() {
        add_menu_page(
            __( 'VuloCart Orders', 'vulocart' ),
            __( 'Orders', 'vulocart' ),
            'manage_options',
            'vulocart-orders',
            array( $this, 'render_orders_admin_page' ),
            'dashicons-list-view',
            56.4
        );

        add_submenu_page(
            'vulocart-orders',
            __( 'All Orders', 'vulocart' ),
            __( 'All Orders', 'vulocart' ),
            'manage_options',
            'vulocart-orders',
            array( $this, 'render_orders_admin_page' )
        );

        add_submenu_page(
            'vulocart-orders',
            __( 'Add New', 'vulocart' ),
            __( 'Add New', 'vulocart' ),
            'manage_options',
            'vulocart-orders&action=add',
            array( $this, 'render_orders_admin_page' )
        );
    }

    /**
     * Registers Offerings as its own dedicated top-level WP admin menu,
     * separate from the "VuloCart" menu - same treatment as
     * add_orders_menu(), and for the same reason (this plugin's admin-UX
     * brief calls for WooCommerce/Shopify-style dedicated top-level spaces,
     * not one more settings-style tab).
     *
     * "All Offerings" and "Add New" both point at the same
     * `vulocart-offerings` slug (the `&action=add` suffix on the second is
     * a query-string addition, not a distinct WP page - same technique
     * WooCommerce itself uses so `admin.php?page=wc-orders`,
     * `...&action=new`, and `...&action=edit&id=123` are all one
     * registered admin page differentiated by query args the client reads,
     * rather than three separate `add_menu_page()`-registered screens).
     * Categories/Collections/Brands/Tags/Attributes/Offering Types/Inventory/
     * Reviews use the same one-slug-many-query-strings technique via
     * `&view=`, now that each has a real backing REST controller
     * (classes/RestAPI/Controllers/Terms.php/Attributes.php/Reviews.php/
     * Inventory.php/OfferingTypes.php) and admin page (`src/pages/Terms/`,
     * `src/pages/Attributes/`, etc.) - `src/pages/Offerings/Offerings.tsx`
     * is what actually branches on `action`/`id`/`view` to decide which
     * one renders. Returns is the one item from this plugin's admin-UX
     * brief still not scaffolded - a genuine RMA workflow (request →
     * approve/reject → item returned → refund issued) is a distinct,
     * larger domain model from a review or a term, not built in this pass.
     *
     * @return void
     */
    public function add_offerings_menu() {
        add_menu_page(
            __( 'VuloCart Offerings', 'vulocart' ),
            __( 'Offerings', 'vulocart' ),
            'manage_options',
            'vulocart-offerings',
            array( $this, 'render_offerings_admin_page' ),
            'dashicons-archive',
            56.1
        );

        add_submenu_page(
            'vulocart-offerings',
            __( 'All Offerings', 'vulocart' ),
            __( 'All Offerings', 'vulocart' ),
            'manage_options',
            'vulocart-offerings',
            array( $this, 'render_offerings_admin_page' )
        );

        add_submenu_page(
            'vulocart-offerings',
            __( 'Add New', 'vulocart' ),
            __( 'Add New', 'vulocart' ),
            'manage_options',
            'vulocart-offerings&action=add',
            array( $this, 'render_offerings_admin_page' )
        );

        $sub_views = array(
            'categories'     => __( 'Categories', 'vulocart' ),
            'collections'    => __( 'Collections', 'vulocart' ),
            'brands'         => __( 'Brands', 'vulocart' ),
            'tags'           => __( 'Tags', 'vulocart' ),
            'attributes'     => __( 'Attributes', 'vulocart' ),
            'offering-types' => __( 'Offering Types', 'vulocart' ),
        );

        foreach ( $sub_views as $slug => $label ) {
            add_submenu_page(
                'vulocart-offerings',
                $label,
                $label,
                'manage_options',
                'vulocart-offerings&view=' . $slug,
                array( $this, 'render_offerings_admin_page' )
            );
        }
    }

    /**
     * Registers Customers as its own dedicated top-level WP admin menu -
     * same "deserves first-class space, not a settings-style tab"
     * treatment `add_orders_menu()`/`add_offerings_menu()`'s own
     * docblocks establish, now that `Customer\Domain\Customer` is a real
     * persistent entity (`Customer\Install.php`) rather than an
     * Order-row snapshot with nothing to list on its own. `Pro modules
     * extend this screen's own detail view the same "compose via filter"
     * way they extend the Offerings edit page
     * (`vulocart_customer_detail_sections`, `src/pages/Customers/
     * CustomerDetail.tsx`) - Wishlist/Saved Carts/Groups/Segments/
     * Loyalty-Credits-Wallet/Communication History all live in
     * `vulocart-pro`'s own CustomerGrowth module, not here.
     *
     * @return void
     */
    public function add_customers_menu() {
        add_menu_page(
            __( 'VuloCart Customers', 'vulocart' ),
            __( 'Customers', 'vulocart' ),
            'manage_options',
            'vulocart-customers',
            array( $this, 'render_customers_admin_page' ),
            'dashicons-groups',
            56.5
        );

        add_submenu_page(
            'vulocart-customers',
            __( 'All Customers', 'vulocart' ),
            __( 'All Customers', 'vulocart' ),
            'manage_options',
            'vulocart-customers',
            array( $this, 'render_customers_admin_page' )
        );
    }

    /**
     * Registers Inventory as its own dedicated top-level WP admin menu -
     * same "deserves first-class space, not a settings-style tab"
     * treatment `add_orders_menu()`/`add_offerings_menu()`/
     * `add_customers_menu()`'s own docblocks establish. Unlike Customers,
     * this plugin owns no Inventory-engine entity of its own - Warehouses/
     * Purchase Orders/Transfers/Reservations/Batch & Serial Tracking/
     * Forecasting all live in `vulocart-pro`'s own Inventory module, same
     * "Free owns top-level chrome, Pro fills it in via a filtered router"
     * split `add_customers_menu()`'s own docblock documents for
     * CustomerGrowth. This is distinct from the existing
     * `vulocart-offerings&view=inventory` sub-page (a simple bulk stock-
     * quantity/status editor scoped to one offering at a time,
     * RestAPI\Controllers\Inventory.php) - that page is left untouched;
     * this top-level menu is for the warehouse-aware engine sitting above
     * it, not a replacement.
     *
     * @return void
     */
    public function add_inventory_menu() {
        add_menu_page(
            __( 'VuloCart Inventory', 'vulocart' ),
            __( 'Inventory', 'vulocart' ),
            'manage_options',
            'vulocart-inventory',
            array( $this, 'render_inventory_admin_page' ),
            'dashicons-store',
            56.2
        );

        // Free's own stock-level editor is the menu's first item (same slug as the parent, which relabels
        // the auto-generated entry); warehouses, purchase orders and the rest are vulocart-pro's.
        add_submenu_page(
            'vulocart-inventory',
            __( 'Stock Levels', 'vulocart' ),
            __( 'Stock Levels', 'vulocart' ),
            'manage_options',
            'vulocart-inventory',
            array( $this, 'render_inventory_admin_page' )
        );
    }

    /**
     * Registers Shipping as its own dedicated top-level WP admin menu -
     * same "Free owns top-level chrome, Pro fills it in" split
     * `add_inventory_menu()`'s own docblock documents. Distinct from the
     * free Shipping module's own checkout-step settings (Settings tab,
     * `enable_shipping`/`flat_rate_shipping_cost`) - this menu is for
     * `vulocart-pro`'s own ShippingEngine module (Zones/Rates/Packaging/
     * Shipments/Labels/Returns/Pickup), which extends
     * `ShippingService::get_available_methods()` via the
     * `vulocart_shipping_methods` filter rather than replacing it.
     *
     * @return void
     */
    public function add_shipping_menu() {
        add_menu_page(
            __( 'VuloCart Shipping', 'vulocart' ),
            __( 'Shipping', 'vulocart' ),
            'manage_options',
            'vulocart-shipping',
            array( $this, 'render_shipping_admin_page' ),
            'dashicons-car',
            56.3
        );
    }

    /**
     * Registers AI as its own dedicated top-level WP admin menu - same
     * "Free owns top-level chrome, Pro fills it in" split
     * `add_inventory_menu()`'s own docblock documents. Free's own `Ai`
     * module owns the "Settings" sub-page (BYOK provider key
     * configuration, `Ai\Module::register_menu()`); `vulocart-pro`'s
     * CatalogAi/CheckoutAi/SupportAi/VectorSearch modules each register
     * their own submenu here the same way ShippingEngine registers
     * Zones/Packaging/Shipments/Returns/Pickup under `add_shipping_menu()`.
     *
     * @return void
     */
    public function add_ai_menu() {
        add_menu_page(
            __( 'VuloCart AI', 'vulocart' ),
            __( 'AI', 'vulocart' ),
            'manage_options',
            'vulocart-ai',
            array( $this, 'render_ai_admin_page' ),
            'dashicons-star-filled',
            56.6
        );
    }

    /**
     * Registers Workflows as a submenu of VuloCart (it used to be its own top-level menu). The page slug
     * stays `vulocart-workflows`, so the editor/runs links (`&view=edit|runs&id=`) and bookmarks keep
     * working. Free owns no view here - the list, editor and run history are `vulocart-pro`'s
     * WorkflowBuilder module, which plugs into `vulocart_workflows_view`.
     *
     * @return void
     */
    public function add_workflows_menu() {
        add_submenu_page(
            'vulocart',
            __( 'VuloCart Workflows', 'vulocart' ),
            __( 'Workflows', 'vulocart' ),
            'manage_options',
            'vulocart-workflows',
            array( $this, 'render_workflows_admin_page' )
        );
    }

    /**
     * Registers Analytics as a submenu of VuloCart (after Dashboard/Settings) - it used to be its own
     * top-level menu. The page slug stays `vulocart-analytics`, so existing links and bookmarks keep
     * working, and the "Free owns the chrome, Pro fills it in" split is unchanged: Free owns no view
     * of its own here, every real section is `vulocart-pro`'s Analytics module, which plugs into
     * `vulocart_analytics_view`.
     *
     * @return void
     */
    public function add_analytics_menu() {
        add_submenu_page(
            'vulocart',
            __( 'VuloCart Analytics', 'vulocart' ),
            __( 'Analytics', 'vulocart' ),
            'manage_options',
            'vulocart-analytics',
            array( $this, 'render_analytics_admin_page' )
        );
    }

    /**
     * Registers Marketing as its own top-level WP admin menu - same "Free owns top-level chrome, Pro
     * fills it in" split as `add_ai_menu()`/`add_workflows_menu()`. Free owns no view here; Coupons,
     * Gift Cards, Subscriptions, Checkout Links, Checkout Builder and Abandoned Checkouts are each
     * `vulocart-pro`'s own module, which registers its submenu under `vulocart-marketing`.
     *
     * @return void
     */
    public function add_marketing_menu() {
        add_menu_page(
            __( 'VuloCart Marketing', 'vulocart' ),
            __( 'Marketing', 'vulocart' ),
            'manage_options',
            'vulocart-marketing',
            array( $this, 'render_marketing_admin_page' ),
            'dashicons-megaphone',
            56.7
        );
    }

    /**
     * Renders the mount point the React bundle attaches to. Same id+class
     * `admin-main-wrapper` vulopilot's own Admin.php uses for its
     * equivalent root div - zyra's shared `common.scss` keys several
     * layout rules (full-height page, `#wpcontent` padding/background
     * reset) off that exact id, so a different id here silently drops
     * those rules rather than just losing a class hook.
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
     * Renders the mount point for the standalone Offerings admin app - see
     * render_orders_admin_page()'s docblock for why this is a separate
     * root element id rather than reusing render_admin_page()'s.
     *
     * @return void
     */
    public function render_offerings_admin_page() {
        echo '<div id="vulocart-offerings-admin-root"></div>';
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
     * Renders the mount point for the standalone Analytics admin app -
     * see render_orders_admin_page()'s docblock for why this is a
     * separate root element id.
     *
     * @return void
     */
    public function render_analytics_admin_page() {
        echo '<div id="vulocart-analytics-admin-root"></div>';
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
     * like `vulocart-offerings&view=collections`, but WordPress matches the
     * active item against `$_GET['page']` alone - which never equals that
     * slug - so it falls back to the first item ("All Offerings") and the
     * page you're on never looks selected. Returns the registered slug that
     * matches the current `view`/`action`, when one exists.
     *
     * @param string|null $submenu_file Submenu file WordPress resolved.
     * @param string      $parent_file  Parent menu file.
     * @return string|null
     */
    public function highlight_current_submenu( $submenu_file, $parent_file ) {
        global $submenu;

        $page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only page-identity check.

        if ( '' === $page || 0 !== strpos( $page, 'vulocart' ) || empty( $submenu[ $page ] ) ) {
            return $submenu_file;
        }

        $candidates = array();

        if ( isset( $_GET['view'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
            $candidates[] = $page . '&view=' . sanitize_key( wp_unslash( $_GET['view'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        }

        if ( isset( $_GET['action'] ) && 'add' === sanitize_key( wp_unslash( $_GET['action'] ) ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
            $candidates[] = $page . '&action=add';
        }

        $registered = wp_list_pluck( $submenu[ $page ], 2 );

        foreach ( $candidates as $candidate ) {
            if ( in_array( $candidate, $registered, true ) ) {
                return $candidate;
            }
        }

        return $submenu_file;
    }

    /**
     * Enqueues the React admin bundle on VuloCart's own screen only, and
     * localizes `vulocartLocalizer` - a plugin-own global, deliberately
     * not reusing `appLocalizer` (a different plugin's shape). Shape is
     * also what zyra's `configureZyra()` expects: `apiUrl` is the bare
     * REST root and `restUrl` is the namespace, since zyra's own
     * `getApiLink()` composes `${apiUrl}/${restUrl}/${endpoint}` under
     * those exact property names (verified against the zyra package's
     * real build output, not assumed).
     *
     * Runs on VuloCart's own screen and both standalone Orders/Offerings
     * screens (render_orders_admin_page()/render_offerings_admin_page()) -
     * all three mount the exact same built bundle; src/index.tsx itself
     * decides which app to render based on which root element id is
     * present in the page (`#admin-main-wrapper` vs
     * `#vulocart-orders-admin-root` vs `#vulocart-offerings-admin-root`),
     * so there's no need for a second/third webpack entry/bundle just to
     * give Orders/Offerings their own top-level menus.
     *
     * Gated on `$_GET['page']`, NOT `$hook_suffix` - a query string like
     * `&action=add` on the Offerings top-level page itself doesn't change
     * either one (same page, same hook), but a Pro module's own
     * `add_submenu_page( 'vulocart-offerings', ..., 'vulocart-offerings&view=xyz',
     * ... )` (Suppliers/CheckoutLinks/Subscriptions/Passport/etc. - every
     * "Pro extends the Offerings menu" registration in this codebase) is a
     * genuinely SEPARATE submenu-page registration, and WordPress's own
     * `get_plugin_page_hookname()` hashes that entire literal
     * `'vulocart-offerings&view=xyz'` string into a hook suffix like
     * `admin_page_vulocart-offerings&view=xyz` - never
     * `toplevel_page_vulocart-offerings`. An `in_array( $hook_suffix, ... )`
     * check here silently never matches any of those pages, so this
     * bundle (and therefore the entire React app, `#vulocart-offerings-admin-root`
     * included) never loads on them - a real bug that shipped invisibly
     * because nothing in this codebase's own test coverage ever loaded
     * these admin screens in an actual browser, only their REST endpoints
     * directly. `$_GET['page']` has no such problem: WordPress always
     * parses it as the plain `vulocart-offerings` string regardless of
     * what a submenu's own registered slug looked like, since query
     * strings are parsed independently of how the menu system computed
     * its internal hook name.
     *
     * @param string $hook_suffix Current admin page hook suffix - unused, see above.
     * @return void
     */
    public function enqueue_admin_script( $hook_suffix ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
        $current_page   = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only page-identity check, not a state-changing request.
        $vulocart_pages = array( 'vulocart', 'vulocart-orders', 'vulocart-offerings', 'vulocart-customers', 'vulocart-inventory', 'vulocart-shipping', 'vulocart-ai', 'vulocart-workflows', 'vulocart-analytics', 'vulocart-marketing' );

        if ( ! in_array( $current_page, $vulocart_pages, true ) ) {
            return;
        }

        // Registers `wp.media()` (media-views/media-editor + the attachment
        // browser markup) - the Offering edit page's Featured Image/Gallery
        // fields (zyra's `FileInput`, OfferingEdit.tsx) call `wp.media()`
        // directly, same real WordPress media-library integration every
        // other admin screen with an image picker uses; without this call
        // registered, `wp.media` is simply undefined on the page.
        wp_enqueue_media();

        $asset_file = VuloCart()->plugin_path . 'assets/js/index.asset.php';

        if ( ! file_exists( $asset_file ) ) {
            return;
        }

        $asset = require $asset_file;

        // webpack's splitChunks (tools/webpack/create-config.js) pulls every
        // node_modules dependency this entry uses (react-router-dom, zyra,
        // @tanstack/react-query, axios, clsx) into a separate vendors.js
        // file - index.js's own webpack runtime expects that chunk's
        // modules to already be registered on the page before it runs.
        // Confirmed the hard way: without enqueuing this, index.js loads
        // and executes with no thrown error, but never renders anything
        // (its own module registry lookups just come back empty).
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
                'version'        => VuloCart()->version,
                'pro_version'    => defined( 'VULOCART_PRO_PLUGIN_VERSION' ) ? VULOCART_PRO_PLUGIN_VERSION : null,
                'active_plugins' => get_option( 'active_plugins', array() ),
                'shop_url'       => defined( 'VULOCART_PRO_SHOP_URL' ) ? VULOCART_PRO_SHOP_URL : '',
                'site_url'       => esc_url_raw( site_url() ),
                // Settings → General date/time format (PHP `date()` syntax) and timezone as a minute offset from UTC;
                // services/formatWpDate.ts formats every date the admin shows with them.
                'date_format'        => get_option( 'date_format' ),
                'time_format'        => get_option( 'time_format' ),
                'gmt_offset_minutes' => (int) round( wp_timezone()->getOffset( new \DateTime( 'now', new \DateTimeZone( 'UTC' ) ) ) / 60 ),
            )
        );
    }
}
