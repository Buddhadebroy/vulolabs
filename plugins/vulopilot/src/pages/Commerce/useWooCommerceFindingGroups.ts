/* global appLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';
import type { FindingGroup } from '../../components/Issues/issuesTypes';

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * Shared `GET /findings/groups?category=woocommerce` fetch. The real
 * fetch itself now only runs from vulopilot-pro's own (moved) CommerceTab.tsx
 * — this Free-side copy stays only for `sumGroupCounts()` below, which
 * Free's own CommerceIssuesTable.tsx (kept here — see that module's own
 * Module.php docblock for why) still needs for its tab bar's counts.
 */
export const useWooCommerceFindingGroups = (): {
	groups: FindingGroup[];
	isLoading: boolean;
} => {
	const [groups, setGroups] = useState<FindingGroup[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<{ data: FindingGroup[] }>(
			getApiLink(
				appLocalizer,
				'findings/groups?category=woocommerce&per_page=200'
			),
			nonceHeaders
		)
			.then((response) => setGroups(response?.data ?? []))
			.finally(() => setIsLoading(false));
	}, []);

	return { groups, isLoading };
};

/**
 * Real sum of `.count` across every group whose scanner_id is in
 * `scannerIds` — the individual-finding-level total for a bucket (not a
 * group count), matching how "8 images are missing alt text" already
 * represents 8 real findings in one group elsewhere in this app.
 */
export const sumGroupCounts = (
	groups: FindingGroup[],
	scannerIds: string[]
): number =>
	groups
		.filter((group) => scannerIds.includes(group.scanner_id))
		.reduce((total, group) => total + group.count, 0);
