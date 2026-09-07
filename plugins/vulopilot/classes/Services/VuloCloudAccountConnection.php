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
 * than tracking real access-token expiry — see
 * VuloCloudAccountApiClient's own docblock for why nothing here refreshes
 * an expired access token yet (nothing downstream calls VuloCloud with
 * it). A refresh token revoked server-side (e.g. the person changed their
 * VuloCloud password) would still read `connected: true` here until they
 * explicitly disconnect — the same honest limitation
 * GoogleServicesConnection.php's own `get_status()` docblock flags for
 * its own stored refresh token, not a new gap this class introduces.
 *
 * @class       VuloCloudAccountConnection class
 * @version     1.0.0
 * @author      VuloLabs
 */
class VuloCloudAccountConnection {

    private const OPTION_KEY = 'vulopilot_vulocloud_account';

    /**
     * @return array<string, mixed>
     */
    private function get_connection(): array {
        return wp_parse_args(
            get_option( self::OPTION_KEY, array() ),
            array(
                'access_token_enc'  => '',
                'refresh_token_enc' => '',
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

        $this->save_connection(
            array(
                'access_token_enc'  => CredentialEncryption::encrypt( (string) ( $body['accessToken'] ?? '' ) ),
                'refresh_token_enc' => CredentialEncryption::encrypt( (string) ( $body['refreshToken'] ?? '' ) ),
                'email'             => (string) ( $body['user']['email'] ?? $email ),
                'connected_at'      => current_time( 'mysql' ),
            )
        );

        return $this->get_status();
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
