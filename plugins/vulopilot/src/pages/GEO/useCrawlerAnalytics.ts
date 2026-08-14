/* global appLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';

export interface CrawlerRow {
	bot_name: string;
	total: number;
	previous_total: number;
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
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * Shared `GET /crawler-traffic/analytics` fetch — real current-vs-previous
 * period comparison (CrawlerTraffic.php's own `get_analytics()`), reused by
 * every restyled Crawler Traffic tab card (stat row, trend chart, vendor
 * breakdown, Top Crawlers, Most Crawled Pages) so the tab makes one real
 * request instead of each card fetching its own copy.
 */
export const useCrawlerAnalytics = (
	days = 30
): { analytics: CrawlerAnalytics | null; isLoading: boolean } => {
	const [analytics, setAnalytics] = useState<CrawlerAnalytics | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<CrawlerAnalytics>(
			getApiLink(appLocalizer, `crawler-traffic/analytics?days=${days}`),
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
