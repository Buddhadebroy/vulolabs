<?php
/**
 * CrawlerTraffic controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\CrawlerVisitRepository;
use VuloPilot\Repositories\FindingRepository;

defined( 'ABSPATH' ) || exit;

/**
 * Backs src/pages/CrawlerTraffic/CrawlerTraffic.tsx (AI Crawler Traffic
 * Monitoring, readme.txt). `GET /crawler-traffic` is the paginated raw
 * visit log + filter-pill bar, same shape as ActivityLogs.php.
 * `GET /crawler-traffic/summary` is a separate, lightweight route for the
 * page's aggregate section (last-seen per bot, most-crawled pages, daily
 * volume) rather than bloating the paginated list response.
 *
 * @class       CrawlerTraffic controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class CrawlerTraffic extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'crawler-traffic';

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

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/summary',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_summary' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
            )
        );

        // GET-only, real current-vs-previous-period comparison — backs the
        // restyled Crawler Traffic tab's stat row + Top Crawlers/Most
        // Crawled Pages tables (CrawlerVisitRepository::get_period_comparison()'s
        // own docblock). Composed here rather than in the repository
        // because it needs FindingRepository's own real blocked-pages count
        // too — a repository shouldn't reach into a sibling table.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/analytics',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_analytics' ),
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
        $repository = new CrawlerVisitRepository();

        $result                    = $repository->find_all(
            array(
                'page'     => absint( $request->get_param( 'page' ) ) ?: 1,
                'per_page' => absint( $request->get_param( 'per_page' ) ) ?: 20,
                'bot_name' => sanitize_text_field( (string) $request->get_param( 'bot_name' ) ),
                'search'   => sanitize_text_field( (string) $request->get_param( 'search' ) ),
                'orderby'  => sanitize_key( (string) $request->get_param( 'orderby' ) ),
                'order'    => sanitize_key( (string) $request->get_param( 'order' ) ),
            )
        );
        $result['bot_name_counts'] = $repository->get_bot_counts();

        return rest_ensure_response( $result );
    }

    /**
     * `GET /crawler-traffic/analytics` — real current-vs-previous-period
     * comparison (CrawlerVisitRepository::get_period_comparison()) plus a
     * real "by AI lab" breakdown and the real open blocked-pages count.
     * There's deliberately no "search engines vs AI engines" split here the
     * way the reference mockup's own "Crawler Types" donut shows — this
     * plugin's own BOT_SIGNATURES list (CrawlerTrafficLogger's own
     * docblock) only ever detects AI/answer-engine crawlers, never classic
     * search engines, so every real row would land in one bucket and the
     * other two would always read zero. Grouped by AI lab instead (the
     * vendor name each bot's own display string already carries in
     * parentheses, e.g. "GPTBot (OpenAI)" → "OpenAI") — a real, meaningful
     * split of the traffic this plugin actually tracks.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_analytics( $request ) {
        $days       = absint( $request->get_param( 'days' ) ) ?: 30;
        $repository = new CrawlerVisitRepository();
        $comparison = $repository->get_period_comparison( $days );

        $by_vendor = array();
        foreach ( $comparison['top_crawlers'] as $crawler ) {
            $vendor = $crawler['bot_name'];
            if ( preg_match( '/\(([^)]+)\)\s*$/', $crawler['bot_name'], $matches ) ) {
                $vendor = $matches[1];
            }
            $by_vendor[ $vendor ] = ( $by_vendor[ $vendor ] ?? 0 ) + $crawler['total'];
        }
        arsort( $by_vendor );

        $findings             = new FindingRepository();
        $blocked_pages_total  = $findings->find_all(
            array(
                'scanner_id' => 'ai-crawler-blocked-pages',
                'status'     => 'open',
                'per_page'   => 1,
            )
        )['total'];

        // Same real weighted-severity formula Controllers\Seo::calculate_score()/
        // Controllers\Geo::calculate_score() already use, scoped to the exact
        // same 4 real scanner ids CrawlerAnalyticsSection.tsx's own
        // CHECKLIST_ITEMS already groups its "Crawl Health Checklist" into
        // (robots.txt reachable, sitemap reachable, no critical AI-bot
        // blocks) — one real number standing in for what that checklist
        // already shows as 3 separate pass/fail rows, for the mockup's own
        // "Overall Crawl Health" ring. Frontend only renders this ring while
        // the SEO module is active (same `isSeoModuleActive()` gate the
        // checklist itself already requires) — these scanners simply never
        // run otherwise, so 0 open findings there would be a false "100",
        // not a real one.
        $crawl_scanner_ids   = array( 'robots-txt', 'sitemap', 'sitemap-validation', 'ai-crawler-blocked-pages' );
        $crawl_health_score  = $this->calculate_score( $findings->get_severity_breakdown_for_scanner_ids( $crawl_scanner_ids ) );

        return rest_ensure_response(
            array_merge(
                $comparison,
                array(
                    'by_vendor'            => $by_vendor,
                    'blocked_pages_total'  => (int) $blocked_pages_total,
                    'daily_volume'         => $repository->get_daily_volume( $days ),
                    'crawl_health_score'   => $crawl_health_score,
                )
            )
        );
    }

    /**
     * Same weighting `Controllers\Seo::calculate_score()`/
     * `Controllers\Geo::calculate_score()` already use — kept as its own
     * private copy here rather than a shared trait, same "each controller
     * keeps its own copy" convention those two (plus BrandIntelligence)
     * already established.
     *
     * @param array{critical: int, high: int, medium: int, low: int} $breakdown Severity breakdown to score.
     * @return int 0-100.
     */
    private function calculate_score( array $breakdown ): int {
        $score = 100
            - ( $breakdown['critical'] * 15 )
            - ( $breakdown['high'] * 8 )
            - ( $breakdown['medium'] * 3 )
            - ( $breakdown['low'] * 1 );

        return max( 0, min( 100, $score ) );
    }

    /**
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_summary( $request ) {
        $repository = new CrawlerVisitRepository();
        $days       = absint( $request->get_param( 'days' ) ) ?: 30;

        return rest_ensure_response(
            array(
                'bot_last_seen'      => $repository->get_bot_last_seen(),
                'most_crawled_pages' => $repository->get_most_crawled_pages(),
                'daily_volume'       => $repository->get_daily_volume( $days ),
            )
        );
    }
}
