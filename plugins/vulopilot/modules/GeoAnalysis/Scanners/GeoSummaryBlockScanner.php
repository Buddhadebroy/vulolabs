<?php
/**
 * GeoSummaryBlockScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\GeoAnalysis\Scanners;

use VuloPilot\Utill\TracksScannedObjectsInterface;
use VuloPilot\Utill\Finding;
use VuloPilot\Utill\Severity;
use VuloPilot\Utill\ScannerUtil;
use VuloPilot\Utill\ScannedPostsTrait;

defined( 'ABSPATH' ) || exit;

/**
 * Flags long-form published posts/pages with no upfront summary.
 *
 * @class       GeoSummaryBlockScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class GeoSummaryBlockScanner extends ScannerUtil implements TracksScannedObjectsInterface {

	use ScannedPostsTrait;

	private const BATCH_SIZE              = 50;
	private const MIN_WORD_COUNT_TO_CHECK = 300;

	/**
	 * Rough average word length, used to convert the minimum word count into the character
	 * window that is scanned.
	 */
	private const CHARS_PER_WORD = 6;

	private const SUMMARY_MARKERS = array( 'tl;dr', 'tldr', 'key takeaways', 'in summary', 'quick summary', 'summary:' );

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'geo-summary-block';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Summary Blocks', 'vulopilot' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_category(): string {
		return 'geo';
	}

	/**
	 * @inheritDoc
	 */
	public function scan(): array {
		$settings = wp_parse_args( get_option( \VuloPilot\Utill::VULOPILOT_SETTINGS_KEY, array() ), \VuloPilot\Utill::VULOPILOT_SETTINGS_DEFAULTS );

		// GEO has no whole-category kill switch (unlike SEO/Accessibility/ Commerce).
		if ( empty( $settings['ai_visibility_scans']['answer_first']['enable'] ) ) {
			return array();
		}

		$window_chars = absint( $settings['ai_visibility_scans']['answer_first']['min_words'] ?? 200 ) * self::CHARS_PER_WORD;

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

			$word_count = str_word_count( wp_strip_all_tags( $post->post_content ) );

			if ( $word_count < self::MIN_WORD_COUNT_TO_CHECK || $this->has_early_summary( $post->post_content, $window_chars ) ) {
				continue;
			}

			$findings[] = new Finding(
				sprintf(
					/* translators: %s is the post/page title. */
					__( 'No upfront summary found: %s', 'vulopilot' ),
					get_the_title( $post )
				),
				Severity::LOW,
				$this->get_category(),
				__( 'AI answer engines favor content with a short summary or key-takeaways list near the top, rather than requiring the full article to be read first.', 'vulopilot' ),
				'post',
				(string) $post->ID,
				array(
					'word_count'            => $word_count,
					'missing_summary_block' => true,
				)
			);
		}

		return $findings;
	}

	/**
	 * @param string $content      Post content (raw HTML).
	 * @param int    $window_chars How many characters from the top count as "early".
	 * @return bool
	 */
	private function has_early_summary( string $content, int $window_chars ): bool {
		$window = mb_substr( $content, 0, $window_chars );

		if ( preg_match( '/<(ul|ol)[\s>]/i', $window ) ) {
			return true;
		}

		$plain_window = mb_strtolower( wp_strip_all_tags( $window ) );

		foreach ( self::SUMMARY_MARKERS as $marker ) {
			if ( false !== strpos( $plain_window, $marker ) ) {
				return true;
			}
		}

		return false;
	}
}
