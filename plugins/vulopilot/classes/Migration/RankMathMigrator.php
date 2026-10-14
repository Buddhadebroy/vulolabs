<?php
/**
 * RankMathMigrator class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Migration;

defined( 'ABSPATH' ) || exit;

/**
 * Imports Rank Math's per-post postmeta (`rank_math_*`) into VuloPilot's own SEO postmeta.
 *
 * @class       RankMathMigrator
 * @version     1.0.0
 * @author      VuloLabs
 */
class RankMathMigrator extends AbstractPostMetaSeoMigrator {

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'rank-math';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Rank Math SEO', 'vulopilot' );
	}

	/**
	 * @inheritDoc
	 */
	protected function source_meta_keys(): array {
		return array(
			'focus_keyword'      => 'rank_math_focus_keyword',
			'canonical_url'      => 'rank_math_canonical_url',
			// Both robots fields read the same serialized `rank_math_robots` array -
			// `normalize_value()` below picks the right flag out of it either way.
			'robots_noindex'     => 'rank_math_robots',
			'robots_nofollow'    => 'rank_math_robots',
			'social_title'       => 'rank_math_facebook_title',
			'social_description' => 'rank_math_facebook_description',
			'social_image_id'    => 'rank_math_facebook_image_id',
		);
	}

	/**
	 * @inheritDoc
	 */
	protected function normalize_value( string $field, $raw_value, int $post_id ) {
		if ( 'robots_noindex' === $field || 'robots_nofollow' === $field ) {
			$robots = maybe_unserialize( $raw_value );
			$flag   = 'robots_noindex' === $field ? 'noindex' : 'nofollow';

			return is_array( $robots ) && in_array( $flag, $robots, true );
		}

		// Rank Math stores the focus keyword(s) comma-separated already, same contract
		// `PostSeoMetaFields::split_keywords()` expects.
		return $raw_value;
	}
}
