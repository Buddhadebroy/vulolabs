/* global appLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';

export interface AeoPageRow {
	post_id: number;
	title: string;
	edit_link: string;
	permalink: string;
	open_findings: number;
	visibility_score: number | null;
}

interface AeoPageAnalysisResponse {
	data: AeoPageRow[];
	total: number;
}

/**
 * One real, unpaginated `GET /geo-analysis/pages?scanner_ids=<5 AEO scanner
 * ids>&per_page=1000` fetch (Controllers\GeoAnalysis::get_pages(), scoped
 * by its own `scanner_ids` param — see that controller's own docblock;
 * 1000 is that same endpoint's own `MAX_PAGES_QUERY` bound, comfortably
 * above a single site's real published-content count) — AeoTab.tsx's own
 * "Pages Ready"/"Questions Answered" stat tiles derive real counts from
 * this full real dataset instead of guessing from whatever page
 * GeoPageAnalysisTable.tsx's own independent, paginated copy of the same
 * endpoint happens to be showing. Deliberately a second real request
 * rather than lifting state out of that table — the two components render
 * in different parts of the tab and don't otherwise share a parent that
 * would make prop-drilling this cleaner than one more real GET.
 */
export const useAeoPageAnalysis = (
	scannerIds: string[]
): {
	pages: AeoPageRow[];
	total: number;
	isLoading: boolean;
} => {
	const [pages, setPages] = useState<AeoPageRow[]>([]);
	const [total, setTotal] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const scannerIdsKey = scannerIds.join(',');

	useEffect(() => {
		getApiResponse<AeoPageAnalysisResponse>(
			getApiLink(
				appLocalizer,
				`geo-analysis/pages?scanner_ids=${encodeURIComponent(scannerIdsKey)}&per_page=1000`
			),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setPages(response.data ?? []);
					setTotal(response.total ?? 0);
				}
			})
			.finally(() => setIsLoading(false));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [scannerIdsKey]);

	return { pages, total, isLoading };
};
