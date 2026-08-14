import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ChartComponent, ModuleGuardComponent } from '@zyra/components';
import { formatWpDate } from '../../services/formatWpDate';
import ProLockedCard from '../../components/ProLockedCard';
import type { GeoVisibilityHistoryRow } from './useGeoVisibilitySnapshot';

interface GeoTrendCompactCardProps {
	history: GeoVisibilityHistoryRow[];
	isLoading: boolean;
	isGeoInsightsActive: boolean;
}

/**
 * "Are You Getting Easier to Find?" — a compact read of the same real
 * `history` GeoVisibilityOverviewRow.tsx already uses (fetched once by
 * GeoTab.tsx via useGeoVisibilitySnapshot.ts, not re-fetched here):
 * "Change" is the first vs. most-recent real `overall_score`, "Checked N
 * times" is a real count of how many days this site has ever been
 * sampled, and "Best so far" is the real highest `overall_score` recorded
 * plus the real date it happened on — nothing here is a forecast or an
 * invented trend line, only what GeoInsights\VisibilitySnapshotBuilder has
 * actually recorded.
 */
const GeoTrendCompactCard = ({
	history,
	isLoading,
	isGeoInsightsActive,
}: GeoTrendCompactCardProps) => {
	if (!isGeoInsightsActive) {
		return (
			<CardComponent title={__('Are You Getting Easier to Find?', 'vulopilot')}>
				<ProLockedCard moduleName="geo-insights" />
			</CardComponent>
		);
	}

	const withScore = history.filter((row) => null !== row.overall_score);

	if (!isLoading && withScore.length < 2) {
		return (
			<CardComponent
				title={__('Are You Getting Easier to Find?', 'vulopilot')}
				isLoading={isLoading}
			>
				<ModuleGuardComponent
					icon="analytics"
					title={__('Not enough history yet', 'vulopilot')}
					desc={__(
						'This builds up automatically each time your snapshot schedule runs. Check back after a couple of cycles to see a trend.',
						'vulopilot'
					)}
				/>
			</CardComponent>
		);
	}

	const first = withScore[0];
	const latest = withScore[withScore.length - 1];
	const change = isLoading
		? 0
		: (latest.overall_score as number) - (first.overall_score as number);

	const best = withScore.reduce(
		(bestRow, row) =>
			(row.overall_score as number) > (bestRow.overall_score as number)
				? row
				: bestRow,
		withScore[0]
	);

	return (
		<CardComponent
			title={__('Are You Getting Easier to Find?', 'vulopilot')}
			desc={__(
				'Your score over the last 30 days — going up means AI is finding you more.',
				'vulopilot'
			)}
			isLoading={isLoading}
		>
			{!isLoading && (
				<>
					<div className="geo-trend-sparkline">
						<ChartComponent
							type="area"
							sparkline
							height={70}
							color={change >= 0 ? '#16a34a' : '#dc2626'}
							data={withScore.map((row) => ({
								label: row.snapshot_date,
								value: row.overall_score ?? 0,
							}))}
						/>
					</div>
					<div className="geo-trend-stats">
						<div className="geo-trend-stat">
							<span
								className={`geo-trend-stat-value ${change >= 0 ? 'is-good' : 'is-attention'}`}
							>
								{first.overall_score} → {latest.overall_score}
							</span>
							<span className="geo-trend-stat-label">
								{sprintf(
									/* translators: %s is the signed point change, e.g. "+9 points". */
									__('Change (%s)', 'vulopilot'),
									`${change >= 0 ? '+' : ''}${change} ${__('points', 'vulopilot')}`
								)}
							</span>
						</div>
						<div className="geo-trend-stat">
							<span className="geo-trend-stat-value">
								{withScore.length}
							</span>
							<span className="geo-trend-stat-label">
								{__('Checked', 'vulopilot')}
							</span>
						</div>
						<div className="geo-trend-stat">
							<span className="geo-trend-stat-value">
								{best.overall_score}/100
							</span>
							<span className="geo-trend-stat-label">
								{sprintf(
									/* translators: %s is the date the best score was recorded. */
									__('Best so far (%s)', 'vulopilot'),
									formatWpDate(best.snapshot_date)
								)}
							</span>
						</div>
					</div>
				</>
			)}
		</CardComponent>
	);
};

export default GeoTrendCompactCard;
