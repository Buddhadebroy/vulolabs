<?php
/**
 * Every class in this file used to be its own file under classes/Services/
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

namespace VuloPilot\Services;

use VuloPilot\Repositories\ActivityLogRepository;
use VuloPilot\Repositories\CoreWebVitalsRepository;
use VuloPilot\Repositories\FindingRepository;
use VuloPilot\Repositories\PageSpeedRepository;
use VuloPilot\Repositories\PerformanceRequestRepository;
use VuloPilot\Repositories\ScanRepository;
use VuloPilot\Repositories\ScoreSnapshotRepository;
use VuloPilot\Utill;
use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\ScanResult;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * Enqueues public/js/performance-vitals-beacon.js on real front-end pages
 * - this plugin's first ever `wp_enqueue_scripts` registration (confirmed
 * no other front-end-visitor-facing script exists anywhere in this
 * codebase today; every other enqueue is `admin_enqueue_scripts`-gated).
 * Also runs the daily cleanup cron that keeps `vulopilot_performance_samples` (type `vital`)
 * to a rolling 28-day window - the same window CrUX's own real Core Web
 * Vitals methodology uses.
 *
 * @class       CoreWebVitalsBeacon class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CoreWebVitalsBeacon {

    private const CLEANUP_HOOK = 'vulopilot_cwv_cleanup';

    private const RETENTION_DAYS = 28;

    /**
     * CoreWebVitalsBeacon constructor.
     */
    public function __construct() {
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_beacon_script' ) );
        add_action( 'init', array( $this, 'ensure_cleanup_scheduled' ) );
        add_action( self::CLEANUP_HOOK, array( $this, 'run_cleanup' ) );
    }

    /**
     * @return void
     */
    public function enqueue_beacon_script(): void {
        if ( is_admin() ) {
            return;
        }

        wp_enqueue_script(
            'vulopilot-performance-vitals-beacon',
            VuloPilot()->plugin_url . 'assets/js/public/vulopilot-performance-vitals-beacon.min.js',
            array(),
            VuloPilot()->version,
            true
        );

        wp_localize_script(
            'vulopilot-performance-vitals-beacon',
            'vulopilotCwvBeacon',
            array(
                'endpoint' => untrailingslashit( get_rest_url() ) . '/' . VuloPilot()->rest_namespace . '/performance-vitals-beacon',
            )
        );
    }

    /**
     * Standard wp_next_scheduled()-guarded wp_schedule_event() pattern -
     * same shape Services\CrawlerTrafficLogger already uses.
     *
     * @return void
     */
    public function ensure_cleanup_scheduled(): void {
        if ( ! wp_next_scheduled( self::CLEANUP_HOOK ) ) {
            wp_schedule_event( time(), 'daily', self::CLEANUP_HOOK );
        }
    }

    /**
     * @return void
     */
    public function run_cleanup(): void {
        ( new CoreWebVitalsRepository() )->delete_older_than( self::RETENTION_DAYS );
    }
}

