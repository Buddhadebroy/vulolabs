/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { NoticeManager } from '@zyra/components';

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
	 * refetch (e.g. FindingsTable's `refetch`) so results show up without
	 * a manual page refresh. Defaults to a full `window.location.reload()`
	 * when omitted (every call site except Dashboard.tsx's own lighter
	 * `loadDashboard` refetch) — `POST /scans` runs every scanner
	 * synchronously before responding (Controllers\Scans::create_item()'s
	 * own docblock), so by the time this fires the new findings are
	 * already in the database; without this default, 9 of this component's
	 * 10 real call sites (every category page except Dashboard) left their
	 * on-screen tables/cards stale until the user manually refreshed the
	 * browser tab — confirmed missing on Content/SiteHealth/SeoVisibility/
	 * Accessibility/Reports/Health/Performance/Security/Commerce.
	 */
	onSuccess?: () => void;
}

const defaultOnSuccess = () => window.location.reload();

/**
 * "Run scan" — same `POST /scans` call Dashboard's Run Audit widget
 * already uses, extracted so every category page's own
 * NavigatorHeaderComponent can get the same button without duplicating
 * the fetch/notice/loading-state wiring.
 */
export const useRunScan = ({ categories, onSuccess = defaultOnSuccess }: UseRunScanOptions = {}) => {
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
						uniqueKey: 'vulopilot-scan-complete',
						type: 'success',
						position: 'float',
						title: __(
							'Success',
							'vulopilot'
						),
						message: __(
							'Scan complete — refreshing…',
							'vulopilot'
						),
					});
					// Real scan results are already in the database by now
					// (the request above only just resolved after
					// `ScanRunner` finished running) — the delay here is
					// purely so the notice above is actually readable
					// before the default `onSuccess` reloads the page out
					// from under it.
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
