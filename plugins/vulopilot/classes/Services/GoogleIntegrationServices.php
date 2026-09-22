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

use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Real Google AdSense Management API (v2) client - backs the "Analytics"
 * settings panel's own AdSense account dropdown (GoogleServicesPanel.tsx),
 * reusing GoogleServicesConnection's shared OAuth token the same way
 * GoogleAnalyticsClient does. Read-only (`adsense.readonly` scope) - this
 * only ever lists a site owner's real AdSense accounts; VuloPilot doesn't
 * read or display any real earnings/ad-unit data (that's a separate,
 * larger feature - same honest boundary GoogleServicesPanel.tsx's own
 * closing note already draws for GA4/Search Console reporting).
 *
 * @class       GoogleAdSenseClient class
 * @version     1.0.0
 * @author      VuloLabs
 */
class GoogleAdSenseClient {

    private const ACCOUNTS_URL = 'https://adsense.googleapis.com/v2/accounts';

    /**
     * @var GoogleServicesConnection
     */
    private GoogleServicesConnection $connection;

    /**
     * @param GoogleServicesConnection|null $connection Defaults to a new instance (injectable for tests).
     */
    public function __construct( ?GoogleServicesConnection $connection = null ) {
        $this->connection = $connection ?? new GoogleServicesConnection();
    }

