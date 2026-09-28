<?php
namespace VuloPilot\Performance;

use VuloPilot\Utill\ScannerUtil;

defined( 'ABSPATH' ) || exit;

/**
 * Shared homepage-asset helpers for CssOptimizationScanner and JavaScriptOptimizationScanner.
 *
 * @class       AbstractAssetOptimizationScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
abstract class AbstractAssetOptimizationScanner extends ScannerUtil {

	/**
	 * Main plugin files of well-known minification-capable plugins.
	 */
	private const KNOWN_MINIFIER_PLUGINS = array(
		'autoptimize/autoptimize.php',
		'wp-rocket/wp-rocket.php',
		'w3-total-cache/w3-total-cache.php',
		'wp-fastest-cache/wpFastestCache.php',
		'litespeed-cache/litespeed-cache.php',
	);

	private const REQUEST_TIMEOUT_SECONDS = 8;

	/**
	 * @return bool
	 */
	protected function has_known_minifier_plugin(): bool {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		foreach ( self::KNOWN_MINIFIER_PLUGINS as $plugin_file ) {
			if ( is_plugin_active( $plugin_file ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * @return string|null The homepage's raw HTML, or null if the request failed.
	 */
	protected function fetch_homepage_html(): ?string {
		$response = wp_remote_get(
			home_url( '/' ),
			array(
				'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
				'sslverify' => false,
			)
		);

		if ( is_wp_error( $response ) ) {
			return null;
		}

		$body = wp_remote_retrieve_body( $response );

		return '' !== $body ? $body : null;
	}

	/**
	 * Extracts same-host asset URLs from one kind of tag (read with WP_HTML_Tag_Processor)
	 * that don't already look minified (no `.min.` in the path).
	 *
	 * @param string      $html      Homepage HTML.
	 * @param string      $tag       Tag name to read.
	 * @param string      $attribute Attribute holding the asset URL.
	 * @param string|null $rel       When set, only tags whose `rel` attribute equals this value.
	 * @return string[] Un-minified same-host asset URLs.
	 */
	protected function find_unminified_same_host_assets( string $html, string $tag, string $attribute, ?string $rel = null ): array {
		$processor = new \WP_HTML_Tag_Processor( $html );
		$site_host = wp_parse_url( home_url( '/' ), PHP_URL_HOST );
		$found     = array();

		while ( $processor->next_tag( $tag ) ) {
			if ( null !== $rel && strtolower( (string) $processor->get_attribute( 'rel' ) ) !== $rel ) {
				continue;
			}

			$url = $processor->get_attribute( $attribute );

			if ( ! is_string( $url ) || '' === $url ) {
				continue;
			}

			$url_host = wp_parse_url( $url, PHP_URL_HOST );

			// Relative URLs (no host) belong to this site.
			if ( null !== $url_host && $url_host !== $site_host ) {
				continue;
			}

			if ( false !== strpos( $url, '.min.' ) ) {
				continue;
			}

			$found[] = $url;
		}

		return array_unique( $found );
	}
}
