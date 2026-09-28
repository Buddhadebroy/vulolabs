<?php
namespace VuloPilot\SeoVisibility;

use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Settings-driven filters over WordPress core's native sitemap at /wp-sitemap.xml (enable,
 * links per page, post types, taxonomies, exclusions).
 *
 * @class       SitemapManager class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SitemapManager {

	/**
	 * SitemapManager constructor.
	 */
	public function __construct() {
		add_filter( 'wp_sitemaps_enabled', array( $this, 'filter_sitemaps_enabled' ) );

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
	 * Narrows core's own registered sitemap post types down to `sitemap_xml_post_types`.
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
			$args['post__not_in'] = array_merge( $args['post__not_in'] ?? array(), $excluded ); // phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.PostNotIn_post__not_in -- admin-configured `sitemap_exclude_posts` list, a small bounded set of explicit ids, not an unbounded/user-controlled exclusion.
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
			$args['exclude'] = array_merge( $args['exclude'] ?? array(), $excluded ); // phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.PostNotIn_exclude -- admin-configured `sitemap_exclude_terms` list, a small bounded set of explicit ids, not an unbounded/user-controlled exclusion.
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
}
