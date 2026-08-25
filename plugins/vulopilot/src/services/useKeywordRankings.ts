/* global appLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

export interface KeywordStat {
	value: number | null;
	previous: number | null;
}

export interface EstimatedTrafficStat extends KeywordStat {
	/** Real GA4 sessions when a GA4 property is connected, real Search Console clicks otherwise — see Controllers\KeywordRankings::get_summary()'s own docblock. Never fabricated either way. */
	source: 'analytics' | 'search_console';
}

export interface KeywordRankingsSummary {
	connected: boolean;
	has_client_credentials: boolean;
	search_console_site: string;
	/** Whether at least one real sync has ever completed — false means every stat below is empty, not that data failed to load. */
	synced: boolean;
	last_synced_at: string | null;
	stats: {
		total_keywords: KeywordStat;
		top_3: KeywordStat;
		top_10: KeywordStat;
		avg_position: KeywordStat;
		estimated_traffic: EstimatedTrafficStat;
		impressions: KeywordStat;
	} | null;
	position_distribution: {
		label: string;
		min: number;
		max: number | null;
		count: number;
	}[];
	trend: {
		dates: string[];
		total_keywords: number[];
		top_3: number[];
		top_10: number[];
		avg_position: (number | null)[];
		estimated_traffic: number[];
		impressions: number[];
	};
}

export interface KeywordOpportunityRow {
	query: string;
	page: string;
	position: number;
	impressions: number;
	clicks: number;
}

export interface KeywordGroupRow {
	page: string;
	keyword_count: number;
	total_clicks: number;
	total_impressions: number;
	avg_position: number;
}

/**
 * Fetches SEO & Visibility → Keywords' real dashboard data — the summary
 * (stat cards/position distribution/sparklines), Top Opportunities, and
 * Keyword Groups, all real reads of `vulopilot_keyword_rankings` snapshots
 * (Controllers\KeywordRankings). The main Ranking Keywords table itself is
 * NOT fetched here — it's a real paginated/searchable/sortable list, so
 * KeywordsTab.tsx wires it through `useApiList('keyword-rankings', ...)`
 * instead, the same shared list-fetching hook every other TableCard in
 * this codebase already uses (see RedirectsSection.tsx).
 *
 * Opportunities/groups are only fetched once `summary.synced` is true —
 * both real endpoints return an empty real result before any sync has
 * run, so there's nothing to gain from firing them early, same "don't
 * fetch what can't have real data yet" posture KeywordsTab.tsx's own
 * gsc_sites fetch already follows.
 */
export const useKeywordRankings = () => {
	const [summary, setSummary] = useState<KeywordRankingsSummary | null>(null);
	const [opportunities, setOpportunities] = useState<KeywordOpportunityRow[] | null>(null);
	const [groups, setGroups] = useState<KeywordGroupRow[] | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSyncing, setIsSyncing] = useState(false);
	const [reloadToken, setReloadToken] = useState(0);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);

		getApiResponse<KeywordRankingsSummary>(
			getApiLink(appLocalizer, 'keyword-rankings/summary'),
			nonceHeaders
		)
			.then((response) => {
				if (cancelled) {
					return;
				}

				setSummary(response ?? null);

				if (!response?.synced) {
					setOpportunities([]);
					setGroups([]);
					return;
				}

				getApiResponse<KeywordOpportunityRow[]>(
					getApiLink(appLocalizer, 'keyword-rankings/opportunities'),
					nonceHeaders
				).then((rows) => !cancelled && setOpportunities(rows ?? []));

				getApiResponse<KeywordGroupRow[]>(
					getApiLink(appLocalizer, 'keyword-rankings/groups'),
					nonceHeaders
				).then((rows) => !cancelled && setGroups(rows ?? []));
			})
			.finally(() => !cancelled && setIsLoading(false));

		return () => {
			cancelled = true;
		};
	}, [reloadToken]);

	const refetch = () => setReloadToken((n) => n + 1);

	const sync = (): Promise<KeywordRankingsSummary | null> => {
		setIsSyncing(true);

		return sendApiResponse<KeywordRankingsSummary>(
			appLocalizer,
			getApiLink(appLocalizer, 'keyword-rankings/sync'),
			{}
		)
			.then((response) => {
				if (response) {
					refetch();
				}
				return response ?? null;
			})
			.finally(() => setIsSyncing(false));
	};

	return {
		summary,
		opportunities,
		groups,
		isLoading,
		isSyncing,
		sync,
		refetch,
	};
};
