<?php
namespace VuloPilot\AiAssistant;

defined( 'ABSPATH' ) || exit;

/**
 * HTTP client for VuloCloud's `/plugin/connect/*` broker endpoints (the
 * passwordless "Connect to VuloCloud" flow) and its `ai-credits` bounded
 * context (`contexts/vulopilot/ai-credits` in the vulocloud repo). Merged
 * from this plugin's former ConnectBrokerClient.php and
 * AiCreditsApiClient.php - both were thin HTTP clients hit only by
 * AiCreditsConnection.php, for two stages of the same VuloCloud connection
 * (connect, then read/manage the resulting credential), so one client class
 * for both.
 *
 * `get_authorize_url()`/`exchange()` mirror GoogleOAuthBrokerClient exactly
 * (same "authorize is a plain URL build, only exchange is a real
 * server-to-server call" shape). `get_balance()`/`disconnect_site()` are
 * site-secret authenticated (no human token involved) - the real
 * ConnectedSite credential itself comes from exchange(), not from a
 * connect-site call on this client.
 *
 * AiCreditsConnection constructs this with different base URLs for
 * different calls: a browser-facing URL for get_authorize_url() (must be
 * reachable from the site owner's own browser, e.g. VULOPILOT_VULOCLOUD_PUBLIC_URL
 * in local Docker dev), and VULOPILOT_VULOCLOUD_URL (server-to-server) for
 * everything else.
 *
 * @class       VuloCloudApiClient class
 * @version     1.0.0
 * @author      VuloLabs
 */
class VuloCloudApiClient {

	/** @var string e.g. https://cloud.vulolabs.com (no trailing slash) */
	private $base_url;

	public function __construct( string $base_url ) {
		$this->base_url = untrailingslashit( $base_url );
	}

	/**
	 * Browser-facing URL only - VuloCloud itself records `$return_uri`
	 * (this site's own admin-post.php callback) against a broker-generated
	 * correlation id and 302s straight to its own hosted login/signup page,
	 * so it knows where to send the browser back once a human actually
	 * authenticates there. `$state` is this site's own opaque CSRF nonce
	 * (AiCreditsConnection::encode_state()) - VuloCloud never inspects it,
	 * only echoes it back verbatim on the return redirect.
	 *
	 * `$solo_organization_id` is omitted from the query entirely when
	 * empty - VULOPILOT_VULOCLOUD_HOST_ORGANIZATION_ID's own docblock: the
	 * "solo site owner" choice is simply unavailable on a build that hasn't
	 * set it, and the hosted page only offers that choice when this param
	 * is actually present. `AiCreditsConnection` is the one caller of
	 * this legacy shape and never passes the three new params below.
	 *
	 * `$plugin_id`/`$organization_id`/`$brand_id` are a generic "connect
	 * to a pre-known Organization + Brand" shape, currently unused (no
	 * caller passes them) but kept alongside the legacy shape above for
	 * a future connection that needs it - all three optional here purely
	 * so this one method can serve both shapes; `$plugin_id`+`$organization_id`
	 * are required
	 * together server-side (see ConnectBrokerAuthorizeQueryDto's own
	 * doc comment on the vulocloud side), `$brand_id` independently
	 * optional. Omitted from the query entirely when empty, same
	 * "unavailable, not silently blank" treatment `$solo_organization_id`
	 * already gets.
	 *
	 * @param string $domain               This site's own home_url().
	 * @param string $return_uri            This site's own admin-post.php callback.
	 * @param string $state                 This site's own opaque CSRF nonce.
	 * @param string $solo_organization_id  Legacy shape - VULOPILOT_VULOCLOUD_HOST_ORGANIZATION_ID, or ''.
	 * @param string $plugin_id             Generic shape - this plugin's own identity, or ''.
	 * @param string $organization_id       Generic shape - the pre-known Organization to connect to, or ''.
	 * @param string $brand_id              Generic shape - the pre-known Brand to connect to, or ''.
	 * @return string
	 */
	public function get_authorize_url( string $domain, string $return_uri, string $state, string $solo_organization_id, string $plugin_id = '', string $organization_id = '', string $brand_id = '' ): string {
		$params = array(
			'domain'    => $domain,
			'returnUri' => $return_uri,
			'state'     => $state,
		);

		if ( '' !== $solo_organization_id ) {
			$params['soloOrganizationId'] = $solo_organization_id;
		}

		if ( '' !== $plugin_id ) {
			$params['pluginId'] = $plugin_id;
		}

		if ( '' !== $organization_id ) {
			$params['organizationId'] = $organization_id;
		}

		if ( '' !== $brand_id ) {
			$params['brandId'] = $brand_id;
		}

		return $this->base_url . '/plugin/connect/authorize?' . http_build_query( $params );
	}

