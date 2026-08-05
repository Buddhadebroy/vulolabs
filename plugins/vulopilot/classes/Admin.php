<?php
/**
 * Admin class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot;

defined( 'ABSPATH' ) || exit;

/**
 * VuloPilot Admin class.
 *
 * Registers the top-level admin menu and its submenu pages, and enqueues
 * the React dashboard bundle on VuloPilot's own admin screen. Mirrors
 * VuloLabs\Admin's add_menu_page()/add_submenu_page() + hash-tab
 * pattern (`vulopilot#&tab=dashboard`) rather than WordPress's normal
 * per-page URLs, so the whole admin UI is one React app reading `tab`
 * from location.hash (see src/app.tsx) — same mechanism the free
 * vulolabs plugin's admin screen already uses.
 *
 * Also grafts a grouped/collapsible look onto that same native
 * `#toplevel_page_vulopilot` menu itself (public/js, public/styles) rather
 * than a custom in-content React sidebar — see enqueue_menu_grouping_assets()'s
 * own docblock for why, and for the constraints that choice comes with.
 *
 * @class       Admin class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Admin {

    /**
     * Dashicon class per collapsible group id (matches each submenu
     * entry's own 'group' value below). Just id → icon, not id → label —
     * class constants can't run __() at declaration time, so the
     * translated label per group is built separately, from literal
     * __() calls, in enqueue_menu_grouping_assets().
     *
     * @var array<string, string>
     */
    const GROUPS = array(
        'ai-visibility' => 'dashicons-lightbulb',
        'seo-content'   => 'dashicons-search',
        'site-health'   => 'dashicons-shield',
        'tools'         => 'dashicons-admin-tools',
    );

    /**
     * Admin constructor.
     */
    public function __construct() {
        add_action( 'admin_menu', array( $this, 'add_menus' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_script' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_menu_grouping_assets' ) );
    }

    /**
     * Registers the VuloPilot top-level menu and its submenu tabs.
     *
     * Each entry's optional 'group' key must match a GROUPS key —
     * public/js/admin-menu-groups.js reads it (via the
     * tabToGroup map enqueue_menu_grouping_assets() localizes) to decide
     * which already-rendered `<li>` belongs under which collapsible
     * group header. Priorities are deliberately assigned so every group's
     * members sort contiguously — the grouping script only inserts a
     * header before a run's first member and shows/hides the run in
     * place, it never re-parents `<li>` elements (see that file's own
     * docblock for why), so non-contiguous members of the same group
     * would render as two separate broken-up sections instead of one.
     *
     * @return void
     */
    public function add_menus() {
        if ( ! is_admin() ) {
            return;
        }

        add_menu_page(
            'VuloPilot',
            'VuloPilot',
            'manage_options',
            'vulopilot',
            array( $this, 'create_admin_page' ),
            'dashicons-shield',
            56
        );

        // Flat top-level IA — each entry reuses an existing tab slug/route
        // (src/routes.ts) so no new pages were needed, just new labels,
        // icons and a new order. Every slug this array does *not* mention
        // (GEO's siblings, Accessibility, Health, etc.) keeps its working
        // React route and stays reachable via a direct
        // `admin.php?page=vulopilot#&tab=<slug>` link — see
        // self::legacy_submenus() for that metadata, kept for a future
        // pass rather than deleted.
        $submenus = apply_filters(
            'vulopilot_submenus',
            array(
                'dashboard'    => array(
                    'name'     => __( 'Dashboard', 'vulopilot' ),
                    'priority' => 10,
                    'icon'     => 'dashicons-dashboard',
                ),
                'ai-assistant' => array(
                    'name'     => __( 'AI Copilot', 'vulopilot' ),
                    'priority' => 20,
                    'icon'     => 'dashicons-lightbulb',
                ),
                'geo'          => array(
                    'name'     => __( 'Grow My Traffic', 'vulopilot' ),
                    'priority' => 30,
                    'icon'     => 'dashicons-chart-line',
                ),
                'content'      => array(
                    'name'     => __( 'Create Content', 'vulopilot' ),
                    'priority' => 40,
                    'icon'     => 'dashicons-media-text',
                ),
                'performance'  => array(
                    'name'     => __( 'Improve Speed', 'vulopilot' ),
                    'priority' => 50,
                    'icon'     => 'dashicons-performance',
                ),
                'security'     => array(
                    'name'     => __( 'Protect My Site', 'vulopilot' ),
                    'priority' => 60,
                    'icon'     => 'dashicons-shield',
                ),
                'woocommerce'  => array(
                    'name'     => __( 'Sell More', 'vulopilot' ),
                    'priority' => 70,
                    'icon'     => 'dashicons-cart',
                ),
                'automation'   => array(
                    'name'     => __( 'Automate Work', 'vulopilot' ),
                    'priority' => 80,
                    'icon'     => 'dashicons-update',
                ),
                // 'divider' draws a thin rule before this item in the
                // native submenu (admin-menu-groups.js's addDividers()) —
                // marks the split between the day-to-day work items above
                // and the account-level pages below, same as the design.
                'reports'      => array(
                    'name'     => __( 'Reports', 'vulopilot' ),
                    'priority' => 90,
                    'icon'     => 'dashicons-chart-bar',
                    'divider'  => true,
                ),
                'settings'     => array(
                    'name'     => __( 'Settings', 'vulopilot' ),
                    'priority' => 100,
                    'icon'     => 'dashicons-admin-generic',
                ),
                // Always last — appended after the redesigned menu rather
                // than sorted in by priority number alone, so a filter
                // adding a higher-priority item later can't accidentally
                // push Modules out of the last slot.
                'modules'      => array(
                    'name'     => __( 'Modules', 'vulopilot' ),
                    'priority' => PHP_INT_MAX,
                    'icon'     => 'dashicons-admin-plugins',
                ),
            )
        );

        uasort(
            $submenus,
            function ( $a, $b ) {
                return ( $a['priority'] ?? 0 ) <=> ( $b['priority'] ?? 0 );
            }
        );

        foreach ( $submenus as $slug => $submenu ) {
            add_submenu_page(
                'vulopilot',
                $submenu['name'],
                $submenu['name'],
                'manage_options',
                'vulopilot#&tab=' . $slug,
                '__return_null'
            );
        }

        // The top-level menu click target duplicates the "Dashboard" submenu
        // it was auto-registered as by add_menu_page() — remove it so the
        // submenu list doesn't show "VuloPilot" twice.
        remove_submenu_page( 'vulopilot', 'vulopilot' );

        // Stash the same $submenus this method just built so
        // enqueue_menu_grouping_assets() (a separate admin_enqueue_scripts
        // callback, running later in the same request) can derive the
        // tab→group map from it without re-declaring the list a second
        // time — add_menus() itself runs on 'admin_menu', always earlier
        // than 'admin_enqueue_scripts' in WordPress's own load order.
        $this->registered_submenus = $submenus;
    }

    /**
     * Metadata for tabs that used to be their own submenu row before the
     * flat top-level redesign in add_menus() — intentionally unused by
     * any hook. Each slug's React route (src/routes.ts) is still
     * registered and fully working, reachable directly via
     * `admin.php?page=vulopilot#&tab=<slug>`; only its row in the native
     * WP submenu was removed. Kept here, not deleted, so a future pass
     * (e.g. re-surfacing these as grouped children under the new
     * top-level item they were folded into — see each entry's comment)
     * can reuse this metadata instead of reconstructing it.
     *
     * @return array
     */
    private function legacy_submenus() {
        return array(
            // Folded into 'geo' ("Grow My Traffic").
            'aeo'              => array(
                'name'  => __( 'AEO', 'vulopilot' ),
                'group' => 'ai-visibility',
                'icon'  => 'dashicons-format-status',
            ),
            'ai-content'       => array(
                'name'  => __( 'AI Content', 'vulopilot' ),
                'group' => 'ai-visibility',
                'icon'  => 'dashicons-edit',
            ),
            'crawler-traffic'  => array(
                'name'  => __( 'Crawler Traffic', 'vulopilot' ),
                'group' => 'ai-visibility',
                'icon'  => 'dashicons-networking',
            ),
            'brand-visibility' => array(
                'name' => __( 'Brand Visibility', 'vulopilot' ),
                'icon' => 'dashicons-megaphone',
            ),
            'knowledge-graph'  => array(
                'name' => __( 'Knowledge Graph', 'vulopilot' ),
                'icon' => 'dashicons-share-alt2',
            ),
            'seo'              => array(
                'name'  => __( 'SEO', 'vulopilot' ),
                'group' => 'seo-content',
                'icon'  => 'dashicons-search',
            ),
            // Folded into 'content' ("Create Content").
            'schema'           => array(
                'name'  => __( 'Schema', 'vulopilot' ),
                'group' => 'seo-content',
                'icon'  => 'dashicons-editor-code',
            ),
            'redirects'        => array(
                'name'  => __( 'Redirects & 404s', 'vulopilot' ),
                'group' => 'seo-content',
                'icon'  => 'dashicons-randomize',
            ),
            // Folded into 'performance' ("Improve Speed").
            'accessibility'    => array(
                'name'  => __( 'Accessibility', 'vulopilot' ),
                'group' => 'site-health',
                'icon'  => 'dashicons-universal-access',
            ),
            // Not part of any new top-level item's cluster — a real,
            // working page (score-by-category summary + the unfiltered
            // findings list), simply left off the redesigned nav.
            'health'           => array(
                'name' => __( 'Health', 'vulopilot' ),
                'icon' => 'dashicons-heart',
            ),
            'activity'         => array(
                'name' => __( 'Activity', 'vulopilot' ),
                'icon' => 'dashicons-clock',
            ),
            'status-tools'     => array(
                'name'   => __( 'Status & Tools', 'vulopilot' ),
                'subtab' => 'system-status',
            ),
        );
    }

    /**
     * Renders the empty mount point the React app renders into.
     *
     * @return void
     */
    public function create_admin_page() {
        echo '<div id="admin-main-wrapper" class="admin-main-wrapper"></div>';
    }

    /**
     * Enqueues and localizes the admin script bundle on VuloPilot's own
     * admin screen only.
     *
     * @return void
     */
    public function enqueue_admin_script() {
        $screen = get_current_screen();

        if ( ! $screen || 'toplevel_page_vulopilot' !== $screen->id ) {
            return;
        }

        wp_enqueue_script( 'wp-element' );

        FrontendScripts::admin_load_scripts();
        FrontendScripts::enqueue_script( 'vulopilot-vendor-script' );
        FrontendScripts::enqueue_script( 'vulopilot-admin-script' );
        FrontendScripts::enqueue_style( 'vulopilot-admin-style' );
        FrontendScripts::localize_scripts( 'vulopilot-admin-script' );
    }

    /**
     * Grafts a grouped/collapsible look onto the native
     * `#toplevel_page_vulopilot` admin menu — a deliberately different
     * approach from a custom in-content React sidebar: this menu is
     * WordPress core's own markup, rendered on *every* wp-admin screen
     * (not just VuloPilot's own page), so it has to be enqueued
     * unconditionally here rather than gated to one screen the way
     * enqueue_admin_script() is.
     *
     * The public/js/admin-menu-groups.js file (and its
     * public/styles/admin-menu-groups.scss sibling) is hand-written
     * vanilla JS/CSS rather than a webpack entry — it only ever touches
     * plain DOM (no JSX/TS, no React, no dependency on the admin bundle
     * even being loaded on the current screen), so routing it through
     * wp-scripts/webpack would add a bundling step for zero benefit. It's
     * still minified though (tools/scripts/minify.mjs's own `public/js`+
     * `public/styles` asset-folder handling, terser/sass, no webpack) into
     * assets/js/public/ and assets/styles/public/ — the paths enqueued
     * below — so the release zip ships the same minified shape as every
     * wp-scripts-built asset, not raw source.
     *
     * The script only ever *shows/hides* and *inserts a header before*
     * the `<li>` elements WordPress itself already rendered from
     * add_menus()'s $submenus list — it never re-parents them out of the
     * submenu `<ul>`, specifically so this file's
     * `#toplevel_page_vulopilot > ul > li > a` selector in src/app.tsx
     * (used to toggle the 'current' class as the hash tab changes) keeps
     * matching every item regardless of which group it's in.
     *
     * @return void
     */
    public function enqueue_menu_grouping_assets() {
        if ( ! is_admin() || empty( $this->registered_submenus ) ) {
            return;
        }

        $tab_to_group   = array();
        $tab_to_icon    = array();
        $divider_before = array();

        foreach ( $this->registered_submenus as $slug => $submenu ) {
            if ( ! empty( $submenu['group'] ) ) {
                $tab_to_group[ $slug ] = $submenu['group'];
            }

            if ( ! empty( $submenu['icon'] ) ) {
                $tab_to_icon[ $slug ] = $submenu['icon'];
            }

            if ( ! empty( $submenu['divider'] ) ) {
                $divider_before[] = $slug;
            }
        }

        // Built from literal __() calls (never GROUPS's own label strings
        // fed through __() dynamically) so the i18n string-extraction
        // tooling can actually find these — see i18n.md.
        $translated_labels = array(
            'ai-visibility' => __( 'AI Visibility', 'vulopilot' ),
            'seo-content'   => __( 'SEO & Content', 'vulopilot' ),
            'site-health'   => __( 'Site Health', 'vulopilot' ),
            'tools'         => __( 'Tools', 'vulopilot' ),
        );

        $groups = array();

        foreach ( self::GROUPS as $group_id => $icon ) {
            $groups[] = array(
                'id'    => $group_id,
                'label' => $translated_labels[ $group_id ] ?? $group_id,
                'icon'  => $icon,
            );
        }

        wp_enqueue_script(
            'vulopilot-admin-menu-groups',
            VuloPilot()->plugin_url . 'assets/js/public/vulopilot-admin-menu-groups.min.js',
            array(),
            VuloPilot()->version,
            true
        );

        wp_enqueue_style(
            'vulopilot-admin-menu-groups',
            VuloPilot()->plugin_url . 'assets/styles/public/vulopilot-admin-menu-groups.min.css',
            array(),
            VuloPilot()->version
        );

        wp_localize_script(
            'vulopilot-admin-menu-groups',
            'vulopilotMenuGroups',
            array(
                'groups'        => $groups,
                'tabToGroup'    => $tab_to_group,
                'tabToIcon'     => $tab_to_icon,
                'dividerBefore' => $divider_before,
            )
        );
    }

    /**
     * The $submenus list add_menus() built, stashed for
     * enqueue_menu_grouping_assets() to read — see add_menus()'s own
     * docblock for why this isn't just rebuilt a second time there.
     *
     * @var array
     */
    private $registered_submenus = array();
}
