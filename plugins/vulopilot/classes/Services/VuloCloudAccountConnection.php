<?php
/**
 * VuloCloudAccountConnection class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

defined( 'ABSPATH' ) || exit;

/**
 * The real "log in to your VuloCloud account" connection
 * useContentGate.tsx's own docblock used to say didn't exist yet — a
 * *person* signing into the VuloCloud platform from this WP admin (via
 * VuloCloudAccountApiClient's `POST /auth/login`), a different concept
 * from `appLocalizer.khali_dabba` (vulopilot-pro's own site-wide Product
 * ID/License Key, a different bounded context entirely — see this
 * plugin's own config.php docblock on VULOPILOT_VULOCLOUD_URL).
 *
 * Storage is one dedicated `vulopilot_vulocloud_account` option, same
 * "never round-trips to the browser, secrets encrypted at rest" posture
 * GoogleServicesConnection.php already established for its own OAuth
 * tokens (CredentialEncryption, same as that class) — `get_status()`
 * below never returns a raw token, only `connected`/`email`/`connected_at`.
 *
 * `is_connected()` treats a stored refresh token as "connected" rather
 * than tracking real access-token expiry. A refresh token revoked
 * server-side (e.g. the person changed their VuloCloud password) would
 * still read `connected: true` here until they explicitly disconnect —
 * the same honest limitation GoogleServicesConnection.php's own
 * `get_status()` docblock flags for its own stored refresh token, not a
 * new gap this class introduces.
 *
 * `get_valid_access_token()` (added for Services\AiCreditsConnection, the
 * first real caller that needs to make an authenticated VuloCloud API
 * call on this site owner's behalf) tracks real access-token expiry via
 * `token_expires_at`, same `EXPIRY_SAFETY_MARGIN`-before-refresh shape
 * GoogleServicesConnection::get_valid_access_token() already established
 * for Google's own tokens — read straight out of the JWT's own `exp`
 * claim (decode_jwt_expiry() below) rather than trusting an `expiresIn`
 * field, since VuloCloud's `/auth/login`/`/auth/refresh` responses don't
 * actually return one (confirmed live against the real dev API).
 *
 * @class       VuloCloudAccountConnection class
 * @version     1.0.0
 * @author      VuloLabs
 */
class VuloCloudAccountConnection {

    private const OPTION_KEY = 'vulopilot_vulocloud_account';

    /**
     * Same reasoning as GoogleServicesConnection::EXPIRY_SAFETY_MARGIN —
     * refresh a minute early so a request never races an in-flight expiry.
     */
    private const EXPIRY_SAFETY_MARGIN = 60;