	/**
	 * Real `POST {broker}/plugin/connect/exchange` - redeems the
	 * single-use, short-lived `code` VuloCloud's own redirect handed back
	 * to this site's admin-post.php callback for the real ConnectedSite
	 * credential VuloCloud minted on this site's behalf (via whichever
	 * human actually logged in/registered on its own hosted page).
	 *
	 * @return array{siteId: string, siteSecret: string, credits: int}|\WP_Error
	 */
	public function exchange( string $domain, string $code ) {
		$response = wp_remote_post(
			$this->base_url . '/plugin/connect/exchange',
			array(
				'timeout' => 15,
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode(
					array(
						'domain' => $domain,
						'code'   => $code,
					)
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			// DNS failure, connection refused, timeout, ... - the request never got a response at all.
			return $response;
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		$body   = json_decode( (string) wp_remote_retrieve_body( $response ), true );

		if ( ! is_array( $body ) ) {
			return new \WP_Error(
				'vulopilot_connect_broker_unparseable_response',
				sprintf(
					/* translators: %d: HTTP status code. */
					__( 'Connect broker returned a non-JSON response (HTTP %d).', 'vulopilot' ),
					$status
				)
			);
		}

		if ( $status < 200 || $status >= 300 || empty( $body['siteId'] ) || empty( $body['siteSecret'] ) ) {
			return new \WP_Error(
				'vulopilot_connect_broker_exchange_failed',
				$body['message'] ?? $body['error'] ?? __( 'Connect broker could not complete the connection.', 'vulopilot' )
			);
		}

		return array(
			'siteId'     => (string) $body['siteId'],
			'siteSecret' => (string) $body['siteSecret'],
			'credits'    => (int) ( $body['credits'] ?? 0 ),
		);
	}

	/**
	 * `POST /plugin/ai-credits/balance` - site-secret authenticated
	 * (no human token involved). Response, on success:
	 * `{ credits, lifetimeEarned, lifetimeUsed }`.
	 *
	 * @param string $site_id The ConnectedSite id from AiCreditsConnection::exchange_broker_code()'s own stored connection.
	 * @param string $secret  The plaintext site secret from that same stored connection.
	 * @return array|\WP_Error
	 */
	public function get_balance( $site_id, $secret ) {
		return $this->request(
			'/plugin/ai-credits/balance',
			array(
				'siteId' => $site_id,
				'secret' => $secret,
			)
		);
	}

	/**
	 * `POST /plugin/ai-credits/disconnect` - site-secret authenticated,
	 * same shape as get_balance() above (no human token). Real
	 * self-service revoke on VuloCloud's own side (ConnectedSiteService::revokeBySite()),
	 * not just a local option clear.
	 *
	 * @param string $site_id The ConnectedSite id from AiCreditsConnection::exchange_broker_code()'s own stored connection.
	 * @param string $secret  The plaintext site secret from that same stored connection.
	 * @return array|\WP_Error
	 */
	public function disconnect_site( $site_id, $secret ) {
		return $this->request(
			'/plugin/ai-credits/disconnect',
			array(
				'siteId' => $site_id,
				'secret' => $secret,
			)
		);
	}

	/**
	 * Shared POST + "completed round trip vs genuine network failure" split.
	 *
	 * @param string $path         e.g. '/plugin/ai-credits/balance'.
	 * @param array  $body         Request body, JSON-encoded.
	 * @param string $access_token Sent as a Bearer token when non-empty.
	 * @return array|\WP_Error
	 */
	private function request( $path, array $body, $access_token = '' ) {
		$headers = array( 'Content-Type' => 'application/json' );

		if ( '' !== $access_token ) {
			$headers['Authorization'] = 'Bearer ' . $access_token;
		}

		$response = wp_remote_post(
			$this->base_url . $path,
			array(
				'timeout' => 15,
				'headers' => $headers,
				'body'    => wp_json_encode( $body ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$status   = (int) wp_remote_retrieve_response_code( $response );
		$raw_body = wp_remote_retrieve_body( $response );
		$decoded  = json_decode( $raw_body, true );

		if ( ! is_array( $decoded ) ) {
			return new \WP_Error(
				'vulopilot_ai_credits_unparseable_response',
				sprintf(
					/* translators: %d: HTTP status code. */
					__( 'VuloCloud returned a non-JSON response (HTTP %d).', 'vulopilot' ),
					$status
				)
			);
		}

		return array(
			'http_status' => $status,
			'body'        => $decoded,
		);
	}
}
