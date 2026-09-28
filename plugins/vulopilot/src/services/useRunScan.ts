/* global vulopilotAppLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { NoticeManager } from '@zyra/components';

interface UseRunScanOptions {
	/**
	 * Category ids (e.g. `['security', 'accessibility']`) to scope the scan to, via `POST /scans`'
	 * `category` param.
	 */
	categories?: string[];
	/**
	 * Called after a successful scan completes - pages pass their own refetch (e.g.
	 * FindingsTable's `refetch`) so results show up without a manual page refresh.
	 */
	onSuccess?: () => void;
}

const defaultOnSuccess = () => window.location.reload();

/**
 * "Run scan" - same `POST /scans` call Dashboard's Run Audit widget already uses.
 */
export const useRunScan = ({ categories, onSuccess = defaultOnSuccess }: UseRunScanOptions = {}) => {
	const [isScanning, setIsScanning] = useState(false);

	const runScan = () => {
		if (isScanning) {
			return;
		}

		setIsScanning(true);

		sendApiResponse(vulopilotAppLocalizer, getApiLink(vulopilotAppLocalizer, 'scans'), {
			...(categories?.length
				? { category: categories.join(',') }
				: { scanner_id: 'all' }),
			trigger_type: 'manual',
		})
			.then((response) => {
				if (response) {
					NoticeManager.add({
						uniqueKey: 'vulopilot-scan-complete',
						type: 'success',
						position: 'float',
						title: __(
							'Success',
							'vulopilot'
						),
						message: __(
							'Scan complete - refreshing…',
							'vulopilot'
						),
					});
					// Real scan results are already in the database by now (the request above only
					// just resolved after `ScanRunner` finished running).
					setTimeout(() => onSuccess(), 900);
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
		color: 'border-purple icon',
		onClick: runScan,
	};

	return { isScanning, runScan, runScanButton };
};
