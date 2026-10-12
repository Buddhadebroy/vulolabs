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

		// Trust robots.txt's own declared sitemap ahead of guessing the two common conventions.
		$candidates = array_merge(
			$this->get_declared_sitemap_urls(),
			array( home_url( '/wp-sitemap.xml' ), home_url( '/sitemap.xml' ) )
		);

		foreach ( $candidates as $url ) {
			if ( $this->url_returns_ok( $url ) ) {
				return $findings;
			}
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
	 * Real `Sitemap:` directive URL(s) this site's own `/robots.txt` declares.
	 *
	 * @return string[]
	 */
	private function get_declared_sitemap_urls(): array {
		$response = wp_remote_get(
			home_url( '/robots.txt' ),
			array(
				'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
				'sslverify' => false,
			)
		);

		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			return array();
		}

		$lines = preg_split( '/\r\n|\r|\n/', (string) wp_remote_retrieve_body( $response ) );
		$urls  = array();

		foreach ( $lines ? $lines : array() as $line ) {
			$line = trim( $line );

			if ( 0 === stripos( $line, 'sitemap:' ) ) {
				$urls[] = trim( substr( $line, strlen( 'sitemap:' ) ) );
			}
		}

		return $urls;
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
