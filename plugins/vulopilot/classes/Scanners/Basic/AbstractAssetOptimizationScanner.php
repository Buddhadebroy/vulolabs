<?php
/**
 * AbstractAssetOptimizationScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

defined( 'ABSPATH' ) || exit;

/**
 * Shared homepage-asset-inspection helpers for CssOptimizationScanner and
 * JavaScriptOptimizationScanner — both need the exact same "fetch the
 * homepage, find same-host `<link>`/`<script>` tags, check for a known
 * minification plugin" logic, differing only in which HTML tag/attribute
 * they look for and their own finding copy. Factored out here rather than
 * duplicated twice (unlike this folder's other scanners, which are small
 * enough to stay independent) since the two bodies would otherwise be
 * near-verbatim copies of each other.
 *
 * @class       AbstractAssetOptimizationScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
abstract class AbstractAssetOptimizationScanner extends AbstractBasicScanner {

    /**
     * Main plugin files of well-known minification-capable plugins. Several
     * overlap with CacheDetectionScanner's own caching-plugin list — those
     * plugins bundle minification alongside caching.
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
     * Extracts same-host asset URLs matching a regex (one capture group for
     * the URL) that don't already look minified (no `.min.` in the path) —
     * a cheap filename heuristic rather than fetching every asset's own
     * bytes to check.
     *
     * @param string $html  Homepage HTML.
     * @param string $regex Must contain exactly one capture group for the URL.
     * @return string[] Un-minified same-host asset URLs.
     */
    protected function find_unminified_same_host_assets( string $html, string $regex ): array {
        if ( 0 === preg_match_all( $regex, $html, $matches ) ) {
            return array();
        }

        $site_host = wp_parse_url( home_url( '/' ), PHP_URL_HOST );
        $found     = array();

        foreach ( $matches[1] as $url ) {
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
