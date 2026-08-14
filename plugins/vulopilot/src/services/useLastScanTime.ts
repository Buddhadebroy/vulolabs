/* global appLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';

interface ScanRow {
	finished_at: string | null;
}

/**
 * The real most recent *completed* scan run's own `finished_at`
 * (`vulopilot_scans`, `GET /scans`) for one scanner group — or, when
 * `scannerIds` is omitted, the single most recent completed run of any
 * scanner site-wide. `null` while loading or when nothing has ever
 * completed for this scope (never a fabricated date).
 *
 * @param scannerIds Real scanner ids to scope to, or omit for site-wide.
 */
export const useLastScanTime = (
	scannerIds?: string[]
): { lastScanAt: string | null; isLoading: boolean } => {
	const [lastScanAt, setLastScanAt] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const scannerIdKey = scannerIds?.join(',') ?? '';

	useEffect(() => {
		setIsLoading(true);

		let url =
			getApiLink(appLocalizer, 'scans') +
			'?status=completed&per_page=1&orderby=finished_at&order=desc';

		if (scannerIdKey) {
			url += `&scanner_id=${encodeURIComponent(scannerIdKey)}`;
		}

		getApiResponse<{ data: ScanRow[] }>(url, {
			headers: { 'X-WP-Nonce': appLocalizer.nonce },
		})
			.then((response) => {
				setLastScanAt(response?.data?.[0]?.finished_at ?? null);
			})
			.finally(() => setIsLoading(false));
	}, [scannerIdKey]);

	return { lastScanAt, isLoading };
};
