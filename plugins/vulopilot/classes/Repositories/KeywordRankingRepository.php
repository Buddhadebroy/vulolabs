<?php
/**
 * KeywordRankingRepository class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Repositories;

defined( 'ABSPATH' ) || exit;

/**
 * Persistence for `vulopilot_keyword_rankings` — real Search Console
 * `searchAnalytics.query` snapshots (Install.php's own schema docblock
 * explains why this is one row per (query, page, snapshot_date), not one
 * upserted-in-place row per query). Written only by
 * Services\KeywordRankingsSyncService; read by Controllers\KeywordRankings
 * for every real card/table SEO & Visibility → Keywords shows.
 *
 * @class       KeywordRankingRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class KeywordRankingRepository extends AbstractRepository {

    /**
     * Lets Controllers\KeywordRankings::get_table() reuse find_all() as-is
     * for the real Ranking Keywords table (scoped to the latest
     * `snapshot_date`, searched by `query`, sorted/paginated) rather than
     * hand-rolling a parallel query method.
     *
     * @var string[]
     */
    protected array $filterable_columns = array( 'snapshot_date' );

    /**
     * @var string[]
     */
    protected array $searchable_columns = array( 'query' );

    /**
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'keyword_ranking';
    }

    /**
     * @param string $query         Exact Search Console query string.
     * @param string $page          Exact Search Console page URL.
     * @param string $snapshot_date `Y-m-d` — the calendar day this row's sync ran.
     * @return array<string, mixed>|null
     */
    private function find_existing_row( string $query, string $page, string $snapshot_date ): ?array {
        global $wpdb;

        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$this->get_table()} WHERE `query` = %s AND `page` = %s AND `snapshot_date` = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $query,
                $page,
                $snapshot_date
            ),
            ARRAY_A
        );

        return $row ? $row : null;
    }

    /**
     * Upserts one real Search Console row into today's snapshot — inserts
     * a new row the first time this (query, page) is seen on
     * `$data['snapshot_date']`, or updates it in place if a real sync has
     * already run today (a repeat manual "Sync now" the same day
     * overwrites that day's own row rather than appending a duplicate; the
     * real historical value stays whatever it actually was on each
     * distinct past day). Same find-then-insert/update shape
     * NotFoundLogRepository::log_or_increment() already uses.
     *
     * @param array{query: string, page: string, clicks: int, impressions: int, ctr: float, position: float, snapshot_date: string, synced_at: string} $data One real Search Console row, already shaped by KeywordRankingsSyncService.
     * @return void
     */
    public function upsert_snapshot_row( array $data ): void {
        $existing = $this->find_existing_row( $data['query'], $data['page'], $data['snapshot_date'] );

        if ( $existing ) {
            $this->update( (int) $existing['id'], $data );
            return;
        }

        $this->insert( $data );
    }

    /**
     * @return string|null `Y-m-d` of the most recent real sync, or null if none has ever run.
     */
    public function get_latest_snapshot_date(): ?string {
        global $wpdb;

        $date = $wpdb->get_var( "SELECT MAX(`snapshot_date`) FROM {$this->get_table()}" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return $date ?: null;
    }

    /**
     * @return string|null Real `synced_at` (MySQL datetime) of the most recent real sync, or null if none has ever run.
     */
    public function get_last_synced_at(): ?string {
        global $wpdb;

        $synced_at = $wpdb->get_var( "SELECT MAX(`synced_at`) FROM {$this->get_table()}" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return $synced_at ?: null;
    }

    /**
     * @param string $before_date `Y-m-d` — strictly before this date.
     * @return string|null `Y-m-d` of the most recent real sync before `$before_date`, or null if this is the only (or earliest) one on file.
     */
    public function get_previous_snapshot_date( string $before_date ): ?string {
        global $wpdb;

        $date = $wpdb->get_var( // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT MAX(`snapshot_date`) FROM {$this->get_table()} WHERE `snapshot_date` < %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $before_date
            )
        );

        return $date ?: null;
    }

    /**
     * Every distinct real snapshot date on file, oldest first — the real
     * x-axis for every trend sparkline Controllers\KeywordRankings::get_summary()
     * builds, bounded to the most recent `$limit` real syncs rather than
     * this table's entire history.
     *
     * @param int $limit
     * @return string[] `Y-m-d` values, oldest first.
     */
    public function get_recent_snapshot_dates( int $limit = 30 ): array {
        global $wpdb;

        $dates = $wpdb->get_col( // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT DISTINCT `snapshot_date` FROM {$this->get_table()} ORDER BY `snapshot_date` DESC LIMIT %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                max( 1, $limit )
            )
        );

        return array_reverse( $dates );
    }

    /**
     * Real, aggregated totals for one snapshot day — every number
     * Controllers\KeywordRankings::get_summary()'s stat cards need, in one
     * query rather than five.
     *
     * `top_3`/`top_10` use `< 4`/`< 11`, not `<= 3`/`<= 10` — real Search
     * Console positions are floats (e.g. 3.4), and this has to bucket the
     * exact same way `get_position_distribution()`'s own "Top 3"/"4-10"
     * bands do (`[1,4)`/`[4,11)`) or the two would silently disagree on a
     * fractional position right at the boundary (confirmed live: a
     * position of 3.x counted in the donut's "Top 3" slice but not in
     * this method's own `top_3` count, before this was made to match).
     *
     * @param string $snapshot_date `Y-m-d`.
     * @return array{total_keywords: int, top_3: int, top_10: int, avg_position: float|null, total_clicks: int, total_impressions: int}
     */
    public function get_totals_for_date( string $snapshot_date ): array {
        global $wpdb;

        $row = $wpdb->get_row( // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT
                    COUNT(DISTINCT `query`) AS total_keywords,
                    SUM(CASE WHEN `position` < 4 THEN 1 ELSE 0 END) AS top_3,
                    SUM(CASE WHEN `position` < 11 THEN 1 ELSE 0 END) AS top_10,
                    AVG(`position`) AS avg_position,
                    SUM(`clicks`) AS total_clicks,
                    SUM(`impressions`) AS total_impressions
                FROM {$this->get_table()} WHERE `snapshot_date` = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $snapshot_date
            ),
            ARRAY_A
        );

        if ( ! $row || null === $row['avg_position'] ) {
            return array(
                'total_keywords'    => 0,
                'top_3'             => 0,
                'top_10'            => 0,
                'avg_position'      => null,
                'total_clicks'      => 0,
                'total_impressions' => 0,
            );
        }

        return array(
            'total_keywords'    => (int) $row['total_keywords'],
            'top_3'             => (int) $row['top_3'],
            'top_10'            => (int) $row['top_10'],
            'avg_position'      => round( (float) $row['avg_position'], 1 ),
            'total_clicks'      => (int) $row['total_clicks'],
            'total_impressions' => (int) $row['total_impressions'],
        );
    }

    /**
     * Real position-bucket counts for one snapshot day — Keywords' own
     * "Keyword Position Distribution" donut, same 5 real, non-overlapping
     * bands a rank tracker's own legend conventionally uses.
     *
     * @param string $snapshot_date `Y-m-d`.
     * @return array<int, array{label: string, min: int, max: int|null, count: int}>
     */
    public function get_position_distribution( string $snapshot_date ): array {
        global $wpdb;

        $bands = array(
            array( 'label' => __( 'Top 3', 'vulopilot' ), 'min' => 1, 'max' => 3 ),
            array( 'label' => __( '4-10', 'vulopilot' ), 'min' => 4, 'max' => 10 ),
            array( 'label' => __( '11-20', 'vulopilot' ), 'min' => 11, 'max' => 20 ),
            array( 'label' => __( '21-50', 'vulopilot' ), 'min' => 21, 'max' => 50 ),
            array( 'label' => __( '51+', 'vulopilot' ), 'min' => 51, 'max' => null ),
        );

        foreach ( $bands as &$band ) {
            if ( null === $band['max'] ) {
                $band['count'] = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                    $wpdb->prepare(
                        "SELECT COUNT(*) FROM {$this->get_table()} WHERE `snapshot_date` = %s AND `position` >= %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                        $snapshot_date,
                        $band['min']
                    )
                );
                continue;
            }

            $band['count'] = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    "SELECT COUNT(*) FROM {$this->get_table()} WHERE `snapshot_date` = %s AND `position` >= %d AND `position` < %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    $snapshot_date,
                    $band['min'],
                    $band['max'] + 1
                )
            );
        }
        unset( $band );

        return $bands;
    }

    /**
     * Real day-by-day totals across a bounded set of real snapshot dates —
     * the actual data behind every stat card's own sparkline
     * (Controllers\KeywordRankings::get_summary()'s `trend` block). One
     * query per real snapshot date (bounded to `get_recent_snapshot_dates()`'s
     * own small `$limit`, so this stays a handful of queries, not an
     * unbounded loop).
     *
     * @param string[] $snapshot_dates Real dates, e.g. from get_recent_snapshot_dates().
     * @return array<int, array{date: string, total_keywords: int, top_3: int, top_10: int, avg_position: float|null, total_clicks: int, total_impressions: int}>
     */
    public function get_trend_series( array $snapshot_dates ): array {
        return array_map(
            fn( $date ) => array_merge( array( 'date' => $date ), $this->get_totals_for_date( $date ) ),
            $snapshot_dates
        );
    }

    /**
     * Real "striking distance" queries for one snapshot day — already
     * ranking somewhere on page 1-2 (position 4-20, i.e. just outside the
     * real Top 3) with at least one real impression, ordered by real
     * impressions descending. Backs Keywords' own "Top Opportunities"
     * panel — every row here is a real query this site already has SOME
     * real visibility for, not a suggested/invented keyword.
     *
     * @param string $snapshot_date `Y-m-d`.
     * @param int    $limit
     * @return array<int, array<string, mixed>>
     */
    public function get_top_opportunities( string $snapshot_date, int $limit = 5 ): array {
        global $wpdb;

        $rows = $wpdb->get_results( // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT * FROM {$this->get_table()}
                WHERE `snapshot_date` = %s AND `position` >= 4 AND `position` <= 20 AND `impressions` > 0
                ORDER BY `impressions` DESC
                LIMIT %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $snapshot_date,
                max( 1, $limit )
            ),
            ARRAY_A
        );

        return $rows ?: array();
    }

    /**
     * Real per-page grouping for one snapshot day — Keywords' own "Keyword
     * Groups" panel, repurposed to group by the real ranking page Search
     * Console itself returned for each query (there is no real keyword-
     * intent/topic-cluster grouping data available from any connected
     * source, so this is the one real grouping dimension on hand — see
     * KeywordsTab.tsx's own docblock).
     *
     * @param string $snapshot_date `Y-m-d`.
     * @param int    $limit
     * @return array<int, array{page: string, keyword_count: int, total_clicks: int, total_impressions: int, avg_position: float}>
     */
    public function get_groups_by_page( string $snapshot_date, int $limit = 20 ): array {
        global $wpdb;

        $rows = $wpdb->get_results( // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT
                    `page`,
                    COUNT(DISTINCT `query`) AS keyword_count,
                    SUM(`clicks`) AS total_clicks,
                    SUM(`impressions`) AS total_impressions,
                    AVG(`position`) AS avg_position
                FROM {$this->get_table()}
                WHERE `snapshot_date` = %s
                GROUP BY `page`
                ORDER BY keyword_count DESC
                LIMIT %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $snapshot_date,
                max( 1, $limit )
            ),
            ARRAY_A
        );

        return array_map(
            static fn( $row ) => array(
                'page'               => $row['page'],
                'keyword_count'      => (int) $row['keyword_count'],
                'total_clicks'       => (int) $row['total_clicks'],
                'total_impressions'  => (int) $row['total_impressions'],
                'avg_position'       => round( (float) $row['avg_position'], 1 ),
            ),
            $rows ?: array()
        );
    }

    /**
     * Real per-query position on one specific snapshot date — used to look
     * up each current-page row's own "Previous" value from the previous
     * real sync, batched (one query for the whole current page of results)
     * rather than one query per row.
     *
     * @param string[] $queries       Real query strings from the current result page.
     * @param string   $snapshot_date `Y-m-d`.
     * @return array<string, float> query => real position on that date, only for queries that actually had a row that day.
     */
    public function get_positions_for_queries_on_date( array $queries, string $snapshot_date ): array {
        if ( ! $queries ) {
            return array();
        }

        global $wpdb;

        $placeholders = implode( ', ', array_fill( 0, count( $queries ), '%s' ) );

        $rows = $wpdb->get_results( // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT `query`, AVG(`position`) AS position FROM {$this->get_table()} WHERE `snapshot_date` = %s AND `query` IN ({$placeholders}) GROUP BY `query`", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                array_merge( array( $snapshot_date ), $queries )
            ),
            ARRAY_A
        );

        $positions = array();

        foreach ( (array) $rows as $row ) {
            $positions[ $row['query'] ] = round( (float) $row['position'], 1 );
        }

        return $positions;
    }

    /**
     * Real best-ever (lowest number = best) position recorded for a batch
     * of queries, across this table's ENTIRE history — not just the
     * bounded trend window. Naturally starts out equal to a query's
     * current position (only one real data point on file yet) and only
     * ever gets more meaningful as more real syncs accumulate over time —
     * never backfilled or estimated.
     *
     * @param string[] $queries Real query strings from the current result page.
     * @return array<string, float> query => real best-ever position.
     */
    public function get_best_positions_for_queries( array $queries ): array {
        if ( ! $queries ) {
            return array();
        }

        global $wpdb;

        $placeholders = implode( ', ', array_fill( 0, count( $queries ), '%s' ) );

        $rows = $wpdb->get_results( // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT `query`, MIN(`position`) AS position FROM {$this->get_table()} WHERE `query` IN ({$placeholders}) GROUP BY `query`", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $queries
            ),
            ARRAY_A
        );

        $best = array();

        foreach ( (array) $rows as $row ) {
            $best[ $row['query'] ] = round( (float) $row['position'], 1 );
        }

        return $best;
    }

    /**
     * Deletes every real snapshot row older than `$days` — called at the
     * end of every real sync (Services\KeywordRankingsSyncService) so this
     * table stays a bounded real history rather than growing forever; a
     * real, disclosed retention window, not silent data loss a site owner
     * would have no way to anticipate (see that service's own docblock).
     *
     * @param int $days
     * @return void
     */
    public function prune_older_than( int $days ): void {
        global $wpdb;

        $wpdb->query( // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "DELETE FROM {$this->get_table()} WHERE `snapshot_date` < %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                gmdate( 'Y-m-d', strtotime( "-{$days} days" ) )
            )
        );
    }
}
