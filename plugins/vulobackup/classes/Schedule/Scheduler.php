<?php
/**
 * Scheduler class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Schedule;

use VuloBackup\Jobs\Runner;
use VuloBackup\Jobs\Store;
use VuloBackup\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Starts scheduled backups, and keeps a running backup moving.
 *
 * Once an hour WP-Cron asks whether a backup is due. Files and the database each have their own
 * frequency (daily, weekly, monthly or manual) and share one time of day; when both are due
 * together they are made as one full backup.
 *
 * "Due" means the most recent scheduled moment has passed and no scheduled backup has started since.
 * So a backup that was missed, because the site had no visitors for WP-Cron to run on, is made at
 * the next opportunity rather than skipped; and repeated cron events in the same hour cannot start
 * a second one, because the first records its start before it begins.
 *
 * WP-Cron only runs when the site is visited, so the times are "not before", not exact.
 */
class Scheduler {

	const HOOK_CHECK    = 'vulobackup_schedule_check';
	const HOOK_WATCHDOG = 'vulobackup_watchdog';

	/**
	 * Registers the cron callbacks and makes sure the recurring events exist.
	 */
	public function __construct() {
		add_action( self::HOOK_CHECK, array( $this, 'check' ) );
		add_action( self::HOOK_WATCHDOG, array( $this, 'watchdog' ) );

		if ( ! wp_next_scheduled( self::HOOK_CHECK ) ) {
			wp_schedule_event( time() + 300, 'hourly', self::HOOK_CHECK );
		}

		if ( ! wp_next_scheduled( self::HOOK_WATCHDOG ) ) {
			wp_schedule_event( time() + 300, 'vulobackup_five_minutes', self::HOOK_WATCHDOG );
		}
	}

	/**
	 * Adds the watchdog's interval to WP-Cron.
	 *
	 * @param array $schedules Registered intervals.
	 * @return array
	 */
	public static function intervals( $schedules ) {
		$schedules['vulobackup_five_minutes'] = array(
			'interval' => 300,
			'display'  => __( 'Every five minutes (VuloBackup)', 'vulobackup' ),
		);

		return $schedules;
	}

	/**
	 * Removes every scheduled event of this plugin.
	 *
	 * @return void
	 */
	public static function clear() {
		wp_clear_scheduled_hook( self::HOOK_CHECK );
		wp_clear_scheduled_hook( self::HOOK_WATCHDOG );
		wp_clear_scheduled_hook( Runner::HOOK );
	}

	/**
	 * Hourly: starts a scheduled backup when one is due and nothing else is running.
	 *
	 * @return void
	 */
	public function check() {
		$due = $this->due( time() );

		if ( ! $due || VuloBackup()->jobs->active() ) {
			return;
		}

		$type = count( $due ) > 1 ? 'full' : ( 'database' === $due[0] ? 'database' : 'files' );

		// Recorded before the backup starts, so a second cron event cannot start another.
		$state = self::state();

		foreach ( $due as $what ) {
			$state[ 'last_' . $what ] = time();
		}

		update_option( Utill::OTHER_SETTINGS['schedule_state'], $state, false );

		$job = VuloBackup()->runner->start_backup(
			array(
				'type'    => $type,
				'trigger' => 'schedule',
			)
		);

		if ( is_wp_error( $job ) ) {
			VuloBackup()->logger->log(
				\VuloBackup\Logging\Logger::LEVEL_ERROR,
				'schedule_failed',
				/* translators: %s: error. */
				sprintf( __( 'A scheduled backup could not start. %s', 'vulobackup' ), $job->get_error_message() )
			);
		}
	}

	/**
	 * Every five minutes: wakes a backup that has no slice queued, and tidies up.
	 *
	 * @return void
	 */
	public function watchdog() {
		$active = VuloBackup()->jobs->active();

		if ( $active && Store::KIND_BACKUP === $active['kind'] ) {
			VuloBackup()->runner->schedule();
		}

		// Old folders and tables that a finished restore had no time left to remove.
		\VuloBackup\Restore\Engine::sweep( microtime( true ) + 15 );

		if ( ! get_transient( 'vulobackup_daily_tidy' ) ) {
			set_transient( 'vulobackup_daily_tidy', 1, DAY_IN_SECONDS );

			VuloBackup()->vault->clean_tmp();
			VuloBackup()->logger->prune();
		}
	}

