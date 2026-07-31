<?php
/**
 * FileBaselineRepository class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Repositories;

defined( 'ABSPATH' ) || exit;

/**
 * Persistence for vulopilot_file_baselines (DATABASE.md) — the schema Free
 * owns for vulopilot-pro's Integrity Monitoring feature (SECURITY-MODULE.md).
 * Free itself never populates this table; it stays empty unless Pro's
 * IntegrityMonitoringScanner is active.
 *
 * @class       FileBaselineRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class FileBaselineRepository extends AbstractRepository {

    /**
     * @var string[]
     */
    protected array $filterable_columns = array( 'scope' );

    /**
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'file_baseline';
    }

    /**
     * @param string $path A file's absolute or repo-relative path.
     * @return string An md5 of $path — this table's own path_hash column, see Install.php's own docblock for why.
     */
    public static function hash_path( string $path ): string {
        return md5( $path );
    }

    /**
     * One row by its own path, or null if this path has never been baselined.
     *
     * @param string $path Same path passed to hash_path() when the row was written.
     * @return array<string, mixed>|null
     */
    public function find_by_path( string $path ): ?array {
        global $wpdb;

        $row = $wpdb->get_row(
            $wpdb->prepare( "SELECT * FROM {$this->get_table()} WHERE path_hash = %s", self::hash_path( $path ) ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            ARRAY_A
        );

        return $row ?: null;
    }

    /**
     * Every baselined path within one scope ('plugin'|'theme') — what
     * IntegrityMonitoringScanner diffs a fresh directory listing against to
     * detect files removed since the last scan.
     *
     * @param string $scope 'plugin'|'theme'.
     * @return array<int, array<string, mixed>>
     */
    public function get_by_scope( string $scope ): array {
        global $wpdb;

        return (array) $wpdb->get_results(
            $wpdb->prepare( "SELECT * FROM {$this->get_table()} WHERE scope = %s", $scope ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            ARRAY_A
        );
    }

    /**
     * Inserts a new path's baseline row, or updates its hash/size/last_seen_at
     * if one already exists — IntegrityMonitoringScanner calls this once per
     * file it's already reconciled against the previous baseline (added or
     * unchanged), never for a file it's about to report as removed.
     *
     * @param string $path      Absolute or repo-relative file path.
     * @param string $scope     'plugin'|'theme'.
     * @param string $hash      sha256 of the file's current contents.
     * @param int    $file_size Current file size in bytes.
     * @return void
     */
    public function upsert( string $path, string $scope, string $hash, int $file_size ): void {
        $existing = $this->find_by_path( $path );

        $data = array(
            'path'         => $path,
            'path_hash'    => self::hash_path( $path ),
            'scope'        => $scope,
            'hash'         => $hash,
            'file_size'    => $file_size,
            'last_seen_at' => current_time( 'mysql', true ),
        );

        if ( $existing ) {
            $this->update( (int) $existing['id'], $data );
        } else {
            $this->insert( $data );
        }
    }

    /**
     * Removes a path's baseline row entirely — called once
     * IntegrityMonitoringScanner has already reported it as a "file
     * removed" Finding, so a future re-creation of the same path is
     * reported as newly "added" rather than silently absorbed as if
     * nothing happened.
     *
     * @param string $path Absolute or repo-relative file path.
     * @return void
     */
    public function delete_by_path( string $path ): void {
        global $wpdb;

        $wpdb->delete( $this->get_table(), array( 'path_hash' => self::hash_path( $path ) ) );
    }
}
