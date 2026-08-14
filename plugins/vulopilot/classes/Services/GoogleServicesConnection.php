<?php
/**
 * GoogleServicesConnection class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

defined( 'ABSPATH' ) || exit;

/**
 * Real Google OAuth 2.0 connection shared by Search Console, Analytics
 * (GA4), and AdSense — one "Connect Google Services" button/consent
 * screen covering all three read scopes at once, matching the reference
 * flow (a single connect step, then per-service pickers) rather than
 * three separate connect buttons. Replaces the earlier
 * GoogleSearchConsoleClient, which only ever covered Search Console.
 *
 * Unlike a bring-your-own-credential integration (AI Providers' own API
 * keys), the Client ID/Secret here is ONE shared Google Cloud OAuth
 * Client VuloLabs itself registers — `VULOPILOT_GOOGLE_CLIENT_ID`/
 * `VULOPILOT_GOOGLE_CLIENT_SECRET`, defined once in the plugin's own
 * config.php (see that file's docblock for the real trade-offs this
 * accepts). A site owner never sees or enters a Client ID/Secret; they
 * only ever click "Connect Google Services". This class only handles the
 * real OAuth dance and real Search Console `sites.list` call once that's
 * done; GoogleAnalyticsClient/GoogleAdSenseClient handle their own
 * services' real API calls, reusing this class's own
 * `get_valid_access_token()`.
 *
 * Storage is one dedicated `vulopilot_google_connection` option,
 * deliberately NOT part of `Utill::VULOPILOT_SETTINGS_KEY` — that option
 * round-trips wholesale to the browser on every `GET /settings` call
 * (Controllers\Settings::get_items()), and a client secret/access/refresh
 * token must never reach the client the way AiProviderConfigRepository's
 * own `credentials` column never does (see
 * Controllers\AiProviders::prepare_config_for_response()). Every secret
 * value here is encrypted at rest via CredentialEncryption, same as that
 * AI-provider credential column.
 *
 * @class       GoogleServicesConnection class
 * @version     1.0.0
 * @author      VuloLabs
 */
class GoogleServicesConnection {

    private const OPTION_KEY = 'vulopilot_google_connection';

    /**
     * One combined consent screen for all three services — matching the
     * reference flow's own single "Connect Google Services" button
     * rather than three separate authorize round-trips. `analytics.readonly`
     * covers GA4 account/property/data-stream listing (Analytics Admin
     * API) and report reads; `adsense.readonly` covers AdSense account
     * listing.
     */
    private const SCOPES = array(
        'https://www.googleapis.com/auth/webmasters.readonly',
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/adsense.readonly',
    );

    private const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';

    private const SITES_URL = 'https://www.googleapis.com/webmasters/v3/sites';

    /**
     * Google access tokens are typically valid ~3600s — refreshed a minute
     * early so a request never races an in-flight expiry.
     */
    private const EXPIRY_SAFETY_MARGIN = 60;

