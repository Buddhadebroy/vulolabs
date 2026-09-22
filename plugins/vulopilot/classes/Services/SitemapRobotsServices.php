<?php
/**
 * Every class in this file used to be its own file under classes/Services/
 * (same names, docblocks, and behavior) - merged into one file to reduce
 * classes/'s file count, per direct instruction. Autoloading does not rely on
 * each class's own file matching its own name for this: composer.json's
 * autoload.classmap entry (alongside the existing psr-4 one) makes Composer
 * tokenize every file under classes/ and modules/ and map each class it finds
 * to its real file, however many classes share one file - run
 * `composer dump-autoload` (no `-o`/`--optimize-autoloader` needed) after any
 * further file merge/split here.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

use VuloPilot\AiCopilot\Actions\GenerateSchemaAction;
use VuloPilot\Repositories\RedirectRepository;
use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Scanning → Sitemap tab's "HTML Sitemap" card - a real, human-readable
 * `[vulopilot_html_sitemap]` shortcode (the mockup's own "Shortcode" settings
 * row), independent of the XML sitemap SitemapManager.php wraps WordPress
 * core's own native sitemap with. Queries live post/term data at render
 * time (same "generate on request, don't cache a stale copy" posture
 * GeoAnalysis\LlmsTxtGenerator's own docblock documents for the same
 * reason), gated by the XML sitemap's own `sitemap_xml_post_types`/
 * `sitemap_xml_taxonomies` (formerly its own separate
 * `sitemap_html_post_types`/`sitemap_html_taxonomies` pair - merged into
 * one real shared control each per direct instruction, Settings →
 * GetStarted\Sitemap.ts's own docblock has the reasoning) and
 * `sitemap_exclude_posts`/`sitemap_exclude_terms` (already shared with the
 * XML sitemap, since an explicitly excluded post/term shouldn't reappear
 * here either).
 *
 * Self-registers its own hook in the constructor (php-wordpress.md) and is
 * constructed unconditionally in VuloPilot::init_classes() - the
 * `html_sitemap_enabled` setting only gates output, not registration, same
 * shape as every other Services\* class in this plugin.
 *
 * @class       HtmlSitemapRenderer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class HtmlSitemapRenderer {

    /**
     * Real post_type slug => display label. No `knowledgebase`/`megamenu`
     * entries - this codebase registers no custom post types of its own
     * (confirmed via grep); `product` is only ever rendered when
     * `post_type_exists( 'product' )` is true (WooCommerce active), same
     * conditional-effectiveness pattern GeoAnalysis\LlmsTxtGenerator
     * already uses for its own `products` entry.
     *
     * @var array<string, string>
     */
    private const POST_TYPE_LABELS = array(
        'post'       => 'Posts',
        'page'       => 'Pages',
        'attachment' => 'Media',
        'product'    => 'Products',
    );

    /**
     * Same idea as POST_TYPE_LABELS, for taxonomies. `product_cat`/
     * `product_tag` are only ever rendered when `taxonomy_exists()` is true.
     *
     * @var array<string, string>
     */
    private const TAXONOMY_LABELS = array(
        'category'    => 'Categories',
        'post_tag'    => 'Tags',
        'product_cat' => 'Product Categories',
        'product_tag' => 'Product Tags',
    );

    /**
     * HtmlSitemapRenderer constructor.
     */
    public function __construct() {
        add_shortcode( 'vulopilot_html_sitemap', array( $this, 'render_shortcode' ) );
    }

    /**
     * @return array<string, mixed> Effective settings, defaults filled in.
     */
    private function get_settings(): array {
        return wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
    }

    /**
     * @return string
     */
    public function render_shortcode(): string {
        $settings = $this->get_settings();

        if ( empty( $settings['html_sitemap_enabled'] ) ) {
            return '';
        }

        $display_format = 'grid' === $settings['html_sitemap_display_format'] ? 'grid' : 'list';
        $sections       = array_merge(
            $this->render_post_type_sections( $settings ),
            $this->render_taxonomy_sections( $settings )
        );

        if ( ! $sections ) {
            return '';
        }

        return '<div class="vulopilot-html-sitemap vulopilot-html-sitemap--' . esc_attr( $display_format ) . '">'
            . implode( '', $sections )
            . '</div>';
    }

    /**
     * @param array<string, mixed> $settings Effective plugin settings.
     * @return string[] One rendered `<section>` per included, non-empty post type.
     */
    private function render_post_type_sections( array $settings ): array {
        $included_types = (array) ( $settings['sitemap_xml_post_types'] ?? array() );
        $excluded_posts = $this->parse_id_list( (string) ( $settings['sitemap_exclude_posts'] ?? '' ) );
        $sections       = array();

        foreach ( self::POST_TYPE_LABELS as $post_type => $label ) {
            if ( ! in_array( $post_type, $included_types, true ) || ! post_type_exists( $post_type ) ) {
                continue;
            }

            $query_args = array(
                'post_type'      => $post_type,
                'post_status'    => 'publish',
                'posts_per_page' => -1,
                'orderby'        => $this->get_post_orderby( $settings ),
                'order'          => 'title' === $settings['html_sitemap_sort_by'] ? 'ASC' : 'DESC',
            );

            if ( $excluded_posts ) {
                $query_args['post__not_in'] = $excluded_posts;
            }

            $posts = get_posts( $query_args );

            if ( ! $posts ) {
                continue;
            }

            $items = array();

            foreach ( $posts as $post ) {
                $items[] = $this->render_post_item( $post, $settings );
            }

            $sections[] = $this->render_section( __( $label, 'vulopilot' ), $items ); // phpcs:ignore WordPress.WP.I18n.NonSingularStringLiteralText -- POST_TYPE_LABELS is a fixed, own-authored string constant, not user input; the same __()-over-a-variable shape this codebase already accepts elsewhere for small fixed maps.
        }

        return $sections;
    }

    /**
     * @param array<string, mixed> $settings Effective plugin settings.
     * @return string[] One rendered `<section>` per included, non-empty taxonomy.
     */
    private function render_taxonomy_sections( array $settings ): array {
        $included_taxonomies = (array) ( $settings['sitemap_xml_taxonomies'] ?? array() );
        $excluded_terms      = $this->parse_id_list( (string) ( $settings['sitemap_exclude_terms'] ?? '' ) );
        $sections            = array();

        foreach ( self::TAXONOMY_LABELS as $taxonomy => $label ) {
            if ( ! in_array( $taxonomy, $included_taxonomies, true ) || ! taxonomy_exists( $taxonomy ) ) {
                continue;
            }

            $term_args = array(
                'taxonomy'   => $taxonomy,
                'hide_empty' => true,
            );

            if ( $excluded_terms ) {
                $term_args['exclude'] = $excluded_terms;
            }

            $terms = get_terms( $term_args );

            if ( is_wp_error( $terms ) || ! $terms ) {
                continue;
            }

            $items = array();

            foreach ( $terms as $term ) {
                $items[] = '<li><a href="' . esc_url( get_term_link( $term ) ) . '">' . esc_html( $term->name ) . '</a></li>';
            }

            $sections[] = $this->render_section( __( $label, 'vulopilot' ), $items ); // phpcs:ignore WordPress.WP.I18n.NonSingularStringLiteralText -- see render_post_type_sections()'s own note above.
        }

        return $sections;
    }

    /**
     * @param \WP_Post             $post     Post to render one `<li>` for.
     * @param array<string, mixed> $settings Effective plugin settings.
     * @return string
     */
    private function render_post_item( \WP_Post $post, array $settings ): string {
        $title = get_the_title( $post );

        if ( 'seo_title' === $settings['html_sitemap_item_titles'] ) {
            $seo_title = get_post_meta( $post->ID, PostSeoMetaFields::META_KEYS['social_title'], true );
            $title     = $seo_title ? $seo_title : $title;
        }

        $date_html = '';

        if ( ! empty( $settings['html_sitemap_show_dates'] ) ) {
            $date_source = 'modified_date' === $settings['html_sitemap_sort_by'] ? $post->post_modified : $post->post_date;
            $date_html   = ' <span class="vulopilot-html-sitemap__date">' . esc_html( mysql2date( get_option( 'date_format' ), $date_source ) ) . '</span>';
        }

        return '<li><a href="' . esc_url( get_permalink( $post ) ) . '">' . esc_html( $title ) . '</a>' . $date_html . '</li>';
    }

    /**
     * @param array<string, mixed> $settings Effective plugin settings.
     * @return string WP_Query-compatible orderby value.
     */
    private function get_post_orderby( array $settings ): string {
        switch ( $settings['html_sitemap_sort_by'] ) {
            case 'modified_date':
                return 'modified';
            case 'title':
                return 'title';
            default:
                return 'date';
        }
    }

    /**
     * @param string   $heading Section heading text.
     * @param string[] $items   Already-built `<li>` markup.
     * @return string
     */
    private function render_section( string $heading, array $items ): string {
        return '<section class="vulopilot-html-sitemap__section">'
            . '<h2 class="vulopilot-html-sitemap__heading">' . esc_html( $heading ) . '</h2>'
            . '<ul class="vulopilot-html-sitemap__list">' . implode( '', $items ) . '</ul>'
            . '</section>';
    }

    /**
     * @param string $raw Comma-separated IDs, e.g. "12, 48, 103".
     * @return int[] Positive integer IDs only.
     */
    private function parse_id_list( string $raw ): array {
        if ( '' === trim( $raw ) ) {
            return array();
        }

        return array_values(
            array_filter(
                array_map( 'absint', explode( ',', $raw ) )
            )
        );
    }
}