    /**
     * @return array<string, mixed>
     */
    private function get_connection(): array {
        return wp_parse_args(
            get_option( self::OPTION_KEY, array() ),
            array(
                'access_token_enc'  => '',
                'refresh_token_enc' => '',
                'token_expires_at'  => 0,
                'email'             => '',
                'connected_at'      => '',
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
    public function is_connected(): bool {
        return '' !== $this->get_connection()['refresh_token_enc'];
    }

    /**
     * Never a token — see this class's own docblock.
     *
     * @return array{connected: bool, email: string, connected_at: string}
     */
    public function get_status(): array {
        $connection = $this->get_connection();

        return array(
            'connected'    => $this->is_connected(),
            'email'        => $connection['email'],
            'connected_at' => $connection['connected_at'],
        );
    }

    /**
     * @param string $email
     * @param string $password
     * @param string $two_factor_code
     * @return array{connected: bool, email: string, connected_at: string}|\WP_Error {
     *   A WP_Error's own `error_code` is `vulopilot_vulocloud_` followed
     *   by VuloCloud's own lowercased `error` code (e.g.
     *   `vulopilot_vulocloud_invalid_credentials`,
     *   `vulopilot_vulocloud_two_factor_required`) — Rest.php's own
     *   `connect()` passes this straight through as the REST error code,
     *   so the React side can special-case
     *   `vulopilot_vulocloud_two_factor_required` (prompt for a code and
     *   resubmit) without string-matching the human-readable message.
     * }
     */
    public function connect( string $email, string $password, string $two_factor_code = '' ) {
        if ( '' === trim( VULOPILOT_VULOCLOUD_URL ) ) {
            return new \WP_Error(
                'vulopilot_vulocloud_not_configured',
                __( 'VuloCloud isn’t configured for this build yet.', 'vulopilot' ),
                array( 'status' => 400 )
            );
        }

        $client = new VuloCloudAccountApiClient( VULOPILOT_VULOCLOUD_URL );
        $result = $client->login( $email, $password, $two_factor_code );

        if ( is_wp_error( $result ) ) {
            return new \WP_Error(
                'vulopilot_vulocloud_unreachable',
                sprintf(
                    /* translators: %s: underlying error message. */
                    __( 'Could not reach VuloCloud: %s', 'vulopilot' ),
                    $result->get_error_message()
                ),
                array( 'status' => 503 )
            );
        }

        $status = $result['http_status'];
        $body   = $result['body'];

        if ( $status < 200 || $status >= 300 ) {
            $vulocloud_code = isset( $body['error'] ) ? strtolower( $body['error'] ) : 'connect_failed';

            return new \WP_Error(
                'vulopilot_vulocloud_' . $vulocloud_code,
                isset( $body['message'] ) ? $body['message'] : __( 'Could not connect to VuloCloud.', 'vulopilot' ),
                array( 'status' => $status )
            );
        }

        $access_token = (string) ( $body['accessToken'] ?? '' );

        $this->save_connection(
            array(
                'access_token_enc'  => CredentialEncryption::encrypt( $access_token ),
                'refresh_token_enc' => CredentialEncryption::encrypt( (string) ( $body['refreshToken'] ?? '' ) ),
                'token_expires_at'  => self::decode_jwt_expiry( $access_token ),
                'email'             => (string) ( $body['user']['email'] ?? $email ),
                'connected_at'      => current_time( 'mysql' ),
            )
        );

        return $this->get_status();
    }

    /**
     * `POST /auth/register` then `login()` — VuloCloud's own register
     * endpoint returns no tokens (confirmed live: a bare safe-user view),
     * so creating a brand-new account still needs an immediate follow-up
     * login to actually establish a connection. Reuses connect()'s own
     * error-mapping for the login half so a failure here surfaces through
     * the exact same `vulopilot_vulocloud_*` error-code convention.
     *
     * @param string $email
     * @param string $password
     * @return array{connected: bool, email: string, connected_at: string}|\WP_Error
     */
    public function register( string $email, string $password ) {
        if ( '' === trim( VULOPILOT_VULOCLOUD_URL ) ) {
            return new \WP_Error(
                'vulopilot_vulocloud_not_configured',
                __( 'VuloCloud isn’t configured for this build yet.', 'vulopilot' ),
                array( 'status' => 400 )
            );
        }

        $client = new VuloCloudAccountApiClient( VULOPILOT_VULOCLOUD_URL );
        $result = $client->register( $email, $password );

        if ( is_wp_error( $result ) ) {
            return new \WP_Error(
                'vulopilot_vulocloud_unreachable',
                sprintf(
                    /* translators: %s: underlying error message. */
                    __( 'Could not reach VuloCloud: %s', 'vulopilot' ),
                    $result->get_error_message()
                ),
                array( 'status' => 503 )
            );
        }

        $status = $result['http_status'];
        $body   = $result['body'];

        if ( $status < 200 || $status >= 300 ) {
            $vulocloud_code = isset( $body['error'] ) ? strtolower( $body['error'] ) : 'register_failed';

            return new \WP_Error(
                'vulopilot_vulocloud_' . $vulocloud_code,
                isset( $body['message'] ) ? $body['message'] : __( 'Could not create your VuloCloud account.', 'vulopilot' ),
                array( 'status' => $status )
            );
        }

        return $this->connect( $email, $password );
    }

    /**
     * A real, currently-valid access token for this site owner's VuloCloud
     * account, refreshing first if it's expired (or about to be) —
     * Services\AiCreditsConnection's own connect-site call is the first
     * real caller. Same shape as
     * GoogleServicesConnection::get_valid_access_token().
     *
     * @return string|null Null if not connected, or the refresh attempt failed.
     */
    public function get_valid_access_token(): ?string {
        $connection = $this->get_connection();

        if ( '' === $connection['refresh_token_enc'] ) {
            return null;
        }

        if ( (int) $connection['token_expires_at'] <= ( time() + self::EXPIRY_SAFETY_MARGIN ) ) {
            if ( ! $this->refresh_access_token() ) {
                return null;
            }

            $connection = $this->get_connection();
        }

        return CredentialEncryption::decrypt( $connection['access_token_enc'] );
    }

    /**
     * Real `POST /auth/refresh` — VuloCloud rotates the refresh token on
     * every call (confirmed by that route's own docblock), so both the new
     * access AND refresh token must be persisted, not just the access
     * token.
     *
     * @return bool
     */
    private function refresh_access_token(): bool {
        $connection    = $this->get_connection();
        $refresh_token = '' !== $connection['refresh_token_enc']
            ? CredentialEncryption::decrypt( $connection['refresh_token_enc'] )
            : null;

        if ( ! $refresh_token ) {
            return false;
        }

        $result = ( new VuloCloudAccountApiClient( VULOPILOT_VULOCLOUD_URL ) )->refresh( $refresh_token );

        if ( is_wp_error( $result ) || $result['http_status'] < 200 || $result['http_status'] >= 300 ) {
            return false;
        }

        $access_token = (string) ( $result['body']['accessToken'] ?? '' );

        if ( '' === $access_token ) {
            return false;
        }

        $this->save_connection(
            array(
                'access_token_enc'  => CredentialEncryption::encrypt( $access_token ),
                'refresh_token_enc' => CredentialEncryption::encrypt( (string) ( $result['body']['refreshToken'] ?? $refresh_token ) ),
                'token_expires_at'  => self::decode_jwt_expiry( $access_token ),
            )
        );

        return true;
    }

    /**
     * Reads the `exp` claim straight out of the JWT's own (unverified —
     * this site never needs to verify VuloCloud's own signature, only read
     * a timestamp it already trusts because the token came from a direct
     * HTTPS response to a request this site itself made) payload segment,
     * rather than trusting a response `expiresIn` field — VuloCloud's
     * `/auth/login`/`/auth/refresh` responses don't actually return one
     * (confirmed live against the real dev API).
     *
     * @param string $jwt
     * @return int Unix timestamp, or 0 if unparseable.
     */
    private static function decode_jwt_expiry( string $jwt ): int {
        $segments = explode( '.', $jwt );

        if ( count( $segments ) < 2 ) {
            return 0;
        }

        $payload = json_decode( (string) base64_decode( strtr( $segments[1], '-_', '+/' ), true ), true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- decoding this JWT's own standard base64url payload segment, not obfuscation.

        return is_array( $payload ) ? (int) ( $payload['exp'] ?? 0 ) : 0;
    }

    /**
     * Always clears the local connection, even when the best-effort
     * remote `/auth/logout` call fails or VuloCloud isn't reachable — a
     * site owner disconnecting is a local decision this site can always
     * honor on its own side, same reasoning
     * GoogleServicesConnection::disconnect() already documents for its
     * own remote-revoke-is-best-effort posture.
     *
     * @return void
     */
    public function disconnect(): void {
        $connection = $this->get_connection();

        if ( '' !== $connection['refresh_token_enc'] && '' !== trim( VULOPILOT_VULOCLOUD_URL ) ) {
            $access_token  = CredentialEncryption::decrypt( $connection['access_token_enc'] ) ?? '';
            $refresh_token = CredentialEncryption::decrypt( $connection['refresh_token_enc'] ) ?? '';

            if ( '' !== $access_token ) {
                ( new VuloCloudAccountApiClient( VULOPILOT_VULOCLOUD_URL ) )->logout( $access_token, $refresh_token );
            }
        }

        delete_option( self::OPTION_KEY );
    }
}
