/* global vulopilotAppLocalizer */
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
 * One unpaginated `GET /geo-analysis/pages` fetch scoped to the AEO scanner ids.
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
				vulopilotAppLocalizer,
				`geo-analysis/pages?scanner_ids=${encodeURIComponent(scannerIdsKey)}&per_page=1000`
			),
			{ headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } }
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
