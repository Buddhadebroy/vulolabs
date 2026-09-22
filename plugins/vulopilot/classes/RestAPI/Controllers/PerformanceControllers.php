<?php
/**
 * Every class in this file used to be its own file under classes/RestAPI/Controllers/
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

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\CoreWebVitalsRepository;
use VuloPilot\Repositories\PageSpeedRepository;
use VuloPilot\Repositories\PerformanceRequestRepository;
use VuloPilot\Repositories\ScoreSnapshotRepository;
use VuloPilot\Scanners\Basic\DatabaseCleanupScanner;
use VuloPilot\Scanners\Basic\ImageCleanupScanner;

defined( 'ABSPATH' ) || exit;

/**
 * `GET /core-web-vitals` - backs "Performance" Overview's
 * PerformanceScoreCard.tsx Core Web Vitals tiles. Read-only, real p75
 * aggregate from CoreWebVitalsRepository::get_p75_summary() (the actual
 * data the public beacon endpoint,
 * classes/RestAPI/Controllers/CoreWebVitalsBeaconRest.php, has collected
 * from real visitors).
 *
 * @class       CoreWebVitals controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class CoreWebVitals extends \WP_REST_Controller {

    /**
     * REST base for this controller's routes.
     *
     * @var string
     */
    protected $rest_base = 'core-web-vitals';

    /**
     * Registers GET /core-web-vitals.
     *
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
     * Same manage_options gate every other VuloPilot REST route uses.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function get_items_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_items( $request ) {
        return rest_ensure_response( ( new CoreWebVitalsRepository() )->get_p75_summary() );
    }
}

/**
 * `POST /performance-vitals-beacon` - this codebase's first public,
 * anonymous REST route (confirmed via a full audit: every other
 * `permission_callback` in this plugin is `current_user_can('manage_options')`).
 * Called by real visitors' browsers (public/js/performance-vitals-beacon.js,
 * enqueued by Services\CoreWebVitalsBeacon), so it can't use a nonce the
 * way every logged-in-admin route here does - every value is sanitized
 * and range-clamped rather than trusted (including `page_load_ms`/
 * `transfer_bytes` - real Navigation/Resource Timing reads, same
 * clamp-don't-trust treatment as the 3 Core Web Vitals), and the whole
 * endpoint is
 * rate-limited by a single global rolling-window counter (deliberately
 * **not** keyed on the visitor's IP - this codebase has twice already
 * promised never to log or key anything on IP, see
 * Services\CrawlerTrafficLogger's and Services\PerformanceRequestLogger's
 * own docblocks).
 *
 * @class       CoreWebVitalsBeaconRest controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class CoreWebVitalsBeaconRest extends \WP_REST_Controller {

    /**
     * REST base for this controller's routes.
     *
     * @var string
     */
    protected $rest_base = 'performance-vitals-beacon';

    private const RATE_LIMIT_KEY = 'vulopilot_cwv_beacon_rl';

    private const RATE_LIMIT_WINDOW_SECONDS = 5 * MINUTE_IN_SECONDS;

    private const RATE_LIMIT_MAX = 1000;

    /**
     * A metric outside this range (ms) is treated as unmeasured rather
     * than trusted - a real LCP/INP is never a full minute.
     */
    private const MAX_MS = 60000;

    /**
     * CLS ×1000 - a real CLS is essentially never above 10.0.
     */
    private const MAX_CLS_THOUSANDTHS = 10000;

    /**
     * A real page transfer is never above 500MB - anything past this is
     * treated as unmeasured rather than trusted, same "clamp, don't trust"
     * posture as MAX_MS/MAX_CLS_THOUSANDTHS above.
     */
    private const MAX_TRANSFER_BYTES = 500 * MB_IN_BYTES;

    /**
     * Registers POST /performance-vitals-beacon.
     *
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base,
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'create_item' ),
                    'permission_callback' => '__return_true',
                ),
            )
        );
    }

    /**
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function create_item( $request ) {
        if ( ! $this->consume_rate_limit_slot() ) {
            return new \WP_Error( 'vulopilot_rate_limited', __( 'Too many requests.', 'vulopilot' ), array( 'status' => 429 ) );
        }

        $lcp_ms          = $this->sanitize_ms( $request->get_param( 'lcp_ms' ) );
        $inp_ms          = $this->sanitize_ms( $request->get_param( 'inp_ms' ) );
        $cls_thousandths = $this->sanitize_cls( $request->get_param( 'cls_thousandths' ) );
        $page_load_ms    = $this->sanitize_ms( $request->get_param( 'page_load_ms' ) );
        $transfer_bytes  = $this->sanitize_bytes( $request->get_param( 'transfer_bytes' ) );

        if ( null === $lcp_ms && null === $inp_ms && null === $cls_thousandths && null === $page_load_ms && null === $transfer_bytes ) {
            return new \WP_Error( 'vulopilot_no_metrics', __( 'No usable metrics in this request.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        ( new CoreWebVitalsRepository() )->record( $lcp_ms, $cls_thousandths, $inp_ms, $page_load_ms, $transfer_bytes );

        return rest_ensure_response( array( 'recorded' => true ) );
    }

    /**
     * @param mixed $value Raw request value.
     * @return int|null
     */
    private function sanitize_ms( $value ): ?int {
        if ( ! is_numeric( $value ) ) {
            return null;
        }

        $ms = (int) round( (float) $value );

        return ( $ms >= 0 && $ms <= self::MAX_MS ) ? $ms : null;
    }

    /**
     * @param mixed $value Raw request value (already ×1000 from the client).
     * @return int|null
     */
    private function sanitize_cls( $value ): ?int {
        if ( ! is_numeric( $value ) ) {
            return null;
        }

        $thousandths = (int) round( (float) $value );

        return ( $thousandths >= 0 && $thousandths <= self::MAX_CLS_THOUSANDTHS ) ? $thousandths : null;
    }

    /**
     * @param mixed $value Raw request value - real summed Navigation+Resource Timing `transferSize`, in bytes.
     * @return int|null
     */
    private function sanitize_bytes( $value ): ?int {
        if ( ! is_numeric( $value ) ) {
            return null;
        }

        $bytes = (int) round( (float) $value );

        return ( $bytes >= 0 && $bytes <= self::MAX_TRANSFER_BYTES ) ? $bytes : null;
    }

    /**
     * A single sitewide rolling-window counter - global rather than
     * per-visitor since this endpoint deliberately has no visitor
     * identifier of any kind to key a per-visitor limit on.
     *
     * @return bool True if this request may proceed, false if rate-limited.
     */
    private function consume_rate_limit_slot(): bool {
        $now   = time();
        $state = get_transient( self::RATE_LIMIT_KEY );

        if ( ! is_array( $state ) || ! isset( $state['resets_at'] ) || $now >= $state['resets_at'] ) {
            $state = array(
                'count'     => 0,
                'resets_at' => $now + self::RATE_LIMIT_WINDOW_SECONDS,
            );
        }

        if ( $state['count'] >= self::RATE_LIMIT_MAX ) {
            return false;
        }

        ++$state['count'];
        set_transient( self::RATE_LIMIT_KEY, $state, self::RATE_LIMIT_WINDOW_SECONDS );

        return true;
    }
}