/**
 * Real Mobile/Desktop performance scores for "Performance" Overview's
 * PerformanceScoreCard.tsx, via Google's real PageSpeed Insights API -
 * only when the site owner has supplied their own `psi_api_key` (Settings
 * → Scanning → Performance); does nothing at all otherwise, so the card
 * honestly falls back to the single real unified
 * `category_scores.performance` number rather than a fabricated split.
 *
 * Combines two existing precedents rather than inventing new architecture:
 * RobotsTxtBotAccess.php's real `wp_remote_get()`-then-cache shape (here,
 * `update_option()` instead of a transient - the site's own two scores
 * "as of last check," not a short-lived cache) and CrawlerTrafficLogger.php's
 * `wp_next_scheduled()`/`wp_schedule_event('daily', ...)` cron-registration
 * idiom. The PSI API is slow (10-30s) and rate-limited, so it's never
 * called synchronously from a page request - only from the daily cron, or
 * a one-off `wp_schedule_single_event()` fired the moment the key is first
 * set/changed (so a site owner sees real data soon after configuring it,
 * without blocking their Settings save).
 *
 * @class       PageSpeedInsightsFetcher class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PageSpeedInsightsFetcher {

    private const CRON_HOOK = 'vulopilot_psi_fetch';

    private const REQUEST_TIMEOUT_SECONDS = 30;

    private const API_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runpagespeed';

    private const USAGE_COUNT_OPTION = 'vulopilot_psi_requests_today';

    private const USAGE_DATE_OPTION = 'vulopilot_psi_requests_date';

    /**
     * PageSpeedInsightsFetcher constructor.
     */
    public function __construct() {
        add_action( 'init', array( $this, 'ensure_daily_fetch_scheduled' ) );
        add_action( self::CRON_HOOK, array( $this, 'fetch_and_store' ) );
        add_action( 'update_option_' . Utill::VULOPILOT_SETTINGS_KEY, array( $this, 'maybe_schedule_immediate_fetch' ), 10, 2 );
    }

    /**
     * @return void
     */
    public function ensure_daily_fetch_scheduled(): void {
        if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
            wp_schedule_event( time(), 'daily', self::CRON_HOOK );
        }
    }

    /**
     * Schedules an immediate one-off fetch when `psi_api_key` was just set
     * or changed - never calls the slow API synchronously from the
     * Settings save request itself.
     *
     * @param mixed $old_value Previous `vulopilot_settings` option value.
     * @param mixed $new_value New `vulopilot_settings` option value.
     * @return void
     */
    public function maybe_schedule_immediate_fetch( $old_value, $new_value ): void {
        $old_key = is_array( $old_value ) ? (string) ( $old_value['psi_api_key'] ?? '' ) : '';
        $new_key = is_array( $new_value ) ? (string) ( $new_value['psi_api_key'] ?? '' ) : '';

        if ( '' === $new_key || $old_key === $new_key ) {
            return;
        }

        if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
            wp_schedule_single_event( time() + 5, self::CRON_HOOK );
        }
    }

    /**
     * @return void
     */
    public function fetch_and_store(): void {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
        $api_key  = trim( (string) ( $settings['psi_api_key'] ?? '' ) );

        if ( '' === $api_key ) {
            return;
        }

        $mobile_score  = $this->fetch_score( $api_key, 'mobile' );
        $desktop_score = $this->fetch_score( $api_key, 'desktop' );

        if ( null !== $mobile_score ) {
            update_option( 'vulopilot_psi_mobile_score', $mobile_score );
        }

        if ( null !== $desktop_score ) {
            update_option( 'vulopilot_psi_desktop_score', $desktop_score );
        }

        if ( null !== $mobile_score || null !== $desktop_score ) {
            update_option( 'vulopilot_psi_checked_at', current_time( 'mysql' ) );
        }
    }

    /**
     * Settings → Connections → PageSpeed Insights' own "Test Connection"
     * button - the one place besides the daily cron that ever calls
     * Google's real API, so it goes through the same `fetch_score()` (and
     * therefore the same quota guard) rather than a separate ad hoc
     * request. Runs synchronously (unlike the cron path) since it's a
     * direct, deliberate user click, not a background job - same
     * "slow but the user is already waiting" posture
     * Controllers\Settings::send_test_report() already takes for its own
     * real generation call.
     *
     * @return array{success: bool, message: string, mobile: int|null, desktop: int|null}
     */
    public function test_connection(): array {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
        $api_key  = trim( (string) ( $settings['psi_api_key'] ?? '' ) );

        if ( '' === $api_key ) {
            return array(
                'success' => false,
                'message' => __( 'Enter an API key first.', 'vulopilot' ),
                'mobile'  => null,
                'desktop' => null,
            );
        }

        if ( ! $this->has_quota_remaining( $settings ) ) {
            return array(
                'success' => false,
                'message' => __( "Today's PageSpeed Insights API limit has already been reached.", 'vulopilot' ),
                'mobile'  => null,
                'desktop' => null,
            );
        }

        $mobile_score  = $this->fetch_score( $api_key, 'mobile' );
        $desktop_score = $this->fetch_score( $api_key, 'desktop' );

        if ( null === $mobile_score && null === $desktop_score ) {
            return array(
                'success' => false,
                'message' => __( 'Could not reach Google PageSpeed Insights - check your API key and try again.', 'vulopilot' ),
                'mobile'  => null,
                'desktop' => null,
            );
        }

        if ( null !== $mobile_score ) {
            update_option( 'vulopilot_psi_mobile_score', $mobile_score );
        }

        if ( null !== $desktop_score ) {
            update_option( 'vulopilot_psi_desktop_score', $desktop_score );
        }

        update_option( 'vulopilot_psi_checked_at', current_time( 'mysql' ) );

        return array(
            'success' => true,
            'message' => __( 'Connected - Google PageSpeed Insights responded successfully.', 'vulopilot' ),
            'mobile'  => $mobile_score,
            'desktop' => $desktop_score,
        );
    }

    /**
     * Settings → Connections → PageSpeed Insights' own on-load state - the
     * real "Connected"/"Not Connected" pill and "Daily API Usage" bar, read
     * without making a live API call (unlike `test_connection()`). Same
     * real options `psi_speed_scores` (Controllers\Dashboard) reads for the
     * Performance Overview card, plus the real request counter behind
     * `has_quota_remaining()`.
     *
     * @return array{connected: bool, mobile: int|null, desktop: int|null, checked_at: string|null, requests_today: int, daily_limit: int}
     */
    public function get_status(): array {
        $settings   = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
        $checked_at = get_option( 'vulopilot_psi_checked_at', null );
        $today      = current_time( 'Y-m-d' );

        return array(
            'connected'      => '' !== trim( (string) ( $settings['psi_api_key'] ?? '' ) ) && null !== $checked_at,
            'mobile'         => get_option( 'vulopilot_psi_mobile_score', null ),
            'desktop'        => get_option( 'vulopilot_psi_desktop_score', null ),
            'checked_at'     => $checked_at,
            'requests_today' => get_option( self::USAGE_DATE_OPTION ) === $today ? (int) get_option( self::USAGE_COUNT_OPTION, 0 ) : 0,
            'daily_limit'    => absint( $settings['psi_daily_limit'] ?? 0 ),
        );
    }

    /**
     * Real daily request counter behind "Daily API Usage" - rolls over the
     * moment the stored date no longer matches today's, same "one stored
     * date string decides whether to reset" idiom as any other daily
     * counter in this codebase.
     *
     * @return void
     */
    private function record_request(): void {
        $today = current_time( 'Y-m-d' );

        if ( get_option( self::USAGE_DATE_OPTION ) !== $today ) {
            update_option( self::USAGE_DATE_OPTION, $today );
            update_option( self::USAGE_COUNT_OPTION, 0 );
        }

        update_option( self::USAGE_COUNT_OPTION, (int) get_option( self::USAGE_COUNT_OPTION, 0 ) + 1 );
    }

    /**
     * Whether today's real request count is still under `psi_daily_limit`.
     *
     * @param array $settings Real, already-defaulted `vulopilot_settings`.
     * @return bool
     */
    private function has_quota_remaining( array $settings ): bool {
        $today = current_time( 'Y-m-d' );
        $used  = get_option( self::USAGE_DATE_OPTION ) === $today ? (int) get_option( self::USAGE_COUNT_OPTION, 0 ) : 0;
        $limit = absint( $settings['psi_daily_limit'] ?? 0 );

        return ! $limit || $used < $limit;
    }

    /**
     * @param string $api_key  Real PSI API key.
     * @param string $strategy 'mobile' or 'desktop'.
     * @return int|null 0-100, or null if the request failed (including
     *                  because today's `psi_daily_limit` was already hit -
     *                  the daily cron respects the same real quota Test
     *                  Connection does, checked here rather than only in
     *                  `test_connection()` so cron calls are covered too).
     */
    private function fetch_score( string $api_key, string $strategy ): ?int {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( ! $this->has_quota_remaining( $settings ) ) {
            return null;
        }

        $url = add_query_arg(
            array(
                'url'      => rawurlencode( home_url( '/' ) ),
                'key'      => $api_key,
                'strategy' => $strategy,
                'category' => 'performance',
            ),
            self::API_BASE
        );

        $response = wp_remote_get(
            $url,
            array( 'timeout' => self::REQUEST_TIMEOUT_SECONDS )
        );

        $this->record_request();

        if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
            return null;
        }

        $body  = json_decode( wp_remote_retrieve_body( $response ), true );
        $score = $body['lighthouseResult']['categories']['performance']['score'] ?? null;

        if ( ! is_numeric( $score ) ) {
            return null;
        }

        return (int) round( ( (float) $score ) * 100 );
    }
}