/**
 * Enqueues the post-editor SEO metabox - src/post-editor/index.tsx, a
 * `@wordpress/plugins` PluginSidebar registered into the Block Editor,
 * not a mount into VuloPilot's own dashboard app (a separate
 * `#admin-main-wrapper` mount point).
 *
 * Deliberately a `PluginSidebar`, not a classic `add_meta_box()` panel:
 * note the sidebar's `.interface-complementary-area__body` scrolls
 * internally on a long panel - inherent to PluginSidebar, not a bug here.
 *
 * Only enqueued for every post type Services\PostSeoMetaFields::POST_TYPES
 * covers (post/page/product) - that constant is the metabox's single
 * source of truth for which screens it appears on, referenced here rather
 * than duplicated, so this can't silently drift out of sync with which
 * postmeta fields are actually registered for a given post type.
 *
 * @class       PostEditorAssets class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PostEditorAssets {

    /**
     * PostEditorAssets constructor.
     */
    public function __construct() {
        add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_assets' ) );
    }

    /**
     * Enqueues the post-editor sidebar's script/style on post/page/product
     * edit screens.
     *
     * @return void
     */
    public function enqueue_assets(): void {
        $screen = get_current_screen();

        if ( ! $screen || ! in_array( $screen->post_type, PostSeoMetaFields::POST_TYPES, true ) ) {
            return;
        }

        $asset_file = VuloPilot()->plugin_path . 'assets/js/post-editor.asset.php';

        if ( ! file_exists( $asset_file ) ) {
            return;
        }

        $asset = include $asset_file;

        wp_enqueue_script(
            'vulopilot-post-editor',
            VuloPilot()->plugin_url . 'assets/js/post-editor.js',
            $asset['dependencies'],
            $asset['version'],
            true
        );

        $style_path = VuloPilot()->plugin_path . 'assets/styles/post-editor.css';
        if ( file_exists( $style_path ) ) {
            wp_enqueue_style( 'vulopilot-post-editor', VuloPilot()->plugin_url . 'assets/styles/post-editor.css', array(), $asset['version'] );
        }

        wp_localize_script(
            'vulopilot-post-editor',
            'vulopilotPostSeo',
            array(
                'apiUrl'   => esc_url_raw( rest_url( VuloPilot()->rest_namespace ) ),
                'nonce'    => wp_create_nonce( 'wp_rest' ),
                'isPro'    => VuloPilot()->util->is_khali_dabba(),
                // Same constant FrontendScripts::localize_scripts() itself
                // localizes as 'shop_url' - not a container key.
                'shopUrl'  => defined( 'VULOPILOT_PRO_SHOP_URL' ) ? VULOPILOT_PRO_SHOP_URL : '',
                // The metabox reads/writes native post meta via
                // wp.data's core/editor 'meta' attribute (registered by
                // Services\PostSeoMetaFields), keyed by these exact
                // strings - localized rather than hand-copied in TS so
                // the two layers can't drift apart.
                'metaKeys' => array_merge(
                    PostSeoMetaFields::META_KEYS,
                    array( 'schema_json' => GenerateSchemaAction::META_KEY )
                ),
            )
        );
    }
}

