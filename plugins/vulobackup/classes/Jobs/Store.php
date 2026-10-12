<?php
/**
 * Job Store class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Jobs;

use VuloBackup\Security\PathGuard;
use VuloBackup\Storage\Vault;
use VuloBackup\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Persists jobs (backups and restores) as `job.json` files inside the storage folder.
 *
 * State is deliberately kept out of the database: a restore replaces the database, a migration
 * brings another site's, and in both cases the record of what was backed up and what a running
 * restore has done so far has to survive.
 */
class Store {

	const KIND_BACKUP  = 'backups';
	const KIND_RESTORE = 'restores';

	/**
	 * Statuses in which a job will do no more work.
	 *
	 * @var string[]
	 */
	const FINAL_STATUSES = array( 'completed', 'failed', 'cancelled' );

	/**
	 * Storage folder.
	 *
	 * @var Vault
	 */
	private $vault;

	/**
	 * Handle of the lock held by this request, if any.
	 *
	 * @var resource|null
	 */
	private $lock = null;

	/**
	 * Constructor.
	 *
	 * @param Vault $vault Storage folder.
	 */
	public function __construct( Vault $vault ) {
		$this->vault = $vault;
	}

	/**
	 * Creates a job and its folder.
	 *
	 * @param string $kind KIND_BACKUP or KIND_RESTORE.
	 * @param array  $data Initial fields.
	 * @return array|\WP_Error The job.
	 */
	public function create( $kind, array $data ) {
		if ( ! $this->vault->ensure() ) {
			return new \WP_Error( 'vulobackup_storage', __( 'The backup folder could not be created or is not writable. Check Settings → Storage.', 'vulobackup' ) );
		}

		do {
			$id = gmdate( 'Ymd-His' ) . '-' . bin2hex( random_bytes( 4 ) );
		} while ( is_dir( $this->vault->job_dir( $kind, $id ) ) );

		if ( ! wp_mkdir_p( $this->vault->job_dir( $kind, $id ) ) ) {
			return new \WP_Error( 'vulobackup_storage', __( 'The backup folder could not be created or is not writable. Check Settings → Storage.', 'vulobackup' ) );
		}

		$job = array_merge(
			array(
				'id'          => $id,
				'kind'        => $kind,
				'status'      => 'queued',
				'step'        => '',
				'cursor'      => array(),
				'percent'     => 0,
				'label'       => '',
				'error'       => '',
				'warnings'    => array(),
				'stalls'      => 0,
				'created_at'  => Utill::now(),
				'updated_at'  => Utill::now(),
				'finished_at' => '',
			),
			$data
		);

		return $this->save( $job ) ? $job : new \WP_Error( 'vulobackup_storage', __( 'The backup folder is not writable.', 'vulobackup' ) );
	}

	/**
	 * Reads a job's record.
	 *
	 * @param string $kind KIND_BACKUP or KIND_RESTORE.
	 * @param string $id   Job identifier.
	 * @return array|null
	 */
	public function get( $kind, $id ) {
		if ( ! PathGuard::is_id( $id ) ) {
			return null;
		}

		$file = $this->vault->job_dir( $kind, $id ) . '/job.json';

		if ( ! is_readable( $file ) ) {
			return null;
		}

		$job = json_decode( (string) file_get_contents( $file ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- a local state file.

		// The folder name is the identity; a job file copied in from elsewhere cannot claim another.
		if ( ! is_array( $job ) || ( $job['id'] ?? '' ) !== $id ) {
			return null;
		}

		$job['kind'] = $kind;

		return $job;
	}

	/**
	 * Writes a job's record.
	 *
	 * @param array $job Job to write.
	 * @return bool
	 */
	public function save( array $job ) {
		if ( ! PathGuard::is_id( $job['id'] ?? '' ) ) {
			return false;
		}

		$job['updated_at'] = Utill::now();
		$directory         = $this->vault->job_dir( $job['kind'], $job['id'] );

		return is_dir( $directory ) && Utill::write_atomic( $directory . '/job.json', (string) wp_json_encode( $job ) );
	}

	/**
	 * Every job of a kind, newest first.
	 *
	 * @param string $kind KIND_BACKUP or KIND_RESTORE.
	 * @return array[]
	 */
	public function all( $kind ) {
		$directory = dirname( $this->vault->job_dir( $kind, 'x' ) );
		$entries   = is_dir( $directory ) ? scandir( $directory, SCANDIR_SORT_DESCENDING ) : array();
		$jobs      = array();

		foreach ( is_array( $entries ) ? $entries : array() as $entry ) {
			$job = PathGuard::is_id( $entry ) ? $this->get( $kind, $entry ) : null;

			if ( $job ) {
				$jobs[] = $job;
			}
		}

		usort(
			$jobs,
			static function ( $a, $b ) {
				return strcmp( (string) $b['created_at'], (string) $a['created_at'] );
			}
		);

		return $jobs;
	}

	/**
	 * The job that is still working, if there is one. Only one runs at a time.
	 *
	 * @return array|null
	 */
	public function active() {
		foreach ( array( self::KIND_RESTORE, self::KIND_BACKUP ) as $kind ) {
			foreach ( $this->all( $kind ) as $job ) {
				if ( ! in_array( $job['status'], self::FINAL_STATUSES, true ) ) {
					return $job;
				}
			}
		}

		return null;
	}

	/**
	 * Returns the job's folder.
	 *
	 * @param array $job Job.
	 * @return string The job's folder.
	 */
	public function dir( array $job ) {
		return $this->vault->job_dir( $job['kind'], $job['id'] );
	}

	/**
	 * Deletes a job and every file it holds.
	 *
	 * @param string $kind KIND_BACKUP or KIND_RESTORE.
	 * @param string $id   Job identifier.
	 * @return bool
	 */
	public function delete( $kind, $id ) {
		if ( ! PathGuard::is_id( $id ) ) {
			return false;
		}

		$directory = $this->vault->job_dir( $kind, $id );

		// Belt and braces: the folder must really be inside the storage folder.
		if ( ! is_dir( $directory ) || ! PathGuard::is_within( $directory, $this->vault->base() ) ) {
			return false;
		}

		return Utill::delete_tree( $directory );
	}

	/**
	 * Takes the lock that lets one request at a time work on jobs. It is released when the request
	 * ends, even if PHP dies.
	 *
	 * @return bool Whether this request now holds the lock.
	 */
	public function lock() {
		if ( $this->lock ) {
			return true;
		}

		if ( ! $this->vault->ensure() ) {
			return false;
		}

		$handle = fopen( $this->vault->base() . '/run.lock', 'c' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen

		if ( ! $handle ) {
			return false;
		}

		if ( ! flock( $handle, LOCK_EX | LOCK_NB ) ) {
			fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

			return false;
		}

		$this->lock = $handle;

		return true;
	}

	/**
	 * Releases the lock.
	 *
	 * @return void
	 */
	public function unlock() {
		if ( $this->lock ) {
			flock( $this->lock, LOCK_UN );
			fclose( $this->lock ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
			$this->lock = null;
		}
	}
}
