/* global vulopilotAppLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';

export interface VisibilityArea {
	label: string;
	score: number;
	previous_score: number;
	change: number;
}

export interface VisibilityScoreResponse {
	visibility_score: number;
	previous_visibility_score: number;
	change: number;
	lookback_days: number;
	areas: {
		brand: VisibilityArea;
		seo: VisibilityArea;
		geo: VisibilityArea;
		crawl: VisibilityArea;
	};
	/** Real AI-lab breakdown, same `by_vendor` field `/crawler-traffic/analytics` itself returns. */
	crawler_by_vendor: Record<string, number>;
}

/**
 * `GET /visibility/score` - Visibility.php's own real combined score across the 4 real free-tier
 * areas (Brand/SEO/GEO/Crawl & URLs).
 */
export const useVisibilityScore = (): {
	score: VisibilityScoreResponse | null;
	isLoading: boolean;
} => {
	const [score, setScore] = useState<VisibilityScoreResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<VisibilityScoreResponse>(
			getApiLink(vulopilotAppLocalizer, 'visibility/score'),
			{ headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setScore(response);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	return { score, isLoading };
};
