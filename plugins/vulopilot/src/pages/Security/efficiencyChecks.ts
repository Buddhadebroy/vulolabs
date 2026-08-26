/* global appLocalizer */
import { useCallback, useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';

export interface EfficiencyTechnicalDetail {
	label: string;
	value: string;
	status: 'good' | 'attention';
}

export interface EfficiencyCheck {
	id: string;
	title: string;
	description: string;
	icon: string;
	status: 'good' | 'attention' | 'not_applicable';
	badge: string;
	review_title: string;
	review_description: string;
	technical_details: EfficiencyTechnicalDetail[];
}

export interface EfficiencySection {
	key: string;
	label: string;
	question: string;
	checks: EfficiencyCheck[];
}

export interface EfficiencySummary {
	total: number;
	need_attention: number;
	working: number;
	not_applicable: number;
}

export interface EfficiencyChecksResponse {
	summary: EfficiencySummary;
	sections: EfficiencySection[];
	review_items: EfficiencyCheck[];
}

/**
 * `GET /efficiency-checks` (Controllers\EfficiencyChecks.php) — every
 * check computed live on the server on each call, not read back from
 * stored findings (that controller's own docblock explains why). Shared
 * by every component on this tab that needs the same payload
 * (PerformanceTab.tsx's own header count, EfficiencyHeroCard,
 * EfficiencySectionsList, EfficiencyThingsToReview,
 * EfficiencyOverviewChart) rather than each one fetching independently —
 * the "Run Efficiency Test" button re-runs all of them at once via one
 * `refetch()`.
 */
export const useEfficiencyChecks = () => {
	const [data, setData] = useState<EfficiencyChecksResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [reloadToken, setReloadToken] = useState(0);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);

		getApiResponse<EfficiencyChecksResponse>(
			getApiLink(appLocalizer, 'efficiency-checks'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (!cancelled && response) {
					setData(response);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [reloadToken]);

	const refetch = useCallback(() => setReloadToken((n) => n + 1), []);

	return { data, isLoading, refetch };
};

/** DOM id the "Things to review" section is scrolled to from the hero's own aggregate "Review N Improvements" button (a real "jump to the whole list" action — there's no single check it's about). */
export const THINGS_TO_REVIEW_ID = 'protect-my-site-efficiency-review';

/**
 * Real DOM id for one check's own row inside EfficiencySectionsList.tsx
 * (Page Delivery/WordPress Data Efficiency/Server Processing) — what
 * "Things to review"'s own per-row "Open" badge scrolls back to.
 *
 * @param {string} checkId Real `EfficiencyCheck.id`, e.g. 'page-caching'.
 */
export const efficiencyCheckRowId = (checkId: string): string =>
	`efficiency-check-${checkId}`;

/**
 * Real, per-check className on that check's own row inside
 * EfficiencyThingsToReview.tsx's `ListComponent` — a real querySelector
 * target, not a DOM id, since `ListComponent` doesn't forward `item.id`
 * onto the row element it renders (confirmed reading its source). What a
 * section's own inline "Review →" button scrolls to instead of every
 * check funneling into the same generic `THINGS_TO_REVIEW_ID` top-of-list
 * spot regardless of which one was actually clicked.
 *
 * @param {string} checkId Real `EfficiencyCheck.id`, e.g. 'page-caching'.
 */
export const efficiencyReviewItemClass = (checkId: string): string =>
	`efficiency-review-item-${checkId}`;
