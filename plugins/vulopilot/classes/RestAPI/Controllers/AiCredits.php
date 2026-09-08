<?php
/**
 * AiCredits controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Services\AiCreditsConnection;

defined( 'ABSPATH' ) || exit;

/**
 * Backs the AI Credits indicator/claim CTA (VuloPilot brief §4/§21) — a
 * real `GET .../status` (composes AiCreditsConnection + the underlying
 * VuloCloudAccountConnection's own status, see that class's own
 * get_status() docblock), a real `POST .../connect` (the full
 * install→claim→connect orchestration, one call), and a real
 * `POST .../refresh-balance` (force a live re-sync from VuloCloud's own
 * authoritative wallet).
 *
 * Same "never let a raw secret reach the client" boundary
 * GoogleServices.php/VuloCloudAccount.php's own docblocks document —
 * every method here only ever returns AiCreditsConnection::get_status()'s
 * shape.
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
            '/' . $this->rest_base . '/connect',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'connect' ),
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
     * `POST .../connect`.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function connect( $request ) {
        $email           = sanitize_email( (string) $request->get_param( 'email' ) );
        $password        = (string) $request->get_param( 'password' );
        $two_factor_code = sanitize_text_field( (string) $request->get_param( 'two_factor_code' ) );
        $create_account  = (bool) $request->get_param( 'create_account' );
        $as_customer     = (bool) $request->get_param( 'as_customer' );
        $first_name      = sanitize_text_field( (string) $request->get_param( 'first_name' ) );
        $last_name       = sanitize_text_field( (string) $request->get_param( 'last_name' ) );

        if ( '' === $email || ! is_email( $email ) ) {
            return new \WP_Error( 'vulopilot_ai_credits_invalid_email', __( 'Enter a valid email address.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        if ( '' === $password ) {
            return new \WP_Error( 'vulopilot_ai_credits_missing_password', __( 'Enter your VuloCloud password.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $result = ( new AiCreditsConnection() )->connect_and_claim( $email, $password, $two_factor_code, $create_account, $as_customer, $first_name, $last_name );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( $result );
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
