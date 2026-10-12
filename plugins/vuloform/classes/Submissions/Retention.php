<?php
/**
 * Retention class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Submissions;

use VuloForm\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Deletes submissions older than the retention period, with their files.
 */
class Retention {

	/**
	 * Daily cron hook.
	 */
	const HOOK = 'vuloform_prune_submissions';

	/**
	 * @var SubmissionRepository
	 */
	private $submissions;

	/**
	 * @param SubmissionRepository $submissions Submission storage.
	 */
	public function __construct( SubmissionRepository $submissions ) {
		$this->submissions = $submissions;

		add_action( self::HOOK, array( $this, 'prune' ) );

		if ( ! wp_next_scheduled( self::HOOK ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', self::HOOK );
		}
	}

	/**
	 * Removes expired submissions in batches, so one run can't time out on a large backlog.
	 *
	 * @return void
	 */
	public function prune() {
		$days = (int) Utill::settings()['retention_days'];

		if ( $days <= 0 ) {
			return;
		}

		$before = gmdate( 'Y-m-d H:i:s', time() - $days * DAY_IN_SECONDS );

		for ( $batch = 0; $batch < 10; $batch++ ) {
			$ids = $this->submissions->ids_where( 'created_before', $before, 200 );

			if ( ! $ids ) {
				return;
			}

			$this->submissions->delete( $ids );
		}
	}
}
