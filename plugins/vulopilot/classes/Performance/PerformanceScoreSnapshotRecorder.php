<?php
namespace VuloPilot\Performance;

use VuloPilot\Utill\FindingRepository;
use VuloPilot\Utill\ScoreSnapshotRepository;

defined( 'ABSPATH' ) || exit;

/**
 * Writes today's real performance-category score into `vulopilot_score_snapshots`
 * (category `performance`) - the data SpeedHistoryCard.tsx's chart reads.
 *
 * @class       PerformanceScoreSnapshotRecorder class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PerformanceScoreSnapshotRecorder {

	private const CRON_HOOK = 'vulopilot_performance_snapshot_daily';

	/**
	 * PerformanceScoreSnapshotRecorder constructor.
	 */
	public function __construct() {
		add_action( 'vulopilot_scan_completed', array( $this, 'record_today' ), 20 );
		add_action( 'init', array( $this, 'ensure_daily_snapshot_scheduled' ) );
		add_action( self::CRON_HOOK, array( $this, 'record_today' ) );
	}

	/**
	 * @return void
	 */
	public function record_today(): void {
		$findings  = new FindingRepository();
		$breakdown = $findings->get_severity_breakdown_for_category( 'performance' );

		$score = 100
			- ( 15 * log( 1 + $breakdown['critical'] ) )
			- ( 8 * log( 1 + $breakdown['high'] ) )
			- ( 3 * log( 1 + $breakdown['medium'] ) )
			- ( 1 * log( 1 + $breakdown['low'] ) );

		$score = (int) round( max( 0, min( 100, $score ) ) );

		( new ScoreSnapshotRepository( 'performance' ) )->upsert_today( $score );
	}

	/**
	 * Schedules the daily snapshot event if it isn't already scheduled.
	 *
	 * @return void
	 */
	public function ensure_daily_snapshot_scheduled(): void {
		if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
			wp_schedule_event( time(), 'daily', self::CRON_HOOK );
		}
	}
}
