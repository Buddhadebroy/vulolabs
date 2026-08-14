/* global appLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';
import type { FindingGroup } from '../AIAssistant/issuesTypes';

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * Shared `GET /findings/groups` fetch with no `category` filter — same
 * all-categories shape SectionedIssuesTable.tsx's own internal fetch
 * already uses. Unlike useGeoFindingGroups.ts (fixed to `category=geo`),
 * this is for callers whose own scanner ids span more than one real
 * `category` column value — AeoTab.tsx's own 5 AEO_SECTIONS include
 * `aeo-schema` (registered under Free's own 'seo'-ish scanner set) and
 * `llms-txt-missing` (vulopilot-pro, its own 'geo' scanner but Pro-gated),
 * so a `category=geo`-scoped fetch would silently miss one of them.
 */
export const useAllFindingGroups = (): {
	groups: FindingGroup[];
	isLoading: boolean;
} => {
	const [groups, setGroups] = useState<FindingGroup[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<{ data: FindingGroup[] }>(
			getApiLink(appLocalizer, 'findings/groups?per_page=200'),
			nonceHeaders
		)
			.then((response) => setGroups(response?.data ?? []))
			.finally(() => setIsLoading(false));
	}, []);

	return { groups, isLoading };
};