/**
 * Real per-page speed checks for "Performance" › Slow Pages. Enumerates
 * real WP content - the front page, published pages, recent posts, and (if
 * WooCommerce is active) the real shop/cart/checkout pages plus recent
 * products and product categories - then times each one for real via
 * `wp_remote_get()`, the same idiom SlowPageScanner already uses for the
 * homepage alone, just generalized to many real URLs.
 *
 * Never runs inline on a single HTTP request: with dozens of real pages to
 * time (and, when a `psi_api_key` is configured, two more real PageSpeed
 * Insights calls per page), doing this synchronously - the way
 * Controllers\Scans::create_item() runs the normal scanner registry -
 * would blow past PHP's max_execution_time. Instead this seeds a queue
 * (one `vulopilot_page_speed_queue` option) and processes it in small
 * batches via a self-rescheduling `wp_schedule_single_event()`, the same
 * "never block a page request on a slow external call" posture
 * PageSpeedInsightsFetcher already established.
 *
 * `score` is derived from the real measured `load_time_ms` via a documented
 * linear formula anchored on SlowPageScanner's own real 2-second "slow"
 * threshold (score 50 at exactly 2000ms) - not a fabricated number.
 * `mobile_score`/`desktop_score` stay null unless a real PSI key is
 * configured and that page's real PSI response actually returned a score
 * (same PSI-key-gated fallback Part A's PageSpeedInsightsFetcher uses for
 * the Overview page's own Overall Speed Score card). `main_issue` is
 * either a real Google Lighthouse opportunity-audit title (from that same
 * real PSI response) or a plain load-time-based label - never invented
 * text.
 *
 * @class       PageSpeedScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PageSpeedScanner {

    private const QUEUE_OPTION = 'vulopilot_page_speed_queue';

    private const BATCH_HOOK = 'vulopilot_page_speed_process_batch';

    /**
     * Real pages processed per batch tick - small enough that even the
     * PSI-enabled path (2 extra HTTP calls per page) comfortably finishes
     * within one WP-Cron request.
     */
    private const BATCH_SIZE = 3;

    /**
     * Real pages/posts/products enumerated per content type - bounds the
     * whole scan to a reasonable size on a large site.
     */
    private const MAX_PER_TYPE = 20;

    private const REQUEST_TIMEOUT_SECONDS = 10;

    /**
     * Response time, in seconds, above which a page is considered slow -
     * same real threshold SlowPageScanner already uses for the homepage.
     */
    private const SLOW_THRESHOLD_SECONDS = 2.0;

    /**
     * PageSpeedScanner constructor.
     */
    public function __construct() {
        add_action( self::BATCH_HOOK, array( $this, 'process_batch' ) );
    }

    /**
     * Enumerates real pages and seeds the queue for a fresh scan. Safe to
     * call again mid-scan - replaces whatever queue existed.
     *
     * @return array{queued: int}
     */
    public function start_scan(): array {
        $pages = $this->enumerate_pages();

        update_option( self::QUEUE_OPTION, $pages, false );

        ( new PageSpeedRepository() )->delete_missing( wp_list_pluck( $pages, 'url' ) );

        if ( ! empty( $pages ) && ! wp_next_scheduled( self::BATCH_HOOK ) ) {
            wp_schedule_single_event( time(), self::BATCH_HOOK );
        }

        return array(
            'queued' => count( $pages ),
        );
    }

    /**
     * Processes one batch of the queue, then reschedules itself if pages
     * remain. Registered on self::BATCH_HOOK, run via WP-Cron only - never
     * called synchronously from a REST request.
     *
     * @return void
     */
    public function process_batch(): void {
        $queue = (array) get_option( self::QUEUE_OPTION, array() );

        if ( empty( $queue ) ) {
            return;
        }

        $batch      = array_splice( $queue, 0, self::BATCH_SIZE );
        $repository = new PageSpeedRepository();
        $psi_key    = $this->get_psi_api_key();

        foreach ( $batch as $page ) {
            $this->check_page( $repository, $page, $psi_key );
        }

        update_option( self::QUEUE_OPTION, $queue, false );

        if ( ! empty( $queue ) ) {
            wp_schedule_single_event( time() + 20, self::BATCH_HOOK );
        }
    }

    /**
     * Times one real page, derives its score, and writes the result.
     *
     * @param PageSpeedRepository                                  $repository Repository to write the result to.
     * @param array{url: string, title: string, page_type: string} $page Real page to check.
     * @param string                                               $psi_key    Real PSI API key, or '' if none configured.
     * @return void
     */
    private function check_page( PageSpeedRepository $repository, array $page, string $psi_key ): void {
        $started_at = microtime( true );
        $response   = wp_remote_get(
            $page['url'],
            array(
                'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
                'sslverify' => false,
            )
        );
        $elapsed_ms = (int) round( ( microtime( true ) - $started_at ) * 1000 );

        if ( is_wp_error( $response ) ) {
            return;
        }

        $score      = $this->score_from_load_time( $elapsed_ms );
        $main_issue = $elapsed_ms > self::SLOW_THRESHOLD_SECONDS * 1000
            ? __( 'Slow server response', 'vulopilot' )
            : null;

        $mobile_score  = null;
        $desktop_score = null;

        // Field-data (real Chrome UX Report percentiles/ratings) and the
        // real Lighthouse page-weight/request-count audits - both come
        // from mobile's own PSI response when it has one, since the
        // mockup's own "Mobile ▾" toggle treats mobile as the default real
        // device to show; desktop's response is only consulted for
        // whichever of these mobile's response didn't have (a low-traffic
        // page can genuinely lack real CrUX field data for one device but
        // not the other).
        $psi_detail = array(
            'page_size_bytes' => null,
            'requests_count'  => null,
            'lcp_ms'          => null,
            'lcp_rating'      => null,
            'inp_ms'          => null,
            'inp_rating'      => null,
            'cls_thousandths' => null,
            'cls_rating'      => null,
        );

        if ( '' !== $psi_key ) {
            $mobile  = $this->fetch_psi( $psi_key, $page['url'], 'mobile' );
            $desktop = $this->fetch_psi( $psi_key, $page['url'], 'desktop' );

            $mobile_score  = $mobile['score'] ?? null;
            $desktop_score = $desktop['score'] ?? null;

            $psi_issue = $mobile['top_opportunity'] ?? ( $desktop['top_opportunity'] ?? null );

            if ( null !== $psi_issue ) {
                $main_issue = $psi_issue;
            }

            foreach ( $psi_detail as $key => $default_value ) {
                $psi_detail[ $key ] = $mobile[ $key ] ?? ( $desktop[ $key ] ?? null );
            }
        }

        $repository->replace_for_url(
            array_merge(
                array(
                    'url'           => $page['url'],
                    'title'         => $page['title'],
                    'page_type'     => $page['page_type'],
                    'load_time_ms'  => $elapsed_ms,
                    'score'         => $score,
                    'status'        => $this->status_from_score( $score ),
                    'mobile_score'  => $mobile_score,
                    'desktop_score' => $desktop_score,
                    'main_issue'    => $main_issue,
                    'scanned_at'    => current_time( 'mysql' ),
                ),
                $psi_detail
            )
        );
    }

    /**
     * Bands a real score into the same 'slow'/'needs_improvement'/'good'
     * thresholds PageSpeedRepository's own SCORE_GOOD/SCORE_NEEDS_IMPROVEMENT
     * constants define, stored redundantly as its own column purely so it's
     * filterable/countable the way every other AbstractRepository-backed
     * list's status column already is.
     *
     * @param int $score Real 0-100 score.
     * @return string 'slow'|'needs_improvement'|'good'.
     */
    private function status_from_score( int $score ): string {
        if ( $score >= PageSpeedRepository::SCORE_GOOD ) {
            return 'good';
        }

        if ( $score >= PageSpeedRepository::SCORE_NEEDS_IMPROVEMENT ) {
            return 'needs_improvement';
        }

        return 'slow';
    }

    /**
     * Linear score derived from a real measured load time, anchored so
     * SlowPageScanner's own real 2-second "slow" threshold lands at
     * exactly 50 - the Needs-Improvement/Poor boundary.
     *
     * @param int $load_time_ms Real measured response time, in milliseconds.
     * @return int 0-100.
     */
    private function score_from_load_time( int $load_time_ms ): int {
        return (int) max( 0, min( 100, 100 - ( $load_time_ms / 40 ) ) );
    }

    /**
     * Calls the real PageSpeed Insights API for one page/strategy.
     * `loadingExperience` (real CrUX field data) comes back automatically
     * whenever Google has it for this URL+strategy - no extra `category`
     * param needed to request it, unlike `lighthouseResult` which is
     * scoped to whichever `category` values are passed (just `performance`
     * here; accessibility/best-practices/seo audits aren't used by this
     * scanner, so they're not requested).
     *
     * @param string $api_key  Real PSI API key.
     * @param string $url      Real page URL to check.
     * @param string $strategy 'mobile' or 'desktop'.
     * @return array{score: int|null, top_opportunity: string|null, page_size_bytes: int|null, requests_count: int|null, lcp_ms: int|null, lcp_rating: string|null, inp_ms: int|null, inp_rating: string|null, cls_thousandths: int|null, cls_rating: string|null}|null Null if the request failed.
     */
    private function fetch_psi( string $api_key, string $url, string $strategy ): ?array {
        $request_url = add_query_arg(
            array(
                'url'      => rawurlencode( $url ),
                'key'      => $api_key,
                'strategy' => $strategy,
                'category' => 'performance',
            ),
            'https://www.googleapis.com/pagespeedonline/v5/runpagespeed'
        );

        $response = wp_remote_get( $request_url, array( 'timeout' => 30 ) );

        if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
            return null;
        }

        $body        = json_decode( wp_remote_retrieve_body( $response ), true );
        $raw_score   = $body['lighthouseResult']['categories']['performance']['score'] ?? null;
        $audits      = $body['lighthouseResult']['audits'] ?? array();
        $audits      = is_array( $audits ) ? $audits : array();
        $opportunity = $this->top_opportunity_title( $audits );
        $field_data  = is_array( $body['loadingExperience'] ?? null ) ? $body['loadingExperience'] : array();

        return array(
            'score'           => is_numeric( $raw_score ) ? (int) round( ( (float) $raw_score ) * 100 ) : null,
            'top_opportunity' => $opportunity,
            'page_size_bytes' => $this->audit_numeric_value( $audits, 'total-byte-weight' ),
            'requests_count'  => $this->count_network_requests( $audits ),
            'lcp_ms'          => $this->crux_percentile( $field_data, 'LARGEST_CONTENTFUL_PAINT_MS' ),
            'lcp_rating'      => $this->crux_category( $field_data, 'LARGEST_CONTENTFUL_PAINT_MS' ),
            'inp_ms'          => $this->crux_percentile( $field_data, 'INTERACTION_TO_NEXT_PAINT' ),
            'inp_rating'      => $this->crux_category( $field_data, 'INTERACTION_TO_NEXT_PAINT' ),
            'cls_thousandths' => $this->crux_percentile( $field_data, 'CUMULATIVE_LAYOUT_SHIFT_SCORE' ),
            'cls_rating'      => $this->crux_category( $field_data, 'CUMULATIVE_LAYOUT_SHIFT_SCORE' ),
        );
    }

    /**
     * A real Lighthouse audit's own `numericValue` (e.g. `total-byte-weight`,
     * in bytes) - null when that audit isn't present in this response.
     *
     * @param array<string, mixed> $audits Real `lighthouseResult.audits` from a PSI response.
     * @param string               $audit_id Audit id, e.g. 'total-byte-weight'.
     * @return int|null
     */
    private function audit_numeric_value( array $audits, string $audit_id ): ?int {
        $value = $audits[ $audit_id ]['numericValue'] ?? null;

        return is_numeric( $value ) ? (int) round( (float) $value ) : null;
    }

    /**
     * Real request count from the `network-requests` Lighthouse audit's
     * own `details.items` array - one real entry per network request
     * Lighthouse observed, not an estimate.
     *
     * @param array<string, mixed> $audits Real `lighthouseResult.audits` from a PSI response.
     * @return int|null
     */
    private function count_network_requests( array $audits ): ?int {
        $items = $audits['network-requests']['details']['items'] ?? null;

        return is_array( $items ) ? count( $items ) : null;
    }

    /**
     * A real CrUX field-data metric's own percentile value (ms for LCP/INP,
     * thousandths-of-a-unit for CLS per Google's own convention - a raw
     * CLS of 0.10 reports as percentile 10) - Google's own real measured
     * visitor experience for this URL, null when CrUX has no real field
     * data for it (a real "not enough traffic" case, not fabricated).
     *
     * @param array<string, mixed> $field_data Real `loadingExperience` block from a PSI response.
     * @param string                $metric_key e.g. 'LARGEST_CONTENTFUL_PAINT_MS'.
     * @return int|null
     */
    private function crux_percentile( array $field_data, string $metric_key ): ?int {
        $value = $field_data['metrics'][ $metric_key ]['percentile'] ?? null;

        return is_numeric( $value ) ? (int) round( (float) $value ) : null;
    }

    /**
     * That same real metric's own Google-assigned rating -
     * 'FAST'/'AVERAGE'/'SLOW', passed through verbatim rather than
     * re-derived from the percentile via this codebase's own thresholds,
     * since Google's own CrUX category boundaries differ per metric.
     *
     * @param array<string, mixed> $field_data Real `loadingExperience` block from a PSI response.
     * @param string                $metric_key e.g. 'LARGEST_CONTENTFUL_PAINT_MS'.
     * @return string|null
     */
    private function crux_category( array $field_data, string $metric_key ): ?string {
        $category = $field_data['metrics'][ $metric_key ]['category'] ?? null;

        return is_string( $category ) && '' !== $category ? $category : null;
    }

    /**
     * Picks the real Lighthouse audit with the greatest potential savings
     * (`numericValue` on an opportunity-type audit that scored below 0.9)
     * - a real signal from Google's own response, never invented.
     *
     * @param array<string, mixed> $audits Real `lighthouseResult.audits` from a PSI response.
     * @return string|null
     */
    private function top_opportunity_title( array $audits ): ?string {
        $best_title  = null;
        $best_saving = 0;

        foreach ( $audits as $audit ) {
            if ( ! is_array( $audit ) || ! isset( $audit['title'], $audit['score'] ) ) {
                continue;
            }

            if ( ! is_numeric( $audit['score'] ) || (float) $audit['score'] >= 0.9 ) {
                continue;
            }

            $saving = is_numeric( $audit['numericValue'] ?? null ) ? (float) $audit['numericValue'] : 0;

            if ( $saving >= $best_saving ) {
                $best_saving = $saving;
                $best_title  = (string) $audit['title'];
            }
        }

        return $best_title;
    }

    /**
     * Reads the real, site-owner-configured PSI API key.
     *
     * @return string Real `psi_api_key` setting value, or '' if unset.
     */
    private function get_psi_api_key(): string {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        return trim( (string) ( $settings['psi_api_key'] ?? '' ) );
    }

    /**
     * Enumerates real pages to check: the front page, every published
     * `page`, recent published `post`s, and - if WooCommerce is active -
     * the real shop/cart/checkout pages plus recent products and product
     * categories. Never fabricated URLs; every entry is a real permalink
     * for content that actually exists on this site.
     *
     * @return array<int, array{url: string, title: string, page_type: string}>
     */
    private function enumerate_pages(): array {
        $pages = array();
        $seen  = array();

        $add = function ( string $url, string $title, string $page_type ) use ( &$pages, &$seen ) {
            if ( '' === $url || isset( $seen[ $url ] ) ) {
                return;
            }

            $seen[ $url ] = true;
            $pages[]      = array(
                'url'       => $url,
                'title'     => '' !== $title ? $title : $url,
                'page_type' => $page_type,
            );
        };

        $add( home_url( '/' ), __( 'Homepage', 'vulopilot' ), 'homepage' );

        foreach ( get_posts(
            array(
				'post_type'      => 'page',
				'post_status'    => 'publish',
				'posts_per_page' => self::MAX_PER_TYPE,
				'orderby'        => 'modified',
				'order'          => 'DESC',
            )
        ) as $page ) { // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query, WordPress.Arrays.MultipleStatementAlignment.DoubleArrowNotAligned
            $add( (string) get_permalink( $page ), get_the_title( $page ), 'page' );
        }

        foreach ( get_posts(
            array(
				'post_type'      => 'post',
				'post_status'    => 'publish',
				'posts_per_page' => self::MAX_PER_TYPE,
				'orderby'        => 'date',
				'order'          => 'DESC',
            )
        ) as $post ) { // phpcs:ignore WordPress.Arrays.MultipleStatementAlignment.DoubleArrowNotAligned
            $add( (string) get_permalink( $post ), get_the_title( $post ), 'post' );
        }

        if ( class_exists( 'WooCommerce' ) && function_exists( 'wc_get_page_id' ) ) {
            $this->add_woocommerce_pages( $add );
        }

        return $pages;
    }

    /**
     * Adds real WooCommerce shop/cart/checkout pages, recent products, and
     * product categories to the enumeration.
     *
     * @param callable $add Closure that records one real (url, title, page_type) entry.
     * @return void
     */
    private function add_woocommerce_pages( callable $add ): void {
        $shop_page_id = wc_get_page_id( 'shop' );

        if ( $shop_page_id > 0 ) {
            $add( (string) get_permalink( $shop_page_id ), __( 'Shop', 'vulopilot' ), 'shop' );
        }

        $cart_page_id = wc_get_page_id( 'cart' );

        if ( $cart_page_id > 0 ) {
            $add( (string) get_permalink( $cart_page_id ), __( 'Cart', 'vulopilot' ), 'cart' );
        }

        $checkout_page_id = wc_get_page_id( 'checkout' );

        if ( $checkout_page_id > 0 ) {
            $add( (string) get_permalink( $checkout_page_id ), __( 'Checkout', 'vulopilot' ), 'checkout' );
        }

        if ( function_exists( 'wc_get_products' ) ) {
            $products = wc_get_products(
                array(
                    'status'  => 'publish',
                    'limit'   => self::MAX_PER_TYPE,
                    'orderby' => 'date',
                    'order'   => 'DESC',
                )
            );

            foreach ( $products as $product ) {
                $add( (string) $product->get_permalink(), $product->get_name(), 'product' );
            }
        }

        $terms = get_terms(
            array(
                'taxonomy'   => 'product_cat',
                'hide_empty' => true,
                'number'     => self::MAX_PER_TYPE,
            )
        );

        if ( ! is_wp_error( $terms ) ) {
            foreach ( $terms as $term ) {
                $add( (string) get_term_link( $term ), $term->name, 'category' );
            }
        }
    }
}

