<?php
/**
 * Every class in this file used to be its own file under classes/Scanners/Basic/
 * (same names, docblocks, and behavior) - merged into one file to reduce
 * classes/'s file count, per direct instruction. Autoloading does not rely on
 * each class's own file matching its own name for this: composer.json's
 * autoload.classmap entry (alongside the existing psr-4 one) makes Composer
 * tokenize every file under classes/ and modules/ and map each class it finds
 * to its real file, however many classes share one file - run
 * `composer dump-autoload` (no `-o`/`--optimize-autoloader` needed) after any
 * further file merge/split here.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * Shared homepage-asset-inspection helpers for CssOptimizationScanner and
 * JavaScriptOptimizationScanner - both need the exact same "fetch the
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
     * overlap with CacheDetectionScanner's own caching-plugin list - those
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
     * the URL) that don't already look minified (no `.min.` in the path) -
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

/**
 * Flags a site with no detectable caching layer - checks a short list of
 * well-known caching plugins (the same is_plugin_active() approach
 * PluginsScanner/ThemesScanner already use for plugin detection), and
 * falls back to inspecting the homepage's own response headers for a
 * server-level caching signal (Cache-Control/ETag) before concluding
 * nothing is caching the site.
 *
 * @class       CacheDetectionScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CacheDetectionScanner extends AbstractBasicScanner {

    /**
     * Main plugin files of well-known caching plugins.
     */
    private const KNOWN_CACHING_PLUGINS = array(
        'wp-rocket/wp-rocket.php',
        'w3-total-cache/w3-total-cache.php',
        'wp-super-cache/wp-cache.php',
        'litespeed-cache/litespeed-cache.php',
        'cache-enabler/cache-enabler.php',
        'wp-fastest-cache/wpFastestCache.php',
    );

    private const REQUEST_TIMEOUT_SECONDS = 8;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'cache-detection';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Cache Issues', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'performance';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        if ( $this->has_known_caching_plugin() || $this->homepage_sends_caching_headers() ) {
            return array();
        }

        return array(
            new Finding(
                __( 'No caching detected', 'vulopilot' ),
                Severity::LOW,
                $this->get_category(),
                __( 'No known caching plugin is active and the homepage response has no caching headers. A caching layer significantly reduces load time and server load.', 'vulopilot' ),
                'url',
                home_url( '/' ),
                array(
                    'recommended_fix' => array(
                        __( 'Install and activate a caching plugin (e.g. WP Super Cache, W3 Total Cache, WP Rocket).', 'vulopilot' ),
                        __( 'If your host provides server-level caching, enable it in your hosting dashboard.', 'vulopilot' ),
                        __( 'Confirm caching is active by checking response headers for Cache-Control/ETag.', 'vulopilot' ),
                        __( 'Set a reasonable cache expiry so returning visitors get fast repeat page loads.', 'vulopilot' ),
                    ),
                )
            ),
        );
    }

    /**
     * @return bool
     */
    private function has_known_caching_plugin(): bool {
        if ( ! function_exists( 'is_plugin_active' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        foreach ( self::KNOWN_CACHING_PLUGINS as $plugin_file ) {
            if ( is_plugin_active( $plugin_file ) ) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return bool
     */
    private function homepage_sends_caching_headers(): bool {
        $response = wp_remote_get(
            home_url( '/' ),
            array(
                'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
                'sslverify' => false,
            )
        );

        if ( is_wp_error( $response ) ) {
            // Can't tell either way - don't flag on an inconclusive request.
            return true;
        }

        $cache_control = wp_remote_retrieve_header( $response, 'cache-control' );
        $etag          = wp_remote_retrieve_header( $response, 'etag' );

        return ! empty( $cache_control ) || ! empty( $etag );
    }
}

/**
 * Flags a site with no detectable CDN/asset-offloading - checks whether
 * any same-page asset (`<link href>`/`<script src>`/`<img src>`) resolves
 * to a host other than the site's own (a real signal that assets are
 * already being served from a CDN or offload service), and falls back to
 * a known-plugin check (same is_plugin_active() shape
 * CacheDetectionScanner uses) before concluding nothing is offloading
 * assets.
 *
 * @class       CdnScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CdnScanner extends AbstractBasicScanner {

    private const REQUEST_TIMEOUT_SECONDS = 8;

    /**
     * Main plugin files of well-known CDN/asset-offload plugins.
     */
    private const KNOWN_CDN_PLUGINS = array(
        'cloudflare/cloudflare.php',
        'wp-cloudflare-page-cache/wp-cloudflare-super-page-cache.php',
        'ewww-image-optimizer/ewww-image-optimizer.php',
        'bunnycdn/bunnycdn.php',
    );

    private const ASSET_SRC_PATTERN = '/(?:href|src)=["\']((?:https?:)?\/\/[^"\']+\.(?:css|js|png|jpe?g|gif|webp|svg|woff2?))["\']/i';

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'cdn';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'CDN', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'performance';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        if ( $this->assets_served_from_other_host() || $this->has_known_cdn_plugin() ) {
            return array();
        }

        return array(
            new Finding(
                __( 'No CDN detected for static assets', 'vulopilot' ),
                Severity::LOW,
                $this->get_category(),
                __( 'Every asset on the homepage is served directly from this server. A CDN serves images, CSS, and JavaScript from servers closer to each visitor, reducing load times worldwide.', 'vulopilot' ),
                'url',
                home_url( '/' ),
                array(
                    'recommended_fix' => array(
                        __( 'Sign up for a CDN (e.g. Cloudflare, BunnyCDN, StackPath) and point your DNS or media library through it.', 'vulopilot' ),
                        __( 'Alternatively, use a WordPress plugin that integrates a CDN with your media library automatically.', 'vulopilot' ),
                        __( 'Confirm static assets (images, CSS, JS) now resolve to a different host than your own site.', 'vulopilot' ),
                        __( 'Re-run this scan to confirm at least one asset is now served through the CDN.', 'vulopilot' ),
                    ),
                )
            ),
        );
    }

    /**
     * @return bool
     */
    private function assets_served_from_other_host(): bool {
        $response = wp_remote_get(
            home_url( '/' ),
            array(
                'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
                'sslverify' => false,
            )
        );

        if ( is_wp_error( $response ) ) {
            // Can't tell either way - don't flag on an inconclusive request.
            return true;
        }

        $html = wp_remote_retrieve_body( $response );

        if ( 0 === preg_match_all( self::ASSET_SRC_PATTERN, $html, $matches ) ) {
            return false;
        }

        $site_host = wp_parse_url( home_url( '/' ), PHP_URL_HOST );

        foreach ( $matches[1] as $url ) {
            $url_host = wp_parse_url( $url, PHP_URL_HOST );

            if ( null !== $url_host && $url_host !== $site_host ) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return bool
     */
    private function has_known_cdn_plugin(): bool {
        if ( ! function_exists( 'is_plugin_active' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        foreach ( self::KNOWN_CDN_PLUGINS as $plugin_file ) {
            if ( is_plugin_active( $plugin_file ) ) {
                return true;
            }
        }

        return false;
    }
}

/**
 * Flags un-minified same-host CSS on the homepage when no known
 * minification-capable plugin is active - see
 * AbstractAssetOptimizationScanner for the shared fetch/detection logic
 * this and JavaScriptOptimizationScanner both build on.
 *
 * @class       CssOptimizationScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CssOptimizationScanner extends AbstractAssetOptimizationScanner {

    private const STYLESHEET_PATTERN = '/<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"\']+)["\']/i';

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'css-optimization';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'CSS Optimization', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'performance';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        if ( $this->has_known_minifier_plugin() ) {
            return array();
        }

        $html = $this->fetch_homepage_html();

        if ( null === $html ) {
            return array();
        }

        $unminified = $this->find_unminified_same_host_assets( $html, self::STYLESHEET_PATTERN );

        if ( empty( $unminified ) ) {
            return array();
        }

        return array(
            new Finding(
                sprintf(
                    /* translators: %d is the number of un-minified stylesheets found. */
                    _n(
                        '%d un-minified stylesheet found',
                        '%d un-minified stylesheets found',
                        count( $unminified ),
                        'vulopilot'
                    ),
                    count( $unminified )
                ),
                Severity::LOW,
                $this->get_category(),
                __( 'These stylesheets aren\'t minified and no minification plugin is active. Minifying CSS reduces file size and speeds up page rendering.', 'vulopilot' ),
                'url',
                home_url( '/' ),
                array(
                    'stylesheets'     => $unminified,
                    'recommended_fix' => array(
                        __( 'Enable CSS minification in your caching/optimization plugin, or use a dedicated asset-optimization plugin.', 'vulopilot' ),
                        __( 'Combine multiple small stylesheets into fewer files where possible to reduce requests.', 'vulopilot' ),
                        __( 'Remove unused CSS rules from themes/plugins you don\'t need.', 'vulopilot' ),
                        __( 'Re-run this scan after minifying to confirm these stylesheets are no longer flagged.', 'vulopilot' ),
                    ),
                ),
                'unminified-styles'
            ),
        );
    }
}

