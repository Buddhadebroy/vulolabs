<?php
/**
 * VuloCloudAccountApiClient class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

defined( 'ABSPATH' ) || exit;

/**
 * HTTP client for the two real endpoints VuloCloudAccountConnection needs
 * from VuloCloud's own `identity-access` bounded context
 * (`contexts/identity-access/interfaces/http/auth.controller.ts` in the
 * vulocloud repo): `POST /auth/login` (public, rate-limited, no auth
 * required to call it) and `POST /auth/logout` (best-effort, needs the
 * access token this class never keeps around itself).
 *
 * Same `wp_remote_post()` + "completed round trip vs genuine network
 * failure" split as License\LicenseApiClient.php (vulopilot-pro) — ported
 * here rather than reused directly since that class lives in a different
 * plugin's own namespace and this feature has nothing to do with a
 * license (see this plugin's own config.php docblock on
 * VULOPILOT_VULOCLOUD_URL for why this is a separate constant/client).
 *
 * Deliberately does NOT implement `/auth/refresh` or `/auth/me` yet —
 * nothing downstream actually calls VuloCloud with the stored access
 * token today (this feature's only real job right now is answering
 * useContentGate.tsx's "log in" tier), so VuloCloudAccountConnection's own
 * `is_connected()` treats the stored refresh token's mere presence as
 * "connected" rather than tracking real access-token expiry. Add
 * `refresh()` here first if a future caller needs to actually make an
 * authenticated VuloCloud API call on this site's behalf.
 *
 * @class       VuloCloudAccountApiClient class
 * @version     1.0.0
 * @author      VuloLabs
 */
class VuloCloudAccountApiClient {

    /** @var string e.g. http://localhost:3000 (no trailing slash) */
    private $base_url;

    public function __construct( $base_url ) {
        $this->base_url = untrailingslashit( $base_url );
    }

    /**
     * `POST /auth/login` — `email`/`password` required, `twoFactorCode`
     * only sent at all when non-empty (an empty string in the body would
     * still be a defined property, and the account might not even have
     * 2FA enabled).
     *
     * @param string $email
     * @param string $password
     * @param string $two_factor_code
     * @return array|\WP_Error {
     *   On any completed HTTP round trip (2xx OR a business 4xx, e.g.
     *   INVALID_CREDENTIALS/TWO_FACTOR_REQUIRED/ACCOUNT_LOCKED — see
     *   identity.errors.ts in the vulocloud repo): array{ http_status: int, body: array }
     *   On a genuine network/connectivity failure, or a non-JSON
     *   response: WP_Error — same split LicenseApiClient::validate()
     *   already documents, for the same reason.
     * }
     */
    public function login( $email, $password, $two_factor_code = '' ) {
        $body = array(
            'email'    => $email,
            'password' => $password,
        );

        if ( '' !== $two_factor_code ) {
            $body['twoFactorCode'] = $two_factor_code;
        }

        return $this->request( '/auth/login', $body );
    }

    /**
     * Best-effort — VuloCloudAccountConnection::disconnect() clears the
     * local connection either way, so a failure here (expired token,
     * network error, VuloCloud already invalidated the session) never
     * blocks disconnecting on this site's own side.
     *
     * @param string $access_token
     * @param string $refresh_token
     * @return array|\WP_Error
     */
    public function logout( $access_token, $refresh_token ) {
        return $this->request( '/auth/logout', array( 'refreshToken' => $refresh_token ), $access_token );
    }

    /**
     * @param string $path         e.g. '/auth/login'
     * @param array  $body
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
                'timeout' => 10,
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
                'vulopilot_vulocloud_unparseable_response',
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
