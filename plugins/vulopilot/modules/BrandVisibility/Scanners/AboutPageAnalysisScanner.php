<?php
/**
 * AboutPageAnalysisScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\BrandVisibility\Scanners;

use VuloPilot\Utill\Finding;
use VuloPilot\Utill\Severity;
use VuloPilot\Utill\ScannerUtil;

defined( 'ABSPATH' ) || exit;

/**
 * For sites that have an About page, checks it has enough words and a contact signal (an
 * email address or a link to a Contact page).
 *
 * @class       AboutPageAnalysisScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AboutPageAnalysisScanner extends ScannerUtil {

	/**
	 * Same common About-page slugs GeoTrustSignalsScanner's own
	 * ABOUT_SLUGS checks.
	 */
	private const ABOUT_SLUGS = array( 'about', 'about-us', 'about-me' );

	/**
	 * Fallback only - the real threshold is Scanning → Brand
	 * Intelligence's `brand_about_page_min_words` setting.
	 */
	private const DEFAULT_MIN_WORDS = 80;

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'about-page-analysis';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'About Page Analysis', 'vulopilot' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_category(): string {
		return 'brand';
	}

	/**
	 * @inheritDoc
	 */
	public function scan(): array {
		$page = $this->find_about_page();

		// No About-shaped page at all is GeoTrustSignalsScanner's own gap to flag.
		if ( ! $page ) {
			return array();
		}

		$settings  = wp_parse_args( get_option( \VuloPilot\Utill::VULOPILOT_SETTINGS_KEY, array() ), \VuloPilot\Utill::VULOPILOT_SETTINGS_DEFAULTS );
		$min_words = is_numeric( $settings['brand_about_page_min_words'] ?? null )
			? (int) $settings['brand_about_page_min_words']
			: self::DEFAULT_MIN_WORDS;

		$plain_text  = wp_strip_all_tags( $page->post_content );
		$word_count  = str_word_count( $plain_text );
		$has_contact = $this->has_contact_signal( $plain_text );

		if ( $word_count >= $min_words && $has_contact ) {
			return array();
		}

		$missing = array();
		if ( $word_count < $min_words ) {
			$missing[] = __( 'enough real content', 'vulopilot' );
		}
		if ( ! $has_contact ) {
			$missing[] = __( 'a visible contact signal', 'vulopilot' );
		}

		return array(
			new Finding(
				sprintf(
					/* translators: %s is a comma-separated list of what the About page is missing. */
					__( 'About page is missing %s', 'vulopilot' ),
					implode( ' and ', $missing )
				),
				Severity::MEDIUM,
				$this->get_category(),
				__( 'This site has an About page, but it doesn\'t yet give AI answer engines or readers enough real substance (word count, contact details) to establish it as a genuine trust signal.', 'vulopilot' ),
				'post',
				(string) $page->ID,
				array(
					'word_count'  => $word_count,
					'has_contact' => $has_contact,
				)
			),
		);
	}

	/**
	 * @return \WP_Post|null The first published page matching one of ABOUT_SLUGS, if any.
	 */
	private function find_about_page(): ?\WP_Post {
		foreach ( self::ABOUT_SLUGS as $slug ) {
			$page = get_page_by_path( $slug, OBJECT, 'page' );

			if ( $page && 'publish' === $page->post_status ) {
				return $page;
			}
		}

		return null;
	}

	/**
	 * A real, bounded check: an email address, or the digits of a phone-shaped number.
	 *
	 * @param string $plain_text Already-stripped-of-HTML page content.
	 * @return bool
	 */
	private function has_contact_signal( string $plain_text ): bool {
		if ( preg_match( '/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i', $plain_text ) ) {
			return true;
		}

		return 1 === preg_match( '/(\+?\d[\d\s().-]{6,}\d)/', $plain_text );
	}
}
