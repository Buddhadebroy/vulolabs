<?php
/**
 * GoogleOAuthBrokerClient class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

defined( 'ABSPATH' ) || exit;

/**
 * HTTP client for VuloCloud's `/plugin/google/*` broker endpoints — the
 * real fix for the "Redirect URI scaling" trade-off documented in
 * config.php: VuloCloud holds the ONE Google Cloud OAuth Client actually
 * registered with Google (its own fixed, permanently-registered redirect
 * URI), so no customer domain ever needs adding to a Google-side
 * allowlist. See GOOGLE_CONNECT_BROKER.md (this plugin's own root) for
 * the full contract VuloCloud's server side must implement.
 *
 * Only the token exchange/refresh legs are real server-to-server calls
 * from here — the authorize leg (`get_authorize_url()`) is a plain URL
 * build for the browser to navigate to; VuloCloud itself does the actual
 * 302 to accounts.google.com, same "browser does the 3-way dance, server
 * only handles the token leg" shape GoogleServicesConnection already
 * uses talking to Google directly.
 *
 * Mirrors vulopilot-pro's LicenseApiClient (wp_remote_post(), JSON
 * body/response, WP_Error only for a genuine transport failure) — kept
 * as its own class for the same reason: GoogleServicesConnection stays
 * the one place that decides direct-vs-broker, this class only knows how
 * to talk to the broker once that decision is made.
 *
 * @class       GoogleOAuthBrokerClient class
 * @version     1.0.0
 * @author      VuloLabs
 */
class GoogleOAuthBrokerClient {

	/** @var string e.g. https://cloud.vulolabs.com (no trailing slash) */
	private $broker_url;

	public function __construct( string $broker_url ) {
		$this->broker_url = untrailingslashit( $broker_url );
	}

	/**
	 * Browser-facing URL only — VuloCloud itself 302s this straight to
	 * accounts.google.com (using the Organization that owns
	 * `$application_id`'s own Google Cloud OAuth Client) after recording
	 * `$return_uri` (this site's own admin-post.php callback) against a
	 * broker-generated correlation id, so it knows where to send the
	 * browser back once Google redirects to VuloCloud's own fixed
	 * callback. `$state` is this site's own opaque CSRF nonce
	 * (GoogleServicesConnection::encode_state()) — VuloCloud never
	 * inspects it, only echoes it back verbatim on the return redirect,
	 * exactly like Google's own `state` param already does for the
	 * direct-connect flow.
	 *
	 * `$application_id` is this site's own registered VuloCloud
	 * LicenseApplication id (VULOPILOT_GOOGLE_APPLICATION_ID) — how
	 * VuloCloud resolves WHICH Organization's Google Client to use, since
	 * this request carries no session/auth of its own. Query param names
	 * are camelCase, matching every other new VuloCloud request contract
	 * (see GOOGLE_CONNECT_INTEGRATION.md §5) — only exchange()/refresh()'s
	 * *response* bodies stay snake_case, for the OAuth2-standard-field-
	 * names reason documented on post() below.
	 *
	 * @return string
	 */
	public function get_authorize_url( string $application_id, string $domain, string $return_uri, string $state ): string {
		return $this->broker_url . '/plugin/google/authorize?' . http_build_query(
			array(
				'applicationId' => $application_id,
				'domain'        => $domain,
				'returnUri'     => $return_uri,
				'state'         => $state,
			)
		);
	}

	/**
	 * Real `POST {broker}/plugin/google/exchange` — redeems the
	 * single-use, short-lived `code` VuloCloud's own redirect handed back
	 * to this site's admin-post.php callback for the real Google tokens
	 * VuloCloud obtained on this site's behalf. Google's `refresh_token`
	 * is only ever present on a subject's very first consent — same
	 * caveat GoogleServicesConnection::exchange_code_for_tokens() already
	 * documents for the direct flow, unchanged by going through a broker.
	 *
	 * @return array{access_token: string, refresh_token: string, expires_in: int}|\WP_Error
	 */
	public function exchange( string $domain, string $code ) {
		return $this->post(
			'/plugin/google/exchange',
			array(
				'domain' => $domain,
				'code'   => $code,
			),
			'vulopilot_google_broker_exchange_failed',
			__( 'Google connect broker could not complete the token exchange.', 'vulopilot' )
		);
	}

	/**
	 * Real `POST {broker}/plugin/google/refresh` — used instead of a
	 * direct `grant_type=refresh_token` call to Google whenever the
	 * stored connection's tokens were originally issued via this broker
	 * (GoogleServicesConnection::refresh_access_token()'s own `via`
	 * check): a refresh token is only valid against the OAuth Client that
	 * issued it, and a broker-issued one belongs to the Organization's own
	 * Google Client that `$application_id` resolves to, not this build's
	 * embedded VULOPILOT_GOOGLE_CLIENT_ID/SECRET. `$application_id` is
	 * required here for the same reason it's required by
	 * get_authorize_url() — a bare refresh token doesn't say which
	 * Organization's Client it belongs to.
	 *
	 * @return array{access_token: string, expires_in: int}|\WP_Error
	 */
	public function refresh( string $application_id, string $domain, string $refresh_token ) {
		return $this->post(
			'/plugin/google/refresh',
			array(
				'applicationId' => $application_id,
				'domain'        => $domain,
				'refreshToken'  => $refresh_token,
			),
			'vulopilot_google_broker_refresh_failed',
			__( 'Google connect broker could not refresh the access token.', 'vulopilot' )
		);
	}

	/**
	 * Shared POST/parse/error-shape plumbing for exchange()/refresh() —
	 * both endpoints return the same access_token/expires_in envelope
	 * (refresh_token only present on exchange()'s response), so both can
	 * share one request path. Response fields stay snake_case
	 * (access_token/refresh_token/expires_in) even though every request
	 * this class sends is now camelCase — deliberate, matches OAuth2's
	 * own RFC 6749 §5.1 field names, and VuloCloud's
	 * GoogleBrokerController maps its responses to match this parsing
	 * unchanged (see GOOGLE_CONNECT_INTEGRATION.md §5).
	 *
	 * @param string $path             e.g. '/plugin/google/exchange'.
	 * @param array  $body              JSON-encoded request body.
	 * @param string $error_code        WP_Error code on a completed-but-unsuccessful response.
	 * @param string $default_message   WP_Error message when the broker's own response carries none.
	 * @return array<string, mixed>|\WP_Error
	 */
	private function post( string $path, array $body, string $error_code, string $default_message ) {
		$response = wp_remote_post(
			$this->broker_url . $path,
			array(
				'timeout' => 15,
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode( $body ),
			)
		);

		if ( is_wp_error( $response ) ) {
			// DNS failure, connection refused, timeout, ... — the request
			// never got a response at all.
			return $response;
		}

		$status        = (int) wp_remote_retrieve_response_code( $response );
		$response_body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

		if ( ! is_array( $response_body ) ) {
			return new \WP_Error(
				'vulopilot_google_broker_unparseable_response',
				sprintf(
					/* translators: %d: HTTP status code. */
					__( 'Google connect broker returned a non-JSON response (HTTP %d).', 'vulopilot' ),
					$status
				)
			);
		}

		if ( $status < 200 || $status >= 300 || empty( $response_body['access_token'] ) ) {
			return new \WP_Error(
				$error_code,
				$response_body['message'] ?? $response_body['error'] ?? $default_message
			);
		}

		return array(
			'access_token'  => $response_body['access_token'],
			'refresh_token' => $response_body['refresh_token'] ?? '',
			'expires_in'    => (int) ( $response_body['expires_in'] ?? 3600 ),
		);
	}
}
