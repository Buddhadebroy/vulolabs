<?php
/**
 * ContentIntelligence controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\FindingRepository;

defined( 'ABSPATH' ) || exit;

/**
 * `GET /content-intelligence/score` — the composite, deterministic
 * "Content Score" (no AI, no cost). Scoped to a fixed scanner_id list
 * spanning two categories (`content`'s own readability scanner, plus 4
 * existing `seo`-category scanners this module reuses rather than
 * recategorizes — CONTENT-INTELLIGENCE-MODULE.md's audit), using
 * FindingRepository::get_severity_breakdown_for_scanner_ids() and the
 * exact same weighting Controllers\Dashboard::calculate_category_score()
 * already uses, just scoped to this scanner list instead of one category.
 *
 * Distinct from ContentIntelligence\ContentAnalyzer's own per-post
 * "Topic Authority" AI score — that's a real AI cost, its REST route lives
 * in vulopilot-pro's own ContentIntelligence module (same Free/Pro split
 * GeoAnalysis\GeoAnalyzer/GeoInsights\Rest.php already establish). This
 * route is the free, always-available, no-cost half.
 *
 * @class       ContentIntelligence controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class ContentIntelligence extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'content-intelligence';

    /**
     * Same scanner list ContentAnalyzer::SCANNER_IDS reads — kept in sync
     * by convention rather than a cross-class constant reference (the same
     * tradeoff ScannerFixMap's own docblock already accepts for a handful
     * of small, stable lists).
     *
     * @var string[]
     */
    private const SCANNER_IDS = array( 'readability', 'thin-content', 'duplicate-content', 'heading-structure', 'internal-linking', 'orphan-pages' );

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
        $breakdown = ( new FindingRepository() )->get_severity_breakdown_for_scanner_ids( self::SCANNER_IDS );

        $score = 100
            - ( $breakdown['critical'] * 15 )
            - ( $breakdown['high'] * 8 )
            - ( $breakdown['medium'] * 3 )
            - ( $breakdown['low'] * 1 );

        return rest_ensure_response(
            array(
				'score'              => max( 0, min( 100, $score ) ),
				'severity_breakdown' => $breakdown,
			)
        );
    }
}
