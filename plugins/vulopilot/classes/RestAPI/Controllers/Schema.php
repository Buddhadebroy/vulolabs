<?php
/**
 * Schema controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Services\SchemaCoverageAnalyzer;
use VuloPilot\Services\SchemaPageInspector;

defined( 'ABSPATH' ) || exit;

/**
 * `GET /schema/coverage` reads back a previously generated Schema
 * Coverage snapshot (transient, no real work) — what the "Schema &
 * Knowledge" tab's Overview/Structured Data sections load on mount.
 * `POST /schema/coverage` runs a fresh real sample
 * (SchemaCoverageAnalyzer::analyze(), real outbound HTTP + JSON-LD parsing
 * per sampled page) and persists it — separated into two routes/verbs for
 * the identical reason Controllers\GeoAnalysis (Free) and
 * GeoInsights\Rest::analyze_competitor_visibility() (Pro) already split
 * their own real-work endpoints this way: loading a page should never
 * silently re-spend real work a site owner didn't ask for.
 *
 * `POST /schema/inspect` backs the Inspector section's real single-page
 * checker (SchemaPageInspector) — POST, not GET, same "real outbound HTTP
 * only on explicit request" reasoning as `/schema/coverage`.
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
     * @var SchemaPageInspector
     */
    private SchemaPageInspector $inspector;

    /**
     * @param SchemaCoverageAnalyzer|null $analyzer  Defaults to a new instance (injectable for tests).
     * @param SchemaPageInspector|null    $inspector Defaults to a new instance (injectable for tests).
     */
    public function __construct( ?SchemaCoverageAnalyzer $analyzer = null, ?SchemaPageInspector $inspector = null ) {
        $this->analyzer  = $analyzer ?? new SchemaCoverageAnalyzer();
        $this->inspector = $inspector ?? new SchemaPageInspector();
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

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/inspect',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'inspect_page' ),
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

    /**
     * Inspector section's "Inspect a specific page" — resolves either a
     * given `url` or a `post_id`'s real permalink, runs a real
     * `wp_remote_get()` + JSON-LD extraction against it
     * (SchemaPageInspector), and returns the real result. Real outbound
     * HTTP only on this explicit request, same as `analyze_coverage()`.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function inspect_page( $request ) {
        $url     = esc_url_raw( (string) $request->get_param( 'url' ) );
        $post_id = absint( $request->get_param( 'post_id' ) );

        if ( '' === $url && $post_id ) {
            $permalink = get_permalink( $post_id );
            $url       = $permalink ? $permalink : '';
        }

        if ( '' === $url ) {
            return new \WP_Error( 'vulopilot_schema_inspect_missing_url', __( 'Provide a URL or post to inspect.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $result = $this->inspector->inspect( $url );

        if ( null === $result ) {
            return new \WP_Error( 'vulopilot_schema_inspect_failed', __( 'Could not fetch that page. Check the URL and try again.', 'vulopilot' ), array( 'status' => 502 ) );
        }

        return rest_ensure_response( $result );
    }
}