/**
 * Real, reversible effects for 2 of "Performance" Overview's 6 Quick
 * Actions (`classes/RestAPI/Controllers/PerformanceActions.php` only
 * flips the option; this class is what actually reads it on every real
 * request):
 *
 * - `vulopilot_force_lazy_loading` - when set, force-enables WordPress
 *   core's own native `loading="lazy"` behavior via the
 *   `wp_lazy_loading_enabled` filter, overriding any theme/plugin that
 *   disabled it (the exact condition LazyLoadingScanner flags).
 * - `vulopilot_preload_critical_resources` - when set, outputs real
 *   `<link rel="preload">` tags on `wp_head` for the site's custom logo
 *   and its first enqueued front-end stylesheet.
 *
 * @class       PerformanceOptimizations class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PerformanceOptimizations {

    /**
     * PerformanceOptimizations constructor.
     */
    public function __construct() {
        if ( get_option( 'vulopilot_force_lazy_loading' ) ) {
            add_filter( 'wp_lazy_loading_enabled', '__return_true', 999 );
        }

        add_action( 'wp_head', array( $this, 'maybe_output_preloads' ), 1 );
    }

    /**
     * @return void
     */
    public function maybe_output_preloads(): void {
        if ( ! get_option( 'vulopilot_preload_critical_resources' ) ) {
            return;
        }

        $logo_id = get_theme_mod( 'custom_logo' );

        if ( $logo_id ) {
            $logo_url = wp_get_attachment_image_url( (int) $logo_id, 'full' );

            if ( $logo_url ) {
                printf(
                    '<link rel="preload" as="image" href="%s" />' . "\n",
                    esc_url( $logo_url )
                );
            }
        }

        global $wp_styles;

        if ( $wp_styles instanceof \WP_Styles ) {
            foreach ( $wp_styles->queue as $handle ) {
                if ( empty( $wp_styles->registered[ $handle ]->src ) ) {
                    continue;
                }

                printf(
                    '<link rel="preload" as="style" href="%s" />' . "\n",
                    esc_url( $wp_styles->registered[ $handle ]->src )
                );
                break;
            }
        }
    }
}

