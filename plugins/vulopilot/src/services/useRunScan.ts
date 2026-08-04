/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { NoticeManager } from '@zyra/components';

/**
 * "Run scan" — same `POST /scans` call (`scanner_id: 'all'`,
 * `trigger_type: 'manual'`) Dashboard.tsx's own handleRunScan already uses,
 * extracted so every category page's own NavigatorHeaderComponent can get
 * the same button without duplicating the fetch/notice/loading-state wiring.
 * Always runs every registered scanner — Controllers\Scans::create_item()
 * only accepts a single scanner id or 'all', not a comma-joined subset like
 * the read-only `/findings` list endpoint does, so a category page can't
 * scope this to just its own scanners today.
 *
 * @param onSuccess Called after a successful scan completes — pages pass
 *   their own refetch (e.g. FindingsTable's `refetch`, or a page-level
 *   reload) so results show up without a manual page refresh.
 */
export const useRunScan = (onSuccess?: () => void) => {
	const [isScanning, setIsScanning] = useState(false);

	const runScan = () => {
		setIsScanning(true);

		sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'scans'), {
			scanner_id: 'all',
			trigger_type: 'manual',
		})
			.then((response) => {
				if (response) {
					NoticeManager.add({
						uniqueKey: 'vulopilot-scan-started',
						type: 'success',
						position: 'float',
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
