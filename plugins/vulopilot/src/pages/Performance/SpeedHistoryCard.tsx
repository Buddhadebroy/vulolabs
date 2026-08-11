import { __ } from '@wordpress/i18n';
import { CardComponent, ChartComponent, ModuleGuardComponent } from '@zyra/components';
import { useApiList } from '../../services/useApiList';

interface PerformanceScoreSnapshot {
	snapshot_date: string;
	performance_score: number;
}

/**
 * "Speed History" — real daily `performance_score` snapshots from
 * `GET /performance-score-snapshots?days=30`
 * (`classes/Repositories/PerformanceScoreSnapshotRepository.php`, written by
 * `Services\PerformanceScoreSnapshotRecorder` after every scan plus once
 * daily via cron). Same `useApiList` + `ChartComponent type="area"` pattern
 * `WebsiteProgressChart.tsx` already established for its own
 * `/site-health-snapshots` trend line, including its graceful "no trend
 * data yet" empty state for a freshly-installed site or one that hasn't
 * run a scan/waited for the daily cron yet.
 */
const SpeedHistoryCard = () => {
	const { data: snapshots, isLoading } = useApiList<PerformanceScoreSnapshot>(
		'performance-score-snapshots',
		{ days: 30 }
	);

	return (
		<CardComponent title={__('Speed History', 'vulopilot')} titleIcon="analytics">
			{!isLoading && snapshots.length === 0 ? (
				<ModuleGuardComponent
					icon="analytics"
					title={__('No trend data yet', 'vulopilot')}
					desc={__(
						'Speed history builds up after your first scan — run a scan, or check back after today.',
						'vulopilot'
					)}
				/>
			) : (
				<ChartComponent
					type="area"
					isLoading={isLoading}
					data={snapshots}
					dataKey="performance_score"
					xKey="snapshot_date"
					height={220}
					yDomain={[0, 100]}
				/>
			)}
		</CardComponent>
	);
};

export default SpeedHistoryCard;