    /**
     * Real `GET https://adsense.googleapis.com/v2/accounts` - every
     * AdSense account this Google user can access. Most site owners only
     * ever have exactly one; a site with no AdSense account at all gets a
     * real empty array back, not an error (AdSense connection is
     * optional, unlike Search Console).
     *
     * @return array<int, array{account_id: string, display_name: string}>|\WP_Error
     */
    public function list_accounts() {
        $token = $this->connection->get_valid_access_token();

        if ( ! $token ) {
            return new \WP_Error( 'vulopilot_adsense_not_connected', __( 'Not connected to Google.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $response = wp_remote_get(
            self::ACCOUNTS_URL,
            array(
                'timeout' => 15,
                'headers' => array( 'Authorization' => 'Bearer ' . $token ),
            )
        );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        $status_code = (int) wp_remote_retrieve_response_code( $response );

        // A site owner with no AdSense account at all gets a real 403
        // ("PERMISSION_DENIED"/no accounts) from this endpoint - treated
        // as a real empty list, not surfaced as an error, since AdSense
        // is the one optional service in this connection (unlike Search
        // Console/Analytics, most WordPress sites never monetize with it).
        if ( 403 === $status_code ) {
            return array();
        }

        if ( 200 !== $status_code ) {
            return new \WP_Error( 'vulopilot_adsense_accounts_failed', __( 'Could not fetch your AdSense accounts.', 'vulopilot' ), array( 'status' => 502 ) );
        }

        $body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

        return array_map(
            static fn( $account ) => array(
                'account_id'   => str_replace( 'accounts/', '', (string) ( $account['name'] ?? '' ) ),
                'display_name' => $account['displayName'] ?? ( $account['name'] ?? '' ),
            ),
            $body['accounts'] ?? array()
        );
    }
}

/**
 * Real Google Analytics Admin API (GA4) client - backs the "Analytics"
 * settings panel's own Account/Property/Data Stream dropdowns
 * (GoogleServicesPanel.tsx), reusing GoogleServicesConnection's shared
 * OAuth token rather than its own separate connection. Two real calls,
 * matching the Admin API's own two-level shape (an account summary lists
 * its properties, but a property's web Measurement ID is only returned by
 * its own `dataStreams.list` call): `list_account_summaries()` populates
 * the Account/Property dropdowns, `list_data_streams()` populates the
 * Data Stream dropdown once a property is chosen - same two-step
 * selection the reference screenshots show.
 *
 * Read-only (`analytics.readonly` scope, see GoogleServicesConnection's
 * own `SCOPES`) - this only ever lists real account/property/stream
 * metadata, never writes anything to a site owner's GA4 account.
 *
 * @class       GoogleAnalyticsClient class
 * @version     1.0.0
 * @author      VuloLabs
 */
class GoogleAnalyticsClient {

    private const ACCOUNT_SUMMARIES_URL = 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries';

    private const DATA_STREAMS_URL = 'https://analyticsadmin.googleapis.com/v1beta/%s/dataStreams';

    /**
     * A different real Google API entirely from the two above (GA4 Data
     * API, not Admin API) - `%s` is a real `properties/{id}` resource name,
     * same shape `list_data_streams()`'s own `sprintf()` already uses.
     */
    private const RUN_REPORT_URL = 'https://analyticsdata.googleapis.com/v1beta/%s:runReport';

    /**
     * @var GoogleServicesConnection
     */
    private GoogleServicesConnection $connection;

    /**
     * @param GoogleServicesConnection|null $connection Defaults to a new instance (injectable for tests).
     */
    public function __construct( ?GoogleServicesConnection $connection = null ) {
        $this->connection = $connection ?? new GoogleServicesConnection();
    }

    /**
     * Real `GET .../v1beta/accountSummaries` - every GA4 account this
     * Google user can access, each with its own real properties.
     * `pageSize=200` is comfortably above what a single Google account
     * realistically has; pagination isn't implemented for the same
     * "reasonable bound, not truly unlimited" reason other list calls in
     * this codebase already take (see e.g. GeoAnalysis controller's own
     * `MAX_PAGES_QUERY`).
     *
     * @return array<int, array{account_id: string, account_name: string, properties: array<int, array{property_id: string, property_name: string}>}>|\WP_Error
     */
    public function list_account_summaries() {
        $token = $this->connection->get_valid_access_token();

        if ( ! $token ) {
            return new \WP_Error( 'vulopilot_ga4_not_connected', __( 'Not connected to Google.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $response = wp_remote_get(
            self::ACCOUNT_SUMMARIES_URL . '?pageSize=200',
            array(
                'timeout' => 15,
                'headers' => array( 'Authorization' => 'Bearer ' . $token ),
            )
        );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        if ( 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
            return new \WP_Error( 'vulopilot_ga4_accounts_failed', __( 'Could not fetch your Google Analytics accounts.', 'vulopilot' ), array( 'status' => 502 ) );
        }

        $body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

        return array_map(
            static fn( $summary ) => array(
                'account_id'   => str_replace( 'accounts/', '', (string) ( $summary['account'] ?? '' ) ),
                'account_name' => $summary['displayName'] ?? '',
                'properties'   => array_map(
                    static fn( $property ) => array(
                        'property_id'   => str_replace( 'properties/', '', (string) ( $property['property'] ?? '' ) ),
                        'property_name' => $property['displayName'] ?? '',
                    ),
                    $summary['propertySummaries'] ?? array()
                ),
            ),
            $body['accountSummaries'] ?? array()
        );
    }

    /**
     * Real `GET .../v1beta/properties/{id}/dataStreams` - a property's
     * real web data streams (app streams are skipped; VuloPilot only ever
     * injects a browser `gtag.js` snippet, so an iOS/Android stream's
     * `measurementId`-less shape wouldn't be usable here anyway).
     *
     * @param string $property_id A real `property_id` from `list_account_summaries()`.
     * @return array<int, array{data_stream_id: string, display_name: string, measurement_id: string}>|\WP_Error
     */
    public function list_data_streams( string $property_id ) {
        $token = $this->connection->get_valid_access_token();

        if ( ! $token ) {
            return new \WP_Error( 'vulopilot_ga4_not_connected', __( 'Not connected to Google.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $response = wp_remote_get(
            sprintf( self::DATA_STREAMS_URL, 'properties/' . $property_id ) . '?pageSize=200',
            array(
                'timeout' => 15,
                'headers' => array( 'Authorization' => 'Bearer ' . $token ),
            )
        );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        if ( 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
            return new \WP_Error( 'vulopilot_ga4_streams_failed', __( 'Could not fetch this property’s data streams.', 'vulopilot' ), array( 'status' => 502 ) );
        }

        $body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

        $streams = array_filter(
            (array) ( $body['dataStreams'] ?? array() ),
            static fn( $stream ) => ! empty( $stream['webStreamData']['measurementId'] )
        );

        return array_values(
            array_map(
                static fn( $stream ) => array(
                    'data_stream_id' => str_replace( array( 'properties/' . $property_id . '/dataStreams/' ), '', (string) ( $stream['name'] ?? '' ) ),
                    'display_name'   => $stream['displayName'] ?? '',
                    'measurement_id' => $stream['webStreamData']['measurementId'] ?? '',
                ),
                $streams
            )
        );
    }

    /**
     * Real `POST .../v1beta/{property}:runReport` - real daily GA4
     * `sessions` counts for a real, already-connected property, one row
     * per real calendar day GA4 has data for. Backs Keywords' own
     * "Estimated Traffic" card (vulopilot-pro's own Keywords module,
     * Rest::get_summary()) when a GA4 property has actually been selected
     * (GoogleServicesConnection's own `ga4_property_id`) - that card falls
     * back to real Search Console click totals otherwise, never a
     * fabricated number either way. A single `date`-dimensioned call
     * covering the whole requested range (rather than two separate
     * current/previous-period totals calls) so the caller can both sum a
     * period's total AND build a real day-by-day trend sparkline from one
     * real API round trip.
     *
     * @param string $property_id A real `property_id` (GoogleServicesConnection::get_status()'s own `ga4_property_id`).
     * @param string $start_date  `Y-m-d`.
     * @param string $end_date    `Y-m-d`.
     * @return array<string, int>|\WP_Error `Y-m-d` => real session count, only for days GA4 actually returned a row.
     */
    public function run_sessions_report( string $property_id, string $start_date, string $end_date ) {
        $token = $this->connection->get_valid_access_token();

        if ( ! $token ) {
            return new \WP_Error( 'vulopilot_ga4_not_connected', __( 'Not connected to Google.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $response = wp_remote_post(
            sprintf( self::RUN_REPORT_URL, 'properties/' . $property_id ),
            array(
                'timeout' => 30,
                'headers' => array(
                    'Authorization' => 'Bearer ' . $token,
                    'Content-Type'  => 'application/json',
                ),
                'body'    => wp_json_encode(
                    array(
                        'dateRanges' => array(
                            array(
                                'startDate' => $start_date,
                                'endDate'   => $end_date,
                            ),
                        ),
                        'dimensions' => array( array( 'name' => 'date' ) ),
                        'metrics'    => array( array( 'name' => 'sessions' ) ),
                        'limit'      => 1000,
                    )
                ),
            )
        );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        if ( 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
            return new \WP_Error( 'vulopilot_ga4_report_failed', __( 'Could not fetch your Google Analytics traffic.', 'vulopilot' ), array( 'status' => 502 ) );
        }

        $body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

        $sessions_by_date = array();

        foreach ( (array) ( $body['rows'] ?? array() ) as $row ) {
            // GA4's own `YYYYMMDD` date-dimension format, normalized to
            // `Y-m-d` so this matches every other date this codebase
            // stores/compares (`snapshot_date` etc.) rather than
            // introducing a second date format for callers to juggle.
            $raw_date = (string) ( $row['dimensionValues'][0]['value'] ?? '' );

            if ( 8 !== strlen( $raw_date ) ) {
                continue;
            }

            $normalized_date = substr( $raw_date, 0, 4 ) . '-' . substr( $raw_date, 4, 2 ) . '-' . substr( $raw_date, 6, 2 );

            $sessions_by_date[ $normalized_date ] = (int) ( $row['metricValues'][0]['value'] ?? 0 );
        }

        return $sessions_by_date;
    }

    /**
     * Real `POST .../v1beta/{property}:runReport` - real GA4 sessions
     * grouped by `sessionDefaultChannelGroup`, GA4's own built-in traffic-
     * source classification ("Organic Search", "Direct", "Referral",
     * "Organic Social", "Paid Search", "Email", etc. - the exact same
     * grouping GA4's own "Traffic acquisition" report uses). Backs "SEO &
     * Visibility → Overview"'s "Visibility by Source" card
     * (Controllers\Visibility::get_traffic_sources()) - this plugin has no
     * traffic-source data of its own to fabricate (see that method's own
     * docblock), so this card only ever renders when a real GA4 property
     * is connected and genuinely has session data to report.
     *
     * @param string $property_id A real `property_id` (GoogleServicesConnection::get_status()'s own `ga4_property_id`).
     * @param string $start_date  `Y-m-d`.
     * @param string $end_date    `Y-m-d`.
     * @return array<string, int>|\WP_Error Real channel label => real session count, only for channels GA4 actually returned a row for.
     */
    public function run_channel_group_report( string $property_id, string $start_date, string $end_date ) {
        $token = $this->connection->get_valid_access_token();

        if ( ! $token ) {
            return new \WP_Error( 'vulopilot_ga4_not_connected', __( 'Not connected to Google.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $response = wp_remote_post(
            sprintf( self::RUN_REPORT_URL, 'properties/' . $property_id ),
            array(
                'timeout' => 30,
                'headers' => array(
                    'Authorization' => 'Bearer ' . $token,
                    'Content-Type'  => 'application/json',
                ),
                'body'    => wp_json_encode(
                    array(
                        'dateRanges' => array(
                            array(
                                'startDate' => $start_date,
                                'endDate'   => $end_date,
                            ),
                        ),
                        'dimensions' => array( array( 'name' => 'sessionDefaultChannelGroup' ) ),
                        'metrics'    => array( array( 'name' => 'sessions' ) ),
                        'limit'      => 50,
                    )
                ),
            )
        );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        if ( 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
            return new \WP_Error( 'vulopilot_ga4_report_failed', __( 'Could not fetch your Google Analytics traffic sources.', 'vulopilot' ), array( 'status' => 502 ) );
        }

        $body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

        $sessions_by_channel = array();

        foreach ( (array) ( $body['rows'] ?? array() ) as $row ) {
            $channel = (string) ( $row['dimensionValues'][0]['value'] ?? '' );

            if ( '' === $channel ) {
                continue;
            }

            $sessions_by_channel[ $channel ] = (int) ( $row['metricValues'][0]['value'] ?? 0 );
        }

        return $sessions_by_channel;
    }
}

/**
 * Real `gtag.js` output on the public-facing site - the "Analytics"
 * settings panel's own "Install analytics code"/"Anonymize IP
 * addresses"/"Self-Hosted Analytics JS File"/"Exclude Logged-in users"
 * toggles (GoogleServicesPanel.tsx) actually do something once a GA4
 * property is selected (GoogleServicesConnection's own
 * `ga4_measurement_id`), the same "unconditional construction, settings
 * gate the output" shape WebmasterToolsManager/CanonicalUrlManager
 * already use elsewhere in this file.
 *
 * "Self-Hosted Analytics JS File" fetches Google's own real
 * `https://www.googletagmanager.com/gtag/js` once, caches it as a real
 * file under `wp-content/uploads/vulopilot/`, and serves that local copy
 * instead of linking Google's CDN directly - the same real
 * fetch-and-cache-a-file approach IndexNowKeyFileServer already
 * establishes for a different real file, not a fabricated proxy.
 *
 * @class       GoogleAnalyticsTracker class
 * @version     1.0.0
 * @author      VuloLabs
 */
class GoogleAnalyticsTracker {

    private const CACHE_FILENAME = 'vulopilot-ga-gtag.js';

    public function __construct() {
        add_action( 'wp_enqueue_scripts', array( $this, 'maybe_output_tracking_code' ) );
    }

    /**
     * @return void
     */
    public function maybe_output_tracking_code(): void {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        // Same `array('key')`-means-on/`array()`-means-off toggle-checkbox
        // convention every other single ToggleInput-driven setting in
        // this codebase uses - see Utill.php's own defaults for these 4
        // keys.
        if ( empty( $settings['ga_install_tracking_code'] ) ) {
            return;
        }

        if ( ! empty( $settings['ga_exclude_logged_in_users'] ) && is_user_logged_in() ) {
            return;
        }

        $connection      = ( new GoogleServicesConnection() )->get_status();
        $measurement_id = $connection['ga4_measurement_id'] ?? '';

        if ( '' === $measurement_id ) {
            return;
        }

        $script_src = ! empty( $settings['ga_self_hosted_js'] )
            ? $this->get_self_hosted_url( $measurement_id )
            : 'https://www.googletagmanager.com/gtag/js?id=' . rawurlencode( $measurement_id );

        $config_options = array();

        if ( ! empty( $settings['ga_anonymize_ip'] ) ) {
            $config_options['anonymize_ip'] = true;
        }

        // Registered/enqueued via the real WP script APIs (async, per the
        // 'strategy' arg WP 6.3+ supports - Requires at least: 6.5) rather
        // than a raw `<script>` tag printed straight into `wp_head`, same
        // as every other real script this plugin's own admin bundle already
        // goes through `wp_enqueue_script()`/`wp_add_inline_script()` for.
        wp_enqueue_script(
            'vulopilot-ga-gtag',
            $script_src,
            array(),
            null,
            array( 'strategy' => 'async' )
        );

        wp_add_inline_script(
            'vulopilot-ga-gtag',
            sprintf(
                "window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', '%s'%s);",
                esc_js( $measurement_id ),
                $config_options ? ', ' . wp_json_encode( $config_options ) : ''
            )
        );
    }

    /**
     * Fetches (once, then caches) Google's own real gtag.js for this
     * property and returns the local URL to serve it from. Falls back to
     * Google's own CDN URL if the fetch/cache write ever fails - a self-
     * hosting toggle that silently breaks tracking entirely on a transient
     * fetch failure would be worse than the one request to Google's CDN
     * it was trying to avoid.
     *
     * @param string $measurement_id Real GA4 Measurement ID (e.g. "G-XXXXXXX").
     * @return string
     */
    private function get_self_hosted_url( string $measurement_id ): string {
        $upload_dir = wp_upload_dir();
        $cache_dir  = trailingslashit( $upload_dir['basedir'] ) . 'vulopilot';
        $cache_file = $cache_dir . '/' . self::CACHE_FILENAME;
        $cache_url  = trailingslashit( $upload_dir['baseurl'] ) . 'vulopilot/' . self::CACHE_FILENAME;
        $remote_url = 'https://www.googletagmanager.com/gtag/js?id=' . rawurlencode( $measurement_id );

        // Re-fetched once a day (real gtag.js content does change) rather
        // than only ever once - a stale-forever local copy would silently
        // drift from what Google actually serves.
        if ( file_exists( $cache_file ) && ( time() - filemtime( $cache_file ) ) < DAY_IN_SECONDS ) {
            return $cache_url;
        }

        $response = wp_remote_get( $remote_url, array( 'timeout' => 15 ) );

        if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
            return file_exists( $cache_file ) ? $cache_url : $remote_url;
        }

        if ( ! file_exists( $cache_dir ) ) {
            wp_mkdir_p( $cache_dir );
        }

        global $wp_filesystem;

        if ( ! function_exists( 'WP_Filesystem' ) ) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }

        WP_Filesystem();

        if ( $wp_filesystem && $wp_filesystem->put_contents( $cache_file, wp_remote_retrieve_body( $response ), FS_CHMOD_FILE ) ) {
            return $cache_url;
        }

        return $remote_url;
    }
}

/**
 * HTTP client for VuloCloud's `/plugin/google/*` broker endpoints - the
 * real fix for the "Redirect URI scaling" trade-off documented in
 * config.php: VuloCloud holds the ONE Google Cloud OAuth Client actually
 * registered with Google (its own fixed, permanently-registered redirect
 * URI), so no customer domain ever needs adding to a Google-side
 * allowlist. See GOOGLE_CONNECT_BROKER.md (this plugin's own root) for
 * the full contract VuloCloud's server side must implement.
 *
 * Only the token exchange/refresh legs are real server-to-server calls
 * from here - the authorize leg (`get_authorize_url()`) is a plain URL
 * build for the browser to navigate to; VuloCloud itself does the actual
 * 302 to accounts.google.com, same "browser does the 3-way dance, server
 * only handles the token leg" shape GoogleServicesConnection already
 * uses talking to Google directly.
 *
 * Mirrors vulopilot-pro's LicenseApiClient (wp_remote_post(), JSON
 * body/response, WP_Error only for a genuine transport failure) - kept
 * as its own class for the same reason: GoogleServicesConnection stays
 * the one place that decides direct-vs-broker, this class only knows how
 * to talk to the broker once that decision is made.
 *
 * @class       GoogleOAuthBrokerClient class
 * @version     1.0.0
 * @author      VuloLabs
 */
class GoogleOAuthBrokerClient {

	/** @var string e.g. https://cloud.vulolabs.com (no trailing slash) */
	private $broker_url;

	public function __construct( string $broker_url ) {
		$this->broker_url = untrailingslashit( $broker_url );
	}

	/**
	 * Browser-facing URL only - VuloCloud itself 302s this straight to
	 * accounts.google.com (using the Organization that owns
	 * `$application_id`'s own Google Cloud OAuth Client) after recording
	 * `$return_uri` (this site's own admin-post.php callback) against a
	 * broker-generated correlation id, so it knows where to send the
	 * browser back once Google redirects to VuloCloud's own fixed
	 * callback. `$state` is this site's own opaque CSRF nonce
	 * (GoogleServicesConnection::encode_state()) - VuloCloud never
	 * inspects it, only echoes it back verbatim on the return redirect,
	 * exactly like Google's own `state` param already does for the
	 * direct-connect flow.
	 *
	 * `$application_id` is this site's own registered VuloCloud
	 * LicenseApplication id (VULOPILOT_GOOGLE_APPLICATION_ID) - how
	 * VuloCloud resolves WHICH Organization's Google Client to use, since
	 * this request carries no session/auth of its own. Query param names
	 * are camelCase, matching every other new VuloCloud request contract
	 * (see GOOGLE_CONNECT_INTEGRATION.md §5) - only exchange()/refresh()'s
	 * *response* bodies stay snake_case, for the OAuth2-standard-field-
	 * names reason documented on post() below.
	 *
	 * @return string
	 */
	public function get_authorize_url( string $application_id, string $domain, string $return_uri, string $state ): string {
		return $this->broker_url . '/plugin/google/authorize?' . http_build_query(
			array(
				'applicationId' => $application_id,
				'domain'        => $domain,
				'returnUri'     => $return_uri,
				'state'         => $state,
			)
		);
	}

	/**
	 * Real `POST {broker}/plugin/google/exchange` - redeems the
	 * single-use, short-lived `code` VuloCloud's own redirect handed back
	 * to this site's admin-post.php callback for the real Google tokens
	 * VuloCloud obtained on this site's behalf. Google's `refresh_token`
	 * is only ever present on a subject's very first consent - same
	 * caveat GoogleServicesConnection::exchange_code_for_tokens() already
	 * documents for the direct flow, unchanged by going through a broker.
	 *
	 * @return array{access_token: string, refresh_token: string, expires_in: int}|\WP_Error
	 */
	public function exchange( string $domain, string $code ) {
		return $this->post(
			'/plugin/google/exchange',
			array(
				'domain' => $domain,
				'code'   => $code,
			),
			'vulopilot_google_broker_exchange_failed',
			__( 'Google connect broker could not complete the token exchange.', 'vulopilot' )
		);
	}

	/**
	 * Real `POST {broker}/plugin/google/refresh` - used instead of a
	 * direct `grant_type=refresh_token` call to Google whenever the
	 * stored connection's tokens were originally issued via this broker
	 * (GoogleServicesConnection::refresh_access_token()'s own `via`
	 * check): a refresh token is only valid against the OAuth Client that
	 * issued it, and a broker-issued one belongs to the Organization's own
	 * Google Client that `$application_id` resolves to, not this build's
	 * embedded VULOPILOT_GOOGLE_CLIENT_ID/SECRET. `$application_id` is
	 * required here for the same reason it's required by
	 * get_authorize_url() - a bare refresh token doesn't say which
	 * Organization's Client it belongs to.
	 *
	 * @return array{access_token: string, expires_in: int}|\WP_Error
	 */
	public function refresh( string $application_id, string $domain, string $refresh_token ) {
		return $this->post(
			'/plugin/google/refresh',
			array(
				'applicationId' => $application_id,
				'domain'        => $domain,
				'refreshToken'  => $refresh_token,
			),
			'vulopilot_google_broker_refresh_failed',
			__( 'Google connect broker could not refresh the access token.', 'vulopilot' )
		);
	}

	/**
	 * Shared POST/parse/error-shape plumbing for exchange()/refresh() -
	 * both endpoints return the same access_token/expires_in envelope
	 * (refresh_token only present on exchange()'s response), so both can
	 * share one request path. Response fields stay snake_case
	 * (access_token/refresh_token/expires_in) even though every request
	 * this class sends is now camelCase - deliberate, matches OAuth2's
	 * own RFC 6749 §5.1 field names, and VuloCloud's
	 * GoogleBrokerController maps its responses to match this parsing
	 * unchanged (see GOOGLE_CONNECT_INTEGRATION.md §5).
	 *
	 * @param string $path             e.g. '/plugin/google/exchange'.
	 * @param array  $body              JSON-encoded request body.
	 * @param string $error_code        WP_Error code on a completed-but-unsuccessful response.
	 * @param string $default_message   WP_Error message when the broker's own response carries none.
	 * @return array<string, mixed>|\WP_Error
	 */
	private function post( string $path, array $body, string $error_code, string $default_message ) {
		$response = wp_remote_post(
			$this->broker_url . $path,
			array(
				'timeout' => 15,
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode( $body ),
			)
		);

		if ( is_wp_error( $response ) ) {
			// DNS failure, connection refused, timeout, ... - the request
			// never got a response at all.
			return $response;
		}

		$status        = (int) wp_remote_retrieve_response_code( $response );
		$response_body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

		if ( ! is_array( $response_body ) ) {
			return new \WP_Error(
				'vulopilot_google_broker_unparseable_response',
				sprintf(
					/* translators: %d: HTTP status code. */
					__( 'Google connect broker returned a non-JSON response (HTTP %d).', 'vulopilot' ),
					$status
				)
			);
		}

		if ( $status < 200 || $status >= 300 || empty( $response_body['access_token'] ) ) {
			return new \WP_Error(
				$error_code,
				$response_body['message'] ?? $response_body['error'] ?? $default_message
			);
		}

		return array(
			'access_token'  => $response_body['access_token'],
			'refresh_token' => $response_body['refresh_token'] ?? '',
			'expires_in'    => (int) ( $response_body['expires_in'] ?? 3600 ),
		);
	}
}

/**
 * Handles Google's real OAuth redirect back to this site
 * (`admin-post.php?action=vulopilot_gsc_oauth_callback` -
 * GoogleServicesConnection::get_redirect_uri()'s own exact URL). Kept as
 * its own tiny class (rather than folding this into
 * Controllers\GoogleServices) for the same reason
 * IndexNowKeyFileServer/LlmsTxtGenerator are their own classes: this hook
 * must be registered unconditionally at plugin boot (VuloPilot.php's
 * init_classes()), not lazily inside a REST controller that's only ever
 * instantiated on `rest_api_init` - a request to `admin-post.php` never
 * fires that hook at all, so a REST-controller-only registration would
 * silently 404 every real Google redirect.
 *
 * Class/action name kept as "gsc" (Search Console) even though the real
 * connection now also covers Analytics/AdSense - renaming would mean
 * every already-registered Google Cloud OAuth Client's "Authorized
 * redirect URI" (a site owner's own real, external Google Cloud config)
 * would silently stop matching. One connection, one redirect URI, for
 * the lifetime of this feature.
 *
 * @class       GoogleSearchConsoleOAuthCallbackHandler class
 * @version     1.0.0
 * @author      VuloLabs
 */
class GoogleSearchConsoleOAuthCallbackHandler {

    public function __construct() {
        add_action( 'admin_post_vulopilot_gsc_oauth_callback', array( $this, 'handle_callback' ) );
    }

    /**
     * Verifies the real `state` nonce, exchanges the real `code` for
     * tokens (GoogleServicesConnection::exchange_code_for_tokens(), an
     * actual `POST` to Google's token endpoint), then redirects back to
     * whichever real SPA tab actually started the connection - Settings'
     * own Google Services panel, or SEO & Visibility's Keywords tab
     * (GoogleServicesConnection::get_return_to_from_state(), read from
     * `state` regardless of whether the nonce inside it still checks out,
     * so even an error redirect lands back where the site owner was
     * rather than always defaulting to Settings) - with a real
     * success/error query flag. Never renders its own page, same
     * "redirect back into the SPA" shape every other admin-post-style
     * handler in this codebase (IndexNowKeyFileServer excluded - that one
     * serves a file, not a redirect) would use if one existed yet.
     *
     * @return void
     */
    public function handle_callback(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to do this.', 'vulopilot' ) );
        }

        $connection = new GoogleServicesConnection();

        $state         = isset( $_GET['state'] ) ? sanitize_text_field( wp_unslash( $_GET['state'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- the nonce inside `state` (verified explicitly below via verify_state()) IS this flow's real CSRF guard; `return_to` is read from this same value regardless of nonce validity, but is itself just an allow-listed plain string (see get_return_to_from_state()'s own docblock), not something that needs the nonce check.
        $redirect_base = 'keywords' === $connection->get_return_to_from_state( $state )
            ? admin_url( 'admin.php?page=vulopilot#&tab=seo-visibility&subtab=keywords' )
            : admin_url( 'admin.php?page=vulopilot#&tab=settings&subtab=google-services' );

        $error = isset( $_GET['error'] ) ? sanitize_text_field( wp_unslash( $_GET['error'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- this is Google's own redirect back to us, not a form submission; the `state` param (verified below) is this flow's real CSRF guard.

        if ( '' !== $error ) {
            wp_safe_redirect( $redirect_base . '&gsc_status=error' );
            exit;
        }

        $code = isset( $_GET['code'] ) ? sanitize_text_field( wp_unslash( $_GET['code'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- this whole request only carries a `code` because it came from a `state`-nonced authorize URL we generated ourselves; verified below via verify_state().

        if ( '' === $code || ! $connection->verify_state( $state ) ) {
            wp_safe_redirect( $redirect_base . '&gsc_status=error' );
            exit;
        }

        // Same `code`+`state` shape either way - a broker-configured
        // build only ever sent the browser to the broker's own authorize
        // URL (GoogleServicesConnection::get_authorization_url()), so a
        // `code` landing back here while the broker is still configured
        // is VuloCloud's own short-lived exchange code, not Google's.
        $result = $connection->has_broker()
            ? $connection->exchange_broker_code_for_tokens( $code )
            : $connection->exchange_code_for_tokens( $code );

        wp_safe_redirect( $redirect_base . '&gsc_status=' . ( is_wp_error( $result ) ? 'error' : 'connected' ) );
        exit;
    }
}

/**
 * Real Google OAuth 2.0 connection shared by Search Console, Analytics
 * (GA4), and AdSense - one "Connect Google Services" button/consent
 * screen covering all three read scopes at once, matching the reference
 * flow (a single connect step, then per-service pickers) rather than
 * three separate connect buttons. Replaces the earlier
 * GoogleSearchConsoleClient, which only ever covered Search Console.
 *
 * Unlike a bring-your-own-credential integration (AI Providers' own API
 * keys), the Client ID/Secret here is ONE shared Google Cloud OAuth
 * Client VuloLabs itself registers - `VULOPILOT_GOOGLE_CLIENT_ID`/
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
 * deliberately NOT part of `Utill::VULOPILOT_SETTINGS_KEY` - that option
 * round-trips wholesale to the browser on every `GET /settings` call
 * (Controllers\Settings::get_items()), and a client secret/access/refresh
 * token must never reach the client the way AiProviderConfigRepository's
 * own `credentials` column never does (see
 * Controllers\VuloCloudAiConnection::prepare_config_for_response()). Every secret
 * value here is encrypted at rest via CredentialEncryption, same as that
 * AI credential column.
 *
 * @class       GoogleServicesConnection class
 * @version     1.0.0
 * @author      VuloLabs
 */
class GoogleServicesConnection {

    private const OPTION_KEY = 'vulopilot_google_connection';

    /**
     * One combined consent screen for all three services - matching the
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
     * Google access tokens are typically valid ~3600s - refreshed a minute
     * early so a request never races an in-flight expiry.
     */
    private const EXPIRY_SAFETY_MARGIN = 60;

    /**
     * Every real SPA destination Google's own redirect
     * (GoogleSearchConsoleOAuthCallbackHandler::handle_callback()) is
     * allowed to land back on - 'settings' (Settings → Scanning → Google
     * Services, GoogleServicesPanel.tsx's own original, only-ever
     * destination) or 'keywords' (SEO & Visibility → Keywords,
     * KeywordsTab.tsx's own inline connect flow). Kept as a real
     * allow-list rather than trusting whatever string a caller passes
     * straight through into a redirect URL.
     */
    private const RETURN_TARGETS = array( 'settings', 'keywords' );

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
                // 'direct' (embedded shared Client) or 'broker'
                // (VuloCloud) - which path actually issued the current
                // tokens, so refresh_access_token() knows which OAuth
                // Client the stored refresh_token belongs to. Empty
                // string only pre-first-connect.
                'via'                => '',
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
     * (down to trailing slashes/scheme) - `admin-post.php` (not a REST
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
     * ID/Secret for this build yet (see config.php's own docblock) -
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
     * Whether this build has a VuloCloud Google Connect broker configured
     * (config.php's own docblock) - when true, `get_authorization_url()`
     * routes through it instead of the embedded shared Client above, and
     * every customer domain works without being individually registered
     * in Google Cloud Console. Checked ahead of `has_client_credentials()`
     * everywhere both are relevant: the broker needs no embedded
     * credentials at all, so a broker-only deployment can leave
     * VULOPILOT_GOOGLE_CLIENT_ID/SECRET undefined entirely.
     *
     * Requires VULOPILOT_GOOGLE_APPLICATION_ID too, not just the broker
     * URL - VuloCloud's `/plugin/google/*` endpoints resolve which
     * Organization's Google Cloud OAuth Client to use FROM that id (see
     * config.php's own docblock); a broker URL with no application id
     * configured can never complete a real request, so this honestly
     * reports "not available" rather than sending a request VuloCloud
     * would just reject.
     *
     * @return bool
     */
    public function has_broker(): bool {
        return defined( 'VULOPILOT_GOOGLE_BROKER_URL' ) && '' !== VULOPILOT_GOOGLE_BROKER_URL
            && defined( 'VULOPILOT_GOOGLE_APPLICATION_ID' ) && '' !== VULOPILOT_GOOGLE_APPLICATION_ID;
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
     * Real Google OAuth 2.0 authorization URL - `access_type=offline` +
     * `prompt=consent` so Google actually issues a refresh_token (it
     * otherwise only does this on a user's very first consent, silently
     * omitting it on repeat authorizations), `state` carries both a real
     * WP nonce (verified in `verify_state()` on the way back, guarding
     * the callback against CSRF the same way every other WordPress
     * admin-post handler's own `check_admin_referer()` would) and
     * `$return_to`, so the callback can send the browser back to
     * whichever real SPA tab actually started the connection instead of
     * always landing on Settings - Google itself never inspects `state`,
     * it just echoes whatever opaque value we send back on redirect.
     *
     * @param string $return_to One of self::RETURN_TARGETS; anything else silently falls back to 'settings'.
     * @return string|null Null if neither a broker nor embedded client credentials are configured for this build yet.
     */
    public function get_authorization_url( string $return_to = 'settings' ): ?string {
        if ( ! in_array( $return_to, self::RETURN_TARGETS, true ) ) {
            $return_to = 'settings';
        }

        $state = self::encode_state( $return_to );

        if ( $this->has_broker() ) {
            return ( new GoogleOAuthBrokerClient( VULOPILOT_GOOGLE_BROKER_URL ) )
                ->get_authorize_url( VULOPILOT_GOOGLE_APPLICATION_ID, home_url(), $this->get_redirect_uri(), $state );
        }

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
            'state'         => $state,
        );

        return self::AUTHORIZE_URL . '?' . http_build_query( $params );
    }

    /**
     * @param string $return_to Already validated against self::RETURN_TARGETS by the caller.
     * @return string Base64'd JSON - a real WP nonce plus the plain, allow-listed return target.
     */
    private static function encode_state( string $return_to ): string {
        return base64_encode( // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- URL-safe transport encoding for an opaque `state` value, not obfuscation; every field inside is either a real WP nonce (verified below) or an allow-listed plain string.
            (string) wp_json_encode(
                array(
                    'nonce'     => wp_create_nonce( 'vulopilot_gsc_oauth' ),
                    'return_to' => $return_to,
                )
            )
        );
    }

    /**
     * @param string $state The `state` query param Google's redirect carried back.
     * @return array{nonce: string, return_to: string}
     */
    private static function decode_state( string $state ): array {
        $decoded = json_decode( (string) base64_decode( $state, true ), true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- decoding this class's own encode_state(), not obfuscation.

        $nonce     = is_array( $decoded ) && is_string( $decoded['nonce'] ?? null ) ? $decoded['nonce'] : '';
        $return_to = is_array( $decoded ) && is_string( $decoded['return_to'] ?? null ) ? $decoded['return_to'] : '';

        return array(
            'nonce'     => $nonce,
            'return_to' => in_array( $return_to, self::RETURN_TARGETS, true ) ? $return_to : 'settings',
        );
    }

    /**
     * @param string $state The `state` query param Google's redirect carried back.
     * @return bool
     */
    public function verify_state( string $state ): bool {
        return false !== wp_verify_nonce( self::decode_state( $state )['nonce'], 'vulopilot_gsc_oauth' );
    }

    /**
     * Read independently of `verify_state()` - deliberately NOT gated on
     * nonce validity, so even a failed/expired handshake still redirects
     * the browser back to whichever real tab the site owner started from
     * rather than always falling back to Settings on error. Safe to trust
     * without the nonce check: `decode_state()` itself only ever returns
     * an allow-listed value (self::RETURN_TARGETS), so there's no
     * open-redirect or injection surface here - worst case is landing on
     * the wrong (but still real, internal) SPA tab.
     *
     * @param string $state The `state` query param Google's redirect carried back.
     * @return string One of self::RETURN_TARGETS.
     */
    public function get_return_to_from_state( string $state ): string {
        return self::decode_state( $state )['return_to'];
    }

    /**
     * Real `POST https://oauth2.googleapis.com/token` authorization_code
     * exchange - the actual OAuth handshake, not a stub. Both tokens are
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
            'via'              => 'direct',
        );

        if ( ! empty( $body['refresh_token'] ) ) {
            $update['refresh_token_enc'] = CredentialEncryption::encrypt( $body['refresh_token'] );
        }

        $this->save_connection( $update );

        return true;
    }

    /**
     * Broker counterpart of `exchange_code_for_tokens()` - redeems the
     * broker-issued `code` GoogleSearchConsoleOAuthCallbackHandler
     * received on VuloCloud's own redirect back to this site's
     * admin-post.php callback, via a real server-to-server
     * `POST {broker}/plugin/google/exchange` (GoogleOAuthBrokerClient).
     * Stores `via => 'broker'` so `refresh_access_token()` later knows
     * this connection's refresh_token belongs to VuloCloud's OAuth
     * Client, not the embedded one.
     *
     * @param string $code The `code` query param VuloCloud's redirect carried back.
     * @return true|\WP_Error
     */
    public function exchange_broker_code_for_tokens( string $code ) {
        $result = ( new GoogleOAuthBrokerClient( VULOPILOT_GOOGLE_BROKER_URL ) )->exchange( home_url(), $code );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        $update = array(
            'access_token_enc' => CredentialEncryption::encrypt( $result['access_token'] ),
            'token_expires_at' => time() + $result['expires_in'],
            'connected_at'     => current_time( 'mysql' ),
            'via'              => 'broker',
        );

        if ( '' !== $result['refresh_token'] ) {
            $update['refresh_token_enc'] = CredentialEncryption::encrypt( $result['refresh_token'] );
        }

        $this->save_connection( $update );

        return true;
    }

    /**
     * Real `refresh_token` grant - called by `get_valid_access_token()`
     * whenever the stored access token is expired (or about to be).
     * Branches on the stored connection's own `via` flag: a refresh
     * token is only valid against the OAuth Client that issued it, so a
     * broker-issued one must be refreshed through the broker
     * (GoogleOAuthBrokerClient::refresh()), not the embedded
     * Client ID/Secret's direct grant below.
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

        if ( 'broker' === $connection['via'] ) {
            if ( ! $this->has_broker() ) {
                // Connected via broker, but this build's broker URL was
                // since unset - nothing left that can legally refresh
                // this refresh_token; fail rather than guess.
                return false;
            }

            $result = ( new GoogleOAuthBrokerClient( VULOPILOT_GOOGLE_BROKER_URL ) )->refresh( VULOPILOT_GOOGLE_APPLICATION_ID, home_url(), $refresh_token );

            if ( is_wp_error( $result ) ) {
                return false;
            }

            $this->save_connection(
                array(
                    'access_token_enc' => CredentialEncryption::encrypt( $result['access_token'] ),
                    'token_expires_at' => time() + $result['expires_in'],
                )
            );

            return true;
        }

        $client_id     = $this->get_client_id();
        $client_secret = $this->get_client_secret();

        if ( ! $client_id || ! $client_secret ) {
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
     * Whether a real refresh token is on file - the one durable signal
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
     * Real `GET https://www.googleapis.com/webmasters/v3/sites` call -
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
     * ID/Secret - reconnecting shouldn't require re-entering the OAuth
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
                'via'                   => '',
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
            // configured for this build (config.php) - never a per-site
            // value, so there's no client_id to show back here; the
            // panel either shows a working "Connect" button or an honest
            // "not available in this build yet" state based on this flag.
            'has_client_credentials' => $this->has_client_credentials(),
            // Whether "Connect Google Services" will route through the
            // VuloCloud broker (any domain works, no per-site Google
            // Cloud Console registration) rather than the embedded
            // shared Client above (only domains manually allowlisted on
            // that Client's own redirect URI list will complete the
            // handshake) - see config.php's VULOPILOT_GOOGLE_BROKER_URL.
            'has_broker'              => $this->has_broker(),
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
            // Client - shown in the panel's own setup instructions so
            // this never has to be reverse-engineered or hardcoded twice.
            'redirect_uri'           => $this->get_redirect_uri(),
        );
    }
}

/**
 * Scanning → Webmaster Tools tab's real backing - outputs one `<meta>`
 * verification tag per configured provider on `wp_head`, same
 * self-registers-own-hook/setting-gates-output shape as
 * CanonicalUrlManager/SocialMetaTagsManager. An empty code for a provider
 * means that provider's tag isn't output at all (matches those two
 * classes' own "gate output, not construction" posture).
 *
 * `webmaster_custom_tags` is free-form admin input, so it's the one place
 * in this class that needs real sanitization before echoing: the mockup's
 * own copy promises "Only <meta> tags are allowed," enforced here with an
 * allowlist regex plus `wp_kses_post`-style attribute stripping - not
 * trusted verbatim the way this codebase's other wp_head output already
 * is (which is always fully plugin-constructed, never raw admin text).
 *
 * Self-registers its own hook in the constructor (php-wordpress.md) and is
 * constructed unconditionally in VuloPilot::init_classes().
 *
 * @class       WebmasterToolsManager class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WebmasterToolsManager {

    /**
     * Settings key => meta tag `name` attribute. `pinterest` uses
     * `property` instead of `name` per Pinterest's own documented
     * verification tag (`<meta property="p:domain_verify" ...>`), same
     * name-vs-property distinction SocialMetaTagsManager already handles
     * for `twitter:*` vs Open Graph tags.
     *
     * Public (not `private`) so Controllers\Settings::verify_webmaster_tool()
     * can reuse the exact same provider → meta-tag mapping this class
     * itself outputs on `wp_head`, rather than a second, driftable copy.
     *
     * @var array<string, string>
     */
    public const VERIFICATION_META_NAMES = array(
        'webmaster_google_verification'    => 'google-site-verification',
        'webmaster_bing_verification'      => 'msvalidate.01',
        'webmaster_baidu_verification'     => 'baidu-site-verification',
        'webmaster_yandex_verification'    => 'yandex-verification',
        'webmaster_pinterest_verification' => 'p:domain_verify',
        'webmaster_norton_verification'    => 'norton-safeweb-site-verification',
    );

    /**
     * WebmasterToolsManager constructor.
     */
    public function __construct() {
        add_action( 'wp_head', array( $this, 'maybe_output_tags' ), 5 );
    }

    /**
     * @return void
     */
    public function maybe_output_tags(): void {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        foreach ( self::VERIFICATION_META_NAMES as $setting_key => $meta_name ) {
            $code = trim( (string) ( $settings[ $setting_key ] ?? '' ) );

            if ( '' === $code ) {
                continue;
            }

            $attribute = 'webmaster_pinterest_verification' === $setting_key ? 'property' : 'name';

            echo '<meta ' . esc_attr( $attribute ) . '="' . esc_attr( $meta_name ) . '" content="' . esc_attr( $code ) . '" />' . "\n";
        }

        $custom_tags = trim( (string) ( $settings['webmaster_custom_tags'] ?? '' ) );

        if ( '' !== $custom_tags ) {
            echo $this->sanitize_custom_meta_tags( $custom_tags ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- sanitize_custom_meta_tags() itself only ever returns re-built <meta name="..." content="..." /> tags, each of whose attribute values already went through esc_attr() there.
        }
    }

    /**
     * Rebuilds `webmaster_custom_tags` from scratch as safe `<meta ...>`
     * tags only - never echoes the admin's raw input string. Any other
     * element (script, style, a stray </head>, etc.) is silently dropped
     * rather than passed through, matching the mockup's own "Only <meta>
     * tags are allowed" copy exactly (not just documented, actually
     * enforced).
     *
     * @param string $raw Raw admin-entered textarea content.
     * @return string Rebuilt, safe `<meta ...>` tags only.
     */
    private function sanitize_custom_meta_tags( string $raw ): string {
        $safe_tags = array();

        if ( preg_match_all( '/<meta\s+([^>]*)\/?>/i', $raw, $matches ) ) {
            foreach ( $matches[1] as $attributes_string ) {
                $attributes = $this->parse_attributes( $attributes_string );

                if ( empty( $attributes['content'] ) || ( empty( $attributes['name'] ) && empty( $attributes['property'] ) ) ) {
                    continue;
                }

                $tag = '<meta';

                foreach ( array( 'name', 'property', 'content' ) as $allowed_attribute ) {
                    if ( ! empty( $attributes[ $allowed_attribute ] ) ) {
                        $tag .= ' ' . $allowed_attribute . '="' . esc_attr( $attributes[ $allowed_attribute ] ) . '"';
                    }
                }

                $safe_tags[] = $tag . ' />';
            }
        }

        return implode( "\n", $safe_tags );
    }

    /**
     * Parses `name="x" content="y"`-style attribute pairs out of one
     * matched `<meta ...>` tag's inner attribute string. Deliberately
     * simple (double- or single-quoted values only, no bare/unquoted
     * attribute support) - sufficient for the verification-tag snippets
     * every webmaster tool's own docs actually hand out, and any input
     * that doesn't parse cleanly just yields no usable attributes, which
     * sanitize_custom_meta_tags() above already drops.
     *
     * @param string $attributes_string Raw attribute text between `<meta` and `/>`.
     * @return array<string, string>
     */
    private function parse_attributes( string $attributes_string ): array {
        $attributes = array();

        if ( preg_match_all( '/([a-zA-Z-]+)\s*=\s*(["\'])(.*?)\2/', $attributes_string, $pairs, PREG_SET_ORDER ) ) {
            foreach ( $pairs as $pair ) {
                $attributes[ strtolower( $pair[1] ) ] = $pair[3];
            }
        }

        return $attributes;
    }
}
