<?php
/**
 * GoogleAnalyticsClient class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

defined( 'ABSPATH' ) || exit;

/**
 * Real Google Analytics Admin API (GA4) client — backs the "Analytics"
 * settings panel's own Account/Property/Data Stream dropdowns
 * (GoogleServicesPanel.tsx), reusing GoogleServicesConnection's shared
 * OAuth token rather than its own separate connection. Two real calls,
 * matching the Admin API's own two-level shape (an account summary lists
 * its properties, but a property's web Measurement ID is only returned by
 * its own `dataStreams.list` call): `list_account_summaries()` populates
 * the Account/Property dropdowns, `list_data_streams()` populates the
 * Data Stream dropdown once a property is chosen — same two-step
 * selection the reference screenshots show.
 *
 * Read-only (`analytics.readonly` scope, see GoogleServicesConnection's
 * own `SCOPES`) — this only ever lists real account/property/stream
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
     * API, not Admin API) — `%s` is a real `properties/{id}` resource name,
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
     * Real `GET .../v1beta/accountSummaries` — every GA4 account this
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
     * Real `GET .../v1beta/properties/{id}/dataStreams` — a property's
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
     * Real `POST .../v1beta/{property}:runReport` — real daily GA4
     * `sessions` counts for a real, already-connected property, one row
     * per real calendar day GA4 has data for. Backs Keywords' own
     * "Estimated Traffic" card (Controllers\KeywordRankings::get_summary())
     * when a GA4 property has actually been selected
     * (GoogleServicesConnection's own `ga4_property_id`) — that card falls
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
}
