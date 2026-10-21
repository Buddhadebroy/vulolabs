<?php
/**
 * Logs class file.
 *
 * @package VuloCart
 */

namespace VuloCart\RestAPI\Controllers;

use VuloCart\Logger;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Logs REST controller: the three routes the admin UI's log viewer field (`type: 'log'`, used the same way in
 * the other VuloLabs and MultiVendorX plugins) calls to show, clear and download the debug log of Settings → Advanced.
 *
 * @class       Logs class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Logs extends \WP_REST_Controller {

	/**
	 * REST base for this controller's routes.
	 *
	 * @var string
	 */
	protected $rest_base = 'logs';

	/**
	 * Registers the log routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			\VuloCart()->rest_namespace,
			'/' . $this->rest_base,
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_items' ),
					'permission_callback' => array( $this, 'permissions_check' ),
				),
				array(
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => array( $this, 'delete_items' ),
					'permission_callback' => array( $this, 'permissions_check' ),
				),
			)
		);

		register_rest_route(
			\VuloCart()->rest_namespace,
			'/' . $this->rest_base . '/download',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( $this, 'download' ),
				'permission_callback' => array( $this, 'permissions_check' ),
			)
		);
	}

	/**
	 * Only administrators may read, clear or download the log.
	 *
	 * @return bool
	 */
	public function permissions_check() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Returns the last log lines (`logcount`, default 100), oldest first.
	 *
	 * @param \WP_REST_Request $request Full request object.
	 * @return \WP_REST_Response
	 */
	public function get_items( $request ) {
		$count = $request->get_param( 'logcount' ) ? min( 1000, max( 1, absint( $request->get_param( 'logcount' ) ) ) ) : 100;

		return rest_ensure_response( Logger::tail( $count ) );
	}

	/**
	 * Empties the log.
	 *
	 * @param \WP_REST_Request $request Full request object.
	 * @return \WP_REST_Response
	 */
	public function delete_items( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
		Logger::clear();

		return rest_ensure_response( array() );
	}

	/**
	 * Sends the whole log file as a download and ends the request.
	 *
	 * @param \WP_REST_Request $request Full request object.
	 * @return \WP_Error|void
	 */
	public function download( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
		$path = Logger::path();

		if ( '' === $path || ! file_exists( $path ) ) {
			return new \WP_Error( 'vulocart_no_log', esc_html__( 'There is no log to download yet.', 'vulocart' ), array( 'status' => 404 ) );
		}

		nocache_headers();
		header( 'Content-Type: text/plain; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="vulocart-debug.log"' );
		header( 'Content-Length: ' . filesize( $path ) );
		readfile( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile -- streaming the plugin's own log file.
		exit;
	}
}
