/* global appLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';
import { nonceHeaders } from './seoIssuesShared';

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
 * `GET /seo/progress` (Seo.php) — real week-over-week counters
 * (`count_resolved_between()`/`get_stats_for_period()`, both already
 * existing repository methods; "Pages Improved" reuses "Pages that need
 * attention"'s own `get_open_findings_for_scanner_ids_by_post()` helper to
 * compare real per-page scores now vs a week ago) plus a real 7-day score
 * trend (one real reconstructed score per day, same `..._as_of()` technique
 * `useSeoScore()`'s own single 7-day delta already uses).
 *
 * Extracted from what used to be `SeoProgressCard.tsx`'s own standalone
 * component — its 4 real stat tiles (Latest score/Issues Fixed/New Issues/
 * Pages Improved) are folded directly into SeoTab.tsx's own "SEO Health
 * Score" tile row now (merged per direct instruction), so this hook is the
 * one thing SeoTab.tsx actually still needs from that fetch — same
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
