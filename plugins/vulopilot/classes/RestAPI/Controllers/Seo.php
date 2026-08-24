<?php
/**
 * Seo controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\FindingRepository;

defined( 'ABSPATH' ) || exit;

/**
 * `GET /seo/score` — a real, deterministic SEO Score (no AI, no cost) for
 * the restyled SEO tab's own "SEO Health Score" card. Same weighted-severity
 * formula BrandIntelligence::calculate_score()/ContentIntelligence's own
 * "Content Score" already use (`100 - critical*15 - high*8 - medium*3 -
 * low*1`, clamped 0-100) over
 * FindingRepository::get_severity_breakdown_for_scanner_ids(), scoped to the
 * same 15 real scanner ids SeoTab.tsx's own SEO_SECTIONS groups its unified
 * findings table into — this endpoint just also returns that same grouping's
 * own per-category scores, real open/affected-page counts, and a real
 * week-over-week delta, all computed the identical documented way.
 *
 * @class       Seo controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class Seo extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'seo';

    /**
     * The same 15 real scanner ids SeoTab.tsx's own SEO_SECTIONS/
     * seoSections.ts groups its unified findings table into, kept in sync
     * manually with that file (same "kept in sync manually" posture
     * CrawlerTrafficTab.tsx's own bot-name filter pills already document
     * for CrawlerTrafficLogger::BOT_SIGNATURES) — 6 categories now (was 3),
     * matching the reference mockup's own "SEO areas" grid exactly, still
     * the same 15 ids overall (no scanner added, none dropped):
     *
     * - `titles-meta`: title/meta-description/duplication/focus-keyword
     *   checks only now (`duplicate-content`/`orphan-pages` moved to
     *   `indexability-canonicals` below — both are indexing/canonicalization
     *   concerns, not a title/meta one).
     * - `content-structure` (NEW): heading structure, multiple H1s, thin
     *   content — split out of the old combined `titles-meta` bucket, since
     *   the mockup shows these as their own real "Content Structure" tile.
     * - `images`: unchanged.
     * - `internal-linking`: unchanged.
     * - `indexability-canonicals` (NEW): canonical URLs, duplicate content,
     *   orphan pages — all 3 are real indexability/canonicalization signals,
     *   not title/meta ones.
     * - `structured-data` (NEW): Open Graph/Twitter Card tags only — real
     *   structured *metadata*, but deliberately NOT the same thing as the
     *   `schema`/`structured-data`/`sitewide-structured-data` scanner ids,
     *   which stay owned entirely by "SEO & Visibility"'s own dedicated
     *   Schema & Knowledge tab (direct instruction, still standing: "Schema
     *   should never be bundled into this category when you already have a
     *   dedicated Schema screen"). Reusing the mockup's own "Structured
     *   Data" label for Open Graph/Twitter Card here is the closest real fit
     *   without reintroducing that exact overlap.
     *
     * `sitemap`/`robots` stay dropped from here entirely, same reasoning as
     * before (direct instruction): both are crawler/discovery controls,
     * real overlapping ownership with "SEO & Visibility"'s own dedicated
     * Crawl & URLs tab, which owns real `robots-txt`/`sitemap`/
     * `sitemap-validation`/`ai-crawler-blocked-pages` findings tables
     * itself. SeoTab.tsx's own "Search engine access" status line reads
     * those same 4 scanner ids' open-finding count directly (not through
     * this endpoint).
     *
     * @var array<string, string[]>
     */
    private const CATEGORY_SCANNER_IDS = array(
        'titles-meta'             => array(
            'seo',
            'meta-description',
            'meta-description-duplication',
            'focus-keyword-audit',
        ),
        'content-structure'       => array(
            'heading-structure',
            'multiple-h1',
            'thin-content',
        ),
        'images'                  => array( 'seo-images', 'images' ),
        'internal-linking'        => array( 'internal-linking' ),
        'indexability-canonicals' => array(
            'canonical-url',
            'duplicate-content',
            'orphan-pages',
        ),
        'structured-data'         => array( 'open-graph', 'twitter-card' ),
    );

    /**
     * How far back "since last week" looks for the real deltas below — a
     * real, exact reconstruction of that same moment's own open-finding set
     * (FindingRepository::get_severity_breakdown_for_scanner_ids_as_of(),
     * already built for Content/Brand's own score trends), not an estimate
     * and not a stored snapshot series — so this needed no new table.
     *
     * @var int
     */
    private const DELTA_LOOKBACK_DAYS = 7;

    /**
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/score',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_score' ),
                    'permission_callback' => array( $this, 'get_score_permissions_check' ),
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
    public function get_score_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @return \WP_REST_Response
     */
    public function get_score() {
        $findings          = new FindingRepository();
        $all_scanner_ids   = array_merge( ...array_values( self::CATEGORY_SCANNER_IDS ) );
        $overall_breakdown = $findings->get_severity_breakdown_for_scanner_ids( $all_scanner_ids );

        $category_scores = array();
        foreach ( self::CATEGORY_SCANNER_IDS as $key => $scanner_ids ) {
            $category_breakdown = $findings->get_severity_breakdown_for_scanner_ids( $scanner_ids );

            $category_scores[ $key ] = array(
                'score'          => $this->calculate_score( $category_breakdown ),
                'open_count'     => array_sum( $category_breakdown ),
                'affected_pages' => $findings->get_affected_object_count_for_scanner_ids( $scanner_ids ),
            );
        }

        $as_of              = gmdate( 'Y-m-d H:i:s', strtotime( '-' . self::DELTA_LOOKBACK_DAYS . ' days' ) );
        $previous_breakdown = $findings->get_severity_breakdown_for_scanner_ids_as_of( $all_scanner_ids, $as_of );

        return rest_ensure_response(
            array(
                'seo_score'          => $this->calculate_score( $overall_breakdown ),
                'pages_checked'      => $this->get_pages_checked(),
                'category_scores'    => $category_scores,
                'severity_breakdown' => $overall_breakdown,
                'total_open'         => array_sum( $overall_breakdown ),
                'deltas'             => array(
                    'lookback_days' => self::DELTA_LOOKBACK_DAYS,
                    'total_open'    => array_sum( $overall_breakdown ) - array_sum( $previous_breakdown ),
                    'critical'      => $overall_breakdown['critical'] - ( $previous_breakdown['critical'] ?? 0 ),
                    'high'          => $overall_breakdown['high'] - ( $previous_breakdown['high'] ?? 0 ),
                ),
            )
        );
    }

    /**
     * Real published post/page count — the same real scope
     * `SeoScanner::run()` itself scans (`post_type => ['post', 'page'],
     * post_status => 'publish'`), so "Pages checked" always means exactly
     * what the SEO module actually looks at, not a separate invented
     * definition.
     *
     * @return int
     */
    private function get_pages_checked(): int {
        $posts = wp_count_posts( 'post' );
        $pages = wp_count_posts( 'page' );

        return (int) ( $posts->publish ?? 0 ) + (int) ( $pages->publish ?? 0 );
    }

    /**
     * Same weighting BrandIntelligence::calculate_score()/
     * ContentIntelligence's own "Content Score" already use.
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
}