/**
 * Real-time "Performance" telemetry - logs one response-time sample for
 * a real front-end request, the data RealTimeMonitoringCard.tsx's "Server
 * Response Time"/"Page Views (Last 5 Min)" tiles and MetricsGrid.tsx's
 * "Performance Monitor" tile all read via GET /performance-realtime.
 *
 * Deliberately logs **no visitor-identifying data at all** - no IP, no
 * user agent, no cookie-based session id. An earlier design considered
 * hashing IP+UA for a real "active users" count, but that conflicts with
 * this codebase's own stated privacy posture (Services\CrawlerTrafficLogger's
 * own docblock: "never an IP address... per readme.txt's own FAQ
 * promise"), and setting a cookie to track visitors would risk breaking
 * full-page-cache-plugin compatibility (a known page-cache gotcha) - the
 * one thing a *speed* feature must never do. "Active Users" is instead
 * honestly relabeled "Page Views (Last 5 Min)", a plain unique-free count.
 *
 * Hooked on `shutdown` (not `template_redirect`, which fires before the
 * template even renders) so `microtime(true) - $_SERVER['REQUEST_TIME_FLOAT']`
 * captures the full real request lifecycle. Requests served by a
 * full-page-cache plugin's early (pre-WP-bootstrap) drop-in never reach
 * this hook at all, so the resulting average reflects "server time for
 * non-cached requests" - real and useful, just narrower than every single
 * visit. ~20% sampled (`wp_rand()`) purely to bound write volume on
 * high-traffic sites, not for privacy (there's nothing sensitive in a
 * single integer). Daily cron purges rows older than 3 days - only the
 * last hour/5 minutes are ever displayed; the long-term trend is a
 * separate concern (Services\PerformanceScoreSnapshotRecorder).
 *
 * @class       PerformanceRequestLogger class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PerformanceRequestLogger {

    private const CLEANUP_HOOK = 'vulopilot_performance_request_cleanup';

    private const SAMPLE_RATE = 5; // 1 in 5 real requests, ~20%.

    private const RETENTION_DAYS = 3;

    /**
     * PerformanceRequestLogger constructor.
     */
    public function __construct() {
        add_action( 'shutdown', array( $this, 'maybe_log' ) );
        add_action( 'init', array( $this, 'ensure_cleanup_scheduled' ) );
        add_action( self::CLEANUP_HOOK, array( $this, 'run_cleanup' ) );
    }

    /**
     * @return void
     */
    public function maybe_log(): void {
        if ( ! $this->is_real_front_end_request() ) {
            return;
        }

        if ( 1 !== wp_rand( 1, self::SAMPLE_RATE ) ) {
            return;
        }

        if ( empty( $_SERVER['REQUEST_TIME_FLOAT'] ) ) {
            return;
        }

        $response_time_ms = (int) round( ( microtime( true ) - (float) $_SERVER['REQUEST_TIME_FLOAT'] ) * 1000 );

        if ( $response_time_ms <= 0 || $response_time_ms > 65535 ) {
            // Out of the column's smallint unsigned range, or clearly
            // bogus (a clock anomaly) - skip rather than truncate silently.
            return;
        }

        ( new PerformanceRequestRepository() )->insert( array( 'response_time_ms' => $response_time_ms ) );
    }

    /**
     * @return bool
     */
    private function is_real_front_end_request(): bool {
        return ! is_admin()
            && ! wp_doing_ajax()
            && ! wp_doing_cron()
            && ! ( defined( 'REST_REQUEST' ) && REST_REQUEST )
            && ! ( defined( 'WP_CLI' ) && WP_CLI )
            && ! is_feed();
    }

    /**
     * Standard wp_next_scheduled()-guarded wp_schedule_event() pattern -
     * same shape Services\CrawlerTrafficLogger already uses.
     *
     * @return void
     */
    public function ensure_cleanup_scheduled(): void {
        if ( ! wp_next_scheduled( self::CLEANUP_HOOK ) ) {
            wp_schedule_event( time(), 'daily', self::CLEANUP_HOOK );
        }
    }

    /**
     * @return void
     */
    public function run_cleanup(): void {
        ( new PerformanceRequestRepository() )->delete_older_than( self::RETENTION_DAYS );
    }
}

