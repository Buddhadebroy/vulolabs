<?php
/**
 * PageSpeed controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\PageSpeedRepository;

defined( 'ABSPATH' ) || exit;

/**
 * `GET /page-speed` lists real per-page speed results plus a real summary
 * and `top_issues` (PageSpeedRepository::get_top_issues() — the real,
 * deduplicated `main_issue` values grouped by how many pages they affect,
 * backing the "Performance Opportunities" tab and "Why these pages are
 * slow?" sidebar) for "Performance" › Slow Pages; `POST /page-speed`
 * (re)starts a real background scan via VuloPilot()->page_speed_scanner
 * (already wired in VuloPilot::init_classes()) — same "GET lists, POST
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
     * Starts (or restarts) a real background scan — never runs
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
