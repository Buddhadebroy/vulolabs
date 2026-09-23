<?php
namespace VuloPilot\AiAssistant;

defined( 'ABSPATH' ) || exit;

/**
 * The real "AI Credits" site connection - a genuine `ConnectedSite`
 * credential (siteId + secret) minted by VuloCloud's own
 * `contexts/vulopilot/ai-credits` bounded context. `get_broker_authorize_url()`/
 * `exchange_broker_code()` are the one real "Connect to VuloCloud" flow
 * (ConnectVuloCloudPopup.tsx's own docblock) - the site owner authenticates
 * on a VuloCloud-hosted page (ConnectBrokerCallbackHandler handles the
 * return redirect) rather than typing a password into this plugin at all,
 * landing on `save_connection()` below with a durable, site-scoped
 * credential the plugin can use on every subsequent AI Gateway call.
 * `get_status()` additionally merges in VuloCloudAccountConnection's own
 * separate person-level login status (`vulocloud_account_connected`/`_email`)
 * - a different, informational-only connection this class doesn't depend on.
 *
 * `execute()`/`get_vulocloud_ai_status()` are the one HTTP call the direct
 * VuloCloud AI path makes: sends `{siteId, secret, feature, prompt,
 * context, site_tone}`, deliberately never a `provider`/`model` field -
 * this site never names one, never learns which vendor/key actually
 * answered, and never holds an API key at all beyond this connection's own
 * encrypted site secret. VuloCloud alone resolves whichever Organization
 * or (if allowed) Customer backup credential should serve the request.
 * This gateway call has no state or behavior of its own beyond "read this
 * class's own credential, POST it", so it lives here rather than a
 * separate class. Deliberately still a distinct wire contract from
 * AiCopilot\Services\AiCreditGatewayClient (which calls the
 * credits-metered `/plugin/ai/execute` with a structured
 * `{featureId, action, context}` shape VuloCloud's own feature catalog
 * interprets) - genuinely different funding sources of the same
 * underlying Gateway, so that one stays its own class.
 *
 * The low-level `/plugin/connect/*` broker HTTP calls and the
 * `/plugin/ai-credits/*` balance/disconnect calls are private helpers on
 * this same class too - neither has any state of its own beyond a base
 * URL, and no caller outside this class.
 *
 * Storage is one dedicated `vulopilot_ai_credits_connection` option, same
 * "never round-trips the secret to the browser, encrypted at rest"
 * posture GoogleServicesConnection.php/VuloCloudAccountConnection.php
 * already establish - `get_status()` below never returns the raw secret,
 * only the cached balance fields a site owner should actually see.
 *
 * The credit balance itself is a CACHE - VuloCloud's own wallet is always
 * the source of truth (VuloPilot brief §3: "WordPress may cache/display
 * the balance, but it must never be considered the source of truth").
 * `refresh_balance()` is the one method that re-syncs it from a real
 * `POST /plugin/ai-credits/balance` call; every other read in this class
 * (`get_status()`) is the last-synced cached value, exactly like
 * GoogleServicesConnection's own cached `ga4_property_name`/etc. fields
 * are a cache of Google's own account data, not re-fetched on every read.
 *
 * @class       AiCreditsConnection class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AiCreditsConnection {

    private const OPTION_KEY = 'vulopilot_ai_credits_connection';

    /** Matches ConnectedSite.pluginSlug's own free-text convention on the vulocloud side (VuloProductSlug::VULOPILOT). */
    private const PLUGIN_SLUG = 'vulopilot';

    /**
     * The stored connection, merged with defaults for any field never yet saved.
     *
     * @return array<string, mixed>
     */
    private function get_connection(): array {
        return wp_parse_args(
            get_option( self::OPTION_KEY, array() ),
            array(
                'site_id'         => '',
                'secret_enc'      => '',
                'credits'         => 0,
                'lifetime_earned' => 0,
                'lifetime_used'   => 0,
                'connected_at'    => '',
                'last_synced_at'  => '',
            )
        );
    }

    /**
     * Merges `$data` into the stored connection.
     *
     * @param array<string, mixed> $data Partial fields to merge into the stored connection.
     * @return void
     */
    private function save_connection( array $data ): void {
        update_option( self::OPTION_KEY, array_merge( $this->get_connection(), $data ), false );
    }

    /**
     * Whether this site has a real ConnectedSite credential.
     *
     * @return bool
     */
    public function is_connected(): bool {
        return '' !== $this->get_connection()['site_id'] && '' !== $this->get_connection()['secret_enc'];
    }

    /**
     * Never the secret - see this class's own docblock.
     *
     * @return array<string, mixed>
     */
    public function get_status(): array {
        $connection = $this->get_connection();

        return array(
            'connected'                   => $this->is_connected(),
            'credits'                     => (int) $connection['credits'],
            'lifetime_earned'             => (int) $connection['lifetime_earned'],
            'lifetime_used'               => (int) $connection['lifetime_used'],
            'connected_at'                => $connection['connected_at'],
            'last_synced_at'              => $connection['last_synced_at'],
            // Composed in so a single GET /ai-credits/status gives the
            // React side everything the credit indicator/claim CTA needs
            // (VuloPilot brief §21) without a second round trip - this
            // class's own connect flow needs a VuloCloud account
            // connected first, so its own state is directly relevant here.
            'vulocloud_account_connected' => ( new VuloCloudAccountConnection() )->is_connected(),
            'vulocloud_account_email'     => ( new VuloCloudAccountConnection() )->get_status()['email'],
        );
    }

    /**
     * The decrypted site credential, ready to authenticate an AI Gateway call.
     *
     * @return array{site_id: string, secret: string}|null Null if not connected.
     */
    public function get_site_credential(): ?array {
        $connection = $this->get_connection();

        if ( '' === $connection['site_id'] || '' === $connection['secret_enc'] ) {
            return null;
        }

        $secret = CredentialEncryption::decrypt( $connection['secret_enc'] );

        return null !== $secret ? array(
            'site_id' => $connection['site_id'],
            'secret'  => $secret,
        ) : null;
    }

    /**
     * Real `POST /plugin/ai-credits/balance` - the one method that
     * re-syncs the cached balance from VuloCloud's own authoritative
     * wallet (VuloPilot brief §3). Called on demand (Settings/credit
     * indicator "refresh" action), not on every page load.
     *
     * @return array<string, mixed>|\WP_Error Same shape as get_status().
     */
    public function refresh_balance() {
        $credential = $this->get_site_credential();

        if ( ! $credential ) {
            return new \WP_Error( 'vulopilot_ai_credits_not_connected', __( 'This site is not connected to VuloCloud AI Credits.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $result = $this->post_credits( VULOPILOT_VULOCLOUD_URL, '/plugin/ai-credits/balance', $credential['site_id'], $credential['secret'] );

        if ( is_wp_error( $result ) ) {
            // Offline/unreachable - VuloPilot brief §27: never destroy the
            // cached balance on a failed sync, just report the real error.
            return new \WP_Error(
                'vulopilot_ai_credits_unreachable',
                sprintf(
                    /* translators: %s: underlying error message. */
                    __( 'Could not reach VuloCloud: %s', 'vulopilot' ),
                    $result->get_error_message()
                ),
                array( 'status' => 503 )
            );
        }

        if ( $result['http_status'] < 200 || $result['http_status'] >= 300 ) {
            return new \WP_Error(
                'vulopilot_ai_credits_sync_failed',
                __( 'Could not refresh your AI credit balance.', 'vulopilot' ),
                array( 'status' => $result['http_status'] )
            );
        }

        $body = $result['body'];

        $this->save_connection(
            array(
                'credits'         => (int) ( $body['credits'] ?? 0 ),
                'lifetime_earned' => (int) ( $body['lifetimeEarned'] ?? 0 ),
                'lifetime_used'   => (int) ( $body['lifetimeUsed'] ?? 0 ),
                'last_synced_at'  => current_time( 'mysql' ),
            )
        );

        return $this->get_status();
    }

    /**
     * The redirect_uri VuloCloud's own `/plugin/connect/exchange` redirect
     * must land back on - `admin-post.php` (not a REST route), same
     * reasoning GoogleServicesConnection::get_redirect_uri() documents:
     * this browser redirect carries no `X-WP-Nonce` header for a REST
     * nonce check, and `admin-post.php` already authenticates via the same
     * login cookie every other wp-admin page load does.
     *
     * @return string
     */
    public function get_broker_redirect_uri(): string {
        return admin_url( 'admin-post.php?action=vulopilot_connect_broker_callback' );
    }

    /**
     * The passwordless "Connect to VuloCloud" URL - Settings →
     * Connections' own Connect button 302s the browser here instead of
     * rendering a login/signup form itself (see this class's own docblock,
     * and ConnectBrokerCallbackHandler for the rest of the sequence).
     * `state` is a real WP nonce (verified in `verify_broker_state()` on
     * the way back, guarding the callback against CSRF the same way every
     * other WordPress admin-post handler's own `check_admin_referer()`
     * would) - VuloCloud itself never inspects it, only echoes it back
     * verbatim.
     *
     * @return string|null Null if this build isn't configured to reach VuloCloud at all yet.
     */
    public function get_broker_authorize_url(): ?string {
        if ( '' === trim( VULOPILOT_VULOCLOUD_URL ) ) {
            return null;
        }

        $state = wp_create_nonce( 'vulopilot_connect_broker' );

        // Browser-facing: must be reachable from the site owner's own
        // browser, which is not always true of VULOPILOT_VULOCLOUD_URL
        // itself (e.g. `host.docker.internal` in local Docker dev) - see
        // VULOPILOT_VULOCLOUD_PUBLIC_URL's own docblock in config.php.
        $browser_url = '' !== trim( VULOPILOT_VULOCLOUD_PUBLIC_URL ) ? VULOPILOT_VULOCLOUD_PUBLIC_URL : VULOPILOT_VULOCLOUD_URL;

        $params = array(
            'domain'            => home_url(),
            'returnUri'         => $this->get_broker_redirect_uri(),
            'state'             => $state,
            'soloOrganizationId' => trim( VULOPILOT_VULOCLOUD_HOST_ORGANIZATION_ID ),
        );

        if ( '' === $params['soloOrganizationId'] ) {
            unset( $params['soloOrganizationId'] );
        }

        return untrailingslashit( $browser_url ) . '/plugin/connect/authorize?' . http_build_query( $params );
    }

    /**
     * @param string $state The `state` query param the broker's redirect carried back.
     * @return bool
     */
    public function verify_broker_state( string $state ): bool {
        return false !== wp_verify_nonce( $state, 'vulopilot_connect_broker' );
    }

    /**
     * Redeems the broker's own single-use exchange `code`
     * (ConnectBrokerCallbackHandler's own caller) and, on success, stores
     * the real ConnectedSite credential - the one way this connection ever
     * gets established (see this class's own docblock).
     *
     * @param string $code The single-use exchange code from the broker's own return redirect.
     * @return array<string, mixed>|\WP_Error Same shape as get_status().
     */
    public function exchange_broker_code( string $code ) {
        $response = wp_remote_post(
            untrailingslashit( VULOPILOT_VULOCLOUD_URL ) . '/plugin/connect/exchange',
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

        $site_id     = (string) $body['siteId'];
        $site_secret = (string) $body['siteSecret'];
        $credits     = (int) ( $body['credits'] ?? 0 );

        $this->save_connection(
            array(
                'site_id'         => $site_id,
                'secret_enc'      => CredentialEncryption::encrypt( $site_secret ),
                'credits'         => $credits,
                'lifetime_earned' => $credits,
                'connected_at'    => current_time( 'mysql' ),
                'last_synced_at'  => current_time( 'mysql' ),
            )
        );

        // Immediate first report - without this, the Connected Sites
        // detail page shows "Syncing…"/blank telemetry until the daily
        // cron eventually fires (Services\SiteTelemetryReporter's own
        // doc comment). Best-effort: a failure here doesn't affect the
        // connection itself, which already fully succeeded above.
        ( new SiteTelemetryReporter() )->report( $site_id, $site_secret );

        return $this->get_status();
    }

    /**
     * Records a real, successful AI Gateway spend against the LOCAL cache
     * immediately (rather than waiting for the next refresh_balance() call)
     * - called by AiCreditGatewayClient right after a real
     * `/plugin/ai/execute` success, whose own response already carries the
     * authoritative post-spend balance. This is still a cache write, not
     * an independent deduction (VuloPilot brief §3: "do not allow the
     * WordPress plugin to simply set its own credit balance") - the number
     * stored here is exactly what VuloCloud's own response just said the
     * balance now is, never locally computed.
     *
     * @param int $credits_remaining The authoritative post-spend balance, straight from VuloCloud's own response.
     * @return void
     */
    public function record_known_balance( int $credits_remaining ): void {
        $this->save_connection(
            array(
                'credits'        => $credits_remaining,
                'last_synced_at' => current_time( 'mysql' ),
            )
        );
    }

    /**
     * Real self-service revoke on VuloCloud's own side
     * (`POST /plugin/ai-credits/disconnect`, ConnectedSiteService::revokeBySite())
     * - an earlier version of this method only ever cleared the local
     * option, since no revoke-site endpoint existed yet; that gap is
     * closed now. The remote call is best-effort: this always clears the
     * local option regardless of its outcome (an already-revoked/unknown
     * site, or VuloCloud being briefly unreachable, shouldn't leave this
     * site stuck showing "Connected" when the site owner explicitly
     * asked to disconnect) - see the loud `error_log()` below for the one
     * case worth a site owner's admin knowing about: the remote secret
     * living on past a local disconnect, still usable by nothing since
     * this site no longer holds it, but not actually revoked either.
     *
     * @return void
     */
    public function disconnect(): void {
        $credential = $this->get_site_credential();

        if ( $credential ) {
            $result = $this->post_credits( VULOPILOT_VULOCLOUD_URL, '/plugin/ai-credits/disconnect', $credential['site_id'], $credential['secret'] );

            if ( is_wp_error( $result ) ) {
                error_log( sprintf( '[VuloPilot] Could not revoke ConnectedSite %s on disconnect: %s', $credential['site_id'], $result->get_error_message() ) );
            }
        }

        delete_option( self::OPTION_KEY );
    }

    /**
     * The direct VuloCloud AI path's one real AI call. Sends
     * `{siteId, secret, feature, prompt, context, site_tone}` - see this
     * class's own docblock for why there's deliberately no `provider`/`model`
     * field.
     *
     * @param string               $feature   Free-text action identifier (e.g. 'seo_analysis') - for VuloCloud's own usage-log categorization only.
     * @param string               $prompt    This site's own already-built prompt text - VuloCloud does not construct it.
     * @param array<string, mixed> $context   Optional structured metadata.
     * @param string               $site_tone The manually-set `vulopilot_site_tone` option value, or ''.
     * @return array{success: true, request_id: string, response: string}|\WP_Error {
     *   A \WP_Error for connectivity/configuration failure OR VuloCloud
     *   reporting no usable key (code 'vulopilot_vulocloud_ai_not_configured') -
     *   the caller (AiAssistant\AiRequestSender) maps that one specific code
     *   to VuloPilotException with TYPE_VULOCLOUD_AI_NOT_CONFIGURED; every
     *   other \WP_Error becomes a generic VuloPilotException with
     *   TYPE_GATEWAY_REQUEST.
     * }
     */
    public function execute( string $feature, string $prompt, array $context, string $site_tone ) {
        if ( '' === trim( VULOPILOT_VULOCLOUD_URL ) ) {
            return new \WP_Error( 'vulopilot_vulocloud_ai_not_configured', __( 'VuloCloud isn’t configured for this build yet.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $credential = $this->get_site_credential();

        if ( ! $credential ) {
            return new \WP_Error( 'vulopilot_vulocloud_ai_not_connected', __( 'This site is not connected to VuloCloud.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $body = array(
            'siteId'  => $credential['site_id'],
            'secret'  => $credential['secret'],
            'feature' => $feature,
            'prompt'  => $prompt,
        );

        if ( ! empty( $context ) ) {
            $body['context'] = $context;
        }

        if ( '' !== $site_tone ) {
            $body['site_tone'] = $site_tone;
        }

        $response = wp_remote_post(
            untrailingslashit( VULOPILOT_VULOCLOUD_URL ) . '/plugin/ai/byok-execute',
            array(
                // Real provider latency lives on VuloCloud's side of this
                // call - same generous timeout AiCreditGatewayClient uses,
                // for the same reason (a slow completion shouldn't time
                // out here before VuloCloud's own response comes back).
                'timeout' => 60,
                'headers' => array( 'Content-Type' => 'application/json' ),
                'body'    => wp_json_encode( $body ),
            )
        );

        if ( is_wp_error( $response ) ) {
            return new \WP_Error(
                'vulopilot_vulocloud_ai_unreachable',
                sprintf(
                    /* translators: %s: underlying error message. */
                    __( 'Could not reach VuloCloud: %s', 'vulopilot' ),
                    $response->get_error_message()
                ),
                array( 'status' => 503 )
            );
        }

        $status  = (int) wp_remote_retrieve_response_code( $response );
        $decoded = json_decode( (string) wp_remote_retrieve_body( $response ), true );

        if ( ! is_array( $decoded ) ) {
            return new \WP_Error( 'vulopilot_vulocloud_ai_unparseable_response', __( 'VuloCloud returned an unexpected response.', 'vulopilot' ), array( 'status' => 502 ) );
        }

        if ( $status < 200 || $status >= 300 ) {
            // VuloCloud's own "no usable key resolves for this site"
            // response code - the one AiCopilot\ActionRunner specifically
            // recognizes to decide whether to fall through to AI Credits
            // (see that class's own docblock) - passed through as our own,
            // differently-named \WP_Error code rather than translated to a
            // generic message here, unlike every other DomainError (never
            // expose VuloCloud's internal error text to the end user,
            // VuloPilot brief §19/§26).
            if ( 'AI_BYOK_NOT_CONFIGURED' === ( $decoded['error'] ?? '' ) ) {
                return new \WP_Error( 'vulopilot_vulocloud_ai_not_configured', __( 'No AI connection is configured for this site.', 'vulopilot' ), array( 'status' => $status ) );
            }

            return new \WP_Error(
                'vulopilot_vulocloud_ai_gateway_error',
                __( 'VuloCloud could not process this AI request right now.', 'vulopilot' ),
                array( 'status' => $status )
            );
        }

        return array(
            'success'    => true,
            'request_id' => (string) ( $decoded['requestId'] ?? '' ),
            'response'   => (string) ( $decoded['response'] ?? '' ),
        );
    }

    /**
     * A cheap boolean-only connection check, no prompt/key material
     * involved. Used only by the Settings UI's status display
     * (VuloCloudAiConnectionPanel.tsx), never by ActionRunner's own
     * per-request decision (which always attempts execute() directly and
     * reacts to a real "not configured" response instead - see that
     * class's own docblock on why a separate pre-check there would just
     * be a second, redundant round trip).
     *
     * Returns a real `\WP_Error` only for an actual connectivity failure
     * - `connected`/`configured` are deliberately two separate booleans,
     * not one collapsed into the other, because "this site has no
     * site_id/secret at all" and "this site has one, but VuloCloud says
     * no key resolves for it" are genuinely different states the caller
     * (RestAPI\Controllers\VuloCloudAiConnection::get_items()) needs to tell apart
     * to decide whether to show a Connect form or a "configure a key"
     * notice. An earlier version of this method returned plain `false`
     * for "no credential" - indistinguishable, to a caller only checking
     * `is_wp_error()`, from "connected but not configured" (also
     * ultimately a falsy `configured` value), which silently always read
     * as "connected" once that check ran on a real WP_Error only.
     *
     * @return array{connected: bool, configured: bool}|\WP_Error
     */
    public function get_vulocloud_ai_status() {
        $credential = $this->get_site_credential();

        if ( ! $credential ) {
            return array(
                'connected'  => false,
                'configured' => false,
            );
        }

        $response = wp_remote_post(
            untrailingslashit( VULOPILOT_VULOCLOUD_URL ) . '/plugin/ai/byok-status',
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

        return array(
            'connected'  => true,
            'configured' => is_array( $decoded ) && ! empty( $decoded['configured'] ),
        );
    }

    /**
     * Shared `/plugin/ai-credits/*` POST + "completed round trip vs
     * genuine network failure" split - refresh_balance()/disconnect()'s
     * own shared HTTP shape (site-secret authenticated, no human token
     * involved).
     *
     * @param string $base_url VuloCloud's own base URL (VULOPILOT_VULOCLOUD_URL).
     * @param string $path     e.g. '/plugin/ai-credits/balance'.
     * @param string $site_id  The ConnectedSite id from this class's own stored connection.
     * @param string $secret   The plaintext site secret from that same stored connection.
     * @return array{http_status: int, body: array<string, mixed>}|\WP_Error
     */
    private function post_credits( string $base_url, string $path, string $site_id, string $secret ) {
        $response = wp_remote_post(
            untrailingslashit( $base_url ) . $path,
            array(
                'timeout' => 15,
                'headers' => array( 'Content-Type' => 'application/json' ),
                'body'    => wp_json_encode(
                    array(
                        'siteId' => $site_id,
                        'secret' => $secret,
                    )
                ),
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
