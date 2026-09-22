import { __ } from '@wordpress/i18n';
import { ChartComponent, ModuleGuardComponent } from '@zyra/components';
import { useApiList } from '../../services/useApiList';
import { formatWpDate } from '../../services/formatWpDate';

interface PerformanceScoreSnapshot {
	snapshot_date: string;
	performance_score: number;
}

/**
 * "Speed History" - real daily `performance_score` snapshots from
 * `GET /performance-score-snapshots?days=N`
 * (`classes/Repositories/PerformanceScoreSnapshotRepository.php`, written by
 * `Services\PerformanceScoreSnapshotRecorder` after every scan plus once
 * daily via cron). Same `useApiList` + `ChartComponent type="area"` pattern
 * `WebsiteProgressChart.tsx` already established for its own
 * `/site-health-snapshots` trend line, including its graceful "no trend
 * data yet" empty state for a freshly-installed site or one that hasn't
 * run a scan/waited for the daily cron yet.
 *
 * `days` is owned by the parent "Core Web Vitals" card's own real 7/30/90
 * period toggle (PerformanceScoreCard.tsx) rather than a fixed 30, same
 * `PERIOD_OPTIONS`/`ToggleInput` shape SecurityTrendCard.tsx's own card
 * action already uses.
 */
interface SpeedHistoryCardProps {
	/** Real 7/30/90 range, controlled by the parent "Core Web Vitals" card's own period toggle (PerformanceScoreCard.tsx) - defaults to 30 for any other caller that doesn't pass one. */
	days?: number;
}

const SpeedHistoryCard = ({ days = 30 }: SpeedHistoryCardProps) => {
	const { data: snapshots, isLoading } = useApiList<PerformanceScoreSnapshot>(
		'performance-score-snapshots',
		{ days }
	);

	return (
		<>
			{!isLoading && snapshots.length === 0 ? (
				<ModuleGuardComponent
					icon="analytics"
					title={__('No trend data yet', 'vulopilot')}
					desc={__(
						'Speed history builds up after your first scan - run a scan, or check back after today.',
						'vulopilot'
					)}
				/>
			) : (
				<ChartComponent
					type="dynamic-line"
					isLoading={isLoading}
					data={snapshots.map((snapshot) => ({
						...snapshot,
						snapshot_date: formatWpDate(snapshot.snapshot_date),
					}))}
					dataKey="performance_score"
					xKey="snapshot_date"
					height={220}
					yDomain={[0, 100]}
				/>
			)}
		</>
	);
};

export default SpeedHistoryCard;
