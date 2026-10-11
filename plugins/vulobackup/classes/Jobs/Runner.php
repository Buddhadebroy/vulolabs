<?php
/**
 * Job Runner class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Jobs;

use VuloBackup\Backup\Engine as BackupEngine;
use VuloBackup\Restore\Engine as RestoreEngine;
use VuloBackup\Security\Crypto;
use VuloBackup\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Starts jobs and moves the running one forward a slice at a time.
 *
 * No backup depends on one long PHP request. A slice works for a few seconds (the "step" setting),
 * saves where it got to and stops. Slices are asked for by the open admin screen, and for backups
 * also by WP-Cron, so a backup carries on when the screen is closed. A lock file guarantees that
 * only one slice runs at a time, wherever it was asked for.
 *
 * Two things are watched for so a job cannot loop for ever:
 * - A slice that ends without the job having moved ("stall"). Eight in a row fail the job.
 * - A slice that never ended, because PHP was killed by a time or memory limit ("crash"). Four at
 *   the same point fail the job, and the message says where.
 *
 * Only one job exists at a time; there is no queue to grow. A restore is only ever moved forward
 * by an administrator's own request, never by cron.
 */
class Runner {

	const HOOK = 'vulobackup_run';

	const MAX_STALLS  = 8;
	const MAX_CRASHES = 4;

	/**
	 * Registers the cron callback.
	 */
	public function __construct() {
		add_action( self::HOOK, array( $this, 'cron' ) );
	}

	/**
	 * Starts a backup.
	 *
	 * @param array $args `type` (full|database|files), and optionally `areas`, `name`, `trigger`
	 *                    (manual|schedule|safety) and `destinations` (false for a local-only backup).
	 * @return array|\WP_Error The new job.
	 */
	public function start_backup( array $args ) {
		$type = in_array( $args['type'] ?? '', array( 'full', 'database', 'files' ), true ) ? $args['type'] : 'full';
		$jobs = VuloBackup()->jobs;

		if ( $jobs->active() && 'safety' !== ( $args['trigger'] ?? '' ) ) {
			return new \WP_Error( 'vulobackup_busy', __( 'A backup or restore is already running. Wait for it to finish, or cancel it.', 'vulobackup' ), array( 'status' => 409 ) );
		}

		$settings = VuloBackup()->settings;
		$areas    = isset( $args['areas'] ) && is_array( $args['areas'] ) ? $args['areas'] : (array) $settings->get( 'areas' );
		$areas    = array_values( array_intersect( Utill::AREAS, array_map( 'strval', $areas ) ) );

		if ( 'database' !== $type && ! $areas ) {
			return new \WP_Error( 'vulobackup_invalid', __( 'Choose at least one folder to back up.', 'vulobackup' ), array( 'status' => 400 ) );
		}

		$labels  = array(
			'full'     => __( 'Full backup', 'vulobackup' ),
			'database' => __( 'Database backup', 'vulobackup' ),
			'files'    => __( 'Files backup', 'vulobackup' ),
		);
		$trigger = in_array( $args['trigger'] ?? '', array( 'schedule', 'safety' ), true ) ? $args['trigger'] : 'manual';
		$name    = trim( sanitize_text_field( (string) ( $args['name'] ?? '' ) ) );

		if ( '' === $name ) {
			$name = 'safety' === $trigger ? __( 'Safety backup before restore', 'vulobackup' ) : $labels[ $type ];
		}

		$job = $jobs->create(
			Store::KIND_BACKUP,
			array(
				'type'    => $type,
				'trigger' => $trigger,
				'name'    => substr( $name, 0, 120 ),
				'options' => array(
					'areas'        => 'database' === $type ? array() : $areas,
					'encrypt'      => (bool) $settings->get( 'encrypt' ) && Crypto::is_available(),
					// A safety backup is for undoing a restore on this server; it is not sent anywhere.
					'destinations' => 'safety' === $trigger || false === ( $args['destinations'] ?? null ) ? array() : array_keys( VuloBackup()->destinations->enabled() ),
				),
			)
		);

		if ( ! is_wp_error( $job ) && 'safety' !== $trigger ) {
			$this->schedule();
		}

		return $job;
	}

