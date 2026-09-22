/* global appLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';
import { nonceHeaders } from './seoIssuesShared';

/**
 * SeoTab.tsx's own 2 data-fetching hooks (`useSeoScore`/`useSeoProgress`) -
 * both single-consumer, both a plain `GET .../then(setState)` effect, so
 * kept in one file rather than two.
 */

export interface SeoCategoryScore {
	score: number;
	open_count: number;
	affected_pages: number;
	/** Real per-category N-day score trend, oldest first (Seo.php's own `get_category_trend()`) - feeds this category's own `MetricTileComponent` sparkline. */
	trend: number[];
}

export interface SeoScoreResponse {
	seo_score: number;
	/** Real published post+page count - the same real scope SeoScanner itself scans. */
	pages_checked: number;
	category_scores: {
		'titles-meta': SeoCategoryScore;
		'content-structure': SeoCategoryScore;
		images: SeoCategoryScore;
		'internal-linking': SeoCategoryScore;
		'indexability-canonicals': SeoCategoryScore;
		'structured-data': SeoCategoryScore;
	};
	severity_breakdown: {
		critical: number;
		high: number;
		medium: number;
		low: number;
	};
	total_open: number;
	/** Real exact reconstruction (`FindingRepository::..._as_of()`, no stored snapshot needed) of the same totals `lookback_days` ago - positive means more open findings now than then. */
	deltas: {
		lookback_days: number;
		total_open: number;
		critical: number;
		high: number;
	};
}

/**
 * `GET /seo/score` - Seo.php's own real, deterministic weighted-severity
 * score (same formula BrandIntelligence's own Brand Score uses), scoped to
 * SeoTab.tsx's own 15 real SEO scanner ids (on-page SEO only - `sitemap`/
 * `robots` moved to Crawler Traffic, see Seo.php's own docblock). No AI
 * call, no cost.
 */
export const useSeoScore = (): {
	score: SeoScoreResponse | null;
	isLoading: boolean;
} => {
	const [score, setScore] = useState<SeoScoreResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<SeoScoreResponse>(getApiLink(appLocalizer, 'seo/score'), {
			headers: { 'X-WP-Nonce': appLocalizer.nonce },
		})
			.then((response) => {
				if (response) {
					setScore(response);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	return { score, isLoading };
};

interface WeekStat {
	this_week: number;
	delta: number;
}

export interface SeoProgressResponse {
	trend: { date: string; score: number }[];
	issues_fixed: WeekStat;
	new_issues: WeekStat;
	pages_improved: WeekStat;
}

/**
 * `GET /seo/progress` (Seo.php) - real week-over-week counters
 * (`count_resolved_between()`/`get_stats_for_period()`, both already
 * existing repository methods; "Pages Improved" reuses "Pages that need
 * attention"'s own `get_open_findings_for_scanner_ids_by_post()` helper to
 * compare real per-page scores now vs a week ago) plus a real 7-day score
 * trend (one real reconstructed score per day, same `..._as_of()` technique
 * `useSeoScore()`'s own single 7-day delta already uses).
 *
 * Extracted from what used to be `SeoProgressCard.tsx`'s own standalone
 * component - its 4 real stat tiles (Latest score/Issues Fixed/New Issues/
 * Pages Improved) are folded directly into SeoTab.tsx's own "SEO Health
 * Score" tile row now (merged per direct instruction), so this hook is the
 * one thing SeoTab.tsx actually still needs from that fetch - same
 * `useSeoScore()`-shaped `{ data, isLoading }` return, no separate
 * `hasError` state (same convention that hook already keeps: a failed fetch
 * just leaves `data` `null`, and the caller's own `data &&` guard already
 * covers "nothing to show yet" either way).
 */
export const useSeoProgress = (): {
	data: SeoProgressResponse | null;
	isLoading: boolean;
} => {
	const [data, setData] = useState<SeoProgressResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		getApiResponse<SeoProgressResponse>(
			getApiLink(appLocalizer, 'seo/progress'),
			nonceHeaders
		)
			.then((response) => {
				if (!cancelled && response) {
					setData(response);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return { data, isLoading };
};