/**
 * Writes today's real performance-category score into
 * `vulopilot_score_snapshots` (category `performance`) - the data SpeedHistoryCard.tsx's
 * chart reads. Hooked on `vulopilot_scan_completed` at priority 20 (after
 * Services\ScanPersistenceListener's own default-priority-10 handler has
 * already written that scanner's findings to the database) so the score
 * this recomputes reflects the findings that scan just produced; a
 * `run_all()` scan fires this once per scanner, which means it recomputes
 * and upserts several times in a row during a full scan - harmless
 * (idempotent, cheap single-row upsert) and simpler than inspecting each
 * ScanResult's own category to skip non-'performance' runs, since the
 * final call in the sequence always leaves the correct value either way.
 * A daily cron is a second write path, so the trend stays continuous even
 * on days nobody manually triggers a scan - the score itself is always
 * computed live from current open findings, the same way GET /dashboard's
 * `category_scores.performance` already is (Dashboard.php's own
 * calculate_category_score(), whose weighting is duplicated here rather
 * than made reusable there - same "duplicate small shared logic across
 * scopes" precedent this session's ContentIntelligence.php work already
 * used).
 *
 * @class       PerformanceScoreSnapshotRecorder class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PerformanceScoreSnapshotRecorder {

    private const CRON_HOOK = 'vulopilot_performance_snapshot_daily';

    /**
     * PerformanceScoreSnapshotRecorder constructor.
     */
    public function __construct() {
        add_action( 'vulopilot_scan_completed', array( $this, 'record_today' ), 20 );
        add_action( 'init', array( $this, 'ensure_daily_snapshot_scheduled' ) );
        add_action( self::CRON_HOOK, array( $this, 'record_today' ) );
    }

    /**
     * @return void
     */
    public function record_today(): void {
        $findings  = new FindingRepository();
        $breakdown = $findings->get_severity_breakdown_for_category( 'performance' );

        $score = 100
            - ( $breakdown['critical'] * 15 )
            - ( $breakdown['high'] * 8 )
            - ( $breakdown['medium'] * 3 )
            - ( $breakdown['low'] * 1 );

        $score = max( 0, min( 100, $score ) );

        ( new ScoreSnapshotRepository( 'performance' ) )->upsert_today( $score );
    }

    /**
     * Standard wp_next_scheduled()-guarded wp_schedule_event() pattern -
     * same shape Services\CrawlerTrafficLogger already uses.
     *
     * @return void
     */
    public function ensure_daily_snapshot_scheduled(): void {
        if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
            wp_schedule_event( time(), 'daily', self::CRON_HOOK );
        }
    }
}