	/**
	 * Which scheduled backups are due.
	 *
	 * @param int $now Unix timestamp.
	 * @return string[] Any of `files` and `database`.
	 */
	public function due( $now ) {
		$settings = VuloBackup()->settings;
		$state    = self::state();
		$due      = array();

		foreach ( array( 'files', 'database' ) as $what ) {
			$frequency = (string) $settings->get( 'schedule_' . $what );

			if ( 'manual' !== $frequency && (int) $state[ 'last_' . $what ] < $this->slot( $frequency, $now, false ) ) {
				$due[] = $what;
			}
		}

		return $due;
	}

	/**
	 * When each schedule will next be due.
	 *
	 * @return array{files: int, database: int} Unix timestamps; 0 for a manual schedule.
	 */
	public function next_runs() {
		$settings = VuloBackup()->settings;
		$now      = time();
		$next     = array();

		foreach ( array( 'files', 'database' ) as $what ) {
			$frequency = (string) $settings->get( 'schedule_' . $what );

			if ( 'manual' === $frequency ) {
				$next[ $what ] = 0;
				continue;
			}

			// Overdue already: it runs at the next hourly check.
			$next[ $what ] = in_array( $what, $this->due( $now ), true ) ? $now : $this->slot( $frequency, $now, true );
		}

		return $next;
	}

	/**
	 * The scheduled moment nearest to now for a frequency, in the site's timezone.
	 *
	 * @param string $frequency daily, weekly or monthly.
	 * @param int    $now       Unix timestamp.
	 * @param bool   $upcoming  The first moment after now, instead of the last one at or before it.
	 * @return int Unix timestamp.
	 */
	public function slot( $frequency, $now, $upcoming ) {
		$settings = VuloBackup()->settings;
		$zone     = wp_timezone();
		$hour     = (int) $settings->get( 'schedule_hour' );
		$moment   = ( new \DateTimeImmutable( '@' . $now ) )->setTimezone( $zone )->setTime( $hour, 0, 0 );

		if ( 'weekly' === $frequency ) {
			$shift  = ( (int) $moment->format( 'w' ) - (int) $settings->get( 'schedule_weekday' ) + 7 ) % 7;
			$moment = $moment->modify( '-' . $shift . ' days' );
			$step   = '7 days';
		} elseif ( 'monthly' === $frequency ) {
			$moment = $moment->setDate( (int) $moment->format( 'Y' ), (int) $moment->format( 'n' ), (int) $settings->get( 'schedule_monthday' ) );
			$step   = '1 month';
		} else {
			$step = '1 day';
		}

		if ( $moment->getTimestamp() > $now ) {
			$moment = $moment->modify( '-' . $step );
		}

		return $upcoming ? $moment->modify( '+' . $step )->getTimestamp() : $moment->getTimestamp();
	}

	/**
	 * Called when settings are saved: a schedule that was just switched on or changed counts from
	 * now, so it does not fire at once for a moment that passed before it existed.
	 *
	 * @param array $before Settings before the save.
	 * @param array $after  Settings after it.
	 * @return void
	 */
	public static function settings_changed( array $before, array $after ) {
		$state   = self::state();
		$changed = false;
		$shared  = $before['schedule_hour'] !== $after['schedule_hour'] || $before['schedule_weekday'] !== $after['schedule_weekday'] || $before['schedule_monthday'] !== $after['schedule_monthday'];

		foreach ( array( 'files', 'database' ) as $what ) {
			if ( $shared || $before[ 'schedule_' . $what ] !== $after[ 'schedule_' . $what ] ) {
				$state[ 'last_' . $what ] = time();
				$changed                  = true;
			}
		}

		if ( $changed ) {
			update_option( Utill::OTHER_SETTINGS['schedule_state'], $state, false );
		}
	}

	/**
	 * When a scheduled backup of each kind last started.
	 *
	 * @return array{last_files: int, last_database: int} When a scheduled backup of each kind last started.
	 */
	private static function state() {
		$state = get_option( Utill::OTHER_SETTINGS['schedule_state'], array() );
		$state = is_array( $state ) ? $state : array();

		return array(
			'last_files'    => (int) ( $state['last_files'] ?? 0 ),
			'last_database' => (int) ( $state['last_database'] ?? 0 ),
		);
	}
}
