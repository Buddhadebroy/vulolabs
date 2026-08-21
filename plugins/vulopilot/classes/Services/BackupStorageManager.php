<?php
/**
 * BackupStorageManager class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

use VuloPilot\Repositories\BackupRepository;
use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Real remote-upload orchestration for Backups' own storage destination —
 * hooks `vulopilot_backup_completed` (already fired by
 * `BackupManager::finalize_backup()` for every trigger type, manual/
 * scheduled/pre-restore-safety alike) and, when the site's own
 * `backup_storage_destination` setting isn't `'local'`, uploads that
 * backup's real archive to Amazon S3 (BackupS3Connection) or Google Drive
 * (BackupGoogleDriveConnection).
 *
 * Deliberately does its own real HTTP upload on a freshly-scheduled
 * `wp_schedule_single_event()` tick, not synchronously inside the
 * `vulopilot_backup_completed` action itself — that action fires from
 * inside `BackupManager::process_batch()`'s own WP-Cron tick (or, for a
 * pre-restore safety snapshot, from `run_queue_synchronously()` during a
 * live restore REST request), and a slow/large upload shouldn't extend
 * either of those. Same "never runs synchronously on a REST request" shape
 * `BackupManager`'s own docblock establishes for the backup job itself.
 *
 * A backup's row is updated with real `destination`/`destination_status`/
 * `destination_error`/`remote_path` as this actually runs — see
 * Install.php's own `create_backups_table()` docblock for what each real
 * status value means. `'local'` backups are left completely untouched
 * (`destination` stays the column's own default, `destination_status`
 * stays NULL) — nothing here runs at all in that case.
 *
 * Known gap, documented rather than silently glossed over: deleting a
 * backup (`Controllers\Backups::delete_item()`) or letting retention clean
 * one up (`BackupManager::apply_retention()`) only ever removes the local
 * file + row — a backup that was also uploaded to S3/Google Drive leaves
 * its remote copy in place. Flag if automatic remote cleanup on
 * delete/retention should be scoped next.
 *
 * @class       BackupStorageManager class
 * @version     1.0.0
 * @author      VuloLabs
 */
class BackupStorageManager {

    private const UPLOAD_HOOK = 'vulopilot_backup_upload_to_remote';

    /**
     * @var string[]
     */
    private const VALID_DESTINATIONS = array( 'local', 's3', 'google_drive' );

    public function __construct() {
        add_action( 'vulopilot_backup_completed', array( $this, 'schedule_upload' ) );
        add_action( self::UPLOAD_HOOK, array( $this, 'upload_to_remote' ), 10, 2 );
    }

    /**
     * @return string One of self::VALID_DESTINATIONS — the real, currently-active setting.
     */
    public function get_active_destination(): string {
        $settings    = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
        $destination = (string) ( $settings['backup_storage_destination'] ?? 'local' );

        return in_array( $destination, self::VALID_DESTINATIONS, true ) ? $destination : 'local';
    }

    /**
     * `vulopilot_backup_completed` callback — marks the row's real
     * destination immediately (so BackupsTab.tsx shows "Uploading…"
     * without waiting for the next cron tick) and schedules the actual
     * upload.
     *
     * @param int $backup_id Real `vulopilot_backups` row id.
     * @return void
     */
    public function schedule_upload( int $backup_id ): void {
        $destination = $this->get_active_destination();

        if ( 'local' === $destination ) {
            return;
        }

        ( new BackupRepository() )->update(
            $backup_id,
            array(
                'destination'        => $destination,
                'destination_status' => 'uploading',
            )
        );

        wp_schedule_single_event( time(), self::UPLOAD_HOOK, array( $backup_id, $destination ) );
    }

    /**
     * Registered on `self::UPLOAD_HOOK`, run via WP-Cron only. Performs the
     * real upload and writes back the real, final outcome.
     *
     * @param int    $backup_id   Real `vulopilot_backups` row id.
     * @param string $destination One of self::VALID_DESTINATIONS (never `'local'` — schedule_upload() never schedules this hook for that case).
     * @return void
     */
    public function upload_to_remote( int $backup_id, string $destination ): void {
        $repository = new BackupRepository();
        $backup     = $repository->find( $backup_id );

        if ( ! $backup || 'completed' !== $backup['status'] || empty( $backup['file_path'] ) ) {
            return;
        }

        $local_path = VuloPilot()->backup_manager->resolve_file_path( (string) $backup['file_path'] );
        $filename   = basename( (string) $backup['file_path'] );

        if ( ! file_exists( $local_path ) ) {
            $repository->update(
                $backup_id,
                array(
                    'destination_status' => 'failed',
                    'destination_error'  => __( 'The local backup file was missing before the upload could start.', 'vulopilot' ),
                )
            );
            return;
        }

        if ( 's3' === $destination ) {
            $this->upload_to_s3( $repository, $backup_id, $local_path, $filename );
            return;
        }

        if ( 'google_drive' === $destination ) {
            $this->upload_to_google_drive( $repository, $backup_id, $local_path, $filename );
        }
    }

    /**
     * @param BackupRepository $repository
     * @param int               $backup_id
     * @param string            $local_path Real absolute path to the local archive.
     * @param string            $filename   Real filename, used as the S3 object key.
     * @return void
     */
    private function upload_to_s3( BackupRepository $repository, int $backup_id, string $local_path, string $filename ): void {
        $connection = new BackupS3Connection();

        if ( ! $connection->is_configured() ) {
            $repository->update( $backup_id, array( 'destination_status' => 'skipped_not_configured' ) );
            return;
        }

        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_get_contents -- reading VuloPilot's own controlled, just-finished backup archive, not arbitrary user input; same risk profile BackupManager::restore() already accepts for its own full-file reads.
        $bytes = (string) file_get_contents( $local_path );

        $result = $connection->build_client()->put_object( $filename, $bytes, 'application/zip' );

        if ( is_wp_error( $result ) ) {
            $repository->update(
                $backup_id,
                array(
                    'destination_status' => 'failed',
                    'destination_error'  => $result->get_error_message(),
                )
            );
            return;
        }

        $repository->update(
            $backup_id,
            array(
                'destination_status' => 'uploaded',
                'remote_path'        => $filename,
            )
        );
    }

    /**
     * @param BackupRepository $repository
     * @param int               $backup_id
     * @param string            $local_path Real absolute path to the local archive.
     * @param string            $filename   Real filename to store on Drive.
     * @return void
     */
    private function upload_to_google_drive( BackupRepository $repository, int $backup_id, string $local_path, string $filename ): void {
        $connection = new BackupGoogleDriveConnection();

        if ( ! $connection->is_connected() ) {
            $repository->update( $backup_id, array( 'destination_status' => 'skipped_not_configured' ) );
            return;
        }

        $result = $connection->upload_backup_file( $local_path, $filename );

        if ( is_wp_error( $result ) ) {
            $repository->update(
                $backup_id,
                array(
                    'destination_status' => 'failed',
                    'destination_error'  => $result->get_error_message(),
                )
            );
            return;
        }

        $repository->update(
            $backup_id,
            array(
                'destination_status' => 'uploaded',
                'remote_path'        => $result,
            )
        );
    }
}