/**
 * The post-editor metabox's Advanced tab noindex/nofollow toggles
 * (Services\PostSeoMetaFields::META_KEYS) - filters WordPress core's own
 * `wp_robots` output (the `<meta name="robots">` tag core has generated
 * since WP 5.7) rather than echoing a second, competing robots tag. No
 * settings gate: like Services\SchemaJsonLdRenderer, there's nothing to
 * output until a post actually has one of these postmeta flags set, so
 * construction is unconditional and the filter is a no-op until then.
 *
 * @class       PostRobotsMetaManager class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PostRobotsMetaManager {

    /**
     * PostRobotsMetaManager constructor.
     */
    public function __construct() {
        add_filter( 'wp_robots', array( $this, 'maybe_filter_robots' ) );
    }

    /**
     * Adds noindex/nofollow to core's robots directives when this post's metabox flags are set.
     *
     * @param array<string, bool> $robots Core's own robots directives array.
     * @return array<string, bool>
     */
    public function maybe_filter_robots( array $robots ): array {
        if ( ! is_singular() ) {
            return $robots;
        }

        $post_id = get_queried_object_id();

        if ( get_post_meta( $post_id, PostSeoMetaFields::META_KEYS['robots_noindex'], true ) ) {
            $robots['noindex'] = true;
        }

        if ( get_post_meta( $post_id, PostSeoMetaFields::META_KEYS['robots_nofollow'], true ) ) {
            $robots['nofollow'] = true;
        }

        return $robots;
    }
}

/**
 * Readme.txt's "Redirects & 404s" - a real 301/302 redirect manager over
 * the `vulopilot_redirects` table, the feature Utill.php's own
 * `enable_redirect_manager`/`auto_redirect_on_slug_change` settings were
 * persisted for but had nothing behind them until now. Self-registers its
 * own hooks (php-wordpress.md) and is constructed unconditionally in
 * VuloPilot::init_classes(), the same shape CrawlerTrafficLogger/
 * LlmsTxtGenerator already use - both settings gate behavior inside the
 * hook callbacks, not whether the class is built at all.
 *
 * `maybe_apply_redirect()` runs on `template_redirect` at priority 1 -
 * deliberately earlier than Services\NotFoundLogger's own `template_redirect`
 * hook (priority 20) and CrawlerTrafficLogger's (default priority 10), so a
 * configured redirect always wins and a request it resolves is never also
 * counted as a 404 by the logger running later in the same request.
 *
 * `maybe_auto_create_redirect()` is the "Auto-create redirect on slug
 * change" setting's own implementation - hooked to core's `post_updated`
 * (fires with both the before/after WP_Post objects already loaded, no
 * extra query needed to know the previous slug). Passing $post_before
 * directly to get_permalink() is what makes computing the OLD permalink
 * possible without re-querying: get_permalink() accepts an already-loaded
 * WP_Post and reads its own post_name property rather than looking the
 * post up again, so the object's stale (pre-save) slug is exactly what a
 * live get_permalink() call would have returned a moment earlier.
 *
 * @class       RedirectManager class
 * @version     1.0.0
 * @author      VuloLabs
 */
class RedirectManager {

    /**
     * RedirectManager constructor.
     */
    public function __construct() {
        add_action( 'template_redirect', array( $this, 'maybe_apply_redirect' ), 1 );
        add_action( 'post_updated', array( $this, 'maybe_auto_create_redirect' ), 10, 3 );
    }

    /**
     * Redirects the current request if its path matches an active row.
     *
     * @return void
     */
    public function maybe_apply_redirect(): void {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['enable_redirect_manager'] ) ) {
            return;
        }

        $requested_uri = isset( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';
        $path          = wp_parse_url( $requested_uri, PHP_URL_PATH ) ?? '/';
        $source_path   = RedirectRepository::normalize_path( $path );

        $repository = new RedirectRepository();
        $redirect   = $repository->find_by_source_path( $source_path );

        if ( ! $redirect || empty( $redirect['is_active'] ) ) {
            return;
        }

        $repository->increment_hit_count( (int) $redirect['id'] );

        // wp_safe_redirect() deliberately can't be used here - it silently
        // substitutes any target outside wp_validate_redirect()'s allowed-
        // hosts list with admin_url(), which would send every visitor to
        // /wp-admin/ instead for the common, expected case of redirecting
        // to an external domain (a site migration, a moved page now
        // living elsewhere). Safe here despite that: the target came from
        // an admin-configured row (manage_options-gated,
        // RestAPI\Controllers\Redirects::create_item()/update_item()
        // already ran it through esc_url_raw() before it was ever stored),
        // not from this request's own input.
        wp_redirect( $redirect['target_url'], (int) $redirect['redirect_type'] ); // phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect -- see comment above: target is admin-configured and pre-sanitized, not visitor input.
        exit;
    }

    /**
     * Creates or updates a redirect from a post's old permalink when its slug changes.
     *
     * @param int      $post_id    Post id (unused - $post_before/$post_after already carry everything needed).
     * @param \WP_Post $post_after Post object after the save.
     * @param \WP_Post $post_before Post object as it was before the save.
     * @return void
     */
    public function maybe_auto_create_redirect( $post_id, $post_after, $post_before ): void {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['enable_redirect_manager'] ) || empty( $settings['auto_redirect_on_slug_change'] ) ) {
            return;
        }

        // Only a slug change on a post that was ALREADY publicly published
        // has a real, previously-indexable URL worth protecting with a
        // redirect - every draft/autosave save also fires post_updated,
        // and this guard is what keeps those from creating junk rows.
        if ( 'publish' !== $post_before->post_status || $post_before->post_name === $post_after->post_name ) {
            return;
        }

        if ( ! is_post_type_viewable( $post_after->post_type ) ) {
            return;
        }

        $old_path = RedirectRepository::normalize_path( (string) wp_parse_url( get_permalink( $post_before ), PHP_URL_PATH ) );
        $new_path = RedirectRepository::normalize_path( (string) wp_parse_url( get_permalink( $post_after ), PHP_URL_PATH ) );

        if ( '' === $old_path || $old_path === $new_path ) {
            return;
        }

        $repository = new RedirectRepository();
        $existing   = $repository->find_by_source_path( $old_path );
        $target_url = get_permalink( $post_after );

        if ( $existing ) {
            $repository->update(
                (int) $existing['id'],
                array(
                    'target_url'    => $target_url,
                    'redirect_type' => 301,
                    'is_active'     => 1,
                )
            );

            return;
        }

        $repository->insert(
            array(
                'source_path'   => $old_path,
                'target_url'    => $target_url,
                'redirect_type' => 301,
                'hit_count'     => 0,
                'is_active'     => 1,
                'created_by'    => get_current_user_id(),
            )
        );
    }
}