/**
 * Flags externally-hosted Google Fonts on the homepage - same
 * `wp_remote_get(home_url())` homepage-inspection approach
 * CacheDetectionScanner already uses, just checking for
 * fonts.googleapis.com/fonts.gstatic.com references instead of caching
 * headers. Self-hosting web fonts (or at minimum using `font-display:
 * swap`) avoids the extra DNS/connection round trip to a third-party host
 * and the render-blocking behavior default Google Fonts embeds have.
 *
 * @class       FontsScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class FontsScanner extends AbstractBasicScanner {

    private const REQUEST_TIMEOUT_SECONDS = 8;

    private const GOOGLE_FONTS_HOSTS = array( 'fonts.googleapis.com', 'fonts.gstatic.com' );

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'fonts';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Fonts', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'performance';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $response = wp_remote_get(
            home_url( '/' ),
            array(
                'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
                'sslverify' => false,
            )
        );

        if ( is_wp_error( $response ) ) {
            return array();
        }

        $html = wp_remote_retrieve_body( $response );

        foreach ( self::GOOGLE_FONTS_HOSTS as $host ) {
            if ( false !== strpos( $html, $host ) ) {
                return array(
                    new Finding(
                        __( 'Externally-hosted web fonts detected', 'vulopilot' ),
                        Severity::LOW,
                        $this->get_category(),
                        __( 'The homepage loads fonts from Google Fonts\' own servers. Self-hosting web fonts (or adding font-display: swap) avoids an extra third-party connection and can prevent invisible-text flashes while fonts load.', 'vulopilot' ),
                        'url',
                        home_url( '/' ),
                        array(
                            'recommended_fix' => array(
                                __( 'Host Google Fonts locally instead of loading them from fonts.googleapis.com/fonts.gstatic.com.', 'vulopilot' ),
                                __( 'Use a plugin (e.g. OMGF) to automatically download and self-host your fonts.', 'vulopilot' ),
                                __( 'Limit the number of font weights/styles you load to only what\'s actually used.', 'vulopilot' ),
                                __( 'Add font-display: swap so text stays visible while fonts load.', 'vulopilot' ),
                            ),
                        )
                    ),
                );
            }
        }

        return array();
    }
}

/**
 * Flags unused image attachments the same way real media-cleaner plugins
 * define "orphaned": unattached (`post_parent = 0`), not set as anyone's
 * featured image, not the site icon or custom logo, and uploaded more than
 * MIN_AGE_DAYS ago (a safety gate so an image mid-upload for a post that
 * hasn't been saved yet, or one intentionally kept unattached, doesn't get
 * flagged the same day it lands in the library). Distinct from
 * LargeImagesScanner (category 'performance' too, but flags oversized
 * *in-use* images, not unused ones). Same "combined count above a
 * threshold" shape DatabaseCleanupScanner uses, and its own counting logic
 * is what PerformanceActions' `image-cleanup` quick action actually deletes.
 *
 * @class       ImageCleanupScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ImageCleanupScanner extends AbstractBasicScanner {

    /**
     * How old an unattached image must be before it's flagged - avoids
     * catching images uploaded moments ago for a post that isn't saved yet.
     */
    const MIN_AGE_DAYS = 30;

    /**
     * Orphaned-image count above which this is worth flagging.
     */
    private const THRESHOLD = 5;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'image-cleanup';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Image Cleanup', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'performance';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $orphaned_ids = self::get_orphaned_image_ids();
        $count        = count( $orphaned_ids );

        if ( $count <= self::THRESHOLD ) {
            return array();
        }

        $bytes = self::sum_attachment_file_sizes( $orphaned_ids );

        return array(
            new Finding(
                sprintf(
                    /* translators: 1: number of unused images, 2: formatted total file size, e.g. "3.2 MB". */
                    __( '%1$d unused images found (%2$s)', 'vulopilot' ),
                    $count,
                    size_format( $bytes )
                ),
                Severity::LOW,
                $this->get_category(),
                __( 'These images are not attached to any post or page, are not used as a featured image, site icon, or logo, and were uploaded more than 30 days ago. Use the "Image Cleanup" quick action to remove them and reclaim disk space.', 'vulopilot' ),
                'table',
                'options',
                array(
                    'orphaned_image_count' => $count,
                    'bytes'                => $bytes,
                    'recommended_fix'      => array(
                        __( 'Review the Media Library for images no longer attached to any post or page.', 'vulopilot' ),
                        __( 'Delete confirmed-unused images to free up storage and reduce backup size.', 'vulopilot' ),
                        __( 'Use a plugin (e.g. Media Cleaner) to help identify safely-removable files.', 'vulopilot' ),
                        __( 'Re-run this scan after cleanup to confirm the orphaned count has dropped.', 'vulopilot' ),
                    ),
                ),
                'unused-images'
            ),
        );
    }

    /**
     * Unattached image attachments older than MIN_AGE_DAYS, minus anything
     * currently protected (see get_protected_image_ids()) - the single
     * source of truth both scan() and PerformanceActions::run_image_cleanup()
     * use, so what's counted here is exactly what gets deleted there.
     *
     * @return array<int, int> Attachment ids.
     */
    public static function get_orphaned_image_ids(): array {
        global $wpdb;

        $cutoff = gmdate( 'Y-m-d H:i:s', time() - ( self::MIN_AGE_DAYS * DAY_IN_SECONDS ) );

        $candidate_ids = $wpdb->get_col( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT ID FROM {$wpdb->posts} WHERE post_type = 'attachment' AND post_mime_type LIKE %s AND post_parent = 0 AND post_date < %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                'image/%',
                $cutoff
            )
        );

        if ( empty( $candidate_ids ) ) {
            return array();
        }

        $protected_ids = self::get_protected_image_ids();

        return array_values(
            array_diff( array_map( 'intval', $candidate_ids ), $protected_ids )
        );
    }

    /**
     * Image attachment ids that must never be treated as orphaned, even if
     * `post_parent` happens to be 0 (legacy media-library uploads commonly
     * have no parent even when actively used as a featured image/site
     * icon/logo).
     *
     * @return array<int, int>
     */
    private static function get_protected_image_ids(): array {
        global $wpdb;

        $protected = array();

        $site_icon_id = (int) get_option( 'site_icon' );

        if ( $site_icon_id > 0 ) {
            $protected[] = $site_icon_id;
        }

        $custom_logo_id = (int) get_theme_mod( 'custom_logo' );

        if ( $custom_logo_id > 0 ) {
            $protected[] = $custom_logo_id;
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $thumbnail_ids = $wpdb->get_col(
            "SELECT DISTINCT meta_value FROM {$wpdb->postmeta} WHERE meta_key = '_thumbnail_id'"
        );

        foreach ( $thumbnail_ids as $thumbnail_id ) {
            $protected[] = (int) $thumbnail_id;
        }

        return array_unique( $protected );
    }

    /**
     * @param array<int, int> $attachment_ids Attachment ids.
     * @return int Total bytes across the original files currently on disk.
     */
    public static function sum_attachment_file_sizes( array $attachment_ids ): int {
        $total = 0;

        foreach ( $attachment_ids as $attachment_id ) {
            $file = get_attached_file( $attachment_id );

            if ( $file && file_exists( $file ) ) {
                $total += filesize( $file );
            }
        }

        return $total;
    }
}

