<?php
namespace VuloPilot\SeoVisibility\Rest;

use VuloPilot\SeoVisibility\IndexNowLogRepository;
use VuloPilot\SeoVisibility\IndexNowClient;
use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Backs the Instant Indexing tab's "Submit URLs" (`POST /indexnow/submit`) and "History"
 * (`GET /indexnow/history`) cards.
 *
 * @class       IndexNow controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class IndexNow extends \WP_REST_Controller {

	/**
	 * @var string
	 */
	protected $rest_base = 'indexnow';

	/**
	 * @inheritDoc
	 */
	public function register_routes() {
		register_rest_route(
			VuloPilot()->rest_namespace,
			'/' . $this->rest_base . '/submit',
			array(
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'submit_urls' ),
					'permission_callback' => array( $this, 'permissions_check' ),
				),
			)
		);

		register_rest_route(
			VuloPilot()->rest_namespace,
			'/' . $this->rest_base . '/history',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_history' ),
					'permission_callback' => array( $this, 'permissions_check' ),
				),
			)
		);
	}

	/**
	 * Shared permission check for both routes in this controller - same `manage_options`
	 * gate every other VuloPilot settings-adjacent controller uses.
	 *
	 * @param \WP_REST_Request $request Full details about the request.
	 * @return bool
	 */
	public function permissions_check( $request ) {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Manually submits one or more URLs - the mockup's own "Submit URLs" textarea/button.
	 *
	 * @param \WP_REST_Request $request Full details about the request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function submit_urls( $request ) {
		$raw_urls = $request->get_param( 'urls' );
		$urls     = is_array( $raw_urls ) ? $raw_urls : preg_split( '/[\r\n]+/', (string) $raw_urls );
		$urls     = array_values( array_filter( array_map( 'trim', (array) $urls ) ) );

		if ( ! $urls ) {
			return new \WP_Error( 'vulopilot_no_urls', __( 'No URLs were given.', 'vulopilot' ), array( 'status' => 400 ) );
		}

		$settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
		$api_key  = (string) ( $settings['indexnow_api_key'] ?? '' );

		if ( '' === $api_key ) {
			return new \WP_Error( 'vulopilot_no_key', __( 'No IndexNow API key yet - reload the Instant Indexing tab once to generate one.', 'vulopilot' ), array( 'status' => 400 ) );
		}

		$client     = new IndexNowClient( $api_key );
		$repository = new IndexNowLogRepository();
		$results    = array();

		// IndexNow's own protocol accepts a batch in one request.
		foreach ( $urls as $url ) {
			$result = $client->submit( array( $url ) );

			$repository->log( $url, $result['status_code'], $result['status'], 'manual' );

			$results[] = array_merge( array( 'url' => $url ), $result );
		}

		return rest_ensure_response( array( 'results' => $results ) );
	}

	/**
	 * @return \WP_REST_Response
	 */
	public function get_history() {
		return rest_ensure_response( ( new IndexNowLogRepository() )->get_recent() );
	}
}