/**
 * VuloPilot ScanPersistenceListener class.
 *
 * The first real occupant of the "Services" layer ARCHITECTURE.md
 * describes - self-hooks `vulopilot_scan_completed` (fired by
 * Scanners\ScanRunner, which deliberately never persists anything itself;
 * see its own docblock) and is the thing that turns a ScanResult into
 * real vulopilot_scans/vulopilot_scan_findings rows. Neither ScanRunner
 * nor RuleEngine has any idea this class exists - the hook is the only
 * coupling, same one-way-dependency shape used throughout.
 *
 * Fires `vulopilot_scan_persisted` after its own persistence work - the
 * seam vulopilot-pro's AdvancedReports module hooks to recalculate and
 * upsert today's site-health snapshot (historical trend data is Pro
 * business logic; this class only owns "did the scan's own rows get
 * written," not what anyone else derives from that afterward).
 *
 * @class       ScanPersistenceListener class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ScanPersistenceListener {

    /**
     * Scanner ids that never dedupe on rescan - always inserted fresh,
     * every run, even if the exact same object_type/object_ref/title
     * combination is already open. This used to be an ALLOWLIST (only
     * `broken-links`/`broken-images`, later also `core-file-integrity`,
     * deduped; every other scanner always inserted fresh) - flipped to a
     * denylist after a real environment showed the allowlist approach
     * doesn't scale: virtually every scanner that re-checks a bounded,
     * identifiable set of objects (posts, plugins, themes, URLs, ...) hits
     * the identical pileup broken-links was originally fixed for, just
     * under a different scanner_id each time (basic-vulnerabilities,
     * canonical-url, thin-content, meta-description, seo, geo-author-info,
     * geo-trust-signals, internal-linking, seo-images, images, plugins,
     * themes, cdn, and more - confirmed live, up to 24 duplicate open rows
     * for one object). Deduping is now the default for every scanner,
     * regardless of whether a finding carries a real `object_type`/
     * `object_ref` - find_open_duplicate() matches those two columns
     * NULL-safely, so a purely sitewide check with nothing to match on
     * (e.g. `php-warnings`) dedupes on `scanner_id`+`title` alone the same
     * way an object-scoped finding dedupes on the full four-column key.
     * This list only exists for a scanner that genuinely wants more than
     * one simultaneously-open row for the same object+title - none do
     * today, but the mechanism stays available rather than assuming
     * that'll never be true.
     *
     * @var string[]
     */
    private const NEVER_DEDUPE_ON_RESCAN = array();

    /**
     * Maps a "Notify me about" checklist type (Settings → Notifications →
     * Website Alerts, 'critical_alert_types') to the real finding
     * categories that back it. A category not listed here (e.g.
     * 'woocommerce', 'database', 'links') falls under the 'other' catch-all
     * instead of its own checkbox - see that setting's own Utill.php
     * docblock.
     *
     * @var array<string, string[]>
     */
    private const CRITICAL_ALERT_CATEGORIES = array(
        'security'     => array( 'security', 'ssl' ),
        'availability' => array( 'availability' ),
        'performance'  => array( 'performance' ),
        'seo'          => array( 'seo', 'geo' ),
    );

    /**
     * Real scanner categories `maybe_log_security_scan_activity()` scopes
     * to - same 'security'/'ssl' pairing CRITICAL_ALERT_CATEGORIES['security']
     * already uses (SslMonitoringScanner's own real category is 'ssl', not
     * 'security').
     *
     * @var string[]
     */
    private const SECURITY_SCOPED_CATEGORIES = array( 'security', 'ssl' );

    /**
     * @var ScanRepository
     */
    private ScanRepository $scans;

    /**
     * @var FindingRepository
     */
    private FindingRepository $findings;

    /**
     * @var ActivityLogRepository
     */
    private ActivityLogRepository $activity_logs;

    /**
     * ScanPersistenceListener constructor.
     */
    public function __construct() {
        $this->scans         = new ScanRepository();
        $this->findings      = new FindingRepository();
        $this->activity_logs = new ActivityLogRepository();

        add_action( 'vulopilot_scan_completed', array( $this, 'handle_scan_completed' ) );
    }

    /**
     * @param ScanResult $scan_result The completed scan.
     * @return void
     */
    public function handle_scan_completed( ScanResult $scan_result ): void {
        $scan_id = $this->scans->insert(
            array(
                'scanner_id'      => $scan_result->get_scanner_id(),
                'status'          => $scan_result->get_status(),
                'duration_ms'     => (int) $scan_result->get_duration_ms(),
                'summary'         => wp_json_encode( $scan_result->get_summary() ),
                'scanned_objects' => wp_json_encode( $scan_result->get_scanned_post_ids() ),
                'error_message'   => $scan_result->get_error_message(),
                'started_at'      => current_time( 'mysql', true ),
                'finished_at'     => current_time( 'mysql', true ),
            )
        );

        // Real auto-resolve step (see this method's own end, after the
        // loop, for why) - every id this scanner currently has open,
        // captured BEFORE this run touches anything, so it's a clean
        // "what was open coming in" snapshot to diff against once the
        // loop below finishes. A row this loop refreshes (still a real,
        // ongoing problem) gets removed from this set as it's touched;
        // whatever's left at the end genuinely wasn't reproduced by this
        // run and gets marked resolved.
        $previously_open_ids = ! in_array( $scan_result->get_scanner_id(), self::NEVER_DEDUPE_ON_RESCAN, true )
            ? array_flip( $this->findings->get_open_finding_ids_for_scanner( $scan_result->get_scanner_id() ) )
            : array();

        foreach ( $scan_result->get_findings() as $finding ) {
            $duplicate = ! in_array( $scan_result->get_scanner_id(), self::NEVER_DEDUPE_ON_RESCAN, true )
                ? $this->findings->find_open_duplicate(
                    $scan_result->get_scanner_id(),
                    $finding->get_object_type(),
                    $finding->get_object_ref(),
                    $finding->get_title(),
                    $finding->get_dedupe_key()
                )
                : null;

            if ( null !== $duplicate ) {
                // Same problem is still present as of this run - refresh
                // the existing open row's own scan-run-specific fields
                // rather than inserting a second identical one (see
                // FindingRepository::find_open_duplicate()'s own
                // docblock). `created_at`/`id` deliberately untouched, so
                // this stays "first detected" for the finding, not
                // "detected again" - real historical queries
                // (get_severity_breakdown_for_category_as_of() and
                // friends) depend on `created_at` meaning that. `last_seen_at`
                // DOES move to this run's timestamp, though: it's what the
                // Issues table's "Affected" list actually displays
                // ("Detected {date}"), so a still-open, still-recurring
                // finding shows when it was last reconfirmed rather than
                // looking stale the moment it was first found. `title`
                // DOES move too (unlike everything above, this wasn't true
                // before `dedupe_key` existed): a finding matched via a
                // stable `dedupe_key` can have a `title` that legitimately
                // drifts every run (a word count, a score) - refreshing it
                // here is what keeps the number a site owner sees current
                // instead of frozen at whatever it was on first detection.
                $this->findings->update(
                    (int) $duplicate['id'],
                    array(
                        'scan_id'      => $scan_id,
                        'severity'     => $finding->get_severity(),
                        'category'     => $finding->get_category(),
                        'title'        => $finding->get_title(),
                        'description'  => $finding->get_description(),
                        'meta'         => wp_json_encode( $finding->get_meta() ),
                        'last_seen_at' => current_time( 'mysql', true ),
                    )
                );
                unset( $previously_open_ids[ (int) $duplicate['id'] ] );
                continue;
            }

            $new_finding_id = $this->findings->insert(
                array(
                    'scan_id'     => $scan_id,
                    'scanner_id'  => $scan_result->get_scanner_id(),
                    'severity'    => $finding->get_severity(),
                    'category'    => $finding->get_category(),
                    'title'       => $finding->get_title(),
                    'description' => $finding->get_description(),
                    'object_type' => $finding->get_object_type(),
                    'object_ref'  => $finding->get_object_ref(),
                    'dedupe_key'  => $finding->get_dedupe_key(),
                    'meta'        => wp_json_encode( $finding->get_meta() ),
                )
            );

            /**
             * Fires only for a genuinely NEW finding - the branch above
             * (an existing open duplicate refreshed instead) never reaches
             * here, so a still-recurring problem doesn't re-fire this on
             * every scan. vulopilot-pro's Automations\Triggers\
             * NewFindingTrigger's own extension point - "trigger decides
             * WHEN, conditions decide whether to continue" (same posture
             * every other trigger in that registry already follows): this
             * fires for every new finding regardless of severity/category,
             * and a real automation narrows it down to "critical" or
             * "broken link" etc. via its own existing min-priority/
             * category/min-impact conditions, same GEO/security/visibility
             * score-drop triggers' own "no built-in threshold" posture,
             * rather than this codebase growing a separate hardcoded
             * trigger per severity/category combination.
             *
             * @param int    $finding_id  The just-inserted `vulopilot_findings` row id.
             * @param string $severity    Severity::* constant.
             * @param string $category    Real finding category.
             * @param string|null $object_type From the triggering Finding, if any.
             * @param string|null $object_ref  From the triggering Finding, if any.
             */
            do_action(
                'vulopilot_finding_created',
                $new_finding_id,
                $finding->get_severity(),
                $finding->get_category(),
                $finding->get_object_type(),
                $finding->get_object_ref()
            );
        }

        // Auto-resolve every finding this scanner previously had open that
        // this run didn't reproduce - real, confirmed live: a stale
        // "WordPress core update available" row (and, separately, a stale
        // malware-scanner false positive) kept showing as open in Issues
        // days after the real underlying problem was gone, because nothing
        // anywhere in this codebase ever marked a finding resolved just
        // because a later scan stopped finding it - `find_open_duplicate()`
        // above only ever refreshes or inserts, never closes. Every real
        // scan run here checks its whole relevant scope fresh each time
        // (ScanRunner::run() takes no partial/subset argument), so
        // "previously open, not reproduced this run" reliably means fixed,
        // not "wasn't checked this time." Only runs for a genuinely
        // completed scan - a failed run (`STATUS_FAILED`, e.g. a fatal
        // mid-scan) didn't actually finish verifying anything, so it
        // must never be read as "nothing's wrong anymore."
        if ( ScanResult::STATUS_COMPLETED === $scan_result->get_status() ) {
            foreach ( array_keys( $previously_open_ids ) as $stale_id ) {
                $this->findings->update(
                    $stale_id,
                    array(
                        'status'      => 'resolved',
                        'resolved_at' => current_time( 'mysql', true ),
                    )
                );
            }
        }

        $this->activity_logs->log(
            'scan.completed',
            sprintf(
                /* translators: 1: scanner id, 2: number of findings. */
                __( 'Scan "%1$s" completed with %2$d finding(s).', 'vulopilot' ),
                $scan_result->get_scanner_id(),
                count( $scan_result->get_findings() )
            ),
            ScanResult::STATUS_FAILED === $scan_result->get_status() ? Severity::HIGH : Severity::INFO,
            'system',
            'scan',
            (string) $scan_id
        );

        $this->maybe_log_security_scan_activity( $scan_result, $scan_id );
        $this->maybe_notify_critical_findings( $scan_result );

        /**
         * Fires after a scan's own rows are persisted - vulopilot-pro's
         * AdvancedReports module hooks this to recalculate and upsert
         * today's site-health snapshot (historical trend data). Free
         * itself doesn't do anything with $scan_id beyond handing it out;
         * a hooked callback can re-query FindingRepository itself for
         * current open-finding counts, the same way this class used to.
         *
         * @param ScanResult $scan_result The completed scan.
         * @param int        $scan_id     The just-inserted `vulopilot_scans` row id.
         */
        do_action( 'vulopilot_scan_persisted', $scan_result, $scan_id );
    }

    /**
     * A second, additional real activity-log row for the exact same
     * completion this method's caller just logged as the generic
     * 'scan.completed' event - under a distinct, always-on event type
     * ('scan.completed.security') whenever the just-completed scanner's
     * own real category is security-relevant (SECURITY_SCOPED_CATEGORIES
     * above). What "Security" tab's own RecentActivityCard.tsx needs to
     * filter on: the Pro-only 'security.alert' event type
     * (vulopilot-pro\SecurityMonitoring\AlertDispatcher) only exists with
     * an active Pro license AND the site's own `security_alerts_enabled`
     * setting turned on (default off) - meaning on Free-only installs,
     * unlicensed Pro installs, and licensed-but-unconfigured Pro installs
     * (the large majority of real sites), that card would stay
     * permanently empty no matter how many open security findings exist.
     * This fires every real security-category scan completion, findings
     * or not, zero configuration required - resolved via the real
     * ScannerRegistry singleton (`VuloPilot()->scanner_registry`, already
     * populated by the time any real scan can complete - scans only ever
     * run well after `init` priority 20) rather than the completed scan's
     * own findings, so a clean scan (0 findings) still logs real activity
     * instead of this card only ever showing up when something's wrong.
     *
     * @param ScanResult $scan_result The completed scan.
     * @param int        $scan_id     The just-inserted `vulopilot_scans` row id.
     * @return void
     */
    private function maybe_log_security_scan_activity( ScanResult $scan_result, int $scan_id ): void {
        $scanner = VuloPilot()->scanner_registry->get_scanner( $scan_result->get_scanner_id() );

        if ( ! $scanner || ! in_array( $scanner->get_category(), self::SECURITY_SCOPED_CATEGORIES, true ) ) {
            return;
        }

        $this->activity_logs->log(
            'scan.completed.security',
            sprintf(
                /* translators: 1: scanner id, 2: number of findings. */
                __( 'Scan "%1$s" completed with %2$d finding(s).', 'vulopilot' ),
                $scan_result->get_scanner_id(),
                count( $scan_result->get_findings() )
            ),
            ScanResult::STATUS_FAILED === $scan_result->get_status() ? Severity::HIGH : Severity::INFO,
            'system',
            'scan',
            (string) $scan_id
        );
    }

    /**
     * Emails the site's notification address when this scan raised any
     * critical-severity finding, gated behind the Settings screen's
     * Notifications tab (`notify_on_critical_findings`, default off - this
     * is opt-in, not a change to a previously-silent default).
     *
     * @param ScanResult $scan_result The completed scan.
     * @return void
     */
    private function maybe_notify_critical_findings( ScanResult $scan_result ): void {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['notify_on_critical_findings'] ) ) {
            return;
        }

        $enabled_types = (array) ( $settings['critical_alert_types'] ?? array() );

        $critical_findings = array_values(
            array_filter(
                $scan_result->get_findings(),
                fn( Finding $finding ) =>
                    Severity::CRITICAL === $finding->get_severity()
                    && $this->is_critical_alert_type_enabled( $finding->get_category(), $enabled_types )
            )
        );

        if ( empty( $critical_findings ) ) {
            return;
        }

        $message = implode(
            "\n",
            array_map(
                static fn( Finding $finding ): string => '- ' . $finding->get_title(),
                $critical_findings
            )
        );

        $channels = (array) ( $settings['alert_channels'] ?? array() );

        if ( in_array( 'dashboard', $channels, true ) ) {
            $this->activity_logs->log(
                'critical_alert',
                sprintf(
                    /* translators: %d is the number of critical findings. */
                    __( 'VuloPilot found %d critical issue(s).', 'vulopilot' ),
                    count( $critical_findings )
                ),
                'critical',
                'system'
            );
        }

        if ( ! in_array( 'email', $channels, true ) ) {
            return;
        }

        $recipient = $settings['notification_email'] ?: get_option( 'admin_email' );
        $headers   = array();

        if ( ! empty( $settings['email_from_address'] ) && is_email( $settings['email_from_address'] ) ) {
            $from_name = $settings['email_from_name'] ?: get_bloginfo( 'name' );
            $headers[] = sprintf( 'From: %s <%s>', $from_name, $settings['email_from_address'] );
        }

        wp_mail(
            $recipient,
            sprintf(
                /* translators: 1: site name, 2: number of critical findings. */
                __( '[%1$s] VuloPilot found %2$d critical issue(s)', 'vulopilot' ),
                get_bloginfo( 'name' ),
                count( $critical_findings )
            ),
            $message,
            $headers
        );
    }

    /**
     * Whether $category is allowed to alert, per the "Notify me about" checklist.
     *
     * @param string   $category      The finding's own real category.
     * @param string[] $enabled_types Enabled 'critical_alert_types' values.
     * @return bool
     */
    private function is_critical_alert_type_enabled( string $category, array $enabled_types ): bool {
        foreach ( self::CRITICAL_ALERT_CATEGORIES as $type => $categories ) {
            if ( in_array( $category, $categories, true ) ) {
                return in_array( $type, $enabled_types, true );
            }
        }

        return in_array( 'other', $enabled_types, true );
    }
}

