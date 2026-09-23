<?php
namespace VuloPilot\AiAssistant\Rest;

use VuloPilot\SiteHealth\BackupRepository;
use VuloPilot\SeoVisibility\CrawlerVisitRepository;
use VuloPilot\Utill\FindingRepository;
use VuloPilot\SeoVisibility\IndexNowLogRepository;
use VuloPilot\AiAssistant\AiByokGatewayClient;
use VuloPilot\AiAssistant\AiCreditsConnection;
use VuloPilot\Settings\GoogleAdSenseClient;
use VuloPilot\Settings\GoogleAnalyticsClient;
use VuloPilot\Settings\GoogleServicesConnection;
use VuloPilot\SeoVisibility\IndexNowClient;
use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Backs the AI Credits indicator/claim CTA (VuloPilot brief §4/§21) - a
 * real `GET .../status` (composes AiCreditsConnection + the underlying
 * VuloCloudAccountConnection's own status, see that class's own
 * get_status() docblock) and a real `POST .../refresh-balance` (force a
 * live re-sync from VuloCloud's own authoritative wallet). Connecting
 * itself goes through `vulocloud-ai-connection/broker-authorize-url`'s
 * passwordless redirect (AiCreditsConnection::get_broker_authorize_url()'s
 * own docblock), not a route on this controller.
 *
 * Same "never let a raw secret reach the client" boundary
 * GoogleServices.php's own docblock documents - every method here only
 * ever returns AiCreditsConnection::get_status()'s shape.
 *
 * @class       AiCredits controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class AiCredits extends \WP_REST_Controller {

    /**
     * REST base for this controller's routes.
     *
     * @var string
     */
    protected $rest_base = 'ai-credits';

    /**
     * Registers this controller's routes.
     *
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/status',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_status' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/refresh-balance',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'refresh_balance' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/disconnect',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'disconnect' ),
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
     * `GET .../status`.
     *
     * @return \WP_REST_Response
     */
    public function get_status() {
        return rest_ensure_response( ( new AiCreditsConnection() )->get_status() );
    }

    /**
     * `POST .../refresh-balance`.
     *
     * @return \WP_REST_Response|\WP_Error
     */
    public function refresh_balance() {
        $result = ( new AiCreditsConnection() )->refresh_balance();

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( $result );
    }

    /**
     * `POST .../disconnect`.
     *
     * @return \WP_REST_Response
     */
    public function disconnect() {
        $connection = new AiCreditsConnection();
        $connection->disconnect();

        return rest_ensure_response( $connection->get_status() );
    }
}
