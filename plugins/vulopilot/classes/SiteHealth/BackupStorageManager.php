<?php
namespace VuloPilot\SiteHealth;

use VuloPilot\SiteHealth\BackupRepository;
use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Real remote-upload orchestration for Backups' own storage destination.
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
	 * `vulopilot_backup_completed` callback - marks the row's real destination immediately
	 * (so BackupsTab.tsx shows "Uploading…" without waiting for the next cron tick) and
	 * schedules the actual upload.
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
	 * Real remote-copy cleanup - called by `Backups::delete_item()` and
	 * `BackupManager::apply_retention()` right alongside their own local unlink()+row-
	 * delete, with the real row they already have in hand (no second DB read here).
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

		do_action( 'vulopilot_backup_delete_remote_copy', $destination, $remote_path );
	}
}
