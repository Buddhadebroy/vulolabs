<?php
/**
 * YoastSeoMigrator class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Migration;

defined( 'ABSPATH' ) || exit;

/**
 * Imports Yoast SEO's per-post postmeta (`_yoast_wpseo_*`) into VuloPilot's own SEO postmeta.
 *
 * @class       YoastSeoMigrator
 * @version     1.0.0
 * @author      VuloLabs
 */
class YoastSeoMigrator extends AbstractPostMetaSeoMigrator {

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'yoast-seo';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Yoast SEO', 'vulopilot' );
	}

	/**
	 * @inheritDoc
	 */
	protected function source_meta_keys(): array {
		return array(
			'focus_keyword'      => '_yoast_wpseo_focuskw',
			'canonical_url'      => '_yoast_wpseo_canonical',
			'robots_noindex'     => '_yoast_wpseo_meta-robots-noindex',
			'robots_nofollow'    => '_yoast_wpseo_meta-robots-nofollow',
			'social_title'       => '_yoast_wpseo_opengraph-title',
			'social_description' => '_yoast_wpseo_opengraph-description',
			'social_image_id'    => '_yoast_wpseo_opengraph-image-id',
		);
	}

	/**
	 * @inheritDoc
	 */
	protected function normalize_value( string $field, $raw_value, int $post_id ) {
		// Yoast stores these as the string '1' for "on", '0'/absent for "off".
		if ( in_array( $field, array( 'robots_noindex', 'robots_nofollow' ), true ) ) {
			return '1' === (string) $raw_value;
		}

		return $raw_value;
	}
}
