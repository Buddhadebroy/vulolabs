<?php
/**
 * BackupRepository class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Repositories;

defined( 'ABSPATH' ) || exit;

/**
 * Persistence for `vulopilot_backups` (DATABASE.md) —
 * Services\BackupManager/BackupScheduler's own real backup-run log, backing
 * "Backups"/"Recovery", `RestAPI\Controllers\Backups`, and
 * Scanners\Basic\BackupHealthScanner's Finding rows.
 *
 * @class       BackupRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class BackupRepository extends AbstractRepository {

    /**
     * @var string[]
     */
    protected array $filterable_columns = array( 'status', 'trigger_type' );

    /**
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'backup';
    }

    /**
     * The single most recent backup row of any status —
     * Scanners\Basic\BackupHealthScanner's own "is the latest run healthy"
     * check.
     *
     * @return array<string, mixed>|null
     */
    public function get_latest(): ?array {
        global $wpdb;

        $row = $wpdb->get_row( "SELECT * FROM {$this->get_table()} ORDER BY id DESC LIMIT 1", ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return $row ?: null;
    }

    /**
     * The single most recent successfully-completed backup row —
     * BackupManager's own "how stale is the last good backup" check and the
     * safety snapshot Recovery always takes before a real restore looks for
     * its own most recent successful predecessor.
     *
     * @return array<string, mixed>|null
     */
    public function get_latest_completed(): ?array {
        global $wpdb;

        $row = $wpdb->get_row(
            $wpdb->prepare( "SELECT * FROM {$this->get_table()} WHERE status = %s ORDER BY id DESC LIMIT 1", 'completed' ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            ARRAY_A
        );

        return $row ?: null;
    }

    /**
     * Every completed backup row beyond the newest `$keep_count` —
     * BackupManager's own retention cleanup after each successful run.
     * Ordered oldest-first so the caller can delete file+row together
     * without a second query.
     *
     * @param int $keep_count Real, current `backup_retention_count` setting value.
     * @return array<int, array<string, mixed>>
     */
    public function get_completed_beyond_retention( int $keep_count ): array {
        global $wpdb;

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$this->get_table()} WHERE status = %s ORDER BY id DESC LIMIT 1000 OFFSET %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                'completed',
                max( 0, $keep_count )
            ),
            ARRAY_A
        );

        return $rows ?: array();
    }
}
