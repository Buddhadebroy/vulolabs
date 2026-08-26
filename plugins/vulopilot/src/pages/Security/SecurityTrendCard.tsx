import { __ } from '@wordpress/i18n';
import { CardComponent, ChartComponent, ModuleGuardComponent } from '@zyra/components';
import { useApiList } from '../../services/useApiList';

interface SecurityScoreSnapshot {
	snapshot_date: string;
	security_score: number;
}

/**
 * "Security Trend" — real daily `security_score` snapshots from
 * `GET /security-score-snapshots?days=30`
 * (`classes/Repositories/SecurityScoreSnapshotRepository.php`, written by
 * `Services\SecurityScoreSnapshotRecorder` after every scan plus once
 * daily via cron — the same real weighting `GET /dashboard`'s
 * `category_scores.security` already uses). Not a reuse of
 * `vulopilot_site_health_snapshots.security_score` — that column exists
 * but is only ever written by Pro's AdvancedReports module, so this Free
 * tab needed its own dedicated table, same reasoning Performance's own
 * "Speed History" already established for `performance_score`. Same
 * `useApiList` + `ChartComponent type="area"` pattern SpeedHistoryCard.tsx
 * uses, including its graceful "no trend data yet" empty state for a
 * freshly-installed site or one that hasn't run a scan/waited for the
 * daily cron yet.
 */
const SecurityTrendCard = () => {
	const { data: snapshots, isLoading } = useApiList<SecurityScoreSnapshot>(
		'security-score-snapshots',
		{ days: 30 }
	);

	return (
		<CardComponent title={__('Security Trend', 'vulopilot')} titleIcon="security">
			{!isLoading && snapshots.length === 0 ? (
				<ModuleGuardComponent
					icon="analytics"
					title={__('No trend data yet', 'vulopilot')}
					desc={__(
						'Security trend builds up after your first scan — run a scan, or check back after today.',
						'vulopilot'
					)}
				/>
			) : (
				<ChartComponent
					type="area"
					isLoading={isLoading}
					data={snapshots}
					dataKey="security_score"
					xKey="snapshot_date"
					height={220}
					yDomain={[0, 100]}
				/>
			)}
		</CardComponent>
	);
};

export default SecurityTrendCard;