/**
 * Parses `/robots.txt` into per-user-agent Disallow groups, scoped to the
 * known AI bot tokens (CrawlerTrafficLogger::get_bot_signatures()) - the
 * one piece Seo\Scanners\RobotsTxtScanner deliberately doesn't cover
 * (its own docblock: a narrow, wildcard-only check, not a full parser).
 * Real RFC 9309 precedence (Allow overrides, longest-match) is out of
 * scope here too - same "narrow, deliberate check" restraint, just applied
 * to a second, AI-bot-specific question: does a given bot have its OWN
 * named group, or does it fall back to the wildcard (`*`) group's rules,
 * the one piece of real robots.txt semantics this feature needs to be
 * useful (most site owners only ever write a `User-agent: *` block).
 *
 * @class       RobotsTxtBotAccess class
 * @version     1.0.0
 * @author      VuloLabs
 */
class RobotsTxtBotAccess {

    private const REQUEST_TIMEOUT_SECONDS = 8;
    private const CACHE_KEY               = 'vulopilot_robots_txt_bot_groups';
    private const CACHE_TTL_SECONDS       = HOUR_IN_SECONDS;

    /**
     * Settings → Developer Tools' "Clear cache" - same public
     * `clear_cache()` shape `Services\EntityExtractor` already establishes.
     *
     * @return void
     */
    public function clear_cache(): void {
        delete_transient( self::CACHE_KEY );
    }

    /**
     * Disallow paths for one bot token - its own named group if robots.txt
     * has one, otherwise the wildcard group's rules, otherwise empty (no
     * restriction found for that bot).
     *
     * @param string $bot_token Literal User-Agent token, e.g. 'GPTBot'.
     * @return string[] Disallow paths (may include '/').
     */
    public function get_disallowed_paths_for_bot( string $bot_token ): array {
        return $this->resolve_from_groups( $this->get_groups(), $bot_token );
    }

    /**
     * The actual "named group, or fall back to wildcard" resolution -
     * split out from get_disallowed_paths_for_bot() so it's testable
     * against a fixture $groups array without mocking the network fetch
     * get_groups() itself needs.
     *
     * @param array<string, string[]> $groups    Parsed robots.txt groups.
     * @param string                  $bot_token Literal User-Agent token.
     * @return string[]
     */
    private function resolve_from_groups( array $groups, string $bot_token ): array {
        if ( isset( $groups[ $bot_token ] ) ) {
            return $groups[ $bot_token ];
        }

        return $groups['*'] ?? array();
    }

    /**
     * @return array<string, string[]> User-agent token => Disallow paths.
     */
    private function get_groups(): array {
        $cached = get_transient( self::CACHE_KEY );

        if ( is_array( $cached ) ) {
            return $cached;
        }

        $groups   = array();
        $response = wp_remote_get(
            home_url( '/robots.txt' ),
            array(
                'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
                'sslverify' => false,
            )
        );

        if ( ! is_wp_error( $response ) && 200 === wp_remote_retrieve_response_code( $response ) ) {
            $groups = $this->parse_groups( wp_remote_retrieve_body( $response ) );
        }

        set_transient( self::CACHE_KEY, $groups, self::CACHE_TTL_SECONDS );

        return $groups;
    }

    /**
     * @param string $body robots.txt contents.
     * @return array<string, string[]>
     */
    private function parse_groups( string $body ): array {
        $lines               = preg_split( '/\r\n|\r|\n/', $body );
        $current_agents      = array();
        $last_line_was_agent = false;
        $groups              = array();

        foreach ( (array) $lines as $line ) {
            $line = trim( (string) $line );

            if ( '' === $line || '#' === $line[0] ) {
                continue;
            }

            if ( preg_match( '/^user-agent:\s*(.+)$/i', $line, $matches ) ) {
                // A run of consecutive User-agent lines shares the rules
                // that follow (standard robots.txt grouping) - reset the
                // list only when this line doesn't immediately follow
                // another User-agent line.
                if ( ! $last_line_was_agent ) {
                    $current_agents = array();
                }

                $current_agents[]    = trim( $matches[1] );
                $last_line_was_agent = true;
                continue;
            }

            $last_line_was_agent = false;

            if ( empty( $current_agents ) || ! preg_match( '/^disallow:\s*(\S*)\s*$/i', $line, $matches ) ) {
                continue;
            }

            $path = trim( $matches[1] );

            if ( '' === $path ) {
                continue;
            }

            foreach ( $current_agents as $agent ) {
                $groups[ $agent ]   = $groups[ $agent ] ?? array();
                $groups[ $agent ][] = $path;
            }
        }

        return $groups;
    }
}

