<?php
/**
 * HtmlSitemapRenderer class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Scanning → Sitemap tab's "HTML Sitemap" card — a real, human-readable
 * `[vulopilot_html_sitemap]` shortcode (the mockup's own "Shortcode" settings
 * row), independent of the XML sitemap SitemapManager.php wraps WordPress
 * core's own native sitemap with. Queries live post/term data at render
 * time (same "generate on request, don't cache a stale copy" posture
 * GeoAnalysis\LlmsTxtGenerator's own docblock documents for the same
 * reason), gated by `sitemap_html_post_types`/`sitemap_html_taxonomies`
 * (distinct from the XML sitemap's own `sitemap_xml_post_types`/
 * `sitemap_xml_taxonomies` — a type can be in one, both, or neither) and
 * `sitemap_exclude_posts`/`sitemap_exclude_terms` (shared with the XML
 * sitemap, since an explicitly excluded post/term shouldn't reappear here
 * either).
 *
 * Self-registers its own hook in the constructor (php-wordpress.md) and is
 * constructed unconditionally in VuloPilot::init_classes() — the
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
     * entries — this codebase registers no custom post types of its own
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
        $included_types = (array) ( $settings['sitemap_html_post_types'] ?? array() );
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
        $included_taxonomies = (array) ( $settings['sitemap_html_taxonomies'] ?? array() );
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