/**
 * Flags un-minified same-host JavaScript on the homepage when no known
 * minification-capable plugin is active - see
 * AbstractAssetOptimizationScanner for the shared fetch/detection logic
 * this and CssOptimizationScanner both build on.
 *
 * @class       JavaScriptOptimizationScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class JavaScriptOptimizationScanner extends AbstractAssetOptimizationScanner {

    private const SCRIPT_PATTERN = '/<script[^>]+src=["\']([^"\']+)["\']/i';

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'javascript-optimization';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'JavaScript', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'performance';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        if ( $this->has_known_minifier_plugin() ) {
            return array();
        }

        $html = $this->fetch_homepage_html();

        if ( null === $html ) {
            return array();
        }

        $unminified = $this->find_unminified_same_host_assets( $html, self::SCRIPT_PATTERN );

        if ( empty( $unminified ) ) {
            return array();
        }

        return array(
            new Finding(
                sprintf(
                    /* translators: %d is the number of un-minified scripts found. */
                    _n(
                        '%d un-minified script found',
                        '%d un-minified scripts found',
                        count( $unminified ),
                        'vulopilot'
                    ),
                    count( $unminified )
                ),
                Severity::LOW,
                $this->get_category(),
                __( 'These scripts aren\'t minified and no minification plugin is active. Minifying JavaScript reduces file size and speeds up page rendering.', 'vulopilot' ),
                'url',
                home_url( '/' ),
                array(
                    'scripts'         => $unminified,
                    'recommended_fix' => array(
                        __( 'Enable JavaScript minification in your caching/optimization plugin.', 'vulopilot' ),
                        __( 'Defer or async-load non-critical scripts so they don\'t block page rendering.', 'vulopilot' ),
                        __( 'Remove unused scripts from themes/plugins you don\'t need.', 'vulopilot' ),
                        __( 'Re-run this scan after minifying to confirm these scripts are no longer flagged.', 'vulopilot' ),
                    ),
                ),
                'unminified-scripts'
            ),
        );
    }
}

