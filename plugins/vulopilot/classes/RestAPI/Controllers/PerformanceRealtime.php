<?php
/**
 * PerformanceRealtime controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\PerformanceRequestRepository;

defined( 'ABSPATH' ) || exit;

/**
 * `GET /performance-realtime` — backs "Improve Speed" Overview's
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
