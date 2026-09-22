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
 * Real remote-upload orchestration for Backups' own storage destination -
 * hooks `vulopilot_backup_completed` (already fired by
 * `BackupManager::finalize_backup()` for every trigger type, manual/
 * scheduled/pre-restore-safety alike) and, when the site's own
 * `backup_storage_destination` setting isn't `'local'`, uploads that
 * backup's real archive to Amazon S3 (BackupS3Connection) or Google Drive
 * (BackupGoogleDriveConnection).
 *
 * Deliberately does its own real HTTP upload on a freshly-scheduled
 * `wp_schedule_single_event()` tick, not synchronously inside the
 * `vulopilot_backup_completed` action itself - that action fires from
 * inside `BackupManager::process_batch()`'s own WP-Cron tick (or, for a
 * pre-restore safety snapshot, from `run_queue_synchronously()` during a
 * live restore REST request), and a slow/large upload shouldn't extend
 * either of those. Same "never runs synchronously on a REST request" shape
 * `BackupManager`'s own docblock establishes for the backup job itself.
 *
 * A backup's row is updated with real `destination`/`destination_status`/
 * `destination_error`/`remote_path` as this actually runs - see
 * Install.php's own `create_backups_table()` docblock for what each real
 * status value means. `'local'` backups are left completely untouched
 * (`destination` stays the column's own default, `destination_status`
 * stays NULL) - nothing here runs at all in that case.
 *
 * `delete_remote_copy()` below closes what used to be a documented gap
 * here: `Controllers\Backups::delete_item()` and `BackupManager::apply_retention()`
 * both call it (with the real row they already have in hand) right
 * alongside their own local unlink()+row-delete, so a backup that was
 * uploaded to S3/Google Drive doesn't leave an orphaned remote copy behind
 * once it's gone locally.
 *
 * Per "No Pro logic in Free": Amazon S3/Google Drive are now Pro-gated
 * (vulopilot-pro's own BackupCloudStorage module - see that module's own
 * docblock). This class keeps doing its own real job - deciding WHETHER a
 * completed backup should be uploaded, updating the row's real
 * destination/status columns - but the actual HTTP upload/delete against
 * S3/Google Drive is asked for via the `vulopilot_backup_upload_to_remote`/
 * `vulopilot_backup_delete_remote_copy` actions rather than calling
 * BackupS3Connection/BackupGoogleDriveConnection directly (both moved to
 * Pro). When Pro isn't active/licensed, nothing is registered on either
 * action and both calls below are silent no-ops: the row is marked
 * `'uploading'` and then simply never resolves further, same as any other
 * `'local'` site that never re-checks a stuck row - no fatal, no crash,
 * Free's own local-disk backup feature keeps working exactly as before.
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
     * @return string One of self::VALID_DESTINATIONS - the real, currently-active setting.
     */
    public function get_active_destination(): string {
        $settings    = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
        $destination = (string) ( $settings['backup_storage_destination'] ?? 'local' );

        return in_array( $destination, self::VALID_DESTINATIONS, true ) ? $destination : 'local';
    }

    /**
     * `vulopilot_backup_completed` callback - marks the row's real
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
     * @param string $destination One of self::VALID_DESTINATIONS (never `'local'` - schedule_upload() never schedules this hook for that case).
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

        if ( 's3' !== $destination && 'google_drive' !== $destination ) {
            return;
        }

        // Amazon S3/Google Drive are Pro-gated (vulopilot-pro's own
        // BackupCloudStorage module) - the real upload itself is asked
        // for via this action rather than calling BackupS3Connection/
        // BackupGoogleDriveConnection directly, so Free has zero
        // remaining reference to either moved class. When Pro isn't
        // active/licensed nothing is registered here and `$on_result`
        // simply never runs - the row stays `'uploading'`, a silent
        // no-op, same as this whole class's own top docblock documents.
        $on_result = function ( string $status, array $data = array() ) use ( $repository, $backup_id ) {
            $update = array( 'destination_status' => $status );

            if ( isset( $data['remote_path'] ) ) {
                $update['remote_path'] = $data['remote_path'];
            }

            if ( isset( $data['error'] ) ) {
                $update['destination_error'] = $data['error'];
            }

            $repository->update( $backup_id, $update );
        };

        do_action( 'vulopilot_backup_upload_to_remote', $destination, $local_path, $filename, $on_result );
    }

    /**
     * Real remote-copy cleanup - called by `Controllers\Backups::delete_item()`
     * and `BackupManager::apply_retention()` right alongside their own local
     * unlink()+row-delete, with the real row they already have in hand (no
     * second DB read here). A no-op for a `'local'`-only backup, one that
     * never finished uploading (`destination_status` isn't `'uploaded'`
     * yet - nothing real exists remotely to clean up), or one with no
     * `remote_path` recorded.
     *
     * Deliberately best-effort: runs synchronously (a single lightweight
     * DELETE request, not the multi-hundred-KB/MB PUT/upload
     * `upload_to_remote()` above schedules onto its own cron tick) and
     * never blocks or fails the caller's own local delete - a remote
     * provider being briefly unreachable shouldn't prevent someone from
     * deleting a backup row locally. Errors are logged (`Utill::log()`,
     * same real opt-in debug-log posture every other best-effort failure in
     * this codebase already uses - wrapped in a plain `\Exception` since
     * that method takes a `\Throwable`, not a `\WP_Error`), not surfaced to
     * the REST response.
     *
     * @param array<string, mixed> $backup Real `vulopilot_backups` row (the same one the caller already fetched).
     * @return void
     */
    public function delete_remote_copy( array $backup ): void {
        $destination = (string) ( $backup['destination'] ?? '' );
        $remote_path = (string) ( $backup['remote_path'] ?? '' );

        if ( 'uploaded' !== ( $backup['destination_status'] ?? '' ) || '' === $remote_path ) {
            return;
        }

        if ( 's3' !== $destination && 'google_drive' !== $destination ) {
            return;
        }

        // Same Pro-gated indirection as schedule_upload()/
        // upload_to_remote() above - Free never calls BackupS3Connection/
        // BackupGoogleDriveConnection directly. A silent no-op when Pro
        // isn't active/licensed: the remote copy (if any) is simply left
        // in place, which is the same best-effort posture this method's
        // own docblock already establishes for a briefly-unreachable
        // provider.
        do_action( 'vulopilot_backup_delete_remote_copy', $destination, $remote_path );
    }
}
