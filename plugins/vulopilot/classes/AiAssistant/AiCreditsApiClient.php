<?php
namespace VuloPilot\AiAssistant;

use VuloPilot\AiAssistant\AiRequestSender;
use VuloPilot\Dashboard\ActivityLogRepository;
use VuloPilot\Utill;
use VuloPilot\Utill\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * HTTP client for VuloCloud's own `ai-credits` bounded context
 * (`contexts/vulopilot/ai-credits` in the vulocloud repo):
 * `POST /plugin/ai-credits/balance` (site-secret authenticated, called
 * repeatedly to refresh the cached balance display) and
 * `POST /plugin/ai-credits/disconnect` (same site-secret auth). The real
 * ConnectedSite credential itself comes from
 * AiCreditsConnection::exchange_broker_code() (ConnectBrokerClient's own
 * passwordless exchange), not from a connect-site call on this client.
 *
 * Same `wp_remote_post()` + "completed round trip vs genuine network
 * failure" split every other VuloCloud client in this plugin already uses
 * (License\LicenseApiClient) - ported here rather than reused directly
 * since each of those lives in its own bounded-context concern.
 *
 * @class       AiCreditsApiClient class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AiCreditsApiClient {

    /**
     * VuloCloud's own base URL, e.g. http://localhost:3000 (no trailing slash).
     *
     * @var string
     */
    private $base_url;

    /**
     * Constructor.
     *
     * @param string $base_url VuloCloud's own base URL (VULOPILOT_VULOCLOUD_URL).
     */
    public function __construct( $base_url ) {
        $this->base_url = untrailingslashit( $base_url );
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
