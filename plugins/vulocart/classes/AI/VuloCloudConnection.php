<?php
/**
 * VuloCloudConnection class file.
 *
 * @package VuloCart
 */

namespace VuloCart\AI;

use VuloCart\AI\Services\CredentialEncryption;

defined( 'ABSPATH' ) || exit;

/**
 * This site's connection to the VuloCloud AI gateway - same broker flow as
 * VuloPilot's `AiCreditsConnection`: a passwordless connect that yields a
 * ConnectedSite id + secret (stored encrypted), after which prompts are
 * sent to VuloCloud and run on the connected Organization's AI key against
 * its credits. Nothing about the AI provider or key lives on this site.
 *
 * @class       VuloCloudConnection class
 * @version     1.0.0
 * @author      VuloLabs
 */
class VuloCloudConnection {

	const OPTION_KEY = 'vulocart_vulocloud_connection';

	const NONCE_ACTION = 'vulocart_connect_broker';

	/**
	 * @return array<string, mixed>
	 */
	private function get_connection(): array {
		return wp_parse_args(
			get_option( self::OPTION_KEY, array() ),
			array(
				'site_id'         => '',
				'secret_enc'      => '',
				'credits'         => 0,
				'buy_credits_url' => '',
				'connected_at'    => '',
				'last_synced_at'  => '',
			)
		);
	}

	/**
	 * @param array<string, mixed> $data Partial fields to merge into the stored connection.
	 * @return void
	 */
	private function save_connection( array $data ): void {
		update_option( self::OPTION_KEY, array_merge( $this->get_connection(), $data ), false );
	}

	/**
	 * @return bool
	 */
	private function is_build_configured(): bool {
		return defined( 'VULOCART_VULOCLOUD_URL' ) && '' !== trim( VULOCART_VULOCLOUD_URL );
	}

	/**
	 * Whether this site holds a ConnectedSite credential.
	 *
	 * @return bool
	 */
	public function is_connected(): bool {
		$connection = $this->get_connection();

		return '' !== $connection['site_id'] && '' !== $connection['secret_enc'];
	}

	/**
	 * The decrypted credential, or null if not connected.
	 *
	 * @return array{site_id: string, secret: string}|null
	 */
	private function get_site_credential(): ?array {
		if ( ! $this->is_connected() ) {
			return null;
		}

		$connection = $this->get_connection();
		$secret     = CredentialEncryption::decrypt( $connection['secret_enc'] );

		return null !== $secret
			? array(
				'site_id' => $connection['site_id'],
				'secret'  => $secret,
			)
			: null;
	}

	/**
	 * Connection status for the settings panel; never includes the secret.
	 * Asks VuloCloud whether the Organization has an AI key configured.
	 *
	 * @return array{connected: bool, configured: bool, credits: float, buy_credits_url: string}
	 */
	public function get_status(): array {
		$status = array(
			'connected'       => false,
			'configured'      => false,
			'credits'         => 0.0,
			'buy_credits_url' => '',
		);

		$credential = $this->get_site_credential();

		if ( ! $credential ) {
			return $status;
		}

		$status['connected'] = true;

		$result = $this->post( '/plugin/ai/status', $credential );

		if ( ! is_wp_error( $result ) && $result['http_status'] >= 200 && $result['http_status'] < 300 ) {
			$body                 = $result['body'];
			$status['configured'] = ! empty( $body['configured'] );

			$this->save_connection(
				array(
					'credits'         => (float) ( $body['credits'] ?? 0 ),
					'buy_credits_url' => esc_url_raw( (string) ( $body['buyCreditsUrl'] ?? '' ) ),
					'last_synced_at'  => current_time( 'mysql' ),
				)
			);
		}

		$connection                = $this->get_connection();
		$status['credits']         = round( (float) $connection['credits'], 3 );
		$status['buy_credits_url'] = (string) $connection['buy_credits_url'];

		return $status;
	}

	/**
	 * @return string
	 */
	public function get_redirect_uri(): string {
		return admin_url( 'admin-post.php?action=vulocart_connect_broker_callback' );
	}

