<?php
/**
 * GoogleSearchConsoleAnalyticsClient class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

defined( 'ABSPATH' ) || exit;

/**
 * Real Search Console `searchAnalytics.query` client — the actual source of
 * every real keyword/position/impressions/clicks row SEO & Visibility →
 * Keywords shows (KeywordsTab.tsx), via KeywordRankingsSyncService. Separate
 * class from GoogleServicesConnection (which only ever covers the OAuth
 * dance + the one `sites.list` call needed to populate the property
 * picker) and from GoogleAnalyticsClient (a different real Google API
 * entirely) — same "one class per real external API surface, reusing the
 * shared connection's own token" shape both of those already establish.
 *
 * Read-only (`webmasters.readonly`, already covered by
 * GoogleServicesConnection::SCOPES — no new consent screen needed for
 * this). Never writes anything to a site owner's real Search Console
 * property.
 *
 * @class       GoogleSearchConsoleAnalyticsClient class
 * @version     1.0.0
 * @author      VuloLabs
 */
class GoogleSearchConsoleAnalyticsClient {

    /**
     * `%s` is a real, already-verified `site_url` from
     * GoogleServicesConnection::list_search_console_sites()/get_status()'s
     * own `search_console_site` — either a URL-prefix property
     * (`https://example.com/`) or a domain property
     * (`sc-domain:example.com`), both accepted verbatim by this endpoint
     * once URL-encoded.
     */
    private const QUERY_URL = 'https://www.googleapis.com/webmasters/v3/sites/%s/searchAnalytics/query';

    /**
     * Google's own documented ceiling for a single `searchAnalytics.query`
     * call — not used as the default here (see
     * KeywordRankingsSyncService::ROW_LIMIT for the real, smaller bound this
     * codebase actually requests, matching the "reasonable bound, not
     * truly unlimited" precedent GoogleAnalyticsClient's own
     * `list_account_summaries()` already sets for a different Google API).
     */
    const MAX_ROW_LIMIT = 25000;

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
     * Real `POST .../searchAnalytics/query` — one page of real query rows
     * for a real, already-verified Search Console property.
     *
     * @param string   $site_url   A real, already-verified `site_url` (GoogleServicesConnection::get_status()'s own `search_console_site`).
     * @param string   $start_date `Y-m-d`.
     * @param string   $end_date   `Y-m-d`.
     * @param string[] $dimensions e.g. `array( 'query', 'page' )` — order determines each row's own `keys` order in the response.
     * @param int      $row_limit  Capped to self::MAX_ROW_LIMIT.
     * @param int      $start_row  For paging past `$row_limit` rows in one call — 0-based.
     * @return array<int, array{keys: string[], clicks: int, impressions: int, ctr: float, position: float}>|\WP_Error
     */
    public function query( string $site_url, string $start_date, string $end_date, array $dimensions, int $row_limit = 1000, int $start_row = 0 ) {
        $token = $this->connection->get_valid_access_token();

        if ( ! $token ) {
            return new \WP_Error( 'vulopilot_gsc_not_connected', __( 'Not connected to Google.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $response = wp_remote_post(
            sprintf( self::QUERY_URL, rawurlencode( $site_url ) ),
            array(
                'timeout' => 30,
                'headers' => array(
                    'Authorization' => 'Bearer ' . $token,
                    'Content-Type'  => 'application/json',
                ),
                'body'    => wp_json_encode(
                    array(
                        'startDate'  => $start_date,
                        'endDate'    => $end_date,
                        'dimensions' => array_values( $dimensions ),
                        'rowLimit'   => min( $row_limit, self::MAX_ROW_LIMIT ),
                        'startRow'   => max( 0, $start_row ),
                    )
                ),
            )
        );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        if ( 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
            return new \WP_Error( 'vulopilot_gsc_query_failed', __( 'Could not fetch keyword data from Search Console.', 'vulopilot' ), array( 'status' => 502 ) );
        }

        $body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

        return array_map(
            static fn( $row ) => array(
                'keys'        => array_map( 'strval', (array) ( $row['keys'] ?? array() ) ),
                'clicks'      => (int) ( $row['clicks'] ?? 0 ),
                'impressions' => (int) ( $row['impressions'] ?? 0 ),
                'ctr'         => (float) ( $row['ctr'] ?? 0 ),
                'position'    => (float) ( $row['position'] ?? 0 ),
            ),
            $body['rows'] ?? array()
        );
    }
}
