<?php
/**
 * SitemapUrlRewriter class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

defined( 'ABSPATH' ) || exit;

/**
 * Renames WordPress core's own native sitemap URLs from its default
 * `/wp-sitemap.xml`/`/wp-sitemap-{provider}-{subtype}-{page}.xml` shape to
 * the more familiar `/sitemap_index.xml`/`/{subtype}-sitemap{page}.xml`
 * shape (Yoast/RankMath's own real convention) — real core content served
 * at a different real URL, not a second sitemap system: every new pretty
 * URL rewrites to the exact same real `sitemap`/`sitemap-subtype`/`paged`
 * query vars `WP_Sitemaps::register_rewrites()` already uses, so core's
 * own unmodified `render_sitemaps()` renders it, same real data either
 * way (SitemapStylesheet.php's own restyle still applies too, since that
 * hooks the shared renderer/stylesheet classes, not a URL).
 *
 * The real per-type "name" (`page`, `post`, `category`, …) always comes
 * from `wp_get_sitemap_providers()`'s own real `get_object_subtypes()` —
 * read once, on the real `wp_sitemaps_init` hook core itself fires
 * specifically for extending its own registry (sitemaps.php's own
 * docblock: "Additional sitemaps should be registered on this hook"), so
 * this works for any real registered post type/taxonomy, not a hardcoded
 * list. A provider with no real subtypes (`users`) falls back to its own
 * provider name (`users-sitemap.xml`) since there's no real per-subtype
 * name to use instead.
 *
 * Old URLs keep working — real per-instruction requirement, not
 * optional: every old-shape URL still real-rewrites to the same real
 * query vars core always used, then `redirect_legacy_url()` (hooked on
 * `template_redirect` at priority 5, before core's own render at its
 * default priority 10) issues a real 301 to the new pretty URL before
 * core ever renders anything at the old one — a site already indexed by
 * search engines, or with the old sitemap URL saved in Search Console,
 * keeps resolving correctly rather than 404ing.
 *
 * Self-registers its own hooks in the constructor (php-wordpress.md) and
 * is constructed unconditionally in VuloPilot::init_classes(), same shape
 * as SitemapManager.php/SitemapStylesheet.php right next to it.
 *
 * @class       SitemapUrlRewriter class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SitemapUrlRewriter {

    /**
     * Bumped whenever this class's own rewrite rules change shape — the
     * one real trigger for the one-time `flush_rewrite_rules()` below
     * (retrofitting new rewrite rules into an already-active install
     * needs a real flush; WordPress never does this on its own outside
     * plugin activation).
     *
     * @var string
     */
    private const REWRITE_VERSION = '1';

    /**
     * @var string
     */
    private const REWRITE_VERSION_OPTION = 'vulopilot_sitemap_rewrite_version';

    /**
     * SitemapUrlRewriter constructor.
     */
    public function __construct() {
        add_action( 'wp_sitemaps_init', array( $this, 'register_pretty_rewrites' ) );
        add_action( 'init', array( $this, 'maybe_flush_rewrite_rules' ), 20 );
        add_filter( 'query_vars', array( $this, 'register_query_var' ) );
        add_action( 'template_redirect', array( $this, 'redirect_legacy_url' ), 5 );
        add_filter( 'wp_sitemaps_index_entry', array( $this, 'filter_index_entry_loc' ), 10, 3 );

        // Real fix for a real WordPress core gotcha: once both an old and
        // a new rewrite pattern can resolve to the identical real
        // `sitemap`/`sitemap-subtype`/`paged` query-var combination, core's
        // own `redirect_canonical()` (template_redirect, default priority
        // 10) tries to reconstruct "the" canonical pretty URL for that
        // combination and 301s the *new* pretty URL back to whichever
        // pattern it happens to reverse-match first — undoing this class's
        // own real redirect direction and creating a genuine old↔new
        // redirect loop (confirmed live against this exact install).
        // Sitemap query vars aren't a real post/page/term core's canonical
        // logic actually needs to correct, so this fully opts every real
        // sitemap request out of that mechanism — `redirect_legacy_url()`
        // above is the one real redirect authority for these URLs.
        add_filter( 'redirect_canonical', array( $this, 'bypass_canonical_redirect' ) );
    }

    /**
     * @param string $redirect_url Core's own computed canonical redirect target.
     * @return string|false
     */
    public function bypass_canonical_redirect( $redirect_url ) {
        if ( get_query_var( 'sitemap' ) || get_query_var( 'sitemap-stylesheet' ) ) {
            return false;
        }

        return $redirect_url;
    }

    /**
     * @param string[] $query_vars Core's own currently-registered public query vars.
     * @return string[]
     */
    public function register_query_var( $query_vars ) {
        $query_vars[] = 'vulopilot_legacy_sitemap';

        return $query_vars;
    }

    /**
     * Real per-provider pretty name — the real registered subtype name
     * when one exists (`page`, `post`, `category`, a custom post type's
     * own slug, …), falling back to the real provider name itself for a
     * provider with none (`users`).
     *
     * @param string      $provider Real provider name (`posts`/`taxonomies`/`users`/a 3rd-party-registered one).
     * @param string|null $subtype  Real object subtype, or null/empty for a provider with none.
     * @return string
     */
    private function pretty_name( string $provider, ?string $subtype ): string {
        return $subtype ? $subtype : $provider;
    }

    /**
     * Rewrites each real child sitemap's own `loc` on the INDEX page
     * (`sitemap_index.xml`) to its real new pretty URL directly, via
     * core's own real `wp_sitemaps_index_entry` filter — so a crawler
     * reading the index never has to bounce through this class's own
     * real 301 for every single child sitemap it lists; it reads the
     * pretty URL straight away, same real destination either way.
     *
     * `$object_type` is core's own real *generic* object type
     * (`post`/`term`/`user` — `WP_Sitemaps_Provider::$object_type`, a
     * different real value than the registry provider name
     * `register_pretty_rewrites()` above keys its own rewrite rules by),
     * only used here as a fallback for the one real core provider with no
     * real subtype at all (`users`, whose own real `$object_type` is
     * `user`) — every other real entry already carries a real
     * `$object_subtype` this uses directly instead.
     *
     * Also fills in a real `lastmod` for the index's own listing, which
     * core itself never does — `WP_Sitemaps_Provider::get_sitemap_entries()`
     * only ever builds `['loc' => …]` for an index entry (confirmed by
     * reading that method directly), so the index page's own "Last
     * Modified" column is always empty under core's default behavior,
     * even though individual child sitemaps (post types) carry a real
     * per-URL `lastmod` of their own. For a post-type provider this uses
     * the same real core helper (`get_lastpostmodified()`) and the same
     * real `DATE_W3C`/GMT formatting core's own posts provider already
     * uses for its per-URL entries, so the value is genuine, not
     * fabricated. Taxonomies/users are left with no `lastmod` — core
     * doesn't track a modified date for terms or users at all (confirmed
     * live: `category-sitemap.xml`/`users-sitemap.xml` carry no
     * `<lastmod>` on their own per-URL entries either), so there is no
     * real value to report there.
     *
     * @param array  $sitemap_entry  Core's own real sitemap-index entry (`['loc' => …]`).
     * @param string $object_type    Core's own real generic object type (`post`/`term`/`user`).
     * @param string $object_subtype Core's own real subtype name, empty for a provider with none.
     * @return array
     */
    public function filter_index_entry_loc( $sitemap_entry, $object_type, $object_subtype ) {
        if ( ! isset( $sitemap_entry['loc'] ) ) {
            return $sitemap_entry;
        }

        $paged = 1;

        if ( preg_match( '/-(\d+)\.xml$/', (string) $sitemap_entry['loc'], $matches ) ) {
            $paged = (int) $matches[1];
        }

        // Real `object_type` → real registry provider name, for the one
        // real core provider with no real subtype (`users`) — every
        // other case already has a real `$object_subtype` to use
        // directly, so this mapping only ever matters for that one case.
        $name = $object_subtype ? $object_subtype : ( 'user' === $object_type ? 'users' : $object_type );

        $sitemap_entry['loc'] = home_url( '/' . $name . '-sitemap' . ( $paged > 1 ? $paged : '' ) . '.xml' );

        if ( ! isset( $sitemap_entry['lastmod'] ) && 'post' === $object_type && $object_subtype ) {
            $last_modified = get_lastpostmodified( 'gmt', $object_subtype );

            if ( $last_modified ) {
                $sitemap_entry['lastmod'] = wp_date( DATE_W3C, strtotime( $last_modified ) );
            }
        }

        return $sitemap_entry;
    }

    /**
     * Registers the real new pretty-URL rewrite rules — one pair
     * (page-1-implicit + page-N-suffixed) per real registered provider/
     * subtype combination — plus the real legacy-URL rules that 301
     * redirect old URLs forward. Hooked on `wp_sitemaps_init`, the real
     * core hook that fires once `wp_get_sitemap_providers()` is fully
     * populated (sitemaps.php's own docblock).
     *
     * @return void
     */
    public function register_pretty_rewrites(): void {
        // Real new index route.
        add_rewrite_rule( '^sitemap_index\.xml$', 'index.php?sitemap=index', 'top' );

        // Real legacy index route — same real pattern core's own
        // `WP_Sitemaps::register_rewrites()` already registers for
        // `wp-sitemap.xml`; added again here (after core's own, so it
        // wins) with the extra real `vulopilot_legacy_sitemap` flag this
        // class's own `redirect_legacy_url()` checks for below.
        add_rewrite_rule(
            '^wp-sitemap\.xml$',
            'index.php?sitemap=index&vulopilot_legacy_sitemap=1',
            'top'
        );

        // Real legacy provider routes — same 2 real patterns core's own
        // `register_rewrites()` uses (with/without a real subtype), same
        // extra flag.
        add_rewrite_rule(
            '^wp-sitemap-([a-z]+?)-([a-z\d_-]+?)-(\d+?)\.xml$',
            'index.php?sitemap=$matches[1]&sitemap-subtype=$matches[2]&paged=$matches[3]&vulopilot_legacy_sitemap=1',
            'top'
        );
        add_rewrite_rule(
            '^wp-sitemap-([a-z]+?)-(\d+?)\.xml$',
            'index.php?sitemap=$matches[1]&paged=$matches[2]&vulopilot_legacy_sitemap=1',
            'top'
        );

        // Real new pretty provider routes — one pair per real registered
        // provider/subtype, built from the real registry rather than a
        // hardcoded type list.
        foreach ( wp_get_sitemap_providers() as $provider_name => $provider ) {
            $subtypes = $provider->get_object_subtypes();

            if ( empty( $subtypes ) ) {
                $this->add_pretty_provider_rules( $provider_name, null );
                continue;
            }

            foreach ( array_keys( $subtypes ) as $subtype_name ) {
                $this->add_pretty_provider_rules( $provider_name, $subtype_name );
            }
        }
    }

    /**
     * @param string      $provider Real provider name.
     * @param string|null $subtype  Real subtype name, or null for a provider with none.
     * @return void
     */
    private function add_pretty_provider_rules( string $provider, ?string $subtype ): void {
        $name       = preg_quote( $this->pretty_name( $provider, $subtype ), '/' );
        $subtype_qs = $subtype ? '&sitemap-subtype=' . $subtype : '';

        add_rewrite_rule(
            '^' . $name . '-sitemap\.xml$',
            "index.php?sitemap={$provider}{$subtype_qs}&paged=1",
            'top'
        );
        add_rewrite_rule(
            '^' . $name . '-sitemap(\d+)\.xml$',
            "index.php?sitemap={$provider}{$subtype_qs}&paged=\$matches[1]",
            'top'
        );
    }

    /**
     * Real one-time `flush_rewrite_rules()` — retrofitting new rewrite
     * rules into an already-active install needs a real flush (WordPress
     * only ever flushes automatically on plugin activation/theme switch/
     * permalink-settings save), gated on `REWRITE_VERSION` so this real
     * flush only ever runs again if this class's own rule shape changes,
     * not on every single page load.
     *
     * @return void
     */
    public function maybe_flush_rewrite_rules(): void {
        if ( get_option( self::REWRITE_VERSION_OPTION ) === self::REWRITE_VERSION ) {
            return;
        }

        flush_rewrite_rules( false );
        update_option( self::REWRITE_VERSION_OPTION, self::REWRITE_VERSION, false );
    }

    /**
     * Real 301 redirect from an old-shape sitemap URL to its real new
     * pretty equivalent — hooked before core's own `render_sitemaps()`
     * (priority 5 vs core's default 10), so an old URL never actually
     * renders core's real sitemap content at its own address anymore,
     * only forwards to where that same real content now lives.
     *
     * @return void
     */
    public function redirect_legacy_url(): void {
        if ( ! get_query_var( 'vulopilot_legacy_sitemap' ) ) {
            return;
        }

        $sitemap = sanitize_text_field( (string) get_query_var( 'sitemap' ) );
        $subtype = sanitize_text_field( (string) get_query_var( 'sitemap-subtype' ) );
        $paged   = absint( get_query_var( 'paged' ) );

        if ( 'index' === $sitemap ) {
            wp_safe_redirect( home_url( '/sitemap_index.xml' ), 301 );
            exit;
        }

        $name     = $this->pretty_name( $sitemap, $subtype ?: null );
        $new_path = '/' . $name . '-sitemap' . ( $paged > 1 ? $paged : '' ) . '.xml';

        wp_safe_redirect( home_url( $new_path ), 301 );
        exit;
    }
}
