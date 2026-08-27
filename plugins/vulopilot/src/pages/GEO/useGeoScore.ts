/* global appLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';

export interface GeoSignalScore {
	score: number | null;
	open_count: number | null;
	affected_pages: number;
	main_problem: string | null;
}

export interface GeoScoreResponse {
	geo_score: number;
	/** Real published post+page count — the same real scope every GEO scanner itself scans. */
	pages_checked: number;
	signals: {
		'ai-summary': GeoSignalScore;
		'question-coverage': GeoSignalScore;
		'evidence-citations': GeoSignalScore;
		'ai-readable-structure': GeoSignalScore;
		'entity-clarity': GeoSignalScore;
		'content-freshness': GeoSignalScore;
		'other-geo-signals': GeoSignalScore;
	};
	/** Real exact reconstruction (`FindingRepository::..._as_of()`, no stored snapshot needed) of the same total `lookback_days` ago. */
	deltas: {
		lookback_days: number;
		total_open: number;
	};
}

/**
 * `GET /geo/score` — Geo.php's own real, deterministic GEO Score (same
 * weighted-severity formula `useSeoScore.ts`'s own `/seo/score` uses for 6
 * of the 7 signals, plus a real sitewide Content Freshness computed
 * straight from `post_modified_gmt` — see Geo.php's own docblock). No AI
 * call, no cost, works identically whether vulopilot-pro is active or not.
 */
export const useGeoScore = (): {
	score: GeoScoreResponse | null;
	isLoading: boolean;
} => {
	const [score, setScore] = useState<GeoScoreResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<GeoScoreResponse>(getApiLink(appLocalizer, 'geo/score'), {
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
