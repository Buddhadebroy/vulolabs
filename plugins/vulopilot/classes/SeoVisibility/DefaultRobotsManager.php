<?php
namespace VuloPilot\SeoVisibility;

use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Settings → Scanning → SEO → Robots' sitewide robots-meta conditions.
 *
 * @class       DefaultRobotsManager class
 * @version     1.0.0
 * @author      VuloLabs
 */
class DefaultRobotsManager {

	/** DefaultRobotsManager constructor. */
	public function __construct() {
		// After PostRobotsMetaManager's priority.
		add_filter( 'wp_robots', array( $this, 'maybe_filter_robots' ) );
	}

	/**
	 * @param array $robots Core's own robots directives array.
	 * @return array
	 */
	public function maybe_filter_robots( array $robots ): array {
		$settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

		if ( ! empty( $settings['robots_noindex_sitewide'] ) ) {
			$robots['noindex'] = true;

			return $robots; // Already the broadest condition - no need to check the narrower ones below.
		}

		if ( ! empty( $settings['robots_noindex_search'] ) && is_search() ) {
			$robots['noindex'] = true;
		}

		if ( ! empty( $settings['robots_noindex_empty_taxonomies'] ) && $this->is_empty_taxonomy_archive() ) {
			$robots['noindex'] = true;
		}

		if ( ! empty( $settings['robots_noindex_archive_subpages'] ) && is_archive() && is_paged() ) {
			$robots['noindex'] = true;
		}

		if ( ! empty( $settings['robots_noindex_paginated_pages'] ) && is_paged() ) {
			$robots['noindex'] = true;
		}

		if ( ! empty( $settings['robots_noindex_password_protected'] ) && is_singular() && post_password_required() ) {
			$robots['noindex'] = true;
		}

		if ( ! empty( $settings['robots_noindex_author'] ) && is_author() ) {
			$robots['noindex'] = true;
		}

		if ( ! empty( $settings['robots_noindex_author_without_posts'] ) && $this->is_authorless_archive() ) {
			$robots['noindex'] = true;
		}

		return $robots;
	}

	/**
	 * @return bool True on an author archive for a user with zero published posts.
	 */
	private function is_authorless_archive(): bool {
		if ( ! is_author() ) {
			return false;
		}

		$author = get_queried_object();

		return $author instanceof \WP_User && 0 === (int) count_user_posts( $author->ID, 'post', true );
	}

	/**
	 * @return bool True on a category/tag/custom-taxonomy term archive that currently has zero published posts.
	 */
	private function is_empty_taxonomy_archive(): bool {
		if ( ! is_category() && ! is_tag() && ! is_tax() ) {
			return false;
		}

		$term = get_queried_object();

		return $term instanceof \WP_Term && 0 === (int) $term->count;
	}
}
