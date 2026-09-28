import type { GeoVisibilityHistoryRow } from './useGeoTabData';

/**
 * What used to be `GeoTrendCompactCard.tsx`'s own real "first vs. latest, out of every historical
 * day with a real score" computation.
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