/**
 * Scanning → SEO's "Auto-generate robots.txt" toggle, plus Crawl & URLs →
 * Robots & Sitemap's own "Edit" action (Controllers\RobotsSitemap). Not a
 * from-scratch robots.txt file generator - WordPress core already serves
 * a virtual robots.txt (`do_robots()`, filterable via `robots_txt`) at
 * every install's /robots.txt, which is exactly the URL
 * Seo\Scanners\RobotsTxtScanner already checks. Two real, independent
 * things layer onto that same real filter:
 *   - When "Auto-generate robots.txt" is on, appends a `Sitemap:` line
 *     pointing at core's own sitemap (see SitemapManager) so crawlers
 *     that read robots.txt for a sitemap reference find one - the one
 *     thing WordPress core's own virtual robots.txt never adds by itself.
 *   - When a real custom override has been saved (the "Edit" action's own
 *     real `POST /robots-sitemap/robots`), that content REPLACES core's
 *     own virtual output outright - a real, persisted admin-authored
 *     robots.txt, not a preview: the very next live fetch of
 *     `/robots.txt` returns exactly this. Runs at an earlier priority
 *     than the sitemap-line logic so a custom file that doesn't already
 *     have its own `Sitemap:` line still gets one, same as core's own
 *     default output would.
 *
 * Self-registers its own hooks in the constructor (php-wordpress.md) and
 * is constructed unconditionally in VuloPilot::init_classes().
 *
 * @class       RobotsTxtManager class
 * @version     1.0.0
 * @author      VuloLabs
 */
class RobotsTxtManager {

    /**
     * Real, persisted admin-authored robots.txt override - empty/absent
     * means "use WordPress core's own virtual output," same as before
     * this option existed.
     */
    private const CUSTOM_CONTENT_OPTION = 'vulopilot_custom_robots_txt';

    /**
     * RobotsTxtManager constructor.
     */
    public function __construct() {
        add_filter( 'robots_txt', array( $this, 'maybe_use_custom_robots_txt' ), 5, 1 );
        add_filter( 'robots_txt', array( $this, 'maybe_append_sitemap_line' ), 20, 2 );
    }

    /**
     * @param string $output The robots.txt content built so far.
     * @return string
     */
    public function maybe_use_custom_robots_txt( $output ) {
        $custom = $this->get_custom_content();

        return '' !== $custom ? $custom : $output;
    }

    /**
     * @param string $output       The robots.txt content built so far.
     * @param bool   $is_public    Whether the site is set to be publicly indexed.
     * @return string
     */
    public function maybe_append_sitemap_line( $output, $is_public ) {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['robots_auto_generate'] ) || ! $is_public ) {
            return $output;
        }

        if ( false !== strpos( $output, 'Sitemap:' ) ) {
            return $output; // Another plugin/theme (or the real custom override above) already added one - don't duplicate.
        }

        return rtrim( $output ) . "\nSitemap: " . home_url( '/wp-sitemap.xml' ) . "\n";
    }

    /**
     * @return string Real saved override content, or '' when none is set.
     */
    public function get_custom_content(): string {
        return (string) get_option( self::CUSTOM_CONTENT_OPTION, '' );
    }

    /**
     * @param string $content Real new override content - '' clears it, reverting to WordPress core's own virtual robots.txt.
     * @return void
     */
    public function save_custom_content( string $content ): void {
        if ( '' === $content ) {
            delete_option( self::CUSTOM_CONTENT_OPTION );
            return;
        }

        update_option( self::CUSTOM_CONTENT_OPTION, $content, false );
    }
}

