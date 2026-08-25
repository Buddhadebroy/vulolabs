<?php
/**
 * KeywordRankingsSyncService class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

use VuloPilot\Repositories\KeywordRankingRepository;

defined( 'ABSPATH' ) || exit;

/**
 * Pulls real keyword rows from Search Console (GoogleSearchConsoleAnalyticsClient)
 * into `vulopilot_keyword_rankings` — the actual "sync" behind SEO &
 * Visibility → Keywords' own "Sync now" button and its daily cron
 * counterpart, same unconditional-construction/self-registers-its-own-hooks
 * shape PerformanceScoreSnapshotRecorder already establishes for a
 * different daily snapshot. Read access lives in Controllers\KeywordRankings
 * / KeywordRankingRepository — this class only ever writes.
 *
 * Real Search Console data has a real, well-documented reporting delay
 * (typically 1-3 days) — `$end_date` below is always today minus
 * `REPORT_LAG_DAYS`, never "today", so this never requests a range Search
 * Console itself wouldn't have finished processing yet. `ROW_LIMIT` caps
 * each real sync to this site's own top real 1,000 (query, page) pairs by
 * real clicks — a real, disclosed bound (same "reasonable bound, not truly
 * unlimited" precedent GoogleAnalyticsClient::list_account_summaries()
 * already sets for a different Google API), not the full real result set a
 * very large site might actually have.
 *
 * @class       KeywordRankingsSyncService class
 * @version     1.0.0
 * @author      VuloLabs
 */
class KeywordRankingsSyncService {

    private const CRON_HOOK = 'vulopilot_keyword_rankings_sync_daily';

    /**
     * Search Console's own real, documented data-freshness lag — the most
     * recent 1-3 days of real data are typically incomplete/absent, so
     * every real query below ends `$end_date` this many days before today
     * rather than "today" itself.
     */
    private const REPORT_LAG_DAYS = 3;

    /**
     * A real rolling 28-day window (Search Console's own default UI report
     * range) ending at `REPORT_LAG_DAYS` before today.
     */
    private const WINDOW_DAYS = 28;

    /**
     * Real, disclosed bound on how many (query, page) pairs one real sync
     * requests — see this class's own docblock.
     */
    private const ROW_LIMIT = 1000;

    /**
     * Real snapshot rows older than this are pruned at the end of every
     * real sync (KeywordRankingRepository::prune_older_than()) so this
     * table stays a bounded real history.
     */
    private const RETENTION_DAYS = 180;

    /**
     * @var GoogleServicesConnection
     */
    private GoogleServicesConnection $connection;

    /**
     * @var GoogleSearchConsoleAnalyticsClient
     */
    private GoogleSearchConsoleAnalyticsClient $client;

    /**
     * @var KeywordRankingRepository
     */
    private KeywordRankingRepository $repository;

    public function __construct() {
        $this->connection = new GoogleServicesConnection();
        $this->client     = new GoogleSearchConsoleAnalyticsClient( $this->connection );
        $this->repository = new KeywordRankingRepository();

        add_action( 'init', array( $this, 'ensure_daily_sync_scheduled' ) );
        add_action( self::CRON_HOOK, array( $this, 'sync_now' ) );
    }

    /**
     * Standard wp_next_scheduled()-guarded wp_schedule_event() pattern —
     * same shape Services\PerformanceScoreSnapshotRecorder already uses.
     *
     * @return void
     */
    public function ensure_daily_sync_scheduled(): void {
        if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
            wp_schedule_event( time(), 'daily', self::CRON_HOOK );
        }
    }

    /**
     * Runs one real sync right now — fetches this real, already-connected
     * site's real Search Console query data and writes it into today's
     * snapshot. Called by the daily cron above, and directly by
     * Controllers\KeywordRankings::sync() for a real "Sync now" click.
     *
     * @return true|\WP_Error
     */
    public function sync_now() {
        $status = $this->connection->get_status();

        if ( ! $status['connected'] || '' === $status['search_console_site'] ) {
            return new \WP_Error(
                'vulopilot_keyword_rankings_not_connected',
                __( 'Connect Google Services and pick a Search Console property first.', 'vulopilot' ),
                array( 'status' => 400 )
            );
        }

        $end_date   = gmdate( 'Y-m-d', strtotime( '-' . self::REPORT_LAG_DAYS . ' days' ) );
        $start_date = gmdate( 'Y-m-d', strtotime( '-' . ( self::REPORT_LAG_DAYS + self::WINDOW_DAYS ) . ' days' ) );

        $rows = $this->client->query(
            $status['search_console_site'],
            $start_date,
            $end_date,
            array( 'query', 'page' ),
            self::ROW_LIMIT
        );

        if ( is_wp_error( $rows ) ) {
            return $rows;
        }

        $snapshot_date = gmdate( 'Y-m-d' );
        $synced_at     = current_time( 'mysql' );

        foreach ( $rows as $row ) {
            if ( ! isset( $row['keys'][0] ) ) {
                continue;
            }

            $this->repository->upsert_snapshot_row(
                array(
                    'query'         => $row['keys'][0],
                    'page'          => $row['keys'][1] ?? '',
                    'clicks'        => $row['clicks'],
                    'impressions'   => $row['impressions'],
                    'ctr'           => $row['ctr'],
                    'position'      => $row['position'],
                    'snapshot_date' => $snapshot_date,
                    'synced_at'     => $synced_at,
                )
            );
        }

        $this->repository->prune_older_than( self::RETENTION_DAYS );

        return true;
    }
}
