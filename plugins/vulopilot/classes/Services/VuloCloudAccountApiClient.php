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
 * Also implements `/auth/register`, `/auth/refresh`, `GET /auth/organizations`,
 * and `POST /organizations` — added for AI Credits (Services\AiCreditsConnection),
 * the first real caller that needs to actually act on VuloCloud with the
 * stored token rather than just proving login succeeded. `/auth/refresh`
 * specifically closes the gap this class's docblock used to flag ("nothing
 * downstream actually calls VuloCloud with the stored access token today")
 * — a real access token is short-lived (VuloCloud's own default: 15
 * minutes), so anything that wants to make an authenticated call later
 * needs a way to mint a fresh one from the stored refresh token.
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
     * `POST /auth/register` — creates a bare VuloCloud User with no
     * Organization membership yet (confirmed live against the real
     * vulocloud dev API: the response is just a safe user view, no
     * tokens) — the caller must still call `login()` afterward to get a
     * real access/refresh token pair.
     *
     * @param string $email
     * @param string $password
     * @return array|\WP_Error
     */
    public function register( $email, $password ) {
        return $this->request( '/auth/register', array( 'email' => $email, 'password' => $password ) );
    }

    /**
     * `POST /auth/refresh` — mints a fresh access/refresh token pair from
     * a stored refresh token, no Authorization header required (`@Public()`
     * on the vulocloud side). VuloCloud rotates the refresh token on every
     * call, so the caller must persist the NEW `refreshToken` this returns,
     * not keep reusing the old one.
     *
     * @param string $refresh_token
     * @return array|\WP_Error
     */
    public function refresh( $refresh_token ) {
        return $this->request( '/auth/refresh', array( 'refreshToken' => $refresh_token ) );
    }

    /**
     * `GET /auth/organizations` — every Organization the authenticated
     * user is a member of. Implemented as a POST-shaped `request()` call
     * with no body since this class's own `request()` helper is
     * POST-only (matches every other call site here) — the vulocloud
     * route itself only accepts GET, so this uses wp_remote_get() directly
     * rather than forcing `request()` to support a second HTTP verb for
     * this one caller.
     *
     * @param string $access_token
     * @return array|\WP_Error
     */
    public function list_organizations( $access_token ) {
        $response = wp_remote_get(
            $this->base_url . '/auth/organizations',
            array(
                'timeout' => 10,
                'headers' => array( 'Authorization' => 'Bearer ' . $access_token ),
            )
        );

        return $this->decode_response( $response );
    }

    /**
     * `POST /organizations` — self-service Organization creation
     * (confirmed live: any authenticated user can create one and becomes
     * its OWNER in the same call). Used by AiCreditsConnection to give a
     * brand-new VuloCloud user somewhere for their AI credit wallet to
     * live, when `list_organizations()` came back empty.
     *
     * @param string $access_token
     * @param string $name
     * @return array|\WP_Error
     */
    public function create_organization( $access_token, $name ) {
        return $this->request( '/organizations', array( 'name' => $name ), $access_token );
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

        return $this->decode_response( $response );
    }

    /**
     * Shared "completed round trip vs genuine network failure" decoding —
     * extracted out of request() so list_organizations()'s own
     * wp_remote_get() call (the one GET in this otherwise POST-only
     * client) doesn't have to duplicate it.
     *
     * @param array|\WP_Error $response A wp_remote_get()/wp_remote_post() return value.
     * @return array|\WP_Error
     */
    private function decode_response( $response ) {
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
