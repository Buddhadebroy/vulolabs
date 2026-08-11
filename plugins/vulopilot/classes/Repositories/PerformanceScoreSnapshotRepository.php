<?php
/**
 * PerformanceScoreSnapshotRepository class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Repositories;

defined( 'ABSPATH' ) || exit;

/**
 * Persistence for `vulopilot_performance_score_snapshots` — one row per
 * day, `snapshot_date` UNIQUE. A dedicated table rather than reusing
 * `vulopilot_site_health_snapshots` (that table's other columns are Pro's
 * AdvancedReports module data; sharing one mutable daily row between two
 * independently-authored features risks one overwriting the other's
 * columns) — see Services\PerformanceScoreSnapshotRecorder's own docblock.
 *
 * @class       PerformanceScoreSnapshotRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PerformanceScoreSnapshotRepository extends AbstractRepository {

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
        return 'performance_score_snapshot';
    }

    /**
     * Inserts or updates today's row with the given score — the same
     * "look it up by its own unique date, then insert() or update()"
     * upsert shape this codebase's AbstractRepository already supports,
     * rather than a raw `ON DUPLICATE KEY UPDATE` statement.
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
            $this->update( (int) $existing['data'][0]['id'], array( 'performance_score' => $score ) );
            return;
        }

        $this->insert(
            array(
                'snapshot_date'     => $today,
                'performance_score' => $score,
            )
        );
    }

    /**
     * @param int $days How many trailing days to include.
     * @return array<int, array{snapshot_date: string, performance_score: string}>
     */
    public function get_recent( int $days ): array {
        global $wpdb;

        $rows = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT snapshot_date, performance_score FROM {$this->get_table()} WHERE snapshot_date >= %s ORDER BY snapshot_date ASC", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                gmdate( 'Y-m-d', strtotime( "-{$days} days" ) )
            ),
            ARRAY_A
        );

        return $rows ? $rows : array();
    }
}