/**
 * Scanning → Sitemap tab's real backing - a set of real filters/toggles
 * over WordPress core's own native sitemap at /wp-sitemap.xml (since 5.5;
 * Seo\Scanners\SitemapScanner already checks for exactly this URL), not
 * a from-scratch sitemap generator: `sitemap_enabled` gates core's own
 * `wp_sitemaps_enabled`, `sitemap_links_per_page` overrides core's own
 * `wp_sitemaps_max_urls`, `sitemap_xml_post_types`/`sitemap_xml_taxonomies`
 * subtract from core's own `wp_sitemaps_post_types`/`wp_sitemaps_taxonomies`
 * (these 2 settings are also read directly by
 * Services\HtmlSitemapRenderer for the `[vulopilot_html_sitemap]`
 * shortcode - one real shared control each in Settings →
 * GetStarted\Sitemap.ts, not a separate XML/HTML pair, per direct
 * instruction), and `sitemap_exclude_posts`/`sitemap_exclude_terms` add
 * `post__not_in`/`exclude` onto core's own per-provider query args. All
 * real, all just wrapping/narrowing what core already builds.
 *
 * `sitemap_enabled` alone also gates pinging Bing's still-supported sitemap
 * ping endpoint whenever published content is saved (the UI's own separate
 * "Ping search engines on update" toggle was folded into "Generate XML
 * sitemap" - one real setting instead of two). Google deprecated its own
 * sitemap ping endpoint in June 2023 (Search Console / robots.txt
 * discovery are the only supported paths now) - this deliberately does
 * NOT call it: silently hitting a dead endpoint and reporting success
 * would be dishonest, the same posture CrawlerTrafficLogger's own
 * Google-Extended correction already takes for a similar Google-specific
 * gap.
 *
 * `sitemap_include_images`/`sitemap_include_featured_images` are NOT
 * implemented here - core's native sitemaps have no `<image:image>`
 * extension support at all, and adding one would mean building a second,
 * competing sitemap implementation, exactly what this class exists to
 * avoid. They round-trip through Settings (Utill::VULOPILOT_SETTINGS_DEFAULTS's
 * own comment documents this same gap) but nothing reads them - same
 * honest posture Seo.ts's Redirects & 404s section already takes for its
 * own not-yet-built features.
 *
 * Self-registers its own hooks in the constructor (php-wordpress.md) and
 * is constructed unconditionally in VuloPilot::init_classes() - every
 * hook reads its own setting before doing anything.
 *
 * @class       SitemapManager class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SitemapManager {

    private const BING_PING_URL = 'https://www.bing.com/ping';

    /**
     * SitemapManager constructor.
     */
    public function __construct() {
        add_filter( 'wp_sitemaps_enabled', array( $this, 'filter_sitemaps_enabled' ) );
        add_action( 'save_post', array( $this, 'maybe_ping_search_engines' ), 10, 2 );

        add_filter( 'wp_sitemaps_max_urls', array( $this, 'filter_max_urls' ) );
        add_filter( 'wp_sitemaps_post_types', array( $this, 'filter_post_types' ) );
        add_filter( 'wp_sitemaps_taxonomies', array( $this, 'filter_taxonomies' ) );
        add_filter( 'wp_sitemaps_posts_query_args', array( $this, 'filter_posts_query_args' ) );
        add_filter( 'wp_sitemaps_taxonomies_query_args', array( $this, 'filter_taxonomies_query_args' ) );
    }

    /**
     * @return array<string, mixed> Effective settings, defaults filled in.
     */
    private function get_settings(): array {
        return wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
    }

    /**
     * `sitemap_links_per_page` - 0 or unset falls back to core's own
     * default (2000) rather than passing through a nonsensical override.
     *
     * @param int $max_urls Core's own current max-URLs-per-page value.
     * @return int
     */
    public function filter_max_urls( $max_urls ) {
        $links_per_page = (int) ( $this->get_settings()['sitemap_links_per_page'] ?? 0 );

        return $links_per_page > 0 ? $links_per_page : $max_urls;
    }

    /**
     * Narrows core's own registered sitemap post types down to
     * `sitemap_xml_post_types` - a post type core would otherwise include
     * (e.g. 'attachment') is dropped from the XML sitemap entirely when
     * its slug isn't in that setting.
     *
     * @param \WP_Post_Type[] $post_types Core's own currently-registered sitemap post types, keyed by slug.
     * @return \WP_Post_Type[]
     */
    public function filter_post_types( $post_types ) {
        $included = (array) ( $this->get_settings()['sitemap_xml_post_types'] ?? array() );

        foreach ( $post_types as $slug => $post_type_object ) {
            if ( ! in_array( $slug, $included, true ) ) {
                unset( $post_types[ $slug ] );
            }
        }

        return $post_types;
    }

    /**
     * Same narrowing as filter_post_types(), for taxonomies.
     *
     * @param \WP_Taxonomy[] $taxonomies Core's own currently-registered sitemap taxonomies, keyed by slug.
     * @return \WP_Taxonomy[]
     */
    public function filter_taxonomies( $taxonomies ) {
        $included = (array) ( $this->get_settings()['sitemap_xml_taxonomies'] ?? array() );

        foreach ( $taxonomies as $slug => $taxonomy_object ) {
            if ( ! in_array( $slug, $included, true ) ) {
                unset( $taxonomies[ $slug ] );
            }
        }

        return $taxonomies;
    }

    /**
     * `sitemap_exclude_posts` - comma-separated post IDs, applied via
     * core's own `wp_sitemaps_posts_query_args` filter.
     *
     * @param array $args Core's own current WP_Query args for one sitemap page.
     * @return array
     */
    public function filter_posts_query_args( $args ) {
        $excluded = $this->parse_id_list( (string) ( $this->get_settings()['sitemap_exclude_posts'] ?? '' ) );

        if ( $excluded ) {
            $args['post__not_in'] = array_merge( $args['post__not_in'] ?? array(), $excluded );
        }

        return $args;
    }

    /**
     * `sitemap_exclude_terms` - comma-separated term IDs, applied via
     * core's own `wp_sitemaps_taxonomies_query_args` filter.
     *
     * @param array $args Core's own current get_terms() args for one sitemap page.
     * @return array
     */
    public function filter_taxonomies_query_args( $args ) {
        $excluded = $this->parse_id_list( (string) ( $this->get_settings()['sitemap_exclude_terms'] ?? '' ) );

        if ( $excluded ) {
            $args['exclude'] = array_merge( $args['exclude'] ?? array(), $excluded );
        }

        return $args;
    }

    /**
     * @param string $raw Comma-separated IDs, e.g. "12, 48, 103".
     * @return int[] Positive integer IDs only.
     */
    private function parse_id_list( string $raw ): array {
        if ( '' === trim( $raw ) ) {
            return array();
        }

        return array_values(
            array_filter(
                array_map( 'absint', explode( ',', $raw ) )
            )
        );
    }

    /**
     * @param bool $enabled Core's own current wp_sitemaps_enabled value.
     * @return bool
     */
    public function filter_sitemaps_enabled( $enabled ) {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['sitemap_enabled'] ) ) {
            return false;
        }

        return $enabled;
    }

    /**
     * @param int      $post_id Post being saved.
     * @param \WP_Post $post    The post object.
     * @return void
     */
    public function maybe_ping_search_engines( $post_id, $post ): void {
        if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
            return;
        }

        if ( 'publish' !== $post->post_status ) {
            return;
        }

        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['sitemap_enabled'] ) ) {
            return;
        }

        wp_remote_get(
            self::BING_PING_URL . '?sitemap=' . rawurlencode( home_url( '/wp-sitemap.xml' ) ),
            array(
                'timeout'  => 5,
                'blocking' => false,
            )
        );
    }
}

