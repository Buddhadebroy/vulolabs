/* global appLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';

interface ScanRow {
	finished_at: string | null;
}

/**
 * The real most recent *completed* scan run's own `finished_at`
 * (`vulopilot_scans`, `GET /scans`) for one scanner group — or, when both
 * `scannerIds` and `categories` are omitted, the single most recent
 * completed run of any scanner site-wide. `null` while loading or when
 * nothing has ever completed for this scope (never a fabricated date).
 *
 * @param scannerIds Real scanner ids to scope to, or omit for site-wide.
 * @param categories Real category ids to scope to (e.g. `['security']`) —
 *                    resolved to their own real scanner ids server-side
 *                    (`Controllers\Scans::get_items()`'s own `category`
 *                    param, the same `ScannerRegistry::get_scanners_by_category()`
 *                    mapping `POST /scans`' own `category` param already
 *                    uses to decide what to run) — lets a category page's
 *                    own header ask by the same category it scans by,
 *                    rather than every caller having to know and hardcode
 *                    that category's own raw scanner ids. Merges with
 *                    `scannerIds` when both are given.
 */
export const useLastScanTime = (
	scannerIds?: string[],
	categories?: string[]
): { lastScanAt: string | null; isLoading: boolean } => {
	const [lastScanAt, setLastScanAt] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const scannerIdKey = scannerIds?.join(',') ?? '';
	const categoryKey = categories?.join(',') ?? '';

	useEffect(() => {
		setIsLoading(true);

		let url =
			getApiLink(appLocalizer, 'scans') +
			'?status=completed&per_page=1&orderby=finished_at&order=desc';

		if (scannerIdKey) {
			url += `&scanner_id=${encodeURIComponent(scannerIdKey)}`;
		}

		if (categoryKey) {
			url += `&category=${encodeURIComponent(categoryKey)}`;
		}

		getApiResponse<{ data: ScanRow[] }>(url, {
			headers: { 'X-WP-Nonce': appLocalizer.nonce },
		})
			.then((response) => {
				setLastScanAt(response?.data?.[0]?.finished_at ?? null);
			})
			.finally(() => setIsLoading(false));
	}, [scannerIdKey, categoryKey]);

	return { lastScanAt, isLoading };
};
