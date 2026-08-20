/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { NoticeManager } from '@zyra/components';
import { title } from 'node:process';

interface UseRunScanOptions {
	/**
	 * Category ids (e.g. `['security', 'accessibility']`) to scope the
	 * scan to, via `POST /scans`' `category` param —
	 * `Controllers\Scans::create_item()` runs `ScanRunner::run_category()`
	 * per category rather than every registered scanner. A category
	 * page's own header "Run scan" button passes its own local category
	 * set here so clicking it only re-runs what that page actually shows,
	 * same reasoning the read-only `/findings` list endpoint's own
	 * comma-joined `category`/`scanner_id` params already established.
	 * Omit to run every registered scanner (`scanner_id: 'all'`) — the
	 * original, page-agnostic behavior, still what Dashboard's Run Audit
	 * widget and Health.tsx's own "Run scan" want (both are whole-site
	 * overviews, not scoped to one category).
	 */
	categories?: string[];
	/**
	 * Called after a successful scan completes — pages pass their own
	 * refetch (e.g. FindingsTable's `refetch`, or a page-level reload) so
	 * results show up without a manual page refresh.
	 */
	onSuccess?: () => void;
}

/**
 * "Run scan" — same `POST /scans` call Dashboard's Run Audit widget
 * already uses, extracted so every category page's own
 * NavigatorHeaderComponent can get the same button without duplicating
 * the fetch/notice/loading-state wiring.
 */
export const useRunScan = ({ categories, onSuccess }: UseRunScanOptions = {}) => {
	const [isScanning, setIsScanning] = useState(false);

	const runScan = () => {
		if (isScanning) {
			return;
		}

		setIsScanning(true);

		sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'scans'), {
			...(categories?.length
				? { category: categories.join(',') }
				: { scanner_id: 'all' }),
			trigger_type: 'manual',
		})
			.then((response) => {
				if (response) {
					NoticeManager.add({
						uniqueKey: 'vulopilot-scan-started',
						type: 'success',
						position: 'float',
						title: __(
							'Success',
							'vulopilot'
						),
						message: __(
							'Scan started — results will appear here shortly.',
							'vulopilot'
						),
					});
					onSuccess?.();
				} else {
					NoticeManager.add({
						uniqueKey: 'vulopilot-scan-failed',
						type: 'error',
						position: 'float',
						title: __(
							'Error',
							'vulopilot'
						),
						message: __(
							'Could not start a scan. Please try again.',
							'vulopilot'
						),
					});
				}
			})
			.finally(() => setIsScanning(false));
	};

	const runScanButton = {
		label: isScanning ? __('Scanning…', 'vulopilot') : __('Run scan', 'vulopilot'),
		icon: 'search',
		color: 'purple-bg',
		onClick: runScan,
	};

	return { isScanning, runScan, runScanButton };
};
