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
 * Orders and Products are deliberately NOT among these tabs - see
 * add_orders_menu()'s/add_products_menu()'s docblocks for why both get
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
        add_action( 'admin_menu', array( $this, 'add_products_menu' ) );
        add_action( 'admin_menu', array( $this, 'add_customers_menu' ) );
        add_action( 'admin_menu', array( $this, 'add_inventory_menu' ) );
        add_action( 'admin_menu', array( $this, 'add_shipping_menu' ) );
        add_action( 'admin_menu', array( $this, 'add_ai_menu' ) );
        add_action( 'admin_menu', array( $this, 'add_workflows_menu' ) );
        add_action( 'admin_menu', array( $this, 'add_analytics_redirect' ) );
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
            'vulocart-ai',
            'vulocart-workflows',
            'vulocart-inventory',
            'vulocart-shipping',
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

        if ( empty( $submenu['vulocart-marketing'] ) ) {
            return;
        }

        $order = array( 'coupons', 'pricing-rules', 'gift-cards', 'abandoned-checkouts', 'checkout-links' );
        $rank  = static function ( $item ) use ( $order ) {
            $position = array_search( str_replace( 'vulocart-marketing&view=', '', $item[2] ), $order, true );

            return false === $position ? 500 : $position;
        };

        $items = array_values(
            array_filter(
                $submenu['vulocart-marketing'],
                static function ( $item ) {
                    return 'vulocart-marketing' !== $item[2];
                }
            )
        );

        usort(
            $items,
            static function ( $a, $b ) use ( $rank ) {
                return $rank( $a ) <=> $rank( $b );
            }
        );

        $submenu['vulocart-marketing'] = $items; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- see order_submenu().
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
     * Registers Products as its own dedicated top-level WP admin menu,
     * separate from the "VuloCart" menu - same treatment as
     * add_orders_menu(), and for the same reason (this plugin's admin-UX
     * brief calls for WooCommerce/Shopify-style dedicated top-level spaces,
     * not one more settings-style tab).
     *
     * "All Products" and "Add New" both point at the same
     * `vulocart-products` slug (the `&action=add` suffix on the second is
     * a query-string addition, not a distinct WP page - same technique
     * WooCommerce itself uses so `admin.php?page=wc-orders`,
     * `...&action=new`, and `...&action=edit&id=123` are all one
     * registered admin page differentiated by query args the client reads,
     * rather than three separate `add_menu_page()`-registered screens).
     * Categories/Collections/Brands/Tags/Attributes/Product Types/Inventory/
     * Reviews use the same one-slug-many-query-strings technique via
     * `&view=`, now that each has a real backing REST controller
     * (classes/RestAPI/Controllers/Terms.php/Attributes.php/Reviews.php/
     * Inventory.php/ProductTypes.php) and admin page (`src/pages/Terms/`,
     * `src/pages/Attributes/`, etc.) - `src/pages/Products/Products.tsx`
     * is what actually branches on `action`/`id`/`view` to decide which
     * one renders. Returns is the one item from this plugin's admin-UX
     * brief still not scaffolded - a genuine RMA workflow (request →
     * approve/reject → item returned → refund issued) is a distinct,
     * larger domain model from a review or a term, not built in this pass.
     *
     * @return void
     */
    public function add_products_menu() {
        add_menu_page(
            __( 'VuloCart Products', 'vulocart' ),
            __( 'Products', 'vulocart' ),
            'manage_options',
            'vulocart-products',
            array( $this, 'render_products_admin_page' ),
            'dashicons-archive',
            56.1
        );

        add_submenu_page(
            'vulocart-products',
            __( 'All Products', 'vulocart' ),
            __( 'All Products', 'vulocart' ),
            'manage_options',
            'vulocart-products',
            array( $this, 'render_products_admin_page' )
        );

        add_submenu_page(
            'vulocart-products',
            __( 'Add New', 'vulocart' ),
            __( 'Add New', 'vulocart' ),
            'manage_options',
            'vulocart-products&action=add',
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
                'vulocart-products',
                $label,
                $label,
                'manage_options',
                'vulocart-products&view=' . $slug,
                array( $this, 'render_products_admin_page' )
            );
        }
    }

    /**
     * Registers Customers as its own dedicated top-level WP admin menu -
     * same "deserves first-class space, not a settings-style tab"
     * treatment `add_orders_menu()`/`add_products_menu()`'s own
     * docblocks establish, now that `Customer\Domain\Customer` is a real
     * persistent entity (`Customer\Install.php`) rather than an
     * Order-row snapshot with nothing to list on its own. `Pro modules
     * extend this screen's own detail view the same "compose via filter"
     * way they extend the Products edit page
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
     * treatment `add_orders_menu()`/`add_products_menu()`/
     * `add_customers_menu()`'s own docblocks establish. Unlike Customers,
     * this plugin owns no Inventory-engine entity of its own - Warehouses/
     * Purchase Orders/Transfers/Reservations/Batch & Serial Tracking/
     * Forecasting all live in `vulocart-pro`'s own Inventory module, same
     * "Free owns top-level chrome, Pro fills it in via a filtered router"
     * split `add_customers_menu()`'s own docblock documents for
     * CustomerGrowth. This is distinct from the existing
     * `vulocart-products&view=inventory` sub-page (a simple bulk stock-
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
     * Shipping is one submenu of VuloCart; zones, packaging, shipments, returns and pickup are tabs on that
     * page (`&view=`), filled in by `vulocart-pro`'s ShippingEngine module through `vulocart_shipping_view`.
     *
     * @return void
     */
    public function add_shipping_menu() {
        add_submenu_page(
            'vulocart',
            __( 'VuloCart Shipping', 'vulocart' ),
            __( 'Shipping', 'vulocart' ),
            'manage_options',
            'vulocart-shipping',
            array( $this, 'render_shipping_admin_page' )
        );
    }

    /**
     * Registers AI as a single submenu of VuloCart (it used to be its own top-level menu with a submenu per
     * feature). The page slug stays `vulocart-ai`, so `&view=catalog|checkout|support|search` links and
     * bookmarks keep working - those are now tabs on this one page. Free owns the frame; each tab is
     * `vulocart-pro`'s CatalogAi/CheckoutAi/SupportAi/VectorSearch module, plugged into `vulocart_ai_view`.
     *
     * @return void
     */
    public function add_ai_menu() {
        add_submenu_page(
            'vulocart',
            __( 'VuloCart AI', 'vulocart' ),
            __( 'AI', 'vulocart' ),
            'manage_options',
            'vulocart-ai',
            array( $this, 'render_ai_admin_page' )
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
     * Analytics is part of the Dashboard page now (its Pro insights section, src/pages/Dashboard/), not a page of its own. The old slug stays
     * registered as a hidden page (no parent, so no menu entry) whose `load-` hook sends old links and bookmarks to
     * the Dashboard; WordPress would otherwise refuse the unknown slug before any `admin_init` redirect could run.
     *
     * @return void
     */
    public function add_analytics_redirect() {
        $hook = add_submenu_page( '', __( 'VuloCart Analytics', 'vulocart' ), '', 'manage_options', 'vulocart-analytics', '__return_null' );

        add_action(
            'load-' . $hook,
            static function () {
                wp_safe_redirect( admin_url( 'admin.php?page=vulocart#&tab=dashboard' ) );
                exit;
            }
        );
    }

    /**
     * Registers Marketing as its own top-level WP admin menu - same "Free owns top-level chrome, Pro
     * fills it in" split as `add_ai_menu()`/`add_workflows_menu()`. Free owns no view here; Coupons,
     * Pricing Rules, Gift Cards, Cart Abandoned, Checkout Links and Checkout Builder are each
     * `vulocart-pro`'s own module, which registers its submenu under `vulocart-marketing`
     * (ordered by order_marketing_submenu()).
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
     * like `vulocart-products&view=collections`, but WordPress matches the
     * active item against `$_GET['page']` alone - which never equals that
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

        // Marketing has no item for its bare page (order_marketing_submenu() drops it); that page shows Coupons.
        if ( 'vulocart-marketing' === $page && ! in_array( $page, $registered, true ) && in_array( 'vulocart-marketing&view=coupons', $registered, true ) ) {
            return 'vulocart-marketing&view=coupons';
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
     * Runs on VuloCart's own screen and both standalone Orders/Products
     * screens (render_orders_admin_page()/render_products_admin_page()) -
     * all three mount the exact same built bundle; src/index.tsx itself
     * decides which app to render based on which root element id is
     * present in the page (`#admin-main-wrapper` vs
     * `#vulocart-orders-admin-root` vs `#vulocart-products-admin-root`),
     * so there's no need for a second/third webpack entry/bundle just to
     * give Orders/Products their own top-level menus.
     *
     * Gated on `$_GET['page']`, NOT `$hook_suffix` - a query string like
     * `&action=add` on the Products top-level page itself doesn't change
     * either one (same page, same hook), but a Pro module's own
     * `add_submenu_page( 'vulocart-products', ..., 'vulocart-products&view=xyz',
     * ... )` (Suppliers/CheckoutLinks/Subscriptions/Passport/etc. - every
     * "Pro extends the Products menu" registration in this codebase) is a
     * genuinely SEPARATE submenu-page registration, and WordPress's own
     * `get_plugin_page_hookname()` hashes that entire literal
     * `'vulocart-products&view=xyz'` string into a hook suffix like
     * `admin_page_vulocart-products&view=xyz` - never
     * `toplevel_page_vulocart-products`. An `in_array( $hook_suffix, ... )`
     * check here silently never matches any of those pages, so this
     * bundle (and therefore the entire React app, `#vulocart-products-admin-root`
     * included) never loads on them - a real bug that shipped invisibly
     * because nothing in this codebase's own test coverage ever loaded
     * these admin screens in an actual browser, only their REST endpoints
     * directly. `$_GET['page']` has no such problem: WordPress always
     * parses it as the plain `vulocart-products` string regardless of
     * what a submenu's own registered slug looked like, since query
     * strings are parsed independently of how the menu system computed
     * its internal hook name.
     *
     * @param string $hook_suffix Current admin page hook suffix - unused, see above.
     * @return void
     */
    public function enqueue_admin_script( $hook_suffix ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
        $current_page   = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only page-identity check, not a state-changing request.
        $vulocart_pages = array( 'vulocart', 'vulocart-orders', 'vulocart-products', 'vulocart-customers', 'vulocart-inventory', 'vulocart-shipping', 'vulocart-ai', 'vulocart-workflows', 'vulocart-marketing' );

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
                'disabled_product_types' => \VuloCart\RestAPI\Controllers\ProductTypes::disabled_types(),
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