/**
 * Restyles WordPress core's own native `/wp-sitemap.xml` browser view
 * (`WP_Sitemaps_Stylesheet`, wp-includes/sitemaps) to match the reference
 * mockup - a purple banner header (this plugin's own real brand color,
 * `#7c3aed`, the same `var(--color-primary, #7c3aed)` fallback already
 * used throughout this plugin's own admin styles) instead of core's plain
 * white header, and a real "Last Modified" column on the sitemap INDEX
 * page's own table.
 *
 * Deliberately does NOT build a second, competing sitemap renderer -
 * same "wrap/restyle core's own native sitemap, don't replace it" posture
 * SitemapManager.php's own docblock already establishes for the data side
 * of this same feature. Only 2 real core hooks are used:
 *
 * - `wp_sitemaps_stylesheet_css` - real CSS-only override, applies to
 *   BOTH the index page and every individual child sitemap page (core's
 *   own `get_stylesheet_css()` is shared between both), so the banner/
 *   table restyle is consistent everywhere with one filter.
 * - `wp_sitemaps_stylesheet_index_content` - a full real XSL override,
 *   ONLY for the index page's own table (`/wp-sitemap.xml`, the one
 *   listing child sitemaps the mockup shows) - core's own default XSL
 *   already conditionally renders a real "Last Modified" column
 *   (`<xsl:if test="$has-lastmod">`) but only when EVERY listed sitemap
 *   happens to carry one; this override removes that condition so the
 *   column always renders, with real per-sitemap `<lastmod>` values core
 *   itself already provides (genuinely empty, never a fabricated date,
 *   for the rare sitemap type with none). Individual child sitemap pages
 *   (the per-URL listing, e.g. `/wp-sitemap-posts-post-1.xml`) are left on
 *   core's own default XSL structure - only the CSS restyle above applies
 *   there, since that table already has a real, always-conditional
 *   "Last Modified" column of its own core doesn't need help with.
 *
 * Self-registers its own hooks in the constructor (php-wordpress.md) and
 * is constructed unconditionally in VuloPilot::init_classes(), same shape
 * as SitemapManager.php right next to it.
 *
 * @class       SitemapStylesheet class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SitemapStylesheet {

    /**
     * This plugin's own real brand purple - the same `#7c3aed` fallback
     * `var(--color-primary, #7c3aed)` already resolves to throughout this
     * plugin's own admin CSS (assets/styles/index.css,
     * src/pages/Content/CreateContent.scss), reused here rather than
     * Rank Math's own unrelated blue so this page matches the rest of
     * this plugin's own real brand identity.
     *
     * @var string
     */
    private const BRAND_COLOR = '#7c3aed';

    /**
     * Light tint of BRAND_COLOR - same real paired `background:
     * var(--background-primary, #ece2f9f1)` this plugin's own admin CSS
     * already uses alongside the solid brand purple.
     *
     * @var string
     */
    private const BRAND_TINT = '#ece2f9';

    /**
     * SitemapStylesheet constructor.
     */
    public function __construct() {
        add_filter( 'wp_sitemaps_stylesheet_css', array( $this, 'filter_stylesheet_css' ) );
        add_filter( 'wp_sitemaps_stylesheet_index_content', array( $this, 'filter_index_stylesheet_content' ) );
    }

    /**
     * Real CSS-only restyle - applies to core's own existing markup
     * structure (`#sitemap__header`/`#sitemap__table`) unchanged, so this
     * alone can't break core's own XSL templating on either the index or
     * any child sitemap page.
     *
     * @param string $css Core's own default CSS for the sitemap stylesheet.
     * @return string
     */
    public function filter_stylesheet_css( $css ) {
        $brand = self::BRAND_COLOR;
        $tint  = self::BRAND_TINT;

        return $css . "
			body {
				font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen-Sans, Ubuntu, Cantarell, \"Helvetica Neue\", sans-serif;
				background: #fff;
				color: #444;
				margin: 0;
			}

			#sitemap {
				max-width: 100%;
			}

			#sitemap__header {
				background: {$brand};
				color: #fff;
				padding: 2rem 2.5rem;
				margin: 0;
			}

			#sitemap__header h1 {
				margin: 0 0 0.5rem;
				font-size: 1.75rem;
			}

			#sitemap__header p {
				margin: 0.25rem 0;
				color: rgba(255, 255, 255, 0.85);
			}

			#sitemap__header a {
				color: #fff;
				text-decoration: underline;
			}

			#sitemap__content {
				max-width: 980px;
				margin: 0 auto;
				padding: 1.5rem 2.5rem 2.5rem;
			}

			#sitemap__table {
				border: solid 1px {$tint};
				border-radius: 0.375rem;
				overflow: hidden;
				width: 100%;
			}

			#sitemap__table tr th {
				background: {$brand};
				color: #fff;
				font-weight: 600;
				padding: 0.625rem;
			}
			#sitemap__table tr td{padding: 0.625rem;}
			#sitemap__table tr:nth-child(odd) td {
				background-color: {$tint};
			}
			#sitemap__table tr a{text-decoration: none;}

";
    }

    /**
     * Full real XSL override for the sitemap INDEX page only (the
     * top-level `/wp-sitemap.xml` listing child sitemaps) - same real
     * `sitemap:sitemapindex/sitemap:sitemap` data core's own default
     * template already reads, just without the `$has-lastmod` guard that
     * hides the "Last Modified" column whenever even one listed sitemap
     * happens to lack a real `<lastmod>`.
     *
     * @param string $xsl_content Core's own default index XSL content (unused - this returns a full real replacement built from the same real translatable strings core itself would use).
     * @return string
     */
    public function filter_index_stylesheet_content( $xsl_content ) {
        $title       = esc_xml( __( 'XML Sitemap', 'vulopilot' ) );
        $description = esc_xml( __( 'This XML Sitemap is generated by WordPress to make your content more visible for search engines.', 'vulopilot' ) );
        $learn_more  = sprintf(
            '<a href="%s">%s</a>',
            esc_url( __( 'https://www.sitemaps.org/', 'vulopilot' ) ),
            esc_xml( __( 'Learn more about XML sitemaps.', 'vulopilot' ) )
        );

        $text = sprintf(
            /* translators: %s: real count of child sitemaps in this index. */
            esc_xml( __( 'This XML Sitemap Index file contains %s sitemaps.', 'vulopilot' ) ),
            '<xsl:value-of select="count( sitemap:sitemapindex/sitemap:sitemap )" />'
        );

        $lang    = get_language_attributes( 'html' );
        $url     = esc_xml( __( 'Sitemap', 'vulopilot' ) );
        $lastmod = esc_xml( __( 'Last Modified', 'vulopilot' ) );
        $css     = $this->filter_stylesheet_css( '' );

        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<xsl:stylesheet
		version=\"1.0\"
		xmlns:xsl=\"http://www.w3.org/1999/XSL/Transform\"
		xmlns:sitemap=\"http://www.sitemaps.org/schemas/sitemap/0.9\"
		exclude-result-prefixes=\"sitemap\"
		>

	<xsl:output method=\"html\" encoding=\"UTF-8\" indent=\"yes\" />

	<xsl:template match=\"/\">
		<html {$lang}>
			<head>
				<title>{$title}</title>
				<style>
					{$css}
				</style>
			</head>
			<body>
				<div id=\"sitemap\">
					<div id=\"sitemap__header\">
						<h1>{$title}</h1>
						<p>{$description}</p>
						<p>{$learn_more}</p>
					</div>
					<div id=\"sitemap__content\">
						<p class=\"text\">{$text}</p>
						<table id=\"sitemap__table\">
							<thead>
								<tr>
									<th class=\"loc\">{$url}</th>
									<th class=\"lastmod\">{$lastmod}</th>
								</tr>
							</thead>
							<tbody>
								<xsl:for-each select=\"sitemap:sitemapindex/sitemap:sitemap\">
									<tr>
										<td class=\"loc\"><a href=\"{sitemap:loc}\"><xsl:value-of select=\"sitemap:loc\" /></a></td>
										<td class=\"lastmod\"><xsl:value-of select=\"sitemap:lastmod\" /></td>
									</tr>
								</xsl:for-each>
							</tbody>
						</table>
					</div>
				</div>
			</body>
		</html>
	</xsl:template>
</xsl:stylesheet>

";
    }
}

