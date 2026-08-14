/* global appLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';

export interface SeoScoreResponse {
	seo_score: number;
	category_scores: {
		'titles-meta': number;
		images: number;
		'links-schema': number;
		sitemap: number;
		robots: number;
	};
	severity_breakdown: {
		critical: number;
		high: number;
		medium: number;
		low: number;
	};
	total_open: number;
}

/**
 * `GET /seo/score` — Seo.php's own real, deterministic weighted-severity
 * score (same formula BrandIntelligence's own Brand Score uses), scoped to
 * SeoTab.tsx's own 17 real SEO scanner ids. No AI call, no cost.
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
