<?php
namespace VuloPilot\SeoVisibility;

use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Scanning → SEO's "Add canonical URL tags" toggle - the mechanical fix behind
 * CanonicalUrlScanner's finding.
 *
 * @class       CanonicalUrlManager class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CanonicalUrlManager {

	/**
	 * CanonicalUrlManager constructor.
	 */
	public function __construct() {
		add_action( 'wp_head', array( $this, 'maybe_output_canonical' ), 5 );

		// The post-editor metabox's General tab canonical override.
		add_filter( 'get_canonical_url', array( $this, 'maybe_override_canonical' ), 10, 2 );
	}

	/**
	 * Substitutes the post-editor metabox's per-post canonical override, if one is set.
	 *
	 * @param string   $canonical_url Core's own resolved canonical URL.
	 * @param \WP_Post $post          The post being resolved.
	 * @return string
	 */
	public function maybe_override_canonical( string $canonical_url, \WP_Post $post ): string {
		$override = get_post_meta( $post->ID, PostSeoMetaFields::META_KEYS['canonical_url'], true );

		return $override ? $override : $canonical_url;
	}

	/**
	 * Outputs the safety-net canonical tag on wp_head, if the setting is enabled.
	 *
	 * @return void
	 */
	public function maybe_output_canonical(): void {
		$settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

		if ( empty( $settings['canonical_url_enabled'] ) ) {
			return;
		}

		$url = $this->get_canonical_url();

		if ( ! $url ) {
			return;
		}

		echo '<link rel="canonical" href="' . esc_url( $url ) . '" />' . "\n";
	}

	/**
	 * Resolves the canonical URL for the current singular/front-page request.
	 *
	 * @return string|null
	 */
	private function get_canonical_url(): ?string {
		if ( is_singular() ) {
			$permalink = get_permalink( get_queried_object_id() );
			return $permalink ? $permalink : null;
		}

		if ( is_front_page() || is_home() ) {
			return home_url( '/' );
		}

		return null; // Archives/search/404 - core's own rel_canonical() already skips these too.
	}
}
