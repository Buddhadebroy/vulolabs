<?php
namespace VuloPilot\SeoVisibility;

defined( 'ABSPATH' ) || exit;

/**
 * The post-editor metabox's General tab noindex/nofollow toggles
 * (PostSeoMetaFields::META_KEYS).
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