/**
 * Flags oversized image attachments - distinct from ImagesScanner, which
 * only checks for missing alt text and never inspects file size. Same
 * bounded media-library query shape as ImagesScanner, just checking
 * filesize() instead of the alt-text meta key.
 *
 * @class       LargeImagesScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class LargeImagesScanner extends AbstractBasicScanner {

    /**
     * How many of the most recent image attachments to check per run.
     */
    private const BATCH_SIZE = 100;

    /**
     * File size, in bytes, above which an image is worth flagging.
     */
    private const SIZE_THRESHOLD_BYTES = 512000; // 500KB.

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'large-images';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Large Images', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'performance';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $settings = wp_parse_args( get_option( \VuloPilot\Utill::VULOPILOT_SETTINGS_KEY, array() ), \VuloPilot\Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['content_search_scans']['images']['enable'] ) ) {
            return array();
        }

        $findings    = array();
        $attachments = get_posts(
            array(
                'post_type'      => 'attachment',
                'post_mime_type' => 'image',
                'post_status'    => 'inherit',
                'posts_per_page' => self::BATCH_SIZE,
                'orderby'        => 'date',
                'order'          => 'DESC',
                'fields'         => 'ids',
            )
        );

        foreach ( $attachments as $attachment_id ) {
            $file_path = get_attached_file( $attachment_id );

            if ( ! $file_path || ! file_exists( $file_path ) ) {
                continue;
            }

            $file_size = filesize( $file_path );

            if ( $file_size <= self::SIZE_THRESHOLD_BYTES ) {
                continue;
            }

            $findings[] = new Finding(
                sprintf(
                    /* translators: 1: image filename, 2: formatted file size, e.g. "1.4 MB". */
                    __( 'Large image: %1$s (%2$s)', 'vulopilot' ),
                    wp_basename( $file_path ),
                    size_format( $file_size )
                ),
                Severity::LOW,
                $this->get_category(),
                __( 'Large images slow down page loads, especially on mobile connections - consider compressing or resizing.', 'vulopilot' ),
                'attachment',
                (string) $attachment_id,
                array(
                    'file_size_bytes' => $file_size,
                    'recommended_fix' => array(
                        __( 'Compress oversized images with a plugin (e.g. ShortPixel, Imagify) or before uploading.', 'vulopilot' ),
                        __( 'Convert large images to a modern format like WebP or AVIF.', 'vulopilot' ),
                        __( 'Resize images to the maximum dimension actually needed - avoid uploading full-resolution originals.', 'vulopilot' ),
                        __( 'Re-run this scan after optimizing to confirm the file size has dropped.', 'vulopilot' ),
                    ),
                )
            );
        }

        return $findings;
    }
}

