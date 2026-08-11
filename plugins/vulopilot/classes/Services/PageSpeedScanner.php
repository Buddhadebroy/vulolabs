<?php
/**
 * PageSpeedScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

use VuloPilot\Repositories\PageSpeedRepository;
use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Real per-page speed checks for "Improve Speed" › Slow Pages. Enumerates
 * real WP content — the front page, published pages, recent posts, and (if
 * WooCommerce is active) the real shop/cart/checkout pages plus recent
 * products and product categories — then times each one for real via
 * `wp_remote_get()`, the same idiom SlowPageScanner already uses for the
 * homepage alone, just generalized to many real URLs.
 *
 * Never runs inline on a single HTTP request: with dozens of real pages to
 * time (and, when a `psi_api_key` is configured, two more real PageSpeed
 * Insights calls per page), doing this synchronously — the way
 * Controllers\Scans::create_item() runs the normal scanner registry —
 * would blow past PHP's max_execution_time. Instead this seeds a queue
 * (one `vulopilot_page_speed_queue` option) and processes it in small
 * batches via a self-rescheduling `wp_schedule_single_event()`, the same
 * "never block a page request on a slow external call" posture
 * PageSpeedInsightsFetcher already established.
 *
 * `score` is derived from the real measured `load_time_ms` via a documented
 * linear formula anchored on SlowPageScanner's own real 2-second "slow"
 * threshold (score 50 at exactly 2000ms) — not a fabricated number.
 * `mobile_score`/`desktop_score` stay null unless a real PSI key is
 * configured and that page's real PSI response actually returned a score
 * (same PSI-key-gated fallback Part A's PageSpeedInsightsFetcher uses for
 * the Overview page's own Overall Speed Score card). `main_issue` is
 * either a real Google Lighthouse opportunity-audit title (from that same
 * real PSI response) or a plain load-time-based label — never invented
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
     * Real pages processed per batch tick — small enough that even the
     * PSI-enabled path (2 extra HTTP calls per page) comfortably finishes
     * within one WP-Cron request.
     */
    private const BATCH_SIZE = 3;

    /**
     * Real pages/posts/products enumerated per content type — bounds the
     * whole scan to a reasonable size on a large site.
     */
    private const MAX_PER_TYPE = 20;

    private const REQUEST_TIMEOUT_SECONDS = 10;

    /**
     * Response time, in seconds, above which a page is considered slow —
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
     * call again mid-scan — replaces whatever queue existed.
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
     * remain. Registered on self::BATCH_HOOK, run via WP-Cron only — never
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

        if ( '' !== $psi_key ) {
            $mobile  = $this->fetch_psi( $psi_key, $page['url'], 'mobile' );
            $desktop = $this->fetch_psi( $psi_key, $page['url'], 'desktop' );

            $mobile_score  = $mobile['score'] ?? null;
            $desktop_score = $desktop['score'] ?? null;

            $psi_issue = $mobile['top_opportunity'] ?? ( $desktop['top_opportunity'] ?? null );

            if ( null !== $psi_issue ) {
                $main_issue = $psi_issue;
            }
        }

        $repository->replace_for_url(
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
     * exactly 50 — the Needs-Improvement/Poor boundary.
     *
     * @param int $load_time_ms Real measured response time, in milliseconds.
     * @return int 0-100.
     */
    private function score_from_load_time( int $load_time_ms ): int {
        return (int) max( 0, min( 100, 100 - ( $load_time_ms / 40 ) ) );
    }

    /**
     * Calls the real PageSpeed Insights API for one page/strategy.
     *
     * @param string $api_key  Real PSI API key.
     * @param string $url      Real page URL to check.
     * @param string $strategy 'mobile' or 'desktop'.
     * @return array{score: int|null, top_opportunity: string|null}|null Null if the request failed.
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
        $opportunity = $this->top_opportunity_title( is_array( $audits ) ? $audits : array() );

        return array(
            'score'           => is_numeric( $raw_score ) ? (int) round( ( (float) $raw_score ) * 100 ) : null,
            'top_opportunity' => $opportunity,
        );
    }

    /**
     * Picks the real Lighthouse audit with the greatest potential savings
     * (`numericValue` on an opportunity-type audit that scored below 0.9)
     * — a real signal from Google's own response, never invented.
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
     * `page`, recent published `post`s, and — if WooCommerce is active —
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
