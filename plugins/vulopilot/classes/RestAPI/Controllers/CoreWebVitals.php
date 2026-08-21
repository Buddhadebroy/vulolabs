<?php
/**
 * CoreWebVitals controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\CoreWebVitalsRepository;

defined( 'ABSPATH' ) || exit;

/**
 * `GET /core-web-vitals` — backs "Performance" Overview's
 * PerformanceScoreCard.tsx Core Web Vitals tiles. Read-only, real p75
 * aggregate from CoreWebVitalsRepository::get_p75_summary() (the actual
 * data the public beacon endpoint,
 * classes/RestAPI/Controllers/CoreWebVitalsBeaconRest.php, has collected
 * from real visitors).
 *
 * @class       CoreWebVitals controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class CoreWebVitals extends \WP_REST_Controller {

    /**
     * REST base for this controller's routes.
     *
     * @var string
     */
    protected $rest_base = 'core-web-vitals';

    /**
     * Registers GET /core-web-vitals.
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
        return rest_ensure_response( ( new CoreWebVitalsRepository() )->get_p75_summary() );
    }
}