/**
 * Rewrites WordPress core's native sitemap URLs from
 * `/wp-sitemap.xml`/`/wp-sitemap-{provider}-{subtype}-{page}.xml` to the
 * more familiar `/sitemap_index.xml`/`/{subtype}-sitemap{page}.xml`. Not a
 * second sitemap system: every new URL maps to the same
 * `sitemap`/`sitemap-subtype`/`paged` query vars core already uses, so
 * core's unmodified `render_sitemaps()` renders it.
 *
 * Per-type name (`page`, `post`, `category`, …) is read once from
 * `wp_get_sitemap_providers()`'s `get_object_subtypes()` on
 * `wp_sitemaps_init`, so this works for any registered post
 * type/taxonomy without a hardcoded list. A provider with no subtypes
 * (`users`) falls back to its provider name (`users-sitemap.xml`).
 *
 * Old URLs must keep working: `redirect_legacy_url()` (on
 * `template_redirect`, priority 5 - before core's render at 10) 301s the
 * old-shape URL to the new one before core renders anything, so sites
 * already indexed or with the old URL in Search Console don't 404.
 *
 * @class       SitemapUrlRewriter class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SitemapUrlRewriter {

    /**
     * Bumped whenever this class's own rewrite rules change shape - the
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
        // pattern it happens to reverse-match first - undoing this class's
        // own real redirect direction and creating a genuine old↔new
        // redirect loop (confirmed live against this exact install).
        // Sitemap query vars aren't a real post/page/term core's canonical
        // logic actually needs to correct, so this fully opts every real
        // sitemap request out of that mechanism - `redirect_legacy_url()`
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
     * Real per-provider pretty name - the real registered subtype name
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
     * core's own real `wp_sitemaps_index_entry` filter - so a crawler
     * reading the index never has to bounce through this class's own
     * real 301 for every single child sitemap it lists; it reads the
     * pretty URL straight away, same real destination either way.
     *
     * `$object_type` is core's own real *generic* object type
     * (`post`/`term`/`user` - `WP_Sitemaps_Provider::$object_type`, a
     * different real value than the registry provider name
     * `register_pretty_rewrites()` above keys its own rewrite rules by),
     * only used here as a fallback for the one real core provider with no
     * real subtype at all (`users`, whose own real `$object_type` is
     * `user`) - every other real entry already carries a real
     * `$object_subtype` this uses directly instead.
     *
     * Also fills in a real `lastmod` for the index's own listing, which
     * core itself never does - `WP_Sitemaps_Provider::get_sitemap_entries()`
     * only ever builds `['loc' => …]` for an index entry (confirmed by
     * reading that method directly), so the index page's own "Last
     * Modified" column is always empty under core's default behavior,
     * even though individual child sitemaps (post types) carry a real
     * per-URL `lastmod` of their own. For a post-type provider this uses
     * the same real core helper (`get_lastpostmodified()`) and the same
     * real `DATE_W3C`/GMT formatting core's own posts provider already
     * uses for its per-URL entries, so the value is genuine, not
     * fabricated. Taxonomies/users are left with no `lastmod` - core
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
        // real core provider with no real subtype (`users`) - every
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
     * Registers the real new pretty-URL rewrite rules - one pair
     * (page-1-implicit + page-N-suffixed) per real registered provider/
     * subtype combination - plus the real legacy-URL rules that 301
     * redirect old URLs forward. Hooked on `wp_sitemaps_init`, the real
     * core hook that fires once `wp_get_sitemap_providers()` is fully
     * populated (sitemaps.php's own docblock).
     *
     * @return void
     */
    public function register_pretty_rewrites(): void {
        // Real new index route.
        add_rewrite_rule( '^sitemap_index\.xml$', 'index.php?sitemap=index', 'top' );

        // Real legacy index route - same real pattern core's own
        // `WP_Sitemaps::register_rewrites()` already registers for
        // `wp-sitemap.xml`; added again here (after core's own, so it
        // wins) with the extra real `vulopilot_legacy_sitemap` flag this
        // class's own `redirect_legacy_url()` checks for below.
        add_rewrite_rule(
            '^wp-sitemap\.xml$',
            'index.php?sitemap=index&vulopilot_legacy_sitemap=1',
            'top'
        );

        // Real legacy provider routes - same 2 real patterns core's own
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

        // Real new pretty provider routes - one pair per real registered
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
     * Real one-time `flush_rewrite_rules()` - retrofitting new rewrite
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
     * pretty equivalent - hooked before core's own `render_sitemaps()`
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
