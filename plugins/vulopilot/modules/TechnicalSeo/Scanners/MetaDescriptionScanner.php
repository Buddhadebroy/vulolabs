<?php
/**
 * MetaDescriptionScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\TechnicalSeo\Scanners;

use VuloPilot\Utill\TracksScannedObjectsInterface;
use VuloPilot\Utill\Finding;
use VuloPilot\Utill\Severity;
use VuloPilot\Utill\ScannerUtil;
use VuloPilot\Utill\ScannedPostsTrait;

defined( 'ABSPATH' ) || exit;

/**
 * Flags published posts/pages with no excerpt set.
 *
 * @class       MetaDescriptionScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class MetaDescriptionScanner extends ScannerUtil implements TracksScannedObjectsInterface {

	use ScannedPostsTrait;

	private const BATCH_SIZE = 50;

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'meta-description';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Meta Descriptions', 'vulopilot' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_category(): string {
		return 'seo';
	}

	/**
	 * @inheritDoc
	 */
	public function scan(): array {
		$settings = wp_parse_args( get_option( \VuloPilot\Utill::VULOPILOT_SETTINGS_KEY, array() ), \VuloPilot\Utill::VULOPILOT_SETTINGS_DEFAULTS );

		// Flat, standalone key - Settings → Scanning → SEO & Content → "Titles & meta"
		// (SeoContent.ts).
		if ( empty( $settings['flag_missing_meta_description'] ) ) {
			return array();
		}

		$findings = array();
		$posts    = get_posts(
			array(
				'post_type'      => array( 'post', 'page' ),
				'post_status'    => 'publish',
				'posts_per_page' => self::BATCH_SIZE,
				'orderby'        => 'modified',
				'order'          => 'DESC',
			)
		);

		foreach ( $posts as $post ) {
			$this->mark_post_scanned( $post->ID );

			if ( '' !== trim( $post->post_excerpt ) ) {
				continue;
			}

			$findings[] = new Finding(
				sprintf(
					/* translators: %s is the post/page title. */
					__( 'No meta description set: %s', 'vulopilot' ),
					get_the_title( $post )
				),
				Severity::LOW,
				$this->get_category(),
				__( 'This post has no excerpt set. Most themes and SEO plugins fall back to the excerpt for the search-result description when no dedicated description is configured.', 'vulopilot' ),
				'post',
				(string) $post->ID,
				array( 'missing_description' => true )
			);
		}

		return $findings;
	}
}
