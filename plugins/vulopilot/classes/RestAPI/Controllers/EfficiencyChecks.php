<?php
/**
 * EfficiencyChecks controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

defined( 'ABSPATH' ) || exit;

/**
 * GET /efficiency-checks — backs "Protect My Site" → Performance tab.
 *
 * Unlike every other tab on this page, this data isn't findings read back
 * out of `vulopilot_scan_findings` (that table only ever stores problems,
 * never a "this passed" record — Basic\PerformanceScanner/
 * Basic\CacheDetectionScanner still work that way for the *separate*
 * "Improve My Speed" page's own category-'performance' findings list).
 * The Performance tab's own mockup needs every check's live state,
 * good or bad, on every load — the same shape WordPress core's own
 * Tools → Site Health screen already solves for by running its
 * `WP_Site_Health::get_test_*()` methods synchronously per request rather
 * than persisting results. This controller does the same: 4 checks,
 * computed fresh on every call, no DB writes. Two of the four
 * (`persistent_object_cache`'s "is this even worth suggesting" threshold
 * logic, and the general "wrap core, don't reinvent" posture
 * WordPressHealthScanner/ServerHealthScanner already established for
 * this plugin) reuse `WP_Site_Health` itself rather than re-deriving its
 * thresholds; the other two (page/browser caching) are simple enough to
 * check directly against real response headers, same as
 * CacheDetectionScanner already does for its own coarser single check.
 *
 * @class       EfficiencyChecks controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class EfficiencyChecks extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'efficiency-checks';

    /**
     * Seconds a `wp_remote_get()` probe (homepage or a static asset) is
     * allowed to take before this reports "can't tell" rather than
     * hanging the whole page load.
     */
    private const REQUEST_TIMEOUT_SECONDS = 8;

    /**
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base,
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_items' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
            )
        );
    }

    /**
     * @inheritDoc
     */
    public function get_items_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @inheritDoc
     */
    public function get_items( $request ) {
        $checks = array(
            $this->check_page_caching(),
            $this->check_browser_caching(),
            $this->check_persistent_object_cache(),
            $this->check_opcache(),
        );

        $need_attention = 0;
        $working        = 0;
        $not_applicable = 0;

        foreach ( $checks as $check ) {
            switch ( $check['status'] ) {
                case 'attention':
                    ++$need_attention;
                    break;
                case 'not_applicable':
                    ++$not_applicable;
                    break;
                default:
                    ++$working;
            }
        }

        return rest_ensure_response(
            array(
                'summary' => array(
                    'total'          => count( $checks ),
                    'need_attention' => $need_attention,
                    'working'        => $working,
                    'not_applicable' => $not_applicable,
                ),
                'sections' => array(
                    array(
                        'key'         => 'page-delivery',
                        'label'       => __( 'Page Delivery', 'vulopilot' ),
                        'question'    => __( 'Is WordPress avoiding unnecessary work?', 'vulopilot' ),
                        'checks'      => array( $checks[0], $checks[1] ),
                    ),
                    array(
                        'key'      => 'data-efficiency',
                        'label'    => __( 'WordPress Data Efficiency', 'vulopilot' ),
                        'question' => __( 'Can WordPress retrieve frequently used information efficiently?', 'vulopilot' ),
                        'checks'   => array( $checks[2] ),
                    ),
                    array(
                        'key'      => 'server-processing',
                        'label'    => __( 'Server Processing', 'vulopilot' ),
                        'question' => __( 'Can your server prepare WordPress efficiently?', 'vulopilot' ),
                        'checks'   => array( $checks[3] ),
                    ),
                ),
                // Only the checks actually needing attention — same
                // "Things to review" list the mockup shows below the tile
                // sections.
                'review_items' => array_values(
                    array_filter(
                        $checks,
                        static function ( $check ) {
                            return 'attention' === $check['status'];
                        }
                    )
                ),
            )
        );
    }

    /**
     * "Page caching" — is anything full-page-caching the homepage at all?
     * Same two signals CacheDetectionScanner already checks (a known
     * caching plugin, or the homepage's own response carrying a caching
     * header) — reported here as two separate technical-detail lines
     * instead of collapsed into one pass/fail Finding, since this tile
     * needs to show its own reasoning even when it passes.
     *
     * @return array
     */
    private function check_page_caching(): array {
        $known_plugin_active = $this->has_known_caching_plugin();
        // WP core itself sets this constant true the moment a page-cache
        // plugin's own advanced-cache.php drop-in is present and loaded
        // (wp-settings.php) — the same "advanced_cache_present" signal
        // WP_Site_Health::get_test_page_cache() reads, without needing
        // that method's own private helpers.
        $advanced_cache_present = defined( 'WP_CACHE' ) && WP_CACHE;
        $page_cache_detected    = $known_plugin_active || $advanced_cache_present;

        $cache_headers_detected = $this->has_caching_header( home_url( '/' ) );

        $status = ( $page_cache_detected || $cache_headers_detected ) ? 'good' : 'attention';

        return array(
            'id'          => 'page-caching',
            'title'       => __( 'Page caching', 'vulopilot' ),
            'description' => __( 'WordPress may be rebuilding pages that could otherwise be served from a saved copy.', 'vulopilot' ),
            // Same icon MetricsGrid.tsx already uses for its own
            // 'cache-detection' tile on the separate "Improve My Speed"
            // page — kept consistent rather than picking a new one for
            // the same underlying concept.
            'icon'        => 'refresh-bold',
            'status'      => $status,
            'badge'       => $status === 'good' ? __( 'Working', 'vulopilot' ) : __( 'Not detected', 'vulopilot' ),
            'review_title'       => __( 'Page caching isn\'t detected', 'vulopilot' ),
            'review_description' => __( 'WordPress may be rebuilding pages for repeat visits.', 'vulopilot' ),
            'technical_details' => array(
                array(
                    'label'  => __( 'Page cache', 'vulopilot' ),
                    'value'  => $page_cache_detected ? __( 'Detected', 'vulopilot' ) : __( 'Not detected', 'vulopilot' ),
                    'status' => $page_cache_detected ? 'good' : 'attention',
                ),
                array(
                    'label'  => __( 'Cache headers', 'vulopilot' ),
                    'value'  => $cache_headers_detected ? __( 'Detected', 'vulopilot' ) : __( 'None detected', 'vulopilot' ),
                    'status' => $cache_headers_detected ? 'good' : 'attention',
                ),
            ),
        );
    }

    /**
     * "Browser caching" — a genuinely different signal from page caching
     * above: whether a static asset (one every WordPress install serves,
     * `wp-embed.min.js` — no plugin/theme dependency) carries the
     * response headers that let a visitor's *browser* reuse it on repeat
     * views, rather than whether the HTML page itself is cached
     * server-side.
     *
     * @return array
     */
    private function check_browser_caching(): array {
        $response = $this->probe( includes_url( 'js/wp-embed.min.js' ) );

        $cache_control    = $response ? wp_remote_retrieve_header( $response, 'cache-control' ) : '';
        $cache_control_ok = (bool) preg_match( '/max-age=[1-9]/', (string) $cache_control );
        $expires_header   = $response ? wp_remote_retrieve_header( $response, 'expires' ) : '';
        $expires_ok       = '' !== $expires_header && strtotime( (string) $expires_header ) > time();

        $status = $cache_control_ok ? 'good' : 'attention';

        return array(
            'id'          => 'browser-caching',
            'title'       => __( 'Browser caching', 'vulopilot' ),
            'description' => __( 'Visitors can reuse suitable website files.', 'vulopilot' ),
            'icon'        => 'global-community',
            'status'      => $status,
            'badge'       => $status === 'good' ? __( 'Working', 'vulopilot' ) : __( 'Not detected', 'vulopilot' ),
            'review_title'       => __( 'Browser caching headers are missing', 'vulopilot' ),
            'review_description' => __( 'Visitor browsers may re-download files that could be reused.', 'vulopilot' ),
            'technical_details' => array(
                array(
                    'label'  => 'Cache-Control',
                    'value'  => $cache_control_ok ? __( 'Detected', 'vulopilot' ) : __( 'Not detected', 'vulopilot' ),
                    'status' => $cache_control_ok ? 'good' : 'attention',
                ),
                array(
                    'label'  => __( 'Expires header', 'vulopilot' ),
                    'value'  => $expires_ok ? __( 'Detected', 'vulopilot' ) : __( 'Not detected', 'vulopilot' ),
                    'status' => $expires_ok ? 'good' : 'attention',
                ),
            ),
        );
    }

    /**
     * "Persistent object cache" — wraps `wp_using_ext_object_cache()`
     * (real core function; true only once a real backend like Redis/
     * Memcached is wired up via a real `object-cache.php` drop-in, not
     * WordPress's own in-request-only default object cache) plus
     * `WP_Site_Health::should_suggest_persistent_object_cache()` (core's
     * own multisite/table-size thresholds — reused rather than
     * re-derived, so a small single-site install correctly reports "not
     * required" instead of "recommended").
     *
     * @return array
     */
    private function check_persistent_object_cache(): array {
        $active  = wp_using_ext_object_cache();
        $drop_in = file_exists( WP_CONTENT_DIR . '/object-cache.php' );

        $status = 'good';
        $badge  = __( 'Working', 'vulopilot' );

        if ( ! $active ) {
            $status = $this->should_suggest_persistent_object_cache() ? 'attention' : 'not_applicable';
            $badge  = 'attention' === $status ? __( 'Recommended', 'vulopilot' ) : __( 'Not required', 'vulopilot' );
        }

        return array(
            'id'          => 'persistent-object-cache',
            'title'       => __( 'Persistent object cache', 'vulopilot' ),
            'description' => __( 'Your website may benefit from keeping frequently used WordPress data ready between visits.', 'vulopilot' ),
            'icon'        => 'database',
            'status'      => $status,
            'badge'       => $badge,
            'review_title'       => __( 'Persistent object cache recommended', 'vulopilot' ),
            'review_description' => __( 'Your site may benefit from a persistent object cache.', 'vulopilot' ),
            'technical_details' => array(
                array(
                    'label'  => __( 'Persistent object cache', 'vulopilot' ),
                    'value'  => $active ? __( 'Detected', 'vulopilot' ) : __( 'Not detected', 'vulopilot' ),
                    'status' => $active ? 'good' : 'attention',
                ),
                array(
                    'label'  => __( 'Drop-in', 'vulopilot' ),
                    'value'  => $drop_in ? __( 'Active', 'vulopilot' ) : __( 'Not active', 'vulopilot' ),
                    'status' => $drop_in ? 'good' : 'attention',
                ),
            ),
        );
    }

    /**
     * "PHP acceleration" — Zend OPcache. `opcache_get_status()` reports
     * whether the extension is actually running for *this* request;
     * `ini_get('opcache.enable')` is the separate php.ini toggle that
     * controls whether it's allowed to at all — real, independent
     * signals, not one value shown twice.
     *
     * @return array
     */
    private function check_opcache(): array {
        $enabled = false;

        if ( function_exists( 'opcache_get_status' ) ) {
            // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- opcache_get_status() itself warns when opcache.enable=0; that's the exact case being checked for.
            $opcache_status = @opcache_get_status( false );
            $enabled        = is_array( $opcache_status ) && ! empty( $opcache_status['opcache_enabled'] );
        }

        $ini_active = filter_var( ini_get( 'opcache.enable' ), FILTER_VALIDATE_BOOLEAN );

        $status = $enabled ? 'good' : 'attention';

        return array(
            'id'          => 'opcache',
            'title'       => __( 'PHP acceleration', 'vulopilot' ),
            'description' => __( 'Your server can reuse compiled PHP code.', 'vulopilot' ),
            'icon'        => 'coding',
            'status'      => $status,
            'badge'       => $status === 'good' ? __( 'Working', 'vulopilot' ) : __( 'Not detected', 'vulopilot' ),
            'review_title'       => __( 'OPcache is not enabled', 'vulopilot' ),
            'review_description' => __( 'Enabling OPcache can significantly improve PHP performance.', 'vulopilot' ),
            'technical_details' => array(
                array(
                    'label'  => 'OPcache',
                    'value'  => $enabled ? __( 'Enabled', 'vulopilot' ) : __( 'Disabled', 'vulopilot' ),
                    'status' => $enabled ? 'good' : 'attention',
                ),
                array(
                    'label'  => __( 'Status', 'vulopilot' ),
                    'value'  => $ini_active ? __( 'Active', 'vulopilot' ) : __( 'Inactive', 'vulopilot' ),
                    'status' => $ini_active ? 'good' : 'attention',
                ),
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

        // Same list Basic\CacheDetectionScanner already maintains for its
        // own (coarser, single-signal) check — duplicated here rather
        // than made a shared constant since the two live in different
        // classes with otherwise no shared base; if that list changes,
        // update it in both places.
        $known_caching_plugins = array(
            'wp-rocket/wp-rocket.php',
            'w3-total-cache/w3-total-cache.php',
            'wp-super-cache/wp-cache.php',
            'litespeed-cache/litespeed-cache.php',
            'cache-enabler/cache-enabler.php',
            'wp-fastest-cache/wpFastestCache.php',
        );

        foreach ( $known_caching_plugins as $plugin_file ) {
            if ( is_plugin_active( $plugin_file ) ) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param string $url URL to request.
     * @return array|null The raw `wp_remote_get()` response, or null on
     *                     request failure — read with
     *                     `wp_remote_retrieve_header()` rather than cast
     *                     to an array, since the header bag WordPress
     *                     returns (`WpOrg\Requests\Utility\
     *                     CaseInsensitiveDictionary` on WP 6.2+) stores
     *                     its data behind non-public properties; an
     *                     `(array)` cast on it would produce mangled
     *                     property-name keys instead of real header
     *                     names.
     */
    private function probe( string $url ): ?array {
        $response = wp_remote_get(
            $url,
            array(
                'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
                'sslverify' => false,
            )
        );

        return is_wp_error( $response ) ? null : $response;
    }

    /**
     * @param string $url URL to request.
     * @return bool
     */
    private function has_caching_header( string $url ): bool {
        $response = $this->probe( $url );

        if ( ! $response ) {
            // Can't tell either way — same "don't flag on an
            // inconclusive request" posture CacheDetectionScanner
            // already takes for this exact case.
            return true;
        }

        $cache_control = (string) wp_remote_retrieve_header( $response, 'cache-control' );

        if ( preg_match( '/max-age=[1-9]/', $cache_control ) ) {
            return true;
        }

        return '' !== (string) wp_remote_retrieve_header( $response, 'etag' )
            || '' !== (string) wp_remote_retrieve_header( $response, 'age' );
    }

    /**
     * Wraps `WP_Site_Health::should_suggest_persistent_object_cache()` —
     * core's own real thresholds (multisite, or option/comment/post/user
     * table row counts) for whether a persistent object cache is even
     * worth recommending on this specific site, same "wrap core, don't
     * reinvent" posture ServerHealthScanner/WordPressHealthScanner
     * already use for their own wrapped tests.
     *
     * @return bool
     */
    private function should_suggest_persistent_object_cache(): bool {
        if ( ! class_exists( '\WP_Site_Health' ) ) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-site-health.php';
        }

        return \WP_Site_Health::get_instance()->should_suggest_persistent_object_cache();
    }
}
