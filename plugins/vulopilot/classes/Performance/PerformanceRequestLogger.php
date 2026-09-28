<?php
namespace VuloPilot\Performance;

use VuloPilot\Performance\PerformanceRequestRepository;

defined( 'ABSPATH' ) || exit;

/**
 * Real-time "Performance" telemetry - logs one response-time sample for a real front-end
 * request.
 *
 * @class       PerformanceRequestLogger class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PerformanceRequestLogger {

	private const CLEANUP_HOOK = 'vulopilot_performance_request_cleanup';

	private const SAMPLE_RATE = 5; // 1 in 5 real requests, ~20%.

	private const RETENTION_DAYS = 3;

	/**
	 * PerformanceRequestLogger constructor.
	 */
	public function __construct() {
		add_action( 'shutdown', array( $this, 'maybe_log' ) );
		add_action( 'init', array( $this, 'ensure_cleanup_scheduled' ) );
		add_action( self::CLEANUP_HOOK, array( $this, 'run_cleanup' ) );
	}

	/**
	 * @return void
	 */
	public function maybe_log(): void {
		if ( ! $this->is_real_front_end_request() ) {
			return;
		}

		if ( 1 !== wp_rand( 1, self::SAMPLE_RATE ) ) {
			return;
		}

		// Core's own "seconds since the PHP script started" (WP 5.8+).
		$response_time_ms = (int) round( timer_float() * 1000 );

		if ( $response_time_ms <= 0 || $response_time_ms > 65535 ) {
			// Out of the column's smallint unsigned range, or clearly
			// bogus (a clock anomaly) - skip rather than truncate silently.
			return;
		}

		( new PerformanceRequestRepository() )->insert( array( 'response_time_ms' => $response_time_ms ) );
	}

	/**
	 * @return bool
	 */
	private function is_real_front_end_request(): bool {
		return ! is_admin()
			&& ! wp_doing_ajax()
			&& ! wp_doing_cron()
			&& ! ( defined( 'REST_REQUEST' ) && REST_REQUEST )
			&& ! ( defined( 'WP_CLI' ) && WP_CLI )
			&& ! is_feed();
	}

	/**
	 * Schedules the daily cleanup event if it isn't already scheduled.
	 *
	 * @return void
	 */
	public function ensure_cleanup_scheduled(): void {
		if ( ! wp_next_scheduled( self::CLEANUP_HOOK ) ) {
			wp_schedule_event( time(), 'daily', self::CLEANUP_HOOK );
		}
	}

	/**
	 * @return void
	 */
	public function run_cleanup(): void {
		( new PerformanceRequestRepository() )->delete_older_than( self::RETENTION_DAYS );
	}
}
