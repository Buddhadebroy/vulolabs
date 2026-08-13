/* global appLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';
import type { FindingGroup } from '../AIAssistant/issuesTypes';

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * Shared `GET /findings/groups?category=woocommerce` fetch — one real
 * call, reused by WooCommerceCategoryGrid.tsx (per-card counts, summed
 * per scanner_id bucket — see WooCommerceTab.constants.ts) and
 * WooCommerceIssuesTable.tsx (its "Important" tab's scanner_ids, computed
 * from whichever groups are currently critical/high severity). 200 is
 * comfortably above the real number of 'woocommerce'-category scanners
 * that exist today (~19), so every group always lands on page 1.
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
