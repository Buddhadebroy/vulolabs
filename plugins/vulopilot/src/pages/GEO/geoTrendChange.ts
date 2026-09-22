import type { GeoVisibilityHistoryRow } from './useGeoTabData';

/**
 * What used to be `GeoTrendCompactCard.tsx`'s own real "first vs. latest,
 * out of every historical day with a real score" computation - that
 * component's own sparkline+stats body was the only renderer of it, and
 * itself stopped being rendered anywhere once GeoTab.tsx's "Are You
 * Getting Easier to Find?" merged into `GeoVisibilitySummaryCard.tsx`'s
 * own "Overall AI Visibility" card (direct instruction: "merge this
 * sections and design like attached image") - that card's own real trend
 * readout (same numbers, condensed into text) replaced it. The component
 * itself (JSX, `CardComponent`/`ChartComponent`/`ModuleGuardComponent`/
 * `ProLockedCard`) is gone (confirmed unreferenced), but this pure
 * computation stayed real, active code - `AeoScoreSummaryCard.tsx`'s own
 * "Content Change" stat row still calls it - so it's kept here as a plain
 * `.ts` utility rather than a `.tsx` component file with no component left
 * in it.
 */

const defaultGetScore = (row: GeoVisibilityHistoryRow): number | null => row.overall_score;

export interface TrendChange {
	first: number;
	latest: number;
	change: number;
	best: number;
	bestDate: string;
	checkedCount: number;
	/** Every real sampled day with a score, in order. */
	series: { date: string; score: number }[];
}

/**
 * Returns `null` when there isn't at least 2 real sampled days to compare.
 * `getScore` defaults to the sitewide `overall_score`; a caller passing its
 * own reads a scoped sub-average trend instead (e.g. AeoTab.tsx's "AEO
 * Score Over Time").
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
