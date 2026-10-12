/* global vulopilotAppLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import { NoticeManager } from '@zyra/components';

interface ScanQueueStatus {
	running: boolean;
	total: number;
	remaining: number;
}

/** How often to re-check `/scans/status` while a queued run is in progress. */
const POLL_INTERVAL_MS = 1500;

/** `POST /scans` only queues scanners now (ScanRunner::run_queued()) - this polls
 * `/scans/status` until the background batch runner (ScanRunner::process_batch(), via
 * WP-Cron) has drained the queue. */
const pollUntilDone = (onDone: () => void) => {
	const tick = () => {
		getApiResponse<ScanQueueStatus>(
			getApiLink(vulopilotAppLocalizer, 'scans/status'),
			{ headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } }
		).then((status) => {
			if (!status || !status.running) {
				onDone();
				return;
			}

			setTimeout(tick, POLL_INTERVAL_MS);
		});
	};

	setTimeout(tick, POLL_INTERVAL_MS);
};

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
							'Scan started - this can take a minute…',
							'vulopilot'
						),
					});
					// The request above only confirms the scan was queued (ScanRunner::run_queued()) -
					// real results land across background batch ticks, so this polls for completion
					// instead of assuming they're already in the database.
					pollUntilDone(() => {
						setIsScanning(false);
						NoticeManager.add({
							uniqueKey: 'vulopilot-scan-done',
							type: 'success',
							position: 'float',
							title: __('Success', 'vulopilot'),
							message: __('Scan complete - refreshing…', 'vulopilot'),
						});
						setTimeout(() => onSuccess(), 900);
					});
					return;
				}

				setIsScanning(false);
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
			})
			.catch(() => setIsScanning(false));
	};

	const runScanButton = {
		label: isScanning ? __('Scanning…', 'vulopilot') : __('Run scan', 'vulopilot'),
		icon: 'search',
		color: 'border-purple icon',
		onClick: runScan,
	};

	return { isScanning, runScan, runScanButton };
};
