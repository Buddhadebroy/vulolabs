import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ChartComponent, ModuleGuardComponent } from '@zyra/components';
import { formatWpDate } from '../../services/formatWpDate';
import ProLockedCard from '../../components/ProLockedCard';
import type { GeoVisibilityHistoryRow } from './useGeoVisibilitySnapshot';

interface GeoTrendCompactCardProps {
	history: GeoVisibilityHistoryRow[];
	isLoading: boolean;
	isGeoInsightsActive: boolean;
	/** Overrides so this same real "sparkline + change/checked/best" pattern can render a scoped sub-average trend instead of the sitewide `overall_score` default — AeoTab.tsx's own "AEO Score Over Time" reuses this component this way rather than a second, near-duplicate one. All optional; omitting every one of them reproduces GeoTab.tsx's original "Are You Getting Easier to Find?" behavior exactly. */
	title?: string;
	desc?: string;
	moduleName?: string;
	notEnoughHistoryDesc?: string;
	/** Reads whichever score this card should trend from a `GeoVisibilityHistoryRow` — defaults to the sitewide `overall_score`. Returning `null` marks that day as having nothing to average, same meaning as a `null` `overall_score`. */
	getScore?: (row: GeoVisibilityHistoryRow) => number | null;
}

const defaultGetScore = (row: GeoVisibilityHistoryRow): number | null => row.overall_score;

/**
 * "Are You Getting Easier to Find?" — a compact read of the same real
 * `history` GeoVisibilityOverviewRow.tsx already uses (fetched once by
 * GeoTab.tsx via useGeoVisibilitySnapshot.ts, not re-fetched here):
 * "Change" is the first vs. most-recent real score, "Checked N times" is a
 * real count of how many days this site has ever been sampled, and "Best
 * so far" is the real highest score recorded plus the real date it
 * happened on — nothing here is a forecast or an invented trend line, only
 * what GeoInsights\VisibilitySnapshotBuilder has actually recorded. Which
 * score, exactly, is `getScore` (default: the sitewide `overall_score`) —
 * see that prop's own docblock above.
 */
const GeoTrendCompactCard = ({
	history,
	isLoading,
	isGeoInsightsActive,
	title = __('Are You Getting Easier to Find?', 'vulopilot'),
	desc = __(
		'Your score over the last 30 days — going up means AI is finding you more.',
		'vulopilot'
	),
	moduleName = 'geo-insights',
	notEnoughHistoryDesc = __(
		'This builds up automatically each time your snapshot schedule runs. Check back after a couple of cycles to see a trend.',
		'vulopilot'
	),
	getScore = defaultGetScore,
}: GeoTrendCompactCardProps) => {
	if (!isGeoInsightsActive) {
		return (
			<CardComponent title={title}>
				<ProLockedCard moduleName={moduleName} />
			</CardComponent>
		);
	}

	const withScore = history
		.map((row) => ({ row, score: getScore(row) }))
		.filter((entry): entry is { row: GeoVisibilityHistoryRow; score: number } => null !== entry.score);

	if (!isLoading && withScore.length < 2) {
		return (
			<CardComponent title={title} isLoading={isLoading}>
				<ModuleGuardComponent
					icon="analytics"
					title={__('Not enough history yet', 'vulopilot')}
					desc={notEnoughHistoryDesc}
				/>
			</CardComponent>
		);
	}

	const first = withScore[0];
	const latest = withScore[withScore.length - 1];
	const change = isLoading ? 0 : latest.score - first.score;

	const best = withScore.reduce(
		(bestEntry, entry) => (entry.score > bestEntry.score ? entry : bestEntry),
		withScore[0]
	);

	return (
		<CardComponent title={title} desc={desc} isLoading={isLoading}>
			{!isLoading && (
				<>
					<div className="geo-trend-sparkline">
						<ChartComponent
							type="area"
							sparkline
							height={70}
							color={change >= 0 ? '#16a34a' : '#dc2626'}
							data={withScore.map((entry) => ({
								label: entry.row.snapshot_date,
								value: entry.score,
							}))}
						/>
					</div>
					<div className="geo-trend-stats">
						<div className="geo-trend-stat">
							<span
								className={`geo-trend-stat-value ${change >= 0 ? 'is-good' : 'is-attention'}`}
							>
								{first.score} → {latest.score}
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
								{best.score}/100
							</span>
							<span className="geo-trend-stat-label">
								{sprintf(
									/* translators: %s is the date the best score was recorded. */
									__('Best so far (%s)', 'vulopilot'),
									formatWpDate(best.row.snapshot_date)
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
