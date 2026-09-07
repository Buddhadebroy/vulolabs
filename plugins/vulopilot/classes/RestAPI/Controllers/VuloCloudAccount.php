<?php
/**
 * VuloCloudAccount controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Services\VuloCloudAccountConnection;

defined( 'ABSPATH' ) || exit;

/**
 * Backs useContentGate.tsx's own "log in" tier — the real
 * "Connect to VuloCloud" popup (components/Popup/VuloCloudConnectPopup.tsx)
 * calls `connect()` below; `disconnect()` isn't wired to any UI yet (no
 * "manage your VuloCloud connection" settings surface exists), but is
 * still real and callable — same shape GoogleServices' own
 * `disconnect()` has.
 *
 * Same "never let a raw token reach the client" boundary
 * GoogleServices.php's own docblock documents for its OAuth tokens —
 * `get_status()`/`connect()` both return
 * VuloCloudAccountConnection::get_status()'s shape only.
 *
 * @class       VuloCloudAccount controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class VuloCloudAccount extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'vulocloud-account';

    /**
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
     * @return \WP_REST_Response
     */
    public function get_status() {
        return rest_ensure_response( ( new VuloCloudAccountConnection() )->get_status() );
    }

    /**
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function connect( $request ) {
        $email           = sanitize_email( (string) $request->get_param( 'email' ) );
        $password        = (string) $request->get_param( 'password' );
        $two_factor_code = sanitize_text_field( (string) $request->get_param( 'two_factor_code' ) );

        if ( '' === $email || ! is_email( $email ) ) {
            return new \WP_Error( 'vulopilot_vulocloud_invalid_email', __( 'Enter a valid email address.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        if ( '' === $password ) {
            return new \WP_Error( 'vulopilot_vulocloud_missing_password', __( 'Enter your VuloCloud password.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $result = ( new VuloCloudAccountConnection() )->connect( $email, $password, $two_factor_code );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( $result );
    }

    /**
     * @return \WP_REST_Response
     */
    public function disconnect() {
        $connection = new VuloCloudAccountConnection();
        $connection->disconnect();

        return rest_ensure_response( $connection->get_status() );
    }
}
