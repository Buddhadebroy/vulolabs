<?php
/**
 * AiCreditsApiClient class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

defined( 'ABSPATH' ) || exit;

/**
 * HTTP client for VuloCloud's own `ai-credits` bounded context
 * (`contexts/vulopilot/ai-credits` in the vulocloud repo):
 * `POST /plugin/ai-credits/connect-site` (human-JWT authenticated, called
 * once at connect time) and `POST /plugin/ai-credits/balance` (site-secret
 * authenticated, called repeatedly to refresh the cached balance display).
 *
 * Same `wp_remote_post()` + "completed round trip vs genuine network
 * failure" split every other VuloCloud client in this plugin already uses
 * (VuloCloudAccountApiClient, License\LicenseApiClient) — ported here
 * rather than reused directly since each of those lives in its own
 * bounded-context concern.
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
     * `POST /plugin/ai-credits/connect-site` — human-authenticated
     * (the site owner's own VuloCloud access token, staff or Customer —
     * the endpoint resolves either, see the vulocloud side's own
     * ai-credits-plugin.controller.ts docblock). Response, on success:
     * `{ siteId, siteSecret, credits }` — `siteSecret` is plaintext,
     * present in this one response only.
     *
     * @param string      $access_token    The site owner's own VuloCloud access token (staff or Customer).
     * @param string|null $organization_id Agency path only — omitted (null)
     *                                      for a Customer token, whose own
     *                                      parent Organization is already
     *                                      implied server-side.
     * @param string      $url             This site's home_url().
     * @param string      $plugin_slug     e.g. 'vulopilot'.
     * @return array|\WP_Error
     */
    public function connect_site( $access_token, $organization_id, $url, $plugin_slug ) {
        $body = array(
            'url'        => $url,
            'pluginSlug' => $plugin_slug,
        );

        if ( ! empty( $organization_id ) ) {
            $body['organizationId'] = $organization_id;
        }

        return $this->request( '/plugin/ai-credits/connect-site', $body, $access_token );
    }

    /**
     * `POST organizations/{host_organization_id}/portal/auth/register` —
     * VuloCloud's Customer Portal self-service registration
     * (contexts/customer), used only by the solo-site-owner path
     * (AiCreditsConnection::connect_and_claim(), `$as_customer = true`).
     * Returns no tokens (same as VuloCloudAccountConnection's own agency-side
     * `/auth/register`) — the caller still calls portal_login() afterward.
     *
     * @param string $host_organization_id The one fixed Organization solo Customers register under (VULOPILOT_VULOCLOUD_HOST_ORGANIZATION_ID).
     * @param string $email                Customer account email.
     * @param string $password             Customer account password.
     * @param string $first_name           Required by the Customer Portal's own register DTO.
     * @param string $last_name            Required by the Customer Portal's own register DTO.
     * @return array|\WP_Error
     */
    public function portal_register( $host_organization_id, $email, $password, $first_name, $last_name ) {
        return $this->request(
            '/organizations/' . rawurlencode( $host_organization_id ) . '/portal/auth/register',
            array(
                'email'     => $email,
                'password'  => $password,
                'firstName' => $first_name,
                'lastName'  => $last_name,
            )
        );
    }

    /**
     * `POST organizations/{host_organization_id}/portal/auth/login` —
     * Response, on success: `{ accessToken, refreshToken, customer }`. The
     * access token is used once, immediately, to call connect_site() —
     * never persisted by this client (AiCreditsConnection only ever stores
     * the resulting ConnectedSite credential, same as the agency path).
     *
     * @param string $host_organization_id The one fixed Organization solo Customers register under (VULOPILOT_VULOCLOUD_HOST_ORGANIZATION_ID).
     * @param string $email                Customer account email.
     * @param string $password             Customer account password.
     * @return array|\WP_Error
     */
    public function portal_login( $host_organization_id, $email, $password ) {
        return $this->request(
            '/organizations/' . rawurlencode( $host_organization_id ) . '/portal/auth/login',
            array(
                'email'    => $email,
                'password' => $password,
            )
        );
    }

    /**
     * `POST /plugin/ai-credits/balance` — site-secret authenticated
     * (no human token involved). Response, on success:
     * `{ credits, lifetimeEarned, lifetimeUsed }`.
     *
     * @param string $site_id The ConnectedSite id returned by connect_site().
     * @param string $secret  The plaintext site secret returned by connect_site().
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
