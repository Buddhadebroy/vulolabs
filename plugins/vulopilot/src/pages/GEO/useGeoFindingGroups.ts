/* global appLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';
import type { FindingGroup } from '../AIAssistant/issuesTypes';

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * Shared `GET /findings/groups?category=geo` fetch — same "one real call,
 * reused by every card that needs a per-scanner-id breakdown" pattern
 * WooCommerce's own useWooCommerceFindingGroups.ts already establishes.
 * Used by GeoFixTheseFirstCard.tsx and GeoByTopicGrid.tsx so the GEO tab's
 * "Fix These First" and "A Closer Look, By Topic" sections don't each run
 * their own independent copy of the same fetch. 200 is comfortably above
 * the real number of 'geo'-category scanners that exist today (12).
 * Deliberately separate from SectionedIssuesTable.tsx's own internal
 * fetch (all categories, powering the "All GEO Issues" table further down
 * this same tab) — that one needs every category for its cross-page
 * "Important" tab logic, this one only ever needs 'geo'.
 */
export const useGeoFindingGroups = (): {
	groups: FindingGroup[];
	isLoading: boolean;
} => {
	const [groups, setGroups] = useState<FindingGroup[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<{ data: FindingGroup[] }>(
			getApiLink(appLocalizer, 'findings/groups?category=geo&per_page=200'),
			nonceHeaders
		)
			.then((response) => setGroups(response?.data ?? []))
			.finally(() => setIsLoading(false));
	}, []);

	return { groups, isLoading };
};

/** Real sum of `.count` across every group whose scanner_id is in `scannerIds` — same technique useWooCommerceFindingGroups.ts's own `sumGroupCounts()` already establishes. */
export const sumGroupCounts = (
	groups: FindingGroup[],
	scannerIds: string[]
): number =>
	groups
		.filter((group) => scannerIds.includes(group.scanner_id))
		.reduce((total, group) => total + group.count, 0);