/**
 * GET /efficiency-checks - backs "Protect My Site" → Performance tab.
 *
 * Unlike every other tab on this page, this data isn't findings read back
 * out of `vulopilot_scan_findings` (that table only ever stores problems,
 * never a "this passed" record - Basic\PerformanceScanner/
 * Basic\CacheDetectionScanner still work that way for the *separate*
 * "Improve My Speed" page's own category-'performance' findings list).
 * The Performance tab's own mockup needs every check's live state,
 * good or bad, on every load - the same shape WordPress core's own
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
                // Only the checks actually needing attention - same
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
     * "Page caching" - is anything full-page-caching the homepage at all?
     * Same two signals CacheDetectionScanner already checks (a known
     * caching plugin, or the homepage's own response carrying a caching
     * header) - reported here as two separate technical-detail lines
     * instead of collapsed into one pass/fail Finding, since this tile
     * needs to show its own reasoning even when it passes.
     *
     * @return array
     */
    private function check_page_caching(): array {
        $known_plugin_active = $this->has_known_caching_plugin();
        // WP core itself sets this constant true the moment a page-cache
        // plugin's own advanced-cache.php drop-in is present and loaded
        // (wp-settings.php) - the same "advanced_cache_present" signal
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
            // page - kept consistent rather than picking a new one for
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
     * "Browser caching" - a genuinely different signal from page caching
     * above: whether a static asset (one every WordPress install serves,
     * `wp-embed.min.js` - no plugin/theme dependency) carries the
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
     * "Persistent object cache" - wraps `wp_using_ext_object_cache()`
     * (real core function; true only once a real backend like Redis/
     * Memcached is wired up via a real `object-cache.php` drop-in, not
     * WordPress's own in-request-only default object cache) plus
     * `WP_Site_Health::should_suggest_persistent_object_cache()` (core's
     * own multisite/table-size thresholds - reused rather than
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
     * "PHP acceleration" - Zend OPcache. `opcache_get_status()` reports
     * whether the extension is actually running for *this* request;
     * `ini_get('opcache.enable')` is the separate php.ini toggle that
     * controls whether it's allowed to at all - real, independent
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
        // own (coarser, single-signal) check - duplicated here rather
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
     *                     request failure - read with
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
            // Can't tell either way - same "don't flag on an
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
     * Wraps `WP_Site_Health::should_suggest_persistent_object_cache()` -
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

/**
 * `GET /page-speed` lists real per-page speed results plus a real summary
 * and `top_issues` (PageSpeedRepository::get_top_issues() - the real,
 * deduplicated `main_issue` values grouped by how many pages they affect,
 * backing the "Performance Opportunities" tab and "Why these pages are
 * slow?" sidebar) for "Performance" › Slow Pages; `POST /page-speed`
 * (re)starts a real background scan via VuloPilot()->page_speed_scanner
 * (already wired in VuloPilot::init_classes()) - same "GET lists, POST
 * triggers, persistence happens elsewhere" shape Scans.php already uses.
 *
 * @class       PageSpeed controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class PageSpeed extends \WP_REST_Controller {

    /**
     * REST base for this controller's routes.
     *
     * @var string
     */
    protected $rest_base = 'page-speed';

    /**
     * Registers GET/POST /page-speed.
     *
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
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'create_item' ),
                    'permission_callback' => array( $this, 'create_item_permissions_check' ),
                ),
            )
        );
    }

    /**
     * Same manage_options gate every other VuloPilot REST route uses.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function get_items_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * Same manage_options gate every other VuloPilot REST route uses.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function create_item_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * Lists real per-page speed results plus a real summary.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_items( $request ) {
        $repository = new PageSpeedRepository();
        $page       = absint( $request->get_param( 'page' ) );
        $per_page   = absint( $request->get_param( 'per_page' ) );

        $filters = array(
            'page_type' => sanitize_key( (string) $request->get_param( 'page_type' ) ),
            'status'    => sanitize_key( (string) $request->get_param( 'status' ) ),
            'search'    => sanitize_text_field( (string) $request->get_param( 'search' ) ),
        );

        $result = $repository->find_all(
            array_merge(
                $filters,
                array(
                    'page'     => $page ? $page : 1,
                    'per_page' => $per_page ? $per_page : 100,
                    'orderby'  => 'score',
                    'order'    => 'asc',
                )
            )
        );

        return rest_ensure_response(
            array(
                'summary'       => $repository->get_summary(),
                'status_counts' => $repository->count_by_column( 'status', $filters ),
                'top_issues'    => $repository->get_top_issues(),
                'data'          => $result['data'],
                'total'         => $result['total'],
            )
        );
    }

    /**
     * Starts (or restarts) a real background scan - never runs
     * synchronously; VuloPilot()->page_speed_scanner processes it via
     * WP-Cron in small batches. See Services\PageSpeedScanner's own
     * docblock for why.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function create_item( $request ) {
        return rest_ensure_response( VuloPilot()->page_speed_scanner->start_scan() );
    }
}

/**
 * `POST /performance-actions/{action_id}` - backs "Performance"
 * Overview's Quick Actions card (QuickActionsCard.tsx). Each of the 8
 * actions is a real, deterministic WordPress-core-or-known-plugin
 * operation, never a fabricated "done" - `minify-css-js` explicitly
 * returns `success: false` with an honest explanation when no
 * minification-capable plugin is active (same posture `browser-caching`
 * uses when `.htaccess` isn't writable), rather than pretending to have
 * minified anything.
 *
 * @class       PerformanceActions controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class PerformanceActions extends \WP_REST_Controller {

    /**
     * REST base for this controller's routes.
     *
     * @var string
     */
    protected $rest_base = 'performance-actions';

    /**
     * Main plugin files → their own real cache-purge function, same known-
     * plugin list CacheDetectionScanner already checks is_plugin_active()
     * against - this maps to what to *call*, not just detect.
     *
     * @var array<string, string>
     */
    private const CACHE_PLUGIN_FLUSH_FUNCTIONS = array(
        'WP Rocket'        => 'rocket_clean_domain',
        'W3 Total Cache'   => 'w3tc_flush_all',
        'WP Super Cache'   => 'wp_cache_clear_cache',
        'WP Fastest Cache' => 'wpfc_clear_all_cache',
    );

    /**
     * Same size threshold LargeImagesScanner.php flags - duplicated rather
     * than made public there, matching this codebase's own established
     * "duplicate a small shared constant across scopes" precedent.
     */
    private const LARGE_IMAGE_THRESHOLD_BYTES = 512000; // 500KB.

    /**
     * How many oversized images to regenerate per click - bounded so a
     * single request can't run away on a media library with thousands of
     * oversized images.
     */
    private const MAX_IMAGES_PER_RUN = 10;

    /**
     * Registers POST /performance-actions/{action_id}.
     *
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<action_id>[a-z-]+)',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'run_action' ),
                    'permission_callback' => array( $this, 'run_action_permissions_check' ),
                ),
            )
        );
    }

    /**
     * Same manage_options gate every other VuloPilot REST route uses.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function run_action_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function run_action( $request ) {
        $action_id = sanitize_key( (string) $request->get_param( 'action_id' ) );

        switch ( $action_id ) {
            case 'clear-caches':
                return rest_ensure_response( $this->run_clear_caches() );
            case 'minify-css-js':
                return rest_ensure_response( $this->run_minify_css_js() );
            case 'optimize-images':
                return rest_ensure_response( $this->run_optimize_images() );
            case 'database-cleanup':
                return rest_ensure_response( $this->run_database_cleanup() );
            case 'image-cleanup':
                return rest_ensure_response( $this->run_image_cleanup() );
            case 'lazy-loading':
                return rest_ensure_response( $this->run_enable_lazy_loading() );
            case 'preload-resources':
                return rest_ensure_response( $this->run_enable_preload_resources() );
            case 'browser-caching':
                return rest_ensure_response( $this->run_enable_browser_caching() );
            default:
                return new \WP_Error(
                    'vulopilot_unknown_performance_action',
                    __( 'Unknown quick action.', 'vulopilot' ),
                    array( 'status' => 404 )
                );
        }
    }

    /**
     * Flushes the WordPress object cache plus every known caching plugin's
     * own real purge function, if active.
     *
     * @return array{success: bool, message: string}
     */
    private function run_clear_caches(): array {
        wp_cache_flush();

        $flushed = $this->flush_known_cache_plugins();

        return array(
            'success' => true,
            'message' => empty( $flushed )
                ? __( 'WordPress object cache flushed.', 'vulopilot' )
                : sprintf(
                    /* translators: %s is a comma-separated list of cache plugin names that were also flushed. */
                    __( 'WordPress object cache flushed, plus: %s.', 'vulopilot' ),
                    implode( ', ', $flushed )
                ),
        );
    }

    /**
     * Regenerates minified assets via a known minification-capable
     * plugin's own real function - returns an honest failure, not a
     * fabricated success, when none is active.
     *
     * @return array{success: bool, message: string}
     */
    private function run_minify_css_js(): array {
        $regenerated = array();

        if ( class_exists( '\autoptimizeCache' ) && method_exists( '\autoptimizeCache', 'clearall' ) ) {
            \autoptimizeCache::clearall();
            $regenerated[] = 'Autoptimize';
        }

        if ( function_exists( 'rocket_clean_domain' ) ) {
            rocket_clean_domain();
            $regenerated[] = 'WP Rocket';
        }

        if ( empty( $regenerated ) ) {
            return array(
                'success' => false,
                'message' => __( 'No minification plugin detected - install Autoptimize, WP Rocket, or a similar plugin to enable this action.', 'vulopilot' ),
            );
        }

        return array(
            'success' => true,
            'message' => sprintf(
                /* translators: %s is a comma-separated list of plugin names that regenerated minified assets. */
                __( 'Regenerated minified assets via: %s.', 'vulopilot' ),
                implode( ', ', $regenerated )
            ),
        );
    }

    /**
     * Regenerates registered thumbnail sizes (never the original file) for
     * the largest oversized image attachments, at a lower JPEG/WebP
     * quality - the same real mechanism "Regenerate Thumbnails" uses.
     *
     * @return array{success: bool, message: string}
     */
    private function run_optimize_images(): array {
        if ( ! function_exists( 'wp_generate_attachment_metadata' ) ) {
            require_once ABSPATH . 'wp-admin/includes/image.php';
        }

        $attachments = get_posts(
            array(
                'post_type'      => 'attachment',
                'post_mime_type' => 'image',
                'post_status'    => 'inherit',
                'posts_per_page' => 100,
                'orderby'        => 'date',
                'order'          => 'DESC',
                'fields'         => 'ids',
            )
        );

        $optimized_count = 0;
        $bytes_saved     = 0;

        add_filter( 'wp_editor_set_quality', array( __CLASS__, 'filter_image_quality' ) );

        foreach ( $attachments as $attachment_id ) {
            if ( $optimized_count >= self::MAX_IMAGES_PER_RUN ) {
                break;
            }

            $file = get_attached_file( $attachment_id );

            if ( ! $file || ! file_exists( $file ) || filesize( $file ) <= self::LARGE_IMAGE_THRESHOLD_BYTES ) {
                continue;
            }

            $bytes_before = $this->sum_registered_size_files( $attachment_id );
            $metadata     = wp_generate_attachment_metadata( $attachment_id, $file );

            if ( is_array( $metadata ) ) {
                wp_update_attachment_metadata( $attachment_id, $metadata );
            }

            $bytes_saved += max( 0, $bytes_before - $this->sum_registered_size_files( $attachment_id ) );
            ++$optimized_count;
        }

        remove_filter( 'wp_editor_set_quality', array( __CLASS__, 'filter_image_quality' ) );

        return array(
            'success' => true,
            'message' => 0 === $optimized_count
                ? __( 'No oversized images found to optimize.', 'vulopilot' )
                : sprintf(
                    /* translators: 1: number of images optimized, 2: formatted byte size saved, e.g. "1.4 MB". */
                    __( 'Optimized %1$d image(s), saved %2$s.', 'vulopilot' ),
                    $optimized_count,
                    size_format( $bytes_saved )
                ),
        );
    }

    /**
     * Deletes real expired transients and real excess post revisions -
     * the same rows DatabaseCleanupScanner counts.
     *
     * @return array{success: bool, message: string}
     */
    private function run_database_cleanup(): array {
        global $wpdb;

        $expired_timeout_keys = $wpdb->get_col( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s AND option_value < %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $wpdb->esc_like( '_transient_timeout_' ) . '%',
                time()
            )
        );

        $deleted_transients = 0;

        foreach ( $expired_timeout_keys as $timeout_key ) {
            delete_option( $timeout_key );
            delete_option( str_replace( '_transient_timeout_', '_transient_', $timeout_key ) );
            ++$deleted_transients;
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $posts_with_revisions = $wpdb->get_col(
            "SELECT DISTINCT post_parent FROM {$wpdb->posts} WHERE post_type = 'revision'"
        );

        $deleted_revisions = 0;

        foreach ( $posts_with_revisions as $post_id ) {
            $revisions = wp_get_post_revisions(
                (int) $post_id,
                array(
					'order'  => 'DESC',
					'fields' => 'ids',
                )
            );

            foreach ( array_slice( $revisions, DatabaseCleanupScanner::KEEP_REVISIONS_PER_POST ) as $revision_id ) {
                if ( wp_delete_post_revision( $revision_id ) ) {
                    ++$deleted_revisions;
                }
            }
        }

        return array(
            'success' => true,
            'message' => sprintf(
                /* translators: 1: number of expired transients deleted, 2: number of old post revisions deleted. */
                __( 'Deleted %1$d expired transients and %2$d old post revisions.', 'vulopilot' ),
                $deleted_transients,
                $deleted_revisions
            ),
        );
    }

    /**
     * Deletes the real unattached, unused image attachments
     * ImageCleanupScanner counts - same protected-id exclusions (featured
     * images, site icon, custom logo) and same 30-day age gate, since this
     * re-uses that scanner's own `get_orphaned_image_ids()` rather than
     * re-implementing the query. Bounded by MAX_IMAGES_PER_RUN per click,
     * same safety cap `run_optimize_images()` uses, so a media library with
     * hundreds of orphaned images doesn't time out a single request.
     *
     * @return array{success: bool, message: string}
     */
    private function run_image_cleanup(): array {
        $orphaned_ids = ImageCleanupScanner::get_orphaned_image_ids();

        if ( empty( $orphaned_ids ) ) {
            return array(
                'success' => true,
                'message' => __( 'No unused images found to clean up.', 'vulopilot' ),
            );
        }

        $to_delete   = array_slice( $orphaned_ids, 0, self::MAX_IMAGES_PER_RUN );
        $deleted     = 0;
        $bytes_freed = 0;

        foreach ( $to_delete as $attachment_id ) {
            $file = get_attached_file( $attachment_id );
            $size = ( $file && file_exists( $file ) ) ? filesize( $file ) : 0;

            if ( wp_delete_attachment( $attachment_id, true ) ) {
                ++$deleted;
                $bytes_freed += $size;
            }
        }

        $remaining = count( $orphaned_ids ) - $deleted;

        return array(
            'success' => true,
            'message' => $remaining > 0
                ? sprintf(
                    /* translators: 1: number of images deleted, 2: formatted bytes freed, 3: number of remaining unused images not yet processed. */
                    __( 'Deleted %1$d unused image(s), freed %2$s. %3$d more found - run again to continue.', 'vulopilot' ),
                    $deleted,
                    size_format( $bytes_freed ),
                    $remaining
                )
                : sprintf(
                    /* translators: 1: number of images deleted, 2: formatted bytes freed. */
                    __( 'Deleted %1$d unused image(s), freed %2$s.', 'vulopilot' ),
                    $deleted,
                    size_format( $bytes_freed )
                ),
        );
    }

    /**
     * Real, reversible toggle - Services\PerformanceOptimizations reads
     * this option on every request and force-enables WordPress's own
     * native lazy-loading filter when set.
     *
     * @return array{success: bool, message: string}
     */
    private function run_enable_lazy_loading(): array {
        $was_enabled = (bool) get_option( 'vulopilot_force_lazy_loading' );

        update_option( 'vulopilot_force_lazy_loading', true );

        return array(
            'success' => true,
            'message' => $was_enabled
                ? __( 'Lazy loading was already force-enabled.', 'vulopilot' )
                : __( 'Lazy loading is now force-enabled site-wide.', 'vulopilot' ),
        );
    }

    /**
     * Real, reversible toggle - Services\PerformanceOptimizations reads
     * this option on every `wp_head` and outputs real preload tags when set.
     *
     * @return array{success: bool, message: string}
     */
    private function run_enable_preload_resources(): array {
        $was_enabled = (bool) get_option( 'vulopilot_preload_critical_resources' );

        update_option( 'vulopilot_preload_critical_resources', true );

        return array(
            'success' => true,
            'message' => $was_enabled
                ? __( 'Critical resource preloading was already enabled.', 'vulopilot' )
                : __( 'Critical resource preloading is now enabled - the site logo and main stylesheet will be preloaded.', 'vulopilot' ),
        );
    }

    /**
     * Real, one-time `.htaccess` write - `insert_with_markers()` is the
     * same core function WordPress itself uses to write its own rewrite
     * rules (`wp-admin/includes/misc.php`), inside a self-contained
     * "VuloPilot Browser Caching" marker block so re-running this action
     * never duplicates or clobbers the site's existing rules (including
     * WordPress's own `# BEGIN WordPress` block just above it). Emits
     * `mod_expires` directives, not `mod_headers` - Apache's mod_expires
     * module generates both the `Expires` and `Cache-Control: max-age=…`
     * response headers on its own once `ExpiresActive On` is set, matching
     * exactly the two signals `check_browser_caching()`
     * (Controllers\EfficiencyChecks.php) probes for on a real static
     * asset request. Returns an honest failure, not a fabricated success,
     * when `.htaccess` isn't writable - same posture `run_minify_css_js()`
     * already uses for its own "nothing to do" case.
     *
     * @return array{success: bool, message: string}
     */
    private function run_enable_browser_caching(): array {
        if ( ! function_exists( 'get_home_path' ) ) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }

        if ( ! function_exists( 'insert_with_markers' ) ) {
            require_once ABSPATH . 'wp-admin/includes/misc.php';
        }

        $htaccess_file = get_home_path() . '.htaccess';

        $written = insert_with_markers(
            $htaccess_file,
            'VuloPilot Browser Caching',
            array(
                '<IfModule mod_expires.c>',
                'ExpiresActive On',
                'ExpiresByType text/css "access plus 1 year"',
                'ExpiresByType application/javascript "access plus 1 year"',
                'ExpiresByType text/javascript "access plus 1 year"',
                'ExpiresByType image/jpeg "access plus 1 year"',
                'ExpiresByType image/png "access plus 1 year"',
                'ExpiresByType image/gif "access plus 1 year"',
                'ExpiresByType image/webp "access plus 1 year"',
                'ExpiresByType image/svg+xml "access plus 1 year"',
                'ExpiresByType image/x-icon "access plus 1 year"',
                'ExpiresByType font/woff2 "access plus 1 year"',
                'ExpiresByType font/woff "access plus 1 year"',
                'ExpiresByType application/font-woff "access plus 1 year"',
                '</IfModule>',
            )
        );

        if ( ! $written ) {
            return array(
                'success' => false,
                'message' => __( 'Could not write browser caching rules to .htaccess - check that the file is writable.', 'vulopilot' ),
            );
        }

        return array(
            'success' => true,
            'message' => __( 'Browser caching headers are now active for CSS, JS, images, and fonts.', 'vulopilot' ),
        );
    }

    /**
     * @return array<int, string> Display names of cache plugins actually flushed.
     */
    private function flush_known_cache_plugins(): array {
        $flushed = array();

        foreach ( self::CACHE_PLUGIN_FLUSH_FUNCTIONS as $label => $function_name ) {
            if ( function_exists( $function_name ) ) {
                call_user_func( $function_name );
                $flushed[] = $label;
            }
        }

        if ( class_exists( '\Cache_Enabler' ) && method_exists( '\Cache_Enabler', 'clear_total_cache' ) ) {
            \Cache_Enabler::clear_total_cache();
            $flushed[] = 'Cache Enabler';
        }

        if ( has_action( 'litespeed_purge_all' ) ) {
            do_action( 'litespeed_purge_all' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals -- third-party plugin's own action name, not ours to prefix.
            $flushed[] = 'LiteSpeed Cache';
        }

        return $flushed;
    }

    /**
     * @param int $attachment_id Attachment id.
     * @return int Total bytes across every registered (non-original) size file currently on disk.
     */
    private function sum_registered_size_files( int $attachment_id ): int {
        $metadata = wp_get_attachment_metadata( $attachment_id );

        if ( ! is_array( $metadata ) || empty( $metadata['sizes'] ) ) {
            return 0;
        }

        $base_dir = trailingslashit( dirname( get_attached_file( $attachment_id ) ) );
        $total    = 0;

        foreach ( $metadata['sizes'] as $size ) {
            $path = $base_dir . $size['file'];

            if ( file_exists( $path ) ) {
                $total += filesize( $path );
            }
        }

        return $total;
    }

    /**
     * `wp_editor_set_quality` filter callback used only for the duration of
     * run_optimize_images()'s regeneration loop.
     *
     * @return int
     */
    public static function filter_image_quality(): int {
        return 82;
    }
}

/**
 * `GET /performance-realtime` - backs "Performance" Overview's
 * RealTimeMonitoringCard.tsx (Server Response Time, Page Views Last 5 Min)
 * and MetricsGrid.tsx's "Performance Monitor" tile (Active vs. not yet
 * collecting). Read-only, real data from
 * Repositories\PerformanceRequestRepository::get_realtime_stats().
 *
 * @class       PerformanceRealtime controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class PerformanceRealtime extends \WP_REST_Controller {

    /**
     * REST base for this controller's routes.
     *
     * @var string
     */
    protected $rest_base = 'performance-realtime';

    /**
     * Registers GET /performance-realtime.
     *
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
     * Same manage_options gate every other VuloPilot REST route uses.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function get_items_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_items( $request ) {
        return rest_ensure_response( ( new PerformanceRequestRepository() )->get_realtime_stats() );
    }
}

/**
 * `GET /performance-score-snapshots?days=N` - backs SpeedHistoryCard.tsx's
 * trend chart. Read-only, same shape as the AdvancedReports module's own
 * `/site-health-snapshots?days=N` (WebsiteProgressChart.tsx's data source).
 *
 * @class       PerformanceScoreSnapshots controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class PerformanceScoreSnapshots extends \WP_REST_Controller {

    /**
     * REST base for this controller's routes.
     *
     * @var string
     */
    protected $rest_base = 'performance-score-snapshots';

    /**
     * Registers GET /performance-score-snapshots.
     *
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
     * Same manage_options gate every other VuloPilot REST route uses.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function get_items_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_items( $request ) {
        $days = absint( $request->get_param( 'days' ) );

        return rest_ensure_response(
            ( new ScoreSnapshotRepository( 'performance' ) )->get_recent( $days ? $days : 30 )
        );
    }
}

/**
 * `GET /security-score-snapshots?days=N` - backs SecurityTrendCard.tsx's
 * trend chart. Read-only, same shape as
 * PerformanceScoreSnapshots.php's own `/performance-score-snapshots?days=N`.
 *
 * @class       SecurityScoreSnapshots controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class SecurityScoreSnapshots extends \WP_REST_Controller {

    /**
     * REST base for this controller's routes.
     *
     * @var string
     */
    protected $rest_base = 'security-score-snapshots';

    /**
     * Registers GET /security-score-snapshots.
     *
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
     * Same manage_options gate every other VuloPilot REST route uses.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function get_items_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_items( $request ) {
        $days = absint( $request->get_param( 'days' ) );

        return rest_ensure_response(
            ( new ScoreSnapshotRepository( 'security' ) )->get_recent( $days ? $days : 30 )
        );
    }
}