/**
 * Flags a site where WordPress core's own native lazy-loading
 * (`loading="lazy"`, on by default since WP 5.5) has been disabled by a
 * theme or plugin - a zero-cost check via the exact filter WordPress core
 * itself calls, no HTTP request needed unlike this file's sibling scanners.
 *
 * @class       LazyLoadingScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class LazyLoadingScanner extends AbstractBasicScanner {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'lazy-loading';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Lazy Loading', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'performance';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        if ( wp_lazy_loading_enabled( 'img', 'the_content' ) ) {
            return array();
        }

        return array(
            new Finding(
                __( 'Native lazy-loading is disabled', 'vulopilot' ),
                Severity::LOW,
                $this->get_category(),
                __( 'A theme or plugin has disabled WordPress\'s built-in lazy-loading for images, so all images now load immediately instead of only as visitors scroll to them.', 'vulopilot' ),
                'setting',
                'wp_lazy_loading_enabled',
                array(
                    'recommended_fix' => array(
                        __( 'Check whether a theme or plugin is filtering wp_lazy_loading_enabled to false, and remove that filter if it isn\'t intentional.', 'vulopilot' ),
                        __( 'Enable lazy loading in your caching/optimization plugin if it offers the option.', 'vulopilot' ),
                        __( 'Confirm below-the-fold images include loading="lazy" after re-enabling.', 'vulopilot' ),
                        __( 'Re-run this scan to confirm lazy loading is active again.', 'vulopilot' ),
                    ),
                )
            ),
        );
    }
}

/**
 * Flags an oversized autoloaded-options footprint - every option row with
 * `autoload = 'yes'` is loaded into memory on *every* WordPress request
 * (`wp_load_alloptions()`), so a bloated autoload set (a common side
 * effect of poorly-behaved plugins storing large blobs there) is one of
 * the most direct, well-documented causes of slow WordPress sites.
 *
 * @class       PerformanceScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PerformanceScanner extends AbstractBasicScanner {

    /**
     * Autoloaded-options size, in bytes, above which this is worth
     * flagging. 1MB is a widely-cited threshold for this exact check.
     */
    private const AUTOLOAD_SIZE_THRESHOLD_BYTES = 1_000_000;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'performance';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Performance', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'performance';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        global $wpdb;

        $findings = array();

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $autoload_bytes = (int) $wpdb->get_var(
            "SELECT SUM(LENGTH(option_value)) FROM {$wpdb->options} WHERE autoload = 'yes'"
        );

        if ( $autoload_bytes > self::AUTOLOAD_SIZE_THRESHOLD_BYTES ) {
            $findings[] = new Finding(
                sprintf(
                    /* translators: %s is a formatted byte size, e.g. "1.4 MB". */
                    __( 'Autoloaded options are %s', 'vulopilot' ),
                    size_format( $autoload_bytes )
                ),
                Severity::MEDIUM,
                $this->get_category(),
                __( 'Autoloaded options are loaded into memory on every page request. A large autoload footprint slows down every request site-wide.', 'vulopilot' ),
                'table',
                $wpdb->options,
                array(
                    'autoload_bytes'  => $autoload_bytes,
                    'recommended_fix' => array(
                        __( 'Identify large autoloaded options with a query monitor or plugin (e.g. Query Monitor).', 'vulopilot' ),
                        __( 'Set autoload to "no" for large, non-critical options in the wp_options table.', 'vulopilot' ),
                        __( 'Remove leftover options from plugins you\'ve since deactivated or deleted.', 'vulopilot' ),
                        __( 'Re-run this scan to confirm the autoloaded size has dropped.', 'vulopilot' ),
                    ),
                )
            );
        }

        return $findings;
    }
}

