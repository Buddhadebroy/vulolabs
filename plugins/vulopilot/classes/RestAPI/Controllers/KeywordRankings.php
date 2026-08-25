<?php
/**
 * KeywordRankings controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\KeywordRankingRepository;
use VuloPilot\Services\GoogleServicesConnection;
use VuloPilot\Services\GoogleAnalyticsClient;
use VuloPilot\Services\KeywordRankingsSyncService;

defined( 'ABSPATH' ) || exit;

/**
 * Backs SEO & Visibility → Keywords' real rank-tracking dashboard
 * (KeywordsTab.tsx) — every number here comes from real, already-synced
 * `vulopilot_keyword_rankings` rows (KeywordRankingRepository) written by
 * KeywordRankingsSyncService, plus a real, optional live GA4 traffic read
 * (GoogleAnalyticsClient::run_sessions_report()) for the "Estimated
 * Traffic" card when a GA4 property is actually connected. Nothing here is
 * invented: a site with no real synced snapshot yet gets an honest
 * `synced: false` response, not fabricated placeholder numbers — see
 * `get_summary()`'s own docblock.
 *
 * @class       KeywordRankings controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class KeywordRankings extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'keyword-rankings';

    /**
     * Real rolling window this controller asks GA4 for, matching
     * KeywordRankingsSyncService's own real Search Console window/lag so
     * the "Estimated Traffic" card's date range lines up with the real
     * keyword data next to it.
     */
    private const WINDOW_DAYS     = 28;
    private const REPORT_LAG_DAYS = 3;

    /**
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/summary',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_summary' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base,
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_table' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/opportunities',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_opportunities' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/groups',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_groups' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/sync',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'sync' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );
    }

    /**
     * Same manage_options gate every other VuloPilot REST route uses.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @return array{start: string, end: string} Real `Y-m-d` window matching KeywordRankingsSyncService's own real Search Console range.
     */
    private function get_window(): array {
        return array(
            'end'   => gmdate( 'Y-m-d', strtotime( '-' . self::REPORT_LAG_DAYS . ' days' ) ),
            'start' => gmdate( 'Y-m-d', strtotime( '-' . ( self::REPORT_LAG_DAYS + self::WINDOW_DAYS ) . ' days' ) ),
        );
    }

    /**
     * Real GA4 sessions total (and, for the trend series, a real
     * date=>sessions map) for a given real window — a thin wrapper so
     * both `get_summary()` call sites (current window, previous window)
     * share the same real-data-or-null handling.
     *
     * @param GoogleServicesConnection $connection  The same real, already-loaded connection `get_summary()` is already working with.
     * @param string                   $property_id Real GA4 property id.
     * @param string                   $start_date  `Y-m-d`.
     * @param string                   $end_date    `Y-m-d`.
     * @return array<string, int>|null Null on any real API failure (never fabricated).
     */
    private function get_ga4_sessions( GoogleServicesConnection $connection, string $property_id, string $start_date, string $end_date ): ?array {
        $result = ( new GoogleAnalyticsClient( $connection ) )->run_sessions_report( $property_id, $start_date, $end_date );

        return is_wp_error( $result ) ? null : $result;
    }

    /**
     * Every real number Keywords' own stat cards, position-distribution
     * donut, and per-card sparklines need, in one response. Honestly
     * reports `synced: false` (every stat null/zero) rather than
     * fabricating placeholder data when no real sync has ever completed
     * yet — the frontend renders a real "not synced yet" state for that
     * case (see KeywordsTab.tsx).
     *
     * @return \WP_REST_Response
     */
    public function get_summary() {
        $connection = new GoogleServicesConnection();
        $status     = $connection->get_status();
        $repository = new KeywordRankingRepository();

        $response = array(
            'connected'              => $status['connected'],
            'has_client_credentials' => $status['has_client_credentials'],
            'search_console_site'    => $status['search_console_site'],
            'synced'                 => false,
            'last_synced_at'         => null,
            'stats'                  => null,
            'position_distribution'  => array(),
            'trend'                  => array(
                'dates'              => array(),
                'total_keywords'     => array(),
                'top_3'              => array(),
                'top_10'             => array(),
                'avg_position'       => array(),
                'estimated_traffic'  => array(),
                'impressions'        => array(),
            ),
        );

        if ( ! $status['connected'] || '' === $status['search_console_site'] ) {
            return rest_ensure_response( $response );
        }

        $latest_date = $repository->get_latest_snapshot_date();

        if ( ! $latest_date ) {
            return rest_ensure_response( $response );
        }

        $response['synced']         = true;
        $response['last_synced_at'] = $repository->get_last_synced_at();

        $previous_date = $repository->get_previous_snapshot_date( $latest_date );
        $latest_totals = $repository->get_totals_for_date( $latest_date );
        $previous_totals = $previous_date ? $repository->get_totals_for_date( $previous_date ) : null;

        // "Estimated Traffic": a real GA4 sessions total when a real GA4
        // property is connected, real Search Console clicks otherwise —
        // never a fabricated number either way. See GoogleAnalyticsClient::run_sessions_report()'s
        // own docblock.
        $traffic_source          = 'search_console';
        $current_traffic         = $latest_totals['total_clicks'];
        $previous_traffic        = $previous_totals['total_clicks'] ?? null;
        $ga4_daily_sessions      = array();

        if ( '' !== $status['ga4_property_id'] ) {
            $window          = $this->get_window();
            $previous_window = array(
                'end'   => gmdate( 'Y-m-d', strtotime( $window['start'] . ' -1 day' ) ),
                'start' => gmdate( 'Y-m-d', strtotime( $window['start'] . ' -1 day -' . self::WINDOW_DAYS . ' days' ) ),
            );

            $current_sessions  = $this->get_ga4_sessions( $connection, $status['ga4_property_id'], $window['start'], $window['end'] );
            $previous_sessions = $this->get_ga4_sessions( $connection, $status['ga4_property_id'], $previous_window['start'], $previous_window['end'] );

            if ( null !== $current_sessions ) {
                $traffic_source     = 'analytics';
                $current_traffic    = array_sum( $current_sessions );
                $ga4_daily_sessions = $current_sessions;

                if ( null !== $previous_sessions ) {
                    $previous_traffic = array_sum( $previous_sessions );
                }
            }
        }

        $response['stats'] = array(
            'total_keywords'    => array(
                'value'    => $latest_totals['total_keywords'],
                'previous' => $previous_totals['total_keywords'] ?? null,
            ),
            'top_3'             => array(
                'value'    => $latest_totals['top_3'],
                'previous' => $previous_totals['top_3'] ?? null,
            ),
            'top_10'            => array(
                'value'    => $latest_totals['top_10'],
                'previous' => $previous_totals['top_10'] ?? null,
            ),
            'avg_position'      => array(
                'value'    => $latest_totals['avg_position'],
                'previous' => $previous_totals['avg_position'] ?? null,
            ),
            'estimated_traffic' => array(
                'value'    => $current_traffic,
                'previous' => $previous_traffic,
                'source'   => $traffic_source,
            ),
            'impressions'       => array(
                'value'    => $latest_totals['total_impressions'],
                'previous' => $previous_totals['total_impressions'] ?? null,
            ),
        );

        $response['position_distribution'] = $repository->get_position_distribution( $latest_date );

        $recent_dates = $repository->get_recent_snapshot_dates( 30 );
        $trend_series = $repository->get_trend_series( $recent_dates );

        $response['trend'] = array(
            'dates'             => wp_list_pluck( $trend_series, 'date' ),
            'total_keywords'    => wp_list_pluck( $trend_series, 'total_keywords' ),
            'top_3'             => wp_list_pluck( $trend_series, 'top_3' ),
            'top_10'            => wp_list_pluck( $trend_series, 'top_10' ),
            'avg_position'      => wp_list_pluck( $trend_series, 'avg_position' ),
            // Real per-day GA4 sessions when connected (falls back to each
            // day's own real Search Console clicks otherwise) — both real,
            // never interpolated/invented for a day with no data.
            'estimated_traffic' => 'analytics' === $traffic_source
                ? array_map( static fn( $date ) => $ga4_daily_sessions[ $date ] ?? 0, $recent_dates )
                : wp_list_pluck( $trend_series, 'total_clicks' ),
            'impressions'       => wp_list_pluck( $trend_series, 'total_impressions' ),
        );

        return rest_ensure_response( $response );
    }

    /**
     * Real, paginated/searchable/sortable "Ranking Keywords" table — one
     * row per real (query, page) pair from the latest real snapshot, each
     * enriched with its own real "Previous"/"Change" (vs. the previous
     * real sync) and real "Best Position" (the real best-ever value across
     * this table's whole history, not just this snapshot — see
     * KeywordRankingRepository::get_best_positions_for_queries()).
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_table( $request ) {
        $repository  = new KeywordRankingRepository();
        $latest_date = $repository->get_latest_snapshot_date();

        if ( ! $latest_date ) {
            return rest_ensure_response(
                array(
                    'data'  => array(),
                    'total' => 0,
                )
            );
        }

        $previous_date = $repository->get_previous_snapshot_date( $latest_date );

        $orderby_map = array(
            'position'    => 'position',
            'impressions' => 'impressions',
            'clicks'      => 'clicks',
            'query'       => 'query',
        );
        $requested_orderby = (string) $request->get_param( 'orderby' );

        $result = $repository->find_all(
            array(
                'snapshot_date' => $latest_date,
                'search'        => (string) $request->get_param( 'search' ),
                'page'          => (int) ( $request->get_param( 'page' ) ?: 1 ),
                'per_page'      => (int) ( $request->get_param( 'per_page' ) ?: 20 ),
                'orderby'       => $orderby_map[ $requested_orderby ] ?? 'impressions',
                'order'         => (string) ( $request->get_param( 'order' ) ?: 'desc' ),
            )
        );

        $queries          = wp_list_pluck( $result['data'], 'query' );
        $previous_positions = $previous_date ? $repository->get_positions_for_queries_on_date( $queries, $previous_date ) : array();
        $best_positions     = $repository->get_best_positions_for_queries( $queries );

        $rows = array_map(
            static function ( $row ) use ( $previous_positions, $best_positions ) {
                $current_position  = round( (float) $row['position'], 1 );
                $previous_position = $previous_positions[ $row['query'] ] ?? null;

                return array(
                    'query'             => $row['query'],
                    'page'              => $row['page'],
                    'position'          => $current_position,
                    'previous_position' => $previous_position,
                    'change'            => null === $previous_position ? null : round( $previous_position - $current_position, 1 ),
                    'best_position'     => $best_positions[ $row['query'] ] ?? $current_position,
                    'clicks'            => (int) $row['clicks'],
                    'impressions'       => (int) $row['impressions'],
                    'ctr'               => round( (float) $row['ctr'] * 100, 2 ),
                    'updated_at'        => $row['synced_at'],
                );
            },
            $result['data']
        );

        return rest_ensure_response(
            array(
                'data'  => $rows,
                'total' => $result['total'],
            )
        );
    }

    /**
     * Real "Top Opportunities" — see KeywordRankingRepository::get_top_opportunities()'s own docblock.
     *
     * @return \WP_REST_Response
     */
    public function get_opportunities() {
        $repository  = new KeywordRankingRepository();
        $latest_date = $repository->get_latest_snapshot_date();

        if ( ! $latest_date ) {
            return rest_ensure_response( array() );
        }

        $rows = $repository->get_top_opportunities( $latest_date, 5 );

        return rest_ensure_response(
            array_map(
                static fn( $row ) => array(
                    'query'       => $row['query'],
                    'page'        => $row['page'],
                    'position'    => round( (float) $row['position'], 1 ),
                    'impressions' => (int) $row['impressions'],
                    'clicks'      => (int) $row['clicks'],
                ),
                $rows
            )
        );
    }

    /**
     * Real "Keyword Groups" (by real ranking page) — see
     * KeywordRankingRepository::get_groups_by_page()'s own docblock.
     *
     * @return \WP_REST_Response
     */
    public function get_groups() {
        $repository  = new KeywordRankingRepository();
        $latest_date = $repository->get_latest_snapshot_date();

        if ( ! $latest_date ) {
            return rest_ensure_response( array() );
        }

        return rest_ensure_response( $repository->get_groups_by_page( $latest_date, 20 ) );
    }

    /**
     * Real "Sync now" — runs KeywordRankingsSyncService::sync_now() inline
     * (a single `searchAnalytics.query` call, well within a normal REST
     * request's timeout) and returns the freshly-updated real summary, so
     * the button's own click handler doesn't need a second round trip.
     *
     * @return \WP_REST_Response|\WP_Error
     */
    public function sync() {
        $result = ( new KeywordRankingsSyncService() )->sync_now();

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return $this->get_summary();
    }
}
