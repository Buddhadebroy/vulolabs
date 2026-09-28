<?php
namespace VuloPilot\Accessibility;

use VuloPilot\Utill\TracksScannedObjectsInterface;
use VuloPilot\Utill\Finding;
use VuloPilot\Utill\Severity;
use VuloPilot\Utill\ScannerUtil;
use VuloPilot\Utill\ScannedPostsTrait;

defined( 'ABSPATH' ) || exit;

/**
 * Flags published content that contains its own `h1` tag.
 *
 * @class       AccessibilityScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AccessibilityScanner extends ScannerUtil implements TracksScannedObjectsInterface {

	use ScannedPostsTrait;

	/**
	 * How many of the most recently published posts/pages to check per run.
	 */
	private const BATCH_SIZE = 50;

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'accessibility';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Accessibility', 'vulopilot' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_category(): string {
		return 'accessibility';
	}

	/**
	 * @inheritDoc
	 */
	public function scan(): array {
		$settings = wp_parse_args( get_option( \VuloPilot\Utill::VULOPILOT_SETTINGS_KEY, array() ), \VuloPilot\Utill::VULOPILOT_SETTINGS_DEFAULTS );

		if ( '2.1_a' === ( $settings['target_wcag_level'] ?? '2.1_aa' ) ) {
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

			if ( ! preg_match( '/<h1[\s>]/i', $post->post_content ) ) {
				continue;
			}

			$findings[] = new Finding(
				sprintf(
					/* translators: %s is the post/page title. */
					__( 'Content contains its own <h1>: %s', 'vulopilot' ),
					get_the_title( $post )
				),
				Severity::LOW,
				$this->get_category(),
				__( 'Most themes already render the title as the page\'s <h1>. A second <h1> in the content creates a conflicting heading hierarchy for screen readers.', 'vulopilot' ),
				'post',
				(string) $post->ID
			);
		}

		return $findings;
	}
}