    /**
     * @return array<string, mixed>
     */
    private function get_connection(): array {
        return wp_parse_args(
            get_option( self::OPTION_KEY, array() ),
            array(
                'access_token_enc'   => '',
                'refresh_token_enc'  => '',
                'token_expires_at'   => 0,
                'search_console_site' => '',
                'ga4_account_id'     => '',
                'ga4_account_name'   => '',
                'ga4_property_id'    => '',
                'ga4_property_name'  => '',
                'ga4_measurement_id' => '',
                'adsense_account_id' => '',
                'adsense_account_name' => '',
                'connected_at'       => '',
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
     * The redirect_uri registered with Google must be EXACTLY this URL
     * (down to trailing slashes/scheme) — `admin-post.php` (not a REST
     * route) because Google's own top-level browser redirect back here
     * carries no `X-WP-Nonce` header for a REST nonce check, and
     * `admin-post.php` already authenticates via the same login cookie
     * every other wp-admin page load does.
     *
     * @return string
     */
    public function get_redirect_uri(): string {
        return admin_url( 'admin-post.php?action=vulopilot_gsc_oauth_callback' );
    }

    /**
     * Whether VuloLabs has actually configured a real shared Client
     * ID/Secret for this build yet (see config.php's own docblock) —
     * both constants default to empty strings until they are, so this
     * build honestly reports "not available" rather than pretending a
     * shared client exists when it doesn't.
     *
     * @return bool
     */
    public function has_client_credentials(): bool {
        return defined( 'VULOPILOT_GOOGLE_CLIENT_ID' ) && '' !== VULOPILOT_GOOGLE_CLIENT_ID
            && defined( 'VULOPILOT_GOOGLE_CLIENT_SECRET' ) && '' !== VULOPILOT_GOOGLE_CLIENT_SECRET;
    }

    /**
     * @return string|null
     */
    public function get_client_id(): ?string {
        return $this->has_client_credentials() ? VULOPILOT_GOOGLE_CLIENT_ID : null;
    }

    /**
     * @return string|null
     */
    private function get_client_secret(): ?string {
        return $this->has_client_credentials() ? VULOPILOT_GOOGLE_CLIENT_SECRET : null;
    }

    /**
     * Real Google OAuth 2.0 authorization URL — `access_type=offline` +
     * `prompt=consent` so Google actually issues a refresh_token (it
     * otherwise only does this on a user's very first consent, silently
     * omitting it on repeat authorizations), `state` is a real WP nonce
     * verified in `verify_state()` on the way back, guarding the
     * callback against CSRF the same way every other WordPress
     * admin-post handler's own `check_admin_referer()` would.
     *
     * @return string|null Null if no client credentials are saved yet.
     */
    public function get_authorization_url(): ?string {
        $client_id = $this->get_client_id();

        if ( ! $client_id ) {
            return null;
        }

        $params = array(
            'client_id'     => $client_id,
            'redirect_uri'  => $this->get_redirect_uri(),
            'response_type' => 'code',
            'scope'         => implode( ' ', self::SCOPES ),
            'access_type'   => 'offline',
            'prompt'        => 'consent',
            'state'         => wp_create_nonce( 'vulopilot_gsc_oauth' ),
        );

        return self::AUTHORIZE_URL . '?' . http_build_query( $params );
    }

    /**
     * @param string $state The `state` query param Google's redirect carried back.
     * @return bool
     */
    public function verify_state( string $state ): bool {
        return false !== wp_verify_nonce( $state, 'vulopilot_gsc_oauth' );
    }

    /**
     * Real `POST https://oauth2.googleapis.com/token` authorization_code
     * exchange — the actual OAuth handshake, not a stub. Both tokens are
     * encrypted before being stored; `refresh_token` is only ever present
     * in Google's response on first consent (see `get_authorization_url()`'s
     * own `prompt=consent`), so an existing one is preserved on
     * re-authorization rather than being overwritten with nothing.
     *
     * @param string $code The `code` query param Google's redirect carried back.
     * @return true|\WP_Error
     */
    public function exchange_code_for_tokens( string $code ) {
        $client_id     = $this->get_client_id();
        $client_secret = $this->get_client_secret();

        if ( ! $client_id || ! $client_secret ) {
            return new \WP_Error( 'vulopilot_gsc_no_credentials', __( 'No Google OAuth Client ID/Secret saved yet.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $response = wp_remote_post(
            self::TOKEN_URL,
            array(
                'timeout' => 15,
                'body'    => array(
                    'code'          => $code,
                    'client_id'     => $client_id,
                    'client_secret' => $client_secret,
                    'redirect_uri'  => $this->get_redirect_uri(),
                    'grant_type'    => 'authorization_code',
                ),
            )
        );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        $body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

        if ( 200 !== (int) wp_remote_retrieve_response_code( $response ) || empty( $body['access_token'] ) ) {
            return new \WP_Error(
                'vulopilot_gsc_token_exchange_failed',
                $body['error_description'] ?? $body['error'] ?? __( 'Google did not return an access token.', 'vulopilot' ),
                array( 'status' => 502 )
            );
        }

        $update = array(
            'access_token_enc' => CredentialEncryption::encrypt( $body['access_token'] ),
            'token_expires_at' => time() + (int) ( $body['expires_in'] ?? 3600 ),
            'connected_at'     => current_time( 'mysql' ),
        );

        if ( ! empty( $body['refresh_token'] ) ) {
            $update['refresh_token_enc'] = CredentialEncryption::encrypt( $body['refresh_token'] );
        }

        $this->save_connection( $update );

        return true;
    }

    /**
     * Real `refresh_token` grant — called by `get_valid_access_token()`
     * whenever the stored access token is expired (or about to be).
     *
     * @return bool
     */
    private function refresh_access_token(): bool {
        $connection    = $this->get_connection();
        $client_id     = $this->get_client_id();
        $client_secret = $this->get_client_secret();
        $refresh_token = '' !== $connection['refresh_token_enc']
            ? CredentialEncryption::decrypt( $connection['refresh_token_enc'] )
            : null;

        if ( ! $client_id || ! $client_secret || ! $refresh_token ) {
            return false;
        }

        $response = wp_remote_post(
            self::TOKEN_URL,
            array(
                'timeout' => 15,
                'body'    => array(
                    'client_id'     => $client_id,
                    'client_secret' => $client_secret,
                    'refresh_token' => $refresh_token,
                    'grant_type'    => 'refresh_token',
                ),
            )
        );

        if ( is_wp_error( $response ) ) {
            return false;
        }

        $body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

        if ( 200 !== (int) wp_remote_retrieve_response_code( $response ) || empty( $body['access_token'] ) ) {
            return false;
        }

        $this->save_connection(
            array(
                'access_token_enc' => CredentialEncryption::encrypt( $body['access_token'] ),
                'token_expires_at' => time() + (int) ( $body['expires_in'] ?? 3600 ),
            )
        );

        return true;
    }

    /**
     * @return string|null A real, currently-valid access token, refreshing first if needed. Null if not connected or refresh failed.
     */
    public function get_valid_access_token(): ?string {
        $connection = $this->get_connection();

        if ( '' === $connection['access_token_enc'] ) {
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
     * Whether a real refresh token is on file — the one durable signal
     * that this site has actually completed the OAuth handshake at least
     * once (an access token alone always eventually expires; the refresh
     * token is what makes the connection long-lived).
     *
     * @return bool
     */
    public function is_connected(): bool {
        return '' !== $this->get_connection()['refresh_token_enc'];
    }

    /**
     * Real `GET https://www.googleapis.com/webmasters/v3/sites` call —
     * this site's verified Search Console properties, used both to prove
     * the connection actually works end-to-end (not just that a token
     * exchange succeeded) and to let the site owner pick which verified
     * property to use if more than one comes back.
     *
     * @return array<int, array{site_url: string, permission_level: string}>|\WP_Error
     */
    public function list_search_console_sites() {
        $token = $this->get_valid_access_token();

        if ( ! $token ) {
            return new \WP_Error( 'vulopilot_gsc_not_connected', __( 'Not connected to Google.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $response = wp_remote_get(
            self::SITES_URL,
            array(
                'timeout' => 15,
                'headers' => array( 'Authorization' => 'Bearer ' . $token ),
            )
        );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        if ( 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
            return new \WP_Error( 'vulopilot_gsc_sites_failed', __( 'Could not fetch your Search Console properties.', 'vulopilot' ), array( 'status' => 502 ) );
        }

        $body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

        return array_map(
            static fn( $site ) => array(
                'site_url'         => $site['siteUrl'] ?? '',
                'permission_level' => $site['permissionLevel'] ?? '',
            ),
            $body['siteEntry'] ?? array()
        );
    }

    /**
     * @param string $site_url One of `list_search_console_sites()`'s own real `site_url` values.
     * @return void
     */
    public function select_search_console_site( string $site_url ): void {
        $this->save_connection( array( 'search_console_site' => $site_url ) );
    }

    /**
     * @param array{account_id: string, account_name: string, property_id: string, property_name: string, measurement_id: string} $property One of GoogleAnalyticsClient::list_account_summaries()'s own real data-stream rows.
     * @return void
     */
    public function select_ga4_property( array $property ): void {
        $this->save_connection(
            array(
                'ga4_account_id'     => $property['account_id'],
                'ga4_account_name'   => $property['account_name'],
                'ga4_property_id'    => $property['property_id'],
                'ga4_property_name'  => $property['property_name'],
                'ga4_measurement_id' => $property['measurement_id'],
            )
        );
    }

    /**
     * @param string $account_id   One of GoogleAdSenseClient::list_accounts()'s own real `account_id` values.
     * @param string $account_name Same row's display name.
     * @return void
     */
    public function select_adsense_account( string $account_id, string $account_name ): void {
        $this->save_connection(
            array(
                'adsense_account_id'   => $account_id,
                'adsense_account_name' => $account_name,
            )
        );
    }

    /**
     * Clears tokens/selected properties but keeps the saved Client
     * ID/Secret — reconnecting shouldn't require re-entering the OAuth
     * client every time, only re-consenting with Google.
     *
     * @return void
     */
    public function disconnect(): void {
        $this->save_connection(
            array(
                'access_token_enc'      => '',
                'refresh_token_enc'     => '',
                'token_expires_at'      => 0,
                'search_console_site'   => '',
                'ga4_account_id'        => '',
                'ga4_account_name'      => '',
                'ga4_property_id'       => '',
                'ga4_property_name'     => '',
                'ga4_measurement_id'    => '',
                'adsense_account_id'    => '',
                'adsense_account_name'  => '',
                'connected_at'          => '',
            )
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function get_status(): array {
        $connection = $this->get_connection();

        return array(
            'connected'              => $this->is_connected(),
            // Whether VuloLabs' own shared Google Cloud OAuth Client is
            // configured for this build (config.php) — never a per-site
            // value, so there's no client_id to show back here; the
            // panel either shows a working "Connect" button or an honest
            // "not available in this build yet" state based on this flag.
            'has_client_credentials' => $this->has_client_credentials(),
            'search_console_site'    => $connection['search_console_site'],
            'ga4_account_id'         => $connection['ga4_account_id'],
            'ga4_account_name'       => $connection['ga4_account_name'],
            'ga4_property_id'        => $connection['ga4_property_id'],
            'ga4_property_name'      => $connection['ga4_property_name'],
            'ga4_measurement_id'     => $connection['ga4_measurement_id'],
            'adsense_account_id'     => $connection['adsense_account_id'],
            'adsense_account_name'   => $connection['adsense_account_name'],
            'connected_at'           => $connection['connected_at'],
            // The exact URL the site owner must register as an
            // "Authorized redirect URI" on their Google Cloud OAuth
            // Client — shown in the panel's own setup instructions so
            // this never has to be reverse-engineered or hardcoded twice.
            'redirect_uri'           => $this->get_redirect_uri(),
        );
    }
}
