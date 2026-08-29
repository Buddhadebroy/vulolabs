import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ChartComponent, ModuleGuardComponent } from '@zyra/components';
import { formatWpDate } from '../../services/formatWpDate';
import ProLockedCard from '../../components/ProLockedCard';
import type { GeoVisibilityHistoryRow } from './useGeoVisibilitySnapshot';

interface GeoTrendCompactCardProps {
	history: GeoVisibilityHistoryRow[];
	isLoading: boolean;
	isGeoInsightsActive: boolean;
	/** Overrides so this same real "sparkline + change/checked/best" pattern can render a scoped sub-average trend instead of the sitewide `overall_score` default. All optional; omitting every one of them reproduces GeoTab.tsx's original "Are You Getting Easier to Find?" behavior exactly. */
	title?: string;
	desc?: string;
	moduleName?: string;
	notEnoughHistoryDesc?: string;
	/** Reads whichever score this card should trend from a `GeoVisibilityHistoryRow` — defaults to the sitewide `overall_score`. Returning `null` marks that day as having nothing to average, same meaning as a `null` `overall_score`. Also exported standalone below as `computeTrendChange()`'s own `getScore` param, for callers that need just the real numbers (no chart) — AeoTab.tsx's own "Content Change" stat row uses that instead of this whole component now. */
	getScore?: (row: GeoVisibilityHistoryRow) => number | null;
}

const defaultGetScore = (row: GeoVisibilityHistoryRow): number | null => row.overall_score;

export interface TrendChange {
	first: number;
	latest: number;
	change: number;
	best: number;
	bestDate: string;
	checkedCount: number;
	/** Every real sampled day with a score, in order — this component's own sparkline plots this directly rather than re-filtering `history` a second time. */
	series: { date: string; score: number }[];
}

/**
 * The same real "first vs. latest, out of every historical day with a real
 * score" computation this component's own sparkline+stats body uses,
 * extracted so a caller that only needs the plain numbers — no chart, no
 * card — doesn't have to duplicate it. AeoTab.tsx's own "AEO Score" summary
 * card (AeoScoreSummaryCard.tsx) uses this for its "Content Change" stat
 * row. Returns `null` when there isn't at least 2 real sampled days to
 * compare — same "not enough history yet" threshold this component's own
 * `ModuleGuardComponent` state below already uses.
 */
export const computeTrendChange = (
	history: GeoVisibilityHistoryRow[],
	getScore: (row: GeoVisibilityHistoryRow) => number | null = defaultGetScore
): TrendChange | null => {
	const withScore = history
		.map((row) => ({ row, score: getScore(row) }))
		.filter((entry): entry is { row: GeoVisibilityHistoryRow; score: number } => null !== entry.score);

	if (withScore.length < 2) {
		return null;
	}

	const first = withScore[0];
	const latest = withScore[withScore.length - 1];
	const best = withScore.reduce(
		(bestEntry, entry) => (entry.score > bestEntry.score ? entry : bestEntry),
		withScore[0]
	);

	return {
		first: first.score,
		latest: latest.score,
		change: latest.score - first.score,
		best: best.score,
		bestDate: best.row.snapshot_date,
		checkedCount: withScore.length,
		series: withScore.map((entry) => ({
			date: entry.row.snapshot_date,
			score: entry.score,
		})),
	};
};

/**
 * "Are You Getting Easier to Find?" — a compact read of the same real
 * `history` GeoTab.tsx fetches once via useGeoVisibilitySnapshot.ts (not
 * re-fetched here): "Change" is the first vs. most-recent real score,
 * "Checked N times" is a real count of how many days this site has ever
 * been sampled, and "Best so far" is the real highest score recorded plus
 * the real date it happened on — nothing here is a forecast or an invented
 * trend line, only what GeoInsights\VisibilitySnapshotBuilder has actually
 * recorded (see `computeTrendChange()` above, which this component's own
 * body calls). Which score, exactly, is `getScore` (default: the sitewide
 * `overall_score`) — see that prop's own docblock above.
 *
 * No longer rendered anywhere as of GeoVisibilitySummaryCard.tsx's own
 * "Overall AI Visibility" merge (direct instruction: "merge this sections
 * and design like attached image") — that card's own real trend readout
 * (same `computeTrendChange()` numbers, condensed into text instead of this
 * component's sparkline) replaced it on GeoTab.tsx. This component itself
 * is left in place — still real, valid code, same "kept as dead code
 * rather than deleted" precedent GeoFixTheseFirstCard.tsx/TopPagesCard.tsx
 * already established on this tab — while `computeTrendChange()`/
 * `TrendChange` below stay in active use by both
 * GeoVisibilitySummaryCard.tsx and AeoScoreSummaryCard.tsx.
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
			<CardComponent title={title} titleIcon="analytics" desc={desc}>
				<ProLockedCard moduleName={moduleName} />
			</CardComponent>
		);
	}

	const trend = computeTrendChange(history, getScore);

	if (!isLoading && !trend) {
		return (
			<CardComponent title={title} titleIcon="analytics" desc={desc} isLoading={isLoading}>
				<ModuleGuardComponent
					icon="analytics"
					title={__('Not enough history yet', 'vulopilot')}
					desc={notEnoughHistoryDesc}
				/>
			</CardComponent>
		);
	}

	return (
		<CardComponent title={title} titleIcon="analytics" desc={desc} isLoading={isLoading}>
			{!isLoading && trend && (
				<>
					<div className="geo-trend-sparkline">
						<ChartComponent
							type="area"
							sparkline
							height={70}
							color={trend.change >= 0 ? '#16a34a' : '#dc2626'}
							data={trend.series.map((entry) => ({
								label: entry.date,
								value: entry.score,
							}))}
						/>
					</div>
					<div className="geo-trend-stats">
						<div className="geo-trend-stat">
							<span
								className={`geo-trend-stat-value ${trend.change >= 0 ? 'is-good' : 'is-attention'}`}
							>
								{trend.first} → {trend.latest}
							</span>
							<span className="geo-trend-stat-label">
								{sprintf(
									/* translators: %s is the signed point change, e.g. "+9 points". */
									__('Change (%s)', 'vulopilot'),
									`${trend.change >= 0 ? '+' : ''}${trend.change} ${__('points', 'vulopilot')}`
								)}
							</span>
						</div>
						<div className="geo-trend-stat">
							<span className="geo-trend-stat-value">
								{trend.checkedCount}
							</span>
							<span className="geo-trend-stat-label">
								{__('Checked', 'vulopilot')}
							</span>
						</div>
						<div className="geo-trend-stat">
							<span className="geo-trend-stat-value">
								{trend.best}/100
							</span>
							<span className="geo-trend-stat-label">
								{sprintf(
									/* translators: %s is the date the best score was recorded. */
									__('Best so far (%s)', 'vulopilot'),
									formatWpDate(trend.bestDate)
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
