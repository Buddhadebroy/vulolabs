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
 * the restyled SEO tab's own gauge card. Same weighted-severity formula
 * BrandIntelligence::calculate_score()/ContentIntelligence's own "Content
 * Score" already use (`100 - critical*15 - high*8 - medium*3 - low*1`,
 * clamped 0-100) over
 * FindingRepository::get_severity_breakdown_for_scanner_ids(), scoped to
 * the same 15 real scanner ids SeoTab.tsx's own SEO_SECTIONS already groups
 * into 3 real sections — this endpoint just also returns the 3-category
 * grouping (Search Appearance/Content & Pages/Links & Indexing) the
 * reference mockup's own category cards use, computed the identical way.
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
     * The exact same 5 sections/scanner-id lists SeoTab.tsx's own
     * SEO_SECTIONS already groups its unified findings table into — kept in
     * sync manually with that file (same "kept in sync manually" posture
     * CrawlerTrafficTab.tsx's own bot-name filter pills already document
     * for CrawlerTrafficLogger::BOT_SIGNATURES), deliberately reusing that
     * exact grouping rather than inventing a second, differently-shaped
     * category split — so this endpoint's own per-category scores always
     * agree with what the tab's own section tabs/table already show.
     *
     * `links-schema` used to bundle `internal-linking`/`broken-links`/
     * `schema`/`structured-data`/`sitewide-structured-data`/`open-graph`/
     * `twitter-card` into one category — real overlapping ownership with
     * "SEO & Visibility"'s own dedicated Broken Links tab
     * (BrokenLinksTab.tsx's own `BROKEN_SCANNER_IDS`) and Schema &
     * Knowledge tab (SchemaKnowledge/IssuesSection.tsx's own
     * `SCHEMA_ISSUE_SCANNER_IDS`), which already own those same scanner
     * ids' findings. Fixed (direct instruction) by narrowing this category
     * to `internal-linking` only, renamed to `internal-linking`, and
     * dropping `broken-links`/`schema`/`structured-data`/
     * `sitewide-structured-data` here entirely — their findings are still
     * fully real and visible, just only ever through their one real owning
     * tab now, not duplicated here too. `open-graph`/`twitter-card` have no
     * dedicated tab anywhere in this codebase, so rather than dropping
     * their findings from this SEO lens entirely they moved into
     * `titles-meta` (a meta-tag concern, not a linking one).
     *
     * `sitemap`/`robots` were dropped from here entirely for the same
     * reason (direct instruction): both are crawler/discovery controls,
     * real overlapping ownership with "SEO & Visibility"'s own dedicated
     * Crawler Traffic tab, which now owns real `robots-txt`/`sitemap`/
     * `sitemap-validation`/`ai-crawler-blocked-pages` findings tables
     * itself (CrawlerTrafficTab.tsx). SeoTab.tsx's own "Search engine
     * access" status line reads the same 4 scanner ids' open-finding count
     * directly (not through this endpoint) so it can stay a real tiny
     * status without this endpoint growing a 6th category no card here
     * displays.
     *
     * @var array<string, string[]>
     */
    private const CATEGORY_SCANNER_IDS = array(
        'titles-meta'      => array(
            'seo',
            'meta-description',
            'canonical-url',
            'duplicate-content',
            'orphan-pages',
            'thin-content',
            'heading-structure',
            'meta-description-duplication',
            'multiple-h1',
            'focus-keyword-audit',
            'open-graph',
            'twitter-card',
        ),
        'images'           => array( 'seo-images', 'images' ),
        'internal-linking' => array( 'internal-linking' ),
    );

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
        $findings = new FindingRepository();

        $all_scanner_ids = array_merge( ...array_values( self::CATEGORY_SCANNER_IDS ) );
        $overall_breakdown = $findings->get_severity_breakdown_for_scanner_ids( $all_scanner_ids );

        $category_scores = array();
        foreach ( self::CATEGORY_SCANNER_IDS as $key => $scanner_ids ) {
            $category_scores[ $key ] = $this->calculate_score(
                $findings->get_severity_breakdown_for_scanner_ids( $scanner_ids )
            );
        }

        return rest_ensure_response(
            array(
				'seo_score'          => $this->calculate_score( $overall_breakdown ),
				'category_scores'    => $category_scores,
				'severity_breakdown' => $overall_breakdown,
				'total_open'         => array_sum( $overall_breakdown ),
			)
        );
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