/**
 * Writes today's real security-category score into
 * `vulopilot_score_snapshots` (category `security`) - the data SecurityTrendCard.tsx's
 * chart reads. Not a reuse of `vulopilot_site_health_snapshots` - that
 * table's own `security_score` column is only ever written by Pro's
 * AdvancedReports module, so a Free-tier "Security Trend" card can't
 * depend on it (would stay empty on any site without that Pro module
 * active). Same trigger shape, same weighting, and same idempotent-upsert
 * reasoning as Services\PerformanceScoreSnapshotRecorder - hooked on
 * `vulopilot_scan_completed` at priority 20 (after
 * Services\ScanPersistenceListener's own default-priority-10 handler has
 * already written that scanner's findings) plus a daily cron so the trend
 * stays continuous even on days nobody triggers a scan. The score itself
 * is always computed live from current open findings, the same weighting
 * `Dashboard.php`'s own `calculate_category_score()` uses for
 * `category_scores.security` - duplicated here rather than made reusable
 * there, same "duplicate small shared logic across scopes" precedent
 * PerformanceScoreSnapshotRecorder's own docblock already documents.
 *
 * @class       SecurityScoreSnapshotRecorder class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SecurityScoreSnapshotRecorder {

    private const CRON_HOOK = 'vulopilot_security_snapshot_daily';

    /**
     * SecurityScoreSnapshotRecorder constructor.
     */
    public function __construct() {
        add_action( 'vulopilot_scan_completed', array( $this, 'record_today' ), 20 );
        add_action( 'init', array( $this, 'ensure_daily_snapshot_scheduled' ) );
        add_action( self::CRON_HOOK, array( $this, 'record_today' ) );
    }

    /**
     * @return void
     */
    public function record_today(): void {
        $findings  = new FindingRepository();
        $breakdown = $findings->get_severity_breakdown_for_category( 'security' );

        $score = 100
            - ( $breakdown['critical'] * 15 )
            - ( $breakdown['high'] * 8 )
            - ( $breakdown['medium'] * 3 )
            - ( $breakdown['low'] * 1 );

        $score = max( 0, min( 100, $score ) );

        $repository     = new ScoreSnapshotRepository( 'security' );
        $previous_score = $this->find_previous_score( $repository );

        $repository->upsert_today( $score );

        /**
         * Fires after today's security-category score snapshot is written
         * - vulopilot-pro's Automations\Triggers\SecurityScoreDropTrigger
         * own extension point, same "fire the real number plus what it was
         * compared against" shape GeoInsights\VisibilitySnapshotBuilder's
         * own `vulopilot_pro_geo_visibility_snapshot_built` action already
         * established.
         *
         * @param int      $score          Today's real security_score (0-100).
         * @param int|null $previous_score The most recent prior day's security_score, or null before this site has a second day of history.
         */
        do_action( 'vulopilot_security_score_recorded', $score, $previous_score );
    }

    /**
     * @param ScoreSnapshotRepository $repository Repository to read history from.
     * @return int|null The most recent snapshot strictly before today, or null if none exists yet.
     */
    private function find_previous_score( ScoreSnapshotRepository $repository ): ?int {
        $today = current_time( 'Y-m-d' );

        foreach ( array_reverse( $repository->get_recent( 7 ) ) as $row ) {
            if ( $today !== $row['snapshot_date'] ) {
                return (int) $row['security_score'];
            }
        }

        return null;
    }

    /**
     * Standard wp_next_scheduled()-guarded wp_schedule_event() pattern -
     * same shape Services\PerformanceScoreSnapshotRecorder already uses.
     *
     * @return void
     */
    public function ensure_daily_snapshot_scheduled(): void {
        if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
            wp_schedule_event( time(), 'daily', self::CRON_HOOK );
        }
    }
}
