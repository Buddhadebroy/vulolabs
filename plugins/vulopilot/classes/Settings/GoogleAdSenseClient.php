<?php
namespace VuloPilot\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Real Google AdSense Management API (v2) client - backs the "Analytics" settings panel's
 * own AdSense account dropdown (GoogleServicesPanel.tsx).
 *
 * @class       GoogleAdSenseClient class
 * @version     1.0.0
 * @author      VuloLabs
 */
class GoogleAdSenseClient {

	private const ACCOUNTS_URL = 'https://adsense.googleapis.com/v2/accounts';

	/**
	 * @var GoogleServicesConnection
	 */
	private GoogleServicesConnection $connection;

	/**
	 * @param GoogleServicesConnection|null $connection Defaults to a new instance (injectable for tests).
	 */
	public function __construct( ?GoogleServicesConnection $connection = null ) {
		$this->connection = $connection ?? new GoogleServicesConnection();
	}

	/**
	 * Real `GET https://adsense.googleapis.com/v2/accounts` - every AdSense account this
	 * Google user can access.
	 *
	 * @return array<int, array{account_id: string, display_name: string}>|\WP_Error
	 */
	public function list_accounts() {
		$token = $this->connection->get_valid_access_token();

		if ( ! $token ) {
			return new \WP_Error( 'vulopilot_adsense_not_connected', __( 'Not connected to Google.', 'vulopilot' ), array( 'status' => 400 ) );
		}

		$response = wp_remote_get(
			self::ACCOUNTS_URL,
			array(
				'timeout' => 15,
				'headers' => array( 'Authorization' => 'Bearer ' . $token ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$status_code = (int) wp_remote_retrieve_response_code( $response );

		// A site owner with no AdSense account at all gets a real 403 ("PERMISSION_DENIED"/no
		// accounts) from this endpoint.
		if ( 403 === $status_code ) {
			return array();
		}

		if ( 200 !== $status_code ) {
			return new \WP_Error( 'vulopilot_adsense_accounts_failed', __( 'Could not fetch your AdSense accounts.', 'vulopilot' ), array( 'status' => 502 ) );
		}

		$body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

		return array_map(
			static fn( $account ) => array(
				'account_id'   => str_replace( 'accounts/', '', (string) ( $account['name'] ?? '' ) ),
				'display_name' => $account['displayName'] ?? ( $account['name'] ?? '' ),
			),
			$body['accounts'] ?? array()
		);
	}
}
