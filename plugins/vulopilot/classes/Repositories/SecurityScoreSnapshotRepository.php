<?php
/**
 * SecurityScoreSnapshotRepository class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Repositories;

defined( 'ABSPATH' ) || exit;

/**
 * Persistence for `vulopilot_security_score_snapshots` — one row per day,
 * `snapshot_date` UNIQUE. Own dedicated table rather than reusing
 * `vulopilot_site_health_snapshots` (that table's `security_score` column
 * exists but is only ever written by Pro's AdvancedReports module) — see
 * Services\SecurityScoreSnapshotRecorder's own docblock. Same shape as
 * PerformanceScoreSnapshotRepository.
 *
 * @class       SecurityScoreSnapshotRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SecurityScoreSnapshotRepository extends AbstractRepository {

    /**
     * Columns find_all() may filter on.
     *
     * @var string[]
     */
    protected array $filterable_columns = array( 'snapshot_date' );

    /**
     * Utill::TABLES key this repository owns.
     *
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'security_score_snapshot';
    }

    /**
     * Inserts or updates today's row with the given score — the same
     * "look it up by its own unique date, then insert() or update()"
     * upsert shape PerformanceScoreSnapshotRepository::upsert_today()
     * already uses.
     *
     * @param int $score 0-100.
     * @return void
     */
    public function upsert_today( int $score ): void {
        $today    = current_time( 'Y-m-d' );
        $existing = $this->find_all(
            array(
                'snapshot_date' => $today,
                'per_page'      => 1,
            )
        );

        if ( ! empty( $existing['data'] ) ) {
            $this->update( (int) $existing['data'][0]['id'], array( 'security_score' => $score ) );
            return;
        }

        $this->insert(
            array(
                'snapshot_date'  => $today,
                'security_score' => $score,
            )
        );
    }

    /**
     * @param int $days How many trailing days to include.
     * @return array<int, array{snapshot_date: string, security_score: string}>
     */
    public function get_recent( int $days ): array {
        global $wpdb;

        $rows = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT snapshot_date, security_score FROM {$this->get_table()} WHERE snapshot_date >= %s ORDER BY snapshot_date ASC", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                gmdate( 'Y-m-d', strtotime( "-{$days} days" ) )
            ),
            ARRAY_A
        );

        return $rows ? $rows : array();
    }
}