	/**
	 * Works on the running job for one slice.
	 *
	 * @param bool $interactive Whether an administrator asked for this slice. Restores only move
	 *                          forward when one did.
	 * @return array{job: array|null, busy: bool} busy means another request is working on it now.
	 */
	public function tick( $interactive = false ) {
		$jobs = VuloBackup()->jobs;

		if ( ! $jobs->lock() ) {
			return array(
				'job'  => $jobs->active(),
				'busy' => true,
			);
		}

		$job = $jobs->active();

		if ( ! $job || ( Store::KIND_RESTORE === $job['kind'] && ! $interactive ) ) {
			$jobs->unlock();

			return array(
				'job'  => $job,
				'busy' => false,
			);
		}

		$engine = Store::KIND_RESTORE === $job['kind'] ? new RestoreEngine() : new BackupEngine();
		$print  = self::fingerprint( $job );

		// The last slice never reported back: PHP was stopped mid-way.
		if ( ! empty( $job['running'] ) ) {
			$job['crashes'] = ( $job['running']['print'] ?? '' ) === $print ? (int) ( $job['crashes'] ?? 0 ) + 1 : 1;

			if ( $job['crashes'] >= self::MAX_CRASHES ) {
				unset( $job['running'] );

				$job = $engine->fail_job(
					$job,
					sprintf(
						/* translators: %s: internal name of the step, e.g. archive. */
						__( 'The server stopped the work several times at the same point (%s). This usually means PHP\'s time or memory limit is too low for this site. Lower "Seconds per step" in Settings, exclude large folders, or ask your host to raise the limits.', 'vulobackup' ),
						(string) $job['step']
					)
				);

				$jobs->unlock();

				return array(
					'job'  => $job,
					'busy' => false,
				);
			}
		}

		$budget         = (int) VuloBackup()->settings->get( 'step_seconds' );
		$job['running'] = array(
			'since' => time(),
			'print' => $print,
		);

		$jobs->save( $job );

		ignore_user_abort( true );
		wp_raise_memory_limit( 'admin' );

		if ( function_exists( 'set_time_limit' ) ) {
			@set_time_limit( $budget + 90 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, Squiz.PHP.DiscouragedFunctions.Discouraged -- refused on some hosts; the slice is short enough to fit the default limit anyway.
		}

		$job = $engine->tick( $job, microtime( true ) + $budget );

		unset( $job['running'] );

		if ( ! in_array( $job['status'], Store::FINAL_STATUSES, true ) ) {
			$job['stalls'] = self::fingerprint( $job ) === $print ? (int) ( $job['stalls'] ?? 0 ) + 1 : 0;

			if ( $job['stalls'] >= self::MAX_STALLS ) {
				$job = $engine->fail_job( $job, __( 'The work stopped making progress and was ended. See the log of this job for the last thing it did.', 'vulobackup' ) );
			}
		}

		$jobs->save( $job );
		$jobs->unlock();

		if ( Store::KIND_BACKUP === $job['kind'] && ! in_array( $job['status'], Store::FINAL_STATUSES, true ) ) {
			$this->schedule();
		}

		return array(
			'job'  => $job,
			'busy' => false,
		);
	}

	/**
	 * Cancels a job.
	 *
	 * @param array $job Job.
	 * @return array|\WP_Error The job.
	 */
	public function cancel( array $job ) {
		$jobs = VuloBackup()->jobs;

		if ( in_array( $job['status'], Store::FINAL_STATUSES, true ) ) {
			return $job;
		}

		if ( ! $jobs->lock() ) {
			return new \WP_Error( 'vulobackup_busy', __( 'This job is in the middle of a step. Try again in a few seconds.', 'vulobackup' ), array( 'status' => 409 ) );
		}

		// Read again under the lock: a slice may have finished the job a moment ago.
		$job = $jobs->get( $job['kind'], $job['id'] );

		if ( $job && ! in_array( $job['status'], Store::FINAL_STATUSES, true ) ) {
			$engine = Store::KIND_RESTORE === $job['kind'] ? new RestoreEngine() : new BackupEngine();
			$job    = $engine->cancel( $job );
		}

		$jobs->unlock();

		return $job;
	}

	/**
	 * WP-Cron callback: one slice of the running backup.
	 *
	 * @return void
	 */
	public function cron() {
		$this->tick( false );
	}

	/**
	 * Makes sure WP-Cron will ask for another slice soon. Never more than one event is queued.
	 *
	 * @return void
	 */
	public function schedule() {
		if ( ! wp_next_scheduled( self::HOOK ) ) {
			wp_schedule_single_event( time(), self::HOOK );
		}
	}

	/**
	 * A value that changes whenever a job moves forward.
	 *
	 * @param array $job Job.
	 * @return string
	 */
	private static function fingerprint( array $job ) {
		return md5( $job['status'] . '|' . $job['step'] . '|' . wp_json_encode( $job['cursor'] ) );
	}
}
