/* global vulopilotAppLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';

export interface CrawlerRow {
	bot_name: string;
	total: number;
	previous_total: number;
	/** Real `MAX(created_at)` for this bot (CrawlerVisitRepository::get_bot_last_seen(), merged into this same row server-side). */
	last_seen_at: string | null;
}

export interface CrawledPageRow {
	requested_url: string;
	total: number;
	previous_total: number;
}

export interface CrawlerAnalytics {
	current_total: number;
	previous_total: number;
	current_unique_bots: number;
	previous_unique_bots: number;
	top_crawlers: CrawlerRow[];
	most_crawled_pages: CrawledPageRow[];
	by_vendor: Record<string, number>;
	blocked_pages_total: number;
	daily_volume: { date: string; total: number }[];
	/** Real weighted-severity score (0-100, CrawlerTraffic.php's own `calculate_score()`) over the same 4 real scanner ids the Crawl Health Checklist below already groups into. */
	crawl_health_score: number;
}

const nonceHeaders = { headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } };

/**
 * Shared `GET /crawler-traffic/analytics` fetch - real current-vs-previous period comparison
 * (CrawlerTraffic.php's own `get_analytics()`).
 */
export const useCrawlerAnalytics = (
	days = 30
): { analytics: CrawlerAnalytics | null; isLoading: boolean } => {
	const [analytics, setAnalytics] = useState<CrawlerAnalytics | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<CrawlerAnalytics>(
			getApiLink(vulopilotAppLocalizer, `crawler-traffic/analytics?days=${days}`),
			nonceHeaders
		)
			.then((response) => {
				if (response) {
					setAnalytics(response);
				}
			})
			.finally(() => setIsLoading(false));
	}, [days]);

	return { analytics, isLoading };
};
