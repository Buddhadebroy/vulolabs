<?php
/**
 * Every class in this file used to be its own file under classes/Services/
 * (same names, docblocks, and behavior) - merged into one file to reduce
 * classes/'s file count, per direct instruction. Autoloading does not rely on
 * each class's own file matching its own name for this: composer.json's
 * autoload.classmap entry (alongside the existing psr-4 one) makes Composer
 * tokenize every file under classes/ and modules/ and map each class it finds
 * to its real file, however many classes share one file - run
 * `composer dump-autoload` (no `-o`/`--optimize-autoloader` needed) after any
 * further file merge/split here.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

use VuloPilot\AI\AiRequestSender;
use VuloPilot\Repositories\ActivityLogRepository;
use VuloPilot\Utill;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * The one HTTP call the BYOK proxy path makes - `POST /plugin/ai/byok-execute`
 * against VuloCloud's own `contexts/vulopilot/ai-byok`/`ai-gateway`: sends
 * `{feature, prompt, context, site_tone}`, deliberately never a `provider`
 * or `model` field - this site never names one, never learns which
 * vendor/key actually answered, and never holds an API key at all.
 * VuloCloud alone resolves whichever Organization or (if allowed) Customer
 * backup credential should serve the request.
 *
 * Deliberately its own class, separate from AiCreditGatewayClient (which
 * calls the credits-metered `/plugin/ai/execute` with a structured
 * `{featureId, action, context}` shape VuloCloud's own feature catalog
 * interprets) - genuinely different wire contracts for two different
 * funding sources of the same underlying Gateway.
 *
 * @class       AiByokGatewayClient class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AiByokGatewayClient {

    private AiCreditsConnection $credits;

    public function __construct( ?AiCreditsConnection $credits = null ) {
        $this->credits = $credits ?? new AiCreditsConnection();
    }

    /**
     * @param string               $feature   Free-text action identifier (e.g. 'seo_analysis') - for VuloCloud's own usage-log categorization only.
     * @param string               $prompt    This site's own already-built prompt text - VuloCloud does not construct it.
     * @param array<string, mixed> $context   Optional structured metadata.
     * @param string               $site_tone The manually-set `vulopilot_site_tone` option value, or ''.
     * @return array{success: true, request_id: string, response: string}|\WP_Error {
     *   A \WP_Error for connectivity/configuration failure OR VuloCloud
     *   reporting `AI_BYOK_NOT_CONFIGURED` (code
     *   'vulopilot_ai_byok_not_configured') - the caller
     *   (AI\AiRequestSender) maps that one specific code to
     *   AiByokNotConfiguredException; every other \WP_Error becomes a
     *   generic GatewayRequestException.
     * }
     */
    public function execute( string $feature, string $prompt, array $context, string $site_tone ) {
        if ( '' === trim( VULOPILOT_VULOCLOUD_URL ) ) {
            return new \WP_Error( 'vulopilot_ai_byok_not_configured', __( 'VuloCloud isn’t configured for this build yet.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $credential = $this->credits->get_site_credential();

        if ( ! $credential ) {
            return new \WP_Error( 'vulopilot_ai_byok_not_connected', __( 'This site is not connected to VuloCloud.', 'vulopilot' ), array( 'status' => 400 ) );
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
                'vulopilot_ai_byok_unreachable',
                sprintf(
                    /* translators: %s: underlying error message. */
                    __( 'Could not reach VuloCloud: %s', 'vulopilot' ),
                    $response->get_error_message()
                ),
                array( 'status' => 503 )
            );
        }

        $status = (int) wp_remote_retrieve_response_code( $response );
        $decoded = json_decode( (string) wp_remote_retrieve_body( $response ), true );

        if ( ! is_array( $decoded ) ) {
            return new \WP_Error( 'vulopilot_ai_byok_unparseable_response', __( 'VuloCloud returned an unexpected response.', 'vulopilot' ), array( 'status' => 502 ) );
        }

        if ( $status < 200 || $status >= 300 ) {
            // 'AI_BYOK_NOT_CONFIGURED' is the one code AiCopilot\ActionRunner
            // specifically recognizes to decide whether to fall through to
            // AI Credits (see that class's own docblock) - passed through
            // verbatim via the \WP_Error code rather than translated to a
            // generic message here, unlike every other DomainError (never
            // expose VuloCloud's internal error text to the end user,
            // VuloPilot brief §19/§26).
            if ( 'AI_BYOK_NOT_CONFIGURED' === ( $decoded['error'] ?? '' ) ) {
                return new \WP_Error( 'vulopilot_ai_byok_not_configured', __( 'No AI connection is configured for this site.', 'vulopilot' ), array( 'status' => $status ) );
            }

            return new \WP_Error(
                'vulopilot_ai_byok_gateway_error',
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
     * `POST /plugin/ai/byok-status` - a cheap boolean-only check, no
     * prompt/key material involved. Used only by the Settings UI's status
     * display (VuloCloudAiConnectionPanel.tsx), never by ActionRunner's own
     * per-request decision (which always attempts execute() directly and
     * reacts to a real AI_BYOK_NOT_CONFIGURED response instead - see that
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
    public function status() {
        $credential = $this->credits->get_site_credential();

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
}

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

/**
 * The real "AI Credits" site connection - a genuine `ConnectedSite`
 * credential (siteId + secret) minted by VuloCloud's own
 * `contexts/vulopilot/ai-credits` bounded context. `get_broker_authorize_url()`/
 * `exchange_broker_code()` are the one real "Connect to VuloCloud" flow
 * (ConnectVuloCloudPopup.tsx's own docblock) - the site owner authenticates
 * on a VuloCloud-hosted page (ConnectBrokerClient/ConnectBrokerCallbackHandler)
 * rather than typing a password into this plugin at all, landing on
 * `save_connection()` below with a durable, site-scoped credential the
 * plugin can use on every subsequent AI Gateway call. `get_status()`
 * additionally merges in VuloCloudAccountConnection's own separate
 * person-level login status (`vulocloud_account_connected`/`_email`) -
 * a different, informational-only connection this class doesn't depend on.
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

        $result = ( new AiCreditsApiClient( VULOPILOT_VULOCLOUD_URL ) )->get_balance( $credential['site_id'], $credential['secret'] );

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
     * rendering a login/signup form itself (see this repo's
     * ConnectBrokerClient/ConnectBrokerCallbackHandler for the rest of the
     * sequence). `state` is a real WP nonce (verified in
     * `verify_broker_state()` on the way back, guarding the callback
     * against CSRF the same way every other WordPress admin-post handler's
     * own `check_admin_referer()` would) - VuloCloud itself never inspects
     * it, only echoes it back verbatim.
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

        return ( new ConnectBrokerClient( $browser_url ) )->get_authorize_url(
            home_url(),
            $this->get_broker_redirect_uri(),
            $state,
            trim( VULOPILOT_VULOCLOUD_HOST_ORGANIZATION_ID )
        );
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
        $result = ( new ConnectBrokerClient( VULOPILOT_VULOCLOUD_URL ) )->exchange( home_url(), $code );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        $this->save_connection(
            array(
                'site_id'         => $result['siteId'],
                'secret_enc'      => CredentialEncryption::encrypt( $result['siteSecret'] ),
                'credits'         => $result['credits'],
                'lifetime_earned' => $result['credits'],
                'connected_at'    => current_time( 'mysql' ),
                'last_synced_at'  => current_time( 'mysql' ),
            )
        );

        // Immediate first report - without this, the Connected Sites
        // detail page shows "Syncing…"/blank telemetry until the daily
        // cron eventually fires (Services\SiteTelemetryReporter's own
        // doc comment). Best-effort: a failure here doesn't affect the
        // connection itself, which already fully succeeded above.
        ( new SiteTelemetryReporter() )->report( $result['siteId'], $result['siteSecret'] );

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
            $result = ( new AiCreditsApiClient( VULOPILOT_VULOCLOUD_URL ) )->disconnect_site( $credential['site_id'], $credential['secret'] );

            if ( is_wp_error( $result ) ) {
                error_log( sprintf( '[VuloPilot] Could not revoke ConnectedSite %s on disconnect: %s', $credential['site_id'], $result->get_error_message() ) );
            }
        }

        delete_option( self::OPTION_KEY );
    }
}

/**
 * Handles the Connect broker's real redirect back to this site
 * (`admin-post.php?action=vulopilot_connect_broker_callback` -
 * AiCreditsConnection::get_broker_redirect_uri()'s own exact URL). Kept as
 * its own tiny class for the same reason GoogleSearchConsoleOAuthCallbackHandler
 * is: this hook must be registered unconditionally at plugin boot
 * (VuloPilot.php's init_classes()), not lazily inside a REST controller
 * that's only ever instantiated on `rest_api_init` - a request to
 * `admin-post.php` never fires that hook at all, so a REST-controller-only
 * registration would silently 404 every real return redirect.
 *
 * @class       ConnectBrokerCallbackHandler class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ConnectBrokerCallbackHandler {

	public function __construct() {
		add_action( 'admin_post_vulopilot_connect_broker_callback', array( $this, 'handle_callback' ) );
	}

	/**
	 * Verifies the real `state` nonce, exchanges the real `code` for a
	 * ConnectedSite credential (AiCreditsConnection::exchange_broker_code()),
	 * then redirects back to Settings → Integrations with a real
	 * success/error query flag. Never renders its own page, same
	 * "redirect back into the SPA" shape GoogleSearchConsoleOAuthCallbackHandler
	 * already uses.
	 *
	 * @return void
	 */
	public function handle_callback(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to do this.', 'vulopilot' ) );
		}

		$redirect_base = admin_url( 'admin.php?page=vulopilot#&tab=settings&subtab=integrations' );
		$connection    = new AiCreditsConnection();

		$state = isset( $_GET['state'] ) ? sanitize_text_field( wp_unslash( $_GET['state'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- this IS the real CSRF guard, verified explicitly below via verify_broker_state().
		$error = isset( $_GET['error'] ) ? sanitize_text_field( wp_unslash( $_GET['error'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- this is the broker's own redirect back to us, not a form submission; `state` (verified below) is this flow's real CSRF guard.

		if ( '' !== $error ) {
			wp_safe_redirect( $redirect_base . '&connect_status=error' );
			exit;
		}

		$code = isset( $_GET['code'] ) ? sanitize_text_field( wp_unslash( $_GET['code'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- this whole request only carries a `code` because it came from a `state`-nonced authorize URL we generated ourselves; verified below via verify_broker_state().

		if ( '' === $code || ! $connection->verify_broker_state( $state ) ) {
			wp_safe_redirect( $redirect_base . '&connect_status=error' );
			exit;
		}

		$result = $connection->exchange_broker_code( $code );

		wp_safe_redirect( $redirect_base . '&connect_status=' . ( is_wp_error( $result ) ? 'error' : 'connected' ) );
		exit;
	}
}

/**
 * HTTP client for VuloCloud's `/plugin/connect/*` broker endpoints - the
 * passwordless "Connect to VuloCloud" flow: this site's browser is
 * redirected to a real VuloCloud-hosted login/signup page instead of ever
 * typing a VuloCloud password into a form this plugin itself renders.
 * Mirrors GoogleOAuthBrokerClient exactly (same "authorize is a plain URL
 * build, only exchange is a real server-to-server call" shape) - see that
 * class's own docblock.
 *
 * @class       ConnectBrokerClient class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ConnectBrokerClient {

	/** @var string e.g. https://cloud.vulolabs.com (no trailing slash) */
	private $broker_url;

	public function __construct( string $broker_url ) {
		$this->broker_url = untrailingslashit( $broker_url );
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

		return $this->broker_url . '/plugin/connect/authorize?' . http_build_query( $params );
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
			$this->broker_url . '/plugin/connect/exchange',
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
}

/**
 * Encrypts/decrypts third-party secrets (Backups' S3/Drive credentials, the
 * VuloCloud site secret, Google tokens) before they're stored. Flagged in DATABASE.md and
 * ARCHITECTURE.md as new ground for this codebase - nothing else here
 * encrypts a secret at rest (the license system validates a license key
 * against VuloLabs's own server; it isn't a third-party credential
 * with direct spend risk the way an OpenAI/Anthropic/etc. key is).
 *
 * The encryption key is derived from wp_salt('auth') rather than stored
 * anywhere in the database - the same site-specific secret WordPress
 * itself relies on for auth cookies, so it moves (or is lost) exactly
 * when the rest of the site's secrets would too. AES-256-CBC with a
 * random IV per call, IV prepended to the ciphertext (standard
 * construction - the IV isn't secret, it just must never repeat with the
 * same key).
 *
 * @class       CredentialEncryption class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CredentialEncryption {

    private const CIPHER = 'aes-256-cbc';

    /**
     * @return string 32 raw bytes, suitable for aes-256-cbc.
     */
    private static function get_key(): string {
        return hash( 'sha256', wp_salt( 'auth' ), true );
    }

    /**
     * @param string $plaintext The raw API key.
     * @return string Base64-encoded IV + ciphertext.
     */
    public static function encrypt( string $plaintext ): string {
        $iv         = random_bytes( openssl_cipher_iv_length( self::CIPHER ) );
        $ciphertext = openssl_encrypt( $plaintext, self::CIPHER, self::get_key(), OPENSSL_RAW_DATA, $iv );

        return base64_encode( $iv . $ciphertext ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- binary-to-text encoding of AES ciphertext, not code obfuscation.
    }

    /**
     * @param string $encoded Value previously returned by encrypt().
     * @return string|null The original plaintext, or null if $encoded is malformed/undecryptable.
     */
    public static function decrypt( string $encoded ): ?string {
        $raw       = base64_decode( $encoded, true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- reversing encrypt()'s binary-to-text encoding, not code obfuscation.
        $iv_length = openssl_cipher_iv_length( self::CIPHER );

        if ( false === $raw || strlen( $raw ) <= $iv_length ) {
            return null;
        }

        $iv         = substr( $raw, 0, $iv_length );
        $ciphertext = substr( $raw, $iv_length );
        $plaintext  = openssl_decrypt( $ciphertext, self::CIPHER, self::get_key(), OPENSSL_RAW_DATA, $iv );

        return false === $plaintext ? null : $plaintext;
    }
}

/**
 * Reports this site's own real WordPress/PHP/theme/plugin details to
 * VuloCloud's generic `POST /connected-sites/ingest` endpoint - the one
 * HTTP surface that fills in the Connected Sites detail page's
 * "Site & Server"/"Plugin & Theme"/"Platform" cards (otherwise left
 * showing "-" forever, since connecting itself never sends this data -
 * see ConnectedSiteIngestController's own doc comment on the VuloCloud
 * side). Deliberately independent of which connection called it - a
 * future second connection type gets its own separate ConnectedSite row
 * with its own site_id/secret, and its own report() call against the
 * exact same payload shape.
 *
 * The "Plugin"/"Version" fields report THIS plugin's own real identity
 * (VULOPILOT_PLUGIN_NAME/VULOPILOT_PLUGIN_VERSION from config.php) -
 * never a hardcoded literal naming a different plugin (e.g.
 * "MultiVendorX"), so this reads correctly for a rebrand/fork that only
 * changes those two constants, and for any future plugin reusing this
 * same generic connect flow with its own values there.
 *
 * @class       SiteTelemetryReporter class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SiteTelemetryReporter {

	private const CRON_HOOK = 'vulopilot_site_telemetry_daily';

	/**
	 * Registers the daily cron report alongside the immediate,
	 * connect-time report - Services\SecurityScoreSnapshotRecorder's own
	 * "wp_next_scheduled()-guarded wp_schedule_event() on init" pattern.
	 * The immediate report itself isn't triggered from here - it's called
	 * directly by AiCreditsConnection::exchange_broker_code() right after
	 * its own successful connect, since only it knows the connection just
	 * became real.
	 */
	public function __construct() {
		add_action( 'init', array( $this, 'ensure_daily_report_scheduled' ) );
		add_action( self::CRON_HOOK, array( $this, 'report_all_connections' ) );
	}

	/**
	 * @return void
	 */
	public function ensure_daily_report_scheduled(): void {
		if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
			wp_schedule_event( time(), 'daily', self::CRON_HOOK );
		}
	}

	/**
	 * The daily cron callback - reports every currently-connected
	 * connection this plugin holds. Best-effort: a failed report just
	 * means the detail page keeps showing stale/blank telemetry until the
	 * next successful attempt, never surfaced to the site owner as an
	 * error.
	 *
	 * @return void
	 */
	public function report_all_connections(): void {
		$ai_credits = ( new AiCreditsConnection() )->get_site_credential();
		if ( null !== $ai_credits ) {
			$this->report( $ai_credits['site_id'], $ai_credits['secret'] );
		}
	}

	/**
	 * Real `POST {VULOPILOT_VULOCLOUD_URL}/connected-sites/ingest` -
	 * always the server-to-server URL, never
	 * VULOPILOT_VULOCLOUD_PUBLIC_URL (that's browser-facing only, see
	 * AiCreditsConnection::get_broker_authorize_url()'s own doc comment).
	 * Best-effort/fire-and-forget by design: a failed ingest just means
	 * the detail page keeps showing stale/blank telemetry until the next
	 * successful attempt (daily cron, or the site owner's next
	 * reconnect) - never surfaced to the site owner as an error, same
	 * posture a "usage tracker" ping already takes elsewhere in this
	 * plugin (Services\CoreWebVitalsBeacon, Services\PageSpeedScanner).
	 *
	 * @param string $site_id This connection's own ConnectedSite id.
	 * @param string $secret  This connection's own decrypted secret.
	 * @return bool True if VuloCloud accepted the ping (2xx).
	 */
	public function report( string $site_id, string $secret ): bool {
		if ( '' === trim( VULOPILOT_VULOCLOUD_URL ) ) {
			return false;
		}

		$response = wp_remote_post(
			untrailingslashit( VULOPILOT_VULOCLOUD_URL ) . '/connected-sites/ingest',
			array(
				'timeout' => 15,
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode(
					array(
						'siteId'  => $site_id,
						'secret'  => $secret,
						'payload' => $this->build_payload(),
					)
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return false;
		}

		return (int) wp_remote_retrieve_response_code( $response ) < 300;
	}

	/**
	 * The tracker payload itself - field names match
	 * connected-site-field-mapper.ts's own recognized keys exactly
	 * (verbatim strings, not valid JS/PHP identifiers, by design on that
	 * side - see that file's own doc comment).
	 *
	 * @return array<string, mixed>
	 */
	private function build_payload(): array {
		global $wpdb;
		$theme = wp_get_theme();

		return array(
			'Site Name'      => get_bloginfo( 'name' ),
			'Site Version'   => get_bloginfo( 'version' ),
			'Site Language'  => get_bloginfo( 'language' ),
			'Charset'        => get_bloginfo( 'charset' ),
			'Php Version'    => phpversion(),
			'Multisite'      => is_multisite(),
			'File Location'  => ABSPATH,
			'Email'          => get_bloginfo( 'admin_email' ),
			'Server'         => isset( $_SERVER['SERVER_SOFTWARE'] ) ? sanitize_text_field( wp_unslash( $_SERVER['SERVER_SOFTWARE'] ) ) : '', // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- server-reported environment info, not user input; sanitized regardless.
			'Text Direction' => is_rtl() ? 'rtl' : 'ltr',
			'Plugin'         => VULOPILOT_PLUGIN_NAME,
			'Version'        => VULOPILOT_PLUGIN_VERSION,
			'Status'         => 'active',
			'Theme'          => $theme->get( 'Name' ),
			'Theme Version'  => $theme->get( 'Version' ),
			'Platform'       => 'WordPress',
			// $wpdb->db_version() is the server's raw MySQL/MariaDB protocol
			// version (e.g. "5.7.44-log") - real and always available,
			// unlike Commerce/LMS Platform below.
			'Database'       => $wpdb->db_version(),
			// Core since WP 5.5 ('production' unless the host/wp-config.php
			// explicitly sets WP_ENVIRONMENT_TYPE otherwise) - real, not a
			// guess, so worth sending even though most sites report the
			// same default value.
			'Environment'    => wp_get_environment_type(),
			'Hosting Type'   => $this->detect_hosting_type(),
			// Commerce/LMS Platform, Framework Version and Site Type are
			// deliberately omitted - this plugin has no generic, honest way
			// to determine "does this site run a commerce/LMS platform" or
			// "what's its cart-framework version" (that was MultiVendorX's
			// own tracker reporting on itself, not something a generic
			// tracker for a security/management plugin can infer). Sending
			// a guess here would be worse than leaving the console's own
			// "-" placeholder. Country is likewise left for the VuloCloud
			// side to resolve from the request's own IP at ingest time,
			// not something this site can determine about itself.
		);
	}

	/**
	 * Best-effort recognition of a handful of hosts that identify
	 * themselves via a well-known constant/function in wp-config.php or
	 * an mu-plugin - never a network call, and '' (shown as "-") rather
	 * than a guess when none match, same honesty posture the rest of this
	 * payload follows.
	 *
	 * @return string
	 */
	private function detect_hosting_type(): string {
		if ( defined( 'WPE_APIKEY' ) ) {
			return 'WP Engine';
		}
		if ( defined( 'KINSTAMYSQLTUNNEL' ) || function_exists( 'kinsta_cache_purge' ) ) {
			return 'Kinsta';
		}
		if ( defined( 'PANTHEON_ENVIRONMENT' ) ) {
			return 'Pantheon';
		}
		if ( defined( 'IS_PRESSABLE' ) && IS_PRESSABLE ) {
			return 'Pressable';
		}
		if ( defined( 'FLYWHEEL_CONFIG_DIR' ) ) {
			return 'Flywheel';
		}
		if ( defined( 'GD_SYSTEM_PLUGIN_DIR' ) ) {
			return 'GoDaddy';
		}
		if ( defined( 'WPCOMSH__FILE__' ) ) {
			return 'WordPress.com';
		}
		return '';
	}
}

/**
 * Keeps `vulopilot_site_tone` (the placeholder field added earlier this
 * session - sent as a `site_tone` hint on every BYOK AI request, see
 * AI\AiRequestSender) learned
 * automatically from the site's own recent content instead of starting
 * permanently empty. Same "NOT an AIAction" posture as Geo\GeoAnalyzer/
 * ContentIntelligence\ContentAnalyzer: nothing about a post's own content
 * is mutated, so there is no Approval/Execution/Rollback lifecycle - it
 * reuses the exact same AiRequestSender every AIAction and those two
 * analyzers already go through (which is also why this needs zero new
 * VuloCloud-side code: it goes through AiRequestSender exactly like
 * every other direct caller of it).
 *
 * Triggered by content changes (`save_post`), not a schedule or an
 * on-demand button - but the actual AI call is always deferred via
 * `wp_schedule_single_event()` (same "don't block this request" shape
 * Services\BackupStorageManager already uses for its own slow upload
 * step), never run inline with the triggering save.
 *
 * @class       SiteToneLearner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SiteToneLearner {

    private const RELEARN_HOOK = 'vulopilot_learn_site_tone';

    /** How many of the site's most recently modified published posts/pages to sample - same SAMPLE_SIZE shape ContentIntelligence\ContentGapAnalyzer::sample_own_titles() already uses. */
    private const SAMPLE_SIZE = 10;

    /** Per-post excerpt length - enough real body text to judge tone from without needing the full post. */
    private const EXCERPT_LENGTH = 300;

    private AiRequestSender $request_sender;
    private ActivityLogRepository $activity_logs;

    /**
     * SiteToneLearner constructor.
     *
     * @param AiRequestSender          $request_sender Sends a prompt through the safety-validate → send → sanitize sequence.
     * @param ActivityLogRepository|null $activity_logs  Defaults to a new instance (injectable for tests).
     */
    public function __construct( AiRequestSender $request_sender, ?ActivityLogRepository $activity_logs = null ) {
        $this->request_sender = $request_sender;
        $this->activity_logs  = $activity_logs ?? new ActivityLogRepository();

        add_action( 'save_post', array( $this, 'maybe_schedule_relearn' ), 10, 2 );
        add_action( self::RELEARN_HOOK, array( $this, 'relearn' ) );
    }

    /**
     * The `save_post` callback - guards, then defers. Never calls AI itself.
     *
     * @param int      $post_id Post being saved.
     * @param \WP_Post $post    Same post object.
     * @return void
     */
    public function maybe_schedule_relearn( int $post_id, $post ): void {
        if ( wp_is_post_autosave( $post_id ) || wp_is_post_revision( $post_id ) ) {
            return;
        }

        if ( 'publish' !== $post->post_status || ! in_array( $post->post_type, array( 'post', 'page' ), true ) ) {
            return;
        }

        if ( wp_next_scheduled( self::RELEARN_HOOK ) ) {
            // Already a real re-learn pending - several quick edits in a
            // row (WordPress can fire save_post more than once for one
            // real edit, too) should still only trigger one analysis, not
            // a queue of them.
            return;
        }

        // A short delay, not time() - lets a flurry of edits in the same
        // real save settle before the one job that actually runs samples
        // the site's content, without needing extra dedup logic beyond
        // the wp_next_scheduled() check above.
        wp_schedule_single_event( time() + 30, self::RELEARN_HOOK );
    }

    /**
     * Registered on `self::RELEARN_HOOK`, run via WP-Cron only - the real
     * AI call happens here, never inline with the triggering save.
     *
     * @return void
     */
    public function relearn(): void {
        $samples = $this->sample_recent_content();

        if ( count( $samples ) < 2 ) {
            // Nothing meaningful to learn from yet - quietly wait for more
            // content, not an error.
            return;
        }

        try {
            $response = $this->request_sender->send( $this->build_prompt( $samples ), null, 'site_tone_learning' );
        } catch ( \Throwable $exception ) {
            // No BYOK key configured, provider failure, rate limited, safety
            // validation - none of these are worth a HIGH-severity log
            // entry (a background enhancement quietly not working isn't an
            // incident), and deliberately no fallback to platform AI
            // Credits: a passive, automatic job spending the site's own
            // metered credit balance without an explicit user action would
            // be a real surprise-cost foot-gun, unlike an action the site
            // owner directly clicked.
            $this->activity_logs->log(
                'site_tone.learn_failed',
                sprintf( 'Could not learn this site’s tone: %s', $exception->getMessage() ),
                Severity::INFO
            );
            return;
        }

        $this->maybe_store_learned_tone( trim( $response->get_content() ) );
    }

    /**
     * Same query shape as ContentIntelligence\ContentGapAnalyzer::sample_own_titles(),
     * extended to also carry a real body excerpt - tone needs more than a
     * title to judge.
     *
     * @return array<int, array{title: string, excerpt: string}>
     */
    private function sample_recent_content(): array {
        $posts = get_posts(
            array(
                'post_type'      => array( 'post', 'page' ),
                'post_status'    => 'publish',
                'posts_per_page' => self::SAMPLE_SIZE,
                'orderby'        => 'modified',
                'order'          => 'DESC',
            )
        );

        return array_map(
            static fn( \WP_Post $post ) => array(
                'title'   => $post->post_title,
                'excerpt' => mb_substr( wp_strip_all_tags( $post->post_content ), 0, self::EXCERPT_LENGTH ),
            ),
            $posts
        );
    }

    /**
     * Builds the one user-role message asking for a short tone phrase.
     *
     * @param array<int, array{title: string, excerpt: string}> $samples sample_recent_content()'s own output.
     * @return array<int, array{role: string, content: string}>
     */
    private function build_prompt( array $samples ): array {
        $listing = implode(
            "\n\n",
            array_map(
                static fn( array $sample ) => sprintf( "Title: %s\nExcerpt: %s", $sample['title'], $sample['excerpt'] ),
                $samples
            )
        );

        return array(
            array(
                'role'    => 'user',
                'content' => "Here are excerpts from this website's most recently published or updated content:\n\n"
                    . $listing
                    . "\n\nBased only on these excerpts, describe this site's overall writing tone/voice in a single short phrase (5-10 words), e.g. \"Friendly and casual\" or \"Formal and technical\". Reply with only that phrase, nothing else.",
            ),
        );
    }

    /**
     * Never overwrites a site owner's own manually-saved tone -
     * `site_tone_source` is only ever set to 'manual' by
     * Controllers\Settings::update_item(), whenever the General tab's own
     * "Site tone" field itself autosaves. Lives in the same flat
     * `vulopilot_settings` option every other setting does (not its own
     * dedicated option) - see Utill::VULOPILOT_SETTINGS_DEFAULTS's own
     * comment on `site_tone` for why.
     *
     * @param string $tone The AI's own real, freshly-learned phrase.
     * @return void
     */
    private function maybe_store_learned_tone( string $tone ): void {
        if ( '' === $tone ) {
            return;
        }

        $settings = wp_parse_args( (array) get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( 'manual' === $settings['site_tone_source'] ) {
            return;
        }

        $settings['site_tone']        = $tone;
        $settings['site_tone_source'] = 'auto';
        update_option( Utill::VULOPILOT_SETTINGS_KEY, $settings );
    }
}

/**
 * The stored status of a *person* signing into the VuloCloud platform from
 * this WP admin - a different concept from `appLocalizer.khali_dabba`
 * (vulopilot-pro's own site-wide Product ID/License Key, a different
 * bounded context entirely - see this plugin's own config.php docblock on
 * VULOPILOT_VULOCLOUD_URL).
 *
 * Read-only from this class's own side: `FrontendScripts::localize_scripts()`
 * surfaces `get_status()` as `appLocalizer.vulocloud_connected`/
 * `vulocloud_account_email` (a display-only badge), and
 * AiCreditsConnection::get_status() merges the same fields in as
 * `vulocloud_account_connected`/`_email` - informational only, AiCreditsConnection
 * doesn't depend on this connection to do its own work (see that class's own
 * docblock). Nothing currently writes to the underlying
 * `vulopilot_vulocloud_account` option - the email/password login flow that
 * used to (`connect()`/`register()`) was removed once the real "Connect to
 * VuloCloud" UI (ConnectVuloCloudPopup.tsx) settled on the passwordless
 * broker flow (AiCreditsConnection::get_broker_authorize_url()) exclusively,
 * so both fields above honestly read as "not connected" today rather than
 * stale/dead code pretending otherwise.
 *
 * Storage is one dedicated `vulopilot_vulocloud_account` option, same
 * "never round-trips to the browser, secrets encrypted at rest" posture
 * GoogleServicesConnection.php already established for its own OAuth
 * tokens (CredentialEncryption, same as that class) - `get_status()`
 * below never returns a raw token, only `connected`/`email`/`connected_at`.
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
                'refresh_token_enc' => '',
                'email'             => '',
                'connected_at'      => '',
            )
        );
    }

    /**
     * @return bool
     */
    public function is_connected(): bool {
        return '' !== $this->get_connection()['refresh_token_enc'];
    }

    /**
     * Never a token - see this class's own docblock.
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
}