	/**
	 * The URL that starts the connect flow, or null if this build has no VuloCloud URL.
	 *
	 * @return string|null
	 */
	public function get_authorize_url(): ?string {
		if ( ! $this->is_build_configured() ) {
			return null;
		}

		$params = array(
			'domain'             => home_url(),
			'returnUri'          => $this->get_redirect_uri(),
			'state'              => wp_create_nonce( self::NONCE_ACTION ),
			'soloOrganizationId' => defined( 'VULOCART_VULOCLOUD_HOST_ORGANIZATION_ID' ) ? trim( VULOCART_VULOCLOUD_HOST_ORGANIZATION_ID ) : '',
		);

		if ( '' === $params['soloOrganizationId'] ) {
			unset( $params['soloOrganizationId'] );
		}

		return untrailingslashit( VULOCART_VULOCLOUD_URL ) . '/plugin/connect/authorize?' . http_build_query( $params );
	}

	/**
	 * Redeems the broker's single-use code and stores the resulting credential.
	 *
	 * @param string $code Single-use exchange code from the broker's redirect.
	 * @return true|\WP_Error
	 */
	public function exchange_code( string $code ) {
		if ( ! $this->is_build_configured() ) {
			return new \WP_Error( 'vulocart_vulocloud_not_configured', __( 'VuloCloud isn’t configured for this build yet.', 'vulocart' ) );
		}

		$response = wp_remote_post(
			untrailingslashit( VULOCART_VULOCLOUD_URL ) . '/plugin/connect/exchange',
			array(
				'timeout' => 15,
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode(
					array(
						'domain' => home_url(),
						'code'   => $code,
					)
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		$body   = json_decode( (string) wp_remote_retrieve_body( $response ), true );

		if ( ! is_array( $body ) ) {
			return new \WP_Error(
				'vulocart_vulocloud_unparseable_response',
				sprintf(
					/* translators: %d: HTTP status code. */
					__( 'VuloCloud returned a non-JSON response (HTTP %d).', 'vulocart' ),
					$status
				)
			);
		}

		if ( $status < 200 || $status >= 300 || empty( $body['siteId'] ) || empty( $body['siteSecret'] ) ) {
			return new \WP_Error(
				'vulocart_vulocloud_exchange_failed',
				$body['message'] ?? $body['error'] ?? __( 'VuloCloud could not complete the connection.', 'vulocart' )
			);
		}

		$this->save_connection(
			array(
				'site_id'        => (string) $body['siteId'],
				'secret_enc'     => CredentialEncryption::encrypt( (string) $body['siteSecret'] ),
				'credits'        => (float) ( $body['credits'] ?? 0 ),
				'connected_at'   => current_time( 'mysql' ),
				'last_synced_at' => current_time( 'mysql' ),
			)
		);

		return true;
	}

	/**
	 * Revokes the credential on VuloCloud (best effort) and clears it locally.
	 *
	 * @return void
	 */
	public function disconnect(): void {
		$credential = $this->get_site_credential();

		if ( $credential ) {
			$result = $this->post( '/plugin/ai-credits/disconnect', $credential );

			if ( is_wp_error( $result ) ) {
				error_log( sprintf( '[VuloCart] Could not revoke ConnectedSite %s on disconnect: %s', $credential['site_id'], $result->get_error_message() ) ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- deliberate: a remote secret left un-revoked after a local disconnect is worth a site owner's server log.
			}
		}

		delete_option( self::OPTION_KEY );
	}

	/**
	 * Sends one prompt to the VuloCloud AI gateway.
	 *
	 * @param string      $feature    Surface name (e.g. 'catalog.draft') - the reporting category.
	 * @param string      $prompt     The full prompt text.
	 * @param string      $request_id Idempotency key.
	 * @param string|null $label      Human task name for the credit history.
	 * @return array{response: string, credits_used: float, credits_remaining: float}|\WP_Error
	 */
	public function execute( string $feature, string $prompt, string $request_id, ?string $label = null ) {
		if ( ! $this->is_build_configured() ) {
			return new \WP_Error( 'vulocart_vulocloud_not_configured', __( 'VuloCloud isn’t configured for this build yet.', 'vulocart' ), array( 'status' => 400 ) );
		}

		$credential = $this->get_site_credential();

		if ( ! $credential ) {
			return new \WP_Error( 'vulocart_vulocloud_not_connected', __( 'This site is not connected to VuloCloud. Connect it under Settings → Integrations.', 'vulocart' ), array( 'status' => 400 ) );
		}

		$body = array(
			'siteId'    => $credential['site_id'],
			'secret'    => $credential['secret'],
			'feature'   => substr( $feature, 0, 100 ),
			'prompt'    => $prompt,
			'requestId' => $request_id,
		);

		if ( null !== $label && '' !== trim( $label ) ) {
			$body['label'] = mb_substr( trim( $label ), 0, 120 );
		}

		$response = wp_remote_post(
			untrailingslashit( VULOCART_VULOCLOUD_URL ) . '/plugin/ai/prompt',
			array(
				'timeout' => 60,
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode( $body ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return new \WP_Error(
				'vulocart_vulocloud_unreachable',
				sprintf(
					/* translators: %s: underlying error message. */
					__( 'Could not reach VuloCloud: %s', 'vulocart' ),
					$response->get_error_message()
				),
				array( 'status' => 503 )
			);
		}

		$status  = (int) wp_remote_retrieve_response_code( $response );
		$decoded = json_decode( (string) wp_remote_retrieve_body( $response ), true );

		if ( ! is_array( $decoded ) ) {
			return new \WP_Error( 'vulocart_vulocloud_unparseable_response', __( 'VuloCloud returned an unexpected response.', 'vulocart' ), array( 'status' => 502 ) );
		}

		if ( $status < 200 || $status >= 300 ) {
			$error = (string) ( $decoded['error'] ?? '' );

			if ( 'AI_PROVIDER_NOT_CONFIGURED' === $error ) {
				return new \WP_Error( 'vulocart_vulocloud_ai_not_configured', __( 'Your Organization hasn’t configured an AI key yet.', 'vulocart' ), array( 'status' => $status ) );
			}

			if ( 'CONNECTED_SITE_REVOKED' === $error ) {
				delete_option( self::OPTION_KEY );

				return new \WP_Error( 'vulocart_vulocloud_site_revoked', __( 'This site’s VuloCloud connection was revoked. Please reconnect under Settings → Integrations.', 'vulocart' ), array( 'status' => $status ) );
			}

			return new \WP_Error( 'vulocart_vulocloud_gateway_error', __( 'VuloCloud could not process this AI request right now.', 'vulocart' ), array( 'status' => $status ) );
		}

		$remaining = (float) ( $decoded['creditsRemaining'] ?? 0 );

		if ( empty( $decoded['success'] ) ) {
			$this->save_connection(
				array(
					'credits'         => $remaining,
					'buy_credits_url' => esc_url_raw( (string) ( $decoded['buyCreditsUrl'] ?? '' ) ),
					'last_synced_at'  => current_time( 'mysql' ),
				)
			);

			return new \WP_Error( 'vulocart_ai_insufficient_credits', __( 'You don’t have enough AI credits to complete this request.', 'vulocart' ), array( 'status' => 402 ) );
		}

		$this->save_connection(
			array(
				'credits'        => $remaining,
				'last_synced_at' => current_time( 'mysql' ),
			)
		);

		return array(
			'response'          => (string) ( $decoded['response'] ?? '' ),
			'credits_used'      => (float) ( $decoded['creditsUsed'] ?? 0 ),
			'credits_remaining' => $remaining,
		);
	}

	/**
	 * Site-secret-authenticated POST used by the status/disconnect endpoints.
	 *
	 * @param string                                 $path       e.g. '/plugin/ai/status'.
	 * @param array{site_id: string, secret: string} $credential Decrypted credential.
	 * @return array{http_status: int, body: array<string, mixed>}|\WP_Error
	 */
	private function post( string $path, array $credential ) {
		if ( ! $this->is_build_configured() ) {
			return new \WP_Error( 'vulocart_vulocloud_not_configured', __( 'VuloCloud isn’t configured for this build yet.', 'vulocart' ) );
		}

		$response = wp_remote_post(
			untrailingslashit( VULOCART_VULOCLOUD_URL ) . $path,
			array(
				'timeout' => 15,
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode(
					array(
						'siteId' => $credential['site_id'],
						'secret' => $credential['secret'],
					)
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$decoded = json_decode( (string) wp_remote_retrieve_body( $response ), true );

		if ( ! is_array( $decoded ) ) {
			return new \WP_Error( 'vulocart_vulocloud_unparseable_response', __( 'VuloCloud returned a non-JSON response.', 'vulocart' ) );
		}

		return array(
			'http_status' => (int) wp_remote_retrieve_response_code( $response ),
			'body'        => $decoded,
		);
	}
}
