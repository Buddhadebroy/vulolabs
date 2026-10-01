<?php
/**
 * CanonicalUrlScanner class file.
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
 * Flags pages whose rendered HTML has no `link` tag.
 *
 * @class       CanonicalUrlScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CanonicalUrlScanner extends ScannerUtil implements TracksScannedObjectsInterface {

	use ScannedPostsTrait;

	private const POSTS_BATCH_SIZE        = 9;
	private const REQUEST_TIMEOUT_SECONDS = 8;

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'canonical-url';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Canonical URLs', 'vulopilot' );
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
		$findings = array();

		foreach ( $this->get_urls_to_check() as $url ) {
			$body = $this->fetch_body( $url );

			if ( null === $body || false !== stripos( $body, 'rel="canonical"' ) || false !== stripos( $body, "rel='canonical'" ) ) {
				continue;
			}

			$findings[] = new Finding(
				sprintf(
					/* translators: %s is the URL missing a canonical tag. */
					__( 'No canonical URL tag found: %s', 'vulopilot' ),
					$url
				),
				Severity::LOW,
				$this->get_category(),
				__( 'A missing canonical tag can lead search engines to treat identical content reachable at multiple URLs as duplicates.', 'vulopilot' ),
				'url',
				$url
			);
		}

		return $findings;
	}

	/**
	 * @return string[] Homepage plus the most recently published posts/pages, capped.
	 */
	private function get_urls_to_check(): array {
		$urls  = array( home_url( '/' ) );
		$posts = get_posts(
			array(
				'post_type'      => array( 'post', 'page' ),
				'post_status'    => 'publish',
				'posts_per_page' => self::POSTS_BATCH_SIZE,
				'orderby'        => 'modified',
				'order'          => 'DESC',
				'fields'         => 'ids',
			)
		);

		foreach ( $posts as $post_id ) {
			$this->mark_post_scanned( $post_id );

			$urls[] = get_permalink( $post_id );
		}

		return $urls;
	}

	/**
	 * @param string $url URL to fetch.
	 * @return string|null Response body, or null if the request failed.
	 */
	private function fetch_body( string $url ): ?string {
		$response = wp_remote_get(
			$url,
			array(
				'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
				'sslverify' => false,
			)
		);

		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			return null;
		}

		return wp_remote_retrieve_body( $response );
	}
}
