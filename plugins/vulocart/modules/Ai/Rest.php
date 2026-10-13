<?php
/**
 * Rest class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Ai;

use VuloCart\AI\AiUsageLogUtil;
use VuloCart\AI\VuloCloudConnection;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Ai module Rest class - the VuloCloud connection (status, connect
 * URL, disconnect) and the usage log, all `manage_options`-gated.
 *
 * @class       Rest class
 * @version     2.0.0
 * @author      VuloLabs
 */
class Rest extends \WP_REST_Controller {

	/**
	 * @var string
	 */
	protected $rest_base = 'vulocloud-ai-connection';

	/**
	 * @var VuloCloudConnection
	 */
	private $connection;

	/**
	 * @var AiUsageLogUtil
	 */
	private $usage_log;

	public function __construct( VuloCloudConnection $connection, AiUsageLogUtil $usage_log ) {
		$this->connection = $connection;
		$this->usage_log  = $usage_log;

		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * @return void
	 */
	public function register_routes(): void {
		$namespace = VuloCart()->rest_namespace;

		register_rest_route(
			$namespace,
			'/' . $this->rest_base,
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_status' ),
				'permission_callback' => array( $this, 'admin_permissions_check' ),
			)
		);

		register_rest_route(
			$namespace,
			'/' . $this->rest_base . '/broker-authorize-url',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_authorize_url' ),
				'permission_callback' => array( $this, 'admin_permissions_check' ),
			)
		);

		register_rest_route(
			$namespace,
			'/' . $this->rest_base . '/disconnect',
			array(
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'disconnect' ),
				'permission_callback' => array( $this, 'admin_permissions_check' ),
			)
		);

		register_rest_route(
			$namespace,
			'/ai/usage',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_usage' ),
				'permission_callback' => array( $this, 'admin_permissions_check' ),
			)
		);
	}

	/**
	 * @return bool
	 */
	public function admin_permissions_check() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * @return \WP_REST_Response
	 */
	public function get_status() {
		return rest_ensure_response( array( 'vulocloud_status' => $this->connection->get_status() ) );
	}

	/**
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_authorize_url() {
		$url = $this->connection->get_authorize_url();

		if ( ! $url ) {
			return new \WP_Error( 'vulocart_vulocloud_not_configured', __( 'VuloCloud isn’t configured for this build yet.', 'vulocart' ), array( 'status' => 400 ) );
		}

		return rest_ensure_response( array( 'url' => $url ) );
	}

	/**
	 * @return \WP_REST_Response
	 */
	public function disconnect() {
		$this->connection->disconnect();

		return rest_ensure_response( array( 'disconnected' => true ) );
	}

	/**
	 * @return \WP_REST_Response
	 */
	public function get_usage() {
		return rest_ensure_response(
			array(
				'summary' => $this->usage_log->get_summary(),
				'recent'  => $this->usage_log->list_recent( 50 ),
			)
		);
	}
}
