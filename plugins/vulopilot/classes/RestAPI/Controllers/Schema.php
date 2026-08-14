<?php
/**
 * Schema controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Services\SchemaCoverageAnalyzer;

defined( 'ABSPATH' ) || exit;

/**
 * `GET /schema/coverage` reads back a previously generated Schema
 * Coverage snapshot (transient, no real work) — what the restyled Schema
 * tab loads on mount. `POST /schema/coverage` runs a fresh real sample
 * (SchemaCoverageAnalyzer::analyze(), real outbound HTTP + JSON-LD parsing
 * per sampled page) and persists it — separated into two routes/verbs for
 * the identical reason Controllers\GeoAnalysis (Free) and
 * GeoInsights\Rest::analyze_competitor_visibility() (Pro) already split
 * their own real-work endpoints this way: loading a page should never
 * silently re-spend real work a site owner didn't ask for.
 *
 * @class       Schema controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class Schema extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'schema';

    /**
     * @var SchemaCoverageAnalyzer
     */
    private SchemaCoverageAnalyzer $analyzer;

    /**
     * @param SchemaCoverageAnalyzer|null $analyzer Defaults to a new instance (injectable for tests).
     */
    public function __construct( ?SchemaCoverageAnalyzer $analyzer = null ) {
        $this->analyzer = $analyzer ?? new SchemaCoverageAnalyzer();
    }

    /**
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/coverage',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_coverage' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'analyze_coverage' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
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
    public function permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @return \WP_REST_Response
     */
    public function get_coverage() {
        return rest_ensure_response( $this->analyzer->get_stored_snapshot() );
    }

    /**
     * @return \WP_REST_Response
     */
    public function analyze_coverage() {
        return rest_ensure_response( $this->analyzer->analyze() );
    }
}
