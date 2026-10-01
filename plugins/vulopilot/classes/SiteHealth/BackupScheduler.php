<?php
namespace VuloPilot\SiteHealth;

use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Reads `backup_frequency` (`'daily'|'weekly'|'disabled'`).
 *
 * @class       BackupScheduler class
 * @version     1.0.0
 * @author      VuloLabs
 */
class BackupScheduler {

	private const CRON_HOOK = 'vulopilot_backup_scheduled_run';

	/**
	 * BackupScheduler constructor.
	 */
	public function __construct() {
		add_filter( 'cron_schedules', array( $this, 'register_weekly_schedule' ) ); // phpcs:ignore WordPress.WP.CronInterval.CronSchedulesInterval -- registering a real, standard 7-day interval, not a shorter-than-recommended one.
		add_action( 'init', array( $this, 'ensure_scheduled' ), 30 );
		add_action( self::CRON_HOOK, array( $this, 'run_scheduled_backup' ) );
	}

	/**
	 * @param array<string, array{interval: int, display: string}> $schedules Real, currently-registered schedules.
	 * @return array<string, array{interval: int, display: string}>
	 */
	public function register_weekly_schedule( array $schedules ): array {
		if ( ! isset( $schedules['weekly'] ) ) {
			$schedules['weekly'] = array(
				'interval' => WEEK_IN_SECONDS,
				'display'  => __( 'Once Weekly', 'vulopilot' ),
			);
		}

		return $schedules;
	}

	/**
	 * Reconciles the real scheduled cron event against the real, current
	 * `enable_automatic_backups`/`backup_frequency` settings.
	 *
	 * @return void
	 */
	public function ensure_scheduled(): void {
		$settings  = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
		$enabled   = ! empty( $settings['enable_automatic_backups'] );
		$frequency = (string) ( $settings['backup_frequency'] ?? 'disabled' );

		$scheduled = wp_get_scheduled_event( self::CRON_HOOK );

		if ( ! $enabled || ! in_array( $frequency, array( 'daily', 'weekly' ), true ) ) {
			if ( $scheduled ) {
				wp_clear_scheduled_hook( self::CRON_HOOK );
			}

			return;
		}

		if ( $scheduled && $frequency === $scheduled->schedule ) {
			return;
		}

		wp_clear_scheduled_hook( self::CRON_HOOK );
		wp_schedule_event( time(), $frequency, self::CRON_HOOK );
	}

	/**
	 * The real cron tick - starts a real, scheduled-trigger backup job.
	 *
	 * @return void
	 */
	public function run_scheduled_backup(): void {
		VuloPilot()->backup_manager->start_backup( 'scheduled' );
	}
}
