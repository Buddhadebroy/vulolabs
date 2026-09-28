<?php
/**
 * SitemapScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\TechnicalSeo\Scanners;

use VuloPilot\Utill\Finding;
use VuloPilot\Utill\Severity;
use VuloPilot\Utill\ScannerUtil;

defined( 'ABSPATH' ) || exit;

/**
 * Flags a site with no reachable XML sitemap.
 *
 * @class       SitemapScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SitemapScanner extends ScannerUtil {

	private const REQUEST_TIMEOUT_SECONDS = 8;

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'sitemap';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Sitemap', 'vulopilot' );
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

		if ( $this->url_returns_ok( home_url( '/wp-sitemap.xml' ) ) || $this->url_returns_ok( home_url( '/sitemap.xml' ) ) ) {
			return $findings;
		}

		$findings[] = new Finding(
			__( 'No XML sitemap found', 'vulopilot' ),
			Severity::MEDIUM,
			$this->get_category(),
			__( 'Neither /wp-sitemap.xml nor /sitemap.xml returned a successful response. A sitemap helps search engines discover and crawl every page on the site.', 'vulopilot' ),
			'url',
			home_url( '/' )
		);

		return $findings;
	}

	/**
	 * @param string $url URL to check.
	 * @return bool
	 */
	private function url_returns_ok( string $url ): bool {
		$response = wp_remote_get(
			$url,
			array(
				'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
				'sslverify' => false,
			)
		);

		return ! is_wp_error( $response ) && 200 === wp_remote_retrieve_response_code( $response );
	}
}