/**
 * Times a real request to the site's own homepage and flags a slow
 * response - no existing scanner measures request timing (ScanRunner
 * times a whole scanner's execution, not one HTTP response), so this
 * brackets its own wp_remote_get() call with microtime(true), the same
 * way ScanRunner itself times a scanner run.
 *
 * @class       SlowPageScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SlowPageScanner extends AbstractBasicScanner {

    /**
     * Response time, in seconds, above which the homepage is considered slow.
     */
    private const SLOW_THRESHOLD_SECONDS = 2.0;

    private const REQUEST_TIMEOUT_SECONDS = 10;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'slow-pages';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Slow Pages', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'performance';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $started_at = microtime( true );
        $response   = wp_remote_get(
            home_url( '/' ),
            array(
                'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
                'sslverify' => false,
            )
        );
        $elapsed    = microtime( true ) - $started_at;

        if ( is_wp_error( $response ) ) {
            return array();
        }

        if ( $elapsed < self::SLOW_THRESHOLD_SECONDS ) {
            return array();
        }

        return array(
            new Finding(
                sprintf(
                    /* translators: %s is the response time in seconds, e.g. "3.42". */
                    __( 'Homepage took %ss to respond', 'vulopilot' ),
                    number_format( $elapsed, 2 )
                ),
                Severity::MEDIUM,
                $this->get_category(),
                __( 'A slow homepage response affects every visit and is one of the biggest levers on perceived site speed.', 'vulopilot' ),
                'url',
                home_url( '/' ),
                array(
                    'response_time_seconds' => round( $elapsed, 2 ),
                    'recommended_fix'       => array(
                        __( 'Enable a page caching plugin (e.g. WP Super Cache, WP Rocket) if none is active.', 'vulopilot' ),
                        __( 'Check your hosting plan\'s server resources - shared hosting is a common bottleneck.', 'vulopilot' ),
                        __( 'Reduce the number of active plugins that run on the homepage.', 'vulopilot' ),
                        __( 'Consider a persistent object cache (Redis/Memcached) for database-heavy pages.', 'vulopilot' ),
                    ),
                ),
                'homepage-response-time'
            ),
        );
    }
}
